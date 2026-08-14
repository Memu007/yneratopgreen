"""La firma con la que Mercado Pago autentica cada aviso.

Un webhook es una URL pública: cualquiera puede pegarle. Lo único que separa
un aviso de Mercado Pago de uno inventado es esta firma, así que acá no hay
grados. O el aviso está firmado con el secreto que sólo tienen ellos y
nosotros, o no se mira nada más: no se consulta la cuenta de ningún vendedor,
no se toca una fila y no se aprende nada del cuerpo.

Cómo firma Mercado Pago, textual:

    x-signature: ts=<segundos>,v1=<hmac sha256 en hexadecimal>

y lo firmado es una cadena armada con tres cosas que viajan **fuera** del
cuerpo —el `data.id` de la URL, el `x-request-id` y el propio `ts`—:

    id:<data.id>;request-id:<x-request-id>;ts:<ts>;

Que el cuerpo no entre en la firma es la razón por la que el cuerpo, acá, sólo
sirve para saber a quién preguntarle. Lo que pasó lo dice Mercado Pago cuando
se le consulta el pago, no el JSON que llegó.

Tres decisiones que valen la pena decir en voz alta:

1. **La comparación es de tiempo constante.** Comparar hashes con `==` filtra,
   byte a byte, cuánto acertó quien está probando.
2. **El `ts` tiene tolerancia y se comprueba.** Sin eso, un aviso legítimo
   capturado una vez sirve para siempre.
3. **Sin secreto no se valida nada.** No hay modo permisivo, ni siquiera para
   desarrollo: un webhook que acepta sin firma es un endpoint por el que
   cualquiera declara pagos ajenos.
"""
from __future__ import annotations

import hashlib
import hmac
import time
from typing import Optional

# Motivos de rechazo. Códigos nuestros: al que llama le sirven para responder y
# para registrar, y ninguno cuenta de más a quien está probando.
SIN_SECRETO = "sin_secreto"
SIN_FIRMA = "sin_firma"
FIRMA_MAL_FORMADA = "firma_mal_formada"
FIRMA_VENCIDA = "firma_vencida"
FIRMA_INCORRECTA = "firma_incorrecta"
SIN_DATO = "sin_dato"


class FirmaInvalida(Exception):
    """El aviso no se pudo autenticar. Trae un motivo, no un detalle."""

    def __init__(self, motivo: str):
        super().__init__(motivo)
        self.motivo = motivo


def _partes(x_signature: str) -> dict:
    """`ts=...,v1=...` a diccionario, tolerando espacios y orden."""
    partes = {}
    for trozo in x_signature.split(","):
        clave, separador, valor = trozo.partition("=")
        if not separador:
            continue
        partes[clave.strip()] = valor.strip()
    return partes


def _segundos(ts: str) -> int:
    """El `ts` de la firma, en segundos.

    Mercado Pago lo manda en segundos. Algunas cuentas lo mandan en
    milisegundos, y tomar eso como segundos daría una fecha del año 55.000 y
    un rechazo por «vencida» que no tiene nada que ver con lo que pasó.
    """
    numero = int(ts)
    return numero // 1000 if numero > 10_000_000_000 else numero


def manifiesto(data_id: str, request_id: Optional[str], ts: str) -> str:
    """La cadena que Mercado Pago firmó.

    Los campos que no vinieron **se omiten enteros**, con su etiqueta: así lo
    arma Mercado Pago, y agregar un `request-id:;` vacío daría otro hash.

    El `data.id` alfanumérico va en minúsculas, también por definición de
    ellos.
    """
    identificador = data_id.lower() if not data_id.isdigit() else data_id
    partes = [f"id:{identificador};"]
    if request_id:
        partes.append(f"request-id:{request_id};")
    partes.append(f"ts:{ts};")
    return "".join(partes)


def validar(
    x_signature: Optional[str],
    x_request_id: Optional[str],
    data_id: Optional[str],
    secreto: str,
    tolerancia_segundos: int,
    ahora: Optional[float] = None,
) -> None:
    """Autentica el aviso o levanta `FirmaInvalida`. No devuelve nada.

    Que no devuelva un booleano es a propósito: un `if` olvidado sobre un
    booleano deja pasar todo, y esto es lo único que hay entre la base y
    cualquiera con la URL.
    """
    if not secreto:
        raise FirmaInvalida(SIN_SECRETO)
    if not data_id:
        raise FirmaInvalida(SIN_DATO)
    if not x_signature:
        raise FirmaInvalida(SIN_FIRMA)

    partes = _partes(x_signature)
    ts = partes.get("ts")
    recibida = partes.get("v1")
    if not ts or not recibida:
        raise FirmaInvalida(FIRMA_MAL_FORMADA)

    try:
        emitida_en = _segundos(ts)
    except (TypeError, ValueError):
        raise FirmaInvalida(FIRMA_MAL_FORMADA) from None

    momento = time.time() if ahora is None else ahora
    if abs(momento - emitida_en) > tolerancia_segundos:
        # Vale para los dos lados: un aviso viejo reenviado y uno fechado en el
        # futuro son igual de poco confiables.
        raise FirmaInvalida(FIRMA_VENCIDA)

    esperada = hmac.new(
        secreto.encode("utf-8"),
        manifiesto(data_id, x_request_id, ts).encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(esperada, recibida):
        raise FirmaInvalida(FIRMA_INCORRECTA)
