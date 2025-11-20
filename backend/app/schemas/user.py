from pydantic import BaseModel, EmailStr, Field, field_validator
from app.models.user import UserRole

# Request Schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    role: UserRole
    company_id: int | None = None
    
    @field_validator('company_id', mode='before')
    @classmethod
    def validate_company_id(cls, v):
        """Convert 0 to None for company_id"""
        if v == 0 or v == "":
            return None
        return v

class UserLogin(BaseModel):
    email: EmailStr
    password: str

# Response Schemas
class UserResponse(BaseModel):
    id: int
    email: str
    role: UserRole
    is_active: bool
    company_id: int | None

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
