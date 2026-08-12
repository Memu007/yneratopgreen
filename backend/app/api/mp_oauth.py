"""Vínculo del vendedor con su cuenta de Mercado Pago (OAuth).

Esta pieza hace **una** cosa: conectar, ver, renovar y desconectar la cuenta
donde el vendedor va a cobrar. No crea pagos, no crea preferencias, no toca
órdenes ni stock. Eso es la pieza siguiente.

La regla del vínculo vive en `app/services/mp_vinculo.py`. Acá sólo se traduce
a HTTP: qué código sale, qué se le muestra a la persona y a dónde vuelve el
navegador. Ningún endpoint devuelve un token, ni un pedazo, ni el texto crudo
de un error de Mercado Pago.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.cifrado import SinClaveDeCifrado
from app.core.config import settings
from app.core.dependencies import get_current_user, get_current_user_optional
from app.db.base import get_db
from app.models.user import User
from app.services import mp_vinculo

router = APIRouter(prefix="/mp-oauth", tags=["mercadopago-oauth"])


# ============================== esquemas ==============================

class EstadoDelVinculo(BaseModel):
    """Lo único que el navegador necesita saber, y nada más que eso."""

    estado: str  # no_configurado | desconectado | conectado | requiere_reconexion
    mp_user_id: Optional[str] = None
    vinculado_el: Optional[datetime] = None
    expira_el: Optional[datetime] = None
    conviene_renovar: bool = False
    # Por qué falló la última acción, como código de nuestro enum. Nunca es
    # texto de Mercado Pago.
    motivo: Optional[str] = None


class InicioDeVinculo(BaseModel):
    auth_url: str


def _estado(user: User, motivo: Optional[str] = None) -> EstadoDelVinculo:
    situacion = mp_vinculo.estado_de(user)
    vinculado = situacion in (mp_vinculo.CONECTADO, mp_vinculo.REQUIERE_RECONEXION)
    return EstadoDelVinculo(
        estado=situacion,
        mp_user_id=user.mp_user_id if vinculado else None,
        vinculado_el=user.mp_linked_at if vinculado else None,
        expira_el=user.mp_token_expires_at if situacion == mp_vinculo.CONECTADO else None,
        conviene_renovar=mp_vinculo.conviene_renovar(user),
        motivo=motivo,
    )


def _volver(codigo: str, ok: bool = False) -> RedirectResponse:
    """Devuelve al vendedor a la aplicación con un código, nunca con un detalle."""
    base = (settings.FRONTEND_URL or "http://localhost:5173").rstrip("/")
    parametro = "mp" if ok else "mp_error"
    return RedirectResponse(url=f"{base}/?{parametro}={codigo}", status_code=302)


# ============================== endpoints ==============================

@router.get("/status", response_model=EstadoDelVinculo)
def estado_del_vinculo(current_user: User = Depends(get_current_user)):
    """El estado del vínculo del vendedor que pregunta.

    Si la plataforma todavía no tiene credenciales, esto responde
    `no_configurado` y listo: es una respuesta, no una falla. El resto del
    marketplace no se entera.
    """
    return _estado(current_user)


@router.post("/auth-url", response_model=InicioDeVinculo)
def iniciar_vinculo(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Abre un intento de vinculación y devuelve la URL de autorización.

    Es POST y no GET porque deja una fila: el `state` que después va a validar
    la vuelta. Cada llamada invalida el intento anterior de esa persona.
    """
    if not mp_vinculo.integracion_configurada():
        raise HTTPException(
            status_code=503,
            detail=(
                "La integración con Mercado Pago no está configurada. "
                "Escribinos y la activamos."
            ),
        )

    state = mp_vinculo.crear_estado(db, current_user)
    return InicioDeVinculo(auth_url=mp_vinculo.url_de_autorizacion(state))


@router.get("/callback")
async def volver_de_mercado_pago(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db),
    posible_usuario: Optional[User] = Depends(get_current_user_optional),
):
    """La vuelta de Mercado Pago después de que el vendedor autoriza.

    Tres cosas tienen que dar bien antes de escribir nada: que el `state` sea
    uno nuestro, vivo y sin usar; que la sesión del navegador sea la misma que
    lo pidió; y que la cuenta de Mercado Pago no esté ya cobrando para otro
    vendedor. Si falla cualquiera, no se toca la base.
    """
    if error:
        # El vendedor dijo que no, o MP abortó. Su texto no se muestra.
        return _volver(mp_vinculo.CANCELADO)

    if not mp_vinculo.integracion_configurada():
        return _volver(mp_vinculo.SIN_CONFIGURAR)

    if not code:
        return _volver(mp_vinculo.ESTADO_INVALIDO)

    # Se gasta el state antes que nada: un callback repetido ya no encuentra
    # nada que gastar, aunque todo lo demás esté bien.
    user_id = mp_vinculo.consumir_estado(db, state)
    if not user_id:
        return _volver(mp_vinculo.ESTADO_INVALIDO)

    if posible_usuario is None:
        return _volver(mp_vinculo.SIN_SESION)
    if posible_usuario.id != user_id:
        # El state era de otra persona. Puede ser una pestaña vieja o puede
        # ser alguien pegando su callback en la sesión ajena; para el caso, lo
        # mismo.
        return _volver(mp_vinculo.SESION_DISTINTA)

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return _volver(mp_vinculo.ESTADO_INVALIDO)

    try:
        cuerpo = await mp_vinculo.intercambiar_codigo(code)
    except mp_vinculo.FalloDeMercadoPago as fallo:
        return _volver(fallo.motivo)

    mp_user_id = str(cuerpo["user_id"])
    if mp_vinculo.cuenta_tomada_por_otro(db, mp_user_id, user.id):
        return _volver(mp_vinculo.CUENTA_EN_USO)

    try:
        mp_vinculo.guardar_credenciales(db, user, cuerpo)
    except SinClaveDeCifrado:
        # Nunca guardamos en claro para «salir del paso».
        db.rollback()
        return _volver(mp_vinculo.SIN_CONFIGURAR)
    except IntegrityError:
        # Otro vendedor vinculó esa misma cuenta entre la consulta y el
        # commit. El índice único es el que decide, no la consulta.
        db.rollback()
        return _volver(mp_vinculo.CUENTA_EN_USO)

    return _volver(mp_vinculo.VINCULADO, ok=True)


@router.post("/refresh", response_model=EstadoDelVinculo)
async def renovar_vinculo(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Renueva las credenciales rotando las dos a la vez.

    Nunca devuelve un 500: cualquier falla deja el vínculo en «reconectar»,
    que es algo que el vendedor puede resolver solo.
    """
    if not mp_vinculo.integracion_configurada():
        return _estado(current_user, motivo=mp_vinculo.SIN_CONFIGURAR)

    if mp_vinculo.estado_de(current_user) == mp_vinculo.DESCONECTADO:
        return _estado(current_user, motivo=mp_vinculo.ESTADO_INVALIDO)

    refresh = mp_vinculo.refresh_token_de(db, current_user)
    if not refresh:
        # Ilegible o ausente: `refresh_token_de` ya dejó el vínculo en
        # «reconectar». El motivo es nuestro, no de Mercado Pago.
        return _estado(current_user, motivo=mp_vinculo.CREDENCIAL_ILEGIBLE)

    try:
        cuerpo = await mp_vinculo.renovar_con(refresh)
    except mp_vinculo.FalloDeMercadoPago as fallo:
        # Token revocado por el vendedor desde su cuenta, o MP caído. En los
        # dos casos lo honesto es pedir reconexión y no reintentar solos.
        mp_vinculo.marcar_reconexion(db, current_user)
        return _estado(current_user, motivo=fallo.motivo)

    if str(cuerpo["user_id"]) != (current_user.mp_user_id or ""):
        # La renovación devolvió otra cuenta. No se pisa un vínculo con algo
        # que no es lo que el vendedor autorizó.
        mp_vinculo.marcar_reconexion(db, current_user)
        return _estado(current_user, motivo=mp_vinculo.RESPUESTA_INVALIDA)

    try:
        mp_vinculo.guardar_credenciales(db, current_user, cuerpo)
    except SinClaveDeCifrado:
        db.rollback()
        mp_vinculo.marcar_reconexion(db, current_user)
        return _estado(current_user, motivo=mp_vinculo.SIN_CONFIGURAR)

    return _estado(current_user)


@router.post("/unlink", response_model=EstadoDelVinculo)
def desvincular(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Borra el vínculo local. Es idempotente: desvincular dos veces no falla.

    Ojo con lo que **no** hace: no le revoca el permiso a la aplicación del
    lado de Mercado Pago. Eso lo hace el vendedor desde su cuenta, y la
    pantalla se lo dice.
    """
    mp_vinculo.borrar_credenciales(db, current_user)
    return _estado(current_user)
