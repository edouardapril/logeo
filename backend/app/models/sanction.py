import uuid
from datetime import datetime
from sqlalchemy import String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class UserSanction(Base):
    """Sanction administrative appliquée à un user.

    severity: 'warning' (avertissement, ne désactive pas)
              'suspension' (compte désactivé jusqu'à lifted_at)
              'expulsion' (permanent)
    """
    __tablename__ = "user_sanctions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True,
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="warning",
                                          server_default="warning")
    related_deal_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deals.id"),
    )
    deposit_kept_cad: Mapped[int | None] = mapped_column(Integer)

    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    lifted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    lifted_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    lifted_reason: Mapped[str | None] = mapped_column(Text)

    user = relationship("User", foreign_keys=[user_id])
    deal = relationship("Deal", foreign_keys=[related_deal_id])
    created_by_user = relationship("User", foreign_keys=[created_by])
    lifted_by_user = relationship("User", foreign_keys=[lifted_by])

    @property
    def is_active(self) -> bool:
        return self.lifted_at is None
