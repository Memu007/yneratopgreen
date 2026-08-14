"""Lo que se le pregunta a Mercado Pago sobre un pago, y lo único que se le pide.

Este módulo es la boca por la que entra la verdad. Un aviso de webhook no dice
qué pasó: dice que algo pasó con un identificador. Lo que pasó se consulta acá,
con el token del vendedor que cobra, contra la API oficial.

Lo que se le pide a Mercado Pago, entero:

- `GET /v1/payments/{id}` — el estado real de un pago.
- `GET /v1/payments/search?external_reference=…` — todos los intentos de una
  orden, que es lo que necesita el reconciliador cuando el aviso nunca llegó.
- `PUT /checkout/preferences/{id}` — vencer una preferencia ya emitida, que es
  la única forma oficial de apagar un link que ya viajó.

Y lo que **no** se le pide, a propósito: ningún reembolso, ninguna captura,
ninguna transferencia. TopGreen no mueve dinero de terceros.

Los errores salen como código nuestro. Ninguno lleva el cuerpo de Mercado Pago:
ahí adentro hay datos del pagador cuando sale bien y detalles del token cuando
sale mal.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

SEGUNDOS_DE_ESPERA = 15.0

# Motivos. Los dos primeros son reintentables: el evento no se perdió, se va a
# volver a intentar. Los otros dos no mejoran reintentando.
MP_SIN_RESPUESTA = "mp_sin_respuesta"      # timeout, red caída, 5xx de MP
TOKEN_RECHAZADO = "token_rechazado"        # 401/403: la credencial ya no sirve
NO_ENCONTRADO = "no_encontrado"            # 404: ese pago no existe para este vendedor
RESPUESTA_INVALIDA = "respuesta_invalida"  # 200 que no es lo que dice ser

REINTENTABLES = (MP_SIN_RESPUESTA, TOKEN_RECHAZADO)


class NoSeConsulta(Exception):
    """No se pudo saber qué dice Mercado Pago. Trae un motivo, no un cuerpo."""

    def __init__(self, motivo: str):
        super().__init__(motivo)
        self.motivo = motivo

    @property
    def reintentable(self) -> bool:
        """¿Conviene que Mercado Pago vuelva a avisar?

        Un token revocado y un MP caído son estados del mundo que cambian: la
        respuesta correcta es «todavía no pude», no un falso rechazo ni un 200
        que se coma el aviso.
        """
        return self.motivo in REINTENTABLES


def _base() -> str:
    return settings.MP_API_BASE_URL.rstrip("/")


def _cabeceras(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _revisar(respuesta: httpx.Response) -> dict:
    if respuesta.status_code in (401, 403):
        logger.warning("Mercado Pago rechazó la credencial (HTTP %s)", respuesta.status_code)
        raise NoSeConsulta(TOKEN_RECHAZADO)
    if respuesta.status_code == 404:
        raise NoSeConsulta(NO_ENCONTRADO)
    if respuesta.status_code >= 500:
        logger.warning("Mercado Pago falló (HTTP %s)", respuesta.status_code)
        raise NoSeConsulta(MP_SIN_RESPUESTA)
    if respuesta.status_code >= 400:
        logger.warning("Mercado Pago rechazó la consulta (HTTP %s)", respuesta.status_code)
        raise NoSeConsulta(RESPUESTA_INVALIDA)

    try:
        datos = respuesta.json()
    except ValueError as error:
        raise NoSeConsulta(RESPUESTA_INVALIDA) from error
    if not isinstance(datos, dict):
        raise NoSeConsulta(RESPUESTA_INVALIDA)
    return datos


async def _pedir(metodo: str, ruta: str, token: str, **extra) -> dict:
    try:
        async with httpx.AsyncClient(timeout=SEGUNDOS_DE_ESPERA) as cliente:
            respuesta = await cliente.request(
                metodo, f"{_base()}{ruta}", headers=_cabeceras(token), **extra
            )
    except httpx.HTTPError as error:
        logger.warning("Mercado Pago no respondió: %s", type(error).__name__)
        raise NoSeConsulta(MP_SIN_RESPUESTA) from error
    return _revisar(respuesta)


async def consultar(token: str, mp_payment_id: str) -> dict:
    """El estado real de un pago, dicho por Mercado Pago.

    Devuelve el cuerpo tal cual llega. No se guarda: de acá salen unos pocos
    campos y el resto se descarta en el mismo momento.
    """
    datos = await _pedir("GET", f"/v1/payments/{mp_payment_id}", token)
    if not datos.get("id") or not datos.get("status"):
        raise NoSeConsulta(RESPUESTA_INVALIDA)
    return datos


async def buscar_por_referencia(token: str, referencia: str) -> List[dict]:
    """Todos los intentos de pago de una orden.

    Es la consulta del reconciliador: cuando el aviso no llegó —se perdió, la
    URL no estaba configurada, el servidor estaba caído—, esto es lo que
    permite no adivinar. Una lista vacía es una respuesta legítima y significa
    que por esa orden nadie intentó pagar.
    """
    datos = await _pedir(
        "GET",
        "/v1/payments/search",
        token,
        params={"external_reference": referencia, "sort": "date_created", "criteria": "desc"},
    )
    resultados = datos.get("results")
    if resultados is None:
        raise NoSeConsulta(RESPUESTA_INVALIDA)
    if not isinstance(resultados, list):
        raise NoSeConsulta(RESPUESTA_INVALIDA)
    return [r for r in resultados if isinstance(r, dict)]


def momento_para_mp(cuando: datetime) -> str:
    """Una fecha como la quiere Mercado Pago: ISO 8601 con desplazamiento.

    Se manda en UTC explícito. Sin desplazamiento la API la rechaza, y con un
    desplazamiento local la vigencia dependería de la zona horaria del
    servidor, que es lo último que uno quiere que decida cuándo muere un link.
    """
    if cuando.tzinfo is None:
        cuando = cuando.replace(tzinfo=timezone.utc)
    return cuando.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000+00:00")


async def vencer_preferencia(token: str, preference_id: str) -> None:
    """Apaga un link de pago ya emitido.

    Es la única forma oficial de cerrarlo: no existe un «borrar preferencia».
    Se la actualiza para que su vigencia termine ahora, y a partir de ahí
    Mercado Pago no deja pagar por ese link.

    Importa cuándo se usa: **antes** de liberar la mercadería que esa compra
    tenía reservada. Al revés —soltar el stock y después intentar cerrar— es
    exactamente la ventana en la que alguien paga algo que ya no existe.
    """
    ahora = datetime.now(timezone.utc)
    await _pedir(
        "PUT",
        f"/checkout/preferences/{preference_id}",
        token,
        json={
            "expires": True,
            # La ventana tiene que empezar antes de terminar; lo que importa
            # es el final, que es ahora.
            "expiration_date_from": momento_para_mp(ahora - timedelta(minutes=1)),
            "expiration_date_to": momento_para_mp(ahora),
        },
    )
