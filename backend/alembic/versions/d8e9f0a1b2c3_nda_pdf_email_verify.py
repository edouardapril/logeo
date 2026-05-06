"""sprint final: NDA pdf+consents + email verify

Revision ID: d8e9f0a1b2c3
Revises: c7d8e9f0a1b2
Create Date: 2026-05-07 14:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd8e9f0a1b2c3'
down_revision: Union[str, None] = 'c7d8e9f0a1b2'
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
    # Item 8 — NDA enrichi
    _add_column_if_missing('ndas', sa.Column('consents', sa.JSON(), nullable=True))
    _add_column_if_missing('ndas', sa.Column('pdf_path', sa.String(length=500), nullable=True))

    # Item 10 — email verification
    _add_column_if_missing('users', sa.Column(
        'email_verified', sa.Boolean(), nullable=False, server_default=sa.text('false'),
    ))
    _add_column_if_missing('users', sa.Column('email_verify_token', sa.String(length=120), nullable=True))
    _add_column_if_missing('users', sa.Column('email_verify_token_exp', sa.DateTime(timezone=True), nullable=True))

    # Grandfather : les comptes existants (créés avant cette migration) sont marqués vérifiés
    # pour ne pas casser leur accès. Les nouveaux comptes commencent à False.
    op.execute("UPDATE users SET email_verified = true WHERE email_verified IS NULL OR email_verified = false")


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS email_verify_token_exp")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS email_verify_token")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS email_verified")
    op.execute("ALTER TABLE ndas DROP COLUMN IF EXISTS pdf_path")
    op.execute("ALTER TABLE ndas DROP COLUMN IF EXISTS consents")
