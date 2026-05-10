"""LOTPLOT 20F — Endpoints admin pour la gestion des partenaires régionaux.

Tout le module est protégé par `require_admin`. KPIs agrégés calculés à la volée
(nb courtiers recrutés, nb deals fermés via leurs courtiers, cut cumulée) ;
si le volume devient lourd, ces calculs gagneraient à être matérialisés via
des vues SQL ou un job nightly. Pour le MVP : aggregations simples dans Python.
"""
import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.models.deal import Deal, DealStatus
from app.models.bid import Bid, BidStatus
from app.models.regional_partner_profile import RegionalPartnerProfile
from app.models.regional_territory import RegionalTerritory
from app.services.auth import require_admin

log = logging.getLogger("logeo.partners")
router = APIRouter(prefix="/admin", tags=["admin-partners"])


# ── Schémas ─────────────────────────────────────────────────────────────────

class TerritoryView(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    is_active: bool

    model_config = {"from_attributes": True}


class PartnerListRow(BaseModel):
    """Ligne de la liste admin — contient les KPIs agrégés."""
    profile_id: uuid.UUID
    user_id: uuid.UUID
    full_name: str
    email: str
    territory_code: str | None = None
    territory_name: str | None = None
    status: str
    commission_rate: float
    contract_signed_at: datetime | None = None
    contract_terminated_at: datetime | None = None
    recruited_courtiers_count: int = 0
    closed_deals_count: int = 0
    total_commission_cad: int = 0


class PartnerDetail(PartnerListRow):
    """Détail — ajoute la liste nominative des courtiers et deals."""
    notes: str | None = None
    termination_reason: str | None = None
    recruited_courtiers: list[dict] = Field(default_factory=list)
    closed_deals: list[dict] = Field(default_factory=list)


class PartnerCreate(BaseModel):
    user_email: str
    territory_id: uuid.UUID | None = None
    commission_rate: float = 0.25
    contract_signed_at: datetime | None = None
    notes: str | None = None


class PartnerSuspend(BaseModel):
    notes: str | None = None


class PartnerTerminate(BaseModel):
    """Cessation. La clause détermine le statut final stocké."""
    clause: str  # voluntary | for_cause | without_cause | deceased
    reason: str | None = None


_TERMINATE_STATUS_BY_CLAUSE = {
    "voluntary": "quit_voluntary",
    "for_cause": "terminated_for_cause",
    "without_cause": "terminated_without_cause",
    "deceased": "deceased",
}


# ── Helpers ─────────────────────────────────────────────────────────────────

async def _kpis_for_partner(
    profile: RegionalPartnerProfile, db: AsyncSession,
) -> tuple[int, int, int]:
    """Retourne (recruited_courtiers_count, closed_deals_count, total_commission_cad).

    Les courtiers recrutés par le partenaire sont identifiés via
    `User.recruited_by_id == profile.user_id`. Les deals fermés sont les
    deals `paid` (workflow LOTPLOT 19) dont le `courtier_id` ∈ recrutés.
    Cut = winning_price × commission_rate × (fee_pct ou 1 %).
    """
    # 1) recruted courtiers
    recruited_res = await db.execute(
        select(User).where(
            User.recruited_by_id == profile.user_id,
            User.role == UserRole.courtier,
            User.deleted_at.is_(None),
        )
    )
    recruited = list(recruited_res.scalars())
    recruited_ids = [u.id for u in recruited]

    if not recruited_ids:
        return (0, 0, 0)

    # 2) closed deals (paid) via these courtiers
    deals_res = await db.execute(
        select(Deal).where(
            Deal.courtier_id.in_(recruited_ids),
            Deal.status == DealStatus.paid,
        )
    )
    deals = list(deals_res.scalars())

    # 3) cut cumulée — basée sur winning_price (LOTPLOT 19), fallback sur le
    # max bid si winning_price n'est pas renseigné (deals pré-LOTPLOT 19).
    rate = float(profile.commission_rate or 0)
    total_cad = 0
    for d in deals:
        base = d.winning_price
        if base is None:
            # fallback : max(amount) parmi les bids active+winner
            mx_res = await db.execute(
                select(func.max(Bid.amount)).where(
                    Bid.deal_id == d.id, Bid.status == BidStatus.winner,
                )
            )
            base = int(mx_res.scalar() or 0)
        fee_pct = (d.fee_pct or 1.0) / 100.0
        logeo_fee = int((base or 0) * fee_pct)
        total_cad += int(logeo_fee * rate)

    return (len(recruited), len(deals), total_cad)


# ── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/territories", response_model=list[TerritoryView])
async def list_territories(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Liste des territoires définis (utilisé par le formulaire de création)."""
    res = await db.execute(
        select(RegionalTerritory).order_by(RegionalTerritory.code.asc())
    )
    return list(res.scalars())


@router.get("/partners", response_model=list[PartnerListRow])
async def list_partners(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Liste tous les partenaires régionaux avec KPIs agrégés.

    Tri : actifs d'abord (status='active'), puis par date de nomination desc.
    """
    res = await db.execute(
        select(RegionalPartnerProfile, User, RegionalTerritory)
        .join(User, User.id == RegionalPartnerProfile.user_id)
        .join(RegionalTerritory, RegionalTerritory.id == RegionalPartnerProfile.territory_id, isouter=True)
        .order_by(
            (RegionalPartnerProfile.status == "active").desc(),
            RegionalPartnerProfile.contract_signed_at.desc().nullslast(),
        )
    )
    rows = list(res.all())
    out: list[PartnerListRow] = []
    for profile, user, territory in rows:
        recruited_n, closed_n, total_cad = await _kpis_for_partner(profile, db)
        out.append(PartnerListRow(
            profile_id=profile.id,
            user_id=user.id,
            full_name=user.full_name,
            email=user.email,
            territory_code=territory.code if territory else None,
            territory_name=territory.name if territory else None,
            status=profile.status,
            commission_rate=float(profile.commission_rate or 0),
            contract_signed_at=profile.contract_signed_at,
            contract_terminated_at=profile.contract_terminated_at,
            recruited_courtiers_count=recruited_n,
            closed_deals_count=closed_n,
            total_commission_cad=total_cad,
        ))
    return out


@router.get("/partners/{profile_id}", response_model=PartnerDetail)
async def get_partner(
    profile_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Détail d'un partenaire — liste des courtiers recrutés + deals fermés."""
    res = await db.execute(
        select(RegionalPartnerProfile).where(RegionalPartnerProfile.id == profile_id)
    )
    profile = res.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Partenaire introuvable")

    user_res = await db.execute(select(User).where(User.id == profile.user_id))
    user = user_res.scalar_one()

    territory = None
    if profile.territory_id:
        terr_res = await db.execute(
            select(RegionalTerritory).where(RegionalTerritory.id == profile.territory_id)
        )
        territory = terr_res.scalar_one_or_none()

    # Courtiers recrutés
    recruited_res = await db.execute(
        select(User)
        .where(
            User.recruited_by_id == profile.user_id,
            User.role == UserRole.courtier,
        )
        .order_by(User.recruited_at.desc().nullslast())
    )
    recruited_users = list(recruited_res.scalars())
    recruited_ids = [u.id for u in recruited_users]

    # Deals fermés via leurs courtiers
    closed_deals: list[dict] = []
    if recruited_ids:
        deals_res = await db.execute(
            select(Deal).where(
                Deal.courtier_id.in_(recruited_ids),
                Deal.status == DealStatus.paid,
            ).order_by(Deal.paid_at.desc().nullslast())
        )
        rate = float(profile.commission_rate or 0)
        for d in deals_res.scalars():
            base = d.winning_price or 0
            fee_pct = (d.fee_pct or 1.0) / 100.0
            logeo_fee = int(base * fee_pct)
            commission = int(logeo_fee * rate)
            closed_deals.append({
                "deal_id": str(d.id),
                "city": d.city,
                "winning_price": base,
                "logeo_fee": logeo_fee,
                "partner_commission": commission,
                "paid_at": d.paid_at.isoformat() if d.paid_at else None,
            })

    recruited_n = len(recruited_users)
    closed_n = len(closed_deals)
    total_cad = sum(x["partner_commission"] for x in closed_deals)

    return PartnerDetail(
        profile_id=profile.id,
        user_id=user.id,
        full_name=user.full_name,
        email=user.email,
        territory_code=territory.code if territory else None,
        territory_name=territory.name if territory else None,
        status=profile.status,
        commission_rate=float(profile.commission_rate or 0),
        contract_signed_at=profile.contract_signed_at,
        contract_terminated_at=profile.contract_terminated_at,
        recruited_courtiers_count=recruited_n,
        closed_deals_count=closed_n,
        total_commission_cad=total_cad,
        notes=profile.notes,
        termination_reason=profile.termination_reason,
        recruited_courtiers=[
            {
                "user_id": str(u.id),
                "full_name": u.full_name,
                "email": u.email,
                "agency_name": u.agency_name,
                "recruited_at": u.recruited_at.isoformat() if u.recruited_at else None,
                "is_active": u.is_active,
            }
            for u in recruited_users
        ],
        closed_deals=closed_deals,
    )


@router.post("/partners", response_model=PartnerListRow, status_code=201)
async def create_partner(
    payload: PartnerCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Crée un profil partenaire pour un user existant.

    Le user doit déjà exister (inscrit normalement). On bascule son rôle vers
    `regional_partner` et on lie un profil avec le territoire choisi. Si le
    user a déjà un profil partenaire, on rejette (un seul profil par user).
    """
    user_res = await db.execute(
        select(User).where(User.email == payload.user_email, User.deleted_at.is_(None))
    )
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Aucun utilisateur avec cet email.")

    existing_res = await db.execute(
        select(RegionalPartnerProfile).where(RegionalPartnerProfile.user_id == user.id)
    )
    if existing_res.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Cet utilisateur a déjà un profil partenaire.",
        )

    territory = None
    if payload.territory_id:
        terr_res = await db.execute(
            select(RegionalTerritory).where(RegionalTerritory.id == payload.territory_id)
        )
        territory = terr_res.scalar_one_or_none()
        if not territory:
            raise HTTPException(status_code=404, detail="Territoire introuvable.")

    user.role = UserRole.regional_partner
    profile = RegionalPartnerProfile(
        user_id=user.id,
        territory_id=payload.territory_id,
        status="active",
        commission_rate=Decimal(str(payload.commission_rate)),
        contract_signed_at=payload.contract_signed_at or datetime.now(timezone.utc),
        notes=payload.notes,
    )
    db.add(profile)
    await db.flush()

    log.info("partner_created admin=%s partner_user=%s territory=%s",
             current_user.email, user.email, territory.code if territory else None)
    return PartnerListRow(
        profile_id=profile.id,
        user_id=user.id,
        full_name=user.full_name,
        email=user.email,
        territory_code=territory.code if territory else None,
        territory_name=territory.name if territory else None,
        status=profile.status,
        commission_rate=float(profile.commission_rate),
        contract_signed_at=profile.contract_signed_at,
        contract_terminated_at=None,
        recruited_courtiers_count=0,
        closed_deals_count=0,
        total_commission_cad=0,
    )


@router.post("/partners/{profile_id}/suspend")
async def suspend_partner(
    profile_id: uuid.UUID,
    payload: PartnerSuspend | None = None,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Suspend un partenaire — `status` passe à `on_hold`. Les nouveaux deals
    fermés via ses courtiers ne génèrent plus de commission tant que la
    suspension est en cours. La réactivation se fait en remettant `status='active'`
    via un endpoint séparé (à ajouter si besoin) ou directement en DB.
    """
    res = await db.execute(
        select(RegionalPartnerProfile).where(RegionalPartnerProfile.id == profile_id)
    )
    profile = res.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Partenaire introuvable")
    if profile.status != "active":
        raise HTTPException(
            status_code=400,
            detail=f"Statut actuel '{profile.status}' — suspension impossible.",
        )
    profile.status = "on_hold"
    if payload and payload.notes:
        profile.notes = (profile.notes or "") + f"\n[suspension {datetime.now(timezone.utc).date()}] {payload.notes}"
    await db.flush()
    log.warning("partner_suspended admin=%s profile_id=%s", current_user.email, profile_id)
    return {"status": profile.status}


@router.post("/partners/{profile_id}/terminate")
async def terminate_partner(
    profile_id: uuid.UUID,
    payload: PartnerTerminate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Cesse le partenariat. La clause détermine le statut final :
      voluntary       → quit_voluntary
      for_cause       → terminated_for_cause
      without_cause   → terminated_without_cause
      deceased        → deceased
    `contract_terminated_at` et `termination_reason` sont enregistrés.
    Action irréversible côté UI ; la rangée historique reste en DB pour audit.
    """
    new_status = _TERMINATE_STATUS_BY_CLAUSE.get(payload.clause)
    if not new_status:
        raise HTTPException(
            status_code=400,
            detail="Clause invalide. Valeurs : voluntary, for_cause, without_cause, deceased.",
        )
    res = await db.execute(
        select(RegionalPartnerProfile).where(RegionalPartnerProfile.id == profile_id)
    )
    profile = res.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Partenaire introuvable")
    if profile.status not in ("active", "on_hold"):
        raise HTTPException(
            status_code=400,
            detail=f"Partenariat déjà clos (statut '{profile.status}').",
        )
    profile.status = new_status
    profile.contract_terminated_at = datetime.now(timezone.utc)
    profile.termination_reason = payload.reason
    await db.flush()
    log.warning(
        "partner_terminated admin=%s profile_id=%s clause=%s",
        current_user.email, profile_id, payload.clause,
    )
    return {"status": profile.status, "contract_terminated_at": profile.contract_terminated_at.isoformat()}
