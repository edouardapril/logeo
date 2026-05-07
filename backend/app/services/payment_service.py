"""
Orchestration des paiements Stripe pour Logeo.

Toutes les transitions du flow passent par ici (sauf le SetupIntent
côté carte, qui est dans stripe_service). Crée les enregistrements
Payment en DB, débite via Stripe, gère le fallback au 2e offrant.
"""
import uuid
from datetime import datetime, timezone, timedelta
import stripe
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.deal import Deal, DealStatus
from app.models.bid import Bid, BidStatus, PaymentStatus as BidPaymentStatus
from app.models.user import User
from app.models.payment import Payment, PaymentType, PaymentState
from app.services import stripe_service
from app.services.fee import compute_fees

settings = get_settings()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _get_winner_bid(deal_id: uuid.UUID, db: AsyncSession) -> Bid | None:
    res = await db.execute(
        select(Bid).where(Bid.deal_id == deal_id, Bid.status == BidStatus.winner)
    )
    return res.scalar_one_or_none()


async def _get_existing_payment(
    deal_id: uuid.UUID,
    bid_id: uuid.UUID,
    type_: PaymentType,
    db: AsyncSession,
) -> Payment | None:
    res = await db.execute(
        select(Payment).where(
            Payment.deal_id == deal_id,
            Payment.bid_id == bid_id,
            Payment.type == type_,
        )
    )
    return res.scalar_one_or_none()


async def _ensure_customer(user: User, db: AsyncSession) -> str:
    customer_id = stripe_service.get_or_create_customer(
        user_id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        existing_customer_id=user.stripe_customer_id,
    )
    if user.stripe_customer_id != customer_id:
        user.stripe_customer_id = customer_id
        await db.flush()
    return customer_id


async def create_setup_intent_for_user(user: User, db: AsyncSession) -> dict:
    customer_id = await _ensure_customer(user, db)
    return stripe_service.create_setup_intent(customer_id)


async def save_payment_method(
    user: User, payment_method_id: str, db: AsyncSession
) -> dict:
    customer_id = await _ensure_customer(user, db)

    # Idempotence : si on reçoit deux fois le même PM (double-clic, retry React Query)
    # on ne ré-attache pas et on renvoie l'état déjà en DB.
    if user.stripe_payment_method_id == payment_method_id and user.payment_method_last4:
        return {
            "payment_method_id": user.stripe_payment_method_id,
            "brand": user.payment_method_brand,
            "last4": user.payment_method_last4,
            "exp_month": user.payment_method_exp_month,
            "exp_year": user.payment_method_exp_year,
        }

    # Nettoyer un éventuel ancien moyen de paiement
    if user.stripe_payment_method_id and user.stripe_payment_method_id != payment_method_id:
        stripe_service.detach_payment_method(user.stripe_payment_method_id)

    info = stripe_service.attach_payment_method(customer_id, payment_method_id)
    user.stripe_payment_method_id = info["payment_method_id"]
    user.payment_method_brand = info["brand"]
    user.payment_method_last4 = info["last4"]
    user.payment_method_exp_month = info["exp_month"]
    user.payment_method_exp_year = info["exp_year"]
    await db.flush()
    return info


async def recover_payment_method_from_stripe(user: User, db: AsyncSession) -> dict | None:
    """
    Réconcilie l'état DB avec Stripe quand on détecte une carte côté Stripe
    mais rien en DB (ex: SetupIntent succeeded mais notre /confirm a raté).

    Retourne le PM info synchronisé, ou None si Stripe n'a aucune carte pour ce user.
    """
    if not user.stripe_customer_id:
        return None
    cards = stripe_service.list_customer_cards(user.stripe_customer_id)
    if not cards:
        return None

    # Préfère le default_payment_method s'il est défini, sinon la plus récente
    default_pm_id = stripe_service.get_default_payment_method_id(user.stripe_customer_id)
    chosen = next((c for c in cards if c["payment_method_id"] == default_pm_id), cards[0])

    # Détache les autres cartes — on garde une carte par acheteur (politique actuelle)
    for c in cards:
        if c["payment_method_id"] != chosen["payment_method_id"]:
            stripe_service.detach_payment_method(c["payment_method_id"])

    # S'assure que la carte choisie est bien le default_payment_method
    if default_pm_id != chosen["payment_method_id"]:
        try:
            import stripe as _stripe
            _stripe.Customer.modify(
                user.stripe_customer_id,
                invoice_settings={"default_payment_method": chosen["payment_method_id"]},
            )
        except Exception:
            pass

    user.stripe_payment_method_id = chosen["payment_method_id"]
    user.payment_method_brand = chosen["brand"]
    user.payment_method_last4 = chosen["last4"]
    user.payment_method_exp_month = chosen["exp_month"]
    user.payment_method_exp_year = chosen["exp_year"]
    await db.flush()
    return chosen


async def remove_payment_method(user: User, db: AsyncSession) -> None:
    if user.stripe_payment_method_id:
        stripe_service.detach_payment_method(user.stripe_payment_method_id)
    user.stripe_payment_method_id = None
    user.payment_method_brand = None
    user.payment_method_last4 = None
    user.payment_method_exp_month = None
    user.payment_method_exp_year = None
    await db.flush()


def has_payment_method(user: User) -> bool:
    return bool(user.stripe_customer_id and user.stripe_payment_method_id)


# ── Débits ────────────────────────────────────────────────────────────────────

async def _charge(
    *,
    deal: Deal,
    bid: Bid,
    acheteur: User,
    type_: PaymentType,
    amount_cents: int,
    db: AsyncSession,
) -> Payment:
    """
    Crée un Payment, tente le débit Stripe, met à jour l'état.
    Retourne le Payment (succeeded ou failed).
    """
    if not has_payment_method(acheteur):
        # Crée quand même un Payment failed pour traçabilité
        payment = Payment(
            deal_id=deal.id,
            bid_id=bid.id,
            acheteur_id=acheteur.id,
            type=type_,
            amount_cents=amount_cents,
            state=PaymentState.failed,
            failure_code="no_payment_method",
            failure_message="Aucune carte enregistrée",
            failed_at=_utcnow(),
        )
        db.add(payment)
        await db.flush()
        return payment

    payment = Payment(
        deal_id=deal.id,
        bid_id=bid.id,
        acheteur_id=acheteur.id,
        type=type_,
        amount_cents=amount_cents,
        state=PaymentState.pending,
    )
    db.add(payment)
    await db.flush()

    idempotency_key = f"logeo-{type_.value}-{payment.id}"
    metadata = {
        "deal_id": str(deal.id),
        "bid_id": str(bid.id),
        "acheteur_id": str(acheteur.id),
        "type": type_.value,
        "logeo_payment_id": str(payment.id),
    }

    try:
        result = stripe_service.charge_off_session(
            customer_id=acheteur.stripe_customer_id,
            payment_method_id=acheteur.stripe_payment_method_id,
            amount_cents=amount_cents,
            currency="cad",
            idempotency_key=idempotency_key,
            metadata=metadata,
        )
        payment.stripe_payment_intent_id = result["id"]
        if result["status"] == "succeeded":
            payment.state = PaymentState.succeeded
            payment.succeeded_at = _utcnow()
        elif result["status"] in ("requires_action", "requires_confirmation"):
            payment.state = PaymentState.requires_action
        else:
            payment.state = PaymentState.failed
            payment.failed_at = _utcnow()
            err = result.get("last_payment_error") or {}
            payment.failure_code = err.get("code")
            payment.failure_message = err.get("message")
    except stripe.CardError as e:
        payment.state = PaymentState.failed
        payment.failed_at = _utcnow()
        payment.failure_code = e.code or "card_error"
        payment.failure_message = e.user_message or str(e)
        intent = (e.error or {}).get("payment_intent") if hasattr(e, "error") else None
        if intent:
            payment.stripe_payment_intent_id = intent.get("id")
    except stripe.StripeError as e:
        payment.state = PaymentState.failed
        payment.failed_at = _utcnow()
        payment.failure_code = "stripe_error"
        payment.failure_message = str(e)

    await db.flush()
    return payment


async def charge_deposit(
    deal: Deal, bid: Bid, acheteur: User, db: AsyncSession
) -> Payment:
    fees = compute_fees(bid.amount)
    return await _charge(
        deal=deal, bid=bid, acheteur=acheteur,
        type_=PaymentType.deposit,
        amount_cents=fees.deposit_cents,
        db=db,
    )


async def charge_balance(
    deal: Deal, bid: Bid, acheteur: User, db: AsyncSession
) -> Payment:
    fees = compute_fees(bid.amount)
    return await _charge(
        deal=deal, bid=bid, acheteur=acheteur,
        type_=PaymentType.balance,
        amount_cents=fees.balance_cents,
        db=db,
    )


# ── Workflow auction-close ────────────────────────────────────────────────────

async def attempt_winner_deposit(
    deal: Deal, db: AsyncSession
) -> tuple[Payment | None, Bid | None]:
    """
    Tente le dépôt du gagnant courant. Si échec → fallback au prochain bid.
    Retourne (payment, bid) du tentative actuelle (succès ou échec final).
    """
    winner_bid = await _get_winner_bid(deal.id, db)
    if not winner_bid:
        return (None, None)

    acheteur_res = await db.execute(select(User).where(User.id == winner_bid.acheteur_id))
    acheteur = acheteur_res.scalar_one()

    payment = await charge_deposit(deal, winner_bid, acheteur, db)

    if payment.state == PaymentState.succeeded:
        winner_bid.payment_status = BidPaymentStatus.deposit_confirmed
        # Délai due diligence : 5 jours ouvrables (≈ 5×24h) — sprint v13
        deal.due_diligence_deadline = _utcnow() + timedelta(days=5)
        deal.status = DealStatus.intro
        await db.flush()

        # Sprint v13 item 4 — déclenche l'email d'introduction tripartite
        try:
            from app.services import email as email_service
            courtier_res = await db.execute(select(User).where(User.id == deal.courtier_id))
            courtier = courtier_res.scalar_one_or_none()
            if courtier:
                await email_service.send_depot_confirme(
                    db, gagnant=acheteur, courtier=courtier,
                    deal_id=deal.id, amount=winner_bid.amount,
                )
        except Exception:
            pass  # ne bloque pas le flow si l'email échoue
    else:
        winner_bid.payment_status = BidPaymentStatus.failed
        deal.deposit_retry_until = _utcnow() + timedelta(hours=settings.deposit_retry_hours)
        await db.flush()

    return (payment, winner_bid)


async def fallback_to_next_bidder(deal: Deal, db: AsyncSession) -> Bid | None:
    """
    Marque le gagnant actuel comme loser, choisit le bid actif suivant
    le plus élevé comme nouveau winner, et retente le dépôt.
    """
    current = await _get_winner_bid(deal.id, db)
    if current:
        current.status = BidStatus.loser

    res = await db.execute(
        select(Bid)
        .where(
            Bid.deal_id == deal.id,
            Bid.status == BidStatus.active,
        )
        .order_by(Bid.amount.desc())
    )
    next_bid = res.scalars().first()
    if not next_bid:
        deal.deposit_retry_until = None
        await db.flush()
        return None

    next_bid.status = BidStatus.winner
    next_bid.payment_status = BidPaymentStatus.deposit_sent
    deal.deposit_retry_until = None
    await db.flush()

    await attempt_winner_deposit(deal, db)
    return next_bid
