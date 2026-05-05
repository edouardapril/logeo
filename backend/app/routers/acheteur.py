import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.database import get_db
from app.models.user import User
from app.models.deal import Deal, DealStatus
from app.models.bid import Bid, BidStatus
from app.models.nda import NDA
from app.schemas.deal import DealTeaser, DealFull
from app.schemas.bid import BidCreate, BidOwnerView, BidRankItem, BidEngagementSign
from app.schemas.nda import NDASign, NDAConfirmation
from app.services.auth import require_acheteur
from app.services import email as email_service

router = APIRouter(prefix="/acheteur", tags=["acheteur"])


def _require_qualified(user: User):
    if not user.is_qualified:
        raise HTTPException(status_code=403, detail="Compte non qualifié. Contactez l'équipe Logeo.")


async def _get_active_deal(deal_id: uuid.UUID, db: AsyncSession) -> Deal:
    result = await db.execute(
        select(Deal).where(
            Deal.id == deal_id,
            Deal.status.in_([DealStatus.bid, DealStatus.intro, DealStatus.pa_signed])
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
    current_user: User = Depends(require_acheteur),
    db: AsyncSession = Depends(get_db),
):
    _require_qualified(current_user)
    result = await db.execute(
        select(Deal)
        .where(Deal.status.in_([DealStatus.bid]))
        .order_by(Deal.bid_close_at.asc())
    )
    return result.scalars().all()


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
):
    _require_qualified(current_user)
    if not payload.accepted:
        raise HTTPException(status_code=400, detail="Vous devez accepter le NDA")

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
    )
    db.add(nda)
    await db.flush()

    await email_service.send_nda_signee(db, current_user, deal_id)
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
    }


# ── Enchères ──────────────────────────────────────────────────────────────────

@router.post("/deals/{deal_id}/engagement", status_code=200)
async def sign_engagement(
    deal_id: uuid.UUID,
    payload: BidEngagementSign,
    current_user: User = Depends(require_acheteur),
    db: AsyncSession = Depends(get_db),
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
    current_user: User = Depends(require_acheteur),
    db: AsyncSession = Depends(get_db),
):
    _require_qualified(current_user)

    if not await _has_signed_nda(deal_id, current_user.id, db):
        raise HTTPException(status_code=403, detail="NDA requis avant d'enchérir")

    if not current_user.engagement_signed_at:
        raise HTTPException(status_code=403, detail="Engagement de paiement requis avant d'enchérir")

    deal = await _get_active_deal(deal_id, db)
    if deal.status != DealStatus.bid:
        raise HTTPException(status_code=400, detail="Les enchères ne sont pas ouvertes")
    if deal.bid_close_at and deal.bid_close_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="L'enchère est terminée")

    bid = Bid(
        deal_id=deal_id,
        acheteur_id=current_user.id,
        amount=payload.amount,
        engagement_signed=True,
        engagement_signed_at=current_user.engagement_signed_at,
    )
    db.add(bid)
    await db.flush()

    await email_service.send_bid_soumis_admin(db, deal_id, current_user.full_name, payload.amount)
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


@router.get("/deals/{deal_id}/bids/ranking", response_model=list[BidRankItem])
async def bid_ranking(
    deal_id: uuid.UUID,
    current_user: User = Depends(require_acheteur),
    db: AsyncSession = Depends(get_db),
):
    """Classement anonyme : positions seulement, montants masqués."""
    _require_qualified(current_user)
    if not await _has_signed_nda(deal_id, current_user.id, db):
        raise HTTPException(status_code=403, detail="NDA requis pour voir le classement")

    # Meilleur bid par acheteur
    from sqlalchemy import func
    best_bids = await db.execute(
        select(Bid.acheteur_id, func.max(Bid.amount).label("max_amount"))
        .where(Bid.deal_id == deal_id, Bid.status == BidStatus.active)
        .group_by(Bid.acheteur_id)
        .order_by(func.max(Bid.amount).desc())
    )
    rows = best_bids.all()

    return [
        BidRankItem(rank=i + 1, is_mine=(row.acheteur_id == current_user.id))
        for i, row in enumerate(rows)
    ]
