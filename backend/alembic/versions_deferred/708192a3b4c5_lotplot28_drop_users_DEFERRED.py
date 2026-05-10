"""LOTPLOT 28 Phase 6 — DROP public.users (à exécuter APRÈS validation)

⚠️  NE PAS APPLIQUER AVANT 24-48h de validation en production.
À ce stade :
  - auth.users contient tous les comptes (migrés via le script)
  - public.profiles contient toutes les données métier
  - Toutes les FK ont basculé vers profiles
  - Le backend FastAPI vérifie les JWT Supabase et ne touche plus à
    public.users
  - Le frontend utilise supabase-js pour login/signup

Pour appliquer après validation :
  alembic upgrade 708192a3b4c5

Si problème en cours de validation : reste sur la révision précédente
(6f708192a3b4) qui conserve public.users en mode lecture seule mais
n'est plus référencé par aucune FK active.

Revision ID: 708192a3b4c5
Revises: 6f708192a3b4
Create Date: 2026-05-10 19:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '708192a3b4c5'
down_revision: Union[str, None] = '6f708192a3b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(name: str) -> bool:
    bind = op.get_bind()
    return bool(bind.execute(sa.text(
        "SELECT 1 FROM information_schema.tables "
        "WHERE table_schema = 'public' AND table_name = :n"
    ), {"n": name}).scalar())


def upgrade() -> None:
    if _table_exists('users'):
        op.execute('DROP TABLE public.users CASCADE')


def downgrade() -> None:
    # Pas de downgrade automatique — la donnée a été déplacée vers
    # auth.users + public.profiles. Si rollback nécessaire, restaurer
    # depuis un dump pré-migration.
    raise NotImplementedError(
        "Pas de downgrade automatique. Si besoin de restaurer public.users, "
        "restaurer depuis un dump SQL pré-LOTPLOT 28."
    )
