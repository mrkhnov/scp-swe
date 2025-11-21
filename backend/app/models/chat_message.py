from sqlalchemy import ForeignKey, String, DateTime, Boolean, Enum, Integer
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from enum import Enum as PyEnum
from app.db.session import Base

class MessageType(PyEnum):
    TEXT = "TEXT"
    IMAGE = "IMAGE"
    PDF = "PDF"
    AUDIO = "AUDIO"

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    recipient_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    content: Mapped[str] = mapped_column(String(2000), nullable=False)
    message_type: Mapped[MessageType] = mapped_column(Enum(MessageType), nullable=False, default=MessageType.TEXT)
    attachment_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
