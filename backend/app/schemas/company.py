from pydantic import BaseModel, Field
from app.models.company import CompanyType

# Request Schemas
class CompanyCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=255)
    type: CompanyType
    kyb_status: bool = False

# Response Schemas
class CompanyResponse(BaseModel):
    id: int
    name: str
    type: CompanyType
    kyb_status: bool

    class Config:
        from_attributes = True
