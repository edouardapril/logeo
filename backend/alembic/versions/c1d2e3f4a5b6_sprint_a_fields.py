"""sprint a fields — photos, postal, floor price, profile photo, prefs, new property types

Revision ID: c1d2e3f4a5b6
Revises: b9a1c0f02f4e
Create Date: 2026-05-06 16:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, None] = 'b9a1c0f02f4e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_PROPERTY_TYPES = [
    'multilogement_2_6',
    'multilogement_7_24',
    'projet_24_plus',
    'terrain_constructible',
    'residentiel_plex',
]


def _add_column_if_missing(table: str, column: sa.Column):
    bind = op.get_bind()
    exists = bind.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = :t AND column_name = :c"
    ), {"t": table, "c": column.name}).scalar()
    if not exists:
        op.add_column(table, column)


def upgrade() -> None:
    # Users : profile photo + email prefs
    _add_column_if_missing('users', sa.Column('profile_photo_path', sa.String(length=500), nullable=True))
    _add_column_if_missing('users', sa.Column(
        'email_notifications', sa.Boolean(), nullable=False, server_default=sa.text('true'),
    ))

    # Deals : postal code, floor price (admin), photos
    _add_column_if_missing('deals', sa.Column('postal_code', sa.String(length=10), nullable=True))
    _add_column_if_missing('deals', sa.Column('floor_price', sa.Integer(), nullable=True))
    _add_column_if_missing('deals', sa.Column('photo_paths', sa.JSON(), nullable=True))

    # PropertyType enum : ajout idempotent des nouvelles valeurs.
    # ALTER TYPE ... ADD VALUE ne tourne pas en transaction → autocommit_block.
    with op.get_context().autocommit_block():
        for value in NEW_PROPERTY_TYPES:
            op.execute(f"ALTER TYPE propertytype ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    # Postgres ne supporte pas DROP VALUE sur un enum → on laisse les valeurs ajoutées.
    op.execute("ALTER TABLE deals DROP COLUMN IF EXISTS photo_paths")
    op.execute("ALTER TABLE deals DROP COLUMN IF EXISTS floor_price")
    op.execute("ALTER TABLE deals DROP COLUMN IF EXISTS postal_code")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS email_notifications")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS profile_photo_path")
