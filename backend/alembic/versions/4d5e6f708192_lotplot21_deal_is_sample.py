"""LOTPLOT 21 — flag is_sample sur les deals

Ajoute `deals.is_sample` (Boolean, default False, indexé). Un deal flagué
`is_sample=true` est consultable publiquement via /api/v1/public/sample-deal
sans authentification, mais il est exclu de tous les autres endpoints
publics/marketplace/admin par défaut. Permet aux prospects de visualiser
l'expérience sans créer de compte.

Index utile pour deux raisons :
  1) Toutes les queries publiques exclues (`is_sample = false` filter)
     → l'index accélère la branche `is_sample = true` (très rare, 1 row).
  2) Le seed script (`scripts/seed_sample_deal.py`) lookup par
     `is_sample = true` pour idempotence.

Idempotente. Reversible (downgrade drop la colonne et l'index).

Revision ID: 4d5e6f708192
Revises: 3c4d5e6f7081
Create Date: 2026-05-10 14:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '4d5e6f708192'
down_revision: Union[str, None] = '3c4d5e6f7081'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    return bool(bind.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = :t AND column_name = :c"
    ), {"t": table, "c": column}).scalar())


def _index_exists(name: str) -> bool:
    bind = op.get_bind()
    return bool(bind.execute(sa.text(
        "SELECT 1 FROM pg_indexes WHERE indexname = :n"
    ), {"n": name}).scalar())


def upgrade() -> None:
    if not _column_exists('deals', 'is_sample'):
        op.add_column(
            'deals',
            sa.Column(
                'is_sample',
                sa.Boolean(),
                nullable=False,
                server_default=sa.text('false'),
            ),
        )
    if not _index_exists('ix_deals_is_sample'):
        op.create_index('ix_deals_is_sample', 'deals', ['is_sample'])


def downgrade() -> None:
    if _index_exists('ix_deals_is_sample'):
        op.drop_index('ix_deals_is_sample', table_name='deals')
    if _column_exists('deals', 'is_sample'):
        op.drop_column('deals', 'is_sample')
