"""
Abstraction de stockage de fichiers.

Backends supportés via STORAGE_BACKEND :
  - "local"    → écrit dans ./uploads/<key>, servi par /uploads/* (StaticFiles)
  - "supabase" → écrit dans un bucket Supabase Storage via REST API

Format d'un "path" stocké en DB :
  - local    : "uploads/<subfolder>/<file>"
  - supabase : "<bucket>/<key>"  où bucket ∈ {deals, documents, profiles}
                Le code applicatif décide du bucket à l'upload ;
                la lecture utilise toujours signed_url() ou public_url().

Conventions de bucket :
  - deals     : photos publiques (teaser watermarqué) — accès lecture libre
  - documents : photos non-watermarquées + PDFs sensibles — accès post-NDA via signed URL
  - profiles  : photos de profil utilisateur — signed URL
"""
import os
import uuid
import re
import httpx
import logging
from app.config import get_settings

settings = get_settings()
log = logging.getLogger(__name__)

LOCAL_DIR = "uploads"

KIND_DEALS = "deals"
KIND_DOCUMENTS = "documents"
KIND_PROFILES = "profiles"

_BUCKET_BY_KIND = {
    KIND_DEALS: lambda: settings.supabase_bucket_deals,
    KIND_DOCUMENTS: lambda: settings.supabase_bucket_documents,
    KIND_PROFILES: lambda: settings.supabase_bucket_profiles,
}


def _safe_filename(filename: str) -> str:
    base = os.path.basename(filename or "file")
    base = re.sub(r"[^A-Za-z0-9._-]", "_", base)
    return f"{uuid.uuid4()}_{base}"[:200]


def _is_supabase() -> bool:
    return settings.storage_backend == "supabase" and bool(settings.supabase_url)


def _supabase_headers() -> dict:
    return {
        "apikey": settings.supabase_service_key,
        "Authorization": f"Bearer {settings.supabase_service_key}",
    }


def _bucket(kind: str) -> str:
    factory = _BUCKET_BY_KIND.get(kind)
    if not factory:
        raise ValueError(f"Unknown storage kind: {kind}")
    return factory()


# ── Upload ────────────────────────────────────────────────────────────────────

def save(content: bytes, filename: str, kind: str, subfolder: str = "",
         content_type: str = "application/octet-stream") -> str:
    """
    Sauvegarde un fichier et retourne le path à stocker en DB.
    Le path inclut un préfixe permettant à `signed_url`/`public_url` de router :
      - local    : "uploads/<sub>/<safe>"
      - supabase : "<bucket>/<sub>/<safe>"
    """
    safe = _safe_filename(filename)
    sub = subfolder.strip("/")
    rel_key = f"{sub}/{safe}" if sub else safe

    if _is_supabase():
        bucket = _bucket(kind)
        url = f"{settings.supabase_url}/storage/v1/object/{bucket}/{rel_key}"
        headers = _supabase_headers() | {
            "Content-Type": content_type,
            "x-upsert": "true",
        }
        try:
            r = httpx.post(url, headers=headers, content=content, timeout=30.0)
            r.raise_for_status()
        except httpx.HTTPError as e:
            log.error("Supabase upload failed: %s", e)
            raise
        return f"{bucket}/{rel_key}"

    # Local fallback
    folder = os.path.join(LOCAL_DIR, sub) if sub else LOCAL_DIR
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, safe).replace("\\", "/")
    with open(path, "wb") as f:
        f.write(content)
    return path  # ex: "uploads/deals/abc/foo.jpg"


# ── Lecture ───────────────────────────────────────────────────────────────────

def _split_supabase(path: str) -> tuple[str, str] | None:
    """Renvoie (bucket, key) si le path correspond à un bucket Supabase connu, sinon None."""
    if not path:
        return None
    p = path.replace("\\", "/").lstrip("/")
    if p.startswith("uploads/"):
        return None
    head = p.split("/", 1)[0]
    known_buckets = {
        settings.supabase_bucket_deals,
        settings.supabase_bucket_documents,
        settings.supabase_bucket_profiles,
    }
    if head in known_buckets and "/" in p:
        bucket, key = p.split("/", 1)
        return (bucket, key)
    return None


def public_url(path: str) -> str:
    """URL publique (bucket public Supabase ou route /uploads/* locale)."""
    sb = _split_supabase(path)
    if sb:
        bucket, key = sb
        return f"{settings.supabase_url}/storage/v1/object/public/{bucket}/{key}"
    # local
    p = path.replace("\\", "/").lstrip("/")
    if not p.startswith("uploads/"):
        p = f"uploads/{p}"
    return f"{settings.backend_url}/{p}"


def signed_url(path: str, expires_in: int | None = None) -> str:
    """Signed URL côté Supabase ; côté local on retombe sur public_url."""
    sb = _split_supabase(path)
    if not sb:
        return public_url(path)
    bucket, key = sb
    ttl = expires_in or settings.signed_url_ttl_seconds
    url = f"{settings.supabase_url}/storage/v1/object/sign/{bucket}/{key}"
    try:
        r = httpx.post(url, headers=_supabase_headers(),
                       json={"expiresIn": ttl}, timeout=15.0)
        r.raise_for_status()
        data = r.json()
        signed = data.get("signedURL") or data.get("signedUrl") or ""
        if signed.startswith("/"):
            signed = f"{settings.supabase_url}/storage/v1{signed}"
        return signed
    except httpx.HTTPError as e:
        log.error("Supabase signed_url failed: %s", e)
        return public_url(path)


def delete(path: str) -> None:
    sb = _split_supabase(path)
    if not sb:
        try:
            os.remove(path)
        except OSError:
            pass
        return
    bucket, key = sb
    url = f"{settings.supabase_url}/storage/v1/object/{bucket}/{key}"
    try:
        httpx.delete(url, headers=_supabase_headers(), timeout=15.0)
    except httpx.HTTPError as e:
        log.warning("Supabase delete failed: %s", e)


def read(path: str) -> bytes:
    """Lit le contenu binaire d'un fichier précédemment sauvé via save().

    Local : ouvre le fichier sur disque.
    Supabase : GET via signed URL (works pour les buckets privés et publics).
    """
    sb = _split_supabase(path)
    if not sb:
        with open(path, "rb") as f:
            return f.read()
    url = signed_url(path, expires_in=60)
    r = httpx.get(url, timeout=30.0)
    r.raise_for_status()
    return r.content


# ── Sérialisation : path → URL utilisable par le frontend ───────────────────
#
# Les helpers ci-dessous sont utilisés par les schemas Pydantic (field_serializer)
# et les endpoints qui retournent des dicts ad-hoc, pour transformer les paths
# stockés en DB en URLs prêtes à l'affichage. La DB conserve toujours le path
# brut — la transformation est purement un step de sérialisation.

def to_public_url(path: str | None) -> str | None:
    """Path bucket public (deals) → URL publique directe."""
    return public_url(path) if path else None


def to_public_urls(paths: list | None) -> list[str] | None:
    """Liste de paths publics → liste d'URLs publiques."""
    if not paths:
        return None
    return [public_url(p) for p in paths if p]


def to_signed_url(path: str | None) -> str | None:
    """Path bucket privé (documents, profiles) → signed URL avec TTL."""
    return signed_url(path) if path else None


def to_signed_urls(paths: list | None) -> list[str] | None:
    """Liste de paths privés → liste de signed URLs."""
    if not paths:
        return None
    return [signed_url(p) for p in paths if p]


def to_signed_url_values(d: dict | None) -> dict | None:
    """Transforme les VALEURS d'un dict en signed URLs (clés intactes).

    Utilisé pour le champ Deal.documents = {"baux": "documents/...", "taxes": "..."}.
    """
    if not d:
        return None
    return {
        k: (signed_url(v) if isinstance(v, str) and v else v)
        for k, v in d.items()
    }
