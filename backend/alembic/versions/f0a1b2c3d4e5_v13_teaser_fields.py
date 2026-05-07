"""v13 teaser : tax_roll_date + teaser_photo_paths

Revision ID: f0a1b2c3d4e5
Revises: e9f0a1b2c3d4
Create Date: 2026-05-08 09:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f0a1b2c3d4e5'
down_revision: Union[str, None] = 'e9f0a1b2c3d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _add_column_if_missing(table: str, column: sa.Column):
    bind = op.get_bind()
    exists = bind.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = :t AND column_name = :c"
    ), {"t": table, "c": column.name}).scalar()
    if not exists:
        op.add_column(table, column)


def upgrade() -> None:
    # Date d'évaluation au rôle foncier
    _add_column_if_missing('deals', sa.Column('tax_roll_date', sa.Date(), nullable=True))
    # Liste des paths photos teaser watermarquées (jusqu'à 3 — sprint v13 item 5)
    _add_column_if_missing('deals', sa.Column('teaser_photo_paths', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.execute("ALTER TABLE deals DROP COLUMN IF EXISTS teaser_photo_paths")
    op.execute("ALTER TABLE deals DROP COLUMN IF EXISTS tax_roll_date")
