"""deal: year_built + total_area_sqft

Revision ID: e9f0a1b2c3d4
Revises: d8e9f0a1b2c3
Create Date: 2026-05-07 16:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e9f0a1b2c3d4'
down_revision: Union[str, None] = 'd8e9f0a1b2c3'
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
    _add_column_if_missing('deals', sa.Column('year_built', sa.Integer(), nullable=True))
    _add_column_if_missing('deals', sa.Column('total_area_sqft', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.execute("ALTER TABLE deals DROP COLUMN IF EXISTS total_area_sqft")
    op.execute("ALTER TABLE deals DROP COLUMN IF EXISTS year_built")
