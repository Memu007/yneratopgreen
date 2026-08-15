"""
Schemas para el catálogo público de productos
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


# ============= Category Schemas =============

class SubcategoryBase(BaseModel):
    id: str
    name: str
    slug: str
    is_active: bool = True
    
    model_config = ConfigDict(from_attributes=True)


class CategoryBase(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    icon: Optional[str] = None
    display_order: int = 0
    is_service: bool = False

class CategoryResponse(CategoryBase):
    id: str
    product_count: int = 0
    subcategories: List[SubcategoryBase] = []
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# ============= Product Schemas =============

class ProductImageResponse(BaseModel):
    id: str
    url: str
    display_order: int
    is_primary: bool
    
    model_config = ConfigDict(from_attributes=True)

class SellerInfo(BaseModel):
    id: str
    full_name: str
    avatar_url: Optional[str] = None
    location: Optional[str] = None
    rating_average: float = 0.0
    rating_count: int = 0
    sales_count: int = 0
    # Lo único de la revisión documental que es público: si hoy está aprobada.
    # Ni el CUIT, ni la razón social, ni el archivo, ni quién revisó, ni el
    # motivo de un rechazo. Un booleano no dice nada de nadie que no sea el
    # distintivo que ya se muestra en pantalla.
    documentacion_revisada: bool = False

    model_config = ConfigDict(from_attributes=True)

class SellerBasicInfo(BaseModel):
    """Info básica del vendedor para tarjetas de producto"""
    id: str
    full_name: str
    location: Optional[str] = None
    rating_average: float = 0.0
    rating_count: int = 0
    # Viaja en la tarjeta porque el detalle de la publicación se abre con el
    # objeto de la tarjeta. La grilla no lo dibuja: el distintivo se muestra en
    # el bloque del vendedor del detalle.
    documentacion_revisada: bool = False

    model_config = ConfigDict(from_attributes=True)

class ProductBase(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    price: float
    currency: str = "ARS"
    stock: int
    unit: Optional[str] = None

class ProductCardResponse(ProductBase):
    """Schema para tarjetas de productos en grilla/lista"""
    id: str
    category_id: str
    category_name: str
    subcategory_id: Optional[str] = None
    subcategory_name: Optional[str] = None
    is_service: bool = False
    primary_image: Optional[str] = None
    seller: SellerBasicInfo
    views_count: int = 0
    likes_count: int = 0
    sales_count: int = 0
    status: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class ProductDetailResponse(ProductBase):
    """Schema para detalle completo de un producto"""
    id: str
    category_id: str
    category_name: str
    is_service: bool = False
    seller: SellerInfo
    images: List[ProductImageResponse] = []
    views_count: int = 0
    likes_count: int = 0
    sales_count: int = 0
    status: str
    created_at: datetime
    published_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

class ProductListResponse(BaseModel):
    """Response con paginación para listado de productos"""
    items: List[ProductCardResponse]
    total: int
    page: int
    page_size: int
    pages: int
    has_next: bool
    has_prev: bool


# ============= Filter & Search Schemas =============

class ProductFilters(BaseModel):
    """Query parameters para filtrar productos"""
    search: Optional[str] = None
    category: Optional[str] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    in_stock: Optional[bool] = None
    seller_id: Optional[str] = None
    sort_by: str = "created_at"  # created_at, price, sales, views
    sort_order: str = "desc"  # asc, desc
    page: int = 1
    page_size: int = 24
