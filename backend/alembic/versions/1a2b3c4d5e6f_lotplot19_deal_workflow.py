"""LOTPLOT 19 — workflow MVP : statuts deal + winning_price

Décision business : pas de dépôt 25 % à la fermeture, on facture 100 %
des frais Logeo (1 % du prix final) à la signature de la PA via virement
Interac manuel. Le statut `intro` (post-fermeture, DD en cours) est
remplacé par un nouveau pipeline plus explicite :

    bid → due_diligence → awaiting_pa → pa_signed → awaiting_payment → paid
                       ↓
                   dd_failed (terminal — fallback 2e offrant possible)

Ce migration :
  1) Ajoute les nouvelles valeurs à l'enum Postgres `dealstatus` :
     `due_diligence`, `awaiting_pa`, `dd_failed`, `awaiting_payment`, `paid`.
     `intro` reste dans l'enum (orphelin) pour ne pas casser le rollback —
     supprimer une valeur d'enum Postgres exige de recréer le type, ce qui
     est lourd et risqué pour un MVP.
  2) Migre les rows existantes `intro` → `due_diligence` (data migration).
  3) Ajoute 3 colonnes audit :
       - `winning_price`   (INTEGER) : prix final calculé à la close (≠ max bid privé)
       - `pa_signed_at`    (TIMESTAMP) : horodatage du clic admin "PA signée"
       - `paid_at`         (TIMESTAMP) : horodatage du clic admin "Paiement reçu"
       - `dd_confirmed_at` (TIMESTAMP) : horodatage de la confirmation DD par le gagnant
       - `dd_withdrawn_at` (TIMESTAMP) : horodatage du retrait DD par le gagnant

Idempotent (helpers `_column_exists`). Reversible : downgrade enlève les
colonnes ajoutées et remappe `due_diligence` → `intro`. Les nouveaux
statuts (`awaiting_pa`, `awaiting_payment`, etc.) restent dans l'enum
en downgrade — sans risque puisque le code Python ne les utilise plus.

Revision ID: 1a2b3c4d5e6f
Revises: f7a8b9c0d1e2
Create Date: 2026-05-09 18:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '1a2b3c4d5e6f'
down_revision: Union[str, None] = 'f7a8b9c0d1e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ── Helpers idempotents ─────────────────────────────────────────────────────

def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    return bool(bind.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = :t AND column_name = :c"
    ), {"t": table, "c": column}).scalar())


def _enum_value_exists(enum_name: str, value: str) -> bool:
    bind = op.get_bind()
    return bool(bind.execute(sa.text(
        "SELECT 1 FROM pg_enum e "
        "JOIN pg_type t ON t.oid = e.enumtypid "
        "WHERE t.typname = :tn AND e.enumlabel = :v"
    ), {"tn": enum_name, "v": value}).scalar())


# ── Upgrade ─────────────────────────────────────────────────────────────────

NEW_STATUSES = ['due_diligence', 'awaiting_pa', 'dd_failed', 'awaiting_payment', 'paid']


def upgrade() -> None:
    bind = op.get_bind()

    # 1) Ajouter les nouvelles valeurs à l'enum dealstatus
    # ALTER TYPE ... ADD VALUE doit s'exécuter en autocommit (commit avant le bloc)
    # pour que les valeurs soient visibles dans la même transaction côté UPDATE.
    with op.get_context().autocommit_block():
        for status in NEW_STATUSES:
            if not _enum_value_exists('dealstatus', status):
                op.execute(f"ALTER TYPE dealstatus ADD VALUE '{status}'")

    # 2) Data migration : intro → due_diligence (forward path du nouveau pipeline)
    op.execute("UPDATE deals SET status = 'due_diligence' WHERE status = 'intro'")

    # 3) Colonnes audit du nouveau workflow
    if not _column_exists('deals', 'winning_price'):
        op.add_column('deals', sa.Column('winning_price', sa.Integer(), nullable=True))
    if not _column_exists('deals', 'pa_signed_at'):
        op.add_column('deals', sa.Column('pa_signed_at', sa.DateTime(timezone=True), nullable=True))
    if not _column_exists('deals', 'paid_at'):
        op.add_column('deals', sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True))
    if not _column_exists('deals', 'dd_confirmed_at'):
        op.add_column('deals', sa.Column('dd_confirmed_at', sa.DateTime(timezone=True), nullable=True))
    if not _column_exists('deals', 'dd_withdrawn_at'):
        op.add_column('deals', sa.Column('dd_withdrawn_at', sa.DateTime(timezone=True), nullable=True))


# ── Downgrade ───────────────────────────────────────────────────────────────

def downgrade() -> None:
    # Remap les rows aux nouveaux statuts vers `intro` (statut le plus proche)
    # ou `pa_signed` quand applicable. C'est lossy mais OK : downgrade=rollback
    # de dev, pas un retour business arrière.
    op.execute("UPDATE deals SET status = 'intro' WHERE status IN ('due_diligence', 'awaiting_pa', 'dd_failed', 'awaiting_payment')")
    op.execute("UPDATE deals SET status = 'pa_signed' WHERE status = 'paid'")

    # Drop des colonnes audit
    if _column_exists('deals', 'dd_withdrawn_at'):
        op.drop_column('deals', 'dd_withdrawn_at')
    if _column_exists('deals', 'dd_confirmed_at'):
        op.drop_column('deals', 'dd_confirmed_at')
    if _column_exists('deals', 'paid_at'):
        op.drop_column('deals', 'paid_at')
    if _column_exists('deals', 'pa_signed_at'):
        op.drop_column('deals', 'pa_signed_at')
    if _column_exists('deals', 'winning_price'):
        op.drop_column('deals', 'winning_price')

    # Note : les nouvelles valeurs d'enum (due_diligence, awaiting_pa, etc.)
    # ne sont PAS retirées de dealstatus. Postgres ne supporte pas
    # ALTER TYPE ... DROP VALUE ; il faudrait recréer le type entier.
    # En pratique inoffensif : aucune row ne les utilise après le UPDATE
    # ci-dessus, et le code Python ne les référence pas en downgrade.
