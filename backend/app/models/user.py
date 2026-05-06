import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Integer, Enum as SAEnum
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
    convention_signed_ip: Mapped[str | None] = mapped_column(String(64))
    convention_signed_user_agent: Mapped[str | None] = mapped_column(String(500))
    convention_clauses_version: Mapped[str | None] = mapped_column(String(20))
    # Acheteur-specific
    is_qualified: Mapped[bool] = mapped_column(Boolean, default=False)
    engagement_signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Stripe (acheteur)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(120))
    stripe_payment_method_id: Mapped[str | None] = mapped_column(String(120))
    payment_method_brand: Mapped[str | None] = mapped_column(String(40))
    payment_method_last4: Mapped[str | None] = mapped_column(String(4))
    payment_method_exp_month: Mapped[int | None] = mapped_column(Integer)
    payment_method_exp_year: Mapped[int | None] = mapped_column(Integer)
    # Profil
    profile_photo_path: Mapped[str | None] = mapped_column(String(500))
    email_notifications: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    # T&C — sprint final item 9
    tos_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    tos_accepted_ip: Mapped[str | None] = mapped_column(String(64))
    tos_accepted_version: Mapped[str | None] = mapped_column(String(20))
    # Sprint final item 10 — email confirmation
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    email_verify_token: Mapped[str | None] = mapped_column(String(120))
    email_verify_token_exp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Common
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    deals = relationship("Deal", back_populates="courtier", foreign_keys="Deal.courtier_id")
    bids = relationship("Bid", back_populates="acheteur")
    ndas = relationship("NDA", back_populates="acheteur")
    payments = relationship("Payment", back_populates="acheteur")
