import secrets
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import get_settings
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import (
    UserRegisterCourtier, UserRegisterAcheteur,
    UserLogin, TokenResponse, UserPublic,
)
from app.services.auth import (
    hash_password, verify_password, create_access_token, get_current_user,
    get_token_payload,
)
from app.services import email as email_service

settings = get_settings()
router = APIRouter(prefix="/auth", tags=["auth"])

TOS_VERSION = "v1-2026-05"
EMAIL_VERIFY_TOKEN_TTL_HOURS = 24


def _capture_tos_audit(request: Request) -> dict:
    return {
        "tos_accepted_at": datetime.now(timezone.utc),
        "tos_accepted_ip": request.client.host if request.client else None,
        "tos_accepted_version": TOS_VERSION,
    }


def _new_email_verify_token() -> tuple[str, datetime]:
    return (
        secrets.token_urlsafe(32),
        datetime.now(timezone.utc) + timedelta(hours=EMAIL_VERIFY_TOKEN_TTL_HOURS),
    )


async def _issue_verification(user: User):
    """Génère le token, met à jour le user (en mémoire) et envoie l'email."""
    token, exp = _new_email_verify_token()
    user.email_verified = False
    user.email_verify_token = token
    user.email_verify_token_exp = exp
    try:
        await email_service.send_email_verification(user, token)
    except Exception:
        # Ne bloque pas la création du compte si l'email échoue ; admin peut renvoyer
        pass


@router.post("/register/courtier", response_model=UserPublic, status_code=201)
async def register_courtier(
    payload: UserRegisterCourtier,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    if not (payload.tos_cgu and payload.tos_privacy and payload.tos_canadian_resident):
        raise HTTPException(
            status_code=400,
            detail="Vous devez accepter les CGU, la politique de confidentialité et confirmer votre résidence canadienne.",
        )

    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email déjà utilisé")

    audit = _capture_tos_audit(request)
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        phone=payload.phone,
        role=UserRole.courtier,
        oaciq_number=payload.oaciq_number,
        agency_name=payload.agency_name,
        **audit,
    )
    await _issue_verification(user)
    db.add(user)
    await db.flush()
    return user


@router.post("/register/acheteur", response_model=UserPublic, status_code=201)
async def register_acheteur(
    payload: UserRegisterAcheteur,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    if not (
        payload.tos_cgu and payload.tos_privacy
        and payload.tos_canadian_resident and payload.tos_qualified_investor
    ):
        raise HTTPException(
            status_code=400,
            detail="Vous devez accepter les 4 conditions (CGU, confidentialité, résidence canadienne, investisseur qualifié).",
        )

    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email déjà utilisé")

    audit = _capture_tos_audit(request)
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        phone=payload.phone,
        role=UserRole.acheteur,
        is_qualified=False,
        **audit,
    )
    await _issue_verification(user)
    db.add(user)
    await db.flush()
    return user


@router.post("/login", response_model=TokenResponse)
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Compte désactivé")
    if not user.email_verified:
        raise HTTPException(
            status_code=403,
            detail="Email non confirmé. Vérifiez votre boîte mail ou demandez un nouveau lien.",
        )

    token = create_access_token(user.id, user.role)
    return TokenResponse(access_token=token, role=user.role, user_id=user.id)


@router.get("/me", response_model=UserPublic)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/me/session")
async def me_session(
    current_user: User = Depends(get_current_user),
    token_payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    """Retourne l'utilisateur effectif + état impersonation. Utilisé par le
    frontend pour rendre le bandeau « Mode visualisation » et le dropdown
    de sortie. Le client peut continuer à appeler `/me` pour le user simple.
    """
    is_imp = bool(token_payload.get("is_impersonating"))
    real = None
    if is_imp:
        real_id = token_payload.get("real_sub")
        if real_id:
            r = await db.execute(select(User).where(User.id == uuid.UUID(real_id)))
            real_user = r.scalar_one_or_none()
            if real_user:
                real = {
                    "id": str(real_user.id),
                    "email": real_user.email,
                    "full_name": real_user.full_name,
                    "role": str(real_user.role),
                }
    return {
        "user": {
            "id": str(current_user.id),
            "email": current_user.email,
            "full_name": current_user.full_name,
            "role": str(current_user.role),
        },
        "is_impersonating": is_imp,
        "real_user": real,
    }


# ── Email verification (sprint final item 10) ────────────────────────────────

@router.post("/verify-email")
async def verify_email(
    token: str = Query(..., min_length=10),
    db: AsyncSession = Depends(get_db),
):
    """Confirme l'email depuis le lien reçu. Retourne 200 OK si succès."""
    res = await db.execute(select(User).where(User.email_verify_token == token))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Lien invalide ou déjà utilisé.")
    if user.email_verify_token_exp and user.email_verify_token_exp < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Lien expiré. Demandez un nouveau lien.")

    user.email_verified = True
    user.email_verify_token = None
    user.email_verify_token_exp = None
    await db.flush()
    return {"verified": True, "email": user.email}


@router.post("/resend-verification")
async def resend_verification(
    email: str = Query(..., min_length=3),
    db: AsyncSession = Depends(get_db),
):
    """Renvoie l'email de confirmation. Réponse 200 même si l'email n'existe pas (anti-énumération)."""
    res = await db.execute(select(User).where(User.email == email))
    user = res.scalar_one_or_none()
    if user and not user.email_verified:
        token, exp = _new_email_verify_token()
        user.email_verify_token = token
        user.email_verify_token_exp = exp
        try:
            await email_service.send_email_verification(user, token)
        except Exception:
            pass
        await db.flush()
    return {"sent": True}
