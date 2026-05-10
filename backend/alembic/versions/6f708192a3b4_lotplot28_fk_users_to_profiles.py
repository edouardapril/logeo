"""LOTPLOT 28-SEQ — Bascule des FK users → profiles + copie des données.

PROBLÈME résolu :
La version originale tentait juste un ALTER TABLE ... DROP/ADD CONSTRAINT
pour rediriger les FK de `public.users` vers `public.profiles`. Mais
`public.profiles` était vide (peuplée seulement après l'exécution du
script Python `migrate_users_to_supabase`), donc les FKs sur bids/deals/
etc. (qui pointent vers des UUIDs existant dans `public.users`) refusaient
de se créer → ForeignKeyViolation.

Nouvelle séquence en 4 étapes dans une seule migration :
  1) Drop temporairement le FK profiles.id → auth.users (créé par 5e6f).
     Sans ça, on ne peut pas INSERT dans profiles avant que auth.users
     contienne les rows correspondants.
  2) Copier public.users → public.profiles (ON CONFLICT DO NOTHING).
     Préserve les UUIDs ; tous les colonnes métier sont transférées.
  3) Re-pointer les 12 FK existantes (bids, deals, ndas, …) de
     public.users(id) vers public.profiles(id). Maintenant profiles a
     les rows nécessaires, les FK passent.
  4) Le FK profiles.id → auth.users(id) reste ABSENT à la fin. Il sera
     restauré par la migration `7a8b9c0d1e2f_lotplot28_restore_profiles_auth_fk`
     qui est délibérément placée dans `versions_deferred/` — à appliquer
     manuellement APRÈS que le script Python ait peuplé auth.users.

Le trigger `handle_new_user` créé en 5e6f utilise déjà `ON CONFLICT (id)
DO NOTHING`. Quand le script Python crée des entrées dans auth.users avec
des UUIDs déjà présents dans profiles, le trigger fire mais skip. ✓

Idempotente : `ON CONFLICT DO NOTHING` sur l'INSERT, lookup
`information_schema` pour les FKs.

Revision ID: 6f708192a3b4
Revises: 5e6f708192a3
Create Date: 2026-05-10 18:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '6f708192a3b4'
down_revision: Union[str, None] = '5e6f708192a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# 12 FK à re-pointer
FK_TARGETS = [
    ('bids', 'acheteur_id'),
    ('deals', 'courtier_id'),
    ('ndas', 'acheteur_id'),
    ('payments', 'acheteur_id'),
    ('deal_questions', 'acheteur_id'),
    ('deal_reviews', 'rater_id'),
    ('deal_reviews', 'ratee_id'),
    ('regional_partner_profiles', 'user_id'),
    ('user_sanctions', 'user_id'),
    ('user_sanctions', 'created_by_id'),
    ('user_sanctions', 'lifted_by_id'),
    ('email_logs', 'recipient_id'),
]


def _find_fk_name(table: str, column: str, refs_table: str) -> str | None:
    bind = op.get_bind()
    res = bind.execute(sa.text("""
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = :t
          AND kcu.column_name = :c
          AND ccu.table_name = :rt
        LIMIT 1
    """), {"t": table, "c": column, "rt": refs_table})
    return res.scalar_one_or_none()


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    return bool(bind.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_schema = 'public' AND table_name = :t AND column_name = :c"
    ), {"t": table, "c": column}).scalar())


def _table_exists(name: str) -> bool:
    bind = op.get_bind()
    return bool(bind.execute(sa.text(
        "SELECT 1 FROM information_schema.tables "
        "WHERE table_schema = 'public' AND table_name = :n"
    ), {"n": name}).scalar())


def upgrade() -> None:
    if not _table_exists('users'):
        # public.users a déjà été drop, rien à faire — migration équivalente
        # à un no-op pour la rendre idempotente.
        return

    # 1) Drop temporairement le FK profiles.id → auth.users.
    #    Sans ça, l'INSERT en 2) échoue car aucun row matchant n'existe
    #    encore dans auth.users.
    op.execute("ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey")

    # 2) Copier public.users → public.profiles. UUIDs préservés. ON CONFLICT
    #    DO NOTHING garantit l'idempotence si la migration est ré-appliquée.
    #    Les colonnes legacy `hashed_password` et `email_verify*` ne sont
    #    PAS copiées — elles ne sont plus dans profiles (gérées par Supabase
    #    auth.users une fois le script Python exécuté).
    op.execute("""
        INSERT INTO public.profiles (
            id, email, full_name, role, phone,
            oaciq_number, agency_name, convention_signed_at,
            convention_signed_ip, convention_signed_user_agent,
            convention_clauses_version,
            is_qualified, engagement_signed_at,
            stripe_customer_id, stripe_payment_method_id,
            payment_method_brand, payment_method_last4,
            payment_method_exp_month, payment_method_exp_year,
            profile_photo_path, email_notifications,
            tos_accepted_at, tos_accepted_ip, tos_accepted_version,
            is_active, deleted_at,
            recruited_by_id, recruited_at, recruitment_notes,
            created_at, updated_at
        )
        SELECT
            id, email, full_name, role, phone,
            oaciq_number, agency_name, convention_signed_at,
            convention_signed_ip, convention_signed_user_agent,
            convention_clauses_version,
            COALESCE(is_qualified, false), engagement_signed_at,
            stripe_customer_id, stripe_payment_method_id,
            payment_method_brand, payment_method_last4,
            payment_method_exp_month, payment_method_exp_year,
            profile_photo_path, COALESCE(email_notifications, true),
            tos_accepted_at, tos_accepted_ip, tos_accepted_version,
            COALESCE(is_active, true), deleted_at,
            recruited_by_id, recruited_at, recruitment_notes,
            COALESCE(created_at, now()), COALESCE(created_at, now())
        FROM public.users
        ON CONFLICT (id) DO NOTHING
    """)

    # 3) Re-pointer les 12 FK existantes vers profiles.id. profiles est
    #    maintenant peuplée, les FKs passent.
    for table, column in FK_TARGETS:
        if not _column_exists(table, column):
            continue
        old_fk = _find_fk_name(table, column, 'users')
        if old_fk:
            op.execute(f'ALTER TABLE public.{table} DROP CONSTRAINT "{old_fk}"')
        new_fk = f'{table}_{column}_fkey_profiles'
        # idempotence : ne pas recréer si déjà fait
        if not _find_fk_name(table, column, 'profiles'):
            op.execute(
                f'ALTER TABLE public.{table} '
                f'ADD CONSTRAINT "{new_fk}" '
                f'FOREIGN KEY ({column}) REFERENCES public.profiles(id)'
            )

    # 4) profiles.id n'a PLUS de FK vers auth.users à ce stade.
    #    À restaurer manuellement via la migration différée :
    #      backend/alembic/versions_deferred/7a8b9c0d1e2f_lotplot28_restore_profiles_auth_fk.py
    #    APRÈS que migrate_users_to_supabase.py ait peuplé auth.users.


def downgrade() -> None:
    # Rollback du switch FK : on re-pointe vers public.users (les rows sont
    # toujours là — public.users n'a pas été drop dans cette migration).
    for table, column in FK_TARGETS:
        if not _column_exists(table, column):
            continue
        new_fk = _find_fk_name(table, column, 'profiles')
        if new_fk:
            op.execute(f'ALTER TABLE public.{table} DROP CONSTRAINT "{new_fk}"')
        old_fk = f'{table}_{column}_fkey'
        if not _find_fk_name(table, column, 'users'):
            op.execute(
                f'ALTER TABLE public.{table} '
                f'ADD CONSTRAINT "{old_fk}" '
                f'FOREIGN KEY ({column}) REFERENCES public.users(id)'
            )
    # Vide profiles + restaure le FK vers auth.users (avant rollback de la 5e6f)
    op.execute("DELETE FROM public.profiles")
    op.execute(
        "ALTER TABLE public.profiles "
        "ADD CONSTRAINT profiles_id_fkey "
        "FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE"
    )
