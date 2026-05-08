"""Seed des 3 territoires régionaux initiaux. Idempotent (UPSERT par code).

Crée les territoires s'ils n'existent pas, met à jour le `name` s'il a
changé. N'écrase ni ne désactive un territoire existant : si un code
disparaît du dictionnaire TERRITORIES, le territoire correspondant n'est
PAS supprimé (les FK pointant vers lui resteraient orphelines).

Usage : python -m app.seeds.regional_territories
"""
import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.regional_territory import RegionalTerritory


TERRITORIES = [
    {
        "code": "MTL_CENTRE_EST",
        "name": "Grand Montréal — Centre/Est",
    },
    {
        "code": "MTL_COURONNES",
        "name": "Grand Montréal — Couronnes (Laval, Rive-Sud, Rive-Nord, Laurentides)",
    },
    {
        "code": "QUEBEC_CAPITALE",
        "name": "Capitale-Nationale (Québec et environs)",
    },
]


async def seed():
    created, updated, unchanged = 0, 0, 0
    async with AsyncSessionLocal() as db:
        for t in TERRITORIES:
            res = await db.execute(
                select(RegionalTerritory).where(RegionalTerritory.code == t["code"])
            )
            existing = res.scalar_one_or_none()
            if existing is None:
                db.add(RegionalTerritory(code=t["code"], name=t["name"]))
                created += 1
            elif existing.name != t["name"]:
                existing.name = t["name"]
                updated += 1
            else:
                unchanged += 1
        await db.commit()
    print(
        f"✓ Territoires régionaux : {created} créés, {updated} mis à jour, "
        f"{unchanged} inchangés (total {len(TERRITORIES)})."
    )


if __name__ == "__main__":
    asyncio.run(seed())
