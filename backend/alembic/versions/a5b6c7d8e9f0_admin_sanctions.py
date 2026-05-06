"""admin: user_sanctions table

Revision ID: a5b6c7d8e9f0
Revises: f4a5b6c7d8e9
Create Date: 2026-05-06 21:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a5b6c7d8e9f0'
down_revision: Union[str, None] = 'f4a5b6c7d8e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(name: str) -> bool:
    bind = op.get_bind()
    return bool(bind.execute(sa.text(
        "SELECT 1 FROM information_schema.tables WHERE table_name = :t"
    ), {"t": name}).scalar())


def upgrade() -> None:
    if not _table_exists('user_sanctions'):
        op.create_table(
            'user_sanctions',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('user_id', sa.UUID(), nullable=False),
            sa.Column('reason', sa.Text(), nullable=False),
            sa.Column('severity', sa.String(length=20), nullable=False, server_default='warning'),
            sa.Column('related_deal_id', sa.UUID(), nullable=True),
            sa.Column('deposit_kept_cad', sa.Integer(), nullable=True),
            sa.Column('created_by', sa.UUID(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True),
                      nullable=False, server_default=sa.text('now()')),
            sa.Column('lifted_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('lifted_by', sa.UUID(), nullable=True),
            sa.Column('lifted_reason', sa.Text(), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['users.id']),
            sa.ForeignKeyConstraint(['related_deal_id'], ['deals.id']),
            sa.ForeignKeyConstraint(['created_by'], ['users.id']),
            sa.ForeignKeyConstraint(['lifted_by'], ['users.id']),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_user_sanctions_user', 'user_sanctions', ['user_id'])


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_user_sanctions_user")
    op.execute("DROP TABLE IF EXISTS user_sanctions")
