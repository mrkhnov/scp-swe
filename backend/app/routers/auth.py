from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.schemas.user import UserCreate, UserLogin, UserResponse, TokenResponse
from app.services.auth_service import AuthService
from app.core.security import get_current_user
from app.models.user import User, UserRole

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
