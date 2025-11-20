from pydantic import BaseModel, EmailStr, Field, model_validator
from app.models.user import UserRole
from app.models.company import CompanyType

# Request Schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    role: UserRole
    # Company details for Supplier Owner registration
    company_name: str | None = Field(None, min_length=1, max_length=255)
    company_type: CompanyType | None = None
    # For existing users joining a company (Manager/Sales)
    company_id: int | None = None
    
    @model_validator(mode='after')
    def validate_company_fields(self):
        """Validate company fields based on role"""
        if self.role == UserRole.SUPPLIER_OWNER:
            if not self.company_name:
                raise ValueError('company_name is required for Supplier Owner registration')
            # Auto-set company_type to SUPPLIER for Supplier Owner
            self.company_type = CompanyType.SUPPLIER
        elif self.role == UserRole.CONSUMER:
            # Auto-set to CONSUMER type if not provided
            if not self.company_type:
                self.company_type = CompanyType.CONSUMER
        return self

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
