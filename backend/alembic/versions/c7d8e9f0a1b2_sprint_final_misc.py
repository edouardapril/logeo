"""sprint final: auction_ended status + tos fields

Revision ID: c7d8e9f0a1b2
Revises: b6c7d8e9f0a1
Create Date: 2026-05-07 11:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c7d8e9f0a1b2'
down_revision: Union[str, None] = 'b6c7d8e9f0a1'
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
    # Item 9 — T&C registration : audit trail
    _add_column_if_missing('users', sa.Column('tos_accepted_at', sa.DateTime(timezone=True), nullable=True))
    _add_column_if_missing('users', sa.Column('tos_accepted_ip', sa.String(length=64), nullable=True))
    _add_column_if_missing('users', sa.Column('tos_accepted_version', sa.String(length=20), nullable=True))

    # Item 4 — Deal auction_ended status (ajout de valeur enum, hors transaction)
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE dealstatus ADD VALUE IF NOT EXISTS 'auction_ended'")


def downgrade() -> None:
    # Postgres ne supporte pas DROP VALUE → on laisse 'auction_ended'
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS tos_accepted_version")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS tos_accepted_ip")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS tos_accepted_at")
