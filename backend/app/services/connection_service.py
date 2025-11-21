from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, delete, update
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from app.models.blacklist import CompanyBlacklist
from app.models.link import Link, LinkStatus
from app.models.company import Company
from app.models.user import User, UserRole
from app.models.order import Order, OrderStatus
from app.schemas.blacklist import BlacklistCreate, ConnectionResponse, BlacklistResponse


class ConnectionManagementService:
    
    @staticmethod
    async def get_supplier_connections(db: AsyncSession, supplier_id: int) -> list[ConnectionResponse]:
        """Get all connections (links) for a supplier with blacklist status"""
        # Get all links for the supplier
        query = select(Link).where(Link.supplier_id == supplier_id).options(
            selectinload(Link.consumer)
        )
        result = await db.execute(query)
        links = result.scalars().all()
        
        # Get blacklisted consumer IDs
        blacklist_query = select(CompanyBlacklist.consumer_id).where(
            CompanyBlacklist.supplier_id == supplier_id
        )
        blacklist_result = await db.execute(blacklist_query)
        blacklisted_ids = set(blacklist_result.scalars().all())
        
        connections = []
        for link in links:
            connections.append(ConnectionResponse(
                id=link.id,
                supplier_id=link.supplier_id,
                consumer_id=link.consumer_id,
                status=link.status.value,
                consumer_name=link.consumer.name,
                is_blacklisted=link.consumer_id in blacklisted_ids
            ))
        
        return connections
    
    @staticmethod
    async def get_supplier_blacklist(db: AsyncSession, supplier_id: int) -> list[BlacklistResponse]:
        """Get blacklisted companies for a supplier"""
        query = select(CompanyBlacklist).where(
            CompanyBlacklist.supplier_id == supplier_id
        ).options(
            selectinload(CompanyBlacklist.consumer),
            selectinload(CompanyBlacklist.blocker)
        )
        result = await db.execute(query)
        blacklist_entries = result.scalars().all()
        
        blacklist = []
        for entry in blacklist_entries:
            blacklist.append(BlacklistResponse(
                id=entry.id,
                supplier_id=entry.supplier_id,
                consumer_id=entry.consumer_id,
                blocked_at=entry.blocked_at,
                blocked_by=entry.blocked_by,
                reason=entry.reason,
                consumer_name=entry.consumer.name,
                blocker_email=entry.blocker.email if entry.blocker else None
            ))
        
        return blacklist
    
    @staticmethod
    async def block_consumer(
        db: AsyncSession, 
        supplier_id: int, 
        blacklist_data: BlacklistCreate, 
        blocker_user: User
    ) -> BlacklistResponse:
        """Block a consumer and remove all connections"""
        
        # Verify consumer exists
        consumer = await db.get(Company, blacklist_data.consumer_id)
        if not consumer:
            raise HTTPException(status_code=404, detail="Consumer company not found")
        
        # Check if already blacklisted
        existing_query = select(CompanyBlacklist).where(
            and_(
                CompanyBlacklist.supplier_id == supplier_id,
                CompanyBlacklist.consumer_id == blacklist_data.consumer_id
            )
        )
        existing_result = await db.execute(existing_query)
        if existing_result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Consumer is already blacklisted")
        
        # Add to blacklist
        blacklist_entry = CompanyBlacklist(
            supplier_id=supplier_id,
            consumer_id=blacklist_data.consumer_id,
            blocked_by=blocker_user.id,
            reason=blacklist_data.reason
        )
        db.add(blacklist_entry)
        
        # Reject all pending/accepted orders between supplier and consumer
        await db.execute(
            update(Order)
            .where(
                and_(
                    Order.supplier_id == supplier_id,
                    Order.consumer_id == blacklist_data.consumer_id,
                    Order.status.in_([OrderStatus.PENDING, OrderStatus.ACCEPTED, OrderStatus.IN_DELIVERY])
                )
            )
            .values(status=OrderStatus.REJECTED)
        )
        
        # Remove/block all existing links
        await db.execute(
            delete(Link).where(
                and_(
                    Link.supplier_id == supplier_id,
                    Link.consumer_id == blacklist_data.consumer_id
                )
            )
        )
        
        await db.commit()
        await db.refresh(blacklist_entry)
        
        # Load relationships for response
        await db.refresh(blacklist_entry, ["consumer", "blocker"])
        
        return BlacklistResponse(
            id=blacklist_entry.id,
            supplier_id=blacklist_entry.supplier_id,
            consumer_id=blacklist_entry.consumer_id,
            blocked_at=blacklist_entry.blocked_at,
            blocked_by=blacklist_entry.blocked_by,
            reason=blacklist_entry.reason,
            consumer_name=blacklist_entry.consumer.name,
            blocker_email=blacklist_entry.blocker.email if blacklist_entry.blocker else None
        )
    
    @staticmethod
    async def unblock_consumer(db: AsyncSession, supplier_id: int, consumer_id: int):
        """Remove consumer from blacklist"""
        
        # Find and remove blacklist entry
        query = select(CompanyBlacklist).where(
            and_(
                CompanyBlacklist.supplier_id == supplier_id,
                CompanyBlacklist.consumer_id == consumer_id
            )
        )
        result = await db.execute(query)
        blacklist_entry = result.scalar_one_or_none()
        
        if not blacklist_entry:
            raise HTTPException(status_code=404, detail="Consumer is not blacklisted")
        
        await db.delete(blacklist_entry)
        await db.commit()
    
    @staticmethod
    async def is_consumer_blacklisted(db: AsyncSession, supplier_id: int, consumer_id: int) -> bool:
        """Check if a consumer is blacklisted by a supplier"""
        query = select(CompanyBlacklist).where(
            and_(
                CompanyBlacklist.supplier_id == supplier_id,
                CompanyBlacklist.consumer_id == consumer_id
            )
        )
        result = await db.execute(query)
        return result.scalar_one_or_none() is not None
    
    @staticmethod
    async def remove_connection(db: AsyncSession, supplier_id: int, consumer_id: int, user: User):
        """Completely remove a connection/link between supplier and consumer"""
        
        # Verify user has permission (Owner or Manager)
        if user.role not in [UserRole.SUPPLIER_OWNER, UserRole.SUPPLIER_MANAGER]:
            raise HTTPException(status_code=403, detail="Only Owners and Managers can remove connections")
        
        if user.company_id != supplier_id:
            raise HTTPException(status_code=403, detail="Can only manage your own company's connections")
        
        # Find and remove the link
        query = select(Link).where(
            and_(
                Link.supplier_id == supplier_id,
                Link.consumer_id == consumer_id
            )
        )
        result = await db.execute(query)
        link = result.scalar_one_or_none()
        
        if not link:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        await db.delete(link)
        await db.commit()