from fastapi import APIRouter, Depends, status, Body
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.security import get_current_active_user, require_roles
from app.models.user import User, UserRole
from app.schemas.complaint import ComplaintCreate, ComplaintEscalate, ComplaintResponse
from app.services.complaint_service import ComplaintService

router = APIRouter(prefix="/complaints", tags=["Complaints"])


@router.post("/", response_model=ComplaintResponse, status_code=status.HTTP_201_CREATED)
async def create_complaint(
    complaint_data: ComplaintCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Create a complaint/incident for an order.
    Both Consumer and Supplier can create complaints.
    """
    complaint = await ComplaintService.create_complaint(db, current_user, complaint_data)
    # Reload with order and handler relationships
    await db.refresh(complaint, ["order", "handler"])
    return ComplaintResponse(
        id=complaint.id,
        order_id=complaint.order_id,
        created_by=complaint.created_by,
        consumer_id=complaint.order.consumer_id,
        handler_id=complaint.handler_id,
        handler_name=complaint.handler.email if complaint.handler else None,
        handler_role=complaint.handler.role.value if complaint.handler else None,
        status=complaint.status,
        description=complaint.description
    )


@router.put("/{complaint_id}/assign", response_model=ComplaintResponse)
async def assign_complaint(
    complaint_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.SUPPLIER_SALES]))
):
    """
    Sales Rep assigns themselves to handle a complaint.
    """
    complaint = await ComplaintService.assign_complaint(db, complaint_id, current_user)
    await db.refresh(complaint, ["order", "handler"])
    return ComplaintResponse(
        id=complaint.id,
        order_id=complaint.order_id,
        created_by=complaint.created_by,
        consumer_id=complaint.order.consumer_id,
        handler_id=complaint.handler_id,
        handler_name=complaint.handler.email if complaint.handler else None,
        handler_role=complaint.handler.role.value if complaint.handler else None,
        status=complaint.status,
        description=complaint.description
    )


@router.put("/{complaint_id}/escalate", response_model=ComplaintResponse)
async def escalate_complaint(
    complaint_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    escalate_data: ComplaintEscalate = Body(default=ComplaintEscalate())
):
    """
    Escalate a complaint to Manager level.
    Sales Rep escalates if they cannot resolve.
    Manager can also escalate or reassign.
    Consumer can escalate RESOLVED complaints if not satisfied.
    """
    complaint = await ComplaintService.escalate_complaint(db, complaint_id, current_user, escalate_data)
    await db.refresh(complaint, ["order", "handler"])
    return ComplaintResponse(
        id=complaint.id,
        order_id=complaint.order_id,
        created_by=complaint.created_by,
        consumer_id=complaint.order.consumer_id,
        handler_id=complaint.handler_id,
        handler_name=complaint.handler.email if complaint.handler else None,
        handler_role=complaint.handler.role.value if complaint.handler else None,
        status=complaint.status,
        description=complaint.description
    )


@router.put("/{complaint_id}/resolve", response_model=ComplaintResponse)
async def resolve_complaint(
    complaint_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.SUPPLIER_SALES, UserRole.SUPPLIER_MANAGER]))
):
    """
    Mark complaint as resolved.
    Sales Rep can resolve complaints they're handling.
    Manager can resolve any complaint.
    """
    complaint = await ComplaintService.resolve_complaint(db, complaint_id, current_user)
    await db.refresh(complaint, ["order", "handler"])
    return ComplaintResponse(
        id=complaint.id,
        order_id=complaint.order_id,
        created_by=complaint.created_by,
        consumer_id=complaint.order.consumer_id,
        handler_id=complaint.handler_id,
        handler_name=complaint.handler.email if complaint.handler else None,
        handler_role=complaint.handler.role.value if complaint.handler else None,
        status=complaint.status,
        description=complaint.description
    )


@router.get("/", response_model=list[ComplaintResponse])
async def get_complaints(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get all complaints relevant to the current user's company.
    """
    complaints = await ComplaintService.get_complaints(db, current_user)
    return [
        ComplaintResponse(
            id=c.id,
            order_id=c.order_id,
            created_by=c.created_by,
            consumer_id=c.order.consumer_id,
            handler_id=c.handler_id,
            handler_name=c.handler.email if c.handler else None,
            handler_role=c.handler.role.value if c.handler else None,
            status=c.status,
            description=c.description
        )
        for c in complaints
    ]
