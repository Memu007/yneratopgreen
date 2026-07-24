"""
API Router para OAuth de Mercado Pago - Vinculación de vendedores

Flujo OAuth:
1. GET /mp-oauth/auth-url - Genera URL para que el vendedor autorice la app
2. GET /mp-oauth/callback - MP redirige aquí después de autorizar
3. GET /mp-oauth/status - Estado de vinculación del usuario actual
4. POST /mp-oauth/unlink - Desvincular cuenta MP

Documentación: https://www.mercadopago.com.ar/developers/es/docs/split-payments/integration-configuration/integrate-marketplace
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import Optional
import logging
import httpx

from app.db.base import get_db
from app.models.user import User
from app.core.dependencies import get_current_user
from app.core.config import settings
from app.core.security import create_oauth_state_token, decode_oauth_state_token

router = APIRouter(prefix="/mp-oauth", tags=["mercadopago-oauth"])
logger = logging.getLogger(__name__)

# URLs de OAuth de Mercado Pago Argentina
MP_AUTH_URL = "https://auth.mercadopago.com.ar/authorization"
MP_TOKEN_URL = "https://api.mercadopago.com/oauth/token"


# ============== SCHEMAS ==============

class MPLinkStatusResponse(BaseModel):
    """Estado de vinculación con MercadoPago"""
    is_linked: bool
    mp_user_id: Optional[str] = None
    linked_at: Optional[datetime] = None
    token_expires_at: Optional[datetime] = None
    needs_refresh: bool = False


class AuthUrlResponse(BaseModel):
    """URL para iniciar OAuth"""
    auth_url: str


class UnlinkResponse(BaseModel):
    """Respuesta al desvincular"""
    success: bool
    message: str


class ManualLinkRequest(BaseModel):
    """Request para vincular manualmente (testing/desarrollo)"""
    mp_access_token: str
    mp_user_id: Optional[str] = None


class ManualLinkResponse(BaseModel):
    """Respuesta de vinculación manual"""
    success: bool
    message: str
    mp_user_id: Optional[str] = None


# ============== ENDPOINTS ==============

@router.post("/manual-link", response_model=ManualLinkResponse)
async def manual_link_mp_account(
    request: ManualLinkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Vincular manualmente una cuenta de MercadoPago (para testing/desarrollo).
    
    Esto permite probar Split Payments sin necesidad de OAuth completo.
    En producción, se debería usar el flujo OAuth estándar.
    
    Pasos para obtener el access_token de prueba:
    1. Crear cuenta de prueba tipo "Vendedor" en MP
    2. Copiar el access_token generado
    3. Llamar a este endpoint con ese token
    """
    try:
        # Verificar que el token es válido consultando la API de MP
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.mercadopago.com/users/me",
                headers={"Authorization": f"Bearer {request.mp_access_token}"}
            )
            
            if response.status_code != 200:
                logger.error(f"Token inválido: {response.text}")
                raise HTTPException(
                    status_code=400, 
                    detail="El access_token proporcionado no es válido"
                )
            
            mp_user_data = response.json()
            mp_user_id = str(mp_user_data.get("id"))
            
            # Guardar en el usuario
            current_user.mp_user_id = mp_user_id
            current_user.mp_access_token = request.mp_access_token
            current_user.mp_refresh_token = None  # No hay refresh en vinculación manual
            current_user.mp_token_expires_at = datetime.utcnow() + timedelta(days=180)  # Asumimos 180 días
            current_user.mp_linked_at = datetime.utcnow()
            
            db.commit()
            
            logger.info(f"✅ Usuario {current_user.email} vinculó MANUALMENTE su cuenta MP (mp_user_id: {mp_user_id})")
            
            return ManualLinkResponse(
                success=True,
                message=f"Cuenta vinculada exitosamente. MP User ID: {mp_user_id}",
                mp_user_id=mp_user_id
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error en vinculación manual: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al vincular cuenta: {str(e)}")


@router.get("/auth-url", response_model=AuthUrlResponse)
async def get_auth_url(
    current_user: User = Depends(get_current_user)
):
    """
    Genera la URL para que el vendedor autorice al marketplace.
    
    El vendedor debe visitar esta URL y autorizar a TopGreen
    para procesar pagos en su nombre.
    
    El state usa un token TG-xxx que:
    - Identifica al usuario de forma segura
    - Tiene expiración (30 min)
    - Es verificable con firma JWT
    """
    if not settings.MP_APP_ID or not settings.MP_REDIRECT_URI:
        raise HTTPException(
            status_code=503,
            detail=(
                "La integración con Mercado Pago no está configurada. "
                "El nuevo equipo técnico debe definir MP_APP_ID, MP_CLIENT_SECRET "
                "y MP_REDIRECT_URI en backend/.env. Ver docs/SETUP_PAYMENTS.md."
            ),
        )
    
    # Crear token TG-xxx seguro para el state
    # Esto permite identificar al usuario cuando MP redirige al callback,
    # incluso si hay múltiples usuarios autorizando al mismo tiempo
    state = create_oauth_state_token(current_user.id, expires_minutes=30)
    
    auth_url = (
        f"{MP_AUTH_URL}"
        f"?client_id={settings.MP_APP_ID}"
        f"&response_type=code"
        f"&platform_id=mp"
        f"&state={state}"
        f"&redirect_uri={settings.MP_REDIRECT_URI}"
    )
    
    logger.info(f"🔗 Generando URL de OAuth para usuario {current_user.email} (state: {state[:20]}...)")
    
    return AuthUrlResponse(auth_url=auth_url)


@router.get("/callback")
async def oauth_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Callback de MercadoPago después de la autorización OAuth.
    
    MP redirige aquí con:
    - code: Código de autorización para intercambiar por tokens
    - state: Token TG-xxx que identifica al usuario
    - error/error_description: Si el usuario canceló o hubo error
    """
    # Si hubo error
    if error:
        logger.error(f"❌ Error en OAuth: {error} - {error_description}")
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/dashboard?mp_error={error}",
            status_code=302
        )
    
    if not code or not state:
        logger.error("❌ Callback sin code o state")
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/dashboard?mp_error=missing_params",
            status_code=302
        )
    
    # Decodificar el token TG-xxx para obtener el user_id
    user_id = decode_oauth_state_token(state)
    if not user_id:
        logger.error(f"❌ Token TG inválido o expirado: {state[:30]}...")
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/dashboard?mp_error=invalid_state",
            status_code=302
        )
    
    # Buscar usuario por el user_id decodificado del token
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        logger.error(f"❌ Usuario no encontrado para user_id: {user_id}")
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/dashboard?mp_error=user_not_found",
            status_code=302
        )

    # La integración con MP se entrega desvinculada: si faltan credenciales,
    # redirigimos al dashboard con error. Ver docs/SETUP_PAYMENTS.md.
    if not settings.MP_APP_ID or not settings.MP_CLIENT_SECRET:
        logger.warning(
            "Callback de MP recibido pero la integración está desvinculada "
            "(MP_APP_ID/MP_CLIENT_SECRET vacíos)."
        )
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL or 'http://localhost:5173'}/dashboard?mp_error=mp_not_configured",
            status_code=302
        )

    # Intercambiar code por access_token
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                MP_TOKEN_URL,
                data={
                    "client_id": settings.MP_APP_ID,
                    "client_secret": settings.MP_CLIENT_SECRET,
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": settings.MP_REDIRECT_URI
                }
            )
            
            if response.status_code != 200:
                logger.error(f"❌ Error intercambiando code: {response.text}")
                return RedirectResponse(
                    url=f"{settings.FRONTEND_URL}/dashboard?mp_error=token_exchange_failed",
                    status_code=302
                )
            
            token_data = response.json()
            
            # Guardar tokens en el usuario
            user.mp_user_id = str(token_data.get("user_id"))
            user.mp_access_token = token_data.get("access_token")
            user.mp_refresh_token = token_data.get("refresh_token")
            
            # Calcular expiración (MP devuelve expires_in en segundos)
            expires_in = token_data.get("expires_in", 15552000)  # Default 180 días
            user.mp_token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
            user.mp_linked_at = datetime.utcnow()
            
            db.commit()
            
            logger.info(f"✅ Usuario {user.email} vinculó su cuenta MP (mp_user_id: {user.mp_user_id})")
            
            return RedirectResponse(
                url=f"{settings.FRONTEND_URL}/dashboard?mp_linked=success",
                status_code=302
            )
            
    except Exception as e:
        logger.error(f"❌ Excepción en OAuth callback: {str(e)}")
        db.rollback()
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/dashboard?mp_error=exception",
            status_code=302
        )


@router.get("/status", response_model=MPLinkStatusResponse)
async def get_link_status(
    current_user: User = Depends(get_current_user)
):
    """
    Verificar si el usuario actual tiene su cuenta MP vinculada.
    """
    is_linked = bool(current_user.mp_access_token and current_user.mp_user_id)
    
    needs_refresh = False
    if is_linked and current_user.mp_token_expires_at:
        # Necesita refresh si expira en menos de 7 días
        needs_refresh = current_user.mp_token_expires_at < datetime.utcnow() + timedelta(days=7)
    
    return MPLinkStatusResponse(
        is_linked=is_linked,
        mp_user_id=current_user.mp_user_id if is_linked else None,
        linked_at=current_user.mp_linked_at,
        token_expires_at=current_user.mp_token_expires_at,
        needs_refresh=needs_refresh
    )


@router.post("/unlink", response_model=UnlinkResponse)
async def unlink_mp_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Desvincular cuenta de MercadoPago del usuario.
    """
    if not current_user.mp_access_token:
        raise HTTPException(status_code=400, detail="No tienes cuenta MP vinculada")
    
    # Limpiar datos de MP
    current_user.mp_user_id = None
    current_user.mp_access_token = None
    current_user.mp_refresh_token = None
    current_user.mp_token_expires_at = None
    current_user.mp_linked_at = None
    
    db.commit()
    
    logger.info(f"🔓 Usuario {current_user.email} desvinculó su cuenta MP")
    
    return UnlinkResponse(success=True, message="Cuenta de MercadoPago desvinculada exitosamente")


@router.post("/refresh-token")
async def refresh_mp_token(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Renovar el access_token usando el refresh_token.
    Útil cuando el token está por expirar.
    """
    if not current_user.mp_refresh_token:
        raise HTTPException(status_code=400, detail="No hay refresh_token disponible")

    if not settings.MP_APP_ID or not settings.MP_CLIENT_SECRET:
        raise HTTPException(
            status_code=503,
            detail=(
                "La integración con Mercado Pago no está configurada. "
                "El nuevo equipo técnico debe definir MP_APP_ID y MP_CLIENT_SECRET "
                "en backend/.env. Ver docs/SETUP_PAYMENTS.md."
            ),
        )

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                MP_TOKEN_URL,
                data={
                    "client_id": settings.MP_APP_ID,
                    "client_secret": settings.MP_CLIENT_SECRET,
                    "grant_type": "refresh_token",
                    "refresh_token": current_user.mp_refresh_token
                }
            )
            
            if response.status_code != 200:
                logger.error(f"❌ Error renovando token: {response.text}")
                raise HTTPException(status_code=400, detail="Error renovando token de MercadoPago")
            
            token_data = response.json()
            
            # Actualizar tokens
            current_user.mp_access_token = token_data.get("access_token")
            current_user.mp_refresh_token = token_data.get("refresh_token")
            
            expires_in = token_data.get("expires_in", 15552000)
            current_user.mp_token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
            
            db.commit()
            
            logger.info(f"🔄 Token renovado para usuario {current_user.email}")
            
            return {"success": True, "message": "Token renovado exitosamente"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Excepción renovando token: {str(e)}")
        raise HTTPException(status_code=500, detail="Error interno renovando token")
