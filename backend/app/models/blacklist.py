from sqlalchemy import ForeignKey, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.db.session import Base

class CompanyBlacklist(Base):
    __tablename__ = "company_blacklist"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    consumer_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    blocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    blocked_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    supplier: Mapped["Company"] = relationship("Company", foreign_keys=[supplier_id])
    consumer: Mapped["Company"] = relationship("Company", foreign_keys=[consumer_id]) 
    blocker: Mapped["User"] = relationship("User", foreign_keys=[blocked_by])