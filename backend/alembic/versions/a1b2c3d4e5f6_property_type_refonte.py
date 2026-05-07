"""property_type refonte — VARCHAR(50) + CHECK + 6 catégories canoniques

Phase 1 du refactor "deal" : enum Postgres `propertytype` → VARCHAR + CHECK
contraint, plus flexible pour produit en évolution. Mapping idempotent
des deals existants vers les 6 nouvelles valeurs canoniques.

Revision ID: a1b2c3d4e5f6
Revises: f0a1b2c3d4e5
Create Date: 2026-05-07 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f0a1b2c3d4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ── Mappings ────────────────────────────────────────────────────────────────
# legacy → canonique (utilisé en upgrade)
LEGACY_TO_CANONICAL = {
    'terrain':                'terrain',
    'terrain_constructible':  'terrain',
    'multiplex':              'petit_plex',
    'multilogement_2_6':      'petit_plex',
    'residentiel_plex':       'petit_plex',
    'multilogement_7_24':     'multilogement_6_24',
    'projet_24_plus':         'multilogement_24_plus',
    'commercial':             'autre',
    'mixte':                  'autre',
    'industriel':             'autre',
}

# 6 valeurs canoniques (post-refonte)
CANONICAL_VALUES = [
    'terrain',
    'residentiel',
    'petit_plex',
    'multilogement_6_24',
    'multilogement_24_plus',
    'autre',
]

# canonique → legacy (best-effort, utilisé en downgrade)
# 'residentiel' n'a pas d'équivalent legacy strict → on le remappe sur
# 'residentiel_plex' qui en est sémantiquement le plus proche.
CANONICAL_TO_LEGACY = {
    'terrain':                'terrain',
    'residentiel':            'residentiel_plex',
    'petit_plex':             'multilogement_2_6',
    'multilogement_6_24':     'multilogement_7_24',
    'multilogement_24_plus':  'projet_24_plus',
    'autre':                  'mixte',
}

# Liste complète des 10 valeurs legacy (pour recréer l'enum en downgrade)
LEGACY_ENUM_VALUES = [
    'multiplex', 'commercial', 'mixte', 'industriel', 'terrain',
    'multilogement_2_6', 'multilogement_7_24', 'projet_24_plus',
    'terrain_constructible', 'residentiel_plex',
]

CHECK_CONSTRAINT_NAME = 'deals_property_type_check'


# ── Helpers idempotents (pattern existant dans le projet) ───────────────────

def _type_exists(name: str) -> bool:
    bind = op.get_bind()
    return bool(bind.execute(sa.text(
        "SELECT 1 FROM pg_type WHERE typname = :n"
    ), {"n": name}).scalar())


def _constraint_exists(name: str) -> bool:
    bind = op.get_bind()
    return bool(bind.execute(sa.text(
        "SELECT 1 FROM pg_constraint WHERE conname = :n"
    ), {"n": name}).scalar())


def _column_udt_name(table: str, column: str) -> str | None:
    """Retourne le type Postgres réel de la colonne (ex. 'varchar', 'propertytype')."""
    bind = op.get_bind()
    return bind.execute(sa.text(
        "SELECT udt_name FROM information_schema.columns "
        "WHERE table_name = :t AND column_name = :c"
    ), {"t": table, "c": column}).scalar()


# ── Upgrade ─────────────────────────────────────────────────────────────────

def upgrade() -> None:
    # 1) ALTER COLUMN : enum propertytype → VARCHAR(50) (idempotent)
    if _column_udt_name('deals', 'property_type') == 'propertytype':
        op.execute(
            "ALTER TABLE deals "
            "ALTER COLUMN property_type TYPE VARCHAR(50) "
            "USING property_type::text"
        )

    # 2) UPDATE des deals existants : mapping legacy → canonique
    case_branches = " ".join(
        f"WHEN '{old}' THEN '{new}'" for old, new in LEGACY_TO_CANONICAL.items()
    )
    canonical_quoted = ", ".join(f"'{v}'" for v in CANONICAL_VALUES)
    op.execute(f"""
        UPDATE deals
        SET property_type = CASE property_type
            {case_branches}
            ELSE 'autre'
        END
        WHERE property_type NOT IN ({canonical_quoted})
    """)

    # 3) ADD CHECK constraint sur les 6 valeurs canoniques (idempotent)
    if not _constraint_exists(CHECK_CONSTRAINT_NAME):
        op.execute(
            f"ALTER TABLE deals "
            f"ADD CONSTRAINT {CHECK_CONSTRAINT_NAME} "
            f"CHECK (property_type IN ({canonical_quoted}))"
        )

    # 4) DROP TYPE propertytype (idempotent, plus aucune dépendance après ALTER)
    if _type_exists('propertytype'):
        op.execute("DROP TYPE propertytype")


# ── Downgrade ───────────────────────────────────────────────────────────────

def downgrade() -> None:
    # 1) Recrée le type Postgres propertytype avec les 10 valeurs legacy
    if not _type_exists('propertytype'):
        values_sql = ", ".join(f"'{v}'" for v in LEGACY_ENUM_VALUES)
        # CREATE TYPE peut nécessiter un autocommit_block selon la version Postgres
        # (pattern utilisé dans c1d2e3f4a5b6_sprint_a_fields.py pour ALTER TYPE)
        with op.get_context().autocommit_block():
            op.execute(f"CREATE TYPE propertytype AS ENUM ({values_sql})")

    # 2) Drop le CHECK constraint
    if _constraint_exists(CHECK_CONSTRAINT_NAME):
        op.execute(f"ALTER TABLE deals DROP CONSTRAINT {CHECK_CONSTRAINT_NAME}")

    # 3) Reverse mapping (canonique → legacy best-effort) AVANT le cast
    case_branches = " ".join(
        f"WHEN '{new}' THEN '{old}'" for new, old in CANONICAL_TO_LEGACY.items()
    )
    op.execute(f"""
        UPDATE deals
        SET property_type = CASE property_type
            {case_branches}
            ELSE 'mixte'
        END
    """)

    # 4) ALTER COLUMN : VARCHAR → enum propertytype
    if _column_udt_name('deals', 'property_type') != 'propertytype':
        op.execute(
            "ALTER TABLE deals "
            "ALTER COLUMN property_type TYPE propertytype "
            "USING property_type::propertytype"
        )
