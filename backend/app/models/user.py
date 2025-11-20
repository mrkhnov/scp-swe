from sqlalchemy import String, Enum, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from enum import Enum as PyEnum
from app.db.session import Base

class UserRole(str, PyEnum):
    CONSUMER = "CONSUMER"
    SUPPLIER_OWNER = "SUPPLIER_OWNER"
    SUPPLIER_MANAGER = "SUPPLIER_MANAGER"
    SUPPLIER_SALES = "SUPPLIER_SALES"

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    company_id: Mapped[int | None] = mapped_column(ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)

    company: Mapped["Company"] = relationship(back_populates="users")
