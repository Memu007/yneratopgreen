"""
Schemas para gestión de productos y servicios (crear, editar)
"""
from typing import Optional, List, Literal
from pydantic import BaseModel, Field
from uuid import UUID


class ProductCreateRequest(BaseModel):
    name: str = Field(..., min_length=3, max_length=255)
    description: str = Field(..., min_length=10)
    category_id: str
    subcategory_id: Optional[str] = None  # ID de subcategoría opcional
    price: float = Field(..., ge=0)  # ge=0 para permitir servicios "a convenir"
    stock: Optional[int] = Field(None, ge=0)  # Opcional para servicios
    unit: Optional[str] = Field(None, max_length=50)
    locality_id: str = Field(..., max_length=20)
    
    # Tipo de publicación
    publication_type: Literal["producto", "servicio"] = "producto"

    # La anatomía declarada. Opcional: si no viene, se usa la que declara la
    # categoría elegida. Si viene y contradice a `category.is_service`, el alta
    # se rechaza en lugar de corregirla en silencio.
    operation_kind: Optional[Literal["activo", "insumo", "servicio", "logistica"]] = None
    # Obligatoria cuando la anatomia es `activo`; ignorada en las otras.
    condition: Optional[Literal["nuevo", "usado"]] = None
    
    # Campos específicos para servicios
    pricing_type: Optional[str] = Field(None, max_length=50)  # por_hora, por_hectarea, por_trabajo, a_convenir
    availability: Optional[str] = Field(None, max_length=50)  # inmediata, programar, temporada
    response_time: Optional[str] = Field(None, max_length=50)  # inmediato, 24hs, 48hs, 1_semana
    experience_years: Optional[int] = Field(None, ge=0)
    has_equipment: Optional[bool] = True
    coverage_zones: Optional[List[str]] = None


class ProductUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = None
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None  # ID de subcategoría opcional
    price: Optional[float] = Field(None, ge=0)
    stock: Optional[int] = Field(None, ge=0)
    unit: Optional[str] = Field(None, max_length=50)
    locality_id: Optional[str] = Field(None, max_length=20)
    status: Optional[Literal["active", "paused"]] = None  # Para pausar/activar producto
    operation_kind: Optional[Literal["activo", "insumo", "servicio", "logistica"]] = None
    condition: Optional[Literal["nuevo", "usado"]] = None
    
    # Campos específicos para servicios
    pricing_type: Optional[str] = Field(None, max_length=50)
    availability: Optional[str] = Field(None, max_length=50)
    response_time: Optional[str] = Field(None, max_length=50)
    experience_years: Optional[int] = Field(None, ge=0)
    has_equipment: Optional[bool] = None
    coverage_zones: Optional[List[str]] = None


class ProductResponse(BaseModel):
    id: str
    name: str
    slug: str
    publication_type: str = "producto"
    operation_kind: str = "insumo"
    message: str = "Publicación creada exitosamente"
