"""Listado, selección y operaciones asignadas de transportistas.

El listado es un DIRECTORIO, no una recomendación: muestra quiénes cubren
geográficamente el viaje, no ordena por "mejor", no puntúa y no elige. Y no
entrega datos de contacto: el contacto aparece recién cuando el comprador
selecciona, y sólo después de que el servidor revalidó la compatibilidad.

La regla de compatibilidad y el agrupamiento del carrito viven en
`app.services.logistica`, porque los usan también los dos checkouts. La misma
pregunta se hace al elegir y otra vez al confirmar la compra.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.base import get_db
from app.models.locality import Locality
from app.models.order import Order
from app.models.user import User
from app.schemas.logistics import (
    CarrierCandidate,
    CarrierGroup,
    CarrierOperation,
    CarrierOperationItem,
    CarrierOperationsResponse,
    CompatibleCarriersResponse,
    DistanceToOrigin,
    LocalityBrief,
    SelectCarrierRequest,
    SelectCarrierResponse,
    SelectedCarrier,
)
from app.services.logistica import (
    CANDIDATOS_COMPATIBLES,
    DISTANCIAS_A_ORIGENES,
    MODO_TRANSPORTISTA,
    carrito_activo,
    grupos_del_carrito,
    resolver_destino,
    transportista_para,
)

router = APIRouter(prefix="/logistics", tags=["logistics"])


def _breve(locality: Locality) -> LocalityBrief:
    return LocalityBrief(
        id=locality.id,
        name=locality.name,
        province_name=locality.province_name,
    )


def _candidatos(db: Session, destino: Locality, grupo) -> List[CarrierCandidate]:
    ids_origen = grupo.ids_de_origen
    filas = db.execute(
        CANDIDATOS_COMPATIBLES,
        {"destino": destino.id, "origenes": ids_origen},
    ).mappings().all()
    if not filas:
        return []

    por_base = {}
    bases = sorted({fila["base_locality_id"] for fila in filas})
    for d in db.execute(
        DISTANCIAS_A_ORIGENES,
        {"bases": bases, "origenes": ids_origen},
    ).mappings().all():
        por_base.setdefault(d["base_id"], []).append(d)

    return [
        CarrierCandidate(
            id=fila["id"],
            full_name=fila["full_name"],
            base_locality_name=fila["base_locality_name"],
            base_province_name=fila["base_province_name"],
            transport=fila["carrier_transport"],
            certification_detail=fila["carrier_certification_detail"],
            certification_declared_at=fila["carrier_certification_declared_at"],
            coverage_radius_km=float(fila["carrier_coverage_radius_km"]),
            capacity=fila["carrier_capacity"],
            distance_to_destination_km=round(float(fila["km_destino"]), 1),
            distances_to_origins=[
                DistanceToOrigin(
                    locality_id=d["origen_id"],
                    name=d["name"],
                    province_name=d["province_name"],
                    distance_km=round(float(d["km"]), 1),
                )
                for d in por_base.get(fila["base_locality_id"], [])
            ],
        )
        for fila in filas
    ]


@router.get("/compatible-carriers", response_model=CompatibleCarriersResponse)
def compatible_carriers(
    destination_locality_id: str = Query(..., min_length=1, max_length=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Transportistas que cubren el viaje, agrupados por futura orden.

    Los grupos salen del carrito activo del servidor. El cliente elige el
    destino y nada más: no puede dictar vendedor, origen ni radio.
    """
    destino = resolver_destino(db, destination_locality_id)
    grupos = grupos_del_carrito(carrito_activo(db, current_user))

    salida: List[CarrierGroup] = []
    for grupo in grupos.values():
        origenes = list(grupo.origenes.values())
        salida.append(CarrierGroup(
            seller_id=grupo.vendedor.id,
            seller_name=grupo.vendedor.full_name,
            origins=[_breve(o) for o in origenes],
            origin_missing=not grupo.medible,
            carriers=[] if not grupo.medible else _candidatos(db, destino, grupo),
        ))

    return CompatibleCarriersResponse(destination=_breve(destino), groups=salida)


@router.post("/select-carrier", response_model=SelectCarrierResponse)
def select_carrier(
    seleccion: SelectCarrierRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Confirma una elección y recién ahí devuelve el contacto.

    No se confía en el candidato que el cliente vio: el grupo se vuelve a
    derivar del carrito del servidor y la compatibilidad se vuelve a preguntar
    contra el destino y TODOS los orígenes de ese grupo. Si algo cambió entre
    la búsqueda y la elección, esto falla y no hay contacto.
    """
    destino = resolver_destino(db, seleccion.destination_locality_id)
    grupos = grupos_del_carrito(carrito_activo(db, current_user))

    grupo = grupos.get(seleccion.seller_id.strip())
    if grupo is None:
        raise HTTPException(
            status_code=400,
            detail="Ese pedido ya no está en el carrito",
        )

    transportista = transportista_para(db, seleccion.carrier_id, destino, grupo)
    [candidato] = [
        c for c in _candidatos(db, destino, grupo) if c.id == transportista.id
    ] or [None]
    if candidato is None:
        # No debería pasar: `transportista_para` ya dijo que sí. Si pasa, es
        # que las dos preguntas dejaron de ser la misma, y eso es un error
        # nuestro, no una selección inválida.
        raise HTTPException(
            status_code=500,
            detail="No se pudo describir el transportista elegido",
        )

    return SelectCarrierResponse(
        seller_id=grupo.vendedor.id,
        seller_name=grupo.vendedor.full_name,
        destination=_breve(destino),
        carrier=SelectedCarrier(
            **candidato.model_dump(),
            email=transportista.email,
            phone=transportista.phone,
            whatsapp=transportista.whatsapp,
        ),
    )


def _operacion(order: Order) -> CarrierOperation:
    # El origen sale del snapshot del ítem, no de la publicación: si se leyera
    # la localidad actual, el vendedor podría cambiarle el punto de retiro al
    # transportista después de la compra. Un ítem sin snapshot —anterior a esta
    # pieza— no aporta origen y no se reemplaza por el de hoy.
    origenes = {}
    for item in order.items:
        if not item.origin_locality_id:
            continue
        origenes[item.origin_locality_id] = LocalityBrief(
            id=item.origin_locality_id,
            name=item.origin_locality_name or '',
            province_name=item.origin_province_name or '',
        )
    destino = order.shipping_locality if order.shipping_locality_id else None
    return CarrierOperation(
        order_id=order.id,
        order_number=order.order_number,
        created_at=order.created_at,
        seller_name=order.seller.full_name,
        origins=list(origenes.values()),
        destination=_breve(destino) if destino else None,
        items=[
            CarrierOperationItem(
                product_name=item.product_name_snapshot,
                quantity=item.quantity,
            )
            for item in order.items
        ],
    )


@router.get("/my-operations", response_model=CarrierOperationsResponse)
def my_operations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Las operaciones asignadas a quien pregunta, y sólo ésas.

    No hay parámetro de transportista: el filtro es la sesión. Lo que se
    devuelve es necesidad logística —origen, destino, artículos y cantidades—.
    Ni contacto del comprador ni un solo número de plata.
    """
    ordenes = db.query(Order).filter(
        Order.carrier_id == current_user.id,
        Order.shipping_mode == MODO_TRANSPORTISTA,
    ).order_by(Order.created_at.desc()).all()
    return CarrierOperationsResponse(
        operations=[_operacion(order) for order in ordenes]
    )


@router.get("/my-operations/{order_id}", response_model=CarrierOperation)
def my_operation_detail(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Una operación asignada. Para cualquier otro, no existe."""
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.carrier_id == current_user.id,
        Order.shipping_mode == MODO_TRANSPORTISTA,
    ).first()
    if not order:
        # 404 y no 403: a quien no le corresponde tampoco le corresponde saber
        # que la operación existe.
        raise HTTPException(status_code=404, detail="Operación no encontrada")
    return _operacion(order)
