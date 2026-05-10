"""merge_lotplot28_branches

Équivalent de `alembic merge heads -m "merge_lotplot28_branches"`.

LOTPLOT 28 a accidentellement créé 2 têtes Alembic divergentes :
  - 8192a3b4c5d6 (RLS policies)
  - 708192a3b4c5 (DROP public.users DEFERRED)

Les deux pointaient sur `6f708192a3b4` comme down_revision, donc Alembic
a deux HEAD candidats. Railway crash : "Multiple head revisions are
present for given argument 'head'".

Cette migration de merge ne fait RIEN (pas d'op SQL) — son seul rôle est
de réunir les deux branches en un seul head, pour qu'`alembic upgrade head`
fonctionne à nouveau.

⚠️  AVERTISSEMENT IMPORTANT — DROP USERS S'EXÉCUTERA AUTOMATIQUEMENT ⚠️
----------------------------------------------------------------------
Au prochain `alembic upgrade head`, alembic appliquera TOUTES les
migrations non appliquées entre l'état courant et ce merge, ce qui
INCLUT `708192a3b4c5_lotplot28_drop_users_DEFERRED` → DROP TABLE
public.users CASCADE.

C'est IRRÉVERSIBLE. Si tu n'es PAS prêt à dropper public.users
(typiquement : la validation 24-48 h post-Supabase migration n'a pas
encore eu lieu), tu as 2 options sûres :

  A) Avant `alembic upgrade head` : faire un dump
       pg_dump -t public.users $DATABASE_URL > backup_users.sql

  B) Ou commenter/supprimer cette migration de merge ET déplacer
     `708192a3b4c5_lotplot28_drop_users_DEFERRED.py` hors de versions/
     (ex: `alembic/versions_deferred/`). Alembic ne le voit alors plus
     et `8192a3b4c5d6` redevient le seul head. Le deploy fonctionne
     sans risque de drop. Réintroduire le drop comme migration séparée
     après validation.

Revision ID: 9a8b7c6d5e4f
Revises: 8192a3b4c5d6, 708192a3b4c5
Create Date: 2026-05-10 21:00:00.000000
"""
from typing import Sequence, Union

from alembic import op


revision: str = '9a8b7c6d5e4f'
# down_revision est un tuple — c'est ce qui fait de cette migration un MERGE
down_revision: Union[str, Sequence[str], None] = ('8192a3b4c5d6', '708192a3b4c5')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # No-op : ce merge ne fait que réunir les 2 branches Alembic.
    pass


def downgrade() -> None:
    pass
