"""
Système d'évaluations bidirectionnel : courtier ↔ acheteur après deal complété.

Règles :
  - Le deal doit être au statut `pa_signed` (transaction finalisée)
  - Le rater doit être impliqué : courtier propriétaire OU acheteur gagnant du deal
  - Le ratee doit être l'autre partie
  - Une seule review par direction et par deal (UniqueConstraint)
"""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.models.deal import Deal, DealStatus
from app.models.bid import Bid, BidStatus
from app.models.deal_review import DealReview
from app.schemas.review import ReviewCreate, ReviewView, ReviewWithMeta
from app.services.auth import get_current_user

router = APIRouter(prefix="/reviews", tags=["reviews"])


async def _get_deal_or_404(deal_id: uuid.UUID, db: AsyncSession) -> Deal:
    res = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = res.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal introuvable")
    return deal


async def _winning_acheteur_id(deal_id: uuid.UUID, db: AsyncSession) -> uuid.UUID | None:
    res = await db.execute(
        select(Bid.acheteur_id).where(Bid.deal_id == deal_id, Bid.status == BidStatus.winner)
    )
    return res.scalar_one_or_none()


@router.post("/deals/{deal_id}", response_model=ReviewView, status_code=201)
async def create_review(
    deal_id: uuid.UUID,
    payload: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    deal = await _get_deal_or_404(deal_id, db)
    if deal.status != DealStatus.pa_signed:
        raise HTTPException(status_code=400, detail="Évaluation possible seulement une fois la PA signée")

    winner_id = await _winning_acheteur_id(deal_id, db)
    if not winner_id:
        raise HTTPException(status_code=400, detail="Aucun gagnant pour ce deal")

    if current_user.role == UserRole.courtier:
        if deal.courtier_id != current_user.id:
            raise HTTPException(status_code=403, detail="Vous n'êtes pas le courtier de ce deal")
        ratee_id = winner_id
        rater_role = "courtier"
    elif current_user.role == UserRole.acheteur:
        if winner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Vous n'êtes pas le gagnant de ce deal")
        ratee_id = deal.courtier_id
        rater_role = "acheteur"
    else:
        raise HTTPException(status_code=403, detail="Rôle non autorisé")

    # Empêche les doublons (la contrainte DB le fait aussi mais message plus clair ici)
    existing = await db.execute(
        select(DealReview).where(
            DealReview.deal_id == deal_id,
            DealReview.rater_id == current_user.id,
            DealReview.ratee_id == ratee_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Vous avez déjà évalué cette personne pour ce deal")

    review = DealReview(
        deal_id=deal_id,
        rater_id=current_user.id,
        ratee_id=ratee_id,
        rater_role=rater_role,
        rating=payload.rating,
        comment=(payload.comment or "").strip()[:4000] or None,
    )
    db.add(review)
    await db.flush()
    return review


@router.get("/deals/{deal_id}", response_model=list[ReviewWithMeta])
async def list_reviews_for_deal(
    deal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(DealReview).where(DealReview.deal_id == deal_id).order_by(DealReview.created_at.desc())
    )
    rows = res.scalars().all()
    out = []
    for r in rows:
        rater_res = await db.execute(select(User).where(User.id == r.rater_id))
        rater = rater_res.scalar_one_or_none()
        out.append({
            **{c.name: getattr(r, c.name) for c in r.__table__.columns},
            "rater_name": rater.full_name if rater else None,
            "rater_role_label": "Courtier" if r.rater_role == "courtier" else "Acheteur",
            "deal_city": None,
        })
    return out


def _user_rating_aggregate_query():
    return (
        select(
            DealReview.ratee_id.label("user_id"),
            func.avg(DealReview.rating).label("avg_rating"),
            func.count(DealReview.id).label("review_count"),
        )
        .group_by(DealReview.ratee_id)
    )


@router.get("/users/{user_id}/aggregate")
async def user_rating_aggregate(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Public — moyenne et nombre d'évaluations pour un user. Pas d'auth requise."""
    res = await db.execute(
        select(
            func.avg(DealReview.rating).label("avg_rating"),
            func.count(DealReview.id).label("review_count"),
        ).where(DealReview.ratee_id == user_id)
    )
    row = res.first()
    avg = float(row.avg_rating) if row.avg_rating is not None else None
    return {
        "user_id": str(user_id),
        "average_rating": round(avg, 2) if avg is not None else None,
        "review_count": int(row.review_count or 0),
    }
