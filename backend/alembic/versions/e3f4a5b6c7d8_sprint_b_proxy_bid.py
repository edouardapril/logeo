"""sprint b proxy bid + teaser photo

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-05-06 18:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e3f4a5b6c7d8'
down_revision: Union[str, None] = 'd2e3f4a5b6c7'
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
    _add_column_if_missing('deals', sa.Column(
        'min_bid_increment', sa.Integer(), nullable=False, server_default='10000',
    ))
    _add_column_if_missing('deals', sa.Column('teaser_photo_path', sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.execute("ALTER TABLE deals DROP COLUMN IF EXISTS teaser_photo_path")
    op.execute("ALTER TABLE deals DROP COLUMN IF EXISTS min_bid_increment")
