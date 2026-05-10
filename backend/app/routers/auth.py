"""LOTPLOT 28 Phase 3 — Auth router refactored.

Tous les endpoints de credentials (login, register, reset, verify-email,
resend) sont retirés — Supabase Auth les remplace côté frontend via
supabase-js (signInWithPassword, signUp, resetPasswordForEmail).

Endpoints conservés :
  - GET /auth/me           : profile complet de l'utilisateur courant
  - GET /auth/me/session   : compat avec l'ancien shape (`is_impersonating`
                             figé à false depuis LOTPLOT 17)

Tout le reste retourne 410 Gone (avec message redirigeant vers supabase-js)
pour aider à détecter les call-sites résiduels côté frontend pendant la
transition.
"""
from fastapi import APIRouter, Depends, HTTPException

from app.models.profile import Profile
from app.schemas.user import UserPublic
from app.services.auth import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=UserPublic)
async def me(current_user: Profile = Depends(get_current_user)):
    """Profile complet du user actuellement authentifié (JWT Supabase)."""
    return current_user


@router.get("/me/session")
async def me_session(current_user: Profile = Depends(get_current_user)):
    """Compat shape (LOTPLOT 17 a figé is_impersonating=False)."""
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


# ── Endpoints credentials retirés ─────────────────────────────────────────────
# Tous renvoient 410 avec message pour aider à détecter les call-sites
# résiduels côté frontend.

_GONE_MSG = (
    "LOTPLOT 28 : ce endpoint a été retiré. "
    "Supabase Auth gère désormais ce flow côté frontend via @supabase/supabase-js."
)


@router.post("/register/courtier")
async def register_courtier_gone():
    raise HTTPException(
        status_code=410,
        detail=_GONE_MSG + " Utiliser supabase.auth.signUp({ email, password, options: { data: { role: 'courtier', ... } } })",
    )


@router.post("/register/acheteur")
async def register_acheteur_gone():
    raise HTTPException(
        status_code=410,
        detail=_GONE_MSG + " Utiliser supabase.auth.signUp({ email, password, options: { data: { role: 'acheteur', ... } } })",
    )


@router.post("/login")
async def login_gone():
    raise HTTPException(
        status_code=410,
        detail=_GONE_MSG + " Utiliser supabase.auth.signInWithPassword({ email, password })",
    )


@router.post("/verify-email")
async def verify_email_gone():
    raise HTTPException(
        status_code=410,
        detail=_GONE_MSG + " Supabase gère la confirmation email automatiquement.",
    )


@router.post("/resend-verification")
async def resend_verification_gone():
    raise HTTPException(
        status_code=410,
        detail=_GONE_MSG + " Utiliser supabase.auth.resend({ type: 'signup', email })",
    )
