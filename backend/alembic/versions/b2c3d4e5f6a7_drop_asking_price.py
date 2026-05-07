"""drop asking_price — Phase 2 du refactor "deal"

Hard delete de la colonne deals.asking_price. Décision produit : on
n'expose plus le « prix demandé » nulle part (acheteur, admin, courtier),
seul le floor_price reste. Pas de récupération des données possibles en
downgrade — la colonne est recréée NULLABLE sans valeurs.

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-07 11:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ── Helpers idempotents (pattern existant : information_schema) ─────────────

def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    return bool(bind.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = :t AND column_name = :c"
    ), {"t": table, "c": column}).scalar())


# ── Upgrade ─────────────────────────────────────────────────────────────────

def upgrade() -> None:
    if _column_exists('deals', 'asking_price'):
        op.execute("ALTER TABLE deals DROP COLUMN asking_price")


# ── Downgrade ───────────────────────────────────────────────────────────────

def downgrade() -> None:
    # Recrée NULLABLE : on n'a aucune valeur à backfiller (data perdue).
    if not _column_exists('deals', 'asking_price'):
        op.execute("ALTER TABLE deals ADD COLUMN asking_price INTEGER NULL")
