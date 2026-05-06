"""sprint a full sheet — units, questions, deal financials, bid disclaimer

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-05-06 17:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd2e3f4a5b6c7'
down_revision: Union[str, None] = 'c1d2e3f4a5b6'
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
    # ── Deal : financials + work history + materials + visit ──
    new_deal_cols = [
        sa.Column('net_revenue', sa.Integer(), nullable=True),
        sa.Column('expenses', sa.JSON(), nullable=True),
        sa.Column('revenue_history', sa.JSON(), nullable=True),
        sa.Column('municipal_evaluation', sa.Integer(), nullable=True),
        sa.Column('zoning', sa.String(length=100), nullable=True),
        sa.Column('easements', sa.Text(), nullable=True),
        sa.Column('work_history', sa.JSON(), nullable=True),
        sa.Column('material_disclosures', sa.JSON(), nullable=True),
        sa.Column('virtual_tour_url', sa.String(length=500), nullable=True),
        sa.Column('inspection_report_path', sa.String(length=500), nullable=True),
        sa.Column('cert_localisation_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('visit_notes', sa.Text(), nullable=True),
    ]
    for col in new_deal_cols:
        _add_column_if_missing('deals', col)

    # ── Bid : disclaimer audit ──
    _add_column_if_missing('bids', sa.Column('disclaimer_signed_at', sa.DateTime(timezone=True), nullable=True))
    _add_column_if_missing('bids', sa.Column('disclaimer_ip', sa.String(length=64), nullable=True))
    _add_column_if_missing('bids', sa.Column('disclaimer_user_agent', sa.String(length=500), nullable=True))

    # ── Table deal_units ──
    if not _table_exists('deal_units'):
        op.create_table(
            'deal_units',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('deal_id', sa.UUID(), nullable=False),
            sa.Column('label', sa.String(length=80), nullable=False),
            sa.Column('unit_type', sa.String(length=20), nullable=True),
            sa.Column('area_sqft', sa.Integer(), nullable=True),
            sa.Column('current_rent', sa.Integer(), nullable=True),
            sa.Column('market_rent', sa.Integer(), nullable=True),
            sa.Column('lease_end', sa.DateTime(timezone=True), nullable=True),
            sa.Column('occupancy_status', sa.String(length=20), nullable=True),
            sa.Column('photo_paths', sa.JSON(), nullable=True),
            sa.Column('lease_path', sa.String(length=500), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
            sa.ForeignKeyConstraint(['deal_id'], ['deals.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_deal_units_deal_id', 'deal_units', ['deal_id'])

    # ── Table deal_questions ──
    if not _table_exists('deal_questions'):
        op.create_table(
            'deal_questions',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('deal_id', sa.UUID(), nullable=False),
            sa.Column('asker_id', sa.UUID(), nullable=False),
            sa.Column('question', sa.Text(), nullable=False),
            sa.Column('answer', sa.Text(), nullable=True),
            sa.Column('answered_by', sa.UUID(), nullable=True),
            sa.Column('asked_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
            sa.Column('answered_at', sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(['deal_id'], ['deals.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['asker_id'], ['users.id']),
            sa.ForeignKeyConstraint(['answered_by'], ['users.id']),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_deal_questions_deal_id', 'deal_questions', ['deal_id'])


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_deal_questions_deal_id")
    op.execute("DROP TABLE IF EXISTS deal_questions")
    op.execute("DROP INDEX IF EXISTS ix_deal_units_deal_id")
    op.execute("DROP TABLE IF EXISTS deal_units")
    for col in ['disclaimer_user_agent', 'disclaimer_ip', 'disclaimer_signed_at']:
        op.execute(f"ALTER TABLE bids DROP COLUMN IF EXISTS {col}")
    for col in [
        'visit_notes', 'cert_localisation_date', 'inspection_report_path',
        'virtual_tour_url', 'material_disclosures', 'work_history',
        'easements', 'zoning', 'municipal_evaluation', 'revenue_history',
        'expenses', 'net_revenue',
    ]:
        op.execute(f"ALTER TABLE deals DROP COLUMN IF EXISTS {col}")
