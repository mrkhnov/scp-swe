from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.security import get_current_active_user, require_roles
from app.models.user import User, UserRole
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse
from app.services.product_service import ProductService

router = APIRouter(prefix="/products", tags=["Products"])


@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    product_data: ProductCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.SUPPLIER_OWNER, UserRole.SUPPLIER_MANAGER]))
):
    """
    Create a new product (Supplier Owner/Manager only).
    """
    product = await ProductService.create_product(db, current_user, product_data)
    
    # Send real-time notification to company
    from app.services.chat_service import manager
    await manager.broadcast_to_company(
        {"type": "product_update"},
        current_user.company_id,
        db
    )
    
    return product


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: int,
    product_data: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.SUPPLIER_OWNER, UserRole.SUPPLIER_MANAGER]))
):
    """
    Update an existing product (Supplier Owner/Manager only).
    """
    product = await ProductService.update_product(db, product_id, current_user, product_data)
    
    # Send real-time notification to company
    from app.services.chat_service import manager
    await manager.broadcast_to_company(
        {"type": "product_update"},
        current_user.company_id,
        db
    )
    
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.SUPPLIER_OWNER, UserRole.SUPPLIER_MANAGER]))
):
    """
    Delete a product (Supplier Owner/Manager only).
    """
    await ProductService.delete_product(db, product_id, current_user)
    
    # Send real-time notification to company
    from app.services.chat_service import manager
    await manager.broadcast_to_company(
        {"type": "product_update"},
        current_user.company_id,
        db
    )


@router.get("/catalog", response_model=list[ProductResponse])
async def get_catalog(
    supplier_id: int | None = Query(None, description="Filter by specific supplier (optional)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get product catalog:
    - Consumer: Only products from APPROVED linked suppliers
    - Supplier: Own products (for management)
    
    CRITICAL: Consumers can only see catalogs from suppliers they have APPROVED links with.
    """
    if current_user.role == UserRole.CONSUMER:
        products = await ProductService.get_catalog_for_consumer(db, current_user, supplier_id)
    else:
        products = await ProductService.get_supplier_catalog(db, current_user)
    return products


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get product details by ID.
    Permission check: Consumers need approved link with supplier.
    """
    product = await ProductService.get_product_by_id(db, product_id, current_user)
    return product
