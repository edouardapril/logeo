import uuid
from datetime import datetime
from pydantic import BaseModel
from app.models.deal import DealStatus, PropertyType


class DealSubmit(BaseModel):
    property_type: PropertyType
    city: str
    address_private: str
    asking_price: int
    gross_revenue: int | None = None
    yield_pct: float | None = None
    num_units: int | None = None
    teaser_text: str | None = None


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


# Vue teaser : JAMAIS address_private ni courtier_id
class DealTeaser(BaseModel):
    id: uuid.UUID
    status: DealStatus
    property_type: PropertyType
    city: str
    asking_price: int
    gross_revenue: int | None
    yield_pct: float | None
    num_units: int | None
    teaser_text: str | None
    bid_open_at: datetime | None
    bid_close_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


# Vue complète après NDA : adresse + courtier dévoilés
class DealFull(DealTeaser):
    address_private: str
    courtier_name: str
    courtier_email: str
    courtier_phone: str | None
    agency_name: str | None
    full_report_path: str | None
    documents: dict | None

    model_config = {"from_attributes": True}


# Vue admin : tout
class DealAdminView(DealFull):
    courtier_id: uuid.UUID
    nogo_reason: str | None
    fee_pct: float | None
    fee_minimum: int | None
    updated_at: datetime

    model_config = {"from_attributes": True}


class DealListItem(BaseModel):
    id: uuid.UUID
    status: DealStatus
    property_type: PropertyType
    city: str
    asking_price: int
    bid_close_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
