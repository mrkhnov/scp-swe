from sqlalchemy import Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from enum import Enum as PyEnum
from app.db.session import Base

class LinkStatus(str, PyEnum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    BLOCKED = "BLOCKED"

class Link(Base):
    __tablename__ = "links"
    __table_args__ = (
        {'sqlite_autoincrement': True},
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    consumer_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    status: Mapped[LinkStatus] = mapped_column(Enum(LinkStatus), index=True, nullable=False, default=LinkStatus.PENDING)

    supplier: Mapped["Company"] = relationship(foreign_keys=[supplier_id])
    consumer: Mapped["Company"] = relationship(foreign_keys=[consumer_id])
