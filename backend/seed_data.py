"""
Seed initial data for the database
"""
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import SessionLocal
from app.models.company import Company, CompanyType
from app.models.user import User, UserRole
from app.core.security import hash_password


async def seed_database():
    """Create initial companies and demo users"""
    async with SessionLocal() as db:
        # Create companies
        supplier_company = Company(
            id=1,
            name="Demo Supplier Co.",
            type=CompanyType.SUPPLIER,
            kyb_status=True
        )
        
        consumer_company = Company(
            id=2,
            name="Demo Restaurant",
            type=CompanyType.CONSUMER,
            kyb_status=True
        )
        
        db.add(supplier_company)
        db.add(consumer_company)
        await db.commit()
        
        # Create demo users
        supplier_owner = User(
            email="owner@supplier.com",
            hashed_password=hash_password("pass123"),
            role=UserRole.SUPPLIER_OWNER,
            company_id=1,
            is_active=True
        )
        
        consumer_user = User(
            email="buyer@restaurant.com",
            hashed_password=hash_password("pass123"),
            role=UserRole.CONSUMER,
            company_id=2,
            is_active=True
        )
        
        db.add(supplier_owner)
        db.add(consumer_user)
        await db.commit()
        
        print("✅ Database seeded successfully!")
        print("Demo accounts:")
        print("  Supplier: owner@supplier.com / pass123")
        print("  Consumer: buyer@restaurant.com / pass123")


if __name__ == "__main__":
    asyncio.run(seed_database())
