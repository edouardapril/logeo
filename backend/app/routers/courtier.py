import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.models.deal import Deal, DealStatus, PropertyType
from app.models.deal_unit import DealUnit
from app.models.deal_question import DealQuestion
from app.schemas.deal import (
    DealSubmit, DealTeaser, DealListItem, DealPatch, TeaserSelection,
    DealCourtierFull,
)
from app.schemas.unit import UnitWrite, UnitView
from app.schemas.question import QuestionView, QuestionAnswer
from app.services.auth import require_courtier, block_in_impersonation
from app.services.pdf import save_uploaded_file
from app.services import storage as storage_svc
from app.services import watermark as watermark_svc
from app.config import get_settings

settings = get_settings()

router = APIRouter(prefix="/courtier", tags=["courtier"])


# ── Dashboard courtier (KPIs + deals en cours) ───────────────────────────────

@router.get("/dashboard")
async def courtier_dashboard(
    current_user: User = Depends(require_courtier),
    db: AsyncSession = Depends(get_db),
):
    """KPIs (deals soumis, actifs, fermés, valeur fermée) + liste deals en cours
    enrichis (NDAs, bids count, prix actuel, jours restants).
    """
    from sqlalchemy import func
    from app.models.nda import NDA
    from app.models.bid import Bid, BidStatus
    from app.services.auction import compute_auction_state

    # ── KPIs ──────────────────────────────────────────────────────────────────
    submitted_res = await db.execute(
        select(func.count(Deal.id)).where(Deal.courtier_id == current_user.id)
    )
    total_submitted = int(submitted_res.scalar() or 0)

    active_res = await db.execute(
        select(func.count(Deal.id)).where(
            Deal.courtier_id == current_user.id,
            Deal.archived_at.is_(None),
            Deal.status.in_([
                DealStatus.draft, DealStatus.analyse,
                DealStatus.bid, DealStatus.intro,
            ]),
        )
    )
    active_count = int(active_res.scalar() or 0)

    closed_res = await db.execute(
        select(func.count(Deal.id)).where(
            Deal.courtier_id == current_user.id,
            Deal.status == DealStatus.pa_signed,
        )
    )
    closed_count = int(closed_res.scalar() or 0)

    # Valeur totale fermée = somme bid gagnant pour les deals pa_signed
    closed_value_res = await db.execute(
        select(func.coalesce(func.sum(Bid.amount), 0))
        .join(Deal, Deal.id == Bid.deal_id)
        .where(
            Deal.courtier_id == current_user.id,
            Deal.status == DealStatus.pa_signed,
            Bid.status == BidStatus.winner,
        )
    )
    total_closed_value = int(closed_value_res.scalar() or 0)

    # ── Deals en cours (non archivés, non pa_signed) ─────────────────────────
    deals_res = await db.execute(
        select(Deal).where(
            Deal.courtier_id == current_user.id,
            Deal.archived_at.is_(None),
            Deal.status != DealStatus.pa_signed,
        ).order_by(Deal.bid_close_at.asc().nullslast(), Deal.created_at.desc())
    )
    deals = list(deals_res.scalars())
    deal_ids = [d.id for d in deals]

    ndas_map: dict = {}
    bids_map: dict = {}
    if deal_ids:
        nr = await db.execute(
            select(NDA.deal_id, func.count(NDA.id))
            .where(NDA.deal_id.in_(deal_ids)).group_by(NDA.deal_id)
        )
        for did, c in nr.all():
            ndas_map[did] = int(c)
        br = await db.execute(
            select(Bid.deal_id, func.count(func.distinct(Bid.acheteur_id)))
            .where(Bid.deal_id.in_(deal_ids), Bid.status == BidStatus.active)
            .group_by(Bid.deal_id)
        )
        for did, c in br.all():
            bids_map[did] = int(c)

    now = datetime.now(timezone.utc)
    active_deals = []
    for d in deals:
        state = await compute_auction_state(d, db)
        days_remaining = None
        if d.status == DealStatus.bid and d.bid_close_at:
            secs = (d.bid_close_at - now).total_seconds()
            days_remaining = max(0, round(secs / 86400, 1))
        active_deals.append({
            "deal_id": str(d.id),
            "city": d.city,
            "region": d.region,
            "address_private": d.address_private,
            "property_type": str(d.property_type),
            "status": d.status.value if hasattr(d.status, "value") else str(d.status),
            "floor_price": d.floor_price,
            "displayed_price": state["displayed_price"],
            "ndas_count": ndas_map.get(d.id, 0),
            "bidders_count": bids_map.get(d.id, 0),
            "bid_close_at": d.bid_close_at.isoformat() if d.bid_close_at else None,
            "days_remaining": days_remaining,
        })

    return {
        "kpis": {
            "total_submitted": total_submitted,
            "active_count": active_count,
            "closed_count": closed_count,
            "total_closed_value": total_closed_value,
        },
        "active_deals": active_deals,
    }


@router.get("/deals", response_model=list[DealListItem])
async def list_my_deals(
    current_user: User = Depends(require_courtier),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Deal).where(Deal.courtier_id == current_user.id).order_by(Deal.created_at.desc())
    )
    return result.scalars().all()


# Sprint UX item 5 — vision 360 par deal
@router.get("/deals/enriched")
async def list_my_deals_enriched(
    current_user: User = Depends(require_courtier),
    db: AsyncSession = Depends(get_db),
):
    """Liste enrichie des deals du courtier — NDAs, bids, FAQ count, prix actuel."""
    from sqlalchemy import func
    from app.models.nda import NDA
    from app.models.deal_question import DealQuestion
    from app.models.bid import Bid, BidStatus
    from app.services.auction import compute_auction_state

    res = await db.execute(
        select(Deal).where(Deal.courtier_id == current_user.id).order_by(Deal.created_at.desc())
    )
    deals = list(res.scalars())
    if not deals:
        return []
    deal_ids = [d.id for d in deals]

    ndas_map: dict = {}
    nr = await db.execute(
        select(NDA.deal_id, func.count(NDA.id)).where(NDA.deal_id.in_(deal_ids)).group_by(NDA.deal_id)
    )
    for did, c in nr.all():
        ndas_map[did] = int(c)

    bids_map: dict = {}
    br = await db.execute(
        select(Bid.deal_id, func.count(func.distinct(Bid.acheteur_id)))
        .where(Bid.deal_id.in_(deal_ids), Bid.status == BidStatus.active)
        .group_by(Bid.deal_id)
    )
    for did, c in br.all():
        bids_map[did] = int(c)

    unans_map: dict = {}
    qr = await db.execute(
        select(DealQuestion.deal_id, func.count(DealQuestion.id))
        .where(DealQuestion.deal_id.in_(deal_ids), DealQuestion.answer.is_(None))
        .group_by(DealQuestion.deal_id)
    )
    for did, c in qr.all():
        unans_map[did] = int(c)

    out = []
    for d in deals:
        displayed_price = None
        if d.status == DealStatus.bid:
            state = await compute_auction_state(d, db)
            displayed_price = state["displayed_price"]

        out.append({
            "id": str(d.id),
            "city": d.city,
            "region": d.region,
            "address_private": d.address_private,
            "property_type": d.property_type.value if hasattr(d.property_type, "value") else str(d.property_type),
            "status": d.status.value if hasattr(d.status, "value") else str(d.status),
            "floor_price": d.floor_price,
            "bid_close_at": d.bid_close_at.isoformat() if d.bid_close_at else None,
            "created_at": d.created_at.isoformat(),
            "ndas_count": ndas_map.get(d.id, 0),
            "bidders_count": bids_map.get(d.id, 0),
            "unanswered_questions_count": unans_map.get(d.id, 0),
            "displayed_price": displayed_price,
        })
    return out


@router.get("/deals/{deal_id}", response_model=DealCourtierFull)
async def get_my_deal(
    deal_id: uuid.UUID,
    current_user: User = Depends(require_courtier),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import func
    from app.models.nda import NDA
    from app.models.bid import Bid, BidStatus
    from app.services.auction import compute_auction_state, serialize_auction_state

    result = await db.execute(
        select(Deal).where(Deal.id == deal_id, Deal.courtier_id == current_user.id)
    )
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal introuvable")

    # Stats live — utilisées par le hero de la fiche unifiée
    state = await compute_auction_state(deal, db)
    ndas_res = await db.execute(
        select(func.count(NDA.id)).where(NDA.deal_id == deal_id)
    )
    ndas_count = int(ndas_res.scalar() or 0)
    unans_res = await db.execute(
        select(func.count(DealQuestion.id)).where(
            DealQuestion.deal_id == deal_id, DealQuestion.answer.is_(None),
        )
    )
    unans_count = int(unans_res.scalar() or 0)

    return {
        **deal.__dict__,
        "is_locked": _is_locked_for_courtier(deal),
        # Liste parallèle de paths bruts pour le panel de sélection teaser
        # (le PATCH /teaser-selection valide contre les paths DB, pas les URLs signées).
        "photo_paths_raw": list(deal.photo_paths or []),
        # Stats live pour le hero unifié
        "displayed_price": state["current_price"],
        "bidders_count": state["bidders_count"],
        "ndas_count": ndas_count,
        "unanswered_questions_count": unans_count,
        # Auction state filtré "courtier" : pas d'identité bidder ni de maxs
        "auction_state": serialize_auction_state(state, "courtier"),
    }


@router.post("/deals", response_model=DealTeaser, status_code=201)
async def submit_deal(
    payload: DealSubmit,
    current_user: User = Depends(require_courtier),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(block_in_impersonation),
):
    if not payload.postal_code or not payload.postal_code.strip():
        raise HTTPException(status_code=400, detail="Code postal requis")

    # Convention courtier béton — gate obligatoire
    if (
        current_user.convention_clauses_version != settings.courtier_convention_required_version
        or not current_user.convention_signed_at
    ):
        raise HTTPException(
            status_code=403,
            detail="Vous devez signer la convention courtier avant de soumettre un deal.",
        )

    deal = Deal(
        courtier_id=current_user.id,
        status=DealStatus.analyse,
        **payload.model_dump(),
    )
    db.add(deal)
    await db.flush()

    # Log de diagnostic — confirme la sauvegarde en DB avec status = "analyse"
    print(
        f"[SUBMIT_DEAL] Deal {deal.id} sauvegarde OK · "
        f"status={deal.status.value} · city={deal.city} · "
        f"courtier={current_user.email} ({current_user.id})",
        flush=True,
    )
    return deal


@router.post("/deals/{deal_id}/documents")
async def upload_documents(
    deal_id: uuid.UUID,
    baux: UploadFile | None = File(None),
    taxes: UploadFile | None = File(None),
    certificat_localisation: UploadFile | None = File(None),
    declaration_vendeur: UploadFile | None = File(None),
    rapport_complet: UploadFile | None = File(None),
    current_user: User = Depends(require_courtier),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Deal).where(Deal.id == deal_id, Deal.courtier_id == current_user.id)
    )
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal introuvable")
    _assert_editable(deal)

    docs = deal.documents or {}
    subfolder = f"deals/{deal_id}"

    uploads = {
        "baux": baux,
        "taxes": taxes,
        "certificat_localisation": certificat_localisation,
        "declaration_vendeur": declaration_vendeur,
    }
    for key, file in uploads.items():
        if file:
            content = await file.read()
            path = save_uploaded_file(content, file.filename, subfolder)
            docs[key] = path

    if rapport_complet:
        content = await rapport_complet.read()
        path = save_uploaded_file(content, rapport_complet.filename, subfolder)
        deal.full_report_path = path

    deal.documents = docs
    await db.flush()
    return {"message": "Documents uploadés avec succès", "documents": docs}


MAX_PHOTOS = 10
ALLOWED_PHOTO_MIMES = {"image/jpeg", "image/png", "image/webp"}


@router.post("/deals/{deal_id}/photos")
async def upload_photos(
    deal_id: uuid.UUID,
    files: list[UploadFile] = File(...),
    current_user: User = Depends(require_courtier),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload jusqu'à 10 photos d'un deal.
    - Originaux stockés dans `documents` bucket (post-NDA, signed URL).
    - Première photo (façade) génère aussi un watermark dans `deals` bucket (public)
      utilisé comme teaser tant qu'il n'y a pas de NDA.
    """
    result = await db.execute(
        select(Deal).where(Deal.id == deal_id, Deal.courtier_id == current_user.id)
    )
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal introuvable")
    _assert_editable(deal)

    existing = list(deal.photo_paths or [])
    if len(existing) + len(files) > MAX_PHOTOS:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_PHOTOS} photos par deal (vous en avez déjà {len(existing)}).",
        )

    subfolder = f"deals/{deal_id}/photos"
    new_paths: list[str] = []

    for f in files:
        if f.content_type not in ALLOWED_PHOTO_MIMES:
            raise HTTPException(status_code=400, detail=f"Format non supporté : {f.content_type}")
        content = await f.read()

        # Original — bucket "documents" (post-NDA)
        original_path = storage_svc.save(
            content=content,
            filename=f.filename,
            kind=storage_svc.KIND_DOCUMENTS,
            subfolder=subfolder,
            content_type=f.content_type,
        )
        new_paths.append(original_path)

    deal.photo_paths = existing + new_paths
    # Le watermark est maintenant généré uniquement par PATCH /teaser-selection.
    await db.flush()
    return {
        "photo_paths": deal.photo_paths,  # paths bruts : utilisés ensuite par PATCH /teaser-selection
        "teaser_photo_paths": storage_svc.to_public_urls(deal.teaser_photo_paths),
    }


@router.patch("/deals/{deal_id}/teaser-selection")
async def set_teaser_selection(
    deal_id: uuid.UUID,
    payload: TeaserSelection,
    current_user: User = Depends(require_courtier),
    db: AsyncSession = Depends(get_db),
):
    """Sélection cover + 0-2 secondaires. Génère les watermarks publics.

    Remplace intégralement la sélection teaser précédente : les anciens
    watermarks sont supprimés du storage et la liste teaser_photo_paths
    est réécrite dans l'ordre [cover, sec1, sec2].
    """
    result = await db.execute(
        select(Deal).where(Deal.id == deal_id, Deal.courtier_id == current_user.id)
    )
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal introuvable")
    _assert_editable(deal)

    photo_paths = list(deal.photo_paths or [])
    if not photo_paths:
        raise HTTPException(status_code=400, detail="Aucune photo uploadée pour ce deal")

    if payload.cover_original not in photo_paths:
        raise HTTPException(status_code=400, detail="Photo de couverture introuvable dans ce deal")
    if len(payload.secondary_originals) > 2:
        raise HTTPException(status_code=400, detail="Maximum 2 photos secondaires")
    for sp in payload.secondary_originals:
        if sp not in photo_paths:
            raise HTTPException(status_code=400, detail=f"Photo secondaire introuvable : {sp}")
    if payload.cover_original in payload.secondary_originals:
        raise HTTPException(status_code=400, detail="La couverture ne peut pas aussi être secondaire")
    if len(set(payload.secondary_originals)) != len(payload.secondary_originals):
        raise HTTPException(status_code=400, detail="Photos secondaires en double")

    # Supprime les anciens watermarks (orphelins après cette opération)
    for old_wm in (deal.teaser_photo_paths or []):
        try:
            storage_svc.delete(old_wm)
        except Exception:
            pass

    # Génère les nouveaux watermarks dans l'ordre [cover, sec1, sec2]
    selected = [payload.cover_original] + list(payload.secondary_originals)
    new_teasers: list[str] = []
    for i, original in enumerate(selected):
        try:
            content = storage_svc.read(original)
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Lecture impossible de l'original {original}: {e}",
            )
        try:
            wm_bytes = watermark_svc.watermark_image(content)
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Génération watermark échouée: {e}",
            )
        wm_path = storage_svc.save(
            content=wm_bytes,
            filename=f"teaser_{i}.jpg",
            kind=storage_svc.KIND_DEALS,
            subfolder=f"deals/{deal_id}",
            content_type="image/jpeg",
        )
        new_teasers.append(wm_path)

    deal.teaser_photo_paths = new_teasers
    deal.teaser_photo_path = new_teasers[0]  # backward compat
    await db.flush()
    return {
        "teaser_photo_paths": storage_svc.to_public_urls(deal.teaser_photo_paths),
        "teaser_photo_path": storage_svc.to_public_url(deal.teaser_photo_path),
    }


@router.delete("/deals/{deal_id}/photos")
async def delete_photo(
    deal_id: uuid.UUID,
    path: str,
    current_user: User = Depends(require_courtier),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Deal).where(Deal.id == deal_id, Deal.courtier_id == current_user.id)
    )
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal introuvable")
    _assert_editable(deal)

    photos = list(deal.photo_paths or [])
    if path not in photos:
        raise HTTPException(status_code=404, detail="Photo introuvable")
    photos.remove(path)
    deal.photo_paths = photos

    # La sélection teaser dépendait peut-être de cette photo : on l'invalide
    # entièrement, force le courtier à re-sélectionner via PATCH /teaser-selection.
    old_teasers = list(deal.teaser_photo_paths or [])
    if old_teasers:
        for old_wm in old_teasers:
            try:
                storage_svc.delete(old_wm)
            except Exception:
                pass
        deal.teaser_photo_paths = None
        deal.teaser_photo_path = None

    # Supprime aussi le fichier original du storage (auparavant orphelin)
    try:
        storage_svc.delete(path)
    except Exception:
        pass

    await db.flush()
    return {
        "photo_paths": photos,  # paths bruts : utilisés par PATCH /teaser-selection après ré-upload
        "teaser_photo_paths": storage_svc.to_public_urls(deal.teaser_photo_paths),
    }


@router.post("/deals/{deal_id}/pa")
async def upload_pa(
    deal_id: uuid.UUID,
    pa_file: UploadFile = File(...),
    current_user: User = Depends(require_courtier),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(block_in_impersonation),
):
    """Upload de la promesse d'achat signée - déclenche la clôture du deal."""
    result = await db.execute(
        select(Deal).where(Deal.id == deal_id, Deal.courtier_id == current_user.id)
    )
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal introuvable")
    if deal.status != DealStatus.intro:
        raise HTTPException(status_code=400, detail="La PA ne peut être uploadée qu'au stade intro")

    content = await pa_file.read()
    path = save_uploaded_file(content, pa_file.filename, f"deals/{deal_id}/pa")

    docs = deal.documents or {}
    docs["pa_signee"] = path
    deal.documents = docs
    deal.status = DealStatus.pa_signed
    await db.flush()

    return {"message": "Promesse d'achat enregistrée. L'admin va confirmer le paiement du solde."}


# ── Patch deal (financiers, travaux, matières, visite, etc.) ─────────────────

EDITABLE_FIELDS = {
    "teaser_text", "gross_revenue", "net_revenue", "expenses", "revenue_history",
    "municipal_evaluation", "zoning", "easements", "work_history",
    "material_disclosures", "virtual_tour_url", "visit_notes",
    "yield_pct", "num_units",
}


async def _load_owned_deal(deal_id: uuid.UUID, user: User, db: AsyncSession) -> Deal:
    res = await db.execute(
        select(Deal).where(Deal.id == deal_id, Deal.courtier_id == user.id)
    )
    deal = res.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal introuvable")
    return deal


# Statuts pendant lesquels le courtier peut encore éditer la fiche / documentation.
# Toute autre valeur (bid, intro, pa_signed, auction_ended, nogo) → fiche verrouillée.
EDITABLE_DEAL_STATUSES = (DealStatus.draft, DealStatus.analyse)


def _is_locked_for_courtier(deal: Deal) -> bool:
    return deal.status not in EDITABLE_DEAL_STATUSES


def _assert_editable(deal: Deal) -> None:
    if _is_locked_for_courtier(deal):
        raise HTTPException(
            status_code=403,
            detail="Fiche verrouillée — les enchères ont commencé, lecture seule.",
        )


@router.patch("/deals/{deal_id}", response_model=DealTeaser)
async def patch_deal(
    deal_id: uuid.UUID,
    payload: DealPatch,
    current_user: User = Depends(require_courtier),
    db: AsyncSession = Depends(get_db),
):
    deal = await _load_owned_deal(deal_id, current_user, db)
    _assert_editable(deal)
    data = payload.model_dump(exclude_unset=True)
    # floor_price ignoré côté courtier — réservé admin
    data.pop("floor_price", None)
    for k, v in data.items():
        if k in EDITABLE_FIELDS:
            setattr(deal, k, v)
    await db.flush()
    return deal


# ── Inspection report upload ─────────────────────────────────────────────────

@router.post("/deals/{deal_id}/inspection-report")
async def upload_inspection_report(
    deal_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(require_courtier),
    db: AsyncSession = Depends(get_db),
):
    deal = await _load_owned_deal(deal_id, current_user, db)
    _assert_editable(deal)
    content = await file.read()
    path = save_uploaded_file(content, file.filename, f"deals/{deal_id}/inspection")
    deal.inspection_report_path = path
    await db.flush()
    return {"inspection_report_path": storage_svc.to_signed_url(path)}


# ── Logements (units) ────────────────────────────────────────────────────────

@router.get("/deals/{deal_id}/units", response_model=list[UnitView])
async def list_units(
    deal_id: uuid.UUID,
    current_user: User = Depends(require_courtier),
    db: AsyncSession = Depends(get_db),
):
    await _load_owned_deal(deal_id, current_user, db)
    res = await db.execute(
        select(DealUnit).where(DealUnit.deal_id == deal_id).order_by(DealUnit.order_index)
    )
    return res.scalars().all()


@router.post("/deals/{deal_id}/units", response_model=UnitView, status_code=201)
async def create_unit(
    deal_id: uuid.UUID,
    payload: UnitWrite,
    current_user: User = Depends(require_courtier),
    db: AsyncSession = Depends(get_db),
):
    deal = await _load_owned_deal(deal_id, current_user, db)
    _assert_editable(deal)
    unit = DealUnit(deal_id=deal_id, **payload.model_dump())
    db.add(unit)
    await db.flush()
    return unit


@router.patch("/deals/{deal_id}/units/{unit_id}", response_model=UnitView)
async def update_unit(
    deal_id: uuid.UUID,
    unit_id: uuid.UUID,
    payload: UnitWrite,
    current_user: User = Depends(require_courtier),
    db: AsyncSession = Depends(get_db),
):
    deal = await _load_owned_deal(deal_id, current_user, db)
    _assert_editable(deal)
    res = await db.execute(
        select(DealUnit).where(DealUnit.id == unit_id, DealUnit.deal_id == deal_id)
    )
    unit = res.scalar_one_or_none()
    if not unit:
        raise HTTPException(status_code=404, detail="Logement introuvable")
    for k, v in payload.model_dump().items():
        setattr(unit, k, v)
    await db.flush()
    return unit


@router.delete("/deals/{deal_id}/units/{unit_id}", status_code=204)
async def delete_unit(
    deal_id: uuid.UUID,
    unit_id: uuid.UUID,
    current_user: User = Depends(require_courtier),
    db: AsyncSession = Depends(get_db),
):
    deal = await _load_owned_deal(deal_id, current_user, db)
    _assert_editable(deal)
    res = await db.execute(
        select(DealUnit).where(DealUnit.id == unit_id, DealUnit.deal_id == deal_id)
    )
    unit = res.scalar_one_or_none()
    if not unit:
        raise HTTPException(status_code=404, detail="Logement introuvable")
    await db.delete(unit)
    await db.flush()
    return None


@router.post("/deals/{deal_id}/units/{unit_id}/photos")
async def upload_unit_photos(
    deal_id: uuid.UUID,
    unit_id: uuid.UUID,
    files: list[UploadFile] = File(...),
    current_user: User = Depends(require_courtier),
    db: AsyncSession = Depends(get_db),
):
    deal = await _load_owned_deal(deal_id, current_user, db)
    _assert_editable(deal)
    res = await db.execute(
        select(DealUnit).where(DealUnit.id == unit_id, DealUnit.deal_id == deal_id)
    )
    unit = res.scalar_one_or_none()
    if not unit:
        raise HTTPException(status_code=404, detail="Logement introuvable")

    existing = list(unit.photo_paths or [])
    if len(existing) + len(files) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 photos par logement")

    subfolder = f"deals/{deal_id}/units/{unit_id}"
    for f in files:
        if f.content_type not in ("image/jpeg", "image/png", "image/webp"):
            raise HTTPException(status_code=400, detail=f"Format non supporté : {f.content_type}")
        content = await f.read()
        path = save_uploaded_file(content, f.filename, subfolder)
        existing.append(path)
    unit.photo_paths = existing
    await db.flush()
    return {"photo_paths": storage_svc.to_signed_urls(existing)}


@router.post("/deals/{deal_id}/units/{unit_id}/lease")
async def upload_unit_lease(
    deal_id: uuid.UUID,
    unit_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(require_courtier),
    db: AsyncSession = Depends(get_db),
):
    deal = await _load_owned_deal(deal_id, current_user, db)
    _assert_editable(deal)
    res = await db.execute(
        select(DealUnit).where(DealUnit.id == unit_id, DealUnit.deal_id == deal_id)
    )
    unit = res.scalar_one_or_none()
    if not unit:
        raise HTTPException(status_code=404, detail="Logement introuvable")
    content = await file.read()
    path = save_uploaded_file(content, file.filename, f"deals/{deal_id}/units/{unit_id}/lease")
    unit.lease_path = path
    await db.flush()
    return {"lease_path": storage_svc.to_signed_url(path)}


# ── FAQ : courtier répond aux questions ──────────────────────────────────────

@router.get("/deals/{deal_id}/questions", response_model=list[QuestionView])
async def courtier_list_questions(
    deal_id: uuid.UUID,
    current_user: User = Depends(require_courtier),
    db: AsyncSession = Depends(get_db),
):
    await _load_owned_deal(deal_id, current_user, db)
    res = await db.execute(
        select(DealQuestion).where(DealQuestion.deal_id == deal_id).order_by(DealQuestion.asked_at.desc())
    )
    return res.scalars().all()


@router.post("/deals/{deal_id}/questions/{question_id}/answer", response_model=QuestionView)
async def answer_question(
    deal_id: uuid.UUID,
    question_id: uuid.UUID,
    payload: QuestionAnswer,
    current_user: User = Depends(require_courtier),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(block_in_impersonation),
):
    await _load_owned_deal(deal_id, current_user, db)
    res = await db.execute(
        select(DealQuestion).where(DealQuestion.id == question_id, DealQuestion.deal_id == deal_id)
    )
    q = res.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="Question introuvable")
    q.answer = payload.answer
    q.answered_by = current_user.id
    q.answered_at = datetime.now(timezone.utc)
    await db.flush()
    return q


# ── Relancer une enchère terminée sans gagnant (sprint final item 4) ─────────

@router.post("/deals/{deal_id}/restart-round")
async def restart_round(
    deal_id: uuid.UUID,
    current_user: User = Depends(require_courtier),
    db: AsyncSession = Depends(get_db),
):
    """
    Permet au courtier de relancer une nouvelle ronde après auction_ended.
    Le deal repasse en analyse → admin doit re-cliquer GO pour republier.
    """
    deal = await _load_owned_deal(deal_id, current_user, db)
    if deal.status != DealStatus.auction_ended:
        raise HTTPException(
            status_code=400,
            detail="Seules les enchères terminées sans gagnant peuvent être relancées.",
        )
    deal.status = DealStatus.analyse
    # On efface les anciennes dates pour éviter la confusion ; admin re-fixera bid_close_at au verdict
    deal.bid_open_at = None
    deal.bid_close_at = None
    await db.flush()
    return {"status": "analyse", "message": "Deal soumis à nouvelle analyse admin"}
