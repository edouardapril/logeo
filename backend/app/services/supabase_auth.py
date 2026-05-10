"""LOTPLOT 28 Phase 3 — Vérification JWT Supabase (HS256).

Remplace l'ancien `services/auth.py` qui générait des JWT custom. Désormais
Supabase est la seule source d'auth — le backend ne fait que VÉRIFIER
les tokens et lire le profile correspondant.

Format des tokens Supabase :
  - Header : HS256
  - Signé avec le SUPABASE_JWT_SECRET (Settings → API → JWT Secret)
  - Claims : sub (user_id UUID), email, role ('authenticated'), aud, exp, iat

Le rôle métier (admin/courtier/acheteur/regional_partner) n'est PAS dans
le JWT — il est dans public.profiles.role. On le lookup à chaque requête.
Cache profile possible si bottleneck (1 SELECT par requête).
"""
import uuid
from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import get_settings
from app.database import get_db
from app.models.profile import Profile, UserRole

settings = get_settings()
bearer_scheme = HTTPBearer()

# Supabase utilise HS256. L'audience par défaut est "authenticated".
_JWT_ALG = "HS256"
_JWT_AUD = "authenticated"


def _decode_supabase_jwt(token: str) -> dict:
    """Décode et vérifie un JWT Supabase. Lève 401 si invalide/expiré."""
    if not settings.supabase_jwt_secret:
        # Garde-fou : si la config est cassée en prod, mieux vaut un 503
        # explicite qu'un 401 ambigu.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SUPABASE_JWT_SECRET non configurée côté backend.",
        )
    try:
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=[_JWT_ALG],
            audience=_JWT_AUD,
        )
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token Supabase invalide ou expiré : {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Profile:
    """Dépendance qui retourne le `Profile` (public.profiles) correspondant
    au JWT Supabase. Lève 401 si :
      - token manquant / invalide / expiré
      - sub absent
      - profile soft-deleted ou désactivé
      - profile pas encore créé (race entre auth.users et trigger)
    """
    payload = _decode_supabase_jwt(credentials.credentials)
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Token sans sub claim")

    try:
        user_uuid = uuid.UUID(sub)
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="sub claim invalide")

    res = await db.execute(select(Profile).where(Profile.id == user_uuid))
    profile = res.scalar_one_or_none()
    if profile is None:
        # Le trigger handle_new_user crée le profile au signup ; si on tombe
        # ici, c'est une desync (rare). Mieux vaut un 401 qu'une exception.
        raise HTTPException(status_code=401, detail="Profile introuvable")
    if not profile.is_active or profile.deleted_at is not None:
        raise HTTPException(status_code=401, detail="Compte désactivé ou supprimé")
    return profile


def require_role(*roles: UserRole):
    async def _check(
        current_user: Annotated[Profile, Depends(get_current_user)],
    ) -> Profile:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Accès refusé",
            )
        return current_user
    return _check


# Aliases pré-construits — mêmes noms que dans l'ancien services/auth.py
# pour ne casser aucun router (drop-in replacement).
require_admin = require_role(UserRole.admin)
require_courtier = require_role(UserRole.courtier)
require_acheteur = require_role(UserRole.acheteur)
require_acheteur_or_admin = require_role(UserRole.acheteur, UserRole.admin)
require_courtier_or_admin = require_role(UserRole.courtier, UserRole.admin)
require_authenticated = require_role(
    UserRole.admin, UserRole.courtier, UserRole.acheteur, UserRole.regional_partner,
)
