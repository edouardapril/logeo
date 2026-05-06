import uuid
from datetime import datetime
from pydantic import BaseModel
from app.models.payment import PaymentType, PaymentState


class SetupIntentResponse(BaseModel):
    client_secret: str
    publishable_key: str


class ConfirmPaymentMethodRequest(BaseModel):
    payment_method_id: str


class PaymentMethodView(BaseModel):
    has_card: bool
    brand: str | None = None
    last4: str | None = None
    exp_month: int | None = None
    exp_year: int | None = None


class FeeQuote(BaseModel):
    sale_price: int
    total_fee: int
    deposit: int
    balance: int


class PaymentView(BaseModel):
    id: uuid.UUID
    deal_id: uuid.UUID
    bid_id: uuid.UUID
    acheteur_id: uuid.UUID
    type: PaymentType
    amount_cents: int
    currency: str
    state: PaymentState
    stripe_payment_intent_id: str | None
    failure_code: str | None
    failure_message: str | None
    created_at: datetime
    succeeded_at: datetime | None
    failed_at: datetime | None

    model_config = {"from_attributes": True}


class PaymentAdminView(PaymentView):
    acheteur_name: str
    deal_city: str
