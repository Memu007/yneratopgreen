"""El checkout, una sola vez.

Antes había dos: uno por transferencia y otro por Mercado Pago, cada uno con su
copia de los totales, el stock, los snapshots y la logística. Dos copias de la
misma regla son dos reglas que se van a separar, y la que se olvide va a ser la
que toque plata.

Acá vive esa regla una vez. Los dos endpoints traducen a HTTP y nada más.

Lo que este módulo garantiza, y es todo lo mismo dicho de tres maneras:

- **El servidor deriva los grupos del carrito.** El cliente no dice cuántas
  órdenes son ni de quién: eso se lee del carrito, que es lo único que el
  comprador realmente eligió.
- **Se revalida todo junto antes de la primera fila.** Destino, traslado, medio
  de pago, datos bancarios, vínculo de Mercado Pago, precios, cantidades y
  totales. Si una sola cosa falla, no se crea ninguna orden y el carrito queda
  vivo para que la persona pueda corregir.
- **El dinero sale de lo que ya está persistido.** Los importes se congelan en
  la orden y en sus ítems; de ahí en adelante nadie vuelve a mirar el precio de
  la publicación.
"""
from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.montos import SIN_CARGO, importe_de_linea, validar_total
from app.models.cart import Cart, CartStatus
from app.models.order import Order, OrderItem, OrderStatus
from app.models.user import User
from app.services import mp_vinculo
from app.services.logistica import (
    MODO_PROPIO,
    origen_de,
    MODO_TRANSPORTISTA,
    GrupoDelCarrito,
    carrito_activo,
    grupos_del_carrito,
    resolver_decisiones,
    resolver_destino,
)

# Los dos medios que existen. No hay un tercero y no hay "ninguno": un grupo
# sin medio disponible no se puede comprar, y se dice antes de confirmar.
MEDIO_TRANSFERENCIA = "transfer"
MEDIO_MERCADO_PAGO = "mercadopago"

# Estado de preparación que ve el comprador por cada orden creada.
LISTA = "lista"                      # se puede pagar ya
PENDIENTE_DE_PAGO = "pendiente"      # falta preparar el pago; se puede reintentar


def generate_order_number() -> str:
    """Número de orden único. Vive acá porque acá es donde nacen las órdenes."""
    timestamp = datetime.now().strftime("%Y%m%d")
    aleatorio = secrets.token_hex(4).upper()
    return f"ORD-{timestamp}-{aleatorio}"


@dataclass
class PedidoPreparado:
    """Lo que se va a crear para un vendedor, ya validado y sin escribir nada."""

    seller_id: str
    seller: User
    items: list
    medio: str
    subtotal: Decimal
    transportista: Optional[User]


def medios_disponibles(seller: User) -> List[str]:
    """Con qué se le puede pagar a este vendedor, hoy.

    Transferencia necesita que haya dónde transferir. Mercado Pago necesita el
    interruptor encendido y un vínculo que sirva de verdad: si las credenciales
    del vendedor no abren, el medio no está disponible y se dice, no se ofrece
    y falla después.
    """
    disponibles = []
    if seller.cbu or seller.alias_bancario:
        disponibles.append(MEDIO_TRANSFERENCIA)
    if settings.MP_CHECKOUT_HABILITADO and mp_vinculo.estado_de(seller) == mp_vinculo.CONECTADO:
        disponibles.append(MEDIO_MERCADO_PAGO)
    return disponibles


def motivo_sin_medios(seller: User) -> str:
    """Por qué a este vendedor no se le puede pagar hoy.

    Lo lee el comprador, así que dice qué falta y no un código. Con el checkout
    de Mercado Pago apagado no se lo menciona: para el comprador ese medio no
    existe, y nombrarlo sería ofrecerle algo que nadie le puede dar.
    """
    if settings.MP_CHECKOUT_HABILITADO:
        return (
            f"{seller.full_name} no configuró CBU ni alias bancario "
            "ni tiene Mercado Pago vinculado."
        )
    return f"{seller.full_name} no configuró CBU ni alias bancario."


def _rechazar(detalle: str) -> None:
    raise HTTPException(status_code=400, detail=detalle)


def resolver_medios(
    grupos: Dict[str, GrupoDelCarrito],
    decisiones: Optional[List] = None,
    medio_unico: Optional[str] = None,
) -> Dict[str, str]:
    """Un medio de pago por grupo, exactamente uno, y que exista.

    `medio_unico` es para el endpoint que sólo hace transferencia: es el mismo
    camino, con la decisión puesta por el endpoint en vez de por el cliente.

    Se rechaza —antes de escribir nada— la decisión que falta, la repetida, la
    de un vendedor que no está en el carrito y la de un medio que ese vendedor
    no puede recibir. Ninguna cae en silencio al otro medio: que alguien pague
    por un camino que no eligió es exactamente lo que no puede pasar.
    """
    elegidos: Dict[str, str] = {}

    if medio_unico is not None:
        for seller_id, grupo in grupos.items():
            if medio_unico not in medios_disponibles(grupo.vendedor):
                _rechazar(
                    f"{grupo.vendedor.full_name} no puede recibir pagos por ese medio. "
                    "Sacá sus productos del carrito o elegí otro medio."
                )
            elegidos[seller_id] = medio_unico
        return elegidos

    vistos = set()
    for decision in decisiones or []:
        seller_id = getattr(decision, "seller_id", None)
        medio = getattr(decision, "method", None)

        if seller_id not in grupos:
            _rechazar("Hay una forma de pago para un vendedor que no está en el carrito.")
        if seller_id in vistos:
            _rechazar("Hay dos formas de pago para el mismo vendedor.")

        # Que el medio exista lo decide el esquema, en el borde: `method` es
        # un `Literal` y una forma inventada no llega hasta acá. Repetir la
        # comprobación sería una segunda lista de medios válidos, y dos listas
        # de lo mismo terminan diciendo cosas distintas.
        disponibles = medios_disponibles(grupos[seller_id].vendedor)
        if medio not in disponibles:
            _rechazar(
                f"{grupos[seller_id].vendedor.full_name} no puede recibir pagos por ese "
                "medio en este momento. Elegí otro."
            )

        vistos.add(seller_id)
        elegidos[seller_id] = medio

    faltan = [s for s in grupos if s not in elegidos]
    if faltan:
        _rechazar("Falta elegir cómo pagarle a cada vendedor del carrito.")

    return elegidos


def preparar(
    db: Session,
    user: User,
    datos,
    medio_unico: Optional[str] = None,
) -> tuple:
    """Valida el carrito entero y devuelve el plan. **No escribe nada.**

    Devuelve `(cart, destino, pedidos)`. Si algo no cierra, levanta 4xx y la
    base queda como estaba.
    """
    cart = carrito_activo(db, user)

    # El destino tiene que existir en el padrón oficial.
    destino = resolver_destino(db, datos.shipping_locality_id)

    # Los grupos los deriva el servidor del carrito, no el cliente.
    grupos = grupos_del_carrito(cart)

    # Traslado y medio de pago, los dos, antes de la primera fila.
    transportistas = resolver_decisiones(db, destino, grupos, datos.shipping_decisions)
    medios = resolver_medios(
        grupos,
        getattr(datos, "payment_decisions", None),
        medio_unico=medio_unico,
    )

    pedidos: List[PedidoPreparado] = []
    for seller_id, grupo in grupos.items():
        for item in grupo.items:
            validar_total(
                importe_de_linea(item.product.price, item.quantity),
                f"El importe de «{item.product.name}»",
            )
        subtotal = sum(
            (importe_de_linea(i.product.price, i.quantity) for i in grupo.items),
            Decimal(0),
        )
        validar_total(subtotal, "El total de la orden")

        # El stock se mira acá, con todos los grupos a la vista, para que un
        # faltante del último no deje creadas las órdenes de los primeros.
        for item in grupo.items:
            producto = item.product
            es_servicio = producto.category.is_service if producto.category else False
            if not es_servicio and (producto.stock or 0) < item.quantity:
                _rechazar(f"Stock insuficiente para {producto.name}")

        pedidos.append(PedidoPreparado(
            seller_id=seller_id,
            seller=grupo.vendedor,
            items=grupo.items,
            medio=medios[seller_id],
            subtotal=subtotal,
            transportista=transportistas[seller_id],
        ))

    return cart, destino, pedidos


def crear_ordenes(
    db: Session,
    user: User,
    cart: Cart,
    destino,
    pedidos: List[PedidoPreparado],
    datos,
) -> List[Order]:
    """Escribe una orden por vendedor. Todas o ninguna: un solo commit.

    Acá ya no se valida nada: lo que llega viene de `preparar`, y volver a
    decidir en el momento de escribir sería tener la regla en dos lugares otra
    vez.
    """
    creadas: List[Order] = []

    for pedido in pedidos:
        transferencia = pedido.medio == MEDIO_TRANSFERENCIA
        orden = Order(
            order_number=generate_order_number(),
            buyer_id=user.id,
            seller_id=pedido.seller_id,
            # Por transferencia la orden nace esperando el comprobante. Por
            # Mercado Pago nace colocada: todavía no hay pago, y no lo va a
            # haber hasta que exista el webhook que lo confirme.
            status=(
                OrderStatus.AWAITING_TRANSFER_RECEIPT if transferencia
                else OrderStatus.PLACED
            ),
            payment_method=pedido.medio,
            subtotal=pedido.subtotal,
            shipping_cost=SIN_CARGO,
            total_amount=pedido.subtotal,
            # El snapshot bancario es del momento de comprar: si el vendedor
            # cambia su CBU mañana, esta orden sigue diciendo a dónde se
            # transfirió.
            transfer_cbu=pedido.seller.cbu if transferencia else None,
            transfer_alias_bancario=pedido.seller.alias_bancario if transferencia else None,
            transfer_account_holder=pedido.seller.full_name if transferencia else None,
            shipping_address_json={
                "address": datos.shipping_address,
                "city": destino.name,
                "province": destino.province_name,
                "postal_code": datos.shipping_postal_code,
                "locality_id": destino.id,
            },
            shipping_locality_id=destino.id,
            shipping_mode=MODO_TRANSPORTISTA if pedido.transportista else MODO_PROPIO,
            carrier_id=pedido.transportista.id if pedido.transportista else None,
            buyer_notes=datos.notes,
        )
        db.add(orden)
        db.flush()

        for item in pedido.items:
            producto = item.product
            imagen = next(
                (i.url for i in producto.images if i.is_primary), None
            )
            db.add(OrderItem(
                order_id=orden.id,
                product_id=producto.id,
                product_name_snapshot=producto.name,
                product_image_snapshot=imagen,
                unit_price_snapshot=producto.price,
                quantity=item.quantity,
                total_price=importe_de_linea(producto.price, item.quantity),
                **origen_de(producto),
            ))

        creadas.append(orden)

    cart.status = CartStatus.CONVERTED
    db.commit()

    for orden in creadas:
        db.refresh(orden)

    return creadas
