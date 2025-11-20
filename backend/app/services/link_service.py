from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from fastapi import HTTPException, status

from app.models.link import Link, LinkStatus
from app.models.company import Company, CompanyType
from app.models.user import User, UserRole
from app.schemas.link import LinkCreate, LinkStatusUpdate


class LinkService:
    @staticmethod
    async def create_link_request(db: AsyncSession, consumer: User, link_data: LinkCreate) -> Link:
        """Consumer requests a link to a Supplier"""
        # Verify consumer's company is a CONSUMER type
        consumer_company = await db.get(Company, consumer.company_id)
        if not consumer_company or consumer_company.type != CompanyType.CONSUMER:
            raise HTTPException(status_code=403, detail="Only Consumer companies can request links")

        # Verify supplier exists and is a SUPPLIER type
        supplier_company = await db.get(Company, link_data.supplier_id)
        if not supplier_company:
            raise HTTPException(status_code=404, detail="Supplier company not found")
        if supplier_company.type != CompanyType.SUPPLIER:
            raise HTTPException(status_code=400, detail="Target company is not a Supplier")

        # Check if link already exists
        existing_link = await db.execute(
            select(Link).where(
                and_(
                    Link.supplier_id == link_data.supplier_id,
                    Link.consumer_id == consumer.company_id
                )
            )
        )
        if existing_link.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Link request already exists")

        # Create link
        new_link = Link(
            supplier_id=link_data.supplier_id,
            consumer_id=consumer.company_id,
            status=LinkStatus.PENDING
        )
        db.add(new_link)
        await db.commit()
        await db.refresh(new_link)
        return new_link

    @staticmethod
    async def update_link_status(db: AsyncSession, link_id: int, user: User, status_update: LinkStatusUpdate) -> Link:
        """Supplier Owner/Manager/Sales can approve/reject/block link requests"""
        link = await db.get(Link, link_id)
        if not link:
            raise HTTPException(status_code=404, detail="Link not found")

        # Verify user belongs to the supplier company
        if user.company_id != link.supplier_id:
            raise HTTPException(status_code=403, detail="You can only manage links for your own company")

        # Verify user has permission (Supplier roles only)
        if user.role not in [UserRole.SUPPLIER_OWNER, UserRole.SUPPLIER_MANAGER, UserRole.SUPPLIER_SALES]:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        # Update status
        link.status = status_update.status
        await db.commit()
        await db.refresh(link)
        return link

    @staticmethod
    async def get_consumer_links(db: AsyncSession, consumer: User) -> list[Link]:
        """Get all links for a consumer"""
        result = await db.execute(
            select(Link).where(Link.consumer_id == consumer.company_id)
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_supplier_links(db: AsyncSession, supplier: User) -> list[Link]:
        """Get all links for a supplier"""
        result = await db.execute(
            select(Link).where(Link.supplier_id == supplier.company_id)
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_approved_supplier_ids(db: AsyncSession, consumer_company_id: int) -> list[int]:
        """Get list of approved supplier IDs for a consumer - used for catalog filtering"""
        result = await db.execute(
            select(Link.supplier_id).where(
                and_(
                    Link.consumer_id == consumer_company_id,
                    Link.status == LinkStatus.APPROVED
                )
            )
        )
        return list(result.scalars().all())
