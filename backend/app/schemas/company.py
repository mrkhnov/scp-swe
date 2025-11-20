from pydantic import BaseModel, Field
from app.models.company import CompanyType

# Request Schemas
class CompanyCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=255)
    type: CompanyType
    kyb_status: bool = False

class CompanyUpdate(BaseModel):
    name: str | None = Field(None, min_length=3, max_length=255)
    kyb_status: bool | None = None
    is_active: bool | None = None

# Response Schemas
class CompanyResponse(BaseModel):
    id: int
    name: str
    type: CompanyType
    kyb_status: bool
    is_active: bool

    class Config:
        from_attributes = True
