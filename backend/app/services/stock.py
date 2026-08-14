"""La reserva de stock de una compra que todavía no se cobró.

El problema que resuelve es viejo y concreto: entre que alguien confirma la
compra y que Mercado Pago acredita el pago pasan minutos, y en esos minutos la
última unidad puede venderse dos veces. Descontarla al confirmar sería regalar
mercadería a quien nunca paga; descontarla al acreditar sería vendérsela a dos
personas. Así que no se descuenta: se **reserva**.

Tres números, y cada uno dice una cosa distinta:

- `stock`: lo que hay. Sólo baja cuando el pago se acreditó.
- `stock_reservado`: lo comprometido por compras en curso.
- `stock - stock_reservado`: lo que se puede vender hoy. Es lo que mira todo
  el resto del sistema.

Y una regla que sostiene todo lo demás: **cada efecto ocurre exactamente una
vez**. No porque el código se llame una vez —un aviso de Mercado Pago llega
repetido, en paralelo y fuera de orden—, sino porque la orden lleva escrito en
qué anda su reserva y moverla es un `UPDATE ... WHERE` que la base serializa.
El que gana la fila aplica el efecto; el que la pierde no hace nada y lo dice.
"""
from __future__ import annotations

import logging
from typing import Iterable, List, Optional, Tuple

from fastapi import HTTPException
from sqlalchemy import func, update
from sqlalchemy.orm import Session

from app.models.order import Order
from app.models.product import Product

logger = logging.getLogger(__name__)

# En qué anda la reserva de una orden. Son cuatro palabras y no hay una quinta.
RESERVADA = "reservada"              # hay unidades comprometidas esperando el pago
CONSOLIDADA = "consolidada"          # el pago se acreditó: las unidades salieron
LIBERADA = "liberada"                # la compra murió: las unidades volvieron
# La orden terminó pero **todavía no se puede soltar la mercadería**: no
# pudimos confirmarle a Mercado Pago que el link quedó cerrado, así que
# liberar acá sería habilitar un cobro sin stock. Lo resuelve el reconciliador.
CIERRE_PENDIENTE = "cierre_pendiente"

SIN_STOCK = "«{nombre}» se quedó sin stock mientras confirmabas. Sacalo del carrito o bajá la cantidad."


def es_servicio(producto: Product) -> bool:
    """Un servicio no tiene unidades: no se reserva, no se descuenta."""
    return bool(producto.category.is_service) if producto.category else False


def disponible(producto: Product) -> int:
    """Lo que se puede vender hoy de esta publicación.

    Un servicio no tiene tope de unidades y no se cuenta acá: quien pregunta
    por disponibilidad de un servicio está haciendo la pregunta equivocada.
    """
    return max(0, (producto.stock or 0) - (producto.stock_reservado or 0))


def hay_para(producto: Product, cantidad: int) -> bool:
    """¿Alcanza para esta cantidad? Los servicios siempre alcanzan."""
    return True if es_servicio(producto) else disponible(producto) >= cantidad


def _unidades(items: Iterable) -> List[Tuple[Product, int]]:
    """Sólo lo que ocupa unidades: los servicios quedan afuera.

    Va ordenado por identificador de producto a propósito. Dos compras que
    tomen los mismos dos productos en orden distinto se bloquearían en cruz y
    la base tendría que matar una; tomándolos siempre en el mismo orden, la
    segunda espera y sigue.
    """
    unidades = [
        (item.product, int(item.quantity))
        for item in items
        if item.product is not None and not es_servicio(item.product)
    ]
    return sorted(unidades, key=lambda par: par[0].id)


def _mover_marca(db: Session, orden: Order, desde: Iterable[str], hacia: str) -> bool:
    """Cambia en qué anda la reserva, y sólo si venía de donde tiene que venir.

    Es una sola sentencia contra la base, así que dos avisos simultáneos sobre
    la misma orden compiten por la misma fila: uno la mueve y el otro encuentra
    cero. Leer primero y escribir después dejaría la ventana por la que el
    stock se descuenta dos veces.
    """
    movidas = db.execute(
        update(Order)
        .where(Order.id == orden.id, Order.stock_reserva.in_(list(desde)))
        .values(stock_reserva=hacia)
    ).rowcount
    if movidas:
        # El objeto en memoria quedó viejo; que lo relea de la base.
        db.expire(orden, ["stock_reserva"])
    return bool(movidas)


def reservar(db: Session, orden: Order, items: Iterable) -> None:
    """Compromete las unidades de una orden. En la transacción de quien llama.

    No hace commit: va adentro de la misma transacción que crea la orden, para
    que no exista un instante en el que la orden esté escrita y la mercadería
    todavía libre.

    Si dos compradores van por la última unidad, los dos llegan hasta acá
    creyendo que les alcanza —la validación previa leyó lo mismo—, y es este
    `UPDATE` condicional el que decide: la base bloquea la fila del producto,
    uno suma su reserva y el otro encuentra cero filas y se lleva un 409.
    """
    for producto, cantidad in _unidades(items):
        tomadas = db.execute(
            update(Product)
            .where(
                Product.id == producto.id,
                func.coalesce(Product.stock, 0) - Product.stock_reservado >= cantidad,
            )
            .values(stock_reservado=Product.stock_reservado + cantidad)
        ).rowcount
        if not tomadas:
            raise HTTPException(
                status_code=409, detail=SIN_STOCK.format(nombre=producto.name)
            )
        db.expire(producto, ["stock_reservado"])

    orden.stock_reserva = RESERVADA
    db.add(orden)


def consolidar(db: Session, orden: Order) -> bool:
    """El pago se acreditó: las unidades reservadas salen de verdad.

    Devuelve si esta llamada fue la que lo hizo. Un segundo aviso del mismo
    pago devuelve `False` y no toca un número.

    También consolida desde «cierre pendiente», y eso no es una concesión: esa
    marca dice que la orden terminó pero no pudimos apagar el link. Si el pago
    entró igual, las unidades se vendieron. Dejarlas colgadas ahí sería stock
    comprometido para siempre por una compra que ya se cobró.
    """
    if not _mover_marca(db, orden, (RESERVADA, CIERRE_PENDIENTE), CONSOLIDADA):
        return False

    for producto, cantidad in _unidades(orden.items):
        db.execute(
            update(Product)
            .where(Product.id == producto.id)
            .values(
                stock=func.greatest(func.coalesce(Product.stock, 0) - cantidad, 0),
                stock_reservado=func.greatest(Product.stock_reservado - cantidad, 0),
                sales_count=Product.sales_count + cantidad,
            )
        )
        db.expire(producto, ["stock", "stock_reservado", "sales_count"])
    return True


def liberar(db: Session, orden: Order) -> bool:
    """La compra murió sin cobrarse: las unidades vuelven a estar disponibles.

    Devuelve si esta llamada fue la que lo hizo. Se libera desde «reservada» y
    también desde «cierre pendiente», que es la reserva que quedó esperando
    que se pudiera cerrar el link. Una orden ya consolidada **no** se libera
    acá: eso sería devolver mercadería que ya se cobró, y esa decisión no es
    automática.
    """
    if not _mover_marca(db, orden, (RESERVADA, CIERRE_PENDIENTE), LIBERADA):
        return False

    for producto, cantidad in _unidades(orden.items):
        db.execute(
            update(Product)
            .where(Product.id == producto.id)
            .values(
                stock_reservado=func.greatest(Product.stock_reservado - cantidad, 0)
            )
        )
        db.expire(producto, ["stock_reservado"])
    return True


def marcar_cierre_pendiente(db: Session, orden: Order) -> bool:
    """La orden terminó pero la mercadería todavía no se puede soltar.

    Pasa cuando no se pudo confirmar con Mercado Pago que el link dejó de
    cobrar. Liberar en ese estado sería exactamente la carrera que hay que
    evitar: alguien paga un link vivo sobre stock que ya se le prometió a otro.
    """
    return _mover_marca(db, orden, (RESERVADA,), CIERRE_PENDIENTE)


def reservada(orden: Order) -> bool:
    return orden.stock_reserva in (RESERVADA, CIERRE_PENDIENTE)
