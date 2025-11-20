from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.security import get_current_active_user, require_roles
from app.models.user import User, UserRole
from app.schemas.link import LinkCreate, LinkStatusUpdate, LinkResponse
from app.services.link_service import LinkService

router = APIRouter(prefix="/links", tags=["Links"])


@router.post("/request", response_model=LinkResponse, status_code=status.HTTP_201_CREATED)
async def request_link(
    link_data: LinkCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.CONSUMER]))
):
    """
    Consumer requests a link to a Supplier.
    Only CONSUMER role can create link requests.
    """
    link = await LinkService.create_link_request(db, current_user, link_data)
    return link


@router.put("/{link_id}/status", response_model=LinkResponse)
async def update_link_status(
    link_id: int,
    status_update: LinkStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.SUPPLIER_OWNER, UserRole.SUPPLIER_MANAGER, UserRole.SUPPLIER_SALES]))
):
    """
    Supplier (Owner/Manager/Sales) approves, rejects, or blocks a link request.
    """
    link = await LinkService.update_link_status(db, link_id, current_user, status_update)
    return link


@router.get("/my-links", response_model=list[LinkResponse])
async def get_my_links(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get all links for the current user's company.
    Returns consumer links if user is a CONSUMER, supplier links otherwise.
    """
    if current_user.role == UserRole.CONSUMER:
        links = await LinkService.get_consumer_links(db, current_user)
    else:
        links = await LinkService.get_supplier_links(db, current_user)
    return links


@router.get("/available-suppliers")
async def get_available_suppliers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.CONSUMER]))
):
    """
    Get list of available suppliers for consumers to browse and request links.
    """
    from sqlalchemy import select
    from app.models.company import Company, CompanyType
    from app.schemas.company import CompanyResponse
    
    result = await db.execute(
        select(Company).where(Company.type == CompanyType.SUPPLIER)
    )
    suppliers = result.scalars().all()
    return [CompanyResponse.model_validate(s) for s in suppliers]
