"""LOTPLOT 28 Phase 2 — Migration des users existants vers Supabase Auth.

Préserve les UUIDs existants pour ne pas casser les FK. Transfère le bcrypt
hash directement (Supabase accepte `$2a$`/`$2b$` via `password_hash` →
les users existants peuvent se logger avec leur mot de passe actuel).

Pour chaque row dans public.users :
  1) supabase.auth.admin.create_user({
       user_id: <uuid>,
       email: <email>,
       password_hash: <bcrypt $2b$...>,
       email_confirm: True,
       user_metadata: { full_name, role, phone, oaciq_number, agency_name },
     })
  2) INSERT INTO public.profiles (id, email, full_name, ...) si pas déjà
     créé par le trigger handle_new_user (le trigger ne copie qu'un sous-
     ensemble depuis user_metadata).
  3) UPDATE public.profiles SET <tous les champs métier de public.users>

Idempotent : si auth.users contient déjà ce user (lookup par email), on
skippe l'étape 1 et on UPSERT le profile.

Usage :
    cd backend
    python -m scripts.migrate_users_to_supabase

Variables env requises :
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY   # PAS l'anon key — il faut le service role
    DATABASE_URL                # déjà dans .env
"""
import asyncio
import logging
import os
import sys
from typing import Any
from uuid import UUID

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s %(message)s',
    datefmt='%H:%M:%S',
)
log = logging.getLogger("migrate_users")


SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip('/')
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "")


def _assert_env():
    missing = [k for k, v in {
        "SUPABASE_URL": SUPABASE_URL,
        "SUPABASE_SERVICE_ROLE_KEY": SUPABASE_SERVICE_ROLE_KEY,
        "DATABASE_URL": DATABASE_URL,
    }.items() if not v]
    if missing:
        log.error("Variables env manquantes : %s", ', '.join(missing))
        sys.exit(1)


def _admin_headers() -> dict:
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }


async def _lookup_auth_user(client: httpx.AsyncClient, email: str) -> dict | None:
    """Cherche un user dans auth.users par email. Retourne le dict ou None."""
    r = await client.get(
        f"{SUPABASE_URL}/auth/v1/admin/users",
        headers=_admin_headers(),
        params={"email": email},
    )
    r.raise_for_status()
    data = r.json()
    users = data.get("users", []) if isinstance(data, dict) else data
    for u in users:
        if (u.get("email") or "").lower() == email.lower():
            return u
    return None


async def _create_auth_user(
    client: httpx.AsyncClient,
    user_id: str,
    email: str,
    password_hash: str,
    metadata: dict,
) -> dict:
    """Crée un user Supabase Auth en préservant l'UUID + bcrypt hash."""
    payload = {
        "id": user_id,                  # ← critique : préserve l'UUID
        "email": email,
        "password_hash": password_hash,  # bcrypt $2b$... accepté par Supabase
        "email_confirm": True,           # bypass confirmation email
        "user_metadata": metadata,
    }
    r = await client.post(
        f"{SUPABASE_URL}/auth/v1/admin/users",
        headers=_admin_headers(),
        json=payload,
    )
    if r.status_code >= 400:
        log.error("Erreur création auth user %s : HTTP %s %s",
                  email, r.status_code, r.text)
        r.raise_for_status()
    return r.json()


PROFILE_COLUMNS = [
    "email", "full_name", "role", "phone",
    "oaciq_number", "agency_name", "convention_signed_at",
    "convention_signed_ip", "convention_signed_user_agent",
    "convention_clauses_version",
    "is_qualified", "engagement_signed_at",
    "stripe_customer_id", "stripe_payment_method_id",
    "payment_method_brand", "payment_method_last4",
    "payment_method_exp_month", "payment_method_exp_year",
    "profile_photo_path", "email_notifications",
    "tos_accepted_at", "tos_accepted_ip", "tos_accepted_version",
    "is_active", "deleted_at",
    "recruited_by_id", "recruited_at", "recruitment_notes",
]


async def _upsert_profile(db: AsyncSession, user_row: dict):
    """Insère ou met à jour la row dans public.profiles avec toutes les
    colonnes métier de l'ancien public.users."""
    placeholders = ", ".join(f":{c}" for c in PROFILE_COLUMNS)
    cols = ", ".join(PROFILE_COLUMNS)
    update_set = ", ".join(f"{c} = EXCLUDED.{c}" for c in PROFILE_COLUMNS)
    sql = text(f"""
        INSERT INTO public.profiles (id, {cols})
        VALUES (:id, {placeholders})
        ON CONFLICT (id) DO UPDATE SET {update_set}
    """)
    params = {"id": user_row["id"]}
    for c in PROFILE_COLUMNS:
        params[c] = user_row.get(c)
    await db.execute(sql, params)


async def migrate():
    _assert_env()

    async_db_url = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
    engine = create_async_engine(async_db_url)
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    summary = {"total": 0, "created": 0, "updated": 0, "skipped": 0, "errors": 0}

    async with httpx.AsyncClient(timeout=30.0) as client, Session() as db:
        res = await db.execute(text("SELECT * FROM public.users ORDER BY created_at ASC"))
        rows = [dict(r._mapping) for r in res.all()]
        summary["total"] = len(rows)
        log.info("→ %d users à migrer", len(rows))

        for u in rows:
            email = u["email"]
            try:
                existing = await _lookup_auth_user(client, email)
                if existing:
                    # Vérifie que l'UUID matche — sinon FK casseraient
                    if str(existing["id"]).lower() != str(u["id"]).lower():
                        log.error(
                            "UUID mismatch pour %s : DB=%s, Supabase=%s — SKIP",
                            email, u["id"], existing["id"],
                        )
                        summary["errors"] += 1
                        continue
                    log.info("Auth user déjà présent pour %s — upsert profile", email)
                    summary["skipped"] += 1
                else:
                    metadata = {
                        "full_name": u.get("full_name"),
                        "role": u.get("role"),
                        "phone": u.get("phone"),
                        "oaciq_number": u.get("oaciq_number"),
                        "agency_name": u.get("agency_name"),
                    }
                    metadata = {k: v for k, v in metadata.items() if v is not None}
                    await _create_auth_user(
                        client,
                        user_id=str(u["id"]),
                        email=email,
                        password_hash=u["hashed_password"],
                        metadata=metadata,
                    )
                    log.info("✓ Auth user créé pour %s", email)
                    summary["created"] += 1

                await _upsert_profile(db, u)

            except Exception as e:
                log.error("Erreur pour %s : %s", email, e, exc_info=True)
                summary["errors"] += 1

        await db.commit()

    await engine.dispose()

    log.info(
        "Résumé : %d total · %d créés · %d skipped · %d errors",
        summary["total"], summary["created"], summary["skipped"], summary["errors"],
    )
    if summary["errors"] > 0:
        sys.exit(2)


if __name__ == "__main__":
    asyncio.run(migrate())
