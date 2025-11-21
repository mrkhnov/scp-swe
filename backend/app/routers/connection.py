from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import User, UserRole
from app.schemas.blacklist import BlacklistCreate, BlacklistResponse, ConnectionResponse
from app.services.connection_service import ConnectionManagementService

router = APIRouter(prefix="/connections", tags=["Connection Management"])


@router.get("/", response_model=list[ConnectionResponse])
async def get_connections(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all connections for the current supplier company.
    Only accessible by Supplier Owners and Managers.
    """
    if current_user.role not in [UserRole.SUPPLIER_OWNER, UserRole.SUPPLIER_MANAGER]:
        raise HTTPException(
            status_code=403, 
            detail="Only Supplier Owners and Managers can view connections"
        )
    
    if not current_user.company_id:
        raise HTTPException(status_code=400, detail="User has no associated company")
    
    connections = await ConnectionManagementService.get_supplier_connections(
        db, current_user.company_id
    )
    return connections


@router.get("/blacklist", response_model=list[BlacklistResponse])
async def get_blacklist(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all blacklisted companies for the current supplier.
    Only accessible by Supplier Owners and Managers.
    """
    if current_user.role not in [UserRole.SUPPLIER_OWNER, UserRole.SUPPLIER_MANAGER]:
        raise HTTPException(
            status_code=403, 
            detail="Only Supplier Owners and Managers can view blacklist"
        )
    
    if not current_user.company_id:
        raise HTTPException(status_code=400, detail="User has no associated company")
    
    blacklist = await ConnectionManagementService.get_supplier_blacklist(
        db, current_user.company_id
    )
    return blacklist


@router.post("/block", response_model=BlacklistResponse)
async def block_consumer(
    blacklist_data: BlacklistCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Block a consumer company and remove all connections.
    Only accessible by Supplier Owners and Managers.
    """
    if current_user.role not in [UserRole.SUPPLIER_OWNER, UserRole.SUPPLIER_MANAGER]:
        raise HTTPException(
            status_code=403, 
            detail="Only Supplier Owners and Managers can block companies"
        )
    
    if not current_user.company_id:
        raise HTTPException(status_code=400, detail="User has no associated company")
    
    return await ConnectionManagementService.block_consumer(
        db, current_user.company_id, blacklist_data, current_user
    )


@router.delete("/unblock/{consumer_id}")
async def unblock_consumer(
    consumer_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Remove a consumer company from blacklist.
    Only accessible by Supplier Owners and Managers.
    """
    if current_user.role not in [UserRole.SUPPLIER_OWNER, UserRole.SUPPLIER_MANAGER]:
        raise HTTPException(
            status_code=403, 
            detail="Only Supplier Owners and Managers can unblock companies"
        )
    
    if not current_user.company_id:
        raise HTTPException(status_code=400, detail="User has no associated company")
    
    await ConnectionManagementService.unblock_consumer(
        db, current_user.company_id, consumer_id
    )
    
    return {"message": "Consumer unblocked successfully"}


@router.delete("/remove/{consumer_id}")
async def remove_connection(
    consumer_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Completely remove a connection with a consumer.
    Only accessible by Supplier Owners and Managers.
    """
    if current_user.role not in [UserRole.SUPPLIER_OWNER, UserRole.SUPPLIER_MANAGER]:
        raise HTTPException(
            status_code=403, 
            detail="Only Supplier Owners and Managers can remove connections"
        )
    
    if not current_user.company_id:
        raise HTTPException(status_code=400, detail="User has no associated company")
    
    await ConnectionManagementService.remove_connection(
        db, current_user.company_id, consumer_id, current_user
    )
    
    return {"message": "Connection removed successfully"}