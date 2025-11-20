from pydantic import BaseModel, Field
from app.models.order import OrderStatus

# Request Schemas
class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)

class OrderCreate(BaseModel):
    supplier_id: int
    items: list[OrderItemCreate] = Field(..., min_length=1)

class OrderStatusUpdate(BaseModel):
    status: OrderStatus

# Response Schemas
class OrderItemResponse(BaseModel):
    order_id: int
    product_id: int
    quantity: int
    unit_price_at_time: float

    class Config:
        from_attributes = True

class OrderResponse(BaseModel):
    id: int
    consumer_id: int
    supplier_id: int
    status: OrderStatus
    total_amount: float
    items: list[OrderItemResponse] = []

    class Config:
        from_attributes = True
