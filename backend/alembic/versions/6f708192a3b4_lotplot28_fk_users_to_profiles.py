"""LOTPLOT 28 Phase 1 — Bascule des FK users → profiles

Toutes les tables qui référençaient public.users(id) doivent maintenant
référencer public.profiles(id). Sémantiquement équivalent puisqu'à la
fin du LOTPLOT 28 on aura : auth.users.id = profiles.id = ancien users.id.

Ordre d'exécution :
  - DOIT être appliquée APRÈS le script `migrate_users_to_supabase.py`
    (sinon les rows orphelines bloquent la création de FK).
  - DOIT être appliquée AVANT la drop de public.users (LOTPLOT 28
    Phase 6 — migration `drop_users_table.py`).

Tables impactées (FK vers users.id) :
  - bids.acheteur_id
  - deals.courtier_id
  - ndas.acheteur_id
  - payments.acheteur_id
  - deal_questions.acheteur_id
  - deal_reviews.rater_id, deal_reviews.ratee_id
  - regional_partner_profiles.user_id
  - user_sanctions.user_id, user_sanctions.created_by_id, user_sanctions.lifted_by_id
  - email_logs.recipient_id
  - profiles.recruited_by_id (auto-référence, déjà OK)

Idempotente : detect le nom de la constraint via information_schema.
Reversible : downgrade re-pointe vers public.users.

Revision ID: 6f708192a3b4
Revises: 5e6f708192a3
Create Date: 2026-05-10 18:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '6f708192a3b4'
down_revision: Union[str, None] = '5e6f708192a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Liste exhaustive (table, colonne) → FK à re-pointer vers profiles.id
FK_TARGETS = [
    ('bids', 'acheteur_id'),
    ('deals', 'courtier_id'),
    ('ndas', 'acheteur_id'),
    ('payments', 'acheteur_id'),
    ('deal_questions', 'acheteur_id'),
    ('deal_reviews', 'rater_id'),
    ('deal_reviews', 'ratee_id'),
    ('regional_partner_profiles', 'user_id'),
    ('user_sanctions', 'user_id'),
    ('user_sanctions', 'created_by_id'),
    ('user_sanctions', 'lifted_by_id'),
    ('email_logs', 'recipient_id'),
]


def _find_fk_name(table: str, column: str, refs_table: str) -> str | None:
    bind = op.get_bind()
    res = bind.execute(sa.text("""
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = :t
          AND kcu.column_name = :c
          AND ccu.table_name = :rt
    """), {"t": table, "c": column, "rt": refs_table})
    row = res.scalar_one_or_none()
    return row


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    return bool(bind.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_schema = 'public' AND table_name = :t AND column_name = :c"
    ), {"t": table, "c": column}).scalar())


def upgrade() -> None:
    for table, column in FK_TARGETS:
        if not _column_exists(table, column):
            continue  # table/colonne pas encore créée dans ce DB
        fk_name = _find_fk_name(table, column, 'users')
        if fk_name:
            op.execute(f'ALTER TABLE public.{table} DROP CONSTRAINT "{fk_name}"')
        new_name = f'{table}_{column}_fkey_profiles'
        # Ne pas écraser si déjà recréée (idempotence)
        if not _find_fk_name(table, column, 'profiles'):
            op.execute(
                f'ALTER TABLE public.{table} '
                f'ADD CONSTRAINT "{new_name}" '
                f'FOREIGN KEY ({column}) REFERENCES public.profiles(id)'
            )


def downgrade() -> None:
    for table, column in FK_TARGETS:
        if not _column_exists(table, column):
            continue
        fk_name = _find_fk_name(table, column, 'profiles')
        if fk_name:
            op.execute(f'ALTER TABLE public.{table} DROP CONSTRAINT "{fk_name}"')
        new_name = f'{table}_{column}_fkey'
        if not _find_fk_name(table, column, 'users'):
            op.execute(
                f'ALTER TABLE public.{table} '
                f'ADD CONSTRAINT "{new_name}" '
                f'FOREIGN KEY ({column}) REFERENCES public.users(id)'
            )
