"""LOTPLOT 20E — soft delete utilisateur

Ajoute `users.deleted_at` (TIMESTAMP, indexé). Quand un admin "supprime"
un user, on set `deleted_at = now()` + `is_active = False`. Les données
liées (bids, NDAs, deals) restent en DB pour preuves légales et audit.

Toutes les queries des vues normales doivent désormais filtrer
`User.deleted_at.is_(None)` ; un onglet admin "Supprimés" peut afficher
les rows soft-deleted.

Idempotente : check `_column_exists` avant l'add. Reversible : downgrade
drop la colonne (les rows soft-deleted redeviennent simplement inactives).

Revision ID: 2b3c4d5e6f70
Revises: 1a2b3c4d5e6f
Create Date: 2026-05-10 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2b3c4d5e6f70'
down_revision: Union[str, None] = '1a2b3c4d5e6f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    return bool(bind.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = :t AND column_name = :c"
    ), {"t": table, "c": column}).scalar())


def upgrade() -> None:
    if not _column_exists('users', 'deleted_at'):
        op.add_column(
            'users',
            sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index('ix_users_deleted_at', 'users', ['deleted_at'])


def downgrade() -> None:
    if _column_exists('users', 'deleted_at'):
        op.drop_index('ix_users_deleted_at', table_name='users')
        op.drop_column('users', 'deleted_at')
