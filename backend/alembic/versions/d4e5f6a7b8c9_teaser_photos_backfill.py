"""teaser_photo_paths backfill — recopie le singulier legacy vers le pluriel

Pour les deals dont teaser_photo_paths est NULL mais teaser_photo_path
(singulier, legacy sprint B) contient une valeur, recopie cette valeur
sous forme de tableau JSON à 1 élément. Permet aux surfaces d'affichage
qui migrent vers teaser_photo_paths de fonctionner pour les deals créés
avant la refonte chantier B.

Idempotent : ne touche rien si teaser_photo_paths est déjà peuplé ou si
teaser_photo_path est NULL.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-05-07 13:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    return bool(bind.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = :t AND column_name = :c"
    ), {"t": table, "c": column}).scalar())


def upgrade() -> None:
    if not _column_exists('deals', 'teaser_photo_paths'):
        return
    if not _column_exists('deals', 'teaser_photo_path'):
        return

    # json_build_array (pas jsonb_build_array) car la colonne est de type JSON, pas JSONB
    op.execute("""
        UPDATE deals
        SET teaser_photo_paths = json_build_array(teaser_photo_path)
        WHERE teaser_photo_paths IS NULL
          AND teaser_photo_path IS NOT NULL
          AND teaser_photo_path <> ''
    """)


def downgrade() -> None:
    # One-way : on ne sait pas distinguer les deals backfillés des autres
    # après coup. Pas de réversibilité utile.
    pass
