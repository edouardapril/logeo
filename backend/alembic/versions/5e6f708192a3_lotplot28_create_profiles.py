"""LOTPLOT 28 Phase 1 — Création public.profiles + trigger auto-create

Crée la table `public.profiles` qui héberge toutes les données métier
liées à un utilisateur. Le `id` de profiles est UUID PK + FK vers
`auth.users(id)` ON DELETE CASCADE — Supabase gère désormais les
credentials (email, hashed_password, sessions, MFA, password reset).

Schéma : tous les champs de l'ancien `public.users` SAUF `hashed_password`,
`email_verified`, `email_verify_token*` (gérés par auth.users).

Trigger `handle_new_user()` : à chaque INSERT dans auth.users, crée
automatiquement une row dans profiles avec id matché + email + metadata
(role, full_name, etc. depuis raw_user_meta_data).

Idempotente. Reversible : downgrade drop trigger + table profiles.

Revision ID: 5e6f708192a3
Revises: 4d5e6f708192
Create Date: 2026-05-10 18:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '5e6f708192a3'
down_revision: Union[str, None] = '4d5e6f708192'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(name: str) -> bool:
    bind = op.get_bind()
    return bool(bind.execute(sa.text(
        "SELECT 1 FROM information_schema.tables "
        "WHERE table_schema = 'public' AND table_name = :n"
    ), {"n": name}).scalar())


def upgrade() -> None:
    if not _table_exists('profiles'):
        op.execute("""
        CREATE TABLE public.profiles (
            id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            email varchar(255) NOT NULL UNIQUE,
            full_name varchar(255) NOT NULL,
            role varchar(50) NOT NULL CHECK (role IN ('admin', 'courtier', 'acheteur', 'regional_partner')),
            phone varchar(20),

            -- Courtier
            oaciq_number varchar(50),
            agency_name varchar(255),
            convention_signed_at timestamptz,
            convention_signed_ip varchar(64),
            convention_signed_user_agent varchar(500),
            convention_clauses_version varchar(20),

            -- Acheteur
            is_qualified boolean NOT NULL DEFAULT false,
            engagement_signed_at timestamptz,

            -- Stripe (legacy LOTPLOT 19 — flow dépôt désactivé mais colonnes conservées)
            stripe_customer_id varchar(120),
            stripe_payment_method_id varchar(120),
            payment_method_brand varchar(40),
            payment_method_last4 varchar(4),
            payment_method_exp_month integer,
            payment_method_exp_year integer,

            -- Profil
            profile_photo_path varchar(500),
            email_notifications boolean NOT NULL DEFAULT true,

            -- T&C
            tos_accepted_at timestamptz,
            tos_accepted_ip varchar(64),
            tos_accepted_version varchar(20),

            -- Soft delete (LOTPLOT 20E)
            is_active boolean NOT NULL DEFAULT true,
            deleted_at timestamptz,

            -- Recrutement partenaire (LOTPLOT 20F)
            recruited_by_id uuid REFERENCES public.profiles(id),
            recruited_at timestamptz,
            recruitment_notes text,

            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE INDEX ix_profiles_email ON public.profiles (email);
        CREATE INDEX ix_profiles_role ON public.profiles (role);
        CREATE INDEX ix_profiles_deleted_at ON public.profiles (deleted_at);
        CREATE INDEX ix_profiles_recruited_by_id ON public.profiles (recruited_by_id);
        """)

    # Trigger auto-update du updated_at
    op.execute("""
    CREATE OR REPLACE FUNCTION public.profiles_touch_updated_at()
    RETURNS trigger AS $$
    BEGIN
        NEW.updated_at = now();
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS profiles_touch_updated_at_trigger ON public.profiles;
    CREATE TRIGGER profiles_touch_updated_at_trigger
        BEFORE UPDATE ON public.profiles
        FOR EACH ROW
        EXECUTE FUNCTION public.profiles_touch_updated_at();
    """)

    # Trigger : à la création d'un auth.users, on crée un profile minimal.
    # SECURITY DEFINER pour bypasser RLS (la fonction tourne avec les droits
    # du créateur de la fonction, généralement postgres/service_role).
    # Le role default est 'acheteur' — l'app peut l'élever via UPDATE.
    op.execute("""
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
        INSERT INTO public.profiles (id, email, full_name, role, phone, oaciq_number, agency_name)
        VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
            COALESCE(NEW.raw_user_meta_data->>'role', 'acheteur'),
            NEW.raw_user_meta_data->>'phone',
            NEW.raw_user_meta_data->>'oaciq_number',
            NEW.raw_user_meta_data->>'agency_name'
        )
        ON CONFLICT (id) DO NOTHING;  -- idempotent : si profile déjà créé manuellement (script de migration), no-op
        RETURN NEW;
    END;
    $$;

    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW
        EXECUTE FUNCTION public.handle_new_user();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;")
    op.execute("DROP FUNCTION IF EXISTS public.handle_new_user();")
    op.execute("DROP TRIGGER IF EXISTS profiles_touch_updated_at_trigger ON public.profiles;")
    op.execute("DROP FUNCTION IF EXISTS public.profiles_touch_updated_at();")
    op.execute("DROP TABLE IF EXISTS public.profiles CASCADE;")
