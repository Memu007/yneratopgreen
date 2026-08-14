"""La puerta por la que Mercado Pago avisa que algo pasó con un pago.

Es una URL pública, así que se escribió al revés de como se escribe un
endpoint normal: acá lo primero no es qué hacer con lo que llegó, sino cuánto
de lo que llegó merece que se lo mire.

El orden es este y no otro:

1. **Firma.** Se valida con el `data.id` de la URL y los headers, y el cuerpo
   **todavía no se leyó**: no es que se lea y se ignore, es que no se lee. Sin
   firma válida no se consulta la cuenta de ningún vendedor y no se toca una
   fila.
2. **El cuerpo enruta y nada más.** Se lee recién después de autenticar, y de
   él sale una sola cosa: de qué cuenta viene. Ni siquiera qué pago —ese es el
   de la URL, que es el que quedó firmado—. Que el cuerpo diga «approved» no
   aprueba nada: lo escribe quien lo mande.
3. **La verdad se consulta.** `GET /v1/payments/{id}` con el token del
   vendedor, y de esa respuesta —no de la que llegó— sale el estado.

Sobre los códigos que devuelve, que también son una decisión:

- **200** cuando el aviso quedó resuelto: se aplicó, era repetido, o se
  descartó a propósito. Mercado Pago no tiene que volver.
- **401** cuando la firma no valida. Es lo único que se responde sin haber
  mirado nada.
- **503** cuando no pudimos saber: Mercado Pago no contestó, el token no sirve,
  la cuenta no está vinculada acá, falta el secreto. El aviso **no se pierde**,
  se reintenta. Devolver 200 ahí sería tragarse un pago.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Header, Request, Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.base import get_db
from app.models.user import User
from app.services import cobro, mp_firma, mp_pagos

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mp", tags=["mercadopago"])

# El único tópico que se atiende. Mercado Pago manda varios —merchant_order,
# plan, subscription— y de todos ellos el que dice qué pasó con la plata es
# este. Los demás se reconocen y se descartan.
TOPICO_PAGO = ("payment", "payment.created", "payment.updated")

SIN_DESTINATARIO = "sin_destinatario"
OTRO_TOPICO = "otro_topico"


def _dato(pedido: Request) -> Optional[str]:
    """El identificador del pago, **de la URL y nada más que de la URL**.

    Es el que entra en el manifiesto que se firma, así que es el único que
    sirve para autenticar. El cuerpo también lo trae, pero el cuerpo no está
    firmado: tomarlo como respaldo dejaría que quien manda el aviso elija qué
    pago se consulta, que es exactamente el agujero que la firma tapa. Si no
    viene en la URL, el aviso no se puede autenticar y no se procesa.
    """
    de_la_url = pedido.query_params.get("data.id") or pedido.query_params.get("id")
    return str(de_la_url) if de_la_url else None


def _topico(cuerpo: dict, pedido: Request) -> str:
    return str(
        cuerpo.get("type")
        or cuerpo.get("topic")
        or pedido.query_params.get("type")
        or pedido.query_params.get("topic")
        or ""
    ).lower()


@router.post("/webhook")
async def webhook(
    pedido: Request,
    respuesta: Response,
    x_signature: Optional[str] = Header(default=None, alias="x-signature"),
    x_request_id: Optional[str] = Header(default=None, alias="x-request-id"),
    db: Session = Depends(get_db),
):
    """Recibe un aviso de Mercado Pago. Devuelve siempre un código nuestro."""
    # El cuerpo todavía no se lee. Lo único que se mira para autenticar es lo
    # que está firmado: el `data.id` de la URL y los dos headers.
    identificador = _dato(pedido)

    try:
        mp_firma.validar(
            x_signature=x_signature,
            x_request_id=x_request_id,
            data_id=identificador,
            secreto=settings.MP_WEBHOOK_SECRET,
            tolerancia_segundos=settings.MP_TOLERANCIA_FIRMA_SEGUNDOS,
        )
    except mp_firma.FirmaInvalida as fallo:
        if fallo.motivo == mp_firma.SIN_SECRETO:
            # No es culpa de quien avisa: es nuestra. Y no se puede autenticar
            # nada, así que tampoco se puede procesar nada. Reintentable, para
            # que el aviso siga existiendo cuando la configuración esté.
            logger.error("Llegó un aviso de Mercado Pago y no hay secreto configurado")
            respuesta.status_code = 503
            return {"resultado": fallo.motivo}
        logger.warning("Aviso de Mercado Pago sin firma válida: %s", fallo.motivo)
        respuesta.status_code = 401
        return {"resultado": fallo.motivo}

    # --- Desde acá el aviso está autenticado. Recién ahora se lee el cuerpo,
    # y sólo para enrutar: qué tópico es y de qué cuenta viene. El estado real
    # no sale de acá, sale de la consulta.
    try:
        cuerpo = await pedido.json()
    except Exception:  # noqa: BLE001
        cuerpo = {}
    if not isinstance(cuerpo, dict):
        cuerpo = {}

    if _topico(cuerpo, pedido) not in TOPICO_PAGO:
        return {"resultado": OTRO_TOPICO}

    cuenta = cuerpo.get("user_id") or (
        cuerpo.get("data", {}).get("user_id") if isinstance(cuerpo.get("data"), dict) else None
    )
    vendedor = (
        db.query(User).filter(User.mp_user_id == str(cuenta)).first() if cuenta else None
    )
    if vendedor is None:
        # Nadie a quien preguntarle: esa cuenta no está vinculada acá. Puede
        # ser un vendedor que desvinculó con un pago en vuelo, y en ese caso
        # el pago existe aunque nosotros no podamos verlo. Reintentable, por
        # el mismo motivo que todo lo demás: no saber no es saber que no.
        logger.warning("Aviso de Mercado Pago para una cuenta que no está vinculada")
        respuesta.status_code = 503
        return {"resultado": SIN_DESTINATARIO}

    try:
        resultado = await cobro.procesar_pago(db, identificador, vendedor)
    except mp_pagos.NoSeConsulta as fallo:
        if fallo.reintentable:
            # No pudimos saber qué pasó. El aviso tiene que volver.
            respuesta.status_code = 503
            return {"resultado": fallo.motivo}
        logger.warning("No se pudo consultar el pago avisado: %s", fallo.motivo)
        return {"resultado": fallo.motivo}
    except cobro.NoCorresponde as fallo:
        # Firmado, consultado y aun así no es de esta orden: cobrador ajeno,
        # referencia cruzada, importe o moneda distintos. No se mueve nada y no
        # se pide que vuelvan: la respuesta no va a cambiar.
        logger.warning("Un pago avisado no corresponde: %s", fallo.motivo)
        return {"resultado": fallo.motivo}

    return {"resultado": resultado}
