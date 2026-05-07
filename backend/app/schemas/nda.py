import uuid
from datetime import datetime
from pydantic import BaseModel, field_serializer
from app.services import storage as storage_svc


class NDASign(BaseModel):
    accepted: bool = True  # rétro-compat avec l'ancien client
    # Sprint final item 8 — chaque clause cochée individuellement
    consent_confidentiality: bool = False
    consent_no_direct_contact: bool = False
    consent_logeo_exclusive_source: bool = False
    consent_no_third_party_share: bool = False


class NDAConfirmation(BaseModel):
    id: uuid.UUID
    deal_id: uuid.UUID
    signed_at: datetime
    ip_address: str
    pdf_path: str | None = None

    model_config = {"from_attributes": True}

    @field_serializer('pdf_path')
    def _ser_pdf_path(self, v):
        return storage_svc.to_signed_url(v)
