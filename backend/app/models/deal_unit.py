import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class DealUnit(Base):
    __tablename__ = "deal_units"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deals.id", ondelete="CASCADE"), nullable=False, index=True,
    )

    label: Mapped[str] = mapped_column(String(80), nullable=False)
    unit_type: Mapped[str | None] = mapped_column(String(20))     # "3½", "4½", "5½", etc.
    area_sqft: Mapped[int | None] = mapped_column(Integer)
    current_rent: Mapped[int | None] = mapped_column(Integer)     # CAD/mois
    market_rent: Mapped[int | None] = mapped_column(Integer)
    lease_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    occupancy_status: Mapped[str | None] = mapped_column(String(20))  # 'rented' / 'vacant'
    photo_paths: Mapped[list | None] = mapped_column(JSON)
    lease_path: Mapped[str | None] = mapped_column(String(500))
    notes: Mapped[str | None] = mapped_column(Text)
    order_index: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    deal = relationship("Deal", back_populates="units")
