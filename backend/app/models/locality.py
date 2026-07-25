"""Localidades oficiales de Argentina con coordenadas geográficas."""
from sqlalchemy import Column, Index, Numeric, String
from sqlalchemy.orm import relationship
from geoalchemy2 import Geography

from app.db.base import Base


class Locality(Base):
    __tablename__ = "localities"

    # Identificador oficial de Georef.
    id = Column(String(20), primary_key=True)
    name = Column(String(200), nullable=False, index=True)
    province_id = Column(String(2), nullable=False, index=True)
    province_name = Column(String(100), nullable=False, index=True)
    department_id = Column(String(5), nullable=True)
    department_name = Column(String(150), nullable=True)
    source = Column(String(100), nullable=True)
    latitude = Column(Numeric(11, 8), nullable=False)
    longitude = Column(Numeric(11, 8), nullable=False)
    coordinates = Column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=False),
        nullable=False,
    )

    products = relationship("Product", back_populates="locality")

    __table_args__ = (
        Index("ix_localities_province_name_name", "province_name", "name"),
        Index("ix_localities_coordinates", "coordinates", postgresql_using="gist"),
    )

    def __repr__(self):
        return f"<Locality {self.name}, {self.province_name}>"
