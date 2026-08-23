"""
Modelo de Categoría - Clasificación de productos y servicios
"""
from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.db.base import Base


class Category(Base):
    __tablename__ = "categories"

    # Identificación
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), unique=True, nullable=False, index=True)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    
    # Iconos e imágenes
    icon = Column(String(100), nullable=True)  # Nombre del ícono o emoji
    image_url = Column(String(500), nullable=True)  # URL de imagen de categoría
    
    # Tipo de categoría
    is_service = Column(Boolean, default=False, nullable=False)  # True para categorías de servicio

    # La anatomía que traen por omisión las publicaciones de esta
    # categoría. Es lo que preselecciona el alta y lo que usó la migración
    # para los registros que ya existían. Siempre cae del mismo lado que
    # `is_service`.
    default_operation_kind = Column(
        String(20), nullable=False, server_default="insumo"
    )
    
    # Estado
    is_active = Column(Boolean, default=True, nullable=False)
    display_order = Column(String(10), nullable=True)  # Orden de visualización
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relaciones
    products = relationship("Product", back_populates="category")
    subcategories = relationship("Subcategory", back_populates="category", cascade="all, delete-orphan", order_by="Subcategory.display_order")

    def __repr__(self):
        return f"<Category {self.name}>"
