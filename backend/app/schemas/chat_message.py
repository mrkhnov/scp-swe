from pydantic import BaseModel, Field
from datetime import datetime

# Request Schemas
class ChatMessageCreate(BaseModel):
    recipient_id: int
    content: str = Field(..., min_length=1, max_length=2000)
    attachment_url: str | None = Field(None, max_length=500)

# Response Schemas
class ChatMessageResponse(BaseModel):
    id: int
    sender_id: int
    recipient_id: int
    content: str
    attachment_url: str | None
    timestamp: datetime
    is_read: bool = False

    class Config:
        from_attributes = True
