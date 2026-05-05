import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.models.deal import Deal, DealStatus, PropertyType
from app.schemas.deal import DealSubmit, DealTeaser, DealListItem
from app.services.auth import require_courtier
from app.services.pdf import save_uploaded_file

router = APIRouter(prefix="/courtier", tags=["courtier"])


@router.get("/deals", response_model=list[DealListItem])
async def list_my_deals(
    current_user: User = Depends(require_courtier),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Deal).where(Deal.courtier_id == current_user.id).order_by(Deal.created_at.desc())
    )
    return result.scalars().all()


@router.get("/deals/{deal_id}", response_model=DealTeaser)
async def get_my_deal(
    deal_id: uuid.UUID,
    current_user: User = Depends(require_courtier),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Deal).where(Deal.id == deal_id, Deal.courtier_id == current_user.id)
    )
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal introuvable")
    return deal


@router.post("/deals", response_model=DealTeaser, status_code=201)
async def submit_deal(
    payload: DealSubmit,
    current_user: User = Depends(require_courtier),
    db: AsyncSession = Depends(get_db),
):
    deal = Deal(
        courtier_id=current_user.id,
        status=DealStatus.analyse,
        **payload.model_dump(),
    )
    db.add(deal)
    await db.flush()
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
    if deal.status not in (DealStatus.draft, DealStatus.analyse):
        raise HTTPException(status_code=400, detail="Documents ne peuvent être modifiés à ce stade")

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


@router.post("/deals/{deal_id}/pa")
async def upload_pa(
    deal_id: uuid.UUID,
    pa_file: UploadFile = File(...),
    current_user: User = Depends(require_courtier),
    db: AsyncSession = Depends(get_db),
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
