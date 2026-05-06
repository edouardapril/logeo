import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = None


class ReviewView(BaseModel):
    id: uuid.UUID
    deal_id: uuid.UUID
    rater_id: uuid.UUID
    ratee_id: uuid.UUID
    rater_role: str
    rating: int
    comment: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ReviewWithMeta(ReviewView):
    rater_name: str | None = None
    rater_role_label: str | None = None  # 'Courtier' / 'Acheteur'
    deal_city: str | None = None
