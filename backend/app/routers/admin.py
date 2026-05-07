import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.database import get_db
from app.models.user import User, UserRole
from app.models.deal import Deal, DealStatus
from app.models.bid import Bid, BidStatus, PaymentStatus
from app.models.payment import Payment, PaymentType, PaymentState
from app.models.nda import NDA
from app.models.deal_question import DealQuestion
from app.models.deal_review import DealReview
from app.models.sanction import UserSanction
from app.schemas.user import UserAdminView, UserQualifyRequest
from app.schemas.deal import DealAdminView, DealVerdict, DealListItem
from app.schemas.bid import BidAdminView, InteracConfirm
from app.schemas.payment import PaymentAdminView, PaymentView
from app.schemas.admin import (
    AdminMetrics, ActiveAuctionView, DDExpiringView,
    DealAdminListItem, ExtendBidCloseRequest,
    SanctionCreate, SanctionLift, SanctionView,
    AcheteurAdminRow, CourtierAdminRow, PendingApprovalRow,
)
from app.services.auth import require_admin
from app.services import email as email_service
from app.services import payment_service
from app.services.auction import (
    schedule_auction_close, compute_auction_state,
)
from app.services.fee import compute_fees
from app.services.pdf import apply_watermark
from app.database import AsyncSessionLocal
from app.config import get_settings

settings = get_settings()
router = APIRouter(prefix="/admin", tags=["admin"])


# ── Gestion des utilisateurs ──────────────────────────────────────────────────

@router.get("/users", response_model=list[UserAdminView])
async def list_users(
    role: UserRole | None = None,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(User)
    if role:
        query = query.where(User.role == role)
    result = await db.execute(query.order_by(User.created_at.desc()))
    return result.scalars().all()


@router.patch("/users/{user_id}/qualify", response_model=UserAdminView)
async def qualify_acheteur(
    user_id: uuid.UUID,
    payload: UserQualifyRequest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id, User.role == UserRole.acheteur))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Acheteur introuvable")
    user.is_qualified = payload.is_qualified
    await db.flush()
    return user


@router.patch("/users/{user_id}/activate")
async def toggle_user(
    user_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    user.is_active = not user.is_active
    await db.flush()
    return {"is_active": user.is_active}


# ── Gestion des deals ─────────────────────────────────────────────────────────

@router.get("/deals", response_model=list[DealListItem])
async def list_deals(
    status: DealStatus | None = None,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(Deal)
    if status:
        query = query.where(Deal.status == status)
    result = await db.execute(query.order_by(Deal.created_at.desc()))
    deals = result.scalars().all()
    status_filter = status.value if status else "ALL"
    print(f"[ADMIN_LIST_DEALS] (basic) filter status={status_filter} → {len(deals)} deal(s)", flush=True)
    return deals


# ── Liste enrichie : DOIT précéder /deals/{deal_id} sinon "enriched"
# ── est capturé comme deal_id et le parsing UUID échoue (422).
@router.get("/deals/enriched", response_model=list[DealAdminListItem])
async def list_deals_enriched(
    status: DealStatus | None = None,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Liste deals + compteurs (bids, NDAs, FAQ sans réponse)."""
    q = select(Deal)
    if status:
        q = q.where(Deal.status == status)
    q = q.order_by(Deal.created_at.desc())
    deals = (await db.execute(q)).scalars().all()

    # Log de diagnostic — montre le filtre appliqué et le nombre de deals retournés
    status_filter = status.value if status else "ALL"
    print(
        f"[ADMIN_LIST_DEALS] filter status={status_filter} → "
        f"{len(deals)} deal(s) retourné(s)",
        flush=True,
    )

    if not deals:
        return []

    deal_ids = [d.id for d in deals]

    bids_count_map: dict[uuid.UUID, int] = {}
    bcr = await db.execute(
        select(Bid.deal_id, func.count(Bid.id))
        .where(Bid.deal_id.in_(deal_ids))
        .group_by(Bid.deal_id)
    )
    for did, c in bcr.all():
        bids_count_map[did] = int(c)

    ndas_count_map: dict[uuid.UUID, int] = {}
    ncr = await db.execute(
        select(NDA.deal_id, func.count(NDA.id))
        .where(NDA.deal_id.in_(deal_ids))
        .group_by(NDA.deal_id)
    )
    for did, c in ncr.all():
        ndas_count_map[did] = int(c)

    unanswered_map: dict[uuid.UUID, int] = {}
    qcr = await db.execute(
        select(DealQuestion.deal_id, func.count(DealQuestion.id))
        .where(DealQuestion.deal_id.in_(deal_ids), DealQuestion.answer.is_(None))
        .group_by(DealQuestion.deal_id)
    )
    for did, c in qcr.all():
        unanswered_map[did] = int(c)

    out = []
    for d in deals:
        out.append(DealAdminListItem(
            id=d.id, status=d.status.value if hasattr(d.status, "value") else str(d.status),
            property_type=d.property_type.value if hasattr(d.property_type, "value") else str(d.property_type),
            city=d.city, asking_price=d.asking_price, floor_price=d.floor_price,
            bid_close_at=d.bid_close_at, created_at=d.created_at,
            bids_count=bids_count_map.get(d.id, 0),
            ndas_count=ndas_count_map.get(d.id, 0),
            unanswered_questions_count=unanswered_map.get(d.id, 0),
        ))
    return out


@router.get("/deals/{deal_id}", response_model=DealAdminView)
async def get_deal(
    deal_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal introuvable")

    courtier_result = await db.execute(select(User).where(User.id == deal.courtier_id))
    courtier = courtier_result.scalar_one()

    return {
        **deal.__dict__,
        "courtier_name": courtier.full_name,
        "courtier_email": courtier.email,
        "courtier_phone": courtier.phone,
        "agency_name": courtier.agency_name,
    }


@router.post("/deals/{deal_id}/verdict")
async def verdict(
    deal_id: uuid.UUID,
    payload: DealVerdict,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal introuvable")
    if deal.status != DealStatus.analyse:
        raise HTTPException(status_code=400, detail="Deal pas en phase d'analyse")

    courtier_result = await db.execute(select(User).where(User.id == deal.courtier_id))
    courtier = courtier_result.scalar_one()

    if payload.verdict == "go":
        deal.status = DealStatus.bid
        deal.fee_pct = payload.fee_pct or 1.5
        deal.fee_minimum = payload.fee_minimum or 5000
        close_at = payload.bid_close_at or (
            datetime.now(timezone.utc) + timedelta(hours=settings.default_auction_hours)
        )
        deal.bid_open_at = datetime.now(timezone.utc)
        deal.bid_close_at = close_at

        await db.flush()

        schedule_auction_close(deal_id, close_at, AsyncSessionLocal)
        await email_service.send_verdict_go(db, courtier, deal_id)
        await email_service.send_nouveau_deal(db, deal_id, deal.city, deal.property_type.value)

    elif payload.verdict == "nogo":
        if not payload.nogo_reason:
            raise HTTPException(status_code=400, detail="Le motif de refus est obligatoire")
        deal.status = DealStatus.nogo
        deal.nogo_reason = payload.nogo_reason
        await db.flush()
        await email_service.send_verdict_nogo(db, courtier, deal_id, payload.nogo_reason)
    else:
        raise HTTPException(status_code=400, detail="verdict doit être 'go' ou 'nogo'")

    return {"status": deal.status}


# ── Gestion des bids ──────────────────────────────────────────────────────────

@router.get("/deals/{deal_id}/bids", response_model=list[BidAdminView])
async def list_deal_bids(
    deal_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Bid).where(Bid.deal_id == deal_id).order_by(Bid.amount.desc())
    )
    bids = result.scalars().all()

    enriched = []
    for bid in bids:
        user_result = await db.execute(select(User).where(User.id == bid.acheteur_id))
        user = user_result.scalar_one()
        enriched.append({**bid.__dict__, "acheteur_name": user.full_name})
    return enriched


@router.post("/deals/{deal_id}/confirm-deposit")
async def confirm_deposit(
    deal_id: uuid.UUID,
    payload: InteracConfirm,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Confirme le dépôt Interac du gagnant et déclenche l'introduction officielle."""
    result = await db.execute(
        select(Bid).where(Bid.id == payload.bid_id, Bid.deal_id == deal_id, Bid.status == BidStatus.winner)
    )
    bid = result.scalar_one_or_none()
    if not bid:
        raise HTTPException(status_code=404, detail="Bid gagnant introuvable")

    bid.interac_ref = payload.interac_ref
    bid.payment_status = PaymentStatus.deposit_confirmed

    deal_result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = deal_result.scalar_one()
    deal.status = DealStatus.intro

    # Générer le PDF watermarqué si rapport complet disponible
    if deal.full_report_path:
        acheteur_result = await db.execute(select(User).where(User.id == bid.acheteur_id))
        acheteur = acheteur_result.scalar_one()
        watermarked = apply_watermark(
            deal.full_report_path,
            acheteur.id,
            acheteur.full_name,
            acheteur.email,
        )
        bid.watermarked_path = watermarked

    await db.flush()

    # Introduction officielle
    acheteur_result = await db.execute(select(User).where(User.id == bid.acheteur_id))
    acheteur = acheteur_result.scalar_one()
    courtier_result = await db.execute(select(User).where(User.id == deal.courtier_id))
    courtier = courtier_result.scalar_one()

    await email_service.send_depot_confirme(db, acheteur, courtier, deal_id, bid.amount)
    return {"status": "intro", "message": "Introduction officielle déclenchée"}


@router.post("/deals/{deal_id}/confirm-balance")
async def confirm_balance(
    deal_id: uuid.UUID,
    payload: InteracConfirm,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Confirme le paiement du solde (75%) après la PA signée."""
    result = await db.execute(
        select(Bid).where(Bid.id == payload.bid_id, Bid.deal_id == deal_id, Bid.status == BidStatus.winner)
    )
    bid = result.scalar_one_or_none()
    if not bid:
        raise HTTPException(status_code=404, detail="Bid gagnant introuvable")

    bid.payment_status = PaymentStatus.paid

    deal_result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = deal_result.scalar_one()

    acheteur_result = await db.execute(select(User).where(User.id == bid.acheteur_id))
    acheteur = acheteur_result.scalar_one()
    courtier_result = await db.execute(select(User).where(User.id == deal.courtier_id))
    courtier = courtier_result.scalar_one()

    await email_service.send_pa_signee(db, acheteur, courtier, deal_id)
    await db.flush()
    return {"status": "paid", "message": "Deal archivé avec succès"}


# ── Stripe : paiements ────────────────────────────────────────────────────────

@router.get("/payments", response_model=list[PaymentAdminView])
async def list_payments(
    deal_id: uuid.UUID | None = None,
    state: PaymentState | None = None,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(Payment)
    if deal_id:
        query = query.where(Payment.deal_id == deal_id)
    if state:
        query = query.where(Payment.state == state)
    res = await db.execute(query.order_by(Payment.created_at.desc()))
    payments = res.scalars().all()

    enriched = []
    for p in payments:
        u_res = await db.execute(select(User).where(User.id == p.acheteur_id))
        u = u_res.scalar_one()
        d_res = await db.execute(select(Deal).where(Deal.id == p.deal_id))
        d = d_res.scalar_one()
        enriched.append({
            **{c.name: getattr(p, c.name) for c in p.__table__.columns},
            "acheteur_name": u.full_name,
            "deal_city": d.city,
        })
    return enriched


async def _load_winner(deal_id: uuid.UUID, db: AsyncSession) -> tuple[Deal, Bid, User]:
    deal_res = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = deal_res.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal introuvable")

    bid_res = await db.execute(
        select(Bid).where(Bid.deal_id == deal_id, Bid.status == BidStatus.winner)
    )
    bid = bid_res.scalar_one_or_none()
    if not bid:
        raise HTTPException(status_code=400, detail="Aucun bid gagnant pour ce deal")

    acheteur_res = await db.execute(select(User).where(User.id == bid.acheteur_id))
    acheteur = acheteur_res.scalar_one()
    return deal, bid, acheteur


@router.post("/deals/{deal_id}/charge-deposit", response_model=PaymentView)
async def admin_charge_deposit(
    deal_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    deal, bid, acheteur = await _load_winner(deal_id, db)
    payment = await payment_service.charge_deposit(deal, bid, acheteur, db)
    if payment.state == PaymentState.succeeded:
        bid.payment_status = PaymentStatus.deposit_confirmed
        if not deal.due_diligence_deadline:
            deal.due_diligence_deadline = datetime.now(timezone.utc) + timedelta(
                hours=settings.due_diligence_hours,
            )
        if deal.status == DealStatus.bid:
            deal.status = DealStatus.intro
        await db.flush()
    return payment


@router.post("/deals/{deal_id}/charge-balance", response_model=PaymentView)
async def admin_charge_balance(
    deal_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    deal, bid, acheteur = await _load_winner(deal_id, db)
    payment = await payment_service.charge_balance(deal, bid, acheteur, db)
    if payment.state == PaymentState.succeeded:
        bid.payment_status = PaymentStatus.paid
        await db.flush()
    return payment


@router.post("/deals/{deal_id}/fallback-next-bidder")
async def admin_fallback(
    deal_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Force le passage au 2e offrant (cas désistement ou échec persistant)."""
    deal_res = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = deal_res.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal introuvable")
    new_winner = await payment_service.fallback_to_next_bidder(deal, db)
    if not new_winner:
        return {"status": "no_more_bidders"}
    return {"status": "rolled_over", "new_winner_bid_id": str(new_winner.id)}


# ── Dashboard metrics ────────────────────────────────────────────────────────

def _start_of_month_utc() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


@router.get("/dashboard/metrics", response_model=AdminMetrics)
async def dashboard_metrics(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)

    # ── Active auctions
    res = await db.execute(
        select(Deal).where(
            Deal.status == DealStatus.bid,
            Deal.bid_close_at.isnot(None),
            Deal.bid_close_at > now,
        ).order_by(Deal.bid_close_at.asc())
    )
    active_deals = list(res.scalars())
    active_auctions: list[ActiveAuctionView] = []
    closing_soon = 0
    for d in active_deals:
        state = await compute_auction_state(d, db)
        is_closing_soon = bool(d.bid_close_at and (d.bid_close_at - now) <= timedelta(hours=2))
        if is_closing_soon:
            closing_soon += 1
        active_auctions.append(ActiveAuctionView(
            deal_id=d.id, city=d.city, bid_close_at=d.bid_close_at,
            bidders_count=state["bidders_count"],
            displayed_price=state["displayed_price"],
            closing_soon=is_closing_soon,
        ))

    # ── Revenues (en cents) — paiements succeeded
    month_start = _start_of_month_utc()
    rev_month_res = await db.execute(
        select(func.coalesce(func.sum(Payment.amount_cents), 0))
        .where(Payment.state == PaymentState.succeeded, Payment.succeeded_at >= month_start)
    )
    revenue_this_month = int(rev_month_res.scalar() or 0)

    rev_total_res = await db.execute(
        select(func.coalesce(func.sum(Payment.amount_cents), 0))
        .where(Payment.state == PaymentState.succeeded)
    )
    revenue_total = int(rev_total_res.scalar() or 0)

    # ── Pending balance : deals où deposit succeeded mais aucun balance succeeded
    pending_balance_cents = 0
    intro_res = await db.execute(
        select(Deal, Bid)
        .join(Bid, and_(Bid.deal_id == Deal.id, Bid.status == BidStatus.winner))
        .where(Deal.status == DealStatus.intro)
    )
    for d, bid in intro_res.all():
        # Vérifier qu'il y a un deposit succeeded
        dep_res = await db.execute(
            select(Payment).where(
                Payment.deal_id == d.id, Payment.bid_id == bid.id,
                Payment.type == PaymentType.deposit,
                Payment.state == PaymentState.succeeded,
            )
        )
        if not dep_res.scalar_one_or_none():
            continue
        # Et que le balance n'est pas succeeded
        bal_res = await db.execute(
            select(Payment).where(
                Payment.deal_id == d.id, Payment.bid_id == bid.id,
                Payment.type == PaymentType.balance,
                Payment.state == PaymentState.succeeded,
            )
        )
        if bal_res.scalar_one_or_none():
            continue
        fees = compute_fees(bid.amount)
        pending_balance_cents += fees.balance_cents

    # ── DD window : deals avec deadline future et pas confirmée
    dd_res = await db.execute(
        select(Deal, Bid, User)
        .join(Bid, and_(Bid.deal_id == Deal.id, Bid.status == BidStatus.winner))
        .join(User, User.id == Bid.acheteur_id)
        .where(
            Deal.status == DealStatus.intro,
            Deal.due_diligence_deadline.isnot(None),
            Deal.due_diligence_deadline > now,
            Deal.due_diligence_completed_at.is_(None),
        )
    )
    dd_window: list[DDExpiringView] = []
    dd_soon = 0
    for d, _bid, acheteur in dd_res.all():
        hours = (d.due_diligence_deadline - now).total_seconds() / 3600
        if hours < 24:
            dd_soon += 1
        dd_window.append(DDExpiringView(
            deal_id=d.id, city=d.city,
            acheteur_name=acheteur.full_name,
            due_diligence_deadline=d.due_diligence_deadline,
            hours_remaining=round(hours, 2),
        ))

    return AdminMetrics(
        active_auctions=active_auctions,
        auctions_closing_soon=closing_soon,
        revenue_this_month_cents=revenue_this_month,
        revenue_total_cents=revenue_total,
        pending_balance_cents=pending_balance_cents,
        due_diligence_window=dd_window,
        dd_expiring_soon=dd_soon,
    )


# ── Extend timer ─────────────────────────────────────────────────────────────

@router.post("/deals/{deal_id}/extend-bid-close")
async def extend_bid_close(
    deal_id: uuid.UUID,
    payload: ExtendBidCloseRequest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Modifie manuellement la date de fermeture d'une enchère active et replanifie le job."""
    res = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = res.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal introuvable")
    if deal.status != DealStatus.bid:
        raise HTTPException(status_code=400, detail="Seules les enchères actives peuvent être modifiées")

    new_close = payload.bid_close_at
    if new_close.tzinfo is None:
        new_close = new_close.replace(tzinfo=timezone.utc)
    if new_close <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="La nouvelle date doit être dans le futur")

    deal.bid_close_at = new_close
    await db.flush()
    schedule_auction_close(deal_id, new_close, AsyncSessionLocal)
    return {"bid_close_at": new_close.isoformat()}


# ── Users tabs ───────────────────────────────────────────────────────────────

async def _has_active_sanction(user_id: uuid.UUID, db: AsyncSession) -> bool:
    res = await db.execute(
        select(func.count(UserSanction.id)).where(
            UserSanction.user_id == user_id, UserSanction.lifted_at.is_(None),
        )
    )
    return bool(res.scalar() or 0)


@router.get("/users/acheteurs", response_model=list[AcheteurAdminRow])
async def list_acheteurs(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(User).where(User.role == UserRole.acheteur).order_by(User.created_at.desc())
    )
    users = list(res.scalars())
    out = []
    for u in users:
        won_res = await db.execute(
            select(func.count(Bid.id)).where(
                Bid.acheteur_id == u.id, Bid.status == BidStatus.winner,
            )
        )
        rate_res = await db.execute(
            select(
                func.avg(DealReview.rating).label("avg"),
                func.count(DealReview.id).label("cnt"),
            ).where(DealReview.ratee_id == u.id)
        )
        r = rate_res.first()
        out.append(AcheteurAdminRow(
            id=u.id, full_name=u.full_name, email=u.email, phone=u.phone,
            is_active=u.is_active, is_qualified=u.is_qualified,
            has_card=bool(u.stripe_payment_method_id),
            won_deals=int(won_res.scalar() or 0),
            average_rating=round(float(r.avg), 2) if r and r.avg is not None else None,
            review_count=int(r.cnt or 0) if r else 0,
            has_active_sanction=await _has_active_sanction(u.id, db),
            created_at=u.created_at,
        ))
    return out


@router.get("/users/courtiers", response_model=list[CourtierAdminRow])
async def list_courtiers(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(User).where(User.role == UserRole.courtier).order_by(User.created_at.desc())
    )
    users = list(res.scalars())
    out = []
    for u in users:
        sub_res = await db.execute(
            select(func.count(Deal.id)).where(Deal.courtier_id == u.id)
        )
        comp_res = await db.execute(
            select(func.count(Deal.id)).where(
                Deal.courtier_id == u.id, Deal.status == DealStatus.pa_signed,
            )
        )
        rate_res = await db.execute(
            select(
                func.avg(DealReview.rating).label("avg"),
                func.count(DealReview.id).label("cnt"),
            ).where(DealReview.ratee_id == u.id)
        )
        r = rate_res.first()
        out.append(CourtierAdminRow(
            id=u.id, full_name=u.full_name, email=u.email, phone=u.phone,
            is_active=u.is_active,
            agency_name=u.agency_name, oaciq_number=u.oaciq_number,
            submitted_deals=int(sub_res.scalar() or 0),
            completed_deals=int(comp_res.scalar() or 0),
            convention_signed_at=u.convention_signed_at,
            average_rating=round(float(r.avg), 2) if r and r.avg is not None else None,
            review_count=int(r.cnt or 0) if r else 0,
            has_active_sanction=await _has_active_sanction(u.id, db),
            created_at=u.created_at,
        ))
    return out


@router.get("/users/pending", response_model=list[PendingApprovalRow])
async def list_pending(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Acheteurs pas encore qualifiés (la plus fréquente file d'attente)."""
    res = await db.execute(
        select(User).where(
            User.role == UserRole.acheteur,
            User.is_qualified.is_(False),
            User.is_active.is_(True),
        ).order_by(User.created_at.desc())
    )
    users = list(res.scalars())
    return [
        PendingApprovalRow(
            id=u.id, full_name=u.full_name, email=u.email,
            role=u.role.value if hasattr(u.role, "value") else str(u.role),
            phone=u.phone, created_at=u.created_at,
        ) for u in users
    ]


@router.post("/users/{user_id}/reject")
async def reject_pending(
    user_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Refus à l'inscription : désactive le compte sans le supprimer (audit)."""
    res = await db.execute(select(User).where(User.id == user_id))
    u = res.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    u.is_active = False
    await db.flush()
    return {"status": "rejected"}


# ── Sanctions ────────────────────────────────────────────────────────────────

async def _enrich_sanction(s: UserSanction, db: AsyncSession) -> dict:
    user_res = await db.execute(select(User).where(User.id == s.user_id))
    u = user_res.scalar_one_or_none()
    return {
        **{c.name: getattr(s, c.name) for c in s.__table__.columns},
        "user_email": u.email if u else None,
        "user_full_name": u.full_name if u else None,
    }


@router.get("/sanctions", response_model=list[SanctionView])
async def list_sanctions(
    active_only: bool = True,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    q = select(UserSanction).order_by(UserSanction.created_at.desc())
    if active_only:
        q = q.where(UserSanction.lifted_at.is_(None))
    sanctions = (await db.execute(q)).scalars().all()
    return [await _enrich_sanction(s, db) for s in sanctions]


@router.post("/sanctions", response_model=SanctionView, status_code=201)
async def create_sanction(
    payload: SanctionCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user_res = await db.execute(select(User).where(User.id == payload.user_id))
    u = user_res.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    sanction = UserSanction(
        user_id=payload.user_id,
        reason=payload.reason.strip(),
        severity=payload.severity,
        related_deal_id=payload.related_deal_id,
        deposit_kept_cad=payload.deposit_kept_cad,
        created_by=current_user.id,
    )
    db.add(sanction)
    # Suspension/expulsion → désactive le compte
    if payload.severity in ("suspension", "expulsion"):
        u.is_active = False
    await db.flush()
    return await _enrich_sanction(sanction, db)


@router.post("/sanctions/{sanction_id}/lift", response_model=SanctionView)
async def lift_sanction(
    sanction_id: uuid.UUID,
    payload: SanctionLift,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(UserSanction).where(UserSanction.id == sanction_id))
    s = res.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Sanction introuvable")
    if s.lifted_at:
        raise HTTPException(status_code=400, detail="Sanction déjà levée")

    s.lifted_at = datetime.now(timezone.utc)
    s.lifted_by = current_user.id
    s.lifted_reason = payload.lifted_reason.strip()

    # Si plus aucune sanction active sur le user → réactiver le compte
    other_active_res = await db.execute(
        select(func.count(UserSanction.id)).where(
            UserSanction.user_id == s.user_id,
            UserSanction.id != s.id,
            UserSanction.lifted_at.is_(None),
        )
    )
    if int(other_active_res.scalar() or 0) == 0:
        user_res = await db.execute(select(User).where(User.id == s.user_id))
        u = user_res.scalar_one_or_none()
        if u:
            u.is_active = True

    await db.flush()
    return await _enrich_sanction(s, db)


# ── Revenus admin (sprint final item 6) ──────────────────────────────────────

@router.get("/revenues")
async def admin_revenues(
    months: int = 12,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Vue revenus pour le dashboard admin :
      - cards : total cumulé / mois courant / solde en attente / deals complétés ce mois
      - monthly_aggregates : sum par mois sur les N derniers mois
      - transactions : par deal (acheteur, deposit, balance, total, statut)
    """
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # ── Agrégats globaux
    total_res = await db.execute(
        select(func.coalesce(func.sum(Payment.amount_cents), 0))
        .where(Payment.state == PaymentState.succeeded)
    )
    total_cents = int(total_res.scalar() or 0)

    month_res = await db.execute(
        select(func.coalesce(func.sum(Payment.amount_cents), 0))
        .where(Payment.state == PaymentState.succeeded, Payment.succeeded_at >= month_start)
    )
    month_cents = int(month_res.scalar() or 0)

    # Pending balance : copy de la logique dashboard_metrics
    pending = 0
    intro_res = await db.execute(
        select(Deal, Bid)
        .join(Bid, and_(Bid.deal_id == Deal.id, Bid.status == BidStatus.winner))
        .where(Deal.status == DealStatus.intro)
    )
    for d, bid in intro_res.all():
        dep_ok = await db.execute(
            select(Payment).where(
                Payment.deal_id == d.id, Payment.bid_id == bid.id,
                Payment.type == PaymentType.deposit,
                Payment.state == PaymentState.succeeded,
            )
        )
        if not dep_ok.scalar_one_or_none():
            continue
        bal_ok = await db.execute(
            select(Payment).where(
                Payment.deal_id == d.id, Payment.bid_id == bid.id,
                Payment.type == PaymentType.balance,
                Payment.state == PaymentState.succeeded,
            )
        )
        if bal_ok.scalar_one_or_none():
            continue
        from app.services.fee import compute_fees
        pending += compute_fees(bid.amount).balance_cents

    completed_count_res = await db.execute(
        select(func.count(Deal.id)).where(
            Deal.status == DealStatus.pa_signed,
            Deal.updated_at >= month_start,
        )
    )
    completed_this_month = int(completed_count_res.scalar() or 0)

    # ── Agrégats mensuels (pour graphique barres)
    monthly_aggregates: list[dict] = []
    for i in range(months - 1, -1, -1):
        # mois cible : i mois en arrière depuis le mois courant
        year = month_start.year
        m = month_start.month - i
        while m <= 0:
            m += 12
            year -= 1
        start = month_start.replace(year=year, month=m)
        # mois suivant
        end_m = m + 1
        end_y = year
        if end_m > 12:
            end_m = 1
            end_y += 1
        end = month_start.replace(year=end_y, month=end_m)

        sum_res = await db.execute(
            select(func.coalesce(func.sum(Payment.amount_cents), 0))
            .where(
                Payment.state == PaymentState.succeeded,
                Payment.succeeded_at >= start,
                Payment.succeeded_at < end,
            )
        )
        monthly_aggregates.append({
            "ym": start.strftime("%Y-%m"),
            "label": start.strftime("%b %Y"),
            "revenue_cents": int(sum_res.scalar() or 0),
        })

    # ── Transactions enrichies par deal
    deals_with_payments_res = await db.execute(
        select(Deal.id).join(Payment, Payment.deal_id == Deal.id)
        .where(Payment.state == PaymentState.succeeded)
        .group_by(Deal.id)
    )
    deal_ids = [r[0] for r in deals_with_payments_res.all()]

    transactions: list[dict] = []
    for did in deal_ids:
        d_res = await db.execute(select(Deal).where(Deal.id == did))
        d = d_res.scalar_one_or_none()
        if not d:
            continue
        # Bid gagnant
        b_res = await db.execute(
            select(Bid).where(Bid.deal_id == did, Bid.status == BidStatus.winner)
        )
        bid = b_res.scalar_one_or_none()
        acheteur_name = None
        if bid:
            u_res = await db.execute(select(User).where(User.id == bid.acheteur_id))
            u = u_res.scalar_one_or_none()
            if u:
                acheteur_name = u.full_name

        # Sum deposit / balance
        dep_res = await db.execute(
            select(func.coalesce(func.sum(Payment.amount_cents), 0), func.max(Payment.succeeded_at))
            .where(Payment.deal_id == did, Payment.type == PaymentType.deposit, Payment.state == PaymentState.succeeded)
        )
        dep_row = dep_res.first()
        dep_cents = int(dep_row[0] or 0)
        dep_at = dep_row[1]

        bal_res = await db.execute(
            select(func.coalesce(func.sum(Payment.amount_cents), 0), func.max(Payment.succeeded_at))
            .where(Payment.deal_id == did, Payment.type == PaymentType.balance, Payment.state == PaymentState.succeeded)
        )
        bal_row = bal_res.first()
        bal_cents = int(bal_row[0] or 0)
        bal_at = bal_row[1]

        last_at = max(filter(None, [dep_at, bal_at]), default=None)
        if dep_cents > 0 and bal_cents > 0:
            tx_status = "complete"
        elif dep_cents > 0:
            tx_status = "deposit_only"
        else:
            tx_status = "pending"

        transactions.append({
            "deal_id": str(did),
            "deal_city": d.city,
            "acheteur_name": acheteur_name,
            "deposit_cents": dep_cents,
            "balance_cents": bal_cents,
            "total_cents": dep_cents + bal_cents,
            "status": tx_status,
            "last_payment_at": last_at.isoformat() if last_at else None,
            "deal_status": d.status.value if hasattr(d.status, "value") else str(d.status),
        })

    transactions.sort(key=lambda t: t["last_payment_at"] or "", reverse=True)

    return {
        "total_revenue_cents": total_cents,
        "this_month_revenue_cents": month_cents,
        "pending_balance_cents": pending,
        "completed_deals_this_month": completed_this_month,
        "monthly_aggregates": monthly_aggregates,
        "transactions": transactions,
    }


@router.get("/revenues/csv")
async def admin_revenues_csv(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Export CSV de toutes les transactions revenus."""
    from fastapi.responses import StreamingResponse
    import csv
    import io

    data = await admin_revenues(months=120, current_user=current_user, db=db)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([
        "date_dernier_paiement", "deal_id", "ville", "acheteur",
        "depot_cad", "solde_cad", "total_cad", "statut", "deal_statut",
    ])
    for t in data["transactions"]:
        writer.writerow([
            t["last_payment_at"] or "",
            t["deal_id"],
            t["deal_city"] or "",
            t["acheteur_name"] or "",
            t["deposit_cents"] / 100,
            t["balance_cents"] / 100,
            t["total_cents"] / 100,
            t["status"],
            t["deal_status"],
        ])
    buffer.seek(0)
    headers = {"Content-Disposition": "attachment; filename=logeo-revenus.csv"}
    return StreamingResponse(iter([buffer.getvalue()]), media_type="text/csv", headers=headers)
