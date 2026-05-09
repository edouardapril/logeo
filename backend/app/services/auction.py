import uuid
import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
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


# ── Proxy bid logic (eBay-style) ──────────────────────────────────────────────
#
# Règle :
#   current_price = min(leader_max, max(floor, second_highest_max) + increment)
#   leader = bidder dont le `max` est le plus élevé
#   tiebreak égalité de max : premier arrivé à ce montant
#
# Chaque user_id : on prend le bid `amount` le plus élevé (= son max courant) ;
# les anciens bids du même user restent en historique mais ne pèsent pas.


async def compute_auction_state(deal: Deal, db: AsyncSession) -> dict:
    """État courant — proxy bid eBay-style.

    Retourne un dict riche : clés sémantiques `current_price` / `leader_user_id` /
    `leader_max` plus alias legacy `displayed_price` / `winner_id` / `winner_max`
    pour ne pas casser les appelants existants. La sérialisation par rôle se fait
    via `serialize_auction_state(state, role, current_user_id)`.
    """
    floor = deal.floor_price or 0
    increment = deal.min_bid_increment or settings.bid_min_increment

    res = await db.execute(
        select(Bid)
        .where(Bid.deal_id == deal.id, Bid.status == BidStatus.active)
        .order_by(Bid.created_at.asc())
    )
    bids = list(res.scalars().all())
    bids_count = len(bids)

    # Label anonyme stable : ordre d'apparition du 1er bid de chaque user
    label_per_user: dict[uuid.UUID, str] = {}
    next_idx = 1
    # Max par user + horodatage du 1er bid à ce max (tiebreak)
    per_user: dict[uuid.UUID, dict] = {}
    for b in bids:
        if b.acheteur_id not in label_per_user:
            label_per_user[b.acheteur_id] = f"Acheteur #{next_idx}"
            next_idx += 1
        rec = per_user.get(b.acheteur_id)
        if rec is None or b.amount > rec["max"]:
            per_user[b.acheteur_id] = {"max": b.amount, "earliest_at_max": b.created_at}
        elif b.amount == rec["max"] and b.created_at < rec["earliest_at_max"]:
            rec["earliest_at_max"] = b.created_at

    base_empty = {
        "current_price": floor or None,
        "displayed_price": floor or None,
        "leader_user_id": None,
        "winner_id": None,
        "leader_max": None,
        "winner_max": None,
        "leader_anonymous_label": None,
        "bidders_count": 0,
        "bids_count": 0,
        "increment": increment,
        "floor": floor or None,
        "max_per_user": {},
        "anonymous_label_per_user": {},
    }
    if not per_user:
        return base_empty

    sorted_users = sorted(
        per_user.items(),
        key=lambda kv: (-kv[1]["max"], kv[1]["earliest_at_max"]),
    )
    leader_id, leader_rec = sorted_users[0]
    leader_max = leader_rec["max"]
    second_max = sorted_users[1][1]["max"] if len(sorted_users) >= 2 else 0

    # Spec : prix_affiché = max(floor, second_highest_max) + increment, capped au max du leader
    current_price = max(floor, second_max) + increment
    current_price = min(current_price, leader_max)

    return {
        "current_price": current_price,
        "displayed_price": current_price,
        "leader_user_id": leader_id,
        "winner_id": leader_id,
        "leader_max": leader_max,
        "winner_max": leader_max,
        "leader_anonymous_label": label_per_user[leader_id],
        "bidders_count": len(sorted_users),
        "bids_count": bids_count,
        "increment": increment,
        "floor": floor or None,
        "max_per_user": {uid: rec["max"] for uid, rec in per_user.items()},
        "anonymous_label_per_user": dict(label_per_user),
    }


def serialize_auction_state(
    state: dict,
    role: str,
    current_user_id: uuid.UUID | None = None,
) -> dict:
    """Vue filtrée pour l'API selon le rôle de l'appelant.

    - acheteur : `current_price`, `bidders_count`, `bids_count`, son propre statut
                 (`i_am_leading`, `my_max`) ; jamais les maxs des autres.
    - courtier : `current_price`, `bidders_count`, `bids_count`, label anonyme du
                 leader ; pas d'identité réelle ni de maxs individuels.
    - admin    : tout, y compris `leader_max`, `max_per_user` et l'identité du leader.
    """
    base = {
        "current_price": state["current_price"],
        "bidders_count": state["bidders_count"],
        "bids_count": state["bids_count"],
        "increment": state["increment"],
        "floor": state["floor"],
        "leader_anonymous_label": state["leader_anonymous_label"],
    }
    if role == "admin":
        leader_id = state["leader_user_id"]
        i_am_leading = leader_id is not None and leader_id == current_user_id
        my_max = state["max_per_user"].get(current_user_id) if current_user_id else None
        return {
            **base,
            "leader_user_id": str(leader_id) if leader_id else None,
            "leader_max": state["leader_max"],
            "max_per_user": {str(k): v for k, v in state["max_per_user"].items()},
            "anonymous_label_per_user": {
                str(k): v for k, v in state["anonymous_label_per_user"].items()
            },
            # Admin peut aussi bidder en son nom propre — on expose son statut self-bid
            # pour que le frontend puisse appliquer les mêmes règles client (multiple,
            # > prix courant, > son propre max).
            "i_am_leading": i_am_leading,
            "my_max": my_max,
        }
    if role == "courtier":
        return base

    # acheteur (default)
    leader_id = state["leader_user_id"]
    i_am_leading = leader_id is not None and leader_id == current_user_id
    my_max = state["max_per_user"].get(current_user_id) if current_user_id else None
    return {
        **base,
        "i_am_leading": i_am_leading,
        "my_max": my_max,
        "leader_user_id": str(leader_id) if i_am_leading else None,
    }


def validate_new_bid_amount(amount: int, state: dict, current_user_id: uuid.UUID) -> str | None:
    """Retourne un message d'erreur si invalide, None sinon.

    Règles (proxy bid) :
      a) amount > current_price
      b) amount > max précédent du même user
      c) amount % increment == 0
      d) amount ≥ floor
    """
    if amount <= 0:
        return "Montant invalide"
    increment = state["increment"]
    if increment and amount % increment != 0:
        return f"Le montant doit être un multiple de {increment:,} CAD".replace(",", " ")

    floor = state["floor"]
    if floor and amount < floor:
        return f"Le montant doit être ≥ au prix plancher ({floor:,} CAD)".replace(",", " ")

    current_price = state["current_price"]
    if current_price is not None and amount <= current_price:
        return (
            f"Doit être supérieur au prix courant ({current_price:,} CAD)"
            .replace(",", " ")
        )

    my_max = state["max_per_user"].get(current_user_id)
    if my_max is not None and amount <= my_max:
        return (
            f"Vous avez déjà une offre plus élevée ({my_max:,} CAD)"
            .replace(",", " ")
        )
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
        # Cas B : aucun bid → enchère terminée sans gagnant
        deal.status = DealStatus.auction_ended
        await db.flush()
        # Notifier le courtier
        courtier_res = await db.execute(select(User).where(User.id == deal.courtier_id))
        courtier = courtier_res.scalar_one_or_none()
        if courtier:
            try:
                await email_service.send_auction_ended_no_winner(db, courtier, deal_id, deal.city)
            except Exception:
                pass
        # Broadcast WS public
        try:
            await realtime_svc.publish_auction_closed(deal_id, winner_user_id=None)
        except Exception:
            pass
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
