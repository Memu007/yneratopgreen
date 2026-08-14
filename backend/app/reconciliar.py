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
from app.models.payment import Payment
from app.services import cobro, mp_pagos, stock
from app.services.checkout import MEDIO_MERCADO_PAGO

logger = logging.getLogger(__name__)

# Qué le pasó a cada orden revisada.
COBRADA = "cobrada"            # había un pago aprobado que no nos habían avisado
EN_CURSO = "en_curso"          # hay un intento vivo: no se toca
VENCIDA = "vencida"            # nadie pagó y el link está cerrado: se cerró y liberó
LIBERADA = "liberada"          # la orden ya estaba terminada; sólo faltaba soltar el stock
DIFERIDA = "diferida"          # no se pudo cerrar el link; queda para la próxima
SIN_RESPUESTA = "sin_respuesta"  # Mercado Pago no contestó


def _candidatas(db: Session) -> List[Order]:
    """Las órdenes que hay que mirar, y sólo esas.

    Dos grupos: las que tienen una reserva viva cuyo link ya venció con su
    margen, y las que quedaron en «cierre pendiente» —terminaron, pero no
    pudimos confirmar que el link se apagó, así que su mercadería sigue sin
    poder soltarse—.
    """
    limite = datetime.utcnow() - timedelta(minutes=settings.MP_MINUTOS_DE_GRACIA)
    return (
        db.query(Order)
        .join(Payment, Payment.order_id == Order.id)
        .filter(
            Order.payment_method == MEDIO_MERCADO_PAGO,
            Order.stock_reserva.in_([stock.RESERVADA, stock.CIERRE_PENDIENTE]),
            (
                (Order.stock_reserva == stock.CIERRE_PENDIENTE)
                | (Payment.expires_at <= limite)
            ),
        )
        .all()
    )


async def _una(db: Session, orden: Order) -> str:
    """Reconcilia una orden. Devuelve qué le pasó."""
    # La fila, bloqueada: esto compite con el webhook y con una cancelación.
    db.query(Order).filter(Order.id == orden.id).with_for_update().first()

    try:
        # Primero preguntar. Siempre primero preguntar.
        await cobro.sincronizar(db, orden)
    except mp_pagos.NoSeConsulta as fallo:
        db.rollback()
        logger.warning(
            "No se pudo consultar %s: %s", orden.order_number, fallo.motivo
        )
        return SIN_RESPUESTA

    db.refresh(orden)
    if cobro.hay_cobro(db, orden):
        return COBRADA
    if cobro.hay_intento_en_curso(db, orden):
        # Empezó a pagar. El vencimiento del link no le quita ese pago.
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
