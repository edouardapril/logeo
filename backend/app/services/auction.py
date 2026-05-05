import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.models.deal import Deal, DealStatus
from app.models.bid import Bid, BidStatus, PaymentStatus
from app.models.user import User
from app.services import email as email_service

scheduler = AsyncIOScheduler()


def compute_logeo_fee(amount: int, fee_pct: float, fee_minimum: int) -> int:
    calculated = int(amount * fee_pct / 100)
    return max(calculated, fee_minimum)


async def close_auction(deal_id: uuid.UUID, db: AsyncSession):
    result = await db.execute(
        select(Deal).where(Deal.id == deal_id)
    )
    deal = result.scalar_one_or_none()
    if not deal or deal.status != DealStatus.bid:
        return

    # Récupérer tous les bids actifs, triés par montant desc
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

    # Marquer le gagnant
    winner_bid.status = BidStatus.winner
    winner_bid.payment_status = PaymentStatus.deposit_sent

    # Marquer les perdants
    for bid in losing_bids:
        bid.status = BidStatus.loser

    await db.flush()

    # Charger le gagnant
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


def schedule_auction_close(deal_id: uuid.UUID, close_at: datetime, db_factory):
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


def start_scheduler():
    if not scheduler.running:
        scheduler.start()


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
