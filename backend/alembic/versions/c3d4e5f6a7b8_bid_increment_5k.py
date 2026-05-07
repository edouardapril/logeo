"""bid increment 10k → 5k

Décision produit : l'incrément d'enchère est fixe à 5 000 $ CAD pour tous
les deals, peu importe la taille. La colonne deals.min_bid_increment est
conservée (Option A : on garde le champ mais on aligne la valeur), au cas
où on voudrait revenir à un incrément paramétrable. Mise à jour
inconditionnelle des deals existants — règle produit non opt-in.

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-05-07 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
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
    if not _column_exists('deals', 'min_bid_increment'):
        return  # colonne absente : la migration de création n'a pas tourné, rien à faire

    # 1) Default DB pour les nouvelles rows
    op.execute("ALTER TABLE deals ALTER COLUMN min_bid_increment SET DEFAULT 5000")

    # 2) Aligne toutes les rows existantes (règle produit "5k toujours")
    op.execute("UPDATE deals SET min_bid_increment = 5000")


# ── Downgrade ───────────────────────────────────────────────────────────────

def downgrade() -> None:
    if not _column_exists('deals', 'min_bid_increment'):
        return

    op.execute("ALTER TABLE deals ALTER COLUMN min_bid_increment SET DEFAULT 10000")
    op.execute("UPDATE deals SET min_bid_increment = 10000")
