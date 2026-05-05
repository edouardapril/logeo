import uuid
from datetime import datetime
from pydantic import BaseModel


class NDASign(BaseModel):
    accepted: bool

    @classmethod
    def must_accept(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Vous devez accepter le NDA pour accéder au dossier")
        return v


class NDAConfirmation(BaseModel):
    id: uuid.UUID
    deal_id: uuid.UUID
    signed_at: datetime
    ip_address: str

    model_config = {"from_attributes": True}
