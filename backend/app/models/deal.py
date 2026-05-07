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
    auction_ended = "auction_ended"  # Enchère fermée sans gagnant (0 bid / plancher non atteint)


class PropertyType(str, enum.Enum):
    # Anciennes valeurs (conservées pour compat données existantes)
    multiplex = "multiplex"
    commercial = "commercial"
    mixte = "mixte"
    industriel = "industriel"
    terrain = "terrain"
    # Nouvelles valeurs (sprint A)
    multilogement_2_6 = "multilogement_2_6"
    multilogement_7_24 = "multilogement_7_24"
    projet_24_plus = "projet_24_plus"
    terrain_constructible = "terrain_constructible"
    residentiel_plex = "residentiel_plex"


class Deal(Base):
    __tablename__ = "deals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    courtier_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    status: Mapped[DealStatus] = mapped_column(SAEnum(DealStatus), default=DealStatus.draft)
    property_type: Mapped[PropertyType] = mapped_column(SAEnum(PropertyType), nullable=False)

    city: Mapped[str] = mapped_column(String(100), nullable=False)
    region: Mapped[str | None] = mapped_column(String(80))   # Région administrative QC
    mrc: Mapped[str | None] = mapped_column(String(80))      # MRC
    # Jamais exposé avant le statut intro
    address_private: Mapped[str] = mapped_column(String(500), nullable=False)

    postal_code: Mapped[str | None] = mapped_column(String(10))

    asking_price: Mapped[int] = mapped_column(Integer, nullable=False)
    floor_price: Mapped[int | None] = mapped_column(Integer)  # admin only
    gross_revenue: Mapped[int | None] = mapped_column(Integer)
    yield_pct: Mapped[float | None] = mapped_column(Float)
    num_units: Mapped[int | None] = mapped_column(Integer)
    year_built: Mapped[int | None] = mapped_column(Integer)
    total_area_sqft: Mapped[int | None] = mapped_column(Integer)
    tax_roll_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    photo_paths: Mapped[list | None] = mapped_column(JSON)
    teaser_photo_paths: Mapped[list | None] = mapped_column(JSON)  # max 3 paths watermarquées

    # Visible dans le teaser public
    teaser_text: Mapped[str | None] = mapped_column(Text)
    # Visible après NDA
    full_report_path: Mapped[str | None] = mapped_column(String(500))

    # Documents: liste de paths (baux, taxes, cert. localisation, déclaration vendeur)
    documents: Mapped[dict | None] = mapped_column(JSON)

    bid_open_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    bid_close_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Enchère proxy
    min_bid_increment: Mapped[int] = mapped_column(Integer, nullable=False, default=10000, server_default="10000")
    teaser_photo_path: Mapped[str | None] = mapped_column(String(500))  # photo watermarquée publique

    nogo_reason: Mapped[str | None] = mapped_column(Text)

    # Données financières / fiche complète
    net_revenue: Mapped[int | None] = mapped_column(Integer)
    expenses: Mapped[dict | None] = mapped_column(JSON)
    revenue_history: Mapped[list | None] = mapped_column(JSON)
    municipal_evaluation: Mapped[int | None] = mapped_column(Integer)
    zoning: Mapped[str | None] = mapped_column(String(100))
    easements: Mapped[str | None] = mapped_column(Text)
    work_history: Mapped[list | None] = mapped_column(JSON)
    material_disclosures: Mapped[dict | None] = mapped_column(JSON)
    virtual_tour_url: Mapped[str | None] = mapped_column(String(500))
    inspection_report_path: Mapped[str | None] = mapped_column(String(500))
    cert_localisation_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    visit_notes: Mapped[str | None] = mapped_column(Text)

    # Frais Logeo calculés sur le bid gagnant
    fee_pct: Mapped[float | None] = mapped_column(Float)
    fee_minimum: Mapped[int | None] = mapped_column(Integer)

    # Échéances Stripe
    deposit_retry_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    due_diligence_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    due_diligence_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    courtier = relationship("User", back_populates="deals", foreign_keys=[courtier_id])
    bids = relationship("Bid", back_populates="deal", order_by="Bid.amount.desc()")
    ndas = relationship("NDA", back_populates="deal")
    payments = relationship("Payment", back_populates="deal")
    units = relationship("DealUnit", back_populates="deal", cascade="all, delete-orphan",
                          order_by="DealUnit.order_index")
    questions = relationship("DealQuestion", back_populates="deal", cascade="all, delete-orphan",
                              order_by="DealQuestion.asked_at.desc()")
