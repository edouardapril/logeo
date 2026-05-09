import uuid
from datetime import datetime
from pydantic import BaseModel, field_validator
from app.models.bid import BidStatus, PaymentStatus


class BidCreate(BaseModel):
    amount: int
    # Décharge obligatoire : 4 cases doivent être cochées
    consent_documentation: bool = False
    consent_questions_visit: bool = False
    consent_firm_offer: bool = False
    consent_fees_and_deposit: bool = False

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Le montant doit être positif")
        return v


class BidEngagementSign(BaseModel):
    # L'acheteur confirme avoir lu et accepté l'engagement de paiement des frais
    accepted: bool

    @field_validator("accepted")
    @classmethod
    def must_accept(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Vous devez accepter l'engagement de paiement")
        return v


# Ce que voit l'acheteur de ses propres bids
class BidOwnerView(BaseModel):
    id: uuid.UUID
    deal_id: uuid.UUID
    amount: int
    status: BidStatus
    payment_status: PaymentStatus
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# Réponse après POST /acheteur/deals/{id}/bids — bid créé + nouvel auction_state
# (vue acheteur : `current_price`, `i_am_leading`, `my_max`, jamais les maxs des autres)
class BidPlacedResponse(BaseModel):
    bid: BidOwnerView
    auction_state: dict


# Classement anonyme visible par tous les acheteurs (position seulement, pas les montants)
class BidRankItem(BaseModel):
    rank: int
    is_mine: bool


# Vue admin complète
class BidAdminView(BaseModel):
    id: uuid.UUID
    deal_id: uuid.UUID
    acheteur_id: uuid.UUID
    acheteur_name: str
    amount: int
    status: BidStatus
    payment_status: PaymentStatus
    interac_ref: str | None
    created_at: datetime
    disclaimer_signed_at: datetime | None = None
    disclaimer_ip: str | None = None

    model_config = {"from_attributes": True}


class InteracConfirm(BaseModel):
    interac_ref: str
    bid_id: uuid.UUID
    payment_type: str  # "deposit" ou "balance"
