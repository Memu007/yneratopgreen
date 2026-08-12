"""Schemas de logística: listado, selección y operaciones asignadas.

Tres contratos de salida distintos, y la diferencia entre ellos es el punto:

- **Listado** (`CarrierCandidate`): sin email, teléfono, WhatsApp, domicilio,
  CBU ni alias. Antes de elegir no hay contacto que mostrar.
- **Selección** (`SelectedCarrier`): agrega el contacto, y sólo se devuelve
  después de que el servidor revalidó que ese transportista cubre ese grupo.
- **Operación asignada** (`CarrierOperation`): lo que ve el transportista.
  Origen, destino, artículos y cantidades. Sin precios, totales, comprobantes,
  datos bancarios ni contacto del comprador.

Que la ausencia esté acá, en el contrato, y no en el criterio de quien arme la
pantalla.
"""
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


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


class SelectCarrierRequest(BaseModel):
    """Lo único que pone el cliente: destino, de qué grupo habla y a quién elige.

    El grupo, sus orígenes y la compatibilidad los vuelve a derivar el servidor
    desde el carrito. Los candidatos que el cliente haya visto no son fuente.
    """
    destination_locality_id: str = Field(..., min_length=1, max_length=20)
    seller_id: str = Field(..., min_length=1, max_length=36)
    carrier_id: str = Field(..., min_length=1, max_length=36)


class SelectedCarrier(CarrierCandidate):
    """El elegido, ya revalidado, con el contacto que hasta acá no se mostró."""
    email: str
    phone: Optional[str] = None
    whatsapp: Optional[str] = None


class SelectCarrierResponse(BaseModel):
    seller_id: str
    seller_name: str
    destination: LocalityBrief
    carrier: SelectedCarrier


class CarrierOperationItem(BaseModel):
    """Qué hay que mover. Sin precio unitario, sin subtotal, sin total."""
    product_name: str
    quantity: int


class CarrierOperation(BaseModel):
    order_id: str
    order_number: str
    created_at: datetime
    # Sin el estado de la orden: hoy dice cosas como «esperando comprobante»,
    # que es la etapa del PAGO. El transportista no tiene nada que hacer con
    # eso y no le corresponde verlo.
    #
    # Quién entrega en el origen sí: es la contraparte del retiro, no un dato
    # comercial. No lleva contacto ni monto.
    seller_name: str
    origins: List[LocalityBrief]
    destination: Optional[LocalityBrief] = None
    items: List[CarrierOperationItem]


class CarrierOperationsResponse(BaseModel):
    operations: List[CarrierOperation]


class OrderShipping(BaseModel):
    """El traslado de una orden, como lo ven comprador y vendedor.

    `mode` en `None` es una orden anterior a esta pieza: traslado no definido.
    No es cuenta propia, y no se muestra como tal.
    """
    mode: Optional[Literal["carrier", "self"]] = None
    carrier_name: Optional[str] = None
    carrier_base: Optional[str] = None
    carrier_transport: Optional[str] = None
    carrier_capacity: Optional[str] = None
    carrier_certification_detail: Optional[str] = None
    carrier_certification_declared_at: Optional[datetime] = None
    carrier_email: Optional[str] = None
    carrier_phone: Optional[str] = None
    carrier_whatsapp: Optional[str] = None
