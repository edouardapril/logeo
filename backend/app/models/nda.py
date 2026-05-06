import uuid
from datetime import datetime
from sqlalchemy import DateTime, String, ForeignKey, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class NDA(Base):
    __tablename__ = "ndas"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deal_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("deals.id"), nullable=False)
    acheteur_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    signed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    ip_address: Mapped[str] = mapped_column(String(45), nullable=False)
    user_agent: Mapped[str | None] = mapped_column(Text)

    # Sprint final item 8 — chaque case cochée individuellement + PDF généré
    consents: Mapped[dict | None] = mapped_column(JSON)
    pdf_path: Mapped[str | None] = mapped_column(String(500))

    deal = relationship("Deal", back_populates="ndas")
    acheteur = relationship("User", back_populates="ndas")
