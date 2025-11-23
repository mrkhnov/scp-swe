from sqlalchemy import String, Enum, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from enum import Enum as PyEnum
from app.db.session import Base

class CompanyType(str, PyEnum):
    SUPPLIER = "SUPPLIER"
    CONSUMER = "CONSUMER"

class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    type: Mapped[CompanyType] = mapped_column(Enum(CompanyType), nullable=False)
    kyb_status: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    users: Mapped[list["User"]] = relationship(back_populates="company", cascade="all, delete-orphan")
    products: Mapped[list["Product"]] = relationship(back_populates="supplier", cascade="all, delete-orphan")
