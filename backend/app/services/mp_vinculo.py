"""Vínculo OAuth entre un vendedor y su cuenta de Mercado Pago.

Acá vive **toda** la regla del vínculo: cómo se abre, cómo se valida la vuelta,
cómo se guarda, cómo se renueva y cómo se corta. La API de arriba traduce a
HTTP y no decide nada.

Lo que este módulo protege, en una línea: que la cuenta donde cae la plata de
una venta sea la que ese vendedor eligió, y que las credenciales con las que se
cobra no queden legibles para nadie —ni para nosotros— en la base, en una
respuesta, en una URL ni en un log.

Tres reglas que no se negocian:

1. **Falla cerrado.** Ante cualquier duda —state raro, respuesta rara, clave
   que no abre— no se vincula y no se pisa lo que había.
2. **Ningún secreto sale.** Ni token, ni `client_secret`, ni el cuerpo crudo de
   un error de Mercado Pago. Al navegador van códigos de un enum nuestro.
3. **Una cuenta de Mercado Pago, un vendedor.** Si dos cuentas de TopGreen
   pudieran cobrar en la misma cuenta de MP, «quién cobra» dejaría de tener
   respuesta única.

TopGreen no recibe ni redistribuye fondos: el vendedor cobra directo en su
cuenta. Este módulo no crea preferencias, no toca importes y no sabe de
comisiones.
"""
from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urlencode

import httpx
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.core.cifrado import (
    NoSeDescifra,
    SinClaveDeCifrado,
    cifrar,
    descifrar,
    hay_clave,
)
from app.core.config import settings
from app.models.mp_oauth_state import MPOAuthState
from app.models.user import User

logger = logging.getLogger(__name__)

# --- Estados que ve el vendedor. Son tres y no hay un cuarto: cualquier cosa
#     rara del mundo real tiene que caer en uno de estos.
NO_CONFIGURADO = "no_configurado"      # la plataforma todavía no tiene credenciales
DESCONECTADO = "desconectado"          # el vendedor no vinculó su cuenta
CONECTADO = "conectado"                # vinculado y con credenciales usables
REQUIERE_RECONEXION = "requiere_reconexion"  # vinculado pero hay que rehacerlo

# Lo que se le dice al navegador cuando salió bien. Del otro lado lo espera
# `src/utils/mercadoPago.ts`; que sea una constante y no un literal suelto es
# lo que hace que cambiarlo se note en los dos lados.
VINCULADO = "vinculado"

# --- Motivos de falla. Viajan al navegador como código, nunca como texto de MP.
CANCELADO = "cancelado"
ESTADO_INVALIDO = "estado_invalido"
SIN_SESION = "sin_sesion"
SESION_DISTINTA = "sesion_distinta"
CUENTA_EN_USO = "cuenta_en_uso"
MP_RECHAZO = "mp_rechazo"
MP_SIN_RESPUESTA = "mp_sin_respuesta"
RESPUESTA_INVALIDA = "respuesta_invalida"
SIN_CONFIGURAR = "sin_configurar"
# Lo guardado no abre con la clave vigente. No es culpa de Mercado Pago y no
# conviene decir que lo es: el motivo es nuestro y la salida también.
CREDENCIAL_ILEGIBLE = "credencial_ilegible"

# El state vale poco tiempo: es el que tarda una persona en autorizar, no el
# que tarda alguien en encontrarlo en un historial.
MINUTOS_DE_ESTADO = 15
# Lo que dura un access_token de MP si no lo dicen: 180 días.
SEGUNDOS_POR_DEFECTO = 15_552_000
# Con menos de esto por delante, conviene renovar antes de que sea urgente.
DIAS_DE_MARGEN = 7
SEGUNDOS_DE_ESPERA = 10.0


# ============================ configuración ============================

def integracion_configurada() -> bool:
    """Las credenciales de la aplicación y la clave de cifrado, todas.

    Sin clave de cifrado la integración cuenta como no configurada a propósito:
    poder vincular pero no poder guardar en condiciones sería peor que no
    poder vincular.
    """
    return bool(
        settings.MP_APP_ID
        and settings.MP_CLIENT_SECRET
        and settings.MP_REDIRECT_URI
        and hay_clave()
    )


# ============================== estado ==============================

def credencial_legible(user: User) -> bool:
    """¿Lo guardado abre con la clave vigente?

    Se comprueba de verdad, descifrando. Si la clave se rotó sin migrar lo
    guardado, la credencial ya no sirve, y decirle «conectado» al vendedor
    sería mentirle hasta que una venta falle. Descifrar dos textos cortos por
    consulta de estado es barato; enterarse tarde, no.
    """
    if not user.mp_access_token_cifrado or not user.mp_refresh_token_cifrado:
        return False
    try:
        descifrar(user.mp_access_token_cifrado)
        descifrar(user.mp_refresh_token_cifrado)
    except (NoSeDescifra, SinClaveDeCifrado):
        return False
    return True


def estado_de(user: User) -> str:
    """El estado del vendedor, resuelto en un solo lugar."""
    if not integracion_configurada():
        return NO_CONFIGURADO
    if not user.mp_user_id:
        return DESCONECTADO
    if user.mp_requiere_reconexion:
        return REQUIERE_RECONEXION
    if not credencial_legible(user):
        # Vínculo a medias: hay cuenta pero no hay credencial usable.
        return REQUIERE_RECONEXION
    if user.mp_token_expires_at and user.mp_token_expires_at <= datetime.utcnow():
        return REQUIERE_RECONEXION
    return CONECTADO


def conviene_renovar(user: User) -> bool:
    """¿Le queda poco al token? No es un estado: es una sugerencia de acción."""
    if estado_de(user) != CONECTADO or not user.mp_token_expires_at:
        return False
    return user.mp_token_expires_at <= datetime.utcnow() + timedelta(
        days=DIAS_DE_MARGEN
    )


# =========================== state de OAuth ===========================

def _huella(state: str) -> str:
    return hashlib.sha256(state.encode("utf-8")).hexdigest()


def crear_estado(db: Session, user: User) -> str:
    """Abre un intento de vinculación y devuelve el state que viaja en la URL.

    Los intentos anteriores del mismo vendedor que hayan quedado sin usar se
    borran: hay un intento vivo por persona, y el último es el que vale. Si
    alguien dejó una pestaña abierta hace media hora, esa pestaña ya no
    vincula.
    """
    ahora = datetime.utcnow()

    db.query(MPOAuthState).filter(
        MPOAuthState.user_id == user.id,
        MPOAuthState.usado_el.is_(None),
    ).delete(synchronize_session=False)
    # Barrido barato de lo vencido de todos, para que la tabla no crezca sola.
    db.query(MPOAuthState).filter(MPOAuthState.expira_el < ahora).delete(
        synchronize_session=False
    )

    state = secrets.token_urlsafe(32)
    db.add(
        MPOAuthState(
            user_id=user.id,
            state_hash=_huella(state),
            creado_el=ahora,
            expira_el=ahora + timedelta(minutes=MINUTOS_DE_ESTADO),
        )
    )
    db.commit()
    return state


def consumir_estado(db: Session, state: Optional[str]) -> Optional[str]:
    """Gasta el state y devuelve de quién era. `None` si no sirve.

    El sellado y la lectura son **una sola sentencia**: dos callbacks que
    lleguen juntos con el mismo state compiten por el mismo `UPDATE`, y la
    base deja pasar uno. Leer primero y sellar después dejaría una ventana
    donde los dos vinculan.
    """
    if not state:
        return None
    ahora = datetime.utcnow()
    fila = db.execute(
        update(MPOAuthState)
        .where(
            MPOAuthState.state_hash == _huella(state),
            MPOAuthState.usado_el.is_(None),
            MPOAuthState.expira_el > ahora,
        )
        .values(usado_el=ahora)
        .returning(MPOAuthState.user_id)
    ).first()
    db.commit()
    return fila[0] if fila else None


def url_de_autorizacion(state: str) -> str:
    """La URL a la que mandamos al vendedor para que autorice."""
    parametros = urlencode(
        {
            "client_id": settings.MP_APP_ID,
            "response_type": "code",
            "platform_id": "mp",
            "state": state,
            "redirect_uri": settings.MP_REDIRECT_URI,
        }
    )
    return f"{settings.MP_AUTH_BASE_URL.rstrip('/')}/authorization?{parametros}"


# ====================== conversación con Mercado Pago ======================

class FalloDeMercadoPago(Exception):
    """Mercado Pago no dio lo que hacía falta. Trae un código, no un cuerpo."""

    def __init__(self, motivo: str):
        super().__init__(motivo)
        self.motivo = motivo


async def _pedir_tokens(datos: dict) -> dict:
    """Habla con el endpoint de tokens y devuelve algo utilizable, o falla.

    Nunca registra ni propaga el cuerpo de la respuesta: ahí adentro hay
    tokens cuando sale bien, y detalles del `client_secret` cuando sale mal.
    """
    url = f"{settings.MP_API_BASE_URL.rstrip('/')}/oauth/token"
    try:
        async with httpx.AsyncClient(timeout=SEGUNDOS_DE_ESPERA) as cliente:
            respuesta = await cliente.post(url, data=datos)
    except httpx.HTTPError as error:
        logger.warning("Mercado Pago no respondió: %s", type(error).__name__)
        raise FalloDeMercadoPago(MP_SIN_RESPUESTA) from error

    if respuesta.status_code != 200:
        logger.warning(
            "Mercado Pago rechazó el pedido de tokens (HTTP %s)",
            respuesta.status_code,
        )
        raise FalloDeMercadoPago(MP_RECHAZO)

    try:
        cuerpo = respuesta.json()
    except ValueError as error:
        logger.warning("Mercado Pago devolvió algo que no es JSON")
        raise FalloDeMercadoPago(RESPUESTA_INVALIDA) from error

    if not isinstance(cuerpo, dict):
        raise FalloDeMercadoPago(RESPUESTA_INVALIDA)

    faltan = [
        campo
        for campo in ("access_token", "refresh_token", "user_id")
        if not cuerpo.get(campo)
    ]
    if faltan:
        # Se nombran los campos que faltan, no los que vinieron.
        logger.warning("Respuesta de Mercado Pago incompleta: faltan %s", faltan)
        raise FalloDeMercadoPago(RESPUESTA_INVALIDA)

    return cuerpo


async def intercambiar_codigo(code: str) -> dict:
    return await _pedir_tokens(
        {
            "client_id": settings.MP_APP_ID,
            "client_secret": settings.MP_CLIENT_SECRET,
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": settings.MP_REDIRECT_URI,
        }
    )


async def renovar_con(refresh_token: str) -> dict:
    return await _pedir_tokens(
        {
            "client_id": settings.MP_APP_ID,
            "client_secret": settings.MP_CLIENT_SECRET,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        }
    )


# ========================= guardar y borrar =========================

def _vencimiento(cuerpo: dict) -> datetime:
    try:
        segundos = int(cuerpo.get("expires_in") or SEGUNDOS_POR_DEFECTO)
    except (TypeError, ValueError):
        segundos = SEGUNDOS_POR_DEFECTO
    if segundos <= 0:
        segundos = SEGUNDOS_POR_DEFECTO
    return datetime.utcnow() + timedelta(seconds=segundos)


def cuenta_tomada_por_otro(db: Session, mp_user_id: str, user_id: str) -> bool:
    """¿Esa cuenta de Mercado Pago ya cobra para otro vendedor de TopGreen?"""
    return (
        db.query(User.id)
        .filter(User.mp_user_id == mp_user_id, User.id != user_id)
        .first()
        is not None
    )


def guardar_credenciales(db: Session, user: User, cuerpo: dict) -> None:
    """Escribe el vínculo completo. Cifrado, y todo junto o nada.

    Rotar es reemplazar los dos tokens y el vencimiento en la misma
    transacción. Si se guardara el access nuevo con el refresh viejo, la
    próxima renovación fallaría y el vendedor quedaría sin cobrar sin
    entender por qué.
    """
    user.mp_user_id = str(cuerpo["user_id"])
    user.mp_access_token_cifrado = cifrar(str(cuerpo["access_token"]))
    user.mp_refresh_token_cifrado = cifrar(str(cuerpo["refresh_token"]))
    user.mp_token_expires_at = _vencimiento(cuerpo)
    user.mp_requiere_reconexion = False
    if not user.mp_linked_at:
        user.mp_linked_at = datetime.utcnow()
    db.commit()


def borrar_credenciales(db: Session, user: User) -> None:
    """Desvincular es borrar, no marcar. No queda nada local de esa cuenta."""
    user.mp_user_id = None
    user.mp_access_token_cifrado = None
    user.mp_refresh_token_cifrado = None
    user.mp_token_expires_at = None
    user.mp_linked_at = None
    user.mp_requiere_reconexion = False
    db.query(MPOAuthState).filter(MPOAuthState.user_id == user.id).delete(
        synchronize_session=False
    )
    db.commit()


def marcar_reconexion(db: Session, user: User) -> None:
    """Lo guardado dejó de servir: se apaga el vínculo sin borrar la cuenta.

    No se borran las credenciales viejas por prolijidad —ya no abren o ya no
    valen—, sino porque el vendedor tiene que ver *qué* cuenta era para saber
    que la está reconectando y no vinculando otra.
    """
    user.mp_requiere_reconexion = True
    db.commit()


def refresh_token_de(db: Session, user: User) -> Optional[str]:
    """Devuelve el refresh en claro para usarlo ya, o `None` si no se puede.

    Si no abre, el vínculo pasa a «reconectar» en el acto: una credencial que
    no podemos leer es una credencial que no tenemos.
    """
    if not user.mp_refresh_token_cifrado:
        return None
    try:
        return descifrar(user.mp_refresh_token_cifrado)
    except NoSeDescifra:
        logger.warning(
            "Credencial de Mercado Pago ilegible para el usuario %s", user.id
        )
        marcar_reconexion(db, user)
        return None
