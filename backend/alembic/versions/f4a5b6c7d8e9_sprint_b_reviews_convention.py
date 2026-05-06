"""sprint b reviews + enhanced convention

Revision ID: f4a5b6c7d8e9
Revises: e3f4a5b6c7d8
Create Date: 2026-05-06 19:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f4a5b6c7d8e9'
down_revision: Union[str, None] = 'e3f4a5b6c7d8'
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


def _table_exists(name: str) -> bool:
    bind = op.get_bind()
    return bool(bind.execute(sa.text(
        "SELECT 1 FROM information_schema.tables WHERE table_name = :t"
    ), {"t": name}).scalar())


def upgrade() -> None:
    # ── Convention courtier béton (audit IP + version)
    _add_column_if_missing('users', sa.Column('convention_signed_ip', sa.String(length=64), nullable=True))
    _add_column_if_missing('users', sa.Column('convention_signed_user_agent', sa.String(length=500), nullable=True))
    _add_column_if_missing('users', sa.Column('convention_clauses_version', sa.String(length=20), nullable=True))

    # ── Table deal_reviews
    if not _table_exists('deal_reviews'):
        op.create_table(
            'deal_reviews',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('deal_id', sa.UUID(), nullable=False),
            sa.Column('rater_id', sa.UUID(), nullable=False),
            sa.Column('ratee_id', sa.UUID(), nullable=False),
            sa.Column('rater_role', sa.String(length=20), nullable=False),  # 'courtier' | 'acheteur'
            sa.Column('rating', sa.Integer(), nullable=False),
            sa.Column('comment', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True),
                      nullable=False, server_default=sa.text('now()')),
            sa.ForeignKeyConstraint(['deal_id'], ['deals.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['rater_id'], ['users.id']),
            sa.ForeignKeyConstraint(['ratee_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('deal_id', 'rater_id', 'ratee_id', name='uq_review_per_direction'),
            sa.CheckConstraint('rating >= 1 AND rating <= 5', name='ck_rating_range'),
        )
        op.create_index('ix_deal_reviews_ratee', 'deal_reviews', ['ratee_id'])
        op.create_index('ix_deal_reviews_deal', 'deal_reviews', ['deal_id'])


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_deal_reviews_deal")
    op.execute("DROP INDEX IF EXISTS ix_deal_reviews_ratee")
    op.execute("DROP TABLE IF EXISTS deal_reviews")
    for col in ['convention_clauses_version', 'convention_signed_user_agent', 'convention_signed_ip']:
        op.execute(f"ALTER TABLE users DROP COLUMN IF EXISTS {col}")
