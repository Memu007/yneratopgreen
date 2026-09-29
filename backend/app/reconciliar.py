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

Se ejecuta con:

    python -m app.reconciliar

En producción es un servicio aparte de Railway, programado cada 10 minutos
desde el panel, con la misma imagen del Backend: `RAILWAY.md`, sección 5. No va
dentro de la API: acá se esperan filas con el bloqueo síncrono, que en el
proceso de la API frenaría todo.

Antes de barrer comprueba que puede: que estén las variables, y que la clave
de cifrado abra las credenciales guardadas. Si no, lo dice en una línea que
empieza con «RECONCILIACION NO CORRIO» y sale con 2 sin tocar nada.
"""
from __future__ import annotations

import asyncio
import json
import logging
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from pydantic import ValidationError
from sqlalchemy.orm import Session

# Sale con esto cuando no puede barrer: falta configuración o la clave no es la
# del Backend. No barrió nada.
NO_CORRIO = 2


def _no_corre(motivo: str) -> None:
    print(f"RECONCILIACION NO CORRIO: {motivo}", file=sys.stderr, flush=True)
    raise SystemExit(NO_CORRIO)


try:
    from app.core.config import settings
except ValidationError as error:
    # Corrido como servicio, lo que falta se dice en una línea que se lee en el
    # registro de Railway, sin una traza de cuarenta renglones. Importado
    # desde otro lado, el error sigue como siempre.
    if __name__ != "__main__":
        raise
    # Por nombre, nunca por valor: el valor puede ser un secreto, y la línea
    # queda en el registro de Railway.
    errores = error.errors()
    faltan = sorted({str(e["loc"][0]) for e in errores if e.get("type") == "missing" and e.get("loc")})
    no_sirven = sorted({str(e["loc"][0]) for e in errores if e.get("type") != "missing" and e.get("loc")})
    partes = []
    if faltan:
        partes.append(f"faltan variables: {', '.join(faltan)}")
    if no_sirven:
        partes.append(f"variables con un valor que no sirve: {', '.join(no_sirven)}")
    _no_corre(
        f"{'; '.join(partes)}. Van como referencia a las del Backend (RAILWAY.md, sección 5)."
        if partes else f"la configuración no es válida: {error.error_count()} error(es)"
    )

from app.core import cifrado
from app.db.base import SessionLocal
from app.models.order import Order, OrderStatus
from app.models.payment import Payment, PaymentStatus
from app.models.user import User
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


def por_que_no_puede_barrer(db: Session) -> Optional[str]:
    """Si falta algo para barrer sin hacer daño, qué. `None` si se puede.

    La clave de cifrado es la que importa. El barrido descifra el token de cada
    vendedor con órdenes pendientes, y cuando no abre lo marca para reconectar
    su cuenta de Mercado Pago: es lo correcto con **una** credencial ilegible.
    Con la clave equivocada, o sin clave, serían todas, y el servicio les
    pediría a todos los vendedores que reconecten por un error de
    configuración. Por eso se comprueba antes, sin escribir nada: si hay
    credenciales guardadas, la clave tiene que abrir alguna.
    """
    if not settings.MP_TOKEN_KEY:
        return ("falta MP_TOKEN_KEY. Va como referencia a la del Backend "
                "(RAILWAY.md, sección 5).")
    if not cifrado.hay_clave():
        return "MP_TOKEN_KEY no es una clave válida: tiene que ser la del Backend."
    guardadas = [
        fila[0] for fila in db.query(User.mp_access_token_cifrado)
        .filter(User.mp_access_token_cifrado.isnot(None)).all()
    ]
    for guardada in guardadas:
        try:
            cifrado.descifrar(guardada)
            return None
        except cifrado.NoSeDescifra:
            continue
    if guardadas:
        return (f"MP_TOKEN_KEY no abre ninguna de las {len(guardadas)} credenciales "
                "guardadas: no es la del Backend. No se barrió, para no marcar a "
                "los vendedores para reconectar.")
    return None


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    db = SessionLocal()
    try:
        motivo = por_que_no_puede_barrer(db)
        db.rollback()
        if motivo:
            _no_corre(motivo)
        resumen = asyncio.run(reconciliar(db))
    finally:
        db.close()
    # Una línea que se puede leer con los ojos y con un programa.
    print(f"RECONCILIACION {json.dumps(resumen, sort_keys=True)}")


if __name__ == "__main__":
    main()
