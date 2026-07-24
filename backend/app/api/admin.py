"""
API Router para administración - Solo accesible por admins
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field

from app.db.base import get_db
from app.models.user import User, UserRole
from app.models.product import Product, ProductStatus
from app.models.order import Order, OrderStatus
from app.core.dependencies import get_current_user
from app.core.security import hash_password
from app.schemas.auth import UserResponse

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(current_user: User = Depends(get_current_user)):
    """Dependency que verifica que el usuario sea admin"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Acceso denegado. Se requiere rol de administrador.")
    return current_user


# ==================== SCHEMAS ====================

class CreateUserRequest(BaseModel):
    """Request para crear un usuario desde admin"""
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str = Field(..., min_length=2, max_length=255)
    phone: Optional[str] = None
    role: UserRole = UserRole.USER
    is_active: bool = True


class UpdateUserRequest(BaseModel):
    """Request para actualizar un usuario desde admin"""
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class UserListResponse(BaseModel):
    """Response con lista de usuarios"""
    users: List[UserResponse]
    total: int
    page: int
    page_size: int


class DashboardStats(BaseModel):
    """Estadísticas del dashboard admin"""
    total_users: int
    total_normal_users: int
    total_admins: int
    total_products: int
    active_products: int
    total_orders: int
    pending_orders: int
    completed_orders: int
    total_revenue: float


# ==================== USUARIOS ====================

@router.get("/users", response_model=UserListResponse)
def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    role: Optional[UserRole] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Listar todos los usuarios con filtros y paginación"""
    query = db.query(User)
    
    # Filtros
    if role:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    if search:
        query = query.filter(
            (User.email.ilike(f"%{search}%")) | 
            (User.full_name.ilike(f"%{search}%"))
        )
    
    # Total
    total = query.count()
    
    # Paginación
    users = query.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    return UserListResponse(
        users=[UserResponse.model_validate(u) for u in users],
        total=total,
        page=page,
        page_size=page_size
    )


@router.post("/users", response_model=UserResponse, status_code=201)
def create_user(
    user_data: CreateUserRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Crear un nuevo usuario (admin puede crear cualquier rol)"""
    # Verificar email único
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    
    # Crear usuario
    new_user = User(
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        full_name=user_data.full_name,
        phone=user_data.phone,
        role=user_data.role,
        is_active=user_data.is_active,
        is_verified=True  # Admin crea usuarios verificados
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return UserResponse.model_validate(new_user)


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Obtener un usuario por ID"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return UserResponse.model_validate(user)


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    update_data: UpdateUserRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Actualizar un usuario"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # No permitir que admin se desactive a sí mismo
    if user.id == admin.id and update_data.is_active == False:
        raise HTTPException(status_code=400, detail="No puedes desactivar tu propia cuenta")
    
    # No permitir cambiar el rol de sí mismo
    if user.id == admin.id and update_data.role and update_data.role != UserRole.ADMIN:
        raise HTTPException(status_code=400, detail="No puedes cambiar tu propio rol de administrador")
    
    # Verificar email único si se está cambiando
    if update_data.email and update_data.email != user.email:
        existing = db.query(User).filter(User.email == update_data.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="El email ya está en uso")
        user.email = update_data.email
    
    # Actualizar campos
    if update_data.full_name is not None:
        user.full_name = update_data.full_name
    if update_data.phone is not None:
        user.phone = update_data.phone
    if update_data.role is not None:
        user.role = update_data.role
    if update_data.is_active is not None:
        user.is_active = update_data.is_active
    
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    
    return UserResponse.model_validate(user)


@router.post("/users/{user_id}/toggle-active")
def toggle_user_active(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Activar/Desactivar un usuario"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="No puedes desactivar tu propia cuenta")
    
    user.is_active = not user.is_active
    user.updated_at = datetime.utcnow()
    db.commit()
    
    return {
        "message": f"Usuario {'activado' if user.is_active else 'desactivado'}",
        "user_id": user.id,
        "is_active": user.is_active
    }


@router.post("/users/{user_id}/reset-password")
def reset_user_password(
    user_id: str,
    new_password: dict,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Resetear contraseña de un usuario"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    password = new_password.get("password")
    if not password or len(password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")
    
    user.password_hash = hash_password(password)
    user.updated_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Contraseña actualizada exitosamente"}


# ==================== PRODUCTOS ====================

@router.get("/products")
def list_all_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    seller_id: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Listar todos los productos (incluyendo inactivos)"""
    query = db.query(Product)
    
    if status:
        query = query.filter(Product.status == status)
    if seller_id:
        query = query.filter(Product.seller_id == seller_id)
    
    total = query.count()
    products = query.order_by(Product.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    result = []
    for p in products:
        primary_image = None
        if p.images:
            for img in p.images:
                if img.is_primary:
                    primary_image = img.url
                    break
            if not primary_image and p.images:
                primary_image = p.images[0].url
        
        result.append({
            "id": p.id,
            "name": p.name,
            "price": float(p.price),
            "stock": p.stock,
            "status": p.status.value if hasattr(p.status, 'value') else p.status,
            "category": p.category.name if p.category else None,
            "seller_id": p.seller_id,
            "seller_name": p.seller.full_name if p.seller else None,
            "image": primary_image,
            "created_at": p.created_at.isoformat() if p.created_at else None
        })
    
    return {
        "products": result,
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.patch("/products/{product_id}/status")
def update_product_status(
    product_id: str,
    status_data: dict,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Cambiar estado de un producto (aprobar, suspender, etc.)"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    new_status = status_data.get("status")
    try:
        product.status = ProductStatus(new_status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Estado inválido: {new_status}")
    
    product.updated_at = datetime.utcnow()
    db.commit()
    
    return {"message": f"Producto actualizado a {new_status}", "product_id": product_id}


@router.delete("/products/{product_id}")
def delete_product_admin(
    product_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Eliminar un producto (soft delete)"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    product.status = ProductStatus.DELETED
    product.updated_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Producto eliminado", "product_id": product_id}


# ==================== ÓRDENES ====================

@router.get("/orders")
def list_all_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Listar todas las órdenes"""
    query = db.query(Order)
    
    if status:
        try:
            query = query.filter(Order.status == OrderStatus(status))
        except ValueError:
            pass
    
    total = query.count()
    orders = query.order_by(Order.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    result = []
    for o in orders:
        result.append({
            "id": o.id,
            "order_number": o.order_number,
            "status": o.status.value,
            "total_amount": float(o.total_amount),
            "buyer_id": o.buyer_id,
            "buyer_name": o.buyer.full_name if o.buyer else None,
            "seller_id": o.seller_id,
            "seller_name": o.seller.full_name if o.seller else None,
            "items_count": len(o.items),
            "created_at": o.created_at.isoformat() if o.created_at else None
        })
    
    return {
        "orders": result,
        "total": total,
        "page": page,
        "page_size": page_size
    }


# ==================== DASHBOARD ====================

@router.get("/dashboard", response_model=DashboardStats)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Obtener estadísticas generales del sistema"""
    # Usuarios
    total_users = db.query(User).count()
    total_normal_users = db.query(User).filter(User.role == UserRole.USER).count()
    total_admins = db.query(User).filter(User.role == UserRole.ADMIN).count()
    
    # Productos
    total_products = db.query(Product).filter(Product.status != ProductStatus.DELETED).count()
    active_products = db.query(Product).filter(Product.status == ProductStatus.ACTIVE).count()
    
    # Órdenes
    total_orders = db.query(Order).count()
    pending_orders = db.query(Order).filter(
        Order.status.in_([OrderStatus.PLACED, OrderStatus.CONFIRMED])
    ).count()
    completed_orders = db.query(Order).filter(Order.status == OrderStatus.DELIVERED).count()
    
    # Revenue
    revenue_result = db.query(func.sum(Order.total_amount)).filter(
        Order.status.in_([OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.DELIVERED])
    ).scalar()
    total_revenue = float(revenue_result) if revenue_result else 0.0
    
    return DashboardStats(
        total_users=total_users,
        total_normal_users=total_normal_users,
        total_admins=total_admins,
        total_products=total_products,
        active_products=active_products,
        total_orders=total_orders,
        pending_orders=pending_orders,
        completed_orders=completed_orders,
        total_revenue=total_revenue
    )


# ==================== CATEGORÍAS ====================

from app.models.category import Category
from app.models.subcategory import Subcategory
import re


def slugify(text: str) -> str:
    """Convertir texto a slug URL-friendly"""
    text = text.lower()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text)
    return text.strip('-')


class CategoryCreateRequest(BaseModel):
    """Request para crear una categoría"""
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    icon: Optional[str] = None
    is_service: bool = False
    is_active: bool = True
    display_order: int = 0


class CategoryUpdateRequest(BaseModel):
    """Request para actualizar una categoría"""
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = None
    icon: Optional[str] = None
    is_service: Optional[bool] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class SubcategoryCreateRequest(BaseModel):
    """Request para crear una subcategoría"""
    name: str = Field(..., min_length=2, max_length=100)
    is_active: bool = True
    display_order: int = 0


class SubcategoryUpdateRequest(BaseModel):
    """Request para actualizar una subcategoría"""
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class SubcategoryResponse(BaseModel):
    """Response de subcategoría"""
    id: str
    name: str
    slug: str
    category_id: str
    is_active: bool
    display_order: int

    class Config:
        from_attributes = True


class CategoryFullResponse(BaseModel):
    """Response de categoría con subcategorías"""
    id: str
    name: str
    slug: str
    description: Optional[str]
    icon: Optional[str]
    is_service: bool
    is_active: bool
    display_order: int
    subcategories: List[SubcategoryResponse] = []
    product_count: int = 0

    class Config:
        from_attributes = True


@router.get("/categories", response_model=List[CategoryFullResponse])
def list_categories(
    is_service: Optional[bool] = None,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Listar todas las categorías con subcategorías"""
    query = db.query(Category)
    
    if is_service is not None:
        query = query.filter(Category.is_service == is_service)
    
    if not include_inactive:
        query = query.filter(Category.is_active == True)
    
    categories = query.order_by(Category.display_order, Category.name).all()
    
    result = []
    for cat in categories:
        product_count = db.query(Product).filter(
            Product.category_id == cat.id,
            Product.status != ProductStatus.DELETED
        ).count()
        
        result.append(CategoryFullResponse(
            id=cat.id,
            name=cat.name,
            slug=cat.slug,
            description=cat.description,
            icon=cat.icon,
            is_service=cat.is_service,
            is_active=cat.is_active,
            display_order=int(cat.display_order) if cat.display_order else 0,
            subcategories=[SubcategoryResponse(
                id=sub.id,
                name=sub.name,
                slug=sub.slug,
                category_id=sub.category_id,
                is_active=sub.is_active,
                display_order=sub.display_order
            ) for sub in cat.subcategories],
            product_count=product_count
        ))
    
    return result


@router.post("/categories", response_model=CategoryFullResponse)
def create_category(
    category_data: CategoryCreateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Crear una nueva categoría"""
    # Verificar nombre único
    existing = db.query(Category).filter(Category.name == category_data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una categoría con ese nombre")
    
    slug = slugify(category_data.name)
    # Asegurar slug único
    counter = 1
    original_slug = slug
    while db.query(Category).filter(Category.slug == slug).first():
        slug = f"{original_slug}-{counter}"
        counter += 1
    
    new_category = Category(
        name=category_data.name,
        slug=slug,
        description=category_data.description,
        icon=category_data.icon,
        is_service=category_data.is_service,
        is_active=category_data.is_active,
        display_order=str(category_data.display_order)
    )
    
    db.add(new_category)
    db.commit()
    db.refresh(new_category)
    
    return CategoryFullResponse(
        id=new_category.id,
        name=new_category.name,
        slug=new_category.slug,
        description=new_category.description,
        icon=new_category.icon,
        is_service=new_category.is_service,
        is_active=new_category.is_active,
        display_order=category_data.display_order,
        subcategories=[],
        product_count=0
    )


@router.put("/categories/{category_id}", response_model=CategoryFullResponse)
def update_category(
    category_id: str,
    category_data: CategoryUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Actualizar una categoría"""
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    
    # Verificar nombre único si se está cambiando
    if category_data.name and category_data.name != category.name:
        existing = db.query(Category).filter(Category.name == category_data.name).first()
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe una categoría con ese nombre")
        category.name = category_data.name
        category.slug = slugify(category_data.name)
    
    if category_data.description is not None:
        category.description = category_data.description
    if category_data.icon is not None:
        category.icon = category_data.icon
    if category_data.is_service is not None:
        category.is_service = category_data.is_service
    if category_data.is_active is not None:
        category.is_active = category_data.is_active
    if category_data.display_order is not None:
        category.display_order = str(category_data.display_order)
    
    db.commit()
    db.refresh(category)
    
    product_count = db.query(Product).filter(
        Product.category_id == category.id,
        Product.status != ProductStatus.DELETED
    ).count()
    
    return CategoryFullResponse(
        id=category.id,
        name=category.name,
        slug=category.slug,
        description=category.description,
        icon=category.icon,
        is_service=category.is_service,
        is_active=category.is_active,
        display_order=int(category.display_order) if category.display_order else 0,
        subcategories=[SubcategoryResponse(
            id=sub.id,
            name=sub.name,
            slug=sub.slug,
            category_id=sub.category_id,
            is_active=sub.is_active,
            display_order=sub.display_order
        ) for sub in category.subcategories],
        product_count=product_count
    )


@router.delete("/categories/{category_id}")
def delete_category(
    category_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Eliminar una categoría (solo si no tiene productos)"""
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    
    # Verificar que no tenga productos
    product_count = db.query(Product).filter(
        Product.category_id == category_id,
        Product.status != ProductStatus.DELETED
    ).count()
    
    if product_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"No se puede eliminar la categoría porque tiene {product_count} productos asociados"
        )
    
    db.delete(category)
    db.commit()
    
    return {"message": f"Categoría '{category.name}' eliminada correctamente"}


# ==================== SUBCATEGORÍAS ====================

@router.post("/categories/{category_id}/subcategories", response_model=SubcategoryResponse)
def create_subcategory(
    category_id: str,
    subcategory_data: SubcategoryCreateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Crear una nueva subcategoría"""
    # Verificar que la categoría exista
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    
    # Verificar nombre único en la categoría
    existing = db.query(Subcategory).filter(
        Subcategory.category_id == category_id,
        Subcategory.name == subcategory_data.name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una subcategoría con ese nombre en esta categoría")
    
    slug = slugify(subcategory_data.name)
    
    new_subcategory = Subcategory(
        name=subcategory_data.name,
        slug=slug,
        category_id=category_id,
        is_active=subcategory_data.is_active,
        display_order=subcategory_data.display_order
    )
    
    db.add(new_subcategory)
    db.commit()
    db.refresh(new_subcategory)
    
    return SubcategoryResponse(
        id=new_subcategory.id,
        name=new_subcategory.name,
        slug=new_subcategory.slug,
        category_id=new_subcategory.category_id,
        is_active=new_subcategory.is_active,
        display_order=new_subcategory.display_order
    )


@router.put("/subcategories/{subcategory_id}", response_model=SubcategoryResponse)
def update_subcategory(
    subcategory_id: str,
    subcategory_data: SubcategoryUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Actualizar una subcategoría"""
    subcategory = db.query(Subcategory).filter(Subcategory.id == subcategory_id).first()
    if not subcategory:
        raise HTTPException(status_code=404, detail="Subcategoría no encontrada")
    
    if subcategory_data.name and subcategory_data.name != subcategory.name:
        # Verificar nombre único en la categoría
        existing = db.query(Subcategory).filter(
            Subcategory.category_id == subcategory.category_id,
            Subcategory.name == subcategory_data.name,
            Subcategory.id != subcategory_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe una subcategoría con ese nombre en esta categoría")
        subcategory.name = subcategory_data.name
        subcategory.slug = slugify(subcategory_data.name)
    
    if subcategory_data.is_active is not None:
        subcategory.is_active = subcategory_data.is_active
    if subcategory_data.display_order is not None:
        subcategory.display_order = subcategory_data.display_order
    
    db.commit()
    db.refresh(subcategory)
    
    return SubcategoryResponse(
        id=subcategory.id,
        name=subcategory.name,
        slug=subcategory.slug,
        category_id=subcategory.category_id,
        is_active=subcategory.is_active,
        display_order=subcategory.display_order
    )


@router.delete("/subcategories/{subcategory_id}")
def delete_subcategory(
    subcategory_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Eliminar una subcategoría"""
    subcategory = db.query(Subcategory).filter(Subcategory.id == subcategory_id).first()
    if not subcategory:
        raise HTTPException(status_code=404, detail="Subcategoría no encontrada")
    
    name = subcategory.name
    db.delete(subcategory)
    db.commit()
    
    return {"message": f"Subcategoría '{name}' eliminada correctamente"}


# ==================== FORM OPTIONS CRUD ====================

from app.models.form_option import FormOption, OptionType


class FormOptionCreate(BaseModel):
    """Request para crear una opción de formulario"""
    option_type: str = Field(..., description="Tipo: province, unit, pricing_type, availability, response_time")
    value: str = Field(..., min_length=1, max_length=100)
    label: str = Field(..., min_length=1, max_length=200)
    display_order: int = 0
    is_active: bool = True


class FormOptionUpdate(BaseModel):
    """Request para actualizar una opción de formulario"""
    value: Optional[str] = None
    label: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


class FormOptionResponse(BaseModel):
    """Response de opción de formulario"""
    id: str
    option_type: str
    value: str
    label: str
    display_order: int
    is_active: bool

    class Config:
        from_attributes = True


# Tipos de opciones disponibles
VALID_OPTION_TYPES = ['province', 'unit', 'pricing_type', 'availability', 'response_time']


@router.get("/form-options/types")
def get_option_types(
    admin: User = Depends(require_admin)
):
    """Obtener tipos de opciones disponibles"""
    return {
        "types": [
            {"value": "province", "label": "Provincias", "description": "Provincias de Argentina"},
            {"value": "unit", "label": "Unidades", "description": "Unidades de medida (kg, ton, etc.)"},
            {"value": "pricing_type", "label": "Tipos de Cobro", "description": "Formas de cobro para servicios"},
            {"value": "availability", "label": "Disponibilidad", "description": "Opciones de disponibilidad"},
            {"value": "response_time", "label": "Tiempo de Respuesta", "description": "Tiempos de respuesta para servicios"},
        ]
    }


@router.get("/form-options", response_model=List[FormOptionResponse])
def list_form_options(
    option_type: Optional[str] = None,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Listar opciones de formulario, opcionalmente filtradas por tipo"""
    query = db.query(FormOption)
    
    if option_type:
        if option_type not in VALID_OPTION_TYPES:
            raise HTTPException(status_code=400, detail=f"Tipo inválido. Valores permitidos: {VALID_OPTION_TYPES}")
        query = query.filter(FormOption.option_type == option_type)
    
    if not include_inactive:
        query = query.filter(FormOption.is_active == True)
    
    options = query.order_by(FormOption.option_type, FormOption.display_order, FormOption.label).all()
    
    return [FormOptionResponse(
        id=str(opt.id),
        option_type=opt.option_type,
        value=opt.value,
        label=opt.label,
        display_order=opt.display_order or 0,
        is_active=opt.is_active
    ) for opt in options]


@router.post("/form-options", response_model=FormOptionResponse)
def create_form_option(
    option_data: FormOptionCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Crear una nueva opción de formulario"""
    if option_data.option_type not in VALID_OPTION_TYPES:
        raise HTTPException(status_code=400, detail=f"Tipo inválido. Valores permitidos: {VALID_OPTION_TYPES}")
    
    # Verificar que no exista el mismo value para el mismo tipo
    existing = db.query(FormOption).filter(
        FormOption.option_type == option_data.option_type,
        FormOption.value == option_data.value
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una opción con ese valor para este tipo")
    
    option = FormOption(
        option_type=option_data.option_type,
        value=option_data.value,
        label=option_data.label,
        display_order=option_data.display_order,
        is_active=option_data.is_active
    )
    
    db.add(option)
    db.commit()
    db.refresh(option)
    
    return FormOptionResponse(
        id=str(option.id),
        option_type=option.option_type,
        value=option.value,
        label=option.label,
        display_order=option.display_order or 0,
        is_active=option.is_active
    )


@router.put("/form-options/{option_id}", response_model=FormOptionResponse)
def update_form_option(
    option_id: str,
    option_data: FormOptionUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Actualizar una opción de formulario"""
    option = db.query(FormOption).filter(FormOption.id == option_id).first()
    if not option:
        raise HTTPException(status_code=404, detail="Opción no encontrada")
    
    if option_data.value is not None and option_data.value != option.value:
        # Verificar unicidad
        existing = db.query(FormOption).filter(
            FormOption.option_type == option.option_type,
            FormOption.value == option_data.value,
            FormOption.id != option_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe una opción con ese valor")
        option.value = option_data.value
    
    if option_data.label is not None:
        option.label = option_data.label
    if option_data.display_order is not None:
        option.display_order = option_data.display_order
    if option_data.is_active is not None:
        option.is_active = option_data.is_active
    
    db.commit()
    db.refresh(option)
    
    return FormOptionResponse(
        id=str(option.id),
        option_type=option.option_type,
        value=option.value,
        label=option.label,
        display_order=option.display_order or 0,
        is_active=option.is_active
    )


@router.delete("/form-options/{option_id}")
def delete_form_option(
    option_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Eliminar una opción de formulario"""
    option = db.query(FormOption).filter(FormOption.id == option_id).first()
    if not option:
        raise HTTPException(status_code=404, detail="Opción no encontrada")
    
    label = option.label
    db.delete(option)
    db.commit()
    
    return {"message": f"Opción '{label}' eliminada correctamente"}
