"""LOTPLOT 29 — Seed des comptes admin Pierre & Gilles.

Idempotent : pour chaque admin, lookup par email.
  - si présent  → reset hashed_password + role + full_name + flags
  - si absent   → INSERT nouveau user

Usage :
    # Depuis la racine du repo, via Railway (recommandé) :
    railway run --service logeo python backend/scripts/seed_admins.py

    # Local (DATABASE_URL doit pointer sur la prod) :
    python backend/scripts/seed_admins.py
"""
import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

# Rendre `app.*` importable quel que soit le cwd.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402

from app.database import AsyncSessionLocal  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402
from app.services.auth import hash_password  # noqa: E402


ADMINS = [
    {
        "email": "pierre@groupeb10.com",
        "password": "Pete123!",
        "full_name": "Pierre Baillargeon",
    },
    {
        "email": "gillesapril321@gmail.com",
        "password": "Papa123!",
        "full_name": "Gilles April",
    },
]


async def _upsert_admin(db, *, email: str, password: str, full_name: str) -> tuple[str, str]:
    """Upsert un admin. Retourne (action, user_id) — action ∈ {created, updated}."""
    res = await db.execute(select(User).where(User.email == email))
    user = res.scalar_one_or_none()
    hashed = hash_password(password)

    if user is not None:
        user.hashed_password = hashed
        user.role = UserRole.admin
        user.full_name = full_name
        user.is_active = True
        user.is_qualified = True
        user.email_notifications = True
        user.email_verified = True
        user.deleted_at = None
        await db.flush()
        return "updated", str(user.id)

    user = User(
        email=email,
        hashed_password=hashed,
        full_name=full_name,
        role=UserRole.admin,
        is_active=True,
        is_qualified=True,
        email_notifications=True,
        email_verified=True,
        created_at=datetime.now(timezone.utc),
    )
    db.add(user)
    await db.flush()
    return "created", str(user.id)


async def seed():
    async with AsyncSessionLocal() as db:
        for admin in ADMINS:
            action, user_id = await _upsert_admin(db, **admin)
            marker = "✓" if action == "created" else "↻"
            print(
                f"{marker} [{action}] {admin['email']}  "
                f"({admin['full_name']})  role=admin  id={user_id}"
            )
        await db.commit()
        print(f"\n→ {len(ADMINS)} admin(s) upsert OK. Hashes bcrypt $2b$12$ générés.")


if __name__ == "__main__":
    asyncio.run(seed())
