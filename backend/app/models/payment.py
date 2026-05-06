import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
import enum


class PaymentType(str, enum.Enum):
    deposit = "deposit"
    balance = "balance"


class PaymentState(str, enum.Enum):
    pending = "pending"
    requires_action = "requires_action"
    succeeded = "succeeded"
    failed = "failed"
    refunded = "refunded"


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deal_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("deals.id"), nullable=False, index=True)
    bid_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bids.id"), nullable=False, index=True)
    acheteur_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    type: Mapped[PaymentType] = mapped_column(SAEnum(PaymentType), nullable=False)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="cad")

    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String(120), unique=True)
    state: Mapped[PaymentState] = mapped_column(SAEnum(PaymentState), default=PaymentState.pending)

    failure_code: Mapped[str | None] = mapped_column(String(80))
    failure_message: Mapped[str | None] = mapped_column(String(500))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    succeeded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    failed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    deal = relationship("Deal", back_populates="payments")
    acheteur = relationship("User", back_populates="payments")
