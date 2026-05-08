"""deal: archived_at + index

Item 1 admin lot 2 — archivage / désarchivage / suppression de deals.
Ajoute uniquement la colonne `archived_at` (timestamptz nullable) sur `deals`
et un index pour les requêtes WHERE archived_at IS NULL / IS NOT NULL.

Pattern idempotent + reversible, aligné sur les migrations précédentes
(_column_exists, _index_exists).

Revision ID: f1a2b3c4d5e6
Revises: e5f6a7b8c9d0
Create Date: 2026-05-08 14:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
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
    if not _column_exists('deals', 'archived_at'):
        op.add_column('deals', sa.Column(
            'archived_at', sa.DateTime(timezone=True), nullable=True,
        ))

    if not _index_exists('ix_deals_archived_at'):
        op.create_index('ix_deals_archived_at', 'deals', ['archived_at'])


def downgrade() -> None:
    if _index_exists('ix_deals_archived_at'):
        op.drop_index('ix_deals_archived_at', table_name='deals')
    if _column_exists('deals', 'archived_at'):
        op.drop_column('deals', 'archived_at')
