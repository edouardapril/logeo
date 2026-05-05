import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Float, DateTime, Text, ForeignKey, Enum as SAEnum, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
import enum


class DealStatus(str, enum.Enum):
    draft = "draft"
    analyse = "analyse"
    bid = "bid"
    intro = "intro"
    pa_signed = "pa_signed"
    nogo = "nogo"


class PropertyType(str, enum.Enum):
    multiplex = "multiplex"
    commercial = "commercial"
    mixte = "mixte"
    industriel = "industriel"
    terrain = "terrain"


class Deal(Base):
    __tablename__ = "deals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    courtier_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    status: Mapped[DealStatus] = mapped_column(SAEnum(DealStatus), default=DealStatus.draft)
    property_type: Mapped[PropertyType] = mapped_column(SAEnum(PropertyType), nullable=False)

    city: Mapped[str] = mapped_column(String(100), nullable=False)
    # Jamais exposé avant le statut intro
    address_private: Mapped[str] = mapped_column(String(500), nullable=False)

    asking_price: Mapped[int] = mapped_column(Integer, nullable=False)
    gross_revenue: Mapped[int | None] = mapped_column(Integer)
    yield_pct: Mapped[float | None] = mapped_column(Float)
    num_units: Mapped[int | None] = mapped_column(Integer)

    # Visible dans le teaser public
    teaser_text: Mapped[str | None] = mapped_column(Text)
    # Visible après NDA
    full_report_path: Mapped[str | None] = mapped_column(String(500))

    # Documents: liste de paths (baux, taxes, cert. localisation, déclaration vendeur)
    documents: Mapped[dict | None] = mapped_column(JSON)

    bid_open_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    bid_close_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    nogo_reason: Mapped[str | None] = mapped_column(Text)

    # Frais Logeo calculés sur le bid gagnant
    fee_pct: Mapped[float | None] = mapped_column(Float)
    fee_minimum: Mapped[int | None] = mapped_column(Integer)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    courtier = relationship("User", back_populates="deals", foreign_keys=[courtier_id])
    bids = relationship("Bid", back_populates="deal", order_by="Bid.amount.desc()")
    ndas = relationship("NDA", back_populates="deal")
