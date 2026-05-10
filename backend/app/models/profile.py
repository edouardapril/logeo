"""LOTPLOT 28 — Modèle Profile (remplace User).

`public.profiles` héberge les données métier liées à un utilisateur,
avec id PK = FK vers auth.users(id). Supabase gère les credentials
(hashed_password, email_verified, sessions).

Cette classe a EXACTEMENT le même shape que l'ancien `User` SAUF :
  - plus de `hashed_password`
  - plus de `email_verified` / `email_verify_token*` (gérés par auth.users)

`__tablename__ = 'profiles'` cible la nouvelle table créée par la
migration `5e6f708192a3_lotplot28_create_profiles`.

Pour ne pas casser ~30 imports existants `from app.models.user import User`,
le fichier `app/models/user.py` continue d'exister et exporte
`Profile as User` (transitional alias). À supprimer après sed global :

    grep -rl "from app.models.user import" backend/app \\
      | xargs sed -i 's|from app.models.user import User|from app.models.profile import Profile as User|g'

(macOS : `sed -i ''`)
"""
import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Integer, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
import enum


class UserRole(str, enum.Enum):
    """Rôles métier — stockés en VARCHAR(50) + CHECK constraint dans profiles."""
    admin = "admin"
    courtier = "courtier"
    acheteur = "acheteur"
    regional_partner = "regional_partner"


class Profile(Base):
    """LOTPLOT 28 — équivalent métier de l'ancien User, sans credentials.

    L'id est égal à auth.users.id (UUID préservé pendant la migration).
    """
    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)
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

    # Stripe (legacy LOTPLOT 19)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(120))
    stripe_payment_method_id: Mapped[str | None] = mapped_column(String(120))
    payment_method_brand: Mapped[str | None] = mapped_column(String(40))
    payment_method_last4: Mapped[str | None] = mapped_column(String(4))
    payment_method_exp_month: Mapped[int | None] = mapped_column(Integer)
    payment_method_exp_year: Mapped[int | None] = mapped_column(Integer)

    # Profil
    profile_photo_path: Mapped[str | None] = mapped_column(String(500))
    email_notifications: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    # T&C
    tos_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    tos_accepted_ip: Mapped[str | None] = mapped_column(String(64))
    tos_accepted_version: Mapped[str | None] = mapped_column(String(20))

    # Common
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow,
    )

    # Recrutement par un partenaire régional
    recruited_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=True, index=True,
    )
    recruited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    recruitment_notes: Mapped[str | None] = mapped_column(Text)

    # Relations métier — inchangées par rapport à l'ancien User
    deals = relationship("Deal", back_populates="courtier", foreign_keys="Deal.courtier_id")
    bids = relationship("Bid", back_populates="acheteur")
    ndas = relationship("NDA", back_populates="acheteur")
    payments = relationship("Payment", back_populates="acheteur")

    recruited_by = relationship(
        "Profile",
        remote_side="Profile.id",
        foreign_keys=[recruited_by_id],
        back_populates="recruited_courtiers",
    )
    recruited_courtiers = relationship(
        "Profile",
        foreign_keys="Profile.recruited_by_id",
        back_populates="recruited_by",
    )


# Alias pour rétrocompatibilité — voir docstring du module.
User = Profile
