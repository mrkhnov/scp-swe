from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.schemas.user import UserCreate, UserLogin, UserResponse, TokenResponse
from app.schemas.company import CompanyResponse, CompanyUpdate
from app.services.auth_service import AuthService
from app.core.security import get_current_user
from app.models.user import User, UserRole
from app.models.company import Company

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new user.
    KYB Note: Suppliers may register but need verification before accepting links.
    """
    user = await AuthService.register_user(db, user_data)
    return user


@router.post("/token", response_model=TokenResponse)
async def login(
    login_data: UserLogin,
    db: AsyncSession = Depends(get_db)
):
    """
    Login and receive access & refresh JWT tokens.
    """
    tokens = await AuthService.authenticate_user(db, login_data)
    return tokens


@router.get("/company/users", response_model=list[UserResponse])
async def get_company_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all users in the current user's company (Owner only).
    """
    if current_user.role != UserRole.SUPPLIER_OWNER:
        raise HTTPException(status_code=403, detail="Only Supplier Owners can view company users")
    
    if not current_user.company_id:
        raise HTTPException(status_code=400, detail="User has no associated company")
    
    result = await db.execute(
        select(User).where(User.company_id == current_user.company_id)
    )
    users = result.scalars().all()
    return users


@router.post("/company/add-user", response_model=UserResponse)
async def add_company_user(
    user_data: UserCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Add a Manager or Sales Rep to the company (Owner only).
    """
    if current_user.role != UserRole.SUPPLIER_OWNER:
        raise HTTPException(status_code=403, detail="Only Supplier Owners can add company users")
    
    if not current_user.company_id:
        raise HTTPException(status_code=400, detail="User has no associated company")
    
    # Validate role
    if user_data.role not in [UserRole.SUPPLIER_MANAGER, UserRole.SUPPLIER_SALES]:
        raise HTTPException(status_code=400, detail="Can only add Manager or Sales Rep roles")
    
    # Set company_id to current user's company
    user_data.company_id = current_user.company_id
    
    user = await AuthService.register_user(db, user_data)
    return user


@router.delete("/company/remove-user/{user_id}")
async def remove_company_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Remove a user from the company (Owner only).
    """
    if current_user.role != UserRole.SUPPLIER_OWNER:
        raise HTTPException(status_code=403, detail="Only Supplier Owners can remove company users")
    
    user_to_remove = await db.get(User, user_id)
    if not user_to_remove:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user_to_remove.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="User is not in your company")
    
    if user_to_remove.role == UserRole.SUPPLIER_OWNER:
        raise HTTPException(status_code=400, detail="Cannot remove the company owner")
    
    await db.delete(user_to_remove)
    await db.commit()
    return {"message": "User removed successfully"}


@router.get("/sales-reps", response_model=list[UserResponse])
async def get_available_sales_reps(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get list of sales reps from linked suppliers (for Consumers) or own company (for Suppliers).
    """
    if current_user.role == UserRole.CONSUMER:
        # Get sales reps from approved suppliers
        from app.models.link import Link, LinkStatus as LS
        from app.models.company import Company
        
        # Get approved supplier companies
        result = await db.execute(
            select(Link).where(
                Link.consumer_id == current_user.company_id,
                Link.status == LS.APPROVED
            )
        )
        links = result.scalars().all()
        supplier_ids = [link.supplier_id for link in links]
        
        if not supplier_ids:
            return []
        
        # Get sales reps from those suppliers
        result = await db.execute(
            select(User).where(
                User.company_id.in_(supplier_ids),
                User.role == UserRole.SUPPLIER_SALES,
                User.is_active == True
            )
        )
        return result.scalars().all()
    else:
        # For suppliers, get consumers from approved links
        from app.models.link import Link, LinkStatus as LS
        
        result = await db.execute(
            select(Link).where(
                Link.supplier_id == current_user.company_id,
                Link.status == LS.APPROVED
            )
        )
        links = result.scalars().all()
        consumer_ids = [link.consumer_id for link in links]
        
        if not consumer_ids:
            return []
        
        # Get consumer users
        result = await db.execute(
            select(User).where(
                User.company_id.in_(consumer_ids),
                User.role == UserRole.CONSUMER,
                User.is_active == True
            )
        )
        return result.scalars().all()


@router.get("/company/settings", response_model=CompanyResponse)
async def get_company_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get current user's company settings (Owner only).
    """
    if current_user.role != UserRole.SUPPLIER_OWNER:
        raise HTTPException(status_code=403, detail="Only Supplier Owners can view company settings")
    
    if not current_user.company_id:
        raise HTTPException(status_code=400, detail="User has no associated company")
    
    company = await db.get(Company, current_user.company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    return company


@router.put("/company/settings", response_model=CompanyResponse)
async def update_company_settings(
    company_update: CompanyUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update company settings (Owner only).
    """
    if current_user.role != UserRole.SUPPLIER_OWNER:
        raise HTTPException(status_code=403, detail="Only Supplier Owners can update company settings")
    
    if not current_user.company_id:
        raise HTTPException(status_code=400, detail="User has no associated company")
    
    company = await db.get(Company, current_user.company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Update fields if provided
    if company_update.name is not None:
        # Check if name is already taken by another company
        result = await db.execute(
            select(Company).where(Company.name == company_update.name, Company.id != company.id)
        )
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Company name already exists")
        company.name = company_update.name
    
    if company_update.kyb_status is not None:
        company.kyb_status = company_update.kyb_status
    
    if company_update.is_active is not None:
        company.is_active = company_update.is_active
        # If deactivating, deactivate all users
        if not company_update.is_active:
            result = await db.execute(
                select(User).where(User.company_id == company.id)
            )
            users = result.scalars().all()
            for user in users:
                user.is_active = False
    
    await db.commit()
    await db.refresh(company)
    return company


@router.delete("/company", status_code=status.HTTP_204_NO_CONTENT)
async def delete_company(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete the company and all associated users (Owner only).
    """
    if current_user.role != UserRole.SUPPLIER_OWNER:
        raise HTTPException(status_code=403, detail="Only Supplier Owners can delete the company")
    
    if not current_user.company_id:
        raise HTTPException(status_code=400, detail="User has no associated company")
    
    company = await db.get(Company, current_user.company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Delete company (cascades to users and other related entities)
    await db.delete(company)
    await db.commit()
    
    return None
