"""La preferencia de Checkout Pro de una orden.

Una orden, una preferencia, un pago. Nada de esto mueve dinero todavía: crear
una preferencia es pedirle a Mercado Pago un link de pago a nombre del
vendedor. Quién cobra es él, en su cuenta, con su token.

Tres cosas que no se negocian acá:

1. **El importe sale de la orden ya escrita.** No del carrito, no de la
   publicación, no de una cuenta hecha en el momento. Si el vendedor cambia el
   precio después de confirmar, la orden y el pago siguen diciendo lo mismo.
2. **`marketplace_fee` no se manda.** Ni en cero: lo que no se manda no se
   discute. TopGreen no cobra comisión por venta y no recibe ese dinero.
3. **Reintentar no duplica.** La orden tiene una sola intención de pago, y la
   clave de idempotencia se deriva de la orden, así que un doble clic o un
   timeout con la respuesta perdida terminan en la misma preferencia.

Se guarda lo mínimo: identificadores, la URL para pagar, el importe exacto y
nuestro propio estado. El cuerpo completo de la respuesta de Mercado Pago no
se guarda: lo que no se guarda no se filtra.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional

import httpx
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.order import Order
from app.models.payment import Payment, PaymentStatus
from app.models.user import User
from app.services import mp_pagos, mp_vinculo

logger = logging.getLogger(__name__)

SEGUNDOS_DE_ESPERA = 15.0
MONEDA = "ARS"

# Motivos, del mismo estilo que el vínculo: códigos nuestros, nunca el texto
# de Mercado Pago.
SIN_VINCULO = "sin_vinculo"
MP_RECHAZO = "mp_rechazo"
MP_SIN_RESPUESTA = "mp_sin_respuesta"
RESPUESTA_INVALIDA = "respuesta_invalida"
DESHABILITADO = "deshabilitado"


class NoSePudoPreparar(Exception):
    """No se pudo dejar lista la preferencia. Trae un motivo, no un cuerpo."""

    def __init__(self, motivo: str):
        super().__init__(motivo)
        self.motivo = motivo


def _numero_json(monto: Decimal) -> float:
    """Convierte el importe para meterlo en el JSON que viaja a Mercado Pago.

    Es el borde de serialización, no una cuenta: acá no se suma ni se
    multiplica nada. Aun así se comprueba que el viaje de ida y vuelta sea
    exacto, porque mandar un importe distinto del que dice la orden sería
    exactamente el error que el contrato monetario existe para evitar.
    """
    numero = float(monto)
    if Decimal(str(numero)) != Decimal(monto):
        raise NoSePudoPreparar(RESPUESTA_INVALIDA)
    return numero


def referencia_de(orden: Order) -> str:
    """La referencia que va a viajar y volver. Inequívoca y sin datos de nadie."""
    return f"topgreen-{orden.order_number}"


def clave_de_idempotencia(orden: Order) -> str:
    """Estable por orden: dos intentos de la misma orden son el mismo pedido."""
    return f"topgreen-orden-{orden.id}"


def vencimiento_de(desde: Optional[datetime] = None) -> datetime:
    """Hasta cuándo vale el link que se está por pedir.

    Es un solo instante para dos cosas —la vigencia oficial de la preferencia y
    la reserva de stock de la orden—, y eso no es casualidad: si el link
    viviera más que la reserva, se podría cobrar mercadería ya entregada a otro.
    """
    return (desde or datetime.utcnow()) + timedelta(
        minutes=settings.MP_MINUTOS_DE_VIGENCIA
    )


# El parámetro oficial que pide Webhooks y no IPN. Lo agrega el código, nunca
# el entorno: la base configurada tiene que venir sin query —una arbitraria
# podría pisar esto o degradar el aviso— y el único parámetro que viaja es
# este, que es el que la documentación de Mercado Pago manda poner para
# recibir exclusivamente notificaciones Webhook, que son las firmadas.
PARAMETRO_DE_WEBHOOKS = "source_news=webhooks"


def url_de_aviso() -> str:
    """La URL de aviso tal como viaja en la preferencia.

    La base sale de la configuración y no puede traer parámetros; el único que
    se agrega es el oficial. Si en algún momento la base llegara con query
    —no debería: el validador lo rechaza al arrancar— se respeta el `&` para
    no romper la URL en vez de fabricar una segunda `?`.
    """
    base = settings.MP_NOTIFICACION_URL
    separador = "&" if "?" in base else "?"
    return f"{base}{separador}{PARAMETRO_DE_WEBHOOKS}"


def _cuerpo_de_la_preferencia(orden: Order, hasta: datetime) -> dict:
    """Arma el pedido a partir de lo que ya está guardado en la orden."""
    items = [
        {
            "title": item.product_name_snapshot,
            "quantity": int(item.quantity),
            "unit_price": _numero_json(item.unit_price_snapshot),
            "currency_id": MONEDA,
        }
        for item in orden.items
    ]

    frente = (settings.FRONTEND_URL or "http://localhost:5173").rstrip("/")
    cuerpo = {
        "items": items,
        "external_reference": referencia_de(orden),
        # El navegador vuelve a una pantalla que dice que **se está
        # verificando**, no a una que festeja. Que la vuelta sea por «success»
        # no prueba nada: esa URL la escribe cualquiera.
        "back_urls": {
            "success": f"{frente}/payment/success?orden={orden.order_number}",
            "pending": f"{frente}/payment/pending?orden={orden.order_number}",
            "failure": f"{frente}/payment/failure?orden={orden.order_number}",
        },
        # Vigencia oficial, la misma que la reserva. Sin `expires` el link vale
        # para siempre, y con él una reserva que no vence nunca —o, peor, una
        # venta cobrada sobre stock que ya se liberó.
        "expires": True,
        "expiration_date_from": mp_pagos.momento_para_mp(datetime.utcnow()),
        "expiration_date_to": mp_pagos.momento_para_mp(hasta),
        # Nuestro propio sello. Vuelve adentro del pago y ata ese pago a esta
        # orden por un camino distinto del de la referencia externa. No lleva
        # dato de ninguna persona.
        "metadata": {"orden_id": orden.id, "orden_numero": orden.order_number},
        # Efectivo y cajero quedan afuera. No es una preferencia comercial: se
        # acreditan en días, y la reserva de stock que los espera bloquearía
        # esa venta para todos los demás durante días.
        "payment_methods": {
            "excluded_payment_types": [{"id": "ticket"}, {"id": "atm"}]
        },
        # Nada de `marketplace_fee`: ni el 5 % de antes ni un cero. TopGreen no
        # cobra comisión por venta.
    }

    # La URL de aviso sólo va si está configurada. Mandar una que no atiende
    # nadie sería pedirle a Mercado Pago que reintente contra el vacío.
    if settings.MP_NOTIFICACION_URL:
        cuerpo["notification_url"] = url_de_aviso()

    return cuerpo


async def _pedir_preferencia(token: str, cuerpo: dict, idempotencia: str) -> dict:
    url = f"{settings.MP_API_BASE_URL.rstrip('/')}/checkout/preferences"
    cabeceras = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencia,
    }
    try:
        async with httpx.AsyncClient(timeout=SEGUNDOS_DE_ESPERA) as cliente:
            respuesta = await cliente.post(url, json=cuerpo, headers=cabeceras)
    except httpx.HTTPError as error:
        logger.warning("Mercado Pago no respondió: %s", type(error).__name__)
        raise NoSePudoPreparar(MP_SIN_RESPUESTA) from error

    if respuesta.status_code >= 400:
        # Sólo el código. El cuerpo trae detalles de la aplicación y del token.
        logger.warning(
            "Mercado Pago rechazó la preferencia (HTTP %s)", respuesta.status_code
        )
        raise NoSePudoPreparar(MP_RECHAZO)

    try:
        datos = respuesta.json()
    except ValueError as error:
        raise NoSePudoPreparar(RESPUESTA_INVALIDA) from error

    if not isinstance(datos, dict) or not datos.get("id") or not datos.get("init_point"):
        faltan = [c for c in ("id", "init_point")
                  if not (isinstance(datos, dict) and datos.get(c))]
        logger.warning("Respuesta de Mercado Pago incompleta: faltan %s", faltan)
        raise NoSePudoPreparar(RESPUESTA_INVALIDA)

    return datos


def pago_de(db: Session, orden: Order) -> Optional[Payment]:
    return db.query(Payment).filter(Payment.order_id == orden.id).first()


def vigente(pago: Optional[Payment], ahora: Optional[datetime] = None) -> bool:
    """¿El link de esta orden todavía sirve para pagar?

    Sin intención o sin vigencia declarada la respuesta es que sí: son las
    órdenes anteriores a esta pieza, y no hay nada que se les haya vencido.
    """
    if pago is None or pago.expires_at is None:
        return True
    return pago.expires_at > (ahora or datetime.utcnow())


def anular_intencion(db: Session, orden: Order) -> bool:
    """Da por muerta la intención de pago local de una orden que terminó.

    No llama a Mercado Pago y no devuelve dinero: sólo deja de decir
    «pendiente» sobre algo que ya no se va a cobrar. Devuelve si había algo que
    anular.

    Esto solo **no alcanza** cuando ya se emitió un link: la preferencia sigue
    viva del lado de Mercado Pago y alguien que la guardó podría pagarla. Quien
    cierra ese borde es `cobro.cerrar_cobro`, que la vence en Mercado Pago
    antes de soltar la mercadería. Acá queda lo que se puede hacer sin red:
    dejar de figurar como pago pendiente nuestro.
    """
    pago = pago_de(db, orden)
    if pago is None or pago.status == PaymentStatus.CANCELLED:
        return False

    pago.status = PaymentStatus.CANCELLED
    db.add(pago)
    return True


async def preparar_pago(db: Session, orden: Order, vendedor: User) -> Payment:
    """Deja lista la preferencia de una orden. Es idempotente.

    Si la orden ya tiene una preferencia con su link, se devuelve esa: no se
    pide otra. Es lo que hace que un doble clic, un reintento después de un
    timeout o una respuesta perdida terminen en el mismo lugar y no en dos
    pagos para la misma compra.
    """
    if not settings.MP_CHECKOUT_HABILITADO:
        raise NoSePudoPreparar(DESHABILITADO)

    existente = pago_de(db, orden)
    if existente and existente.mp_preference_id and existente.init_point:
        return existente

    token = mp_vinculo.access_token_de(db, vendedor)
    if not token:
        raise NoSePudoPreparar(SIN_VINCULO)

    # El plazo ya lo fijó el checkout cuando reservó la mercadería, y es el que
    # manda: la vigencia del link no puede pasarse del final de la reserva. Sólo
    # se calcula uno nuevo si la fila viniera sin plazo, que hoy no pasa por
    # esta ruta y queda como red por si alguna orden vieja llega hasta acá.
    hasta = (existente.expires_at if existente and existente.expires_at else vencimiento_de())
    datos = await _pedir_preferencia(
        token, _cuerpo_de_la_preferencia(orden, hasta), clave_de_idempotencia(orden)
    )

    pago = existente or Payment(
        order_id=orden.id,
        total_amount=orden.total_amount,
        status=PaymentStatus.PENDING,
    )
    # Sólo esto: identificadores, la URL para pagar, hasta cuándo vale, el
    # importe exacto de la orden y nuestro estado. Ni el cuerpo de Mercado Pago
    # ni el token.
    pago.mp_preference_id = str(datos["id"])
    pago.init_point = str(datos["init_point"])
    pago.mp_external_reference = referencia_de(orden)
    pago.total_amount = orden.total_amount
    pago.expires_at = hasta
    pago.status = PaymentStatus.PENDING

    db.add(pago)
    try:
        db.commit()
    except IntegrityError:
        # Dos pedidos al mismo tiempo —un doble clic, un reintento mientras el
        # primero seguía en vuelo— llegan los dos hasta acá creyendo que no hay
        # pago. El índice único de `order_id` deja pasar uno solo, y el que
        # pierde se queda con el que ganó: la orden tiene una intención de pago
        # y no dos. La clave de idempotencia hace que además sea la misma
        # preferencia del lado de Mercado Pago.
        db.rollback()
        ganador = pago_de(db, orden)
        if ganador is None:
            raise
        return ganador

    db.refresh(pago)
    return pago
