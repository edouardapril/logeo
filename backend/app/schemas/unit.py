import uuid
from datetime import datetime
from pydantic import BaseModel, field_serializer
from app.services import storage as storage_svc


class UnitWrite(BaseModel):
    label: str
    unit_type: str | None = None
    area_sqft: int | None = None
    current_rent: int | None = None
    market_rent: int | None = None
    lease_end: datetime | None = None
    occupancy_status: str | None = None
    notes: str | None = None
    order_index: int = 0


class UnitView(UnitWrite):
    id: uuid.UUID
    deal_id: uuid.UUID
    photo_paths: list | None = None
    lease_path: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer('photo_paths')
    def _ser_photo_paths(self, v):
        return storage_svc.to_signed_urls(v)

    @field_serializer('lease_path')
    def _ser_lease_path(self, v):
        return storage_svc.to_signed_url(v)
