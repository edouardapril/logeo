from pydantic import BaseModel
from datetime import datetime


class ConventionSignRequest(BaseModel):
    # Les 4 clauses doivent toutes être à True (validé côté serveur)
    consent_floor_price_binding: bool = False
    consent_no_circumvention: bool = False
    consent_data_accuracy: bool = False
    consent_penalties: bool = False


class ConventionStatus(BaseModel):
    signed: bool
    signed_at: datetime | None = None
    version: str | None = None
    required_version: str
    needs_resign: bool = False
