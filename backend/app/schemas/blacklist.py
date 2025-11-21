from pydantic import BaseModel, Field
from datetime import datetime

# Request Schemas
class BlacklistCreate(BaseModel):
    consumer_id: int
    reason: str | None = Field(None, max_length=500)

class BlacklistRemove(BaseModel):
    consumer_id: int

# Response Schemas
class BlacklistResponse(BaseModel):
    id: int
    supplier_id: int
    consumer_id: int
    blocked_at: datetime
    blocked_by: int | None
    reason: str | None
    consumer_name: str  # Will be populated from relationship
    blocker_email: str | None  # Will be populated from relationship

    class Config:
        from_attributes = True

class ConnectionResponse(BaseModel):
    id: int
    supplier_id: int
    consumer_id: int
    status: str
    consumer_name: str
    is_blacklisted: bool = False

    class Config:
        from_attributes = True