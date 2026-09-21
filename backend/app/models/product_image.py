"""
Modelo de Imagen de Producto - Múltiples imágenes por producto
"""
from sqlalchemy import (
    Column, String, Boolean, DateTime, Integer, ForeignKey, Index, text,
)
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.db.base import Base


class ProductImage(Base):
    __tablename__ = "product_images"

    # Cero o una principal por publicacion, y lo decide la base.
    #
    # Es un indice unico PARCIAL: la unicidad vale solo entre las filas con
    # `is_primary`. Una publicacion puede tener varias secundarias, y puede no
    # tener ninguna principal; lo que no puede tener es dos.
    #
    # Va tambien en la migracion `b6d3f12a8e94`. Declararlo en los dos lados no
    # es una copia de mas: si estuviera solo en la migracion, el modelo y el
    # esquema no coincidirian y `alembic check` lo marcaria en cada corrida.
    __table_args__ = (
        Index(
            "uq_product_images_primaria_unica",
            "product_id",
            unique=True,
            postgresql_where=text("is_primary"),
        ),
    )

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
