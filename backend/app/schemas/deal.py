import uuid
from datetime import datetime
from pydantic import BaseModel
from app.models.deal import DealStatus, PropertyType


class DealSubmit(BaseModel):
    property_type: PropertyType
    city: str
    postal_code: str
    address_private: str
    asking_price: int
    floor_price: int | None = None
    gross_revenue: int | None = None
    net_revenue: int | None = None
    yield_pct: float | None = None
    num_units: int | None = None
    teaser_text: str | None = None
    # Financials
    expenses: dict | None = None
    revenue_history: list | None = None
    municipal_evaluation: int | None = None
    # Property meta
    zoning: str | None = None
    easements: str | None = None
    work_history: list | None = None
    material_disclosures: dict | None = None
    # Visit
    virtual_tour_url: str | None = None
    visit_notes: str | None = None


class DealPatch(BaseModel):
    """Champs modifiables après soumission (par le courtier propriétaire)."""
    teaser_text: str | None = None
    gross_revenue: int | None = None
    net_revenue: int | None = None
    expenses: dict | None = None
    revenue_history: list | None = None
    municipal_evaluation: int | None = None
    zoning: str | None = None
    easements: str | None = None
    work_history: list | None = None
    material_disclosures: dict | None = None
    virtual_tour_url: str | None = None
    visit_notes: str | None = None
    yield_pct: float | None = None
    num_units: int | None = None
    floor_price: int | None = None  # ignoré côté courtier — admin-only patch séparé


class DealAdminUpdate(BaseModel):
    teaser_text: str | None = None
    fee_pct: float | None = None
    fee_minimum: int | None = None
    bid_close_at: datetime | None = None


class DealVerdict(BaseModel):
    verdict: str  # "go" ou "nogo"
    nogo_reason: str | None = None
    fee_pct: float | None = None
    fee_minimum: int | None = None
    bid_close_at: datetime | None = None


# Vue teaser : JAMAIS address_private ni courtier_id, mais floor_price devient public (sprint B)
class DealTeaser(BaseModel):
    id: uuid.UUID
    status: DealStatus
    property_type: PropertyType
    city: str
    postal_code: str | None = None
    asking_price: int
    floor_price: int | None = None
    min_bid_increment: int = 10000
    gross_revenue: int | None
    net_revenue: int | None = None
    yield_pct: float | None
    num_units: int | None
    teaser_text: str | None
    teaser_photo_path: str | None = None  # photo watermarquée publique
    municipal_evaluation: int | None = None
    bid_open_at: datetime | None
    bid_close_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


# Vue complète après NDA : adresse + courtier dévoilés + financials + photos privées
class DealFull(DealTeaser):
    address_private: str
    courtier_name: str
    courtier_email: str
    courtier_phone: str | None
    agency_name: str | None
    full_report_path: str | None
    photo_paths: list | None = None  # originaux haute résolution, post-NDA
    documents: dict | None
    expenses: dict | None = None
    revenue_history: list | None = None
    zoning: str | None = None
    easements: str | None = None
    work_history: list | None = None
    material_disclosures: dict | None = None
    virtual_tour_url: str | None = None
    inspection_report_path: str | None = None
    cert_localisation_date: datetime | None = None
    visit_notes: str | None = None

    model_config = {"from_attributes": True}


# Vue admin : tout (incl. floor_price)
class DealAdminView(DealFull):
    courtier_id: uuid.UUID
    nogo_reason: str | None
    fee_pct: float | None
    fee_minimum: int | None
    floor_price: int | None = None
    updated_at: datetime

    model_config = {"from_attributes": True}


class DealListItem(BaseModel):
    id: uuid.UUID
    status: DealStatus
    property_type: PropertyType
    city: str
    postal_code: str | None = None
    asking_price: int
    bid_close_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
