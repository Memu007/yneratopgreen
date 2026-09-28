"""Reconciliación de las compras por Mercado Pago que quedaron a medias.

Un webhook se pierde. La URL no estaba configurada, el servidor estaba caído,
Mercado Pago reintentó cinco veces contra el vacío y se rindió. Si eso fuera el
final, quedarían compras cobradas que la plataforma no sabe que se cobraron, y
reservas de stock esperando para siempre un pago que nadie va a informar.

Esto es el barrido que cierra esas dos puntas. Y tiene una sola regla, que es
la que lo separa de un `cron` que borra lo viejo:

    **El reloj no libera nada. Libera Mercado Pago.**

Una reserva vencida no se suelta porque venció: se le pregunta primero a
Mercado Pago, con el token del vendedor que cobra. Si hay un pago aprobado, se
procesa —esa venta existe, aunque el aviso se haya perdido—. Si no lo hay y hay
uno en proceso, no se toca nada: un pago empezado todavía puede acreditarse. Y
recién si no hay ninguno **y** el link ya está cerrado, la mercadería vuelve.

Es idempotente por construcción: lo que mueve el stock es el `UPDATE`
condicional de la reserva, así que correrlo dos veces, o dos veces a la vez,
deja el mismo resultado que correrlo una.

Se ejecuta a mano:

    python -m app.reconciliar

Todavía **no** está programado en ningún lado. Programarlo es parte de la
puesta en producción, y la puesta en producción no está abierta.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List

from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.base import SessionLocal
from app.models.order import Order, OrderStatus
from app.models.payment import Payment, PaymentStatus
from app.services import candado, cobro, mp_pagos, stock
from app.services.checkout import MEDIO_MERCADO_PAGO

logger = logging.getLogger(__name__)

# Qué le pasó a cada orden revisada.
COBRADA = "cobrada"            # había un pago aprobado que no nos habían avisado
EN_CURSO = "en_curso"          # hay un intento vivo: no se toca
VENCIDA = "vencida"            # nadie pagó y el link está cerrado: se cerró y liberó
LIBERADA = "liberada"          # la orden ya estaba terminada; sólo faltaba soltar el stock
DIFERIDA = "diferida"          # no se pudo cerrar el link; queda para la próxima
SIN_RESPUESTA = "sin_respuesta"  # Mercado Pago no contestó
OCUPADA = "ocupada"            # la API tenía la orden y no la soltó a tiempo; queda para la próxima


def _candidatas(db: Session) -> List[Order]:
    """Las órdenes que hay que mirar, y sólo esas.

    Dos grupos: las que tienen una reserva viva cuyo link ya venció con su
    margen, y las que quedaron en «cierre pendiente» —terminaron, pero no
    pudimos confirmar que el link se apagó, así que su mercadería sigue sin
    poder soltarse—.
    """
    limite = datetime.utcnow() - timedelta(minutes=settings.MP_MINUTOS_DE_GRACIA)
    # El `JOIN` es por fuera: una reserva **sin** fila de pago tiene que
    # aparecer acá, no desaparecer. Hoy el checkout escribe la intención en la
    # misma transacción que la reserva, así que no debería existir ninguna; el
    # `outerjoin` está para que, si existe igual —una fila vieja, una escritura
    # a medias—, la mercadería se recupere en vez de quedar comprometida para
    # siempre por una compra que nunca llegó a tener link.
    sin_pago = Payment.id.is_(None)
    reserva_viva = Order.stock_reserva.in_([stock.RESERVADA, stock.CIERRE_PENDIENTE])
    vencida = (
        (Order.stock_reserva == stock.CIERRE_PENDIENTE)
        | (Payment.expires_at <= limite)
        | (sin_pago & (Order.created_at <= limite))
    )
    # Y un tercer grupo, que no tiene nada que ver con vencimientos: órdenes ya
    # cobradas cuyo link no se pudo apagar. La reserva de esas ya está
    # consolidada, así que por reserva no entrarían nunca, y sin embargo son
    # las más urgentes: una preferencia viva sobre una orden cobrada se puede
    # volver a pagar.
    link_abierto = Payment.link_cerrado.is_(False) & Payment.status.in_(
        [PaymentStatus.APPROVED, PaymentStatus.EN_REVISION]
    )
    return (
        db.query(Order)
        .outerjoin(Payment, Payment.order_id == Order.id)
        .filter(
            Order.payment_method == MEDIO_MERCADO_PAGO,
            (reserva_viva & vencida) | link_abierto,
        )
        .all()
    )


async def _una(db: Session, orden: Order) -> str:
    """Reconcilia una orden. Devuelve qué le pasó.

    Todo lo que decide pasa **bajo un solo candado y en una sola transacción**,
    y eso no es prolijidad: preguntar y decidir tienen que ser el mismo acto.
    Si entre «Mercado Pago dice que no hay pago» y «entonces libero» la fila
    queda suelta, un webhook que apruebe en esa rendija deja la peor
    combinación que este módulo puede producir —plata cobrada y mercadería
    devuelta— y encima con la orden diciendo que se venció.

    Por eso `sincronizar` se llama sin confirmar: hace la consulta sin candado,
    lo toma para aplicar y lo **devuelve puesto**. Lo que sigue son decisiones
    con la fila en la mano.
    """
    try:
        # Primero preguntar. Siempre primero preguntar.
        await cobro.sincronizar(db, orden, confirmar=False)
    except mp_pagos.NoSeConsulta as fallo:
        db.rollback()
        logger.warning(
            "No se pudo consultar %s: %s", orden.order_number, fallo.motivo
        )
        return SIN_RESPUESTA
    except candado.FilaOcupada:
        # Una confirmación o una cancelación de la API la tenía tomada y no la
        # soltó antes del tope. No se decidió nada; el próximo barrido vuelve.
        db.rollback()
        logger.warning("La orden %s estaba tomada: queda para el próximo barrido", orden.order_number)
        return OCUPADA

    # Lo que `sincronizar` decidió, escrito antes de volver a leer.
    #
    # La sesión de esta aplicación tiene `autoflush=False`, así que lo que quedó
    # en memoria —que la orden pasó a pagada, por ejemplo— no llega solo a la
    # base cuando se vuelve a consultar. Sin este `flush`, el `refresh` de abajo
    # relee la fila vieja y **descarta** ese cambio: el barrido informaba
    # «cobrada» y la orden se quedaba en `placed`, que es justo el estado falso
    # que este módulo existe para no dejar.
    db.flush()

    # El candado, otra vez y explícito: `sincronizar` pudo no haber llegado a
    # tomarlo —una orden sin intención sale antes—, y de acá para abajo se
    # escribe. El webhook toma este mismo candado antes de tocar nada, así que
    # si llega uno mientras decidimos, espera; y cuando entre, va a ver lo que
    # dejamos, no lo que había cuando preguntamos.
    db.query(Order).filter(Order.id == orden.id).with_for_update().first()
    db.refresh(orden)

    if cobro.hay_cobro(db, orden):
        # Cobrada. Lo único que puede faltar es apagar el link, y eso ya lo
        # intentó `sincronizar` en este mismo barrido: con cobro, apaga antes
        # de aplicar. Si falló, el reintento queda para el próximo barrido —la
        # orden vuelve a entrar mientras el link siga abierto— y no se hace acá.
        #
        # Acá se reintentaba, y era esperar a Mercado Pago con la fila de la
        # publicación tomada: aplicar ya había consolidado el stock. Si Mercado
        # Pago tardaba, cualquier compra de esa publicación que se confirmara
        # en la API esperaba esa fila frenando el proceso, hasta 15 s.
        db.commit()
        return COBRADA
    if cobro.hay_intento_en_curso(db, orden):
        # Empezó a pagar. El vencimiento del link no le quita ese pago.
        db.commit()
        return EN_CURSO

    resultado = await cobro.cerrar_cobro(db, orden)
    if resultado == "cobrada":
        db.commit()
        return COBRADA
    if resultado == "diferido":
        db.commit()
        return DIFERIDA

    # Nadie pagó y el link quedó cerrado: la mercadería vuelve. Si la orden
    # todavía estaba viva se cierra con el motivo escrito, para que el
    # comprador entienda qué pasó; si ya estaba cancelada, lo único que
    # faltaba era poder soltar el stock sin riesgo, y eso es lo que pasó.
    if orden.status == OrderStatus.PLACED:
        orden.status = OrderStatus.CANCELLED
        orden.cancellation_reason = cobro.MOTIVO_VENCIDA
        orden.updated_at = datetime.utcnow()
        db.add(orden)
        db.commit()
        return VENCIDA
    db.commit()
    return LIBERADA


async def reconciliar(db: Session) -> Dict[str, int]:
    """Pasa por todas las candidatas. Una falla no frena a las demás."""
    resumen: Dict[str, int] = {}
    for orden in _candidatas(db):
        try:
            resultado = await _una(db, orden)
        except Exception as error:  # noqa: BLE001
            db.rollback()
            logger.exception(
                "Falló la reconciliación de %s: %s", orden.order_number, type(error).__name__
            )
            resultado = "error"
        resumen[resultado] = resumen.get(resultado, 0) + 1
    return resumen


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    db = SessionLocal()
    try:
        resumen = asyncio.run(reconciliar(db))
    finally:
        db.close()
    # Una línea que se puede leer con los ojos y con un programa.
    print(f"RECONCILIACION {json.dumps(resumen, sort_keys=True)}")


if __name__ == "__main__":
    main()
