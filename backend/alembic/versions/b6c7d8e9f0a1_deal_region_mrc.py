"""deal: region + mrc

Revision ID: b6c7d8e9f0a1
Revises: a5b6c7d8e9f0
Create Date: 2026-05-07 09:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b6c7d8e9f0a1'
down_revision: Union[str, None] = 'a5b6c7d8e9f0'
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
    _add_column_if_missing('deals', sa.Column('region', sa.String(length=80), nullable=True))
    _add_column_if_missing('deals', sa.Column('mrc', sa.String(length=80), nullable=True))


def downgrade() -> None:
    op.execute("ALTER TABLE deals DROP COLUMN IF EXISTS mrc")
    op.execute("ALTER TABLE deals DROP COLUMN IF EXISTS region")
