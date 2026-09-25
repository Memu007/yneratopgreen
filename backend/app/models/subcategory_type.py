"""
El «tipo» de un subrubro: el tercer nivel de la taxonomía de la clienta.

No es un nivel más de categorías sino una lista cerrada de valores por
subrubro —en Preparación del suelo: arados, rastras, cultivadores…— que la
publicación puede declarar. La lista sale de `app/services/tipos.py` y la
carga la siembra; no se edita desde el panel.
"""
from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship
import uuid

from app.db.base import Base


class SubcategoryType(Base):
    __tablename__ = "subcategory_types"
    # El slug se repite entre subrubros —hay «otros» en muchos— y dentro de uno
    # no: es lo que viaja en la URL junto con el subrubro.
    __table_args__ = (
        UniqueConstraint("subcategory_id", "slug", name="uq_subcategory_types_subrubro_slug"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    subcategory_id = Column(
        String(36), ForeignKey("subcategories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    slug = Column(String(80), nullable=False)
    name = Column(String(120), nullable=False)
    display_order = Column(Integer, default=0, nullable=False)
    # Dar de baja un tipo no borra lo que ya lo declaró: deja de ofrecerse.
    is_active = Column(Boolean, default=True, nullable=False)

    subcategory = relationship("Subcategory", backref="tipos")

    def __repr__(self):
        return f"<SubcategoryType {self.slug}>"
