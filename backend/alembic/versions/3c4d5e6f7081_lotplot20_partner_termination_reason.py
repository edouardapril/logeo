"""LOTPLOT 20F — `termination_reason` sur regional_partner_profiles

Ajoute une colonne `termination_reason` (Text, nullable) au profil partenaire
régional pour capturer la clause invoquée à la cessation du partenariat
(volontaire, pour cause, sans cause, décès). Le `status` couvrait déjà ces
cas via la check constraint, mais on n'avait pas de champ libre pour le
texte explicatif requis par les contrats partenaires.

Idempotente. Reversible (downgrade drop la colonne).

Revision ID: 3c4d5e6f7081
Revises: 2b3c4d5e6f70
Create Date: 2026-05-10 13:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '3c4d5e6f7081'
down_revision: Union[str, None] = '2b3c4d5e6f70'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    return bool(bind.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = :t AND column_name = :c"
    ), {"t": table, "c": column}).scalar())


def upgrade() -> None:
    if not _column_exists('regional_partner_profiles', 'termination_reason'):
        op.add_column(
            'regional_partner_profiles',
            sa.Column('termination_reason', sa.Text(), nullable=True),
        )


def downgrade() -> None:
    if _column_exists('regional_partner_profiles', 'termination_reason'):
        op.drop_column('regional_partner_profiles', 'termination_reason')
