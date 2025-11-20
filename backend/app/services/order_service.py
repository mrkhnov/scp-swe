from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from fastapi import HTTPException, status

from app.models.order import Order, OrderItem, OrderStatus
from app.models.product import Product
from app.models.company import Company, CompanyType
from app.models.user import User, UserRole
from app.models.link import Link, LinkStatus
from app.schemas.order import OrderCreate, OrderStatusUpdate


class OrderService:
    @staticmethod
    async def create_order(db: AsyncSession, consumer: User, order_data: OrderCreate) -> Order:
        """Consumer creates an order with a linked supplier"""
        # Verify consumer's company is a CONSUMER type
        consumer_company = await db.get(Company, consumer.company_id)
        if not consumer_company or consumer_company.type != CompanyType.CONSUMER:
            raise HTTPException(status_code=403, detail="Only Consumer companies can create orders")

        # Verify supplier exists
        supplier_company = await db.get(Company, order_data.supplier_id)
        if not supplier_company or supplier_company.type != CompanyType.SUPPLIER:
            raise HTTPException(status_code=400, detail="Invalid supplier")

        # CRUCIAL: Check if link is APPROVED
        link_result = await db.execute(
            select(Link).where(
                and_(
                    Link.consumer_id == consumer.company_id,
                    Link.supplier_id == order_data.supplier_id,
                    Link.status == LinkStatus.APPROVED
                )
            )
        )
        link = link_result.scalar_one_or_none()
        if not link:
            raise HTTPException(
                status_code=403,
                detail="You do not have an approved link with this supplier"
            )

        # Verify all products belong to the supplier and are available
        total_amount = 0.0
        order_items_data = []

        for item in order_data.items:
            product = await db.get(Product, item.product_id)
            if not product:
                raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
            
            if product.supplier_id != order_data.supplier_id:
                raise HTTPException(
                    status_code=400,
                    detail=f"Product {item.product_id} does not belong to supplier {order_data.supplier_id}"
                )
            
            if not product.is_active:
                raise HTTPException(status_code=400, detail=f"Product {product.name} is not active")
            
            if item.quantity < product.min_order_qty:
                raise HTTPException(
                    status_code=400,
                    detail=f"Product {product.name} requires minimum order quantity of {product.min_order_qty}"
                )

            # Check stock (soft check at order creation - hard check at acceptance)
            if item.quantity > product.stock_quantity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock for product {product.name}. Available: {product.stock_quantity}"
                )

            item_total = float(product.price) * item.quantity
            total_amount += item_total
            
            order_items_data.append({
                "product_id": product.id,
                "quantity": item.quantity,
                "unit_price_at_time": float(product.price)
            })

        # Create order
        new_order = Order(
            consumer_id=consumer.company_id,
            supplier_id=order_data.supplier_id,
            status=OrderStatus.PENDING,
            total_amount=total_amount
        )
        db.add(new_order)
        await db.flush()

        # Create order items
        for item_data in order_items_data:
            order_item = OrderItem(
                order_id=new_order.id,
                **item_data
            )
            db.add(order_item)

        await db.commit()
        await db.refresh(new_order)
        
        # Eagerly load items relationship
        from sqlalchemy.orm import selectinload
        result = await db.execute(
            select(Order).where(Order.id == new_order.id).options(selectinload(Order.items))
        )
        new_order = result.scalar_one()
        
        # Send real-time notification to supplier company
        from app.services.chat_service import manager
        await manager.broadcast_to_company(
            {"type": "order_update", "order_id": new_order.id},
            order_data.supplier_id,
            db
        )
        
        return new_order

    @staticmethod
    async def update_order_status(
        db: AsyncSession,
        order_id: int,
        user: User,
        status_update: OrderStatusUpdate
    ) -> Order:
        """Update order status with role-based permissions and inventory management"""
        order = await db.get(Order, order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        # Permission checks
        if user.role == UserRole.CONSUMER:
            # Consumer can only cancel their own orders
            if user.company_id != order.consumer_id:
                raise HTTPException(status_code=403, detail="Not your order")
            if status_update.status != OrderStatus.CANCELLED:
                raise HTTPException(status_code=403, detail="Consumers can only cancel orders")
            if order.status not in [OrderStatus.PENDING, OrderStatus.ACCEPTED]:
                raise HTTPException(status_code=400, detail="Order cannot be cancelled in current state")
        
        elif user.role in [UserRole.SUPPLIER_OWNER, UserRole.SUPPLIER_MANAGER, UserRole.SUPPLIER_SALES]:
            # Supplier can accept/reject/update their orders
            if user.company_id != order.supplier_id:
                raise HTTPException(status_code=403, detail="Not your order")
        else:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        # Handle ACCEPTED status with atomic inventory decrement
        if status_update.status == OrderStatus.ACCEPTED and order.status == OrderStatus.PENDING:
            await OrderService._decrement_inventory(db, order)

        # Handle CANCELLED/REJECTED status - restore inventory if it was decremented
        if status_update.status in [OrderStatus.CANCELLED, OrderStatus.REJECTED]:
            if order.status == OrderStatus.ACCEPTED:
                await OrderService._restore_inventory(db, order)

        order.status = status_update.status
        await db.commit()
        await db.refresh(order)
        
        # Eagerly load items relationship
        from sqlalchemy.orm import selectinload
        result = await db.execute(
            select(Order).where(Order.id == order.id).options(selectinload(Order.items))
        )
        updated_order = result.scalar_one()
        
        # Send real-time notification to both companies
        from app.services.chat_service import manager
        await manager.broadcast_to_company(
            {"type": "order_update", "order_id": order.id},
            order.supplier_id,
            db
        )
        await manager.broadcast_to_company(
            {"type": "order_update", "order_id": order.id},
            order.consumer_id,
            db
        )
        
        return updated_order

    @staticmethod
    async def _decrement_inventory(db: AsyncSession, order: Order):
        """Atomically decrement stock quantities for order items"""
        # Load order items
        items_result = await db.execute(
            select(OrderItem).where(OrderItem.order_id == order.id)
        )
        items = list(items_result.scalars().all())

        for item in items:
            product = await db.get(Product, item.product_id)
            if not product:
                raise HTTPException(status_code=500, detail=f"Product {item.product_id} not found")
            
            if product.stock_quantity < item.quantity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock for product {product.name}. Available: {product.stock_quantity}, Required: {item.quantity}"
                )
            
            product.stock_quantity -= item.quantity

        await db.flush()

    @staticmethod
    async def _restore_inventory(db: AsyncSession, order: Order):
        """Restore stock quantities when order is cancelled/rejected after acceptance"""
        items_result = await db.execute(
            select(OrderItem).where(OrderItem.order_id == order.id)
        )
        items = list(items_result.scalars().all())

        for item in items:
            product = await db.get(Product, item.product_id)
            if product:
                product.stock_quantity += item.quantity

        await db.flush()

    @staticmethod
    async def get_consumer_orders(db: AsyncSession, consumer: User) -> list[Order]:
        """Get all orders for a consumer"""
        from sqlalchemy.orm import selectinload
        result = await db.execute(
            select(Order).where(Order.consumer_id == consumer.company_id).options(selectinload(Order.items))
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_supplier_orders(db: AsyncSession, supplier: User) -> list[Order]:
        """Get all orders for a supplier"""
        from sqlalchemy.orm import selectinload
        result = await db.execute(
            select(Order).where(Order.supplier_id == supplier.company_id).options(selectinload(Order.items))
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_order_by_id(db: AsyncSession, order_id: int, user: User) -> Order:
        """Get order by ID with permission check"""
        order = await db.get(Order, order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        # Verify user has access to this order
        if user.company_id not in [order.consumer_id, order.supplier_id]:
            raise HTTPException(status_code=403, detail="Access denied")

        return order
