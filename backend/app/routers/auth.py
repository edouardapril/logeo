import logging
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
)
from app.services import email as email_service

log = logging.getLogger("logeo.auth")

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


async def _issue_verification(user: User) -> bool:
    """Génère le token, met à jour le user (en mémoire) et envoie l'email.

    Retourne True si l'email a été accepté par Resend, False sinon.
    On ne lève PAS d'exception même en cas d'échec — sinon une panne Resend
    bloque toutes les inscriptions. Mais on log loud (visible Railway logs)
    et on remonte le booléen au caller pour qu'il puisse l'exposer dans la
    réponse → le frontend affiche un toast distinct si l'email n'est pas parti.
    """
    token, exp = _new_email_verify_token()
    user.email_verified = False
    user.email_verify_token = token
    user.email_verify_token_exp = exp
    try:
        sent = await email_service.send_email_verification(user, token)
    except Exception as e:
        log.error(
            "[REGISTER] envoi email vérification failed user=%s err=%s",
            user.email, e, exc_info=True,
        )
        sent = False
    if not sent:
        log.warning(
            "[REGISTER] email vérification NON ENVOYÉ user=%s — vérifier "
            "RESEND_API_KEY + domaine vérifié sur Resend dashboard",
            user.email,
        )
    return sent


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
    sent = await _issue_verification(user)
    db.add(user)
    await db.flush()
    return {**UserPublic.model_validate(user).model_dump(), "email_verification_sent": sent}


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
    sent = await _issue_verification(user)
    db.add(user)
    await db.flush()
    return {**UserPublic.model_validate(user).model_dump(), "email_verification_sent": sent}


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
):
    """Retourne l'utilisateur courant. Format conservé pour compat frontend
    (champs `is_impersonating` et `real_user` toujours retournés mais figés
    après retrait de l'impersonation en LOTPLOT 17)."""
    return {
        "user": {
            "id": str(current_user.id),
            "email": current_user.email,
            "full_name": current_user.full_name,
            "role": str(current_user.role),
        },
        "is_impersonating": False,
        "real_user": None,
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
    """Renvoie l'email de confirmation. Réponse 200 même si l'email n'existe pas (anti-énumération).

    Le booléen `sent` reflète l'état réel côté Resend (logué). Le frontend
    affiche un toast spécifique si le service email est en panne.
    """
    res = await db.execute(select(User).where(User.email == email))
    user = res.scalar_one_or_none()
    sent = False
    if user and not user.email_verified:
        token, exp = _new_email_verify_token()
        user.email_verify_token = token
        user.email_verify_token_exp = exp
        try:
            sent = await email_service.send_email_verification(user, token)
        except Exception as e:
            log.error("[RESEND] failed user=%s err=%s", email, e, exc_info=True)
            sent = False
        await db.flush()
    return {"sent": sent}
