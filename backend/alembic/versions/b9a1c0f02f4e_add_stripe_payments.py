"""add stripe payments

Revision ID: b9a1c0f02f4e
Revises: e4244e10d666
Create Date: 2026-05-06 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'b9a1c0f02f4e'
down_revision: Union[str, None] = 'e4244e10d666'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _add_column_if_missing(table: str, column: sa.Column):
    """Idempotent ADD COLUMN — silencieux si la colonne existe déjà."""
    bind = op.get_bind()
    exists = bind.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = :t AND column_name = :c"
    ), {"t": table, "c": column.name}).scalar()
    if not exists:
        op.add_column(table, column)


def upgrade() -> None:
    # ── Users : colonnes Stripe (idempotent)
    _add_column_if_missing('users', sa.Column('stripe_customer_id', sa.String(length=120), nullable=True))
    _add_column_if_missing('users', sa.Column('stripe_payment_method_id', sa.String(length=120), nullable=True))
    _add_column_if_missing('users', sa.Column('payment_method_brand', sa.String(length=40), nullable=True))
    _add_column_if_missing('users', sa.Column('payment_method_last4', sa.String(length=4), nullable=True))
    _add_column_if_missing('users', sa.Column('payment_method_exp_month', sa.Integer(), nullable=True))
    _add_column_if_missing('users', sa.Column('payment_method_exp_year', sa.Integer(), nullable=True))

    # ── Deals : échéances de paiement (idempotent)
    _add_column_if_missing('deals', sa.Column('deposit_retry_until', sa.DateTime(timezone=True), nullable=True))
    _add_column_if_missing('deals', sa.Column('due_diligence_deadline', sa.DateTime(timezone=True), nullable=True))
    _add_column_if_missing('deals', sa.Column('due_diligence_completed_at', sa.DateTime(timezone=True), nullable=True))

    # ── Enums (idempotent via DO/EXCEPTION) ; create_type=False côté table.
    op.execute("""
    DO $$ BEGIN
        CREATE TYPE paymenttype AS ENUM ('deposit', 'balance');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    """)
    op.execute("""
    DO $$ BEGIN
        CREATE TYPE paymentstate AS ENUM ('pending', 'requires_action', 'succeeded', 'failed', 'refunded');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    """)

    payment_type = postgresql.ENUM('deposit', 'balance', name='paymenttype', create_type=False)
    payment_state = postgresql.ENUM(
        'pending', 'requires_action', 'succeeded', 'failed', 'refunded',
        name='paymentstate', create_type=False,
    )

    # ── Table payments (idempotent)
    bind = op.get_bind()
    has_payments = bind.execute(sa.text(
        "SELECT 1 FROM information_schema.tables WHERE table_name = 'payments'"
    )).scalar()
    if not has_payments:
        op.create_table(
            'payments',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('deal_id', sa.UUID(), nullable=False),
            sa.Column('bid_id', sa.UUID(), nullable=False),
            sa.Column('acheteur_id', sa.UUID(), nullable=False),
            sa.Column('type', payment_type, nullable=False),
            sa.Column('amount_cents', sa.Integer(), nullable=False),
            sa.Column('currency', sa.String(length=3), nullable=False, server_default='cad'),
            sa.Column('stripe_payment_intent_id', sa.String(length=120), nullable=True),
            sa.Column('state', payment_state, nullable=False, server_default='pending'),
            sa.Column('failure_code', sa.String(length=80), nullable=True),
            sa.Column('failure_message', sa.String(length=500), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('succeeded_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('failed_at', sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(['acheteur_id'], ['users.id']),
            sa.ForeignKeyConstraint(['bid_id'], ['bids.id']),
            sa.ForeignKeyConstraint(['deal_id'], ['deals.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('stripe_payment_intent_id'),
        )
        op.create_index('ix_payments_deal_id', 'payments', ['deal_id'])
        op.create_index('ix_payments_bid_id', 'payments', ['bid_id'])
        op.create_index('ix_payments_acheteur_id', 'payments', ['acheteur_id'])


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_payments_acheteur_id")
    op.execute("DROP INDEX IF EXISTS ix_payments_bid_id")
    op.execute("DROP INDEX IF EXISTS ix_payments_deal_id")
    op.execute("DROP TABLE IF EXISTS payments")
    op.execute("DROP TYPE IF EXISTS paymentstate")
    op.execute("DROP TYPE IF EXISTS paymenttype")

    for col in [
        'due_diligence_completed_at', 'due_diligence_deadline', 'deposit_retry_until',
    ]:
        op.execute(f"ALTER TABLE deals DROP COLUMN IF EXISTS {col}")

    for col in [
        'payment_method_exp_year', 'payment_method_exp_month', 'payment_method_last4',
        'payment_method_brand', 'stripe_payment_method_id', 'stripe_customer_id',
    ]:
        op.execute(f"ALTER TABLE users DROP COLUMN IF EXISTS {col}")
