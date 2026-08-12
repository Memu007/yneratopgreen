"""Reglas de logística compartidas por el listado, la selección y los checkouts.

Un solo lugar decide dos cosas:

1. **Cómo se agrupa el carrito**: una futura orden por vendedor, siempre
   derivada del carrito del servidor. El cliente no dicta vendedores.
2. **Qué transportista es compatible con un grupo**: su base declarada tiene
   que caer dentro de su propio radio respecto del destino Y de cada localidad
   de origen del grupo. Alcanza fallar en un origen para quedar afuera.

La compatibilidad se pregunta dos veces —al elegir y otra vez al confirmar la
compra— y las dos preguntas tienen que ser la misma. Por eso el filtro vive en
una sola constante y no en dos consultas parecidas.
"""
from typing import Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.cart import Cart, CartStatus
from app.models.locality import Locality
from app.models.user import User

# Modos de traslado que una orden puede declarar. NULL en la base significa
# "no definido" y es sólo para las órdenes anteriores a esta pieza.
MODO_TRANSPORTISTA = "carrier"
MODO_PROPIO = "self"
MODOS_VALIDOS = (MODO_TRANSPORTISTA, MODO_PROPIO)


# Un transportista sólo es elegible si su perfil está completo. La declaración
# de habilitación es parte del contrato: sin detalle y sin fecha, el perfil
# está incompleto y no participa, aunque el resto esté cargado.
PERFIL_ELEGIBLE = """
    u.is_carrier
    AND u.is_active
    AND u.is_verified
    AND u.carrier_transport_certified
    AND btrim(COALESCE(u.carrier_transport, '')) <> ''
    AND btrim(COALESCE(u.carrier_certification_detail, '')) <> ''
    AND u.carrier_certification_declared_at IS NOT NULL
    AND COALESCE(u.carrier_coverage_radius_km, 0) > 0
"""

# Las dos puntas del viaje, con la misma medida y el mismo radio.
CUBRE_EL_VIAJE = """
    ST_DWithin(
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
"""

CANDIDATOS_COMPATIBLES = text(f"""
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
    WHERE {PERFIL_ELEGIBLE}
      AND {CUBRE_EL_VIAJE}
    ORDER BY u.full_name, u.id
""")

# La misma pregunta, para un transportista concreto. No se responde filtrando
# en Python el listado anterior: eso duplicaría la regla en otro lenguaje.
ES_COMPATIBLE = text(f"""
    SELECT 1
    FROM users u
    JOIN localities b ON b.id = u.carrier_base_locality_id
    JOIN localities d ON d.id = :destino
    WHERE u.id = :transportista
      AND {PERFIL_ELEGIBLE}
      AND {CUBRE_EL_VIAJE}
    LIMIT 1
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


class GrupoDelCarrito:
    """Una futura orden: un vendedor, sus ítems y sus localidades de origen."""

    def __init__(self, vendedor: User):
        self.vendedor = vendedor
        self.items: List = []
        self.origenes: Dict[str, Locality] = {}
        # Un producto sin localidad oficial deja al grupo sin origen medible.
        # No se adivina desde el texto libre del perfil del vendedor.
        self.sin_origen = False

    @property
    def ids_de_origen(self) -> List[str]:
        return list(self.origenes.keys())

    @property
    def medible(self) -> bool:
        return not self.sin_origen and bool(self.origenes)


def carrito_activo(db: Session, usuario: User) -> Cart:
    cart = db.query(Cart).filter(
        Cart.user_id == usuario.id,
        Cart.status == CartStatus.ACTIVE,
    ).first()
    if not cart or not cart.items:
        raise HTTPException(status_code=400, detail="El carrito está vacío")
    return cart


def grupos_del_carrito(cart: Cart) -> Dict[str, GrupoDelCarrito]:
    """Los grupos reales del carrito, en el orden en que aparecen."""
    grupos: Dict[str, GrupoDelCarrito] = {}
    for item in cart.items:
        producto = item.product
        grupo = grupos.get(producto.seller_id)
        if grupo is None:
            grupo = GrupoDelCarrito(producto.seller)
            grupos[producto.seller_id] = grupo
        grupo.items.append(item)
        if producto.locality_id:
            grupo.origenes[producto.locality_id] = producto.locality
        else:
            grupo.sin_origen = True
    return grupos


def resolver_destino(db: Session, locality_id: Optional[str]) -> Locality:
    """El destino tiene que ser una localidad del padrón oficial.

    De ahí salen la ciudad y la provincia que se muestran —no del texto que
    manda el cliente— y sobre ella se calcula qué transportistas cubren el
    viaje. Se valida antes de escribir una sola fila.
    """
    destino = db.query(Locality).filter(
        Locality.id == (locality_id or "").strip()
    ).first()
    if not destino:
        raise HTTPException(
            status_code=400,
            detail="La localidad de destino no pertenece al padrón oficial",
        )
    return destino


def transportista_para(
    db: Session,
    transportista_id: str,
    destino: Locality,
    grupo: GrupoDelCarrito,
) -> User:
    """El transportista elegido, si de verdad cubre este grupo.

    Lo que manda el cliente es un id y nada más: el grupo, los orígenes y el
    destino los pone el servidor. Un id de otro grupo, de un perfil incompleto
    o de alguien que no llega no pasa de acá.
    """
    if not grupo.medible:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Las publicaciones de {grupo.vendedor.full_name} no tienen "
                "origen oficial: no se puede asignar un transportista"
            ),
        )

    compatible = db.execute(ES_COMPATIBLE, {
        "transportista": (transportista_id or "").strip(),
        "destino": destino.id,
        "origenes": grupo.ids_de_origen,
    }).first()

    if not compatible:
        raise HTTPException(
            status_code=400,
            detail=(
                f"El transportista elegido para {grupo.vendedor.full_name} ya no "
                "cubre este viaje. Elegí otro o coordiná el traslado por tu cuenta."
            ),
        )

    return db.query(User).filter(User.id == transportista_id).first()


def resolver_decisiones(
    db: Session,
    destino: Locality,
    grupos: Dict[str, GrupoDelCarrito],
    decisiones,
) -> Dict[str, Optional[User]]:
    """Exactamente una decisión por grupo real, revalidada contra el servidor.

    Devuelve, por vendedor, el transportista elegido o `None` si el comprador
    coordina por su cuenta. Todo se comprueba ANTES de que exista una sola
    fila: una decisión inválida no puede dejar órdenes a medias.
    """
    por_vendedor = {}
    for decision in decisiones or []:
        vendedor_id = (decision.seller_id or "").strip()
        if vendedor_id in por_vendedor:
            raise HTTPException(
                status_code=400,
                detail="Hay dos decisiones de traslado para el mismo vendedor",
            )
        if vendedor_id not in grupos:
            # Un vendedor que no está en el carrito: o el cliente lo inventó,
            # o el carrito cambió y la pantalla quedó vieja.
            raise HTTPException(
                status_code=400,
                detail=(
                    "Hay una decisión de traslado para un vendedor que no está "
                    "en el carrito"
                ),
            )
        por_vendedor[vendedor_id] = decision

    elegidos: Dict[str, Optional[User]] = {}
    for vendedor_id, grupo in grupos.items():
        decision = por_vendedor.get(vendedor_id)
        if decision is None:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Falta decidir cómo se traslada el pedido de "
                    f"{grupo.vendedor.full_name}"
                ),
            )

        if decision.mode == MODO_PROPIO:
            if decision.carrier_id:
                # Coordinar por cuenta propia y a la vez asignar a alguien no
                # es una decisión: son dos.
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Un pedido que se traslada por cuenta propia no puede "
                        "llevar transportista"
                    ),
                )
            elegidos[vendedor_id] = None
            continue

        if not decision.carrier_id:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Falta elegir el transportista del pedido de "
                    f"{grupo.vendedor.full_name}"
                ),
            )
        elegidos[vendedor_id] = transportista_para(
            db, decision.carrier_id, destino, grupo
        )

    return elegidos
