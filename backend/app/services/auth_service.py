from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status

from app.models.user import User, UserRole
from app.models.company import Company
from app.schemas.user import UserCreate, UserLogin, TokenResponse
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token


class AuthService:
    @staticmethod
    async def register_user(db: AsyncSession, user_data: UserCreate) -> User:
        """Register a new user"""
        # Check if email already exists
        result = await db.execute(select(User).where(User.email == user_data.email))
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already registered")

        company_id = None
        
        # Handle Supplier Owner - create new company
        if user_data.role == UserRole.SUPPLIER_OWNER:
            # Check if company name already exists
            result = await db.execute(select(Company).where(Company.name == user_data.company_name))
            if result.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Company name already exists")
            
            # Create new company
            new_company = Company(
                name=user_data.company_name,
                type=user_data.company_type,
                kyb_status=False  # Requires verification
            )
            db.add(new_company)
            await db.flush()  # Get company ID without committing
            company_id = new_company.id
        
        # Handle Consumer - create new company with email-based name
        elif user_data.role == UserRole.CONSUMER:
            # Create company name from email (can be customized later)
            company_name = user_data.company_name or f"{user_data.email.split('@')[0]}_company"
            
            # Ensure unique company name
            base_name = company_name
            counter = 1
            while True:
                result = await db.execute(select(Company).where(Company.name == company_name))
                if not result.scalar_one_or_none():
                    break
                company_name = f"{base_name}_{counter}"
                counter += 1
            
            new_company = Company(
                name=company_name,
                type=user_data.company_type,
                kyb_status=True  # Auto-approve for consumers
            )
            db.add(new_company)
            await db.flush()
            company_id = new_company.id
        
        # Handle Manager/Sales - must provide existing company_id
        elif user_data.role in [UserRole.SUPPLIER_MANAGER, UserRole.SUPPLIER_SALES]:
            if not user_data.company_id:
                raise HTTPException(
                    status_code=400, 
                    detail="Manager and Sales roles must be added to an existing company"
                )
            company = await db.get(Company, user_data.company_id)
            if not company:
                raise HTTPException(status_code=404, detail="Company not found")
            company_id = user_data.company_id

        # Create user
        new_user = User(
            email=user_data.email,
            hashed_password=hash_password(user_data.password),
            role=user_data.role,
            company_id=company_id,
            is_active=True
        )
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        return new_user

    @staticmethod
    async def authenticate_user(db: AsyncSession, login_data: UserLogin) -> TokenResponse:
        """Authenticate user and return JWT tokens"""
        result = await db.execute(select(User).where(User.email == login_data.email))
        user = result.scalar_one_or_none()

        if not user or not verify_password(login_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )

        if not user.is_active:
            raise HTTPException(status_code=400, detail="Inactive user account")
        
        # Check if company is active
        if user.company_id:
            company = await db.get(Company, user.company_id)
            if company and not company.is_active:
                raise HTTPException(status_code=400, detail="Company account is deactivated")

        access_token = create_access_token(user.email, user.role.value, user.id)
        refresh_token = create_refresh_token(user.email, user.role.value, user.id)

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token
        )
