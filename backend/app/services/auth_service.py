from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status

from app.models.user import User
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

        # Verify company exists if company_id provided
        if user_data.company_id:
            company = await db.get(Company, user_data.company_id)
            if not company:
                raise HTTPException(status_code=404, detail="Company not found")

        # Create user - explicitly set company_id to None if not provided
        new_user = User(
            email=user_data.email,
            hashed_password=hash_password(user_data.password),
            role=user_data.role,
            company_id=user_data.company_id if user_data.company_id else None,
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

        access_token = create_access_token(user.email, user.role.value, user.id)
        refresh_token = create_refresh_token(user.email, user.role.value, user.id)

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token
        )
