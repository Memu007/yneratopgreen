"""Schemas del listado de transportistas compatibles.

Ninguno de estos modelos tiene email, teléfono, WhatsApp, domicilio, CBU ni
alias: el contacto se revela recién cuando el comprador selecciona un
transportista, y esa pieza todavía no existe. Que la ausencia esté acá, en el
contrato de salida, y no en el criterio de quien arme la pantalla.
"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class LocalityBrief(BaseModel):
    id: str
    name: str
    province_name: str


class DistanceToOrigin(BaseModel):
    locality_id: str
    name: str
    province_name: str
    # Distancia en línea recta, no por caminos: es la misma medida con la que
    # se decide la compatibilidad.
    distance_km: float


class CarrierCandidate(BaseModel):
    id: str
    full_name: str
    base_locality_name: str
    base_province_name: str
    transport: str
    # Declaración del transportista, nunca una verificación de TopGreen.
    certification_detail: str
    certification_declared_at: datetime
    coverage_radius_km: float
    capacity: Optional[str] = None
    distance_to_destination_km: float
    distances_to_origins: List[DistanceToOrigin]


class CarrierGroup(BaseModel):
    seller_id: str
    seller_name: str
    origins: List[LocalityBrief]
    # Un producto sin localidad oficial deja al grupo sin poder declarar
    # compatibilidad: no se adivina el origen desde texto libre.
    origin_missing: bool
    carriers: List[CarrierCandidate]


class CompatibleCarriersResponse(BaseModel):
    destination: LocalityBrief
    groups: List[CarrierGroup]
