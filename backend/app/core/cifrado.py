"""Cifrado en reposo de credenciales de terceros.

Los tokens de Mercado Pago no son nuestros: son la llave con la que un vendedor
cobra en su propia cuenta. Un volcado de la base, un backup mal guardado o un
`SELECT` de más no pueden alcanzar para usarlos. Por eso no se guardan como
texto, se guardan cifrados, y la clave vive fuera del repositorio.

Fernet (AES-128-CBC + HMAC-SHA256, de `cryptography`) es lo que ya está
instalado en el proyecto y alcanza de sobra: cifra, autentica y trae la marca
de tiempo puesta. No inventamos criptografía propia.

Todo acá **falla cerrado**. Sin clave no se cifra ni se descifra; con la clave
equivocada tampoco. La capa de arriba traduce esa falla a «reconectá», nunca a
un 500 opaco ni —peor— a seguir de largo con el token en claro.
"""
from __future__ import annotations

from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


class SinClaveDeCifrado(RuntimeError):
    """No hay clave configurada, o la que hay no es una clave Fernet válida."""


class NoSeDescifra(RuntimeError):
    """El texto guardado no abre con la clave vigente.

    Pasa si rotaron la clave sin migrar lo guardado, o si alguien tocó la
    columna. En los dos casos la credencial dejó de servir y hay que
    revincular: no hay forma de recuperarla y no queremos que la haya.
    """


def hay_clave() -> bool:
    """¿Hay clave y sirve? Sin esto la integración no se ofrece.

    No alcanza con que la variable esté escrita: una cadena cualquiera no es
    una clave Fernet. Si sólo se mirara que no está vacía, la integración se
    ofrecería como configurada y reventaría más adelante, en el momento de
    guardar o de leer una credencial de un tercero. Se comprueba acá, una vez,
    y todo lo de arriba puede confiar.
    """
    if not settings.MP_TOKEN_KEY:
        return False
    try:
        _motor(settings.MP_TOKEN_KEY)
    except SinClaveDeCifrado:
        return False
    return True


@lru_cache(maxsize=2)
def _motor(clave: str) -> Fernet:
    try:
        return Fernet(clave.encode("utf-8"))
    except (ValueError, TypeError) as error:
        # El mensaje no incluye la clave ni un pedazo: es un secreto.
        raise SinClaveDeCifrado(
            "MP_TOKEN_KEY no es una clave Fernet válida. Se genera con "
            "`Fernet.generate_key()` y se guarda fuera del repositorio."
        ) from error


def _clave() -> Fernet:
    if not hay_clave():
        raise SinClaveDeCifrado(
            "Falta MP_TOKEN_KEY. Sin clave no se guardan credenciales de "
            "terceros."
        )
    return _motor(settings.MP_TOKEN_KEY)


def cifrar(texto: str) -> str:
    """Devuelve el texto cifrado, listo para guardar en una columna de texto."""
    if not texto:
        raise ValueError("No se cifra una credencial vacía")
    return _clave().encrypt(texto.encode("utf-8")).decode("ascii")


def descifrar(guardado: str) -> str:
    """Devuelve el texto original. Si no abre, `NoSeDescifra`. Sin excepciones."""
    if not guardado:
        raise NoSeDescifra("No hay nada guardado para descifrar")
    try:
        return _clave().decrypt(guardado.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError, UnicodeDecodeError) as error:
        raise NoSeDescifra(
            "La credencial guardada no abre con la clave vigente"
        ) from error
