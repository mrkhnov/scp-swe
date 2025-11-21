from pydantic import BaseModel, Field

# Request Schemas
class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    sku: str = Field(..., min_length=1, max_length=64)
    price: float = Field(..., gt=0)
    stock_quantity: int = Field(..., ge=0)
    min_order_qty: int = Field(default=1, ge=1)
    is_active: bool = True
    image_url: str | None = None

class ProductUpdate(BaseModel):
    name: str | None = None
    price: float | None = Field(None, gt=0)
    stock_quantity: int | None = Field(None, ge=0)
    min_order_qty: int | None = Field(None, ge=1)
    is_active: bool | None = None
    image_url: str | None = None

# Response Schemas
class ProductResponse(BaseModel):
    id: int
    supplier_id: int
    name: str
    sku: str
    price: float
    stock_quantity: int
    min_order_qty: int
    is_active: bool
    image_url: str | None = None

    class Config:
        from_attributes = True
