from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status

from app.models.complaint import Complaint, ComplaintStatus
from app.models.order import Order
from app.models.user import User, UserRole
from app.schemas.complaint import ComplaintCreate, ComplaintEscalate


class ComplaintService:
    @staticmethod
    async def create_complaint(db: AsyncSession, user: User, complaint_data: ComplaintCreate) -> Complaint:
        """Create a complaint for an order"""
        # Verify order exists
        order = await db.get(Order, complaint_data.order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        # Verify user has access to this order
        if user.company_id not in [order.consumer_id, order.supplier_id]:
            raise HTTPException(status_code=403, detail="You cannot create a complaint for this order")

        new_complaint = Complaint(
            order_id=complaint_data.order_id,
            description=complaint_data.description,
            status=ComplaintStatus.OPEN,
            handler_id=None
        )
        db.add(new_complaint)
        await db.commit()
        await db.refresh(new_complaint)
        return new_complaint

    @staticmethod
    async def assign_complaint(db: AsyncSession, complaint_id: int, user: User) -> Complaint:
        """Sales Rep assigns themselves to handle a complaint"""
        if user.role != UserRole.SUPPLIER_SALES:
            raise HTTPException(status_code=403, detail="Only Sales Reps can assign themselves to complaints")

        complaint = await db.get(Complaint, complaint_id)
        if not complaint:
            raise HTTPException(status_code=404, detail="Complaint not found")

        # Verify the complaint is for an order belonging to supplier's company
        order = await db.get(Order, complaint.order_id)
        if order.supplier_id != user.company_id:
            raise HTTPException(status_code=403, detail="This complaint is not for your company")

        if complaint.status == ComplaintStatus.RESOLVED:
            raise HTTPException(status_code=400, detail="Complaint is already resolved")

        complaint.handler_id = user.id
        await db.commit()
        await db.refresh(complaint)
        return complaint

    @staticmethod
    async def escalate_complaint(db: AsyncSession, complaint_id: int, user: User, escalate_data: ComplaintEscalate) -> Complaint:
        """
        Escalate complaint to Manager.
        Sales Rep can escalate if they cannot resolve.
        """
        complaint = await db.get(Complaint, complaint_id)
        if not complaint:
            raise HTTPException(status_code=404, detail="Complaint not found")

        # Verify permissions
        order = await db.get(Order, complaint.order_id)
        if user.role == UserRole.SUPPLIER_SALES:
            if order.supplier_id != user.company_id:
                raise HTTPException(status_code=403, detail="Not your company's complaint")
            if complaint.handler_id != user.id:
                raise HTTPException(status_code=403, detail="You can only escalate complaints you are handling")
        elif user.role in [UserRole.SUPPLIER_OWNER, UserRole.SUPPLIER_MANAGER]:
            if order.supplier_id != user.company_id:
                raise HTTPException(status_code=403, detail="Not your company's complaint")
        else:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        if complaint.status == ComplaintStatus.RESOLVED:
            raise HTTPException(status_code=400, detail="Complaint is already resolved")

        complaint.status = ComplaintStatus.ESCALATED
        if escalate_data.handler_id:
            # Verify new handler is a Manager
            new_handler = await db.get(User, escalate_data.handler_id)
            if not new_handler or new_handler.role != UserRole.SUPPLIER_MANAGER:
                raise HTTPException(status_code=400, detail="Handler must be a Supplier Manager")
            complaint.handler_id = escalate_data.handler_id

        await db.commit()
        await db.refresh(complaint)
        return complaint

    @staticmethod
    async def resolve_complaint(db: AsyncSession, complaint_id: int, user: User) -> Complaint:
        """Resolve a complaint (Sales Rep or Manager)"""
        complaint = await db.get(Complaint, complaint_id)
        if not complaint:
            raise HTTPException(status_code=404, detail="Complaint not found")

        # Verify permissions
        order = await db.get(Order, complaint.order_id)
        if user.role in [UserRole.SUPPLIER_SALES, UserRole.SUPPLIER_MANAGER]:
            if order.supplier_id != user.company_id:
                raise HTTPException(status_code=403, detail="Not your company's complaint")
            # Sales can resolve if they're the handler or if it's OPEN
            # Manager can resolve any escalated or open complaint
            if user.role == UserRole.SUPPLIER_SALES and complaint.handler_id != user.id and complaint.status != ComplaintStatus.OPEN:
                raise HTTPException(status_code=403, detail="You can only resolve complaints you are handling")
        else:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        complaint.status = ComplaintStatus.RESOLVED
        await db.commit()
        await db.refresh(complaint)
        return complaint

    @staticmethod
    async def get_complaints(db: AsyncSession, user: User) -> list[Complaint]:
        """Get complaints relevant to the user"""
        if user.role == UserRole.CONSUMER:
            # Get complaints for orders from consumer's company
            result = await db.execute(
                select(Complaint).join(Order).where(Order.consumer_id == user.company_id)
            )
        elif user.role in [UserRole.SUPPLIER_OWNER, UserRole.SUPPLIER_MANAGER, UserRole.SUPPLIER_SALES]:
            # Get complaints for orders from supplier's company
            result = await db.execute(
                select(Complaint).join(Order).where(Order.supplier_id == user.company_id)
            )
        else:
            return []

        return list(result.scalars().all())
