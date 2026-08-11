"""Listado de transportistas compatibles con el carrito activo.

Es un DIRECTORIO, no una recomendación: muestra quiénes cubren geográficamente
el viaje y no ordena por "mejor", no puntúa y no elige. Tampoco entrega datos
de contacto: el contacto se revela recién al seleccionar, y esa pieza no está
implementada.

Regla de compatibilidad, por futura orden —una por vendedor—: la base declarada
del transportista tiene que estar dentro de su propio radio respecto del
destino Y de CADA localidad de origen distinta de los productos de ese
vendedor. Alcanza con fallar en un solo origen para quedar afuera.

El filtro corre en PostGIS con `ST_DWithin` sobre `localities.coordinates`. No
se traen todos los transportistas para descartarlos en Python: eso no escala y
además tienta a calcular distancias a mano.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.base import get_db
from app.models.cart import Cart, CartStatus
from app.models.locality import Locality
from app.models.user import User
from app.schemas.logistics import (
    CarrierCandidate,
    CarrierGroup,
    CompatibleCarriersResponse,
    DistanceToOrigin,
    LocalityBrief,
)

router = APIRouter(prefix="/logistics", tags=["logistics"])


# Un transportista sólo entra si su perfil está completo. La declaración de
# habilitación es parte del contrato: sin detalle y sin fecha, el perfil está
# incompleto y no se lista, aunque el resto esté cargado.
CANDIDATOS_COMPATIBLES = text("""
    SELECT
        u.id,
        u.full_name,
        b.id   AS base_locality_id,
        b.name AS base_locality_name,
        b.province_name AS base_province_name,
        u.carrier_transport,
        u.carrier_certification_detail,
        u.carrier_certification_declared_at,
        u.carrier_coverage_radius_km,
        u.carrier_capacity,
        ST_Distance(b.coordinates, d.coordinates) / 1000.0 AS km_destino
    FROM users u
    JOIN localities b ON b.id = u.carrier_base_locality_id
    JOIN localities d ON d.id = :destino
    WHERE u.is_carrier
      AND u.is_active
      AND u.is_verified
      AND u.carrier_transport_certified
      AND btrim(COALESCE(u.carrier_transport, '')) <> ''
      AND btrim(COALESCE(u.carrier_certification_detail, '')) <> ''
      AND u.carrier_certification_declared_at IS NOT NULL
      AND COALESCE(u.carrier_coverage_radius_km, 0) > 0
      AND ST_DWithin(
            b.coordinates,
            d.coordinates,
            u.carrier_coverage_radius_km::float * 1000.0
          )
      AND NOT EXISTS (
            SELECT 1
            FROM localities o
            WHERE o.id = ANY(:origenes)
              AND NOT ST_DWithin(
                    b.coordinates,
                    o.coordinates,
                    u.carrier_coverage_radius_km::float * 1000.0
                  )
          )
    ORDER BY u.full_name, u.id
""")

# Todas las distancias base→origen del grupo en una sola consulta: una por
# transportista sería un N+1 gratuito.
DISTANCIAS_A_ORIGENES = text("""
    SELECT
        b.id AS base_id,
        o.id AS origen_id,
        o.name,
        o.province_name,
        ST_Distance(b.coordinates, o.coordinates) / 1000.0 AS km
    FROM localities b, localities o
    WHERE b.id = ANY(:bases)
      AND o.id = ANY(:origenes)
    ORDER BY o.name
""")


def _breve(locality: Locality) -> LocalityBrief:
    return LocalityBrief(
        id=locality.id,
        name=locality.name,
        province_name=locality.province_name,
    )


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
    destino = db.query(Locality).filter(
        Locality.id == (destination_locality_id or "").strip()
    ).first()
    if not destino:
        raise HTTPException(
            status_code=400,
            detail="La localidad de destino no pertenece al padrón oficial",
        )

    cart = db.query(Cart).filter(
        Cart.user_id == current_user.id,
        Cart.status == CartStatus.ACTIVE,
    ).first()
    if not cart or not cart.items:
        raise HTTPException(status_code=400, detail="El carrito está vacío")

    # Una futura orden por vendedor, igual que el checkout.
    grupos = {}
    for item in cart.items:
        producto = item.product
        grupo = grupos.setdefault(
            producto.seller_id,
            {"vendedor": producto.seller, "origenes": {}, "sin_origen": False},
        )
        if producto.locality_id:
            grupo["origenes"][producto.locality_id] = producto.locality
        else:
            # Sin localidad oficial no hay origen que medir. No se adivina
            # desde el texto libre del perfil del vendedor: ese dato es de
            # otra naturaleza y puede estar mal escrito o vacío.
            grupo["sin_origen"] = True

    salida: List[CarrierGroup] = []
    for grupo in grupos.values():
        origenes = list(grupo["origenes"].values())

        if grupo["sin_origen"] or not origenes:
            salida.append(CarrierGroup(
                seller_id=grupo["vendedor"].id,
                seller_name=grupo["vendedor"].full_name,
                origins=[_breve(o) for o in origenes],
                origin_missing=True,
                carriers=[],
            ))
            continue

        ids_origen = [o.id for o in origenes]
        filas = db.execute(
            CANDIDATOS_COMPATIBLES,
            {"destino": destino.id, "origenes": ids_origen},
        ).mappings().all()

        por_base = {}
        if filas:
            bases = sorted({fila["base_locality_id"] for fila in filas})
            for d in db.execute(
                DISTANCIAS_A_ORIGENES,
                {"bases": bases, "origenes": ids_origen},
            ).mappings().all():
                por_base.setdefault(d["base_id"], []).append(d)

        candidatos = []
        for fila in filas:
            distancias = por_base.get(fila["base_locality_id"], [])
            candidatos.append(CarrierCandidate(
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
                    for d in distancias
                ],
            ))

        salida.append(CarrierGroup(
            seller_id=grupo["vendedor"].id,
            seller_name=grupo["vendedor"].full_name,
            origins=[_breve(o) for o in origenes],
            origin_missing=False,
            carriers=candidatos,
        ))

    return CompatibleCarriersResponse(
        destination=_breve(destino),
        groups=salida,
    )
