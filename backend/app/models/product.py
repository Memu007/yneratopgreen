"""
Modelo de Producto - Productos y Servicios publicados por usuarios
"""
from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer, Numeric, ForeignKey, Enum as SQLEnum, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.db.base import Base


class ProductStatus(str, enum.Enum):
    """Estados del producto"""
    ACTIVE = "active"
    PAUSED = "paused"
    SOLD_OUT = "sold_out"
    DELETED = "deleted"


class Product(Base):
    __tablename__ = "products"

    # Identificación
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False, index=True)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=False)
    
    # Tipo de publicación (producto o servicio)
    publication_type = Column(String(20), default="producto", nullable=False, index=True)

    # Qué clase de operación es, de las cuatro que el diseño distingue:
    # activo de alto valor, insumo, servicio o logística. Es un dato
    # declarado en el alta, no una lectura del precio ni del título: la
    # tarjeta y el detalle eligen qué mostrar y qué acción ofrecer a partir
    # de acá. Nunca contradice a `category.is_service`, que es quien sigue
    # decidiendo el cobro y la reserva de stock. Ver `services/anatomia.py`.
    operation_kind = Column(
        String(20), nullable=False, server_default="insumo", index=True
    )

    # Nuevo o usado. La anatomia de activo de alto valor la exige —es lo
    # primero que mira quien compra una maquina—, y las otras tres no la
    # usan. Nula en los registros anteriores a la columna: nadie puede
    # saber hoy si aquel tractor era usado sin adivinarle la descripcion.
    condition = Column(String(20), nullable=True)
    
    # Clasificación
    category_id = Column(String(36), ForeignKey("categories.id"), nullable=False, index=True)
    subcategory_id = Column(String(36), ForeignKey("subcategories.id"), nullable=True, index=True)
    sku = Column(String(100), unique=True, nullable=True)  # Código de producto
    
    # Precio y stock (para productos)
    price = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(3), default="ARS", nullable=False)  # ARS, USD, etc
    stock = Column(Integer, default=0, nullable=True)  # nullable for services
    # Unidades comprometidas por una compra en curso que todavía no se cobró.
    # No se restan de `stock` —la mercadería sigue en el galpón— pero sí de lo
    # disponible: dos compradores no pueden llevarse la misma última unidad. Al
    # acreditarse el pago la reserva se consolida (baja `stock`, sube
    # `sales_count`); si la compra muere, se libera. Nunca queda negativo.
    stock_reservado = Column(
        Integer, default=0, nullable=False, server_default="0"
    )
    unit = Column(String(50), nullable=True)  # unidad, kg, bolsa 20kg, hectárea, etc
    min_order_quantity = Column(Integer, default=1, nullable=False)
    
    # Campos específicos para servicios
    pricing_type = Column(String(50), nullable=True)  # por_hora, por_hectarea, por_trabajo, a_convenir
    availability = Column(String(50), nullable=True)  # inmediata, programar, temporada
    response_time = Column(String(50), nullable=True)  # inmediato, 24hs, 48hs, 1_semana
    experience_years = Column(Integer, nullable=True)
    has_equipment = Column(Boolean, default=True, nullable=True)
    coverage_zones = Column(JSON, nullable=True)  # Lista de zonas de cobertura
    
    # Estado
    status = Column(SQLEnum(ProductStatus), default=ProductStatus.ACTIVE, nullable=False, index=True)
    is_featured = Column(Boolean, default=False, nullable=False)  # Producto destacado
    
    # Métricas
    views_count = Column(Integer, default=0, nullable=False)
    likes_count = Column(Integer, default=0, nullable=False)
    sales_count = Column(Integer, default=0, nullable=False)
    
    # Vendedor
    seller_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Ubicación seleccionada desde el padrón oficial.
    locality_id = Column(String(20), ForeignKey("localities.id"), nullable=True, index=True)
    # Texto derivado para compatibilidad con las respuestas actuales.
    location = Column(String(255), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    published_at = Column(DateTime, nullable=True)
    
    # Relaciones
    category = relationship("Category", back_populates="products")
    subcategory = relationship("Subcategory", backref="products")
    locality = relationship("Locality", back_populates="products")
    seller = relationship("User", back_populates="products")
    images = relationship("ProductImage", back_populates="product", cascade="all, delete-orphan")
    cart_items = relationship("CartItem", back_populates="product")
    order_items = relationship("OrderItem", back_populates="product")

    def __repr__(self):
        return f"<Product {self.name} by {self.seller_id}>"
