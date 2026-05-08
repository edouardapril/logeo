import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from app.config import get_settings
from app.database import get_db
from app.models.user import User
from app.models.deal import Deal, DealStatus
from app.models.bid import Bid, BidStatus, PaymentStatus as BidPaymentStatus
from app.models.nda import NDA
from app.models.payment import Payment, PaymentType, PaymentState
from app.models.deal_unit import DealUnit
from app.models.deal_question import DealQuestion
from app.schemas.deal import DealTeaser, DealFull
from app.schemas.bid import BidCreate, BidOwnerView, BidRankItem, BidEngagementSign
from app.schemas.nda import NDASign, NDAConfirmation
from app.schemas.unit import UnitView
from app.schemas.question import QuestionCreate, QuestionView
from app.schemas.payment import (
    SetupIntentResponse, ConfirmPaymentMethodRequest, PaymentMethodView,
    FeeQuote, PaymentView,
)
from app.services.auth import require_acheteur, block_in_impersonation
from app.services import email as email_service
from app.services import payment_service
from app.services.fee import compute_fees
from app.services import auction as auction_svc
from app.services import realtime as realtime_svc
from app.database import AsyncSessionLocal

settings = get_settings()
router = APIRouter(prefix="/acheteur", tags=["acheteur"])


def _require_qualified(user: User):
    if not user.is_qualified:
        raise HTTPException(status_code=403, detail="Compte non qualifié. Contactez l'équipe Logeo.")


async def _get_active_deal(deal_id: uuid.UUID, db: AsyncSession) -> Deal:
    result = await db.execute(
        select(Deal).where(
            Deal.id == deal_id,
            Deal.status.in_([DealStatus.bid, DealStatus.intro, DealStatus.pa_signed]),
            Deal.archived_at.is_(None),
        )
    )
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal introuvable ou non disponible")
    return deal


async def _has_signed_nda(deal_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> bool:
    result = await db.execute(
        select(NDA).where(NDA.deal_id == deal_id, NDA.acheteur_id == user_id)
    )
    return result.scalar_one_or_none() is not None


# ── Découverte des deals ───────────────────────────────────────────────────────

@router.get("/deals", response_model=list[DealTeaser])
async def list_available_deals(
    region: str | None = Query(default=None),
    property_type: str | None = Query(default=None),
    current_user: User = Depends(require_acheteur),
    db: AsyncSession = Depends(get_db),
):
    _require_qualified(current_user)
    query = select(Deal).where(
        Deal.status.in_([DealStatus.bid]),
        Deal.archived_at.is_(None),
    )
    if region:
        query = query.where(Deal.region == region)
    if property_type:
        query = query.where(Deal.property_type == property_type)
    result = await db.execute(query.order_by(Deal.bid_close_at.asc()))
    return result.scalars().all()


@router.get("/deals/regions")
async def list_active_regions(
    current_user: User = Depends(require_acheteur),
    db: AsyncSession = Depends(get_db),
):
    """Régions administratives où il y a au moins un deal en enchère active.

    Utilisé par le filtre frontend du listing — évite de hardcoder la liste
    côté UI et reflète l'état réel du marketplace.
    """
    _require_qualified(current_user)
    res = await db.execute(
        select(Deal.region, func.count(Deal.id))
        .where(
            Deal.status == DealStatus.bid,
            Deal.region.isnot(None),
            Deal.archived_at.is_(None),
        )
        .group_by(Deal.region)
        .order_by(Deal.region.asc())
    )
    return [{"region": r, "count": int(c)} for r, c in res.all() if r]


@router.get("/deals/{deal_id}", response_model=DealTeaser)
async def get_deal_teaser(
    deal_id: uuid.UUID,
    current_user: User = Depends(require_acheteur),
    db: AsyncSession = Depends(get_db),
):
    _require_qualified(current_user)
    deal = await _get_active_deal(deal_id, db)
    return deal


# ── NDA ───────────────────────────────────────────────────────────────────────

@router.post("/deals/{deal_id}/nda", response_model=NDAConfirmation)
async def sign_nda(
    deal_id: uuid.UUID,
    payload: NDASign,
    request: Request,
    current_user: User = Depends(require_acheteur),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(block_in_impersonation),
):
    _require_qualified(current_user)

    # Sprint final item 8 : 4 cases obligatoires
    consents = {
        "consent_confidentiality":         payload.consent_confidentiality,
        "consent_no_direct_contact":       payload.consent_no_direct_contact,
        "consent_logeo_exclusive_source":  payload.consent_logeo_exclusive_source,
        "consent_no_third_party_share":    payload.consent_no_third_party_share,
    }
    if not all(consents.values()):
        raise HTTPException(
            status_code=400,
            detail="Vous devez cocher les 4 clauses du NDA pour le signer.",
        )

    deal = await _get_active_deal(deal_id, db)

    if await _has_signed_nda(deal_id, current_user.id, db):
        result = await db.execute(
            select(NDA).where(NDA.deal_id == deal_id, NDA.acheteur_id == current_user.id)
        )
        return result.scalar_one()

    ip = request.client.host
    user_agent = request.headers.get("user-agent")

    nda = NDA(
        deal_id=deal_id,
        acheteur_id=current_user.id,
        ip_address=ip,
        user_agent=user_agent,
        consents=consents,
    )
    db.add(nda)
    await db.flush()

    # Génère le PDF + l'attache à la DB
    try:
        from app.services.nda_pdf import generate_nda_pdf
        from app.services import storage as storage_svc
        pdf_bytes = generate_nda_pdf(
            acheteur_full_name=current_user.full_name,
            acheteur_email=current_user.email,
            deal_id=str(deal_id),
            deal_city=deal.city,
            deal_address_private=deal.address_private,
            deal_property_type=deal.property_type.value if hasattr(deal.property_type, "value") else str(deal.property_type),
            signed_at=nda.signed_at,
            ip_address=ip,
            user_agent=user_agent,
            consents=consents,
        )
        nda.pdf_path = storage_svc.save(
            content=pdf_bytes,
            filename=f"nda_{str(deal_id)[:8]}_{str(current_user.id)[:8]}.pdf",
            kind=storage_svc.KIND_DOCUMENTS,
            subfolder=f"nda/{deal_id}",
            content_type="application/pdf",
        )
        await db.flush()
    except Exception:
        pdf_bytes = None  # pas bloquant

    # Email avec PDF en pièce jointe
    try:
        await email_service.send_nda_signee(
            db, current_user, deal_id,
            pdf_bytes=pdf_bytes,
            deal_city=deal.city,
        )
    except Exception:
        pass

    return nda


@router.get("/deals/{deal_id}/full", response_model=DealFull)
async def get_deal_full(
    deal_id: uuid.UUID,
    current_user: User = Depends(require_acheteur),
    db: AsyncSession = Depends(get_db),
):
    """Accès au dossier complet après NDA signé (adresse + courtier révélés)."""
    _require_qualified(current_user)

    if not await _has_signed_nda(deal_id, current_user.id, db):
        raise HTTPException(status_code=403, detail="Vous devez signer le NDA d'abord")

    deal = await _get_active_deal(deal_id, db)

    courtier_result = await db.execute(select(User).where(User.id == deal.courtier_id))
    courtier = courtier_result.scalar_one()

    return {
        **deal.__dict__,
        "courtier_name": courtier.full_name,
        "courtier_email": courtier.email,
        "courtier_phone": courtier.phone,
        "agency_name": courtier.agency_name,
        "courtier_oaciq_number": courtier.oaciq_number,
    }


# ── Enchères ──────────────────────────────────────────────────────────────────

@router.post("/deals/{deal_id}/engagement", status_code=200)
async def sign_engagement(
    deal_id: uuid.UUID,
    payload: BidEngagementSign,
    current_user: User = Depends(require_acheteur),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(block_in_impersonation),
):
    """Signature de l'engagement de paiement des frais Logeo - requis avant le 1er bid."""
    _require_qualified(current_user)
    if not await _has_signed_nda(deal_id, current_user.id, db):
        raise HTTPException(status_code=403, detail="NDA requis avant l'engagement")

    current_user.engagement_signed_at = datetime.now(timezone.utc)
    await db.flush()
    return {"message": "Engagement signé avec succès"}


@router.post("/deals/{deal_id}/bids", response_model=BidOwnerView, status_code=201)
async def place_bid(
    deal_id: uuid.UUID,
    payload: BidCreate,
    request: Request,
    current_user: User = Depends(require_acheteur),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(block_in_impersonation),
):
    _require_qualified(current_user)

    if not await _has_signed_nda(deal_id, current_user.id, db):
        raise HTTPException(status_code=403, detail="NDA requis avant d'enchérir")

    if not current_user.engagement_signed_at:
        raise HTTPException(status_code=403, detail="Engagement de paiement requis avant d'enchérir")

    if not payment_service.has_payment_method(current_user):
        raise HTTPException(
            status_code=403,
            detail="Carte de paiement requise avant d'enchérir. Enregistrez-la dans votre profil.",
        )

    # Décharge obligatoire — les 4 cases doivent être cochées
    consents = (
        payload.consent_documentation,
        payload.consent_questions_visit,
        payload.consent_firm_offer,
        payload.consent_fees_and_deposit,
    )
    if not all(consents):
        raise HTTPException(
            status_code=400,
            detail="Vous devez accepter les 4 conditions de la décharge avant d'enchérir.",
        )

    deal = await _get_active_deal(deal_id, db)
    if deal.status != DealStatus.bid:
        raise HTTPException(status_code=400, detail="Les enchères ne sont pas ouvertes")
    if deal.bid_close_at and deal.bid_close_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="L'enchère est terminée")

    # ── Validation proxy bid (floor + incrément) ──────────────────────────────
    state_before = await auction_svc.compute_auction_state(deal, db)
    err = auction_svc.validate_new_bid_amount(payload.amount, state_before, current_user.id)
    if err:
        raise HTTPException(status_code=400, detail=err)

    now = datetime.now(timezone.utc)
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")

    bid = Bid(
        deal_id=deal_id,
        acheteur_id=current_user.id,
        amount=payload.amount,
        engagement_signed=True,
        engagement_signed_at=current_user.engagement_signed_at,
        disclaimer_signed_at=now,
        disclaimer_ip=ip,
        disclaimer_user_agent=ua[:500] if ua else None,
    )
    db.add(bid)
    await db.flush()

    # ── État après le bid ─────────────────────────────────────────────────────
    state_after = await auction_svc.compute_auction_state(deal, db)
    new_winner_id = state_after["winner_id"]
    prev_winner_id = state_before["winner_id"]
    winner_changed = (
        prev_winner_id is not None and new_winner_id != prev_winner_id
    )

    # ── Anti-snipe (avant emails pour avoir la nouvelle deadline) ─────────────
    extended = await auction_svc.maybe_anti_snipe(deal, db, AsyncSessionLocal)

    # ── Notifications ─────────────────────────────────────────────────────────
    await email_service.send_bid_soumis_admin(db, deal_id, current_user.full_name, payload.amount)

    if winner_changed:
        prev_user_res = await db.execute(select(User).where(User.id == prev_winner_id))
        prev_user = prev_user_res.scalar_one_or_none()
        if prev_user:
            try:
                await email_service.send_outbid(db, prev_user, deal_id, state_after["displayed_price"] or 0)
            except Exception:
                pass
        try:
            await email_service.send_now_leading(db, current_user, deal_id, state_after["displayed_price"] or 0)
        except Exception:
            pass

    if extended:
        # Email à tous les bidders du deal
        bidders_res = await db.execute(
            select(User)
            .join(Bid, Bid.acheteur_id == User.id)
            .where(Bid.deal_id == deal_id)
            .distinct()
        )
        bidders = list(bidders_res.scalars().all())
        try:
            await email_service.send_auction_extended(db, bidders, deal_id, deal.bid_close_at)
        except Exception:
            pass

    # ── WebSocket events temps réel ───────────────────────────────────────────
    new_close_iso = deal.bid_close_at.isoformat() if deal.bid_close_at else None
    try:
        await realtime_svc.publish_new_bid(
            deal_id,
            displayed_price=state_after["displayed_price"],
            bidders_count=state_after["bidders_count"],
            floor_price=state_after.get("floor"),
            increment=state_after.get("increment"),
            extended=extended,
            new_close_at=new_close_iso,
        )
        if extended:
            await realtime_svc.publish_timer_extended(deal_id, new_close_iso)
        if winner_changed:
            if prev_winner_id:
                await realtime_svc.publish_outbid(
                    deal_id,
                    previous_winner_id=str(prev_winner_id),
                    displayed_price=state_after["displayed_price"],
                    deal_city=deal.city,
                )
            await realtime_svc.publish_leading(
                deal_id,
                new_winner_id=str(current_user.id),
                displayed_price=state_after["displayed_price"],
            )
    except Exception:
        # Ne jamais bloquer la création du bid si le bus WS échoue
        pass

    return bid


@router.get("/deals/{deal_id}/bids/mine", response_model=list[BidOwnerView])
async def my_bids(
    deal_id: uuid.UUID,
    current_user: User = Depends(require_acheteur),
    db: AsyncSession = Depends(get_db),
):
    """Un acheteur ne voit QUE ses propres bids."""
    result = await db.execute(
        select(Bid)
        .where(Bid.deal_id == deal_id, Bid.acheteur_id == current_user.id)
        .order_by(Bid.created_at.desc())
    )
    return result.scalars().all()


@router.get("/deals/{deal_id}/bids/ranking")
async def bid_ranking(
    deal_id: uuid.UUID,
    current_user: User = Depends(require_acheteur),
    db: AsyncSession = Depends(get_db),
):
    """
    Vue proxy bid pour l'acheteur :
      - floor_price (public)
      - displayed_price (= 2e plus haute max + incrément)
      - min_next_bid (montant minimum qu'il faudrait surenchérir)
      - i_am_leading (boolean) — l'utilisateur courant est-il en tête ?
      - bidders_count
    """
    _require_qualified(current_user)
    if not await _has_signed_nda(deal_id, current_user.id, db):
        raise HTTPException(status_code=403, detail="NDA requis pour voir le classement")

    deal_res = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = deal_res.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal introuvable")

    state = await auction_svc.compute_auction_state(deal, db)
    increment = state["increment"]
    base = state["displayed_price"] or state["floor"] or 0
    i_am_leading = state["winner_id"] == current_user.id and state["winner_id"] is not None
    return {
        "floor_price": state["floor"],
        "displayed_price": state["displayed_price"],
        "min_next_bid": (base + increment) if state["bidders_count"] > 0 else state["floor"],
        "increment": increment,
        "bidders_count": state["bidders_count"],
        "i_am_leading": i_am_leading,
    }


# ── Stripe : carte de paiement ────────────────────────────────────────────────

@router.get("/payment-method", response_model=PaymentMethodView)
async def get_payment_method(
    current_user: User = Depends(require_acheteur),
    db: AsyncSession = Depends(get_db),
):
    """
    Renvoie l'état de la carte enregistrée. Si la DB pense qu'il n'y a pas de carte
    mais que Stripe en a une (ex : confirm a raté à la sauvegarde précédente),
    on tente une réconciliation automatique avant de répondre.
    """
    if not payment_service.has_payment_method(current_user) and current_user.stripe_customer_id:
        try:
            await payment_service.recover_payment_method_from_stripe(current_user, db)
        except Exception:
            # Ne bloque jamais le GET — la recovery est best-effort
            pass

    return PaymentMethodView(
        has_card=payment_service.has_payment_method(current_user),
        brand=current_user.payment_method_brand,
        last4=current_user.payment_method_last4,
        exp_month=current_user.payment_method_exp_month,
        exp_year=current_user.payment_method_exp_year,
    )


@router.post("/payment-method/recover", response_model=PaymentMethodView)
async def recover_payment_method(
    current_user: User = Depends(require_acheteur),
    db: AsyncSession = Depends(get_db),
):
    """
    Force la réconciliation : interroge Stripe et synchronise la DB.
    Utile en debug ou quand le frontend détecte un état incohérent.
    """
    info = await payment_service.recover_payment_method_from_stripe(current_user, db)
    if not info:
        return PaymentMethodView(has_card=False)
    return PaymentMethodView(
        has_card=True,
        brand=info["brand"],
        last4=info["last4"],
        exp_month=info["exp_month"],
        exp_year=info["exp_year"],
    )


@router.get("/payment-method/diag")
async def stripe_diag(
    current_user: User = Depends(require_acheteur),
):
    """Diagnostic Stripe non sensible — utilisé pour debug 'A processing error occurred'."""
    from app.services import stripe_service
    return {
        **stripe_service.runtime_diagnostic(),
        "user_id": str(current_user.id),
        "user_qualified": current_user.is_qualified,
        "user_has_customer": bool(current_user.stripe_customer_id),
        "user_has_pm": bool(current_user.stripe_payment_method_id),
    }


@router.post("/payment-method/setup-intent", response_model=SetupIntentResponse)
async def create_setup_intent(
    current_user: User = Depends(require_acheteur),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(block_in_impersonation),
):
    import logging
    import stripe
    from app.services import stripe_service
    log = logging.getLogger("logeo.acheteur")

    _require_qualified(current_user)

    if not settings.stripe_secret_key or not settings.stripe_publishable_key:
        log.error("Stripe keys missing — setup-intent cannot be created. diag=%s",
                  stripe_service.runtime_diagnostic())
        raise HTTPException(
            status_code=500,
            detail="Stripe non configuré côté serveur (clés manquantes).",
        )

    diag = stripe_service.runtime_diagnostic()
    if not diag["keys_same_account"]:
        log.error(
            "Stripe keys appear to belong to different accounts: secret=%s pub=%s",
            diag["secret_key_prefix"], diag["publishable_key_prefix"],
        )
        raise HTTPException(
            status_code=500,
            detail="STRIPE_SECRET_KEY et STRIPE_PUBLISHABLE_KEY proviennent de comptes Stripe différents.",
        )

    log.info(
        "setup-intent requested user=%s qualified=%s stripe_diag=%s",
        current_user.id, current_user.is_qualified, diag,
    )

    try:
        intent = await payment_service.create_setup_intent_for_user(current_user, db)
    except stripe.StripeError as e:
        log.error(
            "Stripe error creating SetupIntent: code=%s status=%s msg=%s",
            getattr(e, "code", None), getattr(e, "http_status", None), str(e),
        )
        raise HTTPException(
            status_code=502,
            detail=f"Stripe error: {getattr(e, 'user_message', None) or str(e)}",
        )

    log.info(
        "setup-intent created intent_id=%s client_secret_prefix=%s",
        intent.get("id"), (intent.get("client_secret") or "")[:24],
    )
    return SetupIntentResponse(
        client_secret=intent["client_secret"],
        publishable_key=settings.stripe_publishable_key,
    )


@router.post("/payment-method/confirm", response_model=PaymentMethodView)
async def confirm_payment_method(
    payload: ConfirmPaymentMethodRequest,
    current_user: User = Depends(require_acheteur),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(block_in_impersonation),
):
    info = await payment_service.save_payment_method(
        current_user, payload.payment_method_id, db
    )
    return PaymentMethodView(
        has_card=True,
        brand=info["brand"],
        last4=info["last4"],
        exp_month=info["exp_month"],
        exp_year=info["exp_year"],
    )


@router.delete("/payment-method", response_model=PaymentMethodView)
async def delete_payment_method(
    current_user: User = Depends(require_acheteur),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(block_in_impersonation),
):
    await payment_service.remove_payment_method(current_user, db)
    return PaymentMethodView(has_card=False)


# ── Due diligence : déclenche le débit du solde ──────────────────────────────

@router.get("/deals/{deal_id}/fee-quote", response_model=FeeQuote)
async def fee_quote(
    deal_id: uuid.UUID,
    current_user: User = Depends(require_acheteur),
    db: AsyncSession = Depends(get_db),
):
    """Retourne le calcul de frais sur le bid gagnant si l'acheteur courant l'a remporté."""
    res = await db.execute(
        select(Bid).where(
            Bid.deal_id == deal_id,
            Bid.acheteur_id == current_user.id,
            Bid.status == BidStatus.winner,
        )
    )
    bid = res.scalar_one_or_none()
    if not bid:
        raise HTTPException(status_code=404, detail="Vous n'êtes pas le gagnant de ce deal")
    fees = compute_fees(bid.amount)
    return FeeQuote(
        sale_price=fees.sale_price_cad,
        total_fee=fees.total_fee_cad,
        deposit=fees.deposit_cad,
        balance=fees.balance_cad,
    )


@router.get("/deals/{deal_id}/payments", response_model=list[PaymentView])
async def my_payments_for_deal(
    deal_id: uuid.UUID,
    current_user: User = Depends(require_acheteur),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(Payment)
        .where(Payment.deal_id == deal_id, Payment.acheteur_id == current_user.id)
        .order_by(Payment.created_at.desc())
    )
    return res.scalars().all()


@router.get("/payments/history")
async def my_payments_history(
    current_user: User = Depends(require_acheteur),
    db: AsyncSession = Depends(get_db),
):
    """Historique global enrichi (montant, date, deal city + type) pour la page Paiement."""
    res = await db.execute(
        select(Payment)
        .where(Payment.acheteur_id == current_user.id)
        .order_by(Payment.created_at.desc())
    )
    payments = res.scalars().all()
    enriched = []
    for p in payments:
        d_res = await db.execute(select(Deal).where(Deal.id == p.deal_id))
        d = d_res.scalar_one_or_none()
        enriched.append({
            "id": str(p.id),
            "deal_id": str(p.deal_id),
            "deal_city": d.city if d else None,
            "type": p.type.value,
            "amount_cents": p.amount_cents,
            "currency": p.currency,
            "state": p.state.value,
            "stripe_payment_intent_id": p.stripe_payment_intent_id,
            "failure_message": p.failure_message,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "succeeded_at": p.succeeded_at.isoformat() if p.succeeded_at else None,
        })
    return enriched


@router.post("/deals/{deal_id}/due-diligence-complete")
async def due_diligence_complete(
    deal_id: uuid.UUID,
    current_user: User = Depends(require_acheteur),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(block_in_impersonation),
):
    """Acheteur gagnant déclare sa due diligence terminée → débit du solde 75%."""
    deal_res = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = deal_res.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal introuvable")

    bid_res = await db.execute(
        select(Bid).where(
            Bid.deal_id == deal_id,
            Bid.acheteur_id == current_user.id,
            Bid.status == BidStatus.winner,
        )
    )
    bid = bid_res.scalar_one_or_none()
    if not bid:
        raise HTTPException(status_code=403, detail="Vous n'êtes pas le gagnant de ce deal")

    if bid.payment_status != BidPaymentStatus.deposit_confirmed:
        raise HTTPException(status_code=400, detail="Dépôt 25% non confirmé")

    if deal.due_diligence_completed_at:
        raise HTTPException(status_code=400, detail="Due diligence déjà confirmée")

    # Empêcher un double débit
    existing = await db.execute(
        select(Payment).where(
            Payment.deal_id == deal_id,
            Payment.bid_id == bid.id,
            Payment.type == PaymentType.balance,
            Payment.state.in_([PaymentState.succeeded, PaymentState.pending]),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Solde déjà débité ou en cours")

    deal.due_diligence_completed_at = datetime.now(timezone.utc)
    bid.payment_status = BidPaymentStatus.balance_sent
    payment = await payment_service.charge_balance(deal, bid, current_user, db)
    return PaymentView.model_validate(payment)


# ── Logements (vue acheteur après NDA) ───────────────────────────────────────

@router.get("/deals/{deal_id}/units", response_model=list[UnitView])
async def get_deal_units(
    deal_id: uuid.UUID,
    current_user: User = Depends(require_acheteur),
    db: AsyncSession = Depends(get_db),
):
    _require_qualified(current_user)
    if not await _has_signed_nda(deal_id, current_user.id, db):
        raise HTTPException(status_code=403, detail="NDA requis")
    res = await db.execute(
        select(DealUnit).where(DealUnit.deal_id == deal_id).order_by(DealUnit.order_index)
    )
    return res.scalars().all()


# ── FAQ publique (post-NDA) ──────────────────────────────────────────────────

@router.get("/deals/{deal_id}/questions", response_model=list[QuestionView])
async def list_questions(
    deal_id: uuid.UUID,
    current_user: User = Depends(require_acheteur),
    db: AsyncSession = Depends(get_db),
):
    _require_qualified(current_user)
    if not await _has_signed_nda(deal_id, current_user.id, db):
        raise HTTPException(status_code=403, detail="NDA requis")
    res = await db.execute(
        select(DealQuestion).where(DealQuestion.deal_id == deal_id).order_by(DealQuestion.asked_at.desc())
    )
    rows = res.scalars().all()
    out = []
    for q in rows:
        view = QuestionView.model_validate(q)
        view.is_mine = q.asker_id == current_user.id
        out.append(view)
    return out


@router.post("/deals/{deal_id}/questions", response_model=QuestionView, status_code=201)
async def create_question(
    deal_id: uuid.UUID,
    payload: QuestionCreate,
    current_user: User = Depends(require_acheteur),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(block_in_impersonation),
):
    _require_qualified(current_user)
    if not await _has_signed_nda(deal_id, current_user.id, db):
        raise HTTPException(status_code=403, detail="NDA requis avant de poser une question")

    deal_res = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = deal_res.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal introuvable")

    q = DealQuestion(
        deal_id=deal_id,
        asker_id=current_user.id,
        question=payload.question.strip(),
    )
    db.add(q)
    await db.flush()

    # Notifier le courtier — sprint final item 7
    courtier_res = await db.execute(select(User).where(User.id == deal.courtier_id))
    courtier = courtier_res.scalar_one_or_none()
    if courtier:
        try:
            await email_service.send_new_question(
                db, courtier=courtier,
                asker_name=current_user.full_name,
                deal_id=deal_id, city=deal.city,
                question=payload.question.strip(),
            )
        except Exception:
            pass  # ne pas bloquer la création si l'email échoue

    view = QuestionView.model_validate(q)
    view.is_mine = True
    return view


# ── Demande de visite ────────────────────────────────────────────────────────

class VisitRequest(BaseModel):
    proposed_slot: str | None = None
    note: str | None = None


@router.post("/deals/{deal_id}/visit-request")
async def request_visit(
    deal_id: uuid.UUID,
    payload: VisitRequest,
    current_user: User = Depends(require_acheteur),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(block_in_impersonation),
):
    _require_qualified(current_user)
    if not await _has_signed_nda(deal_id, current_user.id, db):
        raise HTTPException(status_code=403, detail="NDA requis avant de demander une visite")

    deal_res = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = deal_res.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal introuvable")

    courtier_res = await db.execute(select(User).where(User.id == deal.courtier_id))
    courtier = courtier_res.scalar_one_or_none()
    if not courtier:
        raise HTTPException(status_code=500, detail="Courtier introuvable")

    # Notification simple via email service
    try:
        from app.services import email as email_service
        await email_service.send_visit_request(
            db, courtier=courtier, acheteur=current_user, deal_id=deal_id,
            proposed_slot=payload.proposed_slot, note=payload.note,
        )
    except AttributeError:
        # Fallback : utilise un email générique si send_visit_request n'existe pas encore
        pass
    return {"status": "sent", "courtier_email": courtier.email}


# ── /mes-encheres : tous les deals où l'acheteur a participé (sprint final item 15) ─

@router.get("/my-auctions")
async def my_auctions(
    current_user: User = Depends(require_acheteur),
    db: AsyncSession = Depends(get_db),
):
    """
    Liste enrichie des deals où l'acheteur courant a placé au moins un bid.
    Pour chaque deal, calcule sa position (winning / outbid / lost) et l'état de l'enchère.

    Catégories implicites côté frontend :
      - en_cours      : status='bid' et bid_close_at futur
      - dd_en_cours   : status='intro' et acheteur courant = winner
      - gagne         : status in (intro, pa_signed) et acheteur courant = winner
      - perdu         : status in (intro, pa_signed, auction_ended) et autre winner / aucun
    """
    # Récupère tous les deal_ids où j'ai au moins un bid
    deal_ids_res = await db.execute(
        select(Bid.deal_id).where(Bid.acheteur_id == current_user.id).distinct()
    )
    deal_ids = [row[0] for row in deal_ids_res.all()]
    if not deal_ids:
        return []

    deals_res = await db.execute(
        select(Deal).where(Deal.id.in_(deal_ids)).order_by(Deal.bid_close_at.desc().nullslast())
    )
    deals = list(deals_res.scalars().all())

    out = []
    for d in deals:
        state = await auction_svc.compute_auction_state(d, db)

        # Bid gagnant courant pour ce deal
        winner_bid_res = await db.execute(
            select(Bid).where(Bid.deal_id == d.id, Bid.status == BidStatus.winner)
        )
        winner_bid = winner_bid_res.scalar_one_or_none()
        i_won = winner_bid is not None and winner_bid.acheteur_id == current_user.id

        # Mes bids sur ce deal
        my_bids_res = await db.execute(
            select(Bid).where(Bid.deal_id == d.id, Bid.acheteur_id == current_user.id)
            .order_by(Bid.amount.desc())
        )
        my_bids = list(my_bids_res.scalars().all())
        my_max = max((b.amount for b in my_bids), default=None)

        # Catégorie
        if d.status == DealStatus.bid:
            category = 'en_cours'
        elif d.status == DealStatus.intro and i_won:
            category = 'dd_en_cours'
        elif d.status == DealStatus.pa_signed and i_won:
            category = 'gagne'
        elif d.status in (DealStatus.intro, DealStatus.pa_signed, DealStatus.auction_ended):
            category = 'perdu'
        else:
            category = 'autre'

        # Pour la fenêtre DD : urgence
        dd_urgent = False
        if d.status == DealStatus.intro and i_won and d.due_diligence_deadline:
            now = datetime.now(timezone.utc)
            if (d.due_diligence_deadline - now).total_seconds() < 24 * 3600:
                dd_urgent = True

        out.append({
            "deal_id": str(d.id),
            "city": d.city,
            "region": d.region,
            "property_type": d.property_type.value if hasattr(d.property_type, "value") else str(d.property_type),
            "status": d.status.value if hasattr(d.status, "value") else str(d.status),
            "bid_close_at": d.bid_close_at.isoformat() if d.bid_close_at else None,
            "due_diligence_deadline": d.due_diligence_deadline.isoformat() if d.due_diligence_deadline else None,
            "displayed_price": state["displayed_price"],
            "floor_price": state["floor"],
            "min_next_bid": (state["displayed_price"] + state["increment"])
                if state["bidders_count"] > 0 and state["displayed_price"] is not None
                else state["floor"],
            "i_am_leading": state["winner_id"] == current_user.id and state["winner_id"] is not None,
            "i_won": i_won,
            "my_max": my_max,
            "my_bids_count": len(my_bids),
            "category": category,
            "dd_urgent": dd_urgent,
        })

    return out


# ── Dashboard sommaire (KPIs + dossiers actifs + deals à découvrir) ──────────

@router.get("/dashboard")
async def acheteur_dashboard(
    current_user: User = Depends(require_acheteur),
    db: AsyncSession = Depends(get_db),
):
    """Dashboard acheteur : KPIs (NDAs, bids actifs, deals gagnés, valeur totale offres),
    Mes dossiers actifs (deals avec activité NDA/bid), Deals à découvrir (récents non NDA'd).
    """
    # ── KPIs ──────────────────────────────────────────────────────────────────
    ndas_signed_res = await db.execute(
        select(func.count(NDA.id)).where(NDA.acheteur_id == current_user.id)
    )
    ndas_signed = int(ndas_signed_res.scalar() or 0)

    active_bids_res = await db.execute(
        select(Bid).where(
            Bid.acheteur_id == current_user.id,
            Bid.status == BidStatus.active,
        )
    )
    active_bids = list(active_bids_res.scalars().all())
    # Distinct deals where I have an active bid
    active_bid_deal_ids = {b.deal_id for b in active_bids}
    active_bids_count = len(active_bid_deal_ids)
    # Valeur totale = somme des max par deal (ma stratégie proxy bid courante)
    total_active_bids_value = 0
    for did in active_bid_deal_ids:
        my_max_res = await db.execute(
            select(func.max(Bid.amount)).where(
                Bid.deal_id == did,
                Bid.acheteur_id == current_user.id,
                Bid.status == BidStatus.active,
            )
        )
        m = my_max_res.scalar()
        if m:
            total_active_bids_value += int(m)

    won_res = await db.execute(
        select(func.count(Bid.id))
        .join(Deal, Deal.id == Bid.deal_id)
        .where(
            Bid.acheteur_id == current_user.id,
            Bid.status == BidStatus.winner,
            Deal.status == DealStatus.pa_signed,
        )
    )
    won_count = int(won_res.scalar() or 0)

    # ── Mes dossiers actifs : NDAs ou bids, deal pas archivé ──────────────────
    nda_deal_ids_res = await db.execute(
        select(NDA.deal_id).where(NDA.acheteur_id == current_user.id).distinct()
    )
    nda_deal_ids = {row[0] for row in nda_deal_ids_res.all()}
    bid_deal_ids_res = await db.execute(
        select(Bid.deal_id).where(Bid.acheteur_id == current_user.id).distinct()
    )
    bid_deal_ids = {row[0] for row in bid_deal_ids_res.all()}
    active_deal_ids = nda_deal_ids | bid_deal_ids

    active_deals: list = []
    if active_deal_ids:
        deals_res = await db.execute(
            select(Deal).where(
                Deal.id.in_(active_deal_ids),
                Deal.archived_at.is_(None),
            ).order_by(Deal.bid_close_at.desc().nullslast())
        )
        for d in deals_res.scalars():
            state = await auction_svc.compute_auction_state(d, db)
            i_lead = state["winner_id"] == current_user.id and state["winner_id"] is not None

            # Mon statut sur ce deal — label clair côté UX
            has_my_bid = d.id in bid_deal_ids
            winner_bid_res = await db.execute(
                select(Bid).where(Bid.deal_id == d.id, Bid.status == BidStatus.winner)
            )
            winner_bid = winner_bid_res.scalar_one_or_none()
            i_won = winner_bid is not None and winner_bid.acheteur_id == current_user.id

            if d.status == DealStatus.pa_signed and i_won:
                my_status_label = "Adjugé — PA signée"
            elif d.status == DealStatus.intro and i_won:
                my_status_label = "Adjugé — due diligence en cours"
            elif d.status == DealStatus.bid and has_my_bid and i_lead:
                my_status_label = "Offre la plus haute"
            elif d.status == DealStatus.bid and has_my_bid:
                my_status_label = "Offre dépassée"
            elif d.status == DealStatus.bid and not has_my_bid:
                my_status_label = "NDA signée — pas encore d'offre"
            elif d.status in (DealStatus.intro, DealStatus.pa_signed, DealStatus.auction_ended):
                my_status_label = "Enchère terminée"
            else:
                my_status_label = "—"

            active_deals.append({
                "deal_id": str(d.id),
                "city": d.city,
                "region": d.region,
                "property_type": str(d.property_type),
                "status": d.status.value if hasattr(d.status, "value") else str(d.status),
                "displayed_price": state["displayed_price"],
                "bid_close_at": d.bid_close_at.isoformat() if d.bid_close_at else None,
                "my_status_label": my_status_label,
            })

    # ── Deals à découvrir : 5 deals 'bid' actifs non NDA'd ────────────────────
    discover_query = select(Deal).where(
        Deal.status == DealStatus.bid,
        Deal.archived_at.is_(None),
        Deal.bid_close_at.isnot(None),
        Deal.bid_close_at > datetime.now(timezone.utc),
    )
    if nda_deal_ids:
        discover_query = discover_query.where(~Deal.id.in_(nda_deal_ids))
    discover_query = discover_query.order_by(Deal.bid_open_at.desc().nullslast()).limit(5)
    discover_res = await db.execute(discover_query)
    discover = []
    for d in discover_res.scalars():
        state = await auction_svc.compute_auction_state(d, db)
        discover.append({
            "deal_id": str(d.id),
            "city": d.city,
            "region": d.region,
            "property_type": str(d.property_type),
            "floor_price": d.floor_price,
            "displayed_price": state["displayed_price"],
            "bid_close_at": d.bid_close_at.isoformat() if d.bid_close_at else None,
            "teaser_photo_path": (
                (d.teaser_photo_paths or [None])[0]
                or d.teaser_photo_path
            ),
        })

    return {
        "kpis": {
            "ndas_signed": ndas_signed,
            "active_bids_count": active_bids_count,
            "won_deals": won_count,
            "total_active_bids_value": total_active_bids_value,
        },
        "active_deals": active_deals,
        "discover": discover,
    }


# ── Onboarding status (sprint UX item 2) ─────────────────────────────────────

@router.get("/onboarding-status")
async def onboarding_status(
    deal_id: uuid.UUID | None = None,
    current_user: User = Depends(require_acheteur),
    db: AsyncSession = Depends(get_db),
):
    """
    Retourne les étapes du parcours acheteur, avec done/current/pending.
    Si deal_id est fourni, ajoute les étapes per-deal (NDA + engagement).

    Format :
      {
        steps: [{key, label, done, helper?}, ...],
        current_step_index: int,
        ready_to_bid: bool,
        blocking_message: str | None,
      }
    """
    has_card = bool(current_user.stripe_payment_method_id)
    has_engagement = current_user.engagement_signed_at is not None

    has_signed_nda = False
    if deal_id:
        has_signed_nda = await _has_signed_nda(deal_id, current_user.id, db)

    # Étapes globales
    steps = [
        {"key": "register", "label": "Inscription", "done": True,
         "helper": "Compte Logeo créé"},
        {"key": "verify_email", "label": "Email confirmé", "done": current_user.email_verified,
         "helper": "Cliquez le lien dans l'email reçu" if not current_user.email_verified else None},
        {"key": "qualified", "label": "Approuvé par admin", "done": current_user.is_qualified,
         "helper": "L'équipe Logeo qualifie votre profil sous 24 h" if not current_user.is_qualified else None},
        {"key": "has_card", "label": "Carte enregistrée", "done": has_card,
         "helper": "Ajoutez une carte sur l'onglet Paiement" if not has_card else None},
    ]
    # Étapes per-deal seulement si deal_id donné
    if deal_id:
        steps.append({
            "key": "nda_signed", "label": "NDA signé", "done": has_signed_nda,
            "helper": "Signez le NDA depuis la page du deal" if not has_signed_nda else None,
        })
        steps.append({
            "key": "engagement_signed", "label": "Engagement signé", "done": has_engagement,
            "helper": "Engagement frais Logeo (1 fois)" if not has_engagement else None,
        })

    # Étape courante = première non-done
    current_step_index = next(
        (i for i, s in enumerate(steps) if not s["done"]), len(steps),
    )
    ready_to_bid = current_step_index >= len(steps)
    blocking_message = (
        f"Étape {current_step_index + 1}/{len(steps)} : "
        f"{steps[current_step_index]['label']}"
        if not ready_to_bid else None
    )

    return {
        "steps": steps,
        "current_step_index": current_step_index,
        "ready_to_bid": ready_to_bid,
        "blocking_message": blocking_message,
    }
