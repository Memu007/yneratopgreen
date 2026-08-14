"""Qué le pasó al dinero de una orden, y qué hace TopGreen con esa noticia.

Este módulo es el único lugar donde una orden pasa a estar pagada. Y hay una
sola manera de que eso ocurra: que Mercado Pago, consultado con el token del
vendedor que cobra, diga que hay un pago aprobado para esa orden.

Lo que **no** la marca pagada, y hay que decirlo porque es la tentación fácil:
un aviso de webhook por sí solo —el cuerpo no está firmado y sólo sirve para
saber a quién preguntarle—, una vuelta del navegador, un query param, o que el
comprador diga que pagó.

Antes de asociar un pago a una orden se comprueba, todo:

- que el cobrador sea el vendedor vinculado que esperábamos;
- que la referencia externa apunte a esta orden y que esta orden sea de él;
- que la preferencia sea la nuestra —por el `preference_id` cuando viene y por
  el identificador de orden que viajó en la metadata—;
- que la moneda sea la misma;
- y que el importe sea **exactamente** el de la orden, en `Decimal`.

Cualquiera de esas que no cierre no mueve nada. Un pago de otro vendedor, un
importe alterado o una referencia cruzada son, todos, la misma cosa: alguien
diciendo que se pagó algo que no se pagó.

Sobre repetir: los avisos llegan duplicados, en paralelo y desordenados. Cada
intento tiene su fila con `mp_payment_id` único, cada noticia trae la fecha en
que Mercado Pago la actualizó, y el efecto de stock se mueve con un `UPDATE`
condicional. Las tres cosas juntas son lo que hace que cinco avisos del mismo
pago produzcan una transición y un descuento.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import List, Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.mp_intento import MPIntentoDePago
from app.models.order import Order, OrderStatus
from app.models.payment import Payment, PaymentStatus
from app.models.user import User
from app.services import mp_pagos, mp_preferencia, mp_vinculo, stock
from app.services.checkout import MEDIO_MERCADO_PAGO

logger = logging.getLogger(__name__)

# --- Estados de Mercado Pago que sabemos leer. Lo que no está acá se guarda
#     como vino y no dispara ningún efecto: inventarle una equivalencia a un
#     estado que no conocemos es exactamente cómo se pierde plata.
APROBADO = "approved"
EN_PROCESO = ("pending", "in_process", "authorized", "in_mediation")
RECHAZADO = ("rejected",)
CANCELADO = ("cancelled", "expired")
DEVUELTO = "refunded"
CONTRACARGO = "charged_back"

# Un intento aprobado sólo puede irse a estos. Cualquier otra noticia sobre él
# es un retroceso y se descarta: una aprobación no se deshace por un aviso.
DESDE_APROBADO = (APROBADO, DEVUELTO, CONTRACARGO, "in_mediation")

# --- Motivos por los que un pago no se asocia. Van al log y a la respuesta
#     como código; ninguno cuenta de más.
COBRADOR_AJENO = "cobrador_ajeno"
REFERENCIA_DESCONOCIDA = "referencia_desconocida"
VENDEDOR_AJENO = "vendedor_ajeno"
ORDEN_SIN_MERCADOPAGO = "orden_sin_mercadopago"
SIN_INTENCION = "sin_intencion"
PREFERENCIA_AJENA = "preferencia_ajena"
ORDEN_AJENA = "orden_ajena"
MONEDA_DISTINTA = "moneda_distinta"
IMPORTE_DISTINTO = "importe_distinto"
DATOS_INCOMPLETOS = "datos_incompletos"

# --- Resultados de procesar un aviso.
APLICADO = "aplicado"
REPETIDO = "repetido"          # ya lo habíamos aplicado; nada se movió
VIEJO = "viejo"                # noticia anterior a la última aplicada
RETROCESO = "retroceso"        # querría deshacer una aprobación; se descarta

# --- Cómo lo ve una persona. Es lo que va a la pantalla del comprador y a la
#     del vendedor, y son las mismas palabras para los dos.
VISIBLE_PENDIENTE = "pendiente"
VISIBLE_EN_PROCESO = "en_proceso"
VISIBLE_APROBADO = "aprobado"
VISIBLE_RECHAZADO = "rechazado"
VISIBLE_DEVUELTO = "devuelto"
VISIBLE_CONTRACARGO = "contracargo"
VISIBLE_CANCELADO = "cancelado"
VISIBLE_EN_REVISION = "en_revision"

# Los estados de la intención que significan que hubo plata. Se agrupan porque
# los tres disparan lo mismo: la mercadería reservada sale, y sale una vez.
CON_COBRO = (
    PaymentStatus.APPROVED,
    PaymentStatus.REFUNDED,
    PaymentStatus.CHARGED_BACK,
    PaymentStatus.EN_REVISION,
)

MOTIVO_VENCIDA = "El link de pago venció sin que se acreditara el pago."


class NoCorresponde(Exception):
    """Ese pago no es de esta orden. Trae un motivo."""

    def __init__(self, motivo: str):
        super().__init__(motivo)
        self.motivo = motivo


@dataclass
class IntentoMP:
    """Lo poco que nos llevamos de la respuesta de Mercado Pago."""

    mp_payment_id: str
    estado: str
    monto: Decimal
    moneda: str
    actualizado_el: Optional[datetime]
    aprobado_el: Optional[datetime]
    devuelto: Optional[Decimal]


def _momento(texto) -> Optional[datetime]:
    """Una fecha de Mercado Pago a UTC sin zona, que es como guarda la base."""
    if not texto or not isinstance(texto, str):
        return None
    try:
        cuando = datetime.fromisoformat(texto.replace("Z", "+00:00"))
    except ValueError:
        return None
    if cuando.tzinfo is None:
        return cuando
    return cuando.astimezone(timezone.utc).replace(tzinfo=None)


def _decimal(valor) -> Optional[Decimal]:
    """El importe, exacto. `str()` primero: `Decimal(float)` arrastra basura."""
    if valor is None:
        return None
    try:
        return Decimal(str(valor))
    except (InvalidOperation, TypeError, ValueError):
        return None


def orden_de_referencia(db: Session, referencia) -> Optional[Order]:
    """La orden que dice una referencia externa, o nada.

    La referencia la armamos nosotros y tiene una sola forma. Una que no la
    tenga no es «de otra orden»: es de otra aplicación, y no se busca.
    """
    if not referencia or not isinstance(referencia, str):
        return None
    prefijo = "topgreen-"
    if not referencia.startswith(prefijo):
        return None
    numero = referencia[len(prefijo):]
    return db.query(Order).filter(Order.order_number == numero).first()


def verificar(
    db: Session, datos: dict, vendedor: User
) -> tuple[Order, Payment, IntentoMP]:
    """Comprueba que ese pago sea de una orden nuestra, de este vendedor.

    Levanta `NoCorresponde` en cuanto algo no cierra. No escribe nada: separar
    comprobar de aplicar es lo que permite que un pago cruzado no deje rastro.
    """
    cobrador = datos.get("collector_id")
    if cobrador is None and isinstance(datos.get("collector"), dict):
        cobrador = datos["collector"].get("id")
    if not cobrador or str(cobrador) != str(vendedor.mp_user_id or ""):
        raise NoCorresponde(COBRADOR_AJENO)

    orden = orden_de_referencia(db, datos.get("external_reference"))
    if orden is None:
        raise NoCorresponde(REFERENCIA_DESCONOCIDA)
    if orden.seller_id != vendedor.id:
        raise NoCorresponde(VENDEDOR_AJENO)
    if orden.payment_method != MEDIO_MERCADO_PAGO:
        raise NoCorresponde(ORDEN_SIN_MERCADOPAGO)

    pago = mp_preferencia.pago_de(db, orden)
    if pago is None:
        raise NoCorresponde(SIN_INTENCION)

    # La preferencia: por su identificador cuando Mercado Pago lo devuelve, y
    # por el identificador de orden que nosotros mismos mandamos en la
    # metadata al crearla. Son dos ataduras independientes; alcanza con que
    # cualquiera de las dos venga y no coincida para no asociar nada.
    preferencia = datos.get("preference_id")
    if preferencia and str(preferencia) != str(pago.mp_preference_id or ""):
        raise NoCorresponde(PREFERENCIA_AJENA)
    metadata = datos.get("metadata")
    if isinstance(metadata, dict):
        marcada = metadata.get("orden_id")
        if marcada and str(marcada) != str(orden.id):
            raise NoCorresponde(ORDEN_AJENA)

    moneda = datos.get("currency_id")
    if not moneda or str(moneda) != str(orden.currency or mp_preferencia.MONEDA):
        raise NoCorresponde(MONEDA_DISTINTA)

    monto = _decimal(datos.get("transaction_amount"))
    if monto is None:
        raise NoCorresponde(DATOS_INCOMPLETOS)
    if monto != Decimal(orden.total_amount):
        # Exacto y sin tolerancia: cobrar de menos o de más es cobrar otra cosa.
        raise NoCorresponde(IMPORTE_DISTINTO)

    identificador = datos.get("id")
    estado = datos.get("status")
    if not identificador or not estado:
        raise NoCorresponde(DATOS_INCOMPLETOS)

    intento = IntentoMP(
        mp_payment_id=str(identificador),
        estado=str(estado).lower(),
        monto=monto,
        moneda=str(moneda),
        actualizado_el=_momento(datos.get("date_last_updated")),
        aprobado_el=_momento(datos.get("date_approved")),
        devuelto=_decimal(datos.get("transaction_amount_refunded")),
    )
    return orden, pago, intento


def _guardar_intento(
    db: Session, orden: Order, pago: Payment, intento: IntentoMP
) -> str:
    """Escribe o actualiza la fila del intento. Devuelve qué pasó.

    Acá viven las tres formas de que un aviso no tenga efecto: que sea el mismo
    que ya aplicamos, que traiga una noticia más vieja que la última, o que
    quiera deshacer una aprobación.
    """
    fila = (
        db.query(MPIntentoDePago)
        .filter(MPIntentoDePago.mp_payment_id == intento.mp_payment_id)
        .with_for_update()
        .first()
    )

    if fila is None:
        fila = MPIntentoDePago(
            order_id=orden.id,
            payment_id=pago.id,
            mp_payment_id=intento.mp_payment_id,
            estado=intento.estado,
            monto=intento.monto,
            moneda=intento.moneda,
            mp_actualizado_el=intento.actualizado_el,
            mp_aprobado_el=intento.aprobado_el,
        )
        try:
            # Punto de retorno propio: si el índice único rechaza esta fila, se
            # deshace **sólo** esto. Un `rollback` entero acá se llevaría
            # puestos los intentos que la sincronización ya aplicó antes.
            with db.begin_nested():
                db.add(fila)
                db.flush()
        except IntegrityError:
            # Dos avisos del mismo pago entraron a la vez y los dos vieron la
            # tabla vacía. El índice único deja uno; el otro se queda con lo
            # que escribió el que ganó.
            return REPETIDO
        return APLICADO

    if fila.order_id != orden.id:
        # El identificador de un pago es único en Mercado Pago, así que esto no
        # debería pasar nunca. Si pasa, es una colisión y lo último que hay que
        # hacer es reescribir el intento de otra compra con estos datos.
        logger.error(
            "El pago %s ya figura en otra orden: no se toca", intento.mp_payment_id
        )
        raise NoCorresponde(ORDEN_AJENA)

    if fila.estado == intento.estado and fila.mp_actualizado_el == intento.actualizado_el:
        return REPETIDO

    if (
        fila.mp_actualizado_el
        and intento.actualizado_el
        and intento.actualizado_el < fila.mp_actualizado_el
    ):
        return VIEJO

    if fila.estado == APROBADO and intento.estado not in DESDE_APROBADO:
        # Una aprobación no se deshace por un aviso: lo que sí la deshace
        # —devolución, contracargo— tiene su propio estado y está contemplado.
        logger.warning(
            "Aviso que retrocedería una aprobación (%s → %s) sobre el pago %s",
            fila.estado, intento.estado, intento.mp_payment_id,
        )
        return RETROCESO

    fila.estado = intento.estado
    fila.monto = intento.monto
    fila.moneda = intento.moneda
    fila.mp_actualizado_el = intento.actualizado_el or fila.mp_actualizado_el
    fila.mp_aprobado_el = intento.aprobado_el or fila.mp_aprobado_el
    db.add(fila)
    return APLICADO


def _intentos(db: Session, orden: Order) -> List[MPIntentoDePago]:
    return (
        db.query(MPIntentoDePago)
        .filter(MPIntentoDePago.order_id == orden.id)
        .order_by(MPIntentoDePago.creado_el)
        .all()
    )


def _resumen(intentos: List[MPIntentoDePago]) -> PaymentStatus:
    """El estado de la intención, resumido de todos sus intentos.

    El orden importa y no es alfabético: primero lo que pasó **después** de
    cobrar —contracargo, devolución—, porque tapa a la aprobación; después la
    aprobación, que tapa a todo lo demás; después lo que está en curso; y
    recién al final los rechazos, que no cierran nada porque el link sigue
    sirviendo para volver a intentar.
    """
    estados = [i.estado for i in intentos]
    if CONTRACARGO in estados:
        return PaymentStatus.CHARGED_BACK
    if DEVUELTO in estados:
        return PaymentStatus.REFUNDED
    if len({i.mp_payment_id for i in intentos if i.estado == APROBADO}) > 1:
        # Dos pagos aprobados distintos para la misma orden. Una preferencia de
        # Checkout Pro sigue sirviendo después de cobrada, así que esto es
        # posible aunque el link se apague al primer cobro: dos intentos que
        # venían en vuelo pueden acreditarse los dos.
        #
        # Resumirlo como «aprobado» contaría una venta donde hay dos cobros, y
        # es justo el error que nadie ve hasta que el comprador reclama. No se
        # consolida mercadería dos veces, no se devuelve plata sola —eso no lo
        # decide un `if`— y los dos identificadores quedan guardados.
        return PaymentStatus.EN_REVISION
    if APROBADO in estados:
        return PaymentStatus.APPROVED
    if any(e in EN_PROCESO for e in estados):
        return PaymentStatus.IN_PROCESS
    if any(e in RECHAZADO for e in estados):
        # Rechazado un intento, la intención sigue viva: la preferencia se
        # puede volver a usar y la orden se sigue pudiendo pagar.
        return PaymentStatus.PENDING
    if estados and all(e in CANCELADO for e in estados):
        return PaymentStatus.CANCELLED
    return PaymentStatus.PENDING


def aplicar(db: Session, orden: Order, pago: Payment) -> PaymentStatus:
    """Lleva la orden y la intención al estado que dicen los intentos.

    El efecto de stock se pide siempre y se aplica una sola vez: quien decide
    si corresponde moverlo es el `UPDATE` condicional de la reserva, no un
    `if` de acá.
    """
    intentos = _intentos(db, orden)
    if not intentos:
        # Sin un solo intento no hay nada que derivar, y derivar igual sería
        # peligroso: pisaría con «pendiente» una intención que ya se anuló al
        # cerrar la orden. Preguntar no puede resucitar un cobro muerto.
        return pago.status

    resumen = _resumen(intentos)

    # Y una intención anulada sólo se reabre por plata de verdad. Un intento
    # rechazado no la devuelve a «pendiente»: la orden ya terminó.
    if pago.status == PaymentStatus.CANCELLED and resumen in (
        PaymentStatus.PENDING, PaymentStatus.IN_PROCESS
    ):
        return pago.status

    aprobado = next((i for i in intentos if i.estado == APROBADO), None)
    if aprobado is not None:
        pago.mp_payment_id = aprobado.mp_payment_id
        pago.paid_at = pago.paid_at or aprobado.mp_aprobado_el or datetime.utcnow()

    devuelto = next(
        (i for i in intentos if i.estado in (DEVUELTO, CONTRACARGO)), None
    )
    if devuelto is not None:
        pago.refunded_at = pago.refunded_at or devuelto.mp_actualizado_el or datetime.utcnow()
        pago.refund_amount = pago.refund_amount or devuelto.monto

    pago.status = resumen
    db.add(pago)

    if resumen in CON_COBRO:
        # El caso que no se puede tapar: llegó plata sobre una reserva que ya
        # se soltó.
        #
        # Pasa en una sola situación, y es la que quedó documentada como riesgo
        # abierto: un pago que ya estaba en vuelo cuando se apagó el link se
        # acredita después de que la mercadería volvió al catálogo. No hay
        # candado que lo evite —el pago existe del lado de Mercado Pago aunque
        # acá nadie se haya enterado— y devolver la plata solos no es una
        # operación que tenga esta plataforma.
        #
        # Lo que sí se puede evitar es mentir sobre el resultado. Dejar la
        # orden en un estado terminal —cancelada, vencida— con un cobro
        # acreditado adentro sería un estado terminal falso: nadie lo mira
        # nunca más y la plata queda sin explicación. Así que la orden vuelve a
        # decir que está pagada, la intención queda en revisión, y el stock
        # **no** se vuelve a tomar: puede haberse vendido a otro en el medio, y
        # esa es justamente la decisión que necesita una persona.
        if orden.stock_reserva == stock.LIBERADA:
            logger.error(
                "Cobro acreditado sobre una reserva ya liberada en %s: queda en revisión",
                orden.order_number,
            )
            pago.status = PaymentStatus.EN_REVISION
            db.add(pago)
            if orden.status != OrderStatus.PAID:
                orden.status = OrderStatus.PAID
                orden.updated_at = datetime.utcnow()
                db.add(orden)
            return PaymentStatus.EN_REVISION

        # Hubo cobro: la mercadería reservada sale. Una devolución posterior
        # **no** la devuelve sola —puede estar despachada—; queda el estado
        # visible para que el vendedor decida. Con dos aprobados también sale
        # una sola vez: lo que decide es el `UPDATE` condicional de la reserva,
        # no la cantidad de pagos.
        stock.consolidar(db, orden)
        if orden.status == OrderStatus.PLACED:
            orden.status = OrderStatus.PAID
            orden.updated_at = datetime.utcnow()
            db.add(orden)

    return resumen


async def apagar_link(db: Session, orden: Order, pago: Payment, token: Optional[str]) -> bool:
    """Apaga la preferencia de una orden que ya cobró. Devuelve si quedó hecho.

    Una preferencia de Checkout Pro **no se muere sola cuando se cobra**: el
    link sigue sirviendo y se puede volver a pagar. Así que en cuanto entra el
    primer pago acreditado se la vence, que es la única operación oficial para
    cerrar un link ya emitido.

    Puede fallar —Mercado Pago no contesta, el token se revocó— y entonces no
    se miente: `link_cerrado` queda en falso y el reconciliador lo reintenta.
    No se hace ruido en la respuesta del webhook por esto: el pago se
    registró igual, y perder el aviso por no haber podido apagar un link sería
    cambiar un problema chico por uno grande.
    """
    if pago.link_cerrado or not pago.mp_preference_id or not token:
        return bool(pago.link_cerrado)
    try:
        await mp_pagos.vencer_preferencia(token, pago.mp_preference_id)
    except mp_pagos.NoSeConsulta as fallo:
        logger.warning(
            "No se pudo apagar el link ya cobrado de %s: %s",
            orden.order_number, fallo.motivo,
        )
        return False
    pago.link_cerrado = True
    db.add(pago)
    return True


async def procesar_pago(db: Session, mp_payment_id: str, vendedor: User) -> str:
    """El camino completo de un aviso: consultar, comprobar, aplicar.

    Le pregunta a Mercado Pago con el token del vendedor. Lo que devuelva esa
    consulta es lo único que se cree.
    """
    token = mp_vinculo.access_token_de(db, vendedor)
    if not token:
        raise mp_pagos.NoSeConsulta(mp_pagos.TOKEN_RECHAZADO)

    datos = await mp_pagos.consultar(token, mp_payment_id)
    orden, pago, intento = verificar(db, datos, vendedor)

    # A partir de acá se escribe, así que la orden se bloquea: webhook,
    # cancelación y reconciliación no se pisan sobre la misma compra.
    db.query(Order).filter(Order.id == orden.id).with_for_update().first()

    resultado = _guardar_intento(db, orden, pago, intento)
    if resultado == APLICADO:
        resumen = aplicar(db, orden, pago)
        if resumen in CON_COBRO:
            # Cobrada: se apaga el link antes de confirmar. La llamada va con
            # la fila bloqueada, y es a propósito: si se soltara el candado
            # para hacerla, otro pago podría entrar por el mismo link justo
            # mientras lo estamos apagando.
            await apagar_link(db, orden, pago, token)
        db.commit()
    else:
        db.rollback()
    return resultado


async def sincronizar(db: Session, orden: Order, confirmar: bool = True) -> str:
    """Le pregunta a Mercado Pago por todos los intentos de una orden.

    Es lo que se usa cuando el aviso no llegó: el reconciliador, el comprador
    que vuelve del navegador. Aplica lo que encuentre con las mismas reglas
    que el webhook, así que no hay un segundo camino por el que una orden se
    pueda marcar pagada.

    `confirmar=False` deja la transacción abierta **con el candado de la orden
    todavía tomado**, para quien va a seguir decidiendo sobre esa misma fila.
    Es lo que necesita el reconciliador: si acá se hiciera `commit`, el candado
    se soltaría entre «pregunté y no había pago» y «entonces libero», y en esa
    rendija entra un webhook que aprueba. El resultado sería lo único que este
    módulo no puede permitir: plata cobrada con la mercadería ya devuelta.
    """
    pago = mp_preferencia.pago_de(db, orden)
    if pago is None:
        return SIN_INTENCION

    vendedor = db.query(User).filter(User.id == orden.seller_id).first()
    if vendedor is None:
        return VENDEDOR_AJENO
    token = mp_vinculo.access_token_de(db, vendedor)
    if not token:
        raise mp_pagos.NoSeConsulta(mp_pagos.TOKEN_RECHAZADO)

    encontrados = await mp_pagos.buscar_por_referencia(
        token, mp_preferencia.referencia_de(orden)
    )

    db.query(Order).filter(Order.id == orden.id).with_for_update().first()

    hubo = False
    for datos in encontrados:
        try:
            de_la_referencia, _, intento = verificar(db, datos, vendedor)
        except NoCorresponde as fallo:
            logger.warning(
                "Un pago devuelto por la búsqueda no corresponde (%s)", fallo.motivo
            )
            continue
        if de_la_referencia.id != orden.id:
            # La búsqueda fue por la referencia de esta orden; si algo vuelve
            # apuntando a otra, no se toca. Preguntar por una no puede escribir
            # sobre otra.
            logger.warning("La búsqueda de %s devolvió un pago de otra orden", orden.order_number)
            continue
        if _guardar_intento(db, orden, pago, intento) == APLICADO:
            hubo = True

    resumen = aplicar(db, orden, pago)
    if resumen in CON_COBRO:
        await apagar_link(db, orden, pago, token)
    if confirmar:
        db.commit()
    return APLICADO if hubo else REPETIDO


def hay_cobro(db: Session, orden: Order) -> bool:
    """¿Esta orden tiene plata cobrada? Se responde por los intentos."""
    return any(
        i.estado in (APROBADO, DEVUELTO, CONTRACARGO) for i in _intentos(db, orden)
    )


def hay_intento_en_curso(db: Session, orden: Order) -> bool:
    """¿Hay un pago empezado que todavía puede acreditarse?

    Importa para el reconciliador: una reserva vencida con un pago en proceso
    **no** se libera. El reloj no es autoridad sobre la plata.
    """
    return any(i.estado in EN_PROCESO for i in _intentos(db, orden))


async def cerrar_cobro(db: Session, orden: Order) -> str:
    """Apaga el link de pago de una orden que termina y suelta su mercadería.

    El orden de los dos pasos es la regla, no un detalle: **primero se cierra
    el link, después se libera el stock**. Al revés queda la ventana en la que
    alguien paga un link vivo por unidades que ya se le prometieron a otro.

    Si Mercado Pago no contesta, la orden termina igual —la persona ya
    canceló— pero la reserva queda en «cierre pendiente» y no se libera. La
    mercadería vuelve cuando el reconciliador pueda confirmar que nadie pagó.
    """
    pago = mp_preferencia.pago_de(db, orden)

    if orden.payment_method != MEDIO_MERCADO_PAGO or pago is None or not pago.mp_preference_id:
        # Sin link emitido no hay nada que apagar: la mercadería vuelve ya.
        stock.liberar(db, orden)
        mp_preferencia.anular_intencion(db, orden)
        return "sin_link"

    vendedor = db.query(User).filter(User.id == orden.seller_id).first()
    token = mp_vinculo.access_token_de(db, vendedor) if vendedor else None
    if not token:
        stock.marcar_cierre_pendiente(db, orden)
        return "diferido"

    try:
        await mp_pagos.vencer_preferencia(token, pago.mp_preference_id)
        pagos_de_la_orden = await mp_pagos.buscar_por_referencia(
            token, mp_preferencia.referencia_de(orden)
        )
    except mp_pagos.NoSeConsulta as fallo:
        logger.warning("No se pudo cerrar el cobro de %s: %s", orden.order_number, fallo.motivo)
        stock.marcar_cierre_pendiente(db, orden)
        return "diferido"

    # El link quedó apagado. Se anota, porque de eso depende que nadie lo
    # vuelva a intentar y que el reconciliador no lo reintente al pedo.
    pago.link_cerrado = True
    db.add(pago)

    for datos in pagos_de_la_orden:
        try:
            _, _, intento = verificar(db, datos, vendedor)
        except NoCorresponde:
            continue
        _guardar_intento(db, orden, pago, intento)

    if hay_cobro(db, orden):
        # Estaba pagada. No se libera nada y no se miente: quien llamó tiene
        # que enterarse de que esta orden ya tenía plata adentro.
        aplicar(db, orden, pago)
        return "cobrada"

    stock.liberar(db, orden)
    if pago.status not in (PaymentStatus.APPROVED, PaymentStatus.REFUNDED, PaymentStatus.CHARGED_BACK):
        pago.status = PaymentStatus.CANCELLED
        db.add(pago)
    return "cerrado"


def estado_visible(db: Session, orden: Order) -> Optional[str]:
    """Cómo se le cuenta a una persona en qué anda el pago de su orden.

    Las mismas palabras para el comprador y para el vendedor: si a uno le
    dijéramos «aprobado» y al otro «pendiente», el que despacha y el que
    reclama estarían mirando dos verdades.
    """
    if orden.payment_method != MEDIO_MERCADO_PAGO:
        return None

    pago = mp_preferencia.pago_de(db, orden)
    if pago is None:
        return VISIBLE_PENDIENTE

    if pago.status == PaymentStatus.EN_REVISION:
        return VISIBLE_EN_REVISION
    if pago.status == PaymentStatus.CHARGED_BACK:
        return VISIBLE_CONTRACARGO
    if pago.status == PaymentStatus.REFUNDED:
        return VISIBLE_DEVUELTO
    if pago.status == PaymentStatus.APPROVED:
        return VISIBLE_APROBADO
    if pago.status == PaymentStatus.IN_PROCESS:
        return VISIBLE_EN_PROCESO
    if pago.status == PaymentStatus.CANCELLED:
        return VISIBLE_CANCELADO

    # Pendiente. Si el último intento fue rechazado se dice, aunque el link
    # siga sirviendo: esconderlo dejaría a la persona esperando una
    # acreditación que no va a llegar.
    intentos = _intentos(db, orden)
    if intentos and intentos[-1].estado in RECHAZADO:
        return VISIBLE_RECHAZADO
    return VISIBLE_PENDIENTE
