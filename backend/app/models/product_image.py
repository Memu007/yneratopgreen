"""
Modelo de Imagen de Producto - Múltiples imágenes por producto
"""
from sqlalchemy import Column, String, Boolean, DateTime, Integer, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.db.base import Base


class ProductImage(Base):
    __tablename__ = "product_images"

    # Identificación
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id = Column(String(36), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Imagen
    url = Column(String(500), nullable=False)  # URL o path de la imagen
    filename = Column(String(255), nullable=False)  # Nombre del archivo
    file_size = Column(Integer, nullable=True)  # Tamaño en bytes
    
    # Orden y estado
    is_primary = Column(Boolean, default=False, nullable=False)  # Imagen principal
    display_order = Column(Integer, default=0, nullable=False)  # Orden de visualización
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relaciones
    product = relationship("Product", back_populates="images")

    def __repr__(self):
        return f"<ProductImage {self.filename} for product {self.product_id}>"
