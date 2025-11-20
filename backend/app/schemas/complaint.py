from pydantic import BaseModel, Field
from app.models.complaint import ComplaintStatus

# Request Schemas
class ComplaintCreate(BaseModel):
    order_id: int
    description: str = Field(..., min_length=10, max_length=1000)

class ComplaintEscalate(BaseModel):
    handler_id: int | None = None

# Response Schemas
class ComplaintResponse(BaseModel):
    id: int
    order_id: int
    created_by: int | None  # User ID who created the complaint
    consumer_id: int  # Company ID of the consumer
    handler_id: int | None
    status: ComplaintStatus
    description: str

    class Config:
        from_attributes = True
