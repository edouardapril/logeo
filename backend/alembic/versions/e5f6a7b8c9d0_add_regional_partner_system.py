"""add regional partner system

Phase 1 du système partenaires régionaux : modèle de données seul.
Aucune route API ni logique de calcul de commission dans cette migration.

Changements :
  1. users.role : enum Postgres `userrole` → VARCHAR(50) + CHECK
     (cohérent avec PropertyType refonte phase 1, plus flexible et
     évite le piège ALTER TYPE ... ADD VALUE non rollback-able).
     Ajout de la valeur 'regional_partner' dans le CHECK.
  2. users : ajout de 3 colonnes nullable (recruited_by_id avec FK self,
     recruited_at, recruitment_notes).
  3. Création table regional_territories.
  4. Création table regional_partner_profiles avec CHECK sur status.

Tout est idempotent. Downgrade strict (avec une perte sémantique
acceptable : les users en role='regional_partner' sont remappés vers
'acheteur', faute de pouvoir les conserver dans l'enum legacy).

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-05-08 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ── Helpers idempotents (pattern existant : information_schema + pg_catalog) ─

def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    return bool(bind.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = :t AND column_name = :c"
    ), {"t": table, "c": column}).scalar())


def _constraint_exists(name: str) -> bool:
    bind = op.get_bind()
    return bool(bind.execute(sa.text(
        "SELECT 1 FROM pg_constraint WHERE conname = :n"
    ), {"n": name}).scalar())


def _type_exists(name: str) -> bool:
    bind = op.get_bind()
    return bool(bind.execute(sa.text(
        "SELECT 1 FROM pg_type WHERE typname = :n"
    ), {"n": name}).scalar())


def _column_udt_name(table: str, column: str) -> str | None:
    bind = op.get_bind()
    return bind.execute(sa.text(
        "SELECT udt_name FROM information_schema.columns "
        "WHERE table_name = :t AND column_name = :c"
    ), {"t": table, "c": column}).scalar()


def _table_exists(name: str) -> bool:
    bind = op.get_bind()
    return bool(bind.execute(sa.text(
        "SELECT 1 FROM information_schema.tables WHERE table_name = :n"
    ), {"n": name}).scalar())


def _index_exists(name: str) -> bool:
    bind = op.get_bind()
    return bool(bind.execute(sa.text(
        "SELECT 1 FROM pg_indexes WHERE indexname = :n"
    ), {"n": name}).scalar())


VALID_ROLES = ('admin', 'courtier', 'acheteur', 'regional_partner')
LEGACY_ROLES = ('admin', 'courtier', 'acheteur')

ROLE_CHECK_NAME = 'users_role_check'
PARTNER_STATUS_CHECK_NAME = 'regional_partner_profiles_status_check'


# ── Upgrade ─────────────────────────────────────────────────────────────────

def upgrade() -> None:
    # 1) ALTER COLUMN: enum userrole → VARCHAR(50) (idempotent)
    if _column_udt_name('users', 'role') == 'userrole':
        op.execute(
            "ALTER TABLE users "
            "ALTER COLUMN role TYPE VARCHAR(50) "
            "USING role::text"
        )

    # 2) ADD CHECK constraint sur les 4 valeurs (idempotent)
    if not _constraint_exists(ROLE_CHECK_NAME):
        roles_quoted = ", ".join(f"'{r}'" for r in VALID_ROLES)
        op.execute(
            f"ALTER TABLE users "
            f"ADD CONSTRAINT {ROLE_CHECK_NAME} "
            f"CHECK (role IN ({roles_quoted}))"
        )

    # 3) DROP TYPE userrole (idempotent, plus aucune dépendance)
    if _type_exists('userrole'):
        op.execute("DROP TYPE userrole")

    # 4) Colonnes recrutement sur users
    if not _column_exists('users', 'recruited_by_id'):
        op.add_column('users', sa.Column(
            'recruited_by_id', UUID(as_uuid=True), nullable=True,
        ))
        op.create_foreign_key(
            'users_recruited_by_id_fkey',
            'users', 'users', ['recruited_by_id'], ['id'],
        )
        op.create_index('ix_users_recruited_by_id', 'users', ['recruited_by_id'])

    if not _column_exists('users', 'recruited_at'):
        op.add_column('users', sa.Column(
            'recruited_at', sa.DateTime(timezone=True), nullable=True,
        ))

    if not _column_exists('users', 'recruitment_notes'):
        op.add_column('users', sa.Column(
            'recruitment_notes', sa.Text(), nullable=True,
        ))

    # 5) Table regional_territories
    if not _table_exists('regional_territories'):
        op.create_table(
            'regional_territories',
            sa.Column('id', UUID(as_uuid=True), primary_key=True),
            sa.Column('code', sa.String(20), nullable=False),
            sa.Column('name', sa.String(100), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('is_active', sa.Boolean(),
                      server_default=sa.text('true'), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True),
                      server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True),
                      server_default=sa.text('now()'), nullable=False),
            sa.UniqueConstraint('code', name='uq_regional_territories_code'),
        )

    # 6) Table regional_partner_profiles avec CHECK status
    if not _table_exists('regional_partner_profiles'):
        op.create_table(
            'regional_partner_profiles',
            sa.Column('id', UUID(as_uuid=True), primary_key=True),
            sa.Column('user_id', UUID(as_uuid=True), nullable=False),
            sa.Column('territory_id', UUID(as_uuid=True), nullable=True),
            sa.Column('status', sa.String(50),
                      server_default='active', nullable=False),
            sa.Column('commission_rate', sa.Numeric(5, 4),
                      server_default='0.2500', nullable=False),
            sa.Column('contract_signed_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('contract_terminated_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True),
                      server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True),
                      server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'],
                                    name='regional_partner_profiles_user_id_fkey'),
            sa.ForeignKeyConstraint(['territory_id'], ['regional_territories.id'],
                                    name='regional_partner_profiles_territory_id_fkey'),
            sa.UniqueConstraint('user_id', name='uq_regional_partner_profiles_user_id'),
            sa.CheckConstraint(
                "status IN ('active', 'quit_voluntary', 'terminated_for_cause', "
                "'terminated_without_cause', 'deceased', 'on_hold')",
                name=PARTNER_STATUS_CHECK_NAME,
            ),
        )

    # 7) Partial unique index : max 1 partenaire 'active' par territoire (NOT NULL).
    #    Autorise plusieurs partenaires actifs avec territory_id NULL (onboarding)
    #    et plusieurs profils historiques (status != 'active') sur le même territoire.
    if not _index_exists('uq_active_partner_per_territory'):
        op.create_index(
            'uq_active_partner_per_territory',
            'regional_partner_profiles',
            ['territory_id'],
            unique=True,
            postgresql_where=sa.text(
                "territory_id IS NOT NULL AND status = 'active'"
            ),
        )


# ── Downgrade ───────────────────────────────────────────────────────────────

def downgrade() -> None:
    # 1) Drop le partial unique index avant la table (cascade implicite mais
    #    explicite = downgrade plus lisible et robuste si la table survit).
    if _index_exists('uq_active_partner_per_territory'):
        op.drop_index(
            'uq_active_partner_per_territory',
            table_name='regional_partner_profiles',
        )

    # 2) Drop tables nouvelles (ordre inverse FK)
    if _table_exists('regional_partner_profiles'):
        op.drop_table('regional_partner_profiles')
    if _table_exists('regional_territories'):
        op.drop_table('regional_territories')

    # 2) Drop colonnes recrutement sur users
    if _column_exists('users', 'recruitment_notes'):
        op.drop_column('users', 'recruitment_notes')
    if _column_exists('users', 'recruited_at'):
        op.drop_column('users', 'recruited_at')
    if _column_exists('users', 'recruited_by_id'):
        if _index_exists('ix_users_recruited_by_id'):
            op.drop_index('ix_users_recruited_by_id', table_name='users')
        if _constraint_exists('users_recruited_by_id_fkey'):
            op.drop_constraint('users_recruited_by_id_fkey', 'users', type_='foreignkey')
        op.drop_column('users', 'recruited_by_id')

    # 3) Drop CHECK constraint sur role
    if _constraint_exists(ROLE_CHECK_NAME):
        op.execute(f"ALTER TABLE users DROP CONSTRAINT {ROLE_CHECK_NAME}")

    # 4) Best-effort : remap 'regional_partner' → 'acheteur' (perte sémantique
    #    acceptable car phase 1 : aucun user regional_partner créé en prod)
    op.execute(
        "UPDATE users SET role = 'acheteur' "
        "WHERE role NOT IN ('admin', 'courtier', 'acheteur')"
    )

    # 5) Recreate userrole enum
    if not _type_exists('userrole'):
        legacy_quoted = ", ".join(f"'{r}'" for r in LEGACY_ROLES)
        with op.get_context().autocommit_block():
            op.execute(f"CREATE TYPE userrole AS ENUM ({legacy_quoted})")

    # 6) ALTER COLUMN VARCHAR → userrole
    if _column_udt_name('users', 'role') != 'userrole':
        op.execute(
            "ALTER TABLE users "
            "ALTER COLUMN role TYPE userrole "
            "USING role::userrole"
        )
