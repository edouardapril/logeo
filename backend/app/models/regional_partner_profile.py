import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, DateTime, Text, ForeignKey, Numeric, CheckConstraint, Index, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class RegionalPartnerProfile(Base):
    """Profil 1-to-1 d'un User ayant le rôle `regional_partner`.

    `commission_rate` est stockée comme Numeric(5,4) — ex: 0.2500 = 25 %.
    `status` contrôle l'éligibilité aux commissions (seul "active" continue
    de toucher). La fenêtre des autres valeurs est figée par CheckConstraint.
    """
    __tablename__ = "regional_partner_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False,
    )
    territory_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("regional_territories.id"), nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(50), default="active", server_default="active", nullable=False,
    )
    commission_rate: Mapped[Decimal] = mapped_column(
        Numeric(5, 4), default=Decimal("0.2500"), server_default="0.2500", nullable=False,
    )
    contract_signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    contract_terminated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow,
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'quit_voluntary', 'terminated_for_cause', "
            "'terminated_without_cause', 'deceased', 'on_hold')",
            name="regional_partner_profiles_status_check",
        ),
        # Max 1 partenaire 'active' par territoire à un instant donné.
        # Permet 0..N profils historiques (status != 'active') sur le même
        # territoire, et 0..N profils actifs avec territory_id NULL (onboarding).
        Index(
            "uq_active_partner_per_territory",
            "territory_id",
            unique=True,
            postgresql_where=text("territory_id IS NOT NULL AND status = 'active'"),
        ),
    )

    user = relationship("User", foreign_keys=[user_id])
    territory = relationship("RegionalTerritory", back_populates="partners")
