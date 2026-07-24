"""
Model para opciones configurables de formularios.
Almacena valores dinámicos para dropdowns y selectores.
"""
from sqlalchemy import Column, String, Boolean, Integer, Enum
from sqlalchemy.dialects.mssql import UNIQUEIDENTIFIER
import uuid
import enum

from app.db.base import Base


class OptionType(str, enum.Enum):
    """Tipos de opciones de formulario"""
    PROVINCE = "province"           # Provincias
    UNIT = "unit"                   # Unidades de medida (kg, ton, etc.)
    PRICING_TYPE = "pricing_type"   # Tipos de cobro (por hora, hectárea, etc.)
    AVAILABILITY = "availability"   # Disponibilidad (inmediata, programar, etc.)
    RESPONSE_TIME = "response_time" # Tiempo de respuesta


class FormOption(Base):
    """
    Modelo para opciones de formulario configurables.
    Permite al administrador gestionar los valores de los dropdowns.
    """
    __tablename__ = "form_options"

    id = Column(UNIQUEIDENTIFIER, primary_key=True, default=uuid.uuid4)
    option_type = Column(String(50), nullable=False, index=True)  # province, unit, pricing_type, etc.
    value = Column(String(100), nullable=False)  # Valor interno (ej: 'por_hora')
    label = Column(String(200), nullable=False)  # Etiqueta visible (ej: 'Por hora')
    display_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

    def __repr__(self):
        return f"<FormOption {self.option_type}: {self.value}>"
