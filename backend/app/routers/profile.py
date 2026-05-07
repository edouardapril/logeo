"""Endpoints communs au profil utilisateur — accessibles à tout user authentifié."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import get_settings
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.profile import ProfileUpdate, PasswordChange, NotificationPrefs
from app.schemas.user import UserPublic
from app.schemas.convention import ConventionSignRequest, ConventionStatus
from app.services.auth import get_current_user, hash_password, verify_password
from app.services.pdf import save_uploaded_file

settings = get_settings()

router = APIRouter(prefix="/me", tags=["profile"])

ALLOWED_PHOTO_MIMES = {"image/jpeg", "image/png", "image/webp"}


@router.get("", response_model=UserPublic)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("", response_model=UserPublic)
async def update_profile(
    payload: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if payload.email and payload.email != current_user.email:
        existing = await db.execute(select(User).where(User.email == payload.email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email déjà utilisé")
        current_user.email = payload.email
    if payload.full_name is not None:
        current_user.full_name = payload.full_name
    if payload.phone is not None:
        current_user.phone = payload.phone
    if payload.oaciq_number is not None and current_user.role == UserRole.courtier:
        cleaned = (payload.oaciq_number or "").strip()
        if cleaned and not (cleaned.isdigit() and len(cleaned) == 8):
            raise HTTPException(status_code=400, detail="Numéro OACIQ invalide (8 chiffres requis)")
        current_user.oaciq_number = cleaned or None
    await db.flush()
    return current_user


@router.post("/password")
async def change_password(
    payload: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")
    current_user.hashed_password = hash_password(payload.new_password)
    await db.flush()
    return {"message": "Mot de passe mis à jour"}


@router.patch("/notifications", response_model=UserPublic)
async def update_notifications(
    payload: NotificationPrefs,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_user.email_notifications = payload.email_notifications
    await db.flush()
    return current_user


@router.post("/photo", response_model=UserPublic)
async def upload_profile_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if file.content_type not in ALLOWED_PHOTO_MIMES:
        raise HTTPException(status_code=400, detail="Format non supporté")
    content = await file.read()
    path = save_uploaded_file(
        content, file.filename, f"profile/{current_user.id}",
        kind="profiles", content_type=file.content_type,
    )
    current_user.profile_photo_path = path
    await db.flush()
    return current_user


@router.delete("/photo", response_model=UserPublic)
async def delete_profile_photo(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_user.profile_photo_path = None
    await db.flush()
    return current_user


# ── Convention courtier béton ────────────────────────────────────────────────

def _convention_signed_for_required_version(user: User) -> bool:
    return (
        user.role == UserRole.courtier
        and user.convention_signed_at is not None
        and user.convention_clauses_version == settings.courtier_convention_required_version
    )


@router.get("/convention/status", response_model=ConventionStatus)
async def convention_status(current_user: User = Depends(get_current_user)):
    return ConventionStatus(
        signed=_convention_signed_for_required_version(current_user),
        signed_at=current_user.convention_signed_at,
        version=current_user.convention_clauses_version,
        required_version=settings.courtier_convention_required_version,
        needs_resign=(
            current_user.role == UserRole.courtier
            and not _convention_signed_for_required_version(current_user)
        ),
    )


@router.post("/convention/sign", response_model=ConventionStatus)
async def sign_convention(
    payload: ConventionSignRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != UserRole.courtier:
        raise HTTPException(status_code=403, detail="Convention réservée aux courtiers")

    consents = (
        payload.consent_floor_price_binding,
        payload.consent_no_circumvention,
        payload.consent_data_accuracy,
        payload.consent_penalties,
    )
    if not all(consents):
        raise HTTPException(
            status_code=400,
            detail="Toutes les clauses doivent être acceptées pour signer la convention.",
        )

    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")

    current_user.convention_signed_at = datetime.now(timezone.utc)
    current_user.convention_signed_ip = ip
    current_user.convention_signed_user_agent = ua[:500] if ua else None
    current_user.convention_clauses_version = settings.courtier_convention_required_version
    await db.flush()

    return ConventionStatus(
        signed=True,
        signed_at=current_user.convention_signed_at,
        version=current_user.convention_clauses_version,
        required_version=settings.courtier_convention_required_version,
        needs_resign=False,
    )
