"""
Base class for SQLAlchemy models.
Separated from session.py to avoid circular imports in Alembic.
"""
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all database models."""
    pass
