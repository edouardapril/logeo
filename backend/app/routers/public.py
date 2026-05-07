"""Endpoints publics — pas d'authentification requise.

Données exposées : agrégats anonymisés (compteurs, moyennes), photos profil,
noms publics. JAMAIS de montants de deals, jamais d'adresse privée.
"""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, Integer, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.models.deal import Deal, DealStatus
from app.models.bid import Bid, BidStatus
from app.models.deal_review import DealReview
from app.models.nda import NDA
from app.models.deal_question import DealQuestion
from app.services.auction import compute_auction_state

router = APIRouter(prefix="/public", tags=["public"])


# ── Profil public acheteur ───────────────────────────────────────────────────

@router.get("/acheteur/{user_id}")
async def public_acheteur_profile(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(User).where(User.id == user_id, User.role == UserRole.acheteur, User.is_active == True)  # noqa: E712
    )
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Profil introuvable")

    won_count_res = await db.execute(
        select(func.count(Bid.id))
        .where(Bid.acheteur_id == user_id, Bid.status == BidStatus.winner)
    )
    won_count = int(won_count_res.scalar() or 0)

    completed_res = await db.execute(
        select(func.count(Bid.id))
        .join(Deal, Deal.id == Bid.deal_id)
        .where(
            Bid.acheteur_id == user_id,
            Bid.status == BidStatus.winner,
            Deal.status == DealStatus.pa_signed,
        )
    )
    completed_count = int(completed_res.scalar() or 0)

    rating_res = await db.execute(
        select(
            func.avg(DealReview.rating).label("avg"),
            func.count(DealReview.id).label("cnt"),
        ).where(DealReview.ratee_id == user_id)
    )
    rating_row = rating_res.first()
    avg = float(rating_row.avg) if rating_row and rating_row.avg is not None else None

    # Historique deals (sans montants)
    history_res = await db.execute(
        select(Deal.id, Deal.property_type, Deal.city, Deal.status, Deal.created_at)
        .join(Bid, Bid.deal_id == Deal.id)
        .where(Bid.acheteur_id == user_id, Bid.status == BidStatus.winner)
        .order_by(Deal.created_at.desc())
        .limit(20)
    )
    history = [
        {
            "deal_id": str(r.id),
            "property_type": r.property_type.value if hasattr(r.property_type, "value") else str(r.property_type),
            "city": r.city,
            "status": r.status.value if hasattr(r.status, "value") else str(r.status),
            "date": r.created_at.isoformat() if r.created_at else None,
        }
        for r in history_res.all()
    ]

    return {
        "id": str(user.id),
        "full_name": user.full_name,
        "profile_photo_path": user.profile_photo_path,
        "won_deals": won_count,
        "completed_deals": completed_count,
        "average_rating": round(avg, 2) if avg is not None else None,
        "review_count": int(rating_row.cnt or 0) if rating_row else 0,
        "history": history,
    }


# ── Profil public courtier (utilisé par le leaderboard) ──────────────────────

@router.get("/courtier/{user_id}")
async def public_courtier_profile(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(User).where(User.id == user_id, User.role == UserRole.courtier, User.is_active == True)  # noqa: E712
    )
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Profil introuvable")

    published_res = await db.execute(
        select(func.count(Deal.id)).where(
            Deal.courtier_id == user_id,
            Deal.status.in_([DealStatus.bid, DealStatus.intro, DealStatus.pa_signed]),
        )
    )
    published = int(published_res.scalar() or 0)

    completed_res = await db.execute(
        select(func.count(Deal.id)).where(
            Deal.courtier_id == user_id, Deal.status == DealStatus.pa_signed,
        )
    )
    completed = int(completed_res.scalar() or 0)

    rating_res = await db.execute(
        select(
            func.avg(DealReview.rating).label("avg"),
            func.count(DealReview.id).label("cnt"),
        ).where(DealReview.ratee_id == user_id)
    )
    rating_row = rating_res.first()
    avg = float(rating_row.avg) if rating_row and rating_row.avg is not None else None

    return {
        "id": str(user.id),
        "full_name": user.full_name,
        "agency_name": user.agency_name,
        "oaciq_number": user.oaciq_number,
        "profile_photo_path": user.profile_photo_path,
        "published_deals": published,
        "completed_deals": completed,
        "average_rating": round(avg, 2) if avg is not None else None,
        "review_count": int(rating_row.cnt or 0) if rating_row else 0,
    }


# ── Leaderboard ───────────────────────────────────────────────────────────────

@router.get("/leaderboard")
async def leaderboard(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """
    Top acheteurs et top courtiers, par nombre de deals complétés (PA signée).
    Tie-breaker : note moyenne. Aucun montant exposé.
    """
    # ── Top acheteurs : count des bids gagnants sur deals pa_signed
    won_subq = (
        select(
            Bid.acheteur_id.label("user_id"),
            func.count(Bid.id).label("completed"),
        )
        .join(Deal, Deal.id == Bid.deal_id)
        .where(Bid.status == BidStatus.winner, Deal.status == DealStatus.pa_signed)
        .group_by(Bid.acheteur_id)
    ).subquery()

    rating_subq = (
        select(
            DealReview.ratee_id.label("user_id"),
            func.avg(DealReview.rating).label("avg"),
            func.count(DealReview.id).label("cnt"),
        )
        .group_by(DealReview.ratee_id)
    ).subquery()

    acheteurs_res = await db.execute(
        select(
            User.id, User.full_name, User.profile_photo_path,
            func.coalesce(won_subq.c.completed, 0).label("completed"),
            rating_subq.c.avg, rating_subq.c.cnt,
        )
        .join(won_subq, won_subq.c.user_id == User.id)
        .outerjoin(rating_subq, rating_subq.c.user_id == User.id)
        .where(User.role == UserRole.acheteur, User.is_active == True)  # noqa: E712
        .order_by(
            func.coalesce(won_subq.c.completed, 0).desc(),
            func.coalesce(rating_subq.c.avg, 0).desc(),
        )
        .limit(limit)
    )
    top_acheteurs = []
    for r in acheteurs_res.all():
        top_acheteurs.append({
            "id": str(r.id), "full_name": r.full_name,
            "profile_photo_path": r.profile_photo_path,
            "completed_deals": int(r.completed or 0),
            "average_rating": round(float(r.avg), 2) if r.avg is not None else None,
            "review_count": int(r.cnt or 0),
        })

    # ── Top courtiers : count des deals publiés et complétés
    completed_expr = func.sum(case((Deal.status == DealStatus.pa_signed, 1), else_=0))
    courtier_pub_subq = (
        select(
            Deal.courtier_id.label("user_id"),
            func.count(Deal.id).label("published"),
            completed_expr.label("completed"),
        )
        .where(Deal.status.in_([DealStatus.bid, DealStatus.intro, DealStatus.pa_signed]))
        .group_by(Deal.courtier_id)
    ).subquery()

    courtiers_res = await db.execute(
        select(
            User.id, User.full_name, User.agency_name, User.profile_photo_path,
            courtier_pub_subq.c.published,
            courtier_pub_subq.c.completed,
            rating_subq.c.avg, rating_subq.c.cnt,
        )
        .join(courtier_pub_subq, courtier_pub_subq.c.user_id == User.id)
        .outerjoin(rating_subq, rating_subq.c.user_id == User.id)
        .where(User.role == UserRole.courtier, User.is_active == True)  # noqa: E712
        .order_by(
            func.coalesce(courtier_pub_subq.c.completed, 0).desc(),
            func.coalesce(courtier_pub_subq.c.published, 0).desc(),
            func.coalesce(rating_subq.c.avg, 0).desc(),
        )
        .limit(limit)
    )
    top_courtiers = []
    for r in courtiers_res.all():
        top_courtiers.append({
            "id": str(r.id), "full_name": r.full_name,
            "agency_name": r.agency_name,
            "profile_photo_path": r.profile_photo_path,
            "published_deals": int(r.published or 0),
            "completed_deals": int(r.completed or 0),
            "average_rating": round(float(r.avg), 2) if r.avg is not None else None,
            "review_count": int(r.cnt or 0),
        })

    return {"acheteurs": top_acheteurs, "courtiers": top_courtiers}


# ── Marketplace publique (sprint final item 1) ──────────────────────────────

@router.get("/marketplace")
async def public_marketplace(
    region: str | None = Query(default=None),
    mrc: str | None = Query(default=None),
    city: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """
    Liste publique des deals en enchère active. Affichée sans authentification
    pour créer l'envie de s'inscrire.

    Champs exposés (volontairement minimalistes) :
      - city, region, mrc, postal_code (sans adresse précise)
      - property_type
      - floor_price (engagement vendeur, public)
      - displayed_price (2e prix + incrément, calculé temps réel)
      - bidders_count
      - bid_close_at (pour le timer)
      - teaser_photo_path (photo watermarquée publique)
      - teaser_text

    Champs JAMAIS exposés ici :
      - address_private (post-NDA)
      - photo_paths originales (post-NDA)
      - documents
    """
    now = datetime.now(timezone.utc)

    query = select(Deal).where(
        Deal.status == DealStatus.bid,
        Deal.bid_close_at.isnot(None),
        Deal.bid_close_at > now,
    )
    if region:
        query = query.where(Deal.region == region)
    if mrc:
        query = query.where(Deal.mrc == mrc)
    if city:
        query = query.where(Deal.city.ilike(f"%{city}%"))
    query = query.order_by(Deal.bid_close_at.asc())

    deals = (await db.execute(query)).scalars().all()
    if not deals:
        return []
    deal_ids = [d.id for d in deals]

    # NDA counts agrégés (preuve sociale)
    nda_map: dict = {}
    nr = await db.execute(
        select(NDA.deal_id, func.count(NDA.id))
        .where(NDA.deal_id.in_(deal_ids)).group_by(NDA.deal_id)
    )
    for did, c in nr.all():
        nda_map[did] = int(c)

    out = []
    for d in deals:
        state = await compute_auction_state(d, db)
        out.append(_serialize_public_deal(d, state, nda_map.get(d.id, 0)))
    return out


def _serialize_public_deal(d, state, nda_count):
    """Sérialisation commune pour la marketplace + page publique d'un deal."""
    cap_rate = None
    if d.net_revenue and d.floor_price:
        cap_rate = round(d.net_revenue / d.floor_price * 100, 2)
    ratio_floor_eval = None
    if d.floor_price and d.municipal_evaluation:
        ratio_floor_eval = round(d.floor_price / d.municipal_evaluation * 100, 1)
    return {
        "id": str(d.id),
        "property_type": d.property_type.value if hasattr(d.property_type, "value") else str(d.property_type),
        "city": d.city,
        "region": d.region,
        "mrc": d.mrc,
        "postal_code": d.postal_code,
        # Financiers exposés au public
        "floor_price": d.floor_price,
        "gross_revenue": d.gross_revenue,
        "net_revenue": d.net_revenue,
        "municipal_evaluation": d.municipal_evaluation,
        "cap_rate": cap_rate,
        "ratio_floor_eval_pct": ratio_floor_eval,
        # Métriques propriété
        "num_units": d.num_units,
        "year_built": d.year_built,
        "total_area_sqft": d.total_area_sqft,
        "tax_roll_date": d.tax_roll_date.isoformat() if d.tax_roll_date else None,
        # Enchère
        "displayed_price": state["displayed_price"],
        "bidders_count": state["bidders_count"],
        "min_bid_increment": d.min_bid_increment,
        "bid_open_at": d.bid_open_at.isoformat() if d.bid_open_at else None,
        "bid_close_at": d.bid_close_at.isoformat() if d.bid_close_at else None,
        # Teaser visuel + texte (max 3 photos watermarquées — sprint v13)
        "teaser_text": d.teaser_text,
        "teaser_photo_path": d.teaser_photo_path,
        "teaser_photo_paths": d.teaser_photo_paths or (
            [d.teaser_photo_path] if d.teaser_photo_path else []
        ),
        # Preuve sociale
        "ndas_count": nda_count,
    }


# ── Page publique d'un deal individuel (sans login) ──────────────────────────

@router.get("/deals/{deal_id}")
async def public_deal_detail(
    deal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Vue teaser publique d'un deal — accessible sans authentification.
       Ne renvoie JAMAIS adresse exacte, photos HD, courtier, documents, loyers individuels."""
    res = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = res.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal introuvable")
    # Statuts publics : enchère active ou terminée récemment
    if deal.status not in (DealStatus.bid, DealStatus.intro, DealStatus.pa_signed, DealStatus.auction_ended):
        raise HTTPException(status_code=404, detail="Deal non disponible publiquement")

    state = await compute_auction_state(deal, db)
    nda_res = await db.execute(
        select(func.count(NDA.id)).where(NDA.deal_id == deal_id)
    )
    nda_count = int(nda_res.scalar() or 0)

    return _serialize_public_deal(deal, state, nda_count)


@router.get("/deals/{deal_id}/questions")
async def public_deal_questions(
    deal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Q&R d'un deal — visibles publiquement (lecture seulement). Poser une question requiert le NDA."""
    res = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = res.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal introuvable")
    if deal.status not in (DealStatus.bid, DealStatus.intro, DealStatus.pa_signed, DealStatus.auction_ended):
        raise HTTPException(status_code=404, detail="Deal non disponible publiquement")

    qres = await db.execute(
        select(DealQuestion).where(DealQuestion.deal_id == deal_id)
        .order_by(DealQuestion.asked_at.desc()).limit(50)
    )
    questions = list(qres.scalars())
    return [
        {
            "id": str(q.id),
            "question": q.question,
            "answer": q.answer,
            "asked_at": q.asked_at.isoformat() if q.asked_at else None,
            "answered_at": q.answered_at.isoformat() if q.answered_at else None,
        }
        for q in questions
    ]



