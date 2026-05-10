"""LOTPLOT 28-SEQ — Restaure le FK profiles.id → auth.users(id).

⚠️  À APPLIQUER MANUELLEMENT après que `migrate_users_to_supabase.py`
ait peuplé auth.users. Sinon, la création du FK échoue car les rows
de profiles ne correspondent à aucune row de auth.users.

Pourquoi pas dans le boot ?
La migration 6f708192a3b4 (FK switch) a délibérément droppé ce FK pour
permettre de peupler profiles AVANT que auth.users existe. Restaurer
le FK est l'étape qui clôt la migration LOTPLOT 28.

Comment l'appliquer :

  1) Vérifier que auth.users contient les rows :
       SELECT count(*) FROM auth.users;          -- doit être 5
       SELECT count(*) FROM public.profiles;     -- doit être 5
       SELECT count(*) FROM public.profiles p
       LEFT JOIN auth.users au ON au.id = p.id
       WHERE au.id IS NULL;                       -- doit être 0 (aucun orphelin)

  2) Déplacer ce fichier vers `alembic/versions/` :
       mv backend/alembic/versions_deferred/7a8b9c0d1e2f_lotplot28_restore_profiles_auth_fk.py \\
          backend/alembic/versions/

  3) Si nécessaire, mettre à jour `down_revision` pour pointer sur la
     révision actuellement au HEAD (probablement `8192a3b4c5d6` après
     LOTPLOT 28-SEQ). Vérifier avec :
       alembic heads

  4) Appliquer :
       alembic upgrade head

  5) Commit + push pour persister la migration dans le repo.

Idempotente. Reversible (downgrade drop le FK).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# Ces deux valeurs SERONT à ajuster au moment de déplacer le fichier dans
# versions/. Le `down_revision` doit être le HEAD courant à ce moment-là.
revision: str = '7a8b9c0d1e2f'
down_revision: Union[str, None] = '8192a3b4c5d6'  # actuellement = HEAD (RLS policies)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _constraint_exists(name: str) -> bool:
    bind = op.get_bind()
    return bool(bind.execute(sa.text(
        "SELECT 1 FROM pg_constraint WHERE conname = :n"
    ), {"n": name}).scalar())


def upgrade() -> None:
    bind = op.get_bind()

    # Garde-fou : refuse de poser le FK si auth.users est vide → ça
    # casserait toute la table profiles (CASCADE → autres tables…).
    auth_users_count = bind.execute(sa.text("SELECT count(*) FROM auth.users")).scalar() or 0
    profiles_count = bind.execute(sa.text("SELECT count(*) FROM public.profiles")).scalar() or 0
    if auth_users_count == 0:
        raise RuntimeError(
            "Refus d'appliquer 7a8b9c0d1e2f : auth.users est vide. "
            "Exécuter `migrate_users_to_supabase.py` AVANT cette migration."
        )
    if profiles_count > auth_users_count:
        # Vérifie qu'il n'y a aucun orphelin avant de poser le FK
        orphans = bind.execute(sa.text("""
            SELECT count(*) FROM public.profiles p
            LEFT JOIN auth.users au ON au.id = p.id
            WHERE au.id IS NULL
        """)).scalar() or 0
        if orphans > 0:
            raise RuntimeError(
                f"Refus d'appliquer : {orphans} profile(s) sans auth.users correspondant. "
                "Vérifier la cohérence des UUIDs avant de poser le FK."
            )

    if not _constraint_exists('profiles_id_fkey'):
        op.execute(
            "ALTER TABLE public.profiles "
            "ADD CONSTRAINT profiles_id_fkey "
            "FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE"
        )


def downgrade() -> None:
    if _constraint_exists('profiles_id_fkey'):
        op.execute("ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey")
