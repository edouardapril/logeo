"""property_type : retire 'autre' (passage 6 → 5 catégories)

Suite de la refonte phase 1 (a1b2c3d4e5f6) : la catégorie produit "Autre"
n'a plus sa raison d'être. Les deals existants en `property_type='autre'`
sont remappés vers `'residentiel'` (catégorie par défaut la plus large),
et la CHECK constraint est resserrée à 5 valeurs.

Catégories canoniques restantes :
  - terrain
  - residentiel
  - petit_plex
  - multilogement_6_24
  - multilogement_24_plus

Idempotent (helpers `_constraint_exists`). Reversible : la CHECK constraint
est restaurée à 6 valeurs en downgrade. Note de perte sémantique : les deals
remappés vers `residentiel` lors du upgrade ne reviennent PAS automatiquement
à `'autre'` au downgrade — l'information « ex-autre » est perdue (acceptable
car migration produit, pas migration de schéma technique).

Revision ID: f7a8b9c0d1e2
Revises: f1a2b3c4d5e6
Create Date: 2026-05-08 16:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f7a8b9c0d1e2'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


CHECK_CONSTRAINT_NAME = 'deals_property_type_check'

CANONICAL_5 = [
    'terrain',
    'residentiel',
    'petit_plex',
    'multilogement_6_24',
    'multilogement_24_plus',
]

CANONICAL_6 = CANONICAL_5 + ['autre']


def _constraint_exists(name: str) -> bool:
    bind = op.get_bind()
    return bool(bind.execute(sa.text(
        "SELECT 1 FROM pg_constraint WHERE conname = :n"
    ), {"n": name}).scalar())


def upgrade() -> None:
    bind = op.get_bind()

    # 1) Comptage avant remap (logué pour audit)
    count = bind.execute(sa.text(
        "SELECT COUNT(*) FROM deals WHERE property_type = 'autre'"
    )).scalar() or 0
    print(
        f"[MIGRATION f7a8b9c0d1e2] {count} deal(s) avec property_type='autre' "
        f"→ remap vers 'residentiel'",
        flush=True,
    )

    # 2) Data migration
    op.execute(
        "UPDATE deals SET property_type = 'residentiel' "
        "WHERE property_type = 'autre'"
    )

    # 3) DROP l'ancienne CHECK constraint (6 valeurs)
    if _constraint_exists(CHECK_CONSTRAINT_NAME):
        op.execute(f"ALTER TABLE deals DROP CONSTRAINT {CHECK_CONSTRAINT_NAME}")

    # 4) RECREATE la CHECK constraint (5 valeurs)
    canonical_quoted = ", ".join(f"'{v}'" for v in CANONICAL_5)
    op.execute(
        f"ALTER TABLE deals "
        f"ADD CONSTRAINT {CHECK_CONSTRAINT_NAME} "
        f"CHECK (property_type IN ({canonical_quoted}))"
    )


def downgrade() -> None:
    # Best-effort : on rétablit la CHECK constraint élargie à 6 valeurs.
    # Les deals remappés ne sont PAS reconvertis en 'autre' (perte sémantique
    # acceptable, voir docstring).
    if _constraint_exists(CHECK_CONSTRAINT_NAME):
        op.execute(f"ALTER TABLE deals DROP CONSTRAINT {CHECK_CONSTRAINT_NAME}")

    canonical_quoted = ", ".join(f"'{v}'" for v in CANONICAL_6)
    op.execute(
        f"ALTER TABLE deals "
        f"ADD CONSTRAINT {CHECK_CONSTRAINT_NAME} "
        f"CHECK (property_type IN ({canonical_quoted}))"
    )
