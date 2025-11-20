from pydantic import BaseModel
from app.models.link import LinkStatus

# Request Schemas
class LinkCreate(BaseModel):
    supplier_id: int

class LinkStatusUpdate(BaseModel):
    status: LinkStatus

# Response Schemas
class LinkResponse(BaseModel):
    id: int
    supplier_id: int
    consumer_id: int
    status: LinkStatus

    class Config:
        from_attributes = True
