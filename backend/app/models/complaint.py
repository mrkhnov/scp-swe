from sqlalchemy import ForeignKey, Enum, String, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from enum import Enum as PyEnum
from app.db.session import Base

class ComplaintStatus(str, PyEnum):
    OPEN = "OPEN"
    ESCALATED = "ESCALATED"
    RESOLVED = "RESOLVED"

class Complaint(Base):
    __tablename__ = "complaints"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    handler_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[ComplaintStatus] = mapped_column(Enum(ComplaintStatus), nullable=False, default=ComplaintStatus.OPEN)
    description: Mapped[str] = mapped_column(String(1000), nullable=False)

    order: Mapped["Order"] = relationship()
    handler: Mapped["User"] = relationship()
