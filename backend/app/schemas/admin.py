"""Schemas spécifiques au dashboard admin (sprint admin)."""
import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class ActiveAuctionView(BaseModel):
    deal_id: uuid.UUID
    city: str
    bid_close_at: datetime | None
    bidders_count: int
    displayed_price: int | None
    closing_soon: bool  # ferme dans <2h


class DDExpiringView(BaseModel):
    deal_id: uuid.UUID
    city: str
    acheteur_name: str | None = None
    due_diligence_deadline: datetime | None
    hours_remaining: float


class AdminMetrics(BaseModel):
    active_auctions: list[ActiveAuctionView]
    auctions_closing_soon: int             # # enchères <2h
    revenue_this_month_cents: int          # tous paiements succeeded ce mois
    revenue_total_cents: int               # tous paiements succeeded
    pending_balance_cents: int             # deposit succeeded mais balance pas encore
    due_diligence_window: list[DDExpiringView]
    dd_expiring_soon: int                  # # DD expirant <24h


class DealAdminListItem(BaseModel):
    id: uuid.UUID
    status: str
    property_type: str
    city: str
    floor_price: int | None = None
    bid_close_at: datetime | None
    created_at: datetime
    archived_at: datetime | None = None
    bids_count: int = 0
    ndas_count: int = 0
    unanswered_questions_count: int = 0


class ExtendBidCloseRequest(BaseModel):
    bid_close_at: datetime


# ── Sanctions ────────────────────────────────────────────────────────────────

class SanctionCreate(BaseModel):
    user_id: uuid.UUID
    reason: str = Field(min_length=3, max_length=4000)
    severity: str = "suspension"  # 'warning' | 'suspension' | 'expulsion'
    related_deal_id: uuid.UUID | None = None
    deposit_kept_cad: int | None = None


class SanctionLift(BaseModel):
    lifted_reason: str = Field(min_length=3, max_length=4000)


class SanctionView(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    user_email: str | None = None
    user_full_name: str | None = None
    reason: str
    severity: str
    related_deal_id: uuid.UUID | None = None
    deposit_kept_cad: int | None = None
    created_at: datetime
    created_by: uuid.UUID
    lifted_at: datetime | None = None
    lifted_by: uuid.UUID | None = None
    lifted_reason: str | None = None


# ── Users tabs ───────────────────────────────────────────────────────────────

class AcheteurAdminRow(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    phone: str | None = None
    is_active: bool
    is_qualified: bool
    has_card: bool
    won_deals: int = 0
    average_rating: float | None = None
    review_count: int = 0
    has_active_sanction: bool = False
    created_at: datetime


class CourtierAdminRow(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    phone: str | None = None
    is_active: bool
    agency_name: str | None = None
    oaciq_number: str | None = None
    submitted_deals: int = 0
    completed_deals: int = 0
    convention_signed_at: datetime | None = None
    average_rating: float | None = None
    review_count: int = 0
    has_active_sanction: bool = False
    created_at: datetime


class PendingApprovalRow(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    role: str
    phone: str | None = None
    created_at: datetime
