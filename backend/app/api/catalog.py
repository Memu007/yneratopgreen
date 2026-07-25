"""
API Router para Catálogo Público de Productos
Endpoints públicos (no requieren autenticación)
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_, and_
from typing import List, Optional
from pydantic import BaseModel

from app.db.base import get_db
from app.models.category import Category
from app.models.subcategory import Subcategory
from app.models.product import Product, ProductStatus
from app.models.product_image import ProductImage
from app.models.locality import Locality
from app.models.user import User
from app.schemas.catalog import (
    CategoryResponse,
    SubcategoryBase,
    ProductCardResponse,
    ProductDetailResponse,
    ProductListResponse,
    SellerInfo,
    SellerBasicInfo
)

router = APIRouter(prefix="/catalog", tags=["catalog"])


class ProvinceResponse(BaseModel):
    id: str
    name: str


class LocalityResponse(BaseModel):
    id: str
    name: str
    province_id: str
    province_name: str
    latitude: float
    longitude: float


# ============= Categories =============

@router.get("/categories", response_model=List[CategoryResponse])
def get_categories(
    db: Session = Depends(get_db),
    include_empty: bool = True
):
    """
    Obtener todas las categorías con conteo de productos activos.
    
    - **include_empty**: Incluir categorías sin productos (default: True)
    """
    query = db.query(
        Category,
        func.count(Product.id).label("product_count")
    ).outerjoin(
        Product,
        and_(
            Category.id == Product.category_id,
            Product.status == ProductStatus.ACTIVE
        )
    ).group_by(
        Category.id,
        Category.name,
        Category.slug,
        Category.description,
        Category.icon,
        Category.image_url,
        Category.is_service,
        Category.is_active,
        Category.display_order,
        Category.created_at,
        Category.updated_at
    ).order_by(Category.display_order, Category.name)
    
    results = query.all()
    
    categories = []
    for category, count in results:
        if include_empty or count > 0:
            # Obtener subcategorías activas
            subcategories = db.query(Subcategory).filter(
                Subcategory.category_id == category.id,
                Subcategory.is_active == True
            ).order_by(Subcategory.display_order, Subcategory.name).all()
            
            subcategory_list = [
                SubcategoryBase(
                    id=sub.id,
                    name=sub.name,
                    slug=sub.slug,
                    is_active=sub.is_active
                ) for sub in subcategories
            ]
            
            category_dict = {
                "id": category.id,
                "name": category.name,
                "slug": category.slug,
                "description": category.description,
                "icon": category.icon,
                "display_order": int(category.display_order) if category.display_order else 0,
                "is_service": category.is_service,
                "product_count": count,
                "subcategories": subcategory_list,
                "created_at": category.created_at
            }
            categories.append(CategoryResponse(**category_dict))
    
    return categories


# ============= Form Options =============

from app.models.form_option import FormOption


class FormOptionPublic(BaseModel):
    """Respuesta pública de opción de formulario"""
    value: str
    label: str

    class Config:
        from_attributes = True


@router.get("/form-options")
def get_form_options(
    option_type: Optional[str] = Query(None, description="Tipo: province, unit, pricing_type, availability, response_time"),
    db: Session = Depends(get_db)
):
    """
    Obtener opciones de formulario.
    
    **Tipos disponibles:**
    - province: Provincias de Argentina
    - unit: Unidades de medida (kg, ton, etc.)
    - pricing_type: Tipos de cobro para servicios
    - availability: Opciones de disponibilidad
    - response_time: Tiempos de respuesta
    
    Si no se especifica tipo, devuelve todas las opciones agrupadas.
    """
    query = db.query(FormOption).filter(FormOption.is_active == True)
    
    if option_type:
        query = query.filter(FormOption.option_type == option_type)
        options = query.order_by(FormOption.display_order, FormOption.label).all()
        return [{"value": opt.value, "label": opt.label} for opt in options]
    
    # Devolver todas agrupadas por tipo
    all_options = query.order_by(FormOption.option_type, FormOption.display_order, FormOption.label).all()
    
    grouped = {}
    for opt in all_options:
        if opt.option_type not in grouped:
            grouped[opt.option_type] = []
        grouped[opt.option_type].append({"value": opt.value, "label": opt.label})
    
    return grouped


# ============= Localities =============

@router.get("/localities/provinces", response_model=List[ProvinceResponse])
def get_locality_provinces(db: Session = Depends(get_db)):
    """Provincias presentes en la copia versionada de Georef."""
    rows = db.query(
        Locality.province_id,
        Locality.province_name,
    ).distinct().order_by(Locality.province_name).all()
    return [{"id": row.province_id, "name": row.province_name} for row in rows]


@router.get("/localities", response_model=List[LocalityResponse])
def get_localities(
    province_id: str = Query(..., min_length=2, max_length=2),
    db: Session = Depends(get_db),
):
    """Localidades de una provincia, ordenadas por nombre."""
    rows = db.query(Locality).filter(
        Locality.province_id == province_id
    ).order_by(Locality.name).all()
    return [
        {
            "id": row.id,
            "name": row.name,
            "province_id": row.province_id,
            "province_name": row.province_name,
            "latitude": float(row.latitude),
            "longitude": float(row.longitude),
        }
        for row in rows
    ]


# ============= Products =============

@router.get("/products", response_model=ProductListResponse)
def get_products(
    db: Session = Depends(get_db),
    search: Optional[str] = Query(None, description="Buscar en nombre y descripción"),
    category: Optional[str] = Query(None, description="Filtrar por categoría"),
    min_price: Optional[float] = Query(None, ge=0, description="Precio mínimo"),
    max_price: Optional[float] = Query(None, ge=0, description="Precio máximo"),
    in_stock: Optional[bool] = Query(None, description="Solo productos con stock"),
    seller_id: Optional[str] = Query(None, description="Filtrar por vendedor"),
    sort_by: str = Query("created_at", regex="^(created_at|price|sales|views)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100)
):
    """
    Obtener listado de productos con filtros y paginación.
    
    **Filtros:**
    - search: Busca en nombre y descripción
    - category: UUID de categoría
    - min_price/max_price: Rango de precios
    - in_stock: Solo con stock disponible
    - seller_id: Productos de un vendedor específico
    
    **Ordenamiento:**
    - sort_by: created_at (recientes), price (precio), sales (más vendidos), views (más vistos)
    - sort_order: asc (ascendente), desc (descendente)
    """
    # Query base - incluir información del vendedor y subcategoría
    query = db.query(
        Product,
        Category.name.label("category_name"),
        Category.is_service.label("is_service"),
        Subcategory.id.label("subcategory_id"),
        Subcategory.name.label("subcategory_name"),
        User.id.label("seller_id"),
        User.full_name.label("seller_name"),
        User.location.label("seller_location"),
        User.rating_average.label("seller_rating_average"),
        User.rating_count.label("seller_rating_count")
    ).join(
        Category, Product.category_id == Category.id
    ).outerjoin(
        Subcategory, Product.subcategory_id == Subcategory.id
    ).join(
        User, Product.seller_id == User.id
    ).outerjoin(
        ProductImage,
        and_(ProductImage.product_id == Product.id, ProductImage.is_primary == True)
    ).filter(
        Product.status == ProductStatus.ACTIVE
    )
    
    # Aplicar filtros
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                Product.name.ilike(search_filter),
                Product.description.ilike(search_filter)
            )
        )
    
    if category:
        query = query.filter(Product.category_id == category)
    
    if min_price is not None:
        query = query.filter(Product.price >= min_price)
    
    if max_price is not None:
        query = query.filter(Product.price <= max_price)
    
    if in_stock:
        query = query.filter(Product.stock > 0)
    
    if seller_id:
        query = query.filter(Product.seller_id == seller_id)
    
    # Contar total antes de paginar
    total = query.count()
    
    # Aplicar ordenamiento
    sort_column = {
        "created_at": Product.created_at,
        "price": Product.price,
        "sales": Product.sales_count,
        "views": Product.views_count
    }.get(sort_by, Product.created_at)
    
    if sort_order == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())
    
    # Aplicar paginación
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    
    # Ejecutar query
    results = query.all()
    
    # Construir response
    items = []
    for product, category_name, is_service, subcategory_id, subcategory_name, seller_id, seller_name, seller_location, seller_rating_avg, seller_rating_count in results:
        # Obtener imagen primaria
        primary_image = db.query(ProductImage.url).filter(
            ProductImage.product_id == product.id,
            ProductImage.is_primary == True
        ).first()
        
        # Construir info del vendedor
        seller_info = SellerBasicInfo(
            id=seller_id,
            full_name=seller_name,
            location=seller_location,
            rating_average=float(seller_rating_avg) if seller_rating_avg else 0.0,
            rating_count=int(seller_rating_count) if seller_rating_count else 0
        )
        
        product_dict = {
            "id": product.id,
            "name": product.name,
            "slug": product.slug,
            "description": product.description,
            "price": product.price,
            "currency": product.currency,
            "stock": product.stock,
            "unit": product.unit,
            "category_id": product.category_id,
            "category_name": category_name,
            "subcategory_id": subcategory_id,
            "subcategory_name": subcategory_name,
            "is_service": is_service,
            "primary_image": primary_image[0] if primary_image else None,
            "seller": seller_info,
            "views_count": product.views_count,
            "likes_count": product.likes_count,
            "sales_count": product.sales_count,
            "status": product.status.value,
            "created_at": product.created_at
        }
        items.append(ProductCardResponse(**product_dict))
    
    # Calcular metadata de paginación
    pages = (total + page_size - 1) // page_size
    
    return ProductListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
        has_next=page < pages,
        has_prev=page > 1
    )


@router.get("/products/{product_id}", response_model=ProductDetailResponse)
def get_product_detail(
    product_id: str,
    db: Session = Depends(get_db)
):
    """
    Obtener detalle completo de un producto.
    
    Incluye: información del vendedor, todas las imágenes, categoría, estadísticas.
    """
    # Query con relaciones cargadas
    product = db.query(Product).options(
        joinedload(Product.seller),
        joinedload(Product.category),
        joinedload(Product.images)
    ).filter(
        Product.id == product_id,
        Product.status == ProductStatus.ACTIVE
    ).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    # Incrementar contador de vistas
    product.views_count += 1
    db.commit()
    
    # Construir seller info con rating
    seller_info = SellerInfo(
        id=product.seller.id,
        full_name=product.seller.full_name,
        avatar_url=product.seller.avatar_url,
        location=product.seller.location,
        rating_average=float(product.seller.rating_average) if product.seller.rating_average else 0.0,
        rating_count=int(product.seller.rating_count) if product.seller.rating_count else 0,
        sales_count=int(product.seller.sales_count) if product.seller.sales_count else 0
    )
    
    # Construir response
    product_dict = {
        "id": product.id,
        "name": product.name,
        "slug": product.slug,
        "description": product.description,
        "price": product.price,
        "currency": product.currency,
        "stock": product.stock,
        "unit": product.unit,
        "category_id": product.category_id,
        "category_name": product.category.name,
        "is_service": product.category.is_service,
        "seller": seller_info,
        "images": sorted(product.images, key=lambda x: (not x.is_primary, x.display_order)),
        "views_count": product.views_count,
        "likes_count": product.likes_count,
        "sales_count": product.sales_count,
        "status": product.status.value,
        "created_at": product.created_at,
        "published_at": product.published_at
    }
    
    return ProductDetailResponse(**product_dict)
