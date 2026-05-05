import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User, UserRole
from app.models.deal import Deal, DealStatus
from app.models.bid import Bid, BidStatus, PaymentStatus
from app.schemas.user import UserAdminView, UserQualifyRequest
from app.schemas.deal import DealAdminView, DealVerdict, DealListItem
from app.schemas.bid import BidAdminView, InteracConfirm
from app.services.auth import require_admin
from app.services import email as email_service
from app.services.auction import schedule_auction_close
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
    return result.scalars().all()


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
