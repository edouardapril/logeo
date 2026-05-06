import uuid
from datetime import datetime
from sqlalchemy import Integer, DateTime, String, ForeignKey, Enum as SAEnum, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
import enum


class BidStatus(str, enum.Enum):
    active = "active"
    winner = "winner"
    loser = "loser"
    withdrawn = "withdrawn"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    deposit_sent = "deposit_sent"
    deposit_confirmed = "deposit_confirmed"
    balance_sent = "balance_sent"
    paid = "paid"
    failed = "failed"


class Bid(Base):
    __tablename__ = "bids"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deal_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("deals.id"), nullable=False)
    acheteur_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[BidStatus] = mapped_column(SAEnum(BidStatus), default=BidStatus.active)
    payment_status: Mapped[PaymentStatus] = mapped_column(SAEnum(PaymentStatus), default=PaymentStatus.pending)

    # Référence Interac fournie par l'admin
    interac_ref: Mapped[str | None] = mapped_column(String(100))
    # Path du rapport PDF watermarqué au nom de l'acheteur
    watermarked_path: Mapped[str | None] = mapped_column(String(500))

    # Engagement de paiement des frais Logeo signé avant le premier bid
    engagement_signed: Mapped[bool] = mapped_column(Boolean, default=False)
    engagement_signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Décharge obligatoire avant chaque enchère (4 cases cochées) — preuve légale
    disclaimer_signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    disclaimer_ip: Mapped[str | None] = mapped_column(String(64))
    disclaimer_user_agent: Mapped[str | None] = mapped_column(String(500))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    deal = relationship("Deal", back_populates="bids")
    acheteur = relationship("User", back_populates="bids")
