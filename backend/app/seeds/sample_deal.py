"""LOTPLOT 21 — seed d'un deal exemple consultable sans login.

Crée (ou met à jour) :
  1) un user fictif `Courtier Exemple` (rôle courtier, désactivé pour le login,
     `is_active=False`, mot de passe random non utilisable) ;
  2) un deal `is_sample=true` lié à ce courtier, avec dossier complet
     plausible — Multilogement 6-24 logements à Saint-Constant.

Idempotent : le lookup se fait sur `Deal.is_sample == True` (au plus un).
Si le sample deal existe déjà, on met à jour les champs métier ; on ne
recrée pas un duplicate.

Usage : python -m app.seeds.sample_deal
"""
import asyncio
import secrets
from datetime import datetime, timezone, timedelta

from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.deal import Deal, DealStatus, PropertyType
from app.models.user import User, UserRole
from app.services.auth import hash_password


SAMPLE_COURTIER_EMAIL = "exemple-courtier@logeo.demo"
SAMPLE_COURTIER_NAME = "Courtier Exemple Logeo"


# Champs métier du deal exemple — adresse, prix, baux, descriptifs.
# Volontairement plausible mais marqué clairement comme exemple.
SAMPLE_DEAL = {
    "property_type": PropertyType.multilogement_6_24,
    "city": "Saint-Constant",
    "region": "Montérégie",
    "mrc": "Roussillon",
    "postal_code": "J5A 0A0",
    "address_private": "Exemple — 123 rue Démo, Saint-Constant, QC J5A 0A0",
    "floor_price": 800_000,
    "gross_revenue": 96_000,
    "net_revenue": 64_000,
    "yield_pct": 8.0,
    "num_units": 8,
    "year_built": 1985,
    "total_area_sqft": 6800,
    "municipal_evaluation": 720_000,
    "teaser_text": (
        "Immeuble à revenus 8 logements bien entretenu, secteur en demande "
        "(Saint-Constant, Montérégie). Loyers stables, potentiel de "
        "majoration au renouvellement. Toiture refaite en 2018."
    ),
    "expenses": {
        "taxes_municipales": 11000,
        "taxes_scolaires": 1800,
        "assurances": 4200,
        "entretien": 8000,
        "frais_gestion": 4800,
        "autres": 2000,
    },
    "revenue_history": [
        {"year": 2023, "gross": 88000, "net": 58000},
        {"year": 2024, "gross": 92000, "net": 61000},
        {"year": 2025, "gross": 96000, "net": 64000},
    ],
    "zoning": "H-105 (résidentiel multi-familial)",
    "easements": "Aucune servitude active.",
    "work_history": [
        {"category": "toiture",   "year": 2018, "note": "Réfection complète membrane élastomère."},
        {"category": "fenetres",  "year": 2020, "note": "Fenêtres PVC remplacées (8 logements)."},
        {"category": "plomberie", "year": 2015, "note": "Mise à niveau partielle (cuivre→Pex)."},
    ],
    "material_disclosures": {
        "asbestos": "no",
        "pyrite": "no",
        "zoning_confirmed": "yes",
    },
    "visit_notes": (
        "Visites en groupe organisées par le courtier sur rendez-vous, "
        "samedi entre 10h et 14h. Demande : 24h de préavis."
    ),
}


async def _upsert_sample_courtier(db) -> User:
    """Récupère ou crée le courtier fictif. Mot de passe random non utilisable
    (compte désactivé pour le login : `is_active=False`)."""
    res = await db.execute(select(User).where(User.email == SAMPLE_COURTIER_EMAIL))
    user = res.scalar_one_or_none()
    if user:
        # Garde l'utilisateur existant — on met à jour le nom si modifié
        if user.full_name != SAMPLE_COURTIER_NAME:
            user.full_name = SAMPLE_COURTIER_NAME
        return user

    random_password = secrets.token_urlsafe(32)
    user = User(
        email=SAMPLE_COURTIER_EMAIL,
        hashed_password=hash_password(random_password),
        full_name=SAMPLE_COURTIER_NAME,
        phone="514-555-0100",
        role=UserRole.courtier,
        oaciq_number="EXEMPLE",
        agency_name="Agence Exemple inc.",
        is_active=False,           # ne peut pas se logger
        email_verified=True,
        # Convention "fictivement signée" pour qu'aucun gate ne lève
        convention_signed_at=datetime.now(timezone.utc),
        convention_clauses_version="v2-2026-05",
    )
    db.add(user)
    await db.flush()
    print(
        f"\n✓ Courtier exemple créé\n"
        f"  email   : {SAMPLE_COURTIER_EMAIL}\n"
        f"  user_id : {user.id}\n"
        f"  password: {random_password}  ← non utilisable (is_active=False)\n"
    )
    return user


async def _upsert_sample_deal(db, courtier: User) -> Deal:
    """Met à jour les champs métier du sample deal, ou crée le deal s'il
    n'existe pas encore. La détection se fait sur `is_sample=true`."""
    res = await db.execute(
        select(Deal).where(Deal.is_sample.is_(True)).limit(1)
    )
    existing = res.scalar_one_or_none()

    if existing:
        # Update : on rafraîchit les champs métier, on garde la même row.
        for k, v in SAMPLE_DEAL.items():
            setattr(existing, k, v)
        existing.courtier_id = courtier.id
        existing.status = DealStatus.bid
        existing.is_sample = True
        # Anti-snipe / fenêtre fictive — fermeture dans 30 jours pour que
        # le countdown reste affiché longtemps dans la vidéo.
        existing.bid_open_at = existing.bid_open_at or datetime.now(timezone.utc)
        existing.bid_close_at = datetime.now(timezone.utc) + timedelta(days=30)
        await db.flush()
        return existing

    deal = Deal(
        courtier_id=courtier.id,
        status=DealStatus.bid,
        is_sample=True,
        bid_open_at=datetime.now(timezone.utc),
        bid_close_at=datetime.now(timezone.utc) + timedelta(days=30),
        fee_pct=1.0,
        fee_minimum=0,
        **SAMPLE_DEAL,
    )
    db.add(deal)
    await db.flush()
    return deal


async def seed():
    async with AsyncSessionLocal() as db:
        courtier = await _upsert_sample_courtier(db)
        deal = await _upsert_sample_deal(db, courtier)
        await db.commit()
        print(
            f"✓ Sample deal upsert OK\n"
            f"  deal_id : {deal.id}\n"
            f"  city    : {deal.city}\n"
            f"  status  : {deal.status.value if hasattr(deal.status, 'value') else deal.status}\n"
            f"  is_sample : {deal.is_sample}\n"
            f"  bid_close_at : {deal.bid_close_at.isoformat()}\n"
            f"\n→ Page accessible : /exemple (frontend) ou /api/v1/public/sample-deal\n"
        )


if __name__ == "__main__":
    asyncio.run(seed())
