"""LOTPLOT 28 — Module transitionnel.

Avant : génération + vérification de JWT custom + bcrypt password hashing
côté backend (hash_password, verify_password, create_access_token).

Après LOTPLOT 28 : Supabase gère TOUT le credentials flow. Le backend
ne fait plus que VÉRIFIER les JWT Supabase via `app/services/supabase_auth.py`.

Ce fichier ré-exporte les dépendances (`get_current_user`, `require_admin`,
etc.) pour ne pas casser les ~30 routers existants.

Les fonctions de manipulation de password (`hash_password`, `verify_password`,
`create_access_token`) sont retirées — leur usage doit lever une erreur
explicite pour signaler la migration. Les appels résiduels (registration,
login) doivent être supprimés au profit du frontend supabase-js.
"""
from app.services.supabase_auth import (
    get_current_user,
    require_role,
    require_admin,
    require_courtier,
    require_acheteur,
    require_acheteur_or_admin,
    require_courtier_or_admin,
    require_authenticated,
)

__all__ = [
    "get_current_user",
    "require_role",
    "require_admin",
    "require_courtier",
    "require_acheteur",
    "require_acheteur_or_admin",
    "require_courtier_or_admin",
    "require_authenticated",
]


# ── Garde-fous LOTPLOT 28 : ces fonctions n'existent plus ─────────────────────
# Tout code qui les appelle DOIT être migré vers supabase-js côté frontend.

def hash_password(*args, **kwargs):
    raise RuntimeError(
        "LOTPLOT 28 : hash_password retiré du backend. "
        "Supabase gère le hashing désormais. Si appelé, c'est un legacy."
    )


def verify_password(*args, **kwargs):
    raise RuntimeError(
        "LOTPLOT 28 : verify_password retiré du backend. "
        "Login via supabase.auth.signInWithPassword côté frontend."
    )


def create_access_token(*args, **kwargs):
    raise RuntimeError(
        "LOTPLOT 28 : create_access_token retiré du backend. "
        "Supabase émet les JWT lors du signInWithPassword."
    )
