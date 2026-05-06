import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class QuestionCreate(BaseModel):
    question: str = Field(min_length=3, max_length=2000)


class QuestionAnswer(BaseModel):
    answer: str = Field(min_length=1, max_length=4000)


class QuestionView(BaseModel):
    id: uuid.UUID
    deal_id: uuid.UUID
    question: str
    answer: str | None = None
    asked_at: datetime
    answered_at: datetime | None = None
    is_mine: bool = False  # rempli côté route pour l'acheteur

    model_config = {"from_attributes": True}
