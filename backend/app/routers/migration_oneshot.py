"""LOTPLOT 28-RUN — Route temporaire pour exécuter la migration users
vers Supabase Auth quand Railway CLI n'est pas disponible.

Endpoint : POST /api/v1/admin/run-supabase-migration?secret=XXX

Protection :
  - Requiert le query param `secret` qui doit matcher l'env var
    `MIGRATION_ONESHOT_SECRET` (set dans Railway temporairement).
  - PAS d'auth Supabase JWT — c'est INTENTIONNEL : au moment de
    l'exécution, public.profiles est encore vide donc require_admin
    via Supabase JWT échouerait. Le secret en query param est l'unique
    protection.

⚠️  À SUPPRIMER après exécution :
  1) UNSET MIGRATION_ONESHOT_SECRET dans Railway
  2) Retirer l'import + include_router dans `app/main.py`
  3) Supprimer ce fichier
  4) Push pour redéployer sans cette route

Idempotent : le script sous-jacent skip les users déjà migrés.
"""
import logging
import os
import sys
from io import StringIO

from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/admin", tags=["admin-oneshot"])
log = logging.getLogger("logeo.migration_oneshot")


def _check_secret(secret: str | None):
    expected = os.environ.get("MIGRATION_ONESHOT_SECRET")
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="MIGRATION_ONESHOT_SECRET non configurée — route désactivée. "
                   "Set la variable dans Railway pour activer temporairement.",
        )
    if not secret or secret != expected:
        # Anti-énumération : même message pour secret manquant ou faux
        raise HTTPException(status_code=403, detail="Secret invalide")


@router.post("/run-supabase-migration")
async def run_supabase_migration(secret: str | None = Query(default=None)):
    """Exécute le script `scripts/migrate_users_to_supabase.py` et retourne
    le summary (stdout + stderr capturés) en JSON.

    Idempotent — peut être rappelée plusieurs fois sans effet de bord.
    """
    _check_secret(secret)

    # Import paresseux du script pour éviter de l'exécuter au boot
    from scripts.migrate_users_to_supabase import migrate

    # Capture stdout/stderr du script pour le retourner au caller. Le script
    # utilise `logging` qui écrit sur stderr par défaut, on intercepte les
    # handlers root le temps de l'exécution.
    captured = StringIO()
    handler = logging.StreamHandler(captured)
    handler.setLevel(logging.INFO)
    handler.setFormatter(logging.Formatter('[%(asctime)s] %(levelname)s %(message)s', datefmt='%H:%M:%S'))
    root = logging.getLogger()
    prev_level = root.level
    root.addHandler(handler)
    root.setLevel(logging.INFO)

    exit_code = 0
    error_msg = None
    try:
        await migrate()
    except SystemExit as e:
        exit_code = int(e.code) if isinstance(e.code, int) else 1
        error_msg = "Script a appelé sys.exit avec code non-zéro"
    except Exception as e:
        exit_code = 99
        error_msg = f"{type(e).__name__}: {e}"
        log.error("Migration failed", exc_info=True)
    finally:
        root.removeHandler(handler)
        root.setLevel(prev_level)

    return {
        "exit_code": exit_code,
        "error": error_msg,
        "log": captured.getvalue(),
    }
