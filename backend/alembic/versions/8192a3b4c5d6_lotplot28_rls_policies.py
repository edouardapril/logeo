"""LOTPLOT 28 Phase 5 — RLS policies permissives (baseline).

Active RLS sur toutes les tables sensibles et pose des policies basiques :
  - admins : voient tout (via helper `public.get_user_role()`)
  - autres : voient leurs propres rows (acheteur_id, courtier_id, recipient_id)
  - INSERT : autorisé pour le user lui-même (sa propre row) ; admin peut tout
  - DELETE : admin only par défaut

Stratégie "permissif" — couvre 80 % des cas, à raffiner par table si besoin.

Idempotente : `CREATE POLICY IF NOT EXISTS` n'existe pas en PG mais on
drop d'abord puis recrée.

Revision ID: 8192a3b4c5d6
Revises: 6f708192a3b4
Create Date: 2026-05-10 19:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '8192a3b4c5d6'
down_revision: Union[str, None] = '6f708192a3b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Helper : récupère le role métier du JWT courant ────────────────────
    op.execute("""
    CREATE OR REPLACE FUNCTION public.get_user_role()
    RETURNS text
    LANGUAGE sql
    SECURITY DEFINER
    STABLE
    SET search_path = public
    AS $$
        SELECT role FROM public.profiles WHERE id = auth.uid()
    $$;
    """)

    # ── Activer RLS sur toutes les tables sensibles ─────────────────────────
    SENSITIVE_TABLES = [
        'profiles', 'deals', 'bids', 'ndas', 'payments',
        'deal_questions', 'deal_reviews', 'deal_units',
        'regional_partner_profiles', 'regional_territories',
        'user_sanctions', 'email_logs',
    ]
    for t in SENSITIVE_TABLES:
        op.execute(f"ALTER TABLE public.{t} ENABLE ROW LEVEL SECURITY")

    # ── profiles ────────────────────────────────────────────────────────────
    op.execute("""
    DROP POLICY IF EXISTS profiles_select ON public.profiles;
    CREATE POLICY profiles_select ON public.profiles FOR SELECT
        USING (
            id = auth.uid()
            OR public.get_user_role() = 'admin'
        );

    DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
    CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE
        USING (id = auth.uid() OR public.get_user_role() = 'admin')
        WITH CHECK (id = auth.uid() OR public.get_user_role() = 'admin');

    DROP POLICY IF EXISTS profiles_delete_admin ON public.profiles;
    CREATE POLICY profiles_delete_admin ON public.profiles FOR DELETE
        USING (public.get_user_role() = 'admin');

    -- INSERT : géré par le trigger handle_new_user (SECURITY DEFINER bypasse RLS)
    """)

    # ── deals ───────────────────────────────────────────────────────────────
    # Les acheteurs voient tous les deals publiés (status=bid ou plus avancé).
    # Les courtiers voient leurs propres deals + les deals publics.
    # Admins voient tout.
    op.execute("""
    DROP POLICY IF EXISTS deals_select ON public.deals;
    CREATE POLICY deals_select ON public.deals FOR SELECT
        USING (
            public.get_user_role() = 'admin'
            OR courtier_id = auth.uid()
            OR status IN ('bid', 'due_diligence', 'awaiting_pa', 'pa_signed', 'awaiting_payment', 'paid', 'auction_ended')
        );

    DROP POLICY IF EXISTS deals_insert_courtier ON public.deals;
    CREATE POLICY deals_insert_courtier ON public.deals FOR INSERT
        WITH CHECK (
            public.get_user_role() IN ('courtier', 'admin')
            AND courtier_id = auth.uid()
        );

    DROP POLICY IF EXISTS deals_update ON public.deals;
    CREATE POLICY deals_update ON public.deals FOR UPDATE
        USING (
            public.get_user_role() = 'admin'
            OR courtier_id = auth.uid()
        );

    DROP POLICY IF EXISTS deals_delete_admin ON public.deals;
    CREATE POLICY deals_delete_admin ON public.deals FOR DELETE
        USING (public.get_user_role() = 'admin');
    """)

    # ── bids ────────────────────────────────────────────────────────────────
    op.execute("""
    DROP POLICY IF EXISTS bids_select ON public.bids;
    CREATE POLICY bids_select ON public.bids FOR SELECT
        USING (
            public.get_user_role() = 'admin'
            OR acheteur_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.deals d WHERE d.id = bids.deal_id AND d.courtier_id = auth.uid())
        );

    DROP POLICY IF EXISTS bids_insert_own ON public.bids;
    CREATE POLICY bids_insert_own ON public.bids FOR INSERT
        WITH CHECK (acheteur_id = auth.uid() OR public.get_user_role() = 'admin');

    DROP POLICY IF EXISTS bids_update_admin ON public.bids;
    CREATE POLICY bids_update_admin ON public.bids FOR UPDATE
        USING (public.get_user_role() = 'admin');

    DROP POLICY IF EXISTS bids_delete_admin ON public.bids;
    CREATE POLICY bids_delete_admin ON public.bids FOR DELETE
        USING (public.get_user_role() = 'admin');
    """)

    # ── ndas / payments / deal_questions / deal_reviews : même pattern (own + admin) ──
    op.execute("""
    DROP POLICY IF EXISTS ndas_select ON public.ndas;
    CREATE POLICY ndas_select ON public.ndas FOR SELECT
        USING (
            public.get_user_role() = 'admin'
            OR acheteur_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.deals d WHERE d.id = ndas.deal_id AND d.courtier_id = auth.uid())
        );
    DROP POLICY IF EXISTS ndas_insert_own ON public.ndas;
    CREATE POLICY ndas_insert_own ON public.ndas FOR INSERT
        WITH CHECK (acheteur_id = auth.uid() OR public.get_user_role() = 'admin');

    DROP POLICY IF EXISTS payments_select ON public.payments;
    CREATE POLICY payments_select ON public.payments FOR SELECT
        USING (public.get_user_role() = 'admin' OR acheteur_id = auth.uid());

    DROP POLICY IF EXISTS deal_questions_select ON public.deal_questions;
    CREATE POLICY deal_questions_select ON public.deal_questions FOR SELECT
        USING (
            public.get_user_role() = 'admin'
            OR acheteur_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_questions.deal_id AND d.courtier_id = auth.uid())
        );

    DROP POLICY IF EXISTS deal_reviews_select ON public.deal_reviews;
    CREATE POLICY deal_reviews_select ON public.deal_reviews FOR SELECT
        USING (true);  -- reviews sont publiques (preuve sociale)
    """)

    # ── regional_partner_profiles / user_sanctions / email_logs : admin only ──
    op.execute("""
    DROP POLICY IF EXISTS rpp_admin_only ON public.regional_partner_profiles;
    CREATE POLICY rpp_admin_only ON public.regional_partner_profiles FOR ALL
        USING (public.get_user_role() = 'admin')
        WITH CHECK (public.get_user_role() = 'admin');

    DROP POLICY IF EXISTS sanctions_admin_only ON public.user_sanctions;
    CREATE POLICY sanctions_admin_only ON public.user_sanctions FOR ALL
        USING (public.get_user_role() = 'admin')
        WITH CHECK (public.get_user_role() = 'admin');

    DROP POLICY IF EXISTS email_logs_admin_only ON public.email_logs;
    CREATE POLICY email_logs_admin_only ON public.email_logs FOR ALL
        USING (public.get_user_role() = 'admin')
        WITH CHECK (public.get_user_role() = 'admin');
    """)


def downgrade() -> None:
    # Désactive RLS et drop toutes les policies créées
    TABLES = [
        'profiles', 'deals', 'bids', 'ndas', 'payments',
        'deal_questions', 'deal_reviews', 'deal_units',
        'regional_partner_profiles', 'regional_territories',
        'user_sanctions', 'email_logs',
    ]
    for t in TABLES:
        op.execute(f"ALTER TABLE public.{t} DISABLE ROW LEVEL SECURITY")

    op.execute("DROP FUNCTION IF EXISTS public.get_user_role() CASCADE")
