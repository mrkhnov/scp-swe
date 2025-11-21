from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from fastapi import HTTPException, UploadFile
from pathlib import Path
from uuid import uuid4

from app.models.product import Product
from app.models.user import User, UserRole
from app.schemas.product import ProductCreate, ProductUpdate
from app.services.link_service import LinkService

BASE_DIR = Path(__file__).resolve().parents[2]
UPLOADS_ROOT = BASE_DIR / "uploads"
PRODUCT_UPLOAD_DIR = UPLOADS_ROOT / "products"


class ProductService:
    @staticmethod
    async def create_product(
        db: AsyncSession,
        user: User,
        product_data: ProductCreate,
        image_file: UploadFile | None = None
    ) -> Product:
        """Supplier Owner/Manager creates a product"""
        # Permission check
        if user.role not in [UserRole.SUPPLIER_OWNER, UserRole.SUPPLIER_MANAGER]:
            raise HTTPException(status_code=403, detail="Only Supplier Owners/Managers can create products")

        # Check SKU uniqueness
        result = await db.execute(select(Product).where(Product.sku == product_data.sku))
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="SKU already exists")

        image_url: str | None = None
        if image_file:
            image_url = await ProductService._save_product_image(image_file)

        is_active = product_data.is_active if product_data.is_active is not None else product_data.stock_quantity > 0

        new_product = Product(
            supplier_id=user.company_id,
            name=product_data.name,
            sku=product_data.sku,
            price=product_data.price,
            stock_quantity=product_data.stock_quantity,
            min_order_qty=product_data.min_order_qty,
            is_active=is_active,
            image_url=image_url
        )
        db.add(new_product)
        await db.commit()
        await db.refresh(new_product)
        return new_product

    @staticmethod
    async def update_product(
        db: AsyncSession,
        product_id: int,
        user: User,
        product_data: ProductUpdate,
        image_file: UploadFile | None = None
    ) -> Product:
        """Supplier Owner/Manager updates a product"""
        # Permission check
        if user.role not in [UserRole.SUPPLIER_OWNER, UserRole.SUPPLIER_MANAGER]:
            raise HTTPException(status_code=403, detail="Only Supplier Owners/Managers can update products")

        product = await db.get(Product, product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        # Verify ownership
        if product.supplier_id != user.company_id:
            raise HTTPException(status_code=403, detail="You can only update your own products")

        # Update fields
        if product_data.name is not None:
            product.name = product_data.name
        if product_data.price is not None:
            product.price = product_data.price
        if product_data.stock_quantity is not None:
            product.stock_quantity = product_data.stock_quantity
        if product_data.min_order_qty is not None:
            product.min_order_qty = product_data.min_order_qty

        if product_data.is_active is not None:
            product.is_active = product_data.is_active
        elif product_data.stock_quantity is not None:
            # Auto-toggle active status based on inventory when explicit flag absent
            product.is_active = product_data.stock_quantity > 0

        if image_file:
            new_image_url = await ProductService._save_product_image(image_file)
            if product.image_url:
                ProductService._delete_product_image(product.image_url)
            product.image_url = new_image_url

        await db.commit()
        await db.refresh(product)
        return product

    @staticmethod
    async def delete_product(db: AsyncSession, product_id: int, user: User):
        """Supplier Owner/Manager deletes a product"""
        # Permission check
        if user.role not in [UserRole.SUPPLIER_OWNER, UserRole.SUPPLIER_MANAGER]:
            raise HTTPException(status_code=403, detail="Only Supplier Owners/Managers can delete products")

        product = await db.get(Product, product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        # Verify ownership
        if product.supplier_id != user.company_id:
            raise HTTPException(status_code=403, detail="You can only delete your own products")

        if product.image_url:
            ProductService._delete_product_image(product.image_url)

        await db.delete(product)
        await db.commit()

    @staticmethod
    async def get_catalog_for_consumer(db: AsyncSession, consumer: User, supplier_id: int | None = None) -> list[Product]:
        """
        Get catalog for consumer - ONLY products from APPROVED suppliers.
        This is the critical link-based filtering logic.
        """
        # Get approved supplier IDs for this consumer
        approved_supplier_ids = await LinkService.get_approved_supplier_ids(db, consumer.company_id)

        if not approved_supplier_ids:
            return []

        # Build query - only show active products with stock > 0
        query = select(Product).where(
            and_(
                Product.supplier_id.in_(approved_supplier_ids),
                Product.is_active == True,
                Product.stock_quantity > 0
            )
        )

        # Filter by specific supplier if requested
        if supplier_id:
            if supplier_id not in approved_supplier_ids:
                raise HTTPException(status_code=403, detail="You don't have an approved link with this supplier")
            query = query.where(Product.supplier_id == supplier_id)

        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def get_supplier_catalog(db: AsyncSession, supplier: User) -> list[Product]:
        """Get all products for supplier (for management)"""
        result = await db.execute(
            select(Product).where(Product.supplier_id == supplier.company_id)
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_product_by_id(db: AsyncSession, product_id: int, user: User) -> Product:
        """Get product by ID with permission check"""
        product = await db.get(Product, product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        # If consumer, verify they have approved link with supplier
        if user.role == UserRole.CONSUMER:
            approved_supplier_ids = await LinkService.get_approved_supplier_ids(db, user.company_id)
            if product.supplier_id not in approved_supplier_ids:
                raise HTTPException(status_code=403, detail="Access denied - no approved link with supplier")

        # If supplier, verify ownership
        elif user.role in [UserRole.SUPPLIER_OWNER, UserRole.SUPPLIER_MANAGER, UserRole.SUPPLIER_SALES]:
            if product.supplier_id != user.company_id:
                raise HTTPException(status_code=403, detail="Access denied - not your product")

        return product

    @staticmethod
    async def _save_product_image(image_file: UploadFile) -> str:
        """Persist uploaded product image and return accessible URL"""
        PRODUCT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

        original_suffix = Path(image_file.filename or "").suffix.lower()
        allowed_suffixes = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
        if original_suffix not in allowed_suffixes:
            raise HTTPException(status_code=400, detail="Unsupported image format")

        file_name = f"{uuid4().hex}{original_suffix}"
        file_path = PRODUCT_UPLOAD_DIR / file_name

        contents = await image_file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Uploaded image is empty")

        file_path.write_bytes(contents)
        return f"/uploads/products/{file_name}"

    @staticmethod
    def _delete_product_image(image_url: str):
        """Remove image file from disk if it exists"""
        if not image_url:
            return

        # image_url stored as /uploads/products/<filename>
        relative_path = image_url.lstrip("/")
        try:
            file_path = (BASE_DIR / relative_path).resolve()
        except Exception:
            return

        uploads_root = UPLOADS_ROOT.resolve()
        if uploads_root not in file_path.parents and file_path != uploads_root:
            return

        if file_path.exists() and file_path.is_file():
            try:
                file_path.unlink()
            except OSError:
                pass
