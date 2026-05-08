import uuid
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Annotated
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import get_settings
from app.database import get_db
from app.models.user import User, UserRole

settings = get_settings()
bearer_scheme = HTTPBearer()

# TTL spécifique impersonation — court pour limiter le blast radius (60 min)
IMPERSONATION_TTL_MINUTES = 60


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(
    user_id: uuid.UUID,
    role: str,
    *,
    real_user_id: uuid.UUID | None = None,
    real_role: str | None = None,
    ttl_minutes: int | None = None,
) -> str:
    """Émet un JWT.

    Mode normal : `sub`=user, `role`=role, pas de `real_*`.
    Mode impersonation (admin) : `sub`=cible impersonnée, `role`=rôle cible,
    `real_sub`=admin id, `real_role`='admin', `is_impersonating`=True. TTL court.
    """
    is_impersonating = (
        real_user_id is not None and real_user_id != user_id
    )
    ttl = ttl_minutes or (
        IMPERSONATION_TTL_MINUTES if is_impersonating
        else settings.access_token_expire_minutes
    )
    expire = datetime.now(timezone.utc) + timedelta(minutes=ttl)
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": expire,
    }
    if is_impersonating:
        payload["real_sub"] = str(real_user_id)
        payload["real_role"] = real_role
        payload["is_impersonating"] = True
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def _decode_token_payload(credentials: HTTPAuthorizationCredentials) -> dict:
    try:
        return jwt.decode(
            credentials.credentials,
            settings.secret_key,
            algorithms=[settings.algorithm],
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expiré",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_token_payload(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
) -> dict:
    """Dépendance utilitaire — retourne les claims JWT bruts (auth requise)."""
    return _decode_token_payload(credentials)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Retourne l'utilisateur EFFECTIF (= impersonné si en mode impersonation,
    sinon l'utilisateur du token). Toutes les permissions courantes (rôle,
    ownership) sont évaluées contre cet utilisateur effectif — c'est la base
    qui permet à l'admin d'« être » un acheteur/courtier le temps de la session.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token invalide ou expiré",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = _decode_token_payload(credentials)
    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


async def get_real_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Retourne l'utilisateur RÉEL (admin) si en mode impersonation, sinon
    l'utilisateur du token. Utile pour l'audit log : on garde la trace de
    l'admin même quand il agit comme un autre user.
    """
    payload = _decode_token_payload(credentials)
    real_id = payload.get("real_sub") or payload.get("sub")
    if not real_id:
        raise HTTPException(401, "Token invalide ou expiré")
    res = await db.execute(select(User).where(User.id == uuid.UUID(real_id)))
    user = res.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(401, "Utilisateur introuvable")
    return user


def is_impersonating(payload: dict) -> bool:
    return bool(payload.get("is_impersonating"))


def block_in_impersonation(
    payload: Annotated[dict, Depends(get_token_payload)],
) -> None:
    """Dépendance qui bloque les actions destructives/engageantes pendant
    l'impersonation. À appliquer aux endpoints qui :
      - signent un document légal (NDA, engagement, PA)
      - placent un bid au nom d'un user
      - soumettent un deal
      - envoient un email/SMS à un tiers
      - touchent à un Stripe customer
    """
    if is_impersonating(payload):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Action non disponible en mode visualisation",
        )


def require_role(*roles: UserRole):
    async def _check(current_user: Annotated[User, Depends(get_current_user)]) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Accès refusé",
            )
        return current_user
    return _check


require_admin = require_role(UserRole.admin)
require_courtier = require_role(UserRole.courtier)
require_acheteur = require_role(UserRole.acheteur)
require_authenticated = require_role(UserRole.admin, UserRole.courtier, UserRole.acheteur)
