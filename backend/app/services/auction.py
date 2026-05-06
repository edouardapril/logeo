import uuid
import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.models.deal import Deal, DealStatus
from app.models.bid import Bid, BidStatus, PaymentStatus
from app.models.user import User
from app.models.payment import Payment, PaymentType, PaymentState
from app.services import email as email_service
from app.services import payment_service
from app.services import realtime as realtime_svc
from app.config import get_settings

settings = get_settings()
log = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


def compute_logeo_fee(amount: int, fee_pct: float, fee_minimum: int) -> int:
    calculated = int(amount * fee_pct / 100)
    return max(calculated, fee_minimum)


# ── Proxy bid logic ──────────────────────────────────────────────────────────

async def _max_bids_per_buyer(deal_id: uuid.UUID, db: AsyncSession) -> list[tuple[uuid.UUID, int]]:
    """Retourne [(acheteur_id, max_amount), ...] trié par montant desc."""
    res = await db.execute(
        select(Bid.acheteur_id, func.max(Bid.amount).label("m"))
        .where(Bid.deal_id == deal_id, Bid.status == BidStatus.active)
        .group_by(Bid.acheteur_id)
        .order_by(func.max(Bid.amount).desc())
    )
    return [(row.acheteur_id, row.m) for row in res.all()]


async def compute_auction_state(deal: Deal, db: AsyncSession) -> dict:
    """
    Calcule l'état courant de l'enchère :
      - winner_id (None si aucun bid)
      - winner_max (montant max du gagnant)
      - displayed_price : prix vu par tous (2e + incrément, ou floor si <2 bidders)
      - bidders_count
    """
    floor = deal.floor_price or 0
    increment = deal.min_bid_increment or settings.bid_min_increment

    rows = await _max_bids_per_buyer(deal.id, db)
    if not rows:
        return {
            "winner_id": None, "winner_max": None,
            "displayed_price": floor or None,
            "bidders_count": 0, "increment": increment, "floor": floor or None,
        }

    winner_id, winner_max = rows[0]
    if len(rows) >= 2:
        second_max = rows[1][1]
        displayed = min(second_max + increment, winner_max)
    else:
        displayed = max(floor, winner_max) if floor else winner_max

    return {
        "winner_id": winner_id, "winner_max": winner_max,
        "displayed_price": displayed,
        "bidders_count": len(rows),
        "increment": increment, "floor": floor or None,
    }


def validate_new_bid_amount(amount: int, state: dict, current_user_id: uuid.UUID) -> str | None:
    """Retourne un message d'erreur si invalide, None sinon."""
    if amount <= 0:
        return "Montant invalide"
    floor = state["floor"]
    increment = state["increment"]
    if floor and amount < floor:
        return f"Le montant doit être ≥ au prix plancher ({floor:,} CAD)".replace(",", " ")

    displayed = state["displayed_price"]
    is_first_bidder = state["bidders_count"] == 0
    is_already_winner = state["winner_id"] == current_user_id

    if is_first_bidder:
        return None  # premier bidder : seul le floor s'applique

    if is_already_winner:
        # Le gagnant courant peut relever sa max ; doit dépasser sa propre max courante
        if amount <= (state["winner_max"] or 0):
            return f"Pour relever votre offre, montant > {state['winner_max']:,} CAD".replace(",", " ")
        return None

    # Challenger : doit dépasser le displayed + increment
    minimum = (displayed or floor or 0) + increment
    if amount < minimum:
        return f"Offre minimum : {minimum:,} CAD (incrément {increment:,} CAD)".replace(",", " ")
    return None


async def maybe_anti_snipe(deal: Deal, db: AsyncSession, db_factory) -> bool:
    """Si on est dans la fenêtre anti-snipe, étend la fermeture ; retourne True si extension."""
    if not deal.bid_close_at:
        return False
    now = datetime.now(timezone.utc)
    window = timedelta(minutes=settings.anti_snipe_window_minutes)
    if deal.bid_close_at - now > window:
        return False
    deal.bid_close_at = now + timedelta(minutes=settings.anti_snipe_extension_minutes)
    await db.flush()
    schedule_auction_close(deal.id, deal.bid_close_at, db_factory)
    return True


async def close_auction(deal_id: uuid.UUID, db: AsyncSession):
    result = await db.execute(
        select(Deal).where(Deal.id == deal_id)
    )
    deal = result.scalar_one_or_none()
    if not deal or deal.status != DealStatus.bid:
        return

    bids_result = await db.execute(
        select(Bid)
        .where(Bid.deal_id == deal_id, Bid.status == BidStatus.active)
        .order_by(Bid.amount.desc())
    )
    bids = bids_result.scalars().all()

    if not bids:
        return

    winner_bid = bids[0]
    losing_bids = bids[1:]

    winner_bid.status = BidStatus.winner
    winner_bid.payment_status = PaymentStatus.deposit_sent

    for bid in losing_bids:
        bid.status = BidStatus.loser

    await db.flush()

    winner_result = await db.execute(select(User).where(User.id == winner_bid.acheteur_id))
    winner = winner_result.scalar_one()

    fee = compute_logeo_fee(
        winner_bid.amount,
        deal.fee_pct or 1.5,
        deal.fee_minimum or 5000,
    )

    await email_service.send_fermeture_gagnant(db, winner, deal_id, winner_bid.amount, fee)

    if losing_bids:
        perdants_result = await db.execute(
            select(User).where(User.id.in_([b.acheteur_id for b in losing_bids]))
        )
        perdants = perdants_result.scalars().all()
        await email_service.send_fermeture_perdants(db, perdants, deal_id)

    # Débit automatique du dépôt 25%
    payment, _ = await payment_service.attempt_winner_deposit(deal, db)
    if payment and payment.state == PaymentState.failed:
        # Programme le fallback automatique vers le 2e offrant après le délai de retry
        if deal.deposit_retry_until:
            schedule_deposit_retry_fallback(deal_id, deal.deposit_retry_until, _DB_FACTORY)
    elif payment and payment.state == PaymentState.succeeded:
        if deal.due_diligence_deadline:
            schedule_due_diligence_fallback(deal_id, deal.due_diligence_deadline, _DB_FACTORY)

    # WebSocket : annonce la fermeture (broadcast public + per-user pour le gagnant)
    try:
        await realtime_svc.publish_auction_closed(
            deal_id,
            winner_user_id=str(winner_bid.acheteur_id) if winner_bid else None,
        )
    except Exception:
        pass


# ── Fallbacks programmés ──────────────────────────────────────────────────────

async def deposit_retry_fallback(deal_id: uuid.UUID, db: AsyncSession):
    """Si après le délai de retry le dépôt n'est toujours pas réussi → 2e offrant."""
    res = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = res.scalar_one_or_none()
    if not deal:
        return

    bid_res = await db.execute(
        select(Bid).where(Bid.deal_id == deal_id, Bid.status == BidStatus.winner)
    )
    bid = bid_res.scalar_one_or_none()
    if not bid:
        return

    pay_res = await db.execute(
        select(Payment)
        .where(
            Payment.deal_id == deal_id,
            Payment.bid_id == bid.id,
            Payment.type == PaymentType.deposit,
        )
        .order_by(Payment.created_at.desc())
    )
    last = pay_res.scalars().first()
    if last and last.state == PaymentState.succeeded:
        return  # déjà OK, rien à faire

    log.info("Deposit retry expired for deal %s, rolling over to next bidder", deal_id)
    await payment_service.fallback_to_next_bidder(deal, db)


async def due_diligence_fallback(deal_id: uuid.UUID, db: AsyncSession):
    """
    Si l'acheteur n'a pas cliqué 'due diligence complète' avant la deadline :
    on conserve le dépôt et on passe au 2e offrant.
    """
    res = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = res.scalar_one_or_none()
    if not deal:
        return
    if deal.due_diligence_completed_at:
        return  # cliqué à temps

    log.info("Due diligence expired for deal %s, keeping deposit and rolling over", deal_id)
    await payment_service.fallback_to_next_bidder(deal, db)


# ── Scheduler ────────────────────────────────────────────────────────────────

_DB_FACTORY = None  # injecté via schedule_auction_close pour rester compat


def schedule_auction_close(deal_id: uuid.UUID, close_at: datetime, db_factory):
    global _DB_FACTORY
    _DB_FACTORY = db_factory
    job_id = f"close_auction_{deal_id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)

    async def _run():
        async with db_factory() as db:
            await close_auction(deal_id, db)
            await db.commit()

    scheduler.add_job(
        _run,
        trigger="date",
        run_date=close_at,
        id=job_id,
        replace_existing=True,
    )


def schedule_deposit_retry_fallback(deal_id: uuid.UUID, run_at: datetime, db_factory):
    if db_factory is None:
        return
    job_id = f"deposit_retry_{deal_id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)

    async def _run():
        async with db_factory() as db:
            await deposit_retry_fallback(deal_id, db)
            await db.commit()

    scheduler.add_job(_run, trigger="date", run_date=run_at, id=job_id, replace_existing=True)


def schedule_due_diligence_fallback(deal_id: uuid.UUID, run_at: datetime, db_factory):
    if db_factory is None:
        return
    job_id = f"dd_fallback_{deal_id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)

    async def _run():
        async with db_factory() as db:
            await due_diligence_fallback(deal_id, db)
            await db.commit()

    scheduler.add_job(_run, trigger="date", run_date=run_at, id=job_id, replace_existing=True)


def start_scheduler():
    if not scheduler.running:
        scheduler.start()


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
