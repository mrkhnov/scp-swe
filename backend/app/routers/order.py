from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.security import get_current_active_user, require_roles
from app.models.user import User, UserRole
from app.schemas.order import OrderCreate, OrderStatusUpdate, OrderResponse
from app.services.order_service import OrderService

router = APIRouter(prefix="/orders", tags=["Orders"])


@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    order_data: OrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.CONSUMER]))
):
    """
    Consumer creates an order with a linked (APPROVED) supplier.
    Verifies link status and product availability.
    """
    order = await OrderService.create_order(db, current_user, order_data)
    return order


@router.put("/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: int,
    status_update: OrderStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update order status:
    - Supplier (Owner/Manager/Sales): Accept, Reject, Update delivery status
    - Consumer: Cancel order
    
    IMPORTANT: Accepting an order atomically decrements inventory.
    """
    order = await OrderService.update_order_status(db, order_id, current_user, status_update)
    return order


@router.get("/my-orders", response_model=list[OrderResponse])
async def get_my_orders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get all orders for the current user's company.
    Returns consumer orders if user is CONSUMER, supplier orders otherwise.
    """
    if current_user.role == UserRole.CONSUMER:
        orders = await OrderService.get_consumer_orders(db, current_user)
    else:
        orders = await OrderService.get_supplier_orders(db, current_user)
    return orders


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get order details by ID.
    Access restricted to consumer or supplier company involved in the order.
    """
    order = await OrderService.get_order_by_id(db, order_id, current_user)
    return order
