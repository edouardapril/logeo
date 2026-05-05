import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
import enum


class UserRole(str, enum.Enum):
    admin = "admin"
    courtier = "courtier"
    acheteur = "acheteur"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20))
    # Courtier-specific
    oaciq_number: Mapped[str | None] = mapped_column(String(50))
    agency_name: Mapped[str | None] = mapped_column(String(255))
    convention_signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Acheteur-specific
    is_qualified: Mapped[bool] = mapped_column(Boolean, default=False)
    engagement_signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Common
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    deals = relationship("Deal", back_populates="courtier", foreign_keys="Deal.courtier_id")
    bids = relationship("Bid", back_populates="acheteur")
    ndas = relationship("NDA", back_populates="acheteur")
