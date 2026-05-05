import uuid
from datetime import datetime
from sqlalchemy import DateTime, String, ForeignKey, Text, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
import enum


class EmailType(str, enum.Enum):
    nouveau_deal = "nouveau_deal"
    nda_signee = "nda_signee"
    bid_soumis = "bid_soumis"
    fermeture_gagnant = "fermeture_gagnant"
    fermeture_perdants = "fermeture_perdants"
    depot_confirme = "depot_confirme"
    verdict_go = "verdict_go"
    verdict_nogo = "verdict_nogo"
    pa_signee = "pa_signee"


class EmailLog(Base):
    __tablename__ = "email_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email_type: Mapped[EmailType] = mapped_column(SAEnum(EmailType), nullable=False)
    recipient_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    deal_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("deals.id"))
    resend_id: Mapped[str | None] = mapped_column(String(100))
    error: Mapped[str | None] = mapped_column(Text)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
