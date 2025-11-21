from pydantic import BaseModel, Field
from datetime import datetime
from app.models.chat_message import MessageType

# Request Schemas
class ChatMessageCreate(BaseModel):
    recipient_id: int
    content: str = Field(..., min_length=1, max_length=2000)
    message_type: MessageType = MessageType.TEXT
    attachment_url: str | None = Field(None, max_length=500)
    file_name: str | None = Field(None, max_length=255)
    file_size: int | None = None

# Response Schemas
class ChatMessageResponse(BaseModel):
    id: int
    sender_id: int
    recipient_id: int
    content: str
    message_type: MessageType
    attachment_url: str | None
    file_name: str | None
    file_size: int | None
    timestamp: datetime
    is_read: bool = False

    class Config:
        from_attributes = True
