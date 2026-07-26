"""
API Router para integración con Mercado Pago

Flujo completo de pago:
1. POST /payments/create-preference - Crea preferencia de pago en MP
2. Frontend redirige al usuario al init_point de MP
3. Usuario paga en MP
4. POST /payments/webhook - MP notifica resultado del pago
5. Frontend consulta GET /payments/order/{order_id}/status

Comisión: 5% para TopGreen, 95% para el vendedor
"""
import os
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
import logging

import mercadopago

from app.db.base import get_db
from app.models.order import Order, OrderStatus, OrderItem
from app.models.product import Product
from app.models.payment import Payment, PaymentStatus
from app.models.user import User
from app.core.dependencies import get_current_user
from app.core.config import settings
from app.api.notifications import notify_payment_approved

router = APIRouter(prefix="/payments", tags=["payments"])
logger = logging.getLogger(__name__)


# ============== MERCADO PAGO - HELPERS DE CONFIGURACIÓN ==============
#
# La integración con Mercado Pago se entrega DESVINCULADA. Si las
# credenciales (MP_ACCESS_TOKEN, MP_APP_ID, etc.) no están configuradas,
# todos los endpoints devuelven HTTP 503 con un mensaje claro en lugar de
# romper el arranque del backend. Ver docs/SETUP_PAYMENTS.md.
# ====================================================================

def _mp_is_configured() -> bool:
    """True si hay un access token del marketplace cargado en el .env."""
    return bool(getattr(settings, "MP_ACCESS_TOKEN", "") or "")


def _require_mp_configured() -> None:
    """Levanta 503 si la integración de MP no está configurada."""
    if not _mp_is_configured():
        raise HTTPException(
            status_code=503,
            detail=(
                "La integración con Mercado Pago no está configurada. "
                "El nuevo equipo técnico debe definir MP_ACCESS_TOKEN, "
                "MP_APP_ID, MP_CLIENT_SECRET, MP_PUBLIC_KEY y MP_REDIRECT_URI "
                "en backend/.env. Ver docs/SETUP_PAYMENTS.md."
            ),
        )


def _get_marketplace_sdk():
    """Devuelve un SDK del marketplace (TopGreen). Levanta 503 si falta el token."""
    _require_mp_configured()
    return mercadopago.SDK(settings.MP_ACCESS_TOKEN)


# ============== SCHEMAS ==============

class CreatePreferenceRequest(BaseModel):
    """Request para crear preferencia de pago"""
    order_id: str


class PaymentPreferenceResponse(BaseModel):
    """Respuesta con datos de preferencia de MP"""
    preference_id: str
    init_point: str  # URL para redirigir al usuario a MP (producción)
    sandbox_init_point: str  # URL para testing


class PaymentStatusResponse(BaseModel):
    """Estado del pago de una orden"""
    order_id: str
    order_number: str
    payment_status: str  # pending, approved, rejected, refunded
    payment_id: Optional[str]
    paid_at: Optional[datetime]
    amount: float
    commission_amount: Optional[float] = None
    seller_amount: Optional[float] = None


# URLs de redirección después del pago
# NGROK_URL es para el backend (webhooks), FRONTEND_URL es para redirecciones al usuario
# Ambos deben configurarse en el .env del nuevo deploy
NGROK_URL = os.environ.get("NGROK_URL", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
SUCCESS_URL = f"{FRONTEND_URL}/payment/success"
FAILURE_URL = f"{FRONTEND_URL}/payment/failure"
PENDING_URL = f"{FRONTEND_URL}/payment/pending"


# ============== ENDPOINTS ==============

@router.post("/create-preference", response_model=PaymentPreferenceResponse)
async def create_payment_preference(
    request: CreatePreferenceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Crear una preferencia de pago en Mercado Pago.
    
    Split Payments (si el vendedor tiene cuenta MP vinculada):
    - El pago va directo al vendedor
    - marketplace_fee (5%) se retiene para TopGreen automáticamente
    
    Sin Split (si el vendedor NO tiene cuenta MP vinculada):
    - El 100% va al marketplace (TopGreen)
    - La comisión queda registrada para liquidación manual
    """
    # La integración con MP se entrega desvinculada: devolvemos 503 antes de
    # consultar la orden. Ver docs/SETUP_PAYMENTS.md.
    _require_mp_configured()

    # Buscar la orden
    order = db.query(Order).filter(Order.id == request.order_id).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    
    # Verificar que es el comprador
    if order.buyer_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permiso para pagar esta orden")
    
    # Verificar estado (solo PLACED puede pagarse)
    if order.status != OrderStatus.PLACED:
        raise HTTPException(
            status_code=400, 
            detail=f"Esta orden no puede pagarse (estado: {order.status.value})"
        )
    
    # Verificar si ya existe un pago para esta orden
    existing_payment = db.query(Payment).filter(Payment.order_id == order.id).first()
    if existing_payment and existing_payment.status == PaymentStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Esta orden ya fue pagada")
    
    # Obtener el vendedor
    seller = db.query(User).filter(User.id == order.seller_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Vendedor no encontrado")
    
    # Calcular montos y comisión
    # El vendedor recibe el 100% del precio del producto
    # La comisión de TopGreen (5%) se cobra ENCIMA del precio al comprador
    base_amount = float(order.total_amount)  # Lo que recibe el vendedor (100%)
    commission_percent = settings.MP_COMMISSION_PERCENT
    commission_amount = round(base_amount * commission_percent / 100, 2)  # Comisión TopGreen
    total_to_pay = round(base_amount + commission_amount, 2)  # Lo que paga el comprador (105%)
    seller_amount = base_amount  # El vendedor recibe el 100%
    
    # Determinar si usar Split Payments
    # Solo usar split si el vendedor tiene cuenta MP vinculada CON TOKEN DE PRODUCCIÓN
    # Los tokens de prueba (TEST-xxx) no funcionan con credenciales de producción
    seller_token = seller.mp_access_token or ""
    is_test_token = "TEST" in seller_token.upper()
    has_valid_mp_account = bool(seller_token and seller.mp_user_id and not is_test_token)
    
    use_split_payments = has_valid_mp_account
    
    if is_test_token:
        logger.warning(f"⚠️ Vendedor {seller.email} tiene token de PRUEBA - ignorando, usamos pago centralizado")
    
    if use_split_payments:
        logger.info(f"💰 SPLIT PAYMENT - Precio base: ${base_amount}, Comisión TopGreen: ${commission_amount}, Total a pagar: ${total_to_pay}")
        logger.info(f"💵 El vendedor {seller.email} recibirá ${seller_amount} (100%)")
        logger.info(f"🔗 Vendedor vinculado (mp_user_id: {seller.mp_user_id})")
    else:
        logger.info(f"💰 PAGO CENTRALIZADO - Precio base: ${base_amount} + Comisión: ${commission_amount} = Total: ${total_to_pay}")
        logger.info(f"⚠️ Vendedor {seller.email} NO tiene cuenta MP válida - pago va a TopGreen")
    
    # Construir items para la preferencia
    # El precio unitario incluye la comisión proporcional (5% encima)
    items = []
    commission_multiplier = 1 + (commission_percent / 100)  # 1.05 para 5%
    
    for item in order.items:
        # Cada item tiene su precio + proporción de la comisión
        unit_price_with_commission = round(float(item.unit_price_snapshot) * commission_multiplier, 2)
        items.append({
            "id": str(item.product_id) if item.product_id else "item",
            "title": item.product_name_snapshot[:256],  # MP limita a 256 caracteres
            "quantity": item.quantity,
            "unit_price": unit_price_with_commission,
            "currency_id": "ARS",
            "description": f"Orden #{order.order_number}"[:256]
        })
    
    # Agregar costo de envío como item (también con comisión encima)
    if float(order.shipping_cost) > 0:
        shipping_with_commission = round(float(order.shipping_cost) * commission_multiplier, 2)
        items.append({
            "id": "shipping",
            "title": "Costo de envío",
            "quantity": 1,
            "unit_price": shipping_with_commission,
            "currency_id": "ARS",
            "description": f"Envío para orden #{order.order_number}"
        })
    
    # Si no hay items detallados, crear un item general
    if not items:
        items.append({
            "id": order.id,
            "title": f"Orden #{order.order_number}",
            "quantity": 1,
            "unit_price": total_to_pay,  # Incluye comisión
            "currency_id": "ARS"
        })
    
    # Crear preferencia en Mercado Pago
    preference_data = {
        "items": items,
        "payer": {
            "email": current_user.email,
            "name": current_user.full_name or current_user.email.split("@")[0]
        },
        "back_urls": {
            "success": f"{SUCCESS_URL}?order_id={order.id}",
            "failure": f"{FAILURE_URL}?order_id={order.id}",
            "pending": f"{PENDING_URL}?order_id={order.id}"
        },
        "auto_return": "approved",
        "external_reference": order.order_number,
        "notification_url": f"{NGROK_URL}/api/payments/webhook",
        "statement_descriptor": "TOPGREEN"
    }
    
    # Si usamos Split Payments, agregar marketplace_fee
    if use_split_payments:
        preference_data["marketplace_fee"] = commission_amount
    
    try:
        # Seleccionar qué SDK usar
        if use_split_payments:
            # Crear SDK con el access_token del VENDEDOR
            seller_sdk = mercadopago.SDK(seller.mp_access_token)
            logger.info(f"Usando SDK con access_token del vendedor (Split Payment)")
            preference_response = seller_sdk.preference().create(preference_data)
        else:
            # Usar el SDK del marketplace (TopGreen)
            logger.info(f"Usando SDK del marketplace (Pago centralizado)")
            preference_response = _get_marketplace_sdk().preference().create(preference_data)
        
        logger.info(f"Creando preferencia para orden {order.order_number}")
        logger.info(f"Datos de preferencia: {preference_data}")
        logger.info(f"Respuesta completa de MP: {preference_response}")
        
        if preference_response["status"] != 201:
            logger.error(f"Error al crear preferencia MP: {preference_response}")
            raise HTTPException(
                status_code=500,
                detail="Error al crear la preferencia de pago en Mercado Pago"
            )
        
        preference = preference_response["response"]
        
        # Crear o actualizar registro de pago
        if existing_payment:
            payment = existing_payment
            payment.mp_preference_id = preference["id"]
            payment.init_point = preference.get("init_point")
            payment.status = PaymentStatus.PENDING
            payment.updated_at = datetime.utcnow()
        else:
            payment = Payment(
                order_id=order.id,
                mp_preference_id=preference["id"],
                mp_external_reference=order.order_number,
                status=PaymentStatus.PENDING,
                total_amount=Decimal(str(total_to_pay)),
                commission_amount=Decimal(str(commission_amount)),
                commission_percent=Decimal(str(commission_percent)),
                seller_amount=Decimal(str(seller_amount)),
                payer_email=current_user.email,
                payer_name=current_user.full_name,
                init_point=preference.get("init_point"),
                mp_response=preference
            )
            db.add(payment)
        
        db.commit()
        
        logger.info(f"Preferencia creada para orden {order.order_number}: {preference['id']}")
        logger.info(f"init_point: {preference.get('init_point')}")
        logger.info(f"sandbox_init_point: {preference.get('sandbox_init_point')}")
        logger.info(f"Split Payment: {use_split_payments}")
        
        # Usar init_point para producción (las credenciales APP_USR son de producción)
        # sandbox_init_point solo funciona con credenciales de prueba (TEST-xxx)
        checkout_url = preference.get("init_point", "")
        
        return PaymentPreferenceResponse(
            preference_id=preference["id"],
            init_point=checkout_url,
            sandbox_init_point=checkout_url  # Usar la misma URL
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error inesperado al crear preferencia: {e}")
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error al procesar el pago: {str(e)}"
        )


@router.post("/webhook")
async def mercadopago_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Webhook para recibir notificaciones de Mercado Pago.
    
    MP envía notificaciones cuando:
    - El pago se aprueba (approved)
    - El pago se rechaza (rejected)
    - El pago está pendiente (pending/in_process)
    - Hay un reembolso (refunded)
    
    IMPORTANTE: Este endpoint NO requiere autenticación ya que es llamado por MP.
    """
    # Parsear el body
    try:
        data = await request.json()
    except:
        logger.warning("Webhook recibió body inválido")
        raise HTTPException(status_code=400, detail="Invalid JSON")
    
    logger.info(f"Webhook de MP recibido: {data}")
    
    # Tipos de notificación
    topic = data.get("type") or data.get("topic")
    
    if topic == "payment":
        # Notificación de pago
        payment_data = data.get("data", {})
        payment_id = payment_data.get("id")
        
        if not payment_id:
            logger.warning("Webhook sin payment_id")
            return {"status": "ok"}
        
        # Si MP no está configurado, ignoramos el webhook con 200 para evitar
        # tormentas de reintentos. Ver docs/SETUP_PAYMENTS.md.
        if not _mp_is_configured():
            logger.warning(
                "Webhook de MP recibido pero la integración está desvinculada. "
                "Ignorando notificación (payment_id=%s).",
                payment_id,
            )
            return {"status": "ignored", "reason": "mp_not_configured"}

        try:
            # Consultar estado del pago en MP
            payment_response = _get_marketplace_sdk().payment().get(payment_id)
            
            if payment_response["status"] != 200:
                logger.error(f"Error al consultar pago {payment_id}: {payment_response}")
                return {"status": "error", "message": "No se pudo consultar el pago"}
            
            mp_payment = payment_response["response"]
            
            status = mp_payment.get("status")  # approved, rejected, pending, etc.
            external_reference = mp_payment.get("external_reference")  # order_number
            
            logger.info(f"Pago {payment_id}: status={status}, ref={external_reference}")
            
            if not external_reference:
                logger.warning(f"Pago {payment_id} sin external_reference")
                return {"status": "ok"}
            
            # Buscar la orden por order_number
            order = db.query(Order).filter(Order.order_number == external_reference).first()
            
            if not order:
                logger.error(f"Orden no encontrada para reference: {external_reference}")
                return {"status": "ok"}
            
            # Buscar o crear el registro de pago
            payment = db.query(Payment).filter(Payment.order_id == order.id).first()
            
            if not payment:
                # Crear registro si no existe (caso raro)
                total_amount = float(order.total_amount)
                commission_amount = round(total_amount * settings.MP_COMMISSION_PERCENT / 100, 2)
                seller_amount = round(total_amount - commission_amount, 2)
                
                payment = Payment(
                    order_id=order.id,
                    mp_preference_id=mp_payment.get("preference_id"),
                    mp_external_reference=external_reference,
                    total_amount=Decimal(str(total_amount)),
                    commission_amount=Decimal(str(commission_amount)),
                    commission_percent=Decimal(str(settings.MP_COMMISSION_PERCENT)),
                    seller_amount=Decimal(str(seller_amount)),
                    status=PaymentStatus.PENDING
                )
                db.add(payment)
            
            # Actualizar datos del pago
            payment.mp_payment_id = str(payment_id)
            payment.mp_merchant_order_id = str(mp_payment.get("order", {}).get("id", ""))
            payment.payer_email = mp_payment.get("payer", {}).get("email")
            payment.payer_name = f"{mp_payment.get('payer', {}).get('first_name', '')} {mp_payment.get('payer', {}).get('last_name', '')}".strip()
            payment.payment_method = mp_payment.get("payment_method_id")
            payment.payment_type = mp_payment.get("payment_type_id")
            payment.mp_response = mp_payment
            payment.updated_at = datetime.utcnow()
            
            # Mapear estado de MP a nuestro estado
            if status == "approved":
                payment.status = PaymentStatus.APPROVED
                payment.paid_at = datetime.utcnow()
                
                # Actualizar orden a PAID
                if order.status == OrderStatus.PLACED:
                    order.status = OrderStatus.PAID
                    order.updated_at = datetime.utcnow()
                    
                    # Descontar stock de los productos (solo cuando el pago es aprobado)
                    # Servicios no tienen stock, solo productos
                    for order_item in order.items:
                        product = db.query(Product).filter(Product.id == order_item.product_id).first()
                        is_service = product.category.is_service if product and product.category else False
                        if product and not is_service:
                            product.stock = (product.stock or 0) - order_item.quantity
                            product.sales_count = (product.sales_count or 0) + order_item.quantity
                            logger.info(f"Stock de {product.name} actualizado: -{order_item.quantity}")
                    
                    # Actualizar contadores de usuario
                    buyer = db.query(User).filter(User.id == order.buyer_id).first()
                    seller = db.query(User).filter(User.id == order.seller_id).first()
                    if buyer:
                        buyer.purchases_count = (buyer.purchases_count or 0) + 1
                    if seller:
                        seller.sales_count = (seller.sales_count or 0) + 1
                    
                    logger.info(f"Orden {order.order_number} marcada como PAID")
                    
                    # Enviar notificaciones de pago aprobado
                    try:
                        notify_payment_approved(db, order)
                    except Exception as e:
                        logger.warning(f"Error enviando notificación de pago: {e}")
                    
            elif status == "rejected":
                payment.status = PaymentStatus.REJECTED
                # No cancelamos la orden automáticamente, el usuario puede reintentar
                
            elif status == "cancelled":
                payment.status = PaymentStatus.CANCELLED
                
            elif status == "refunded":
                payment.status = PaymentStatus.REFUNDED
                # TODO: Manejar reembolsos (restaurar stock, actualizar orden)
                
            elif status in ["pending", "in_process", "in_mediation"]:
                payment.status = PaymentStatus.IN_PROCESS
            
            db.commit()
            logger.info(f"Payment {payment.id} actualizado a {payment.status}")
            
        except Exception as e:
            logger.exception(f"Error procesando webhook de pago: {e}")
            db.rollback()
            # Retornamos OK para que MP no reintente indefinidamente
            return {"status": "error", "message": str(e)}
    
    elif topic == "merchant_order":
        # Notificación de orden del comerciante (agrupación de pagos)
        logger.info(f"Merchant order notification: {data}")
    
    # MP espera 200 OK para confirmar recepción
    return {"status": "ok"}


@router.get("/order/{order_id}/status", response_model=PaymentStatusResponse)
async def get_payment_status(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtener estado del pago de una orden"""
    order = db.query(Order).filter(Order.id == order_id).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    
    # Verificar permisos
    if order.buyer_id != current_user.id and order.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permiso")
    
    # Buscar el pago asociado
    payment = db.query(Payment).filter(Payment.order_id == order.id).first()
    
    if payment:
        return PaymentStatusResponse(
            order_id=order.id,
            order_number=order.order_number,
            payment_status=payment.status.value,
            payment_id=payment.mp_payment_id,
            paid_at=payment.paid_at,
            amount=float(payment.total_amount),
            commission_amount=float(payment.commission_amount),
            seller_amount=float(payment.seller_amount)
        )
    else:
        # No hay pago asociado todavía
        payment_status_map = {
            OrderStatus.PLACED: "pending",
            OrderStatus.PAID: "approved",
            OrderStatus.CONFIRMED: "approved",
            OrderStatus.SHIPPED: "approved",
            OrderStatus.DELIVERED: "approved",
            OrderStatus.CANCELLED: "cancelled",
            OrderStatus.REJECTED: "rejected",
        }
        
        return PaymentStatusResponse(
            order_id=order.id,
            order_number=order.order_number,
            payment_status=payment_status_map.get(order.status, "unknown"),
            payment_id=None,
            paid_at=None,
            amount=float(order.total_amount)
        )


@router.get("/public-key")
async def get_mp_public_key():
    """
    Obtener la public key de MP para el frontend.
    Si la integración está desvinculada devuelve string vacío + configured=False.
    Ver docs/SETUP_PAYMENTS.md.
    """
    return {
        "public_key": getattr(settings, "MP_PUBLIC_KEY", "") or "",
        "configured": _mp_is_configured(),
    }


@router.post("/sync-status/{order_id}")
async def sync_payment_status(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Sincronizar el estado del pago consultando directamente a MercadoPago.
    
    Útil cuando:
    - El webhook no llegó
    - El usuario vuelve de MP con pago exitoso pero el estado no se actualizó
    
    Este endpoint busca pagos por external_reference (order_number) y actualiza el estado.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    
    # Verificar permisos
    if order.buyer_id != current_user.id and order.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permiso")

    # La integración con MP se entrega desvinculada: ver docs/SETUP_PAYMENTS.md.
    _require_mp_configured()

    try:
        # Buscar pagos en MP por external_reference
        search_response = _get_marketplace_sdk().payment().search({
            "external_reference": order.order_number
        })
        
        logger.info(f"Búsqueda de pagos para {order.order_number}: {search_response}")
        
        if search_response["status"] != 200:
            raise HTTPException(status_code=500, detail="Error consultando MercadoPago")
        
        results = search_response["response"].get("results", [])
        
        if not results:
            return {
                "message": "No se encontraron pagos para esta orden en MercadoPago",
                "order_status": order.status.value,
                "synced": False
            }
        
        # Tomar el pago más reciente
        mp_payment = results[0]
        status = mp_payment.get("status")
        payment_id = mp_payment.get("id")
        
        logger.info(f"Pago encontrado: {payment_id}, estado: {status}")
        
        # Buscar o crear el registro de pago
        payment = db.query(Payment).filter(Payment.order_id == order.id).first()
        
        if not payment:
            total_amount = float(order.total_amount)
            commission_amount = round(total_amount * settings.MP_COMMISSION_PERCENT / 100, 2)
            seller_amount = round(total_amount - commission_amount, 2)
            
            payment = Payment(
                order_id=order.id,
                mp_preference_id=mp_payment.get("preference_id"),
                mp_external_reference=order.order_number,
                total_amount=Decimal(str(total_amount)),
                commission_amount=Decimal(str(commission_amount)),
                commission_percent=Decimal(str(settings.MP_COMMISSION_PERCENT)),
                seller_amount=Decimal(str(seller_amount)),
                status=PaymentStatus.PENDING
            )
            db.add(payment)
        
        # Actualizar datos del pago
        payment.mp_payment_id = str(payment_id)
        payment.payer_email = mp_payment.get("payer", {}).get("email")
        payment.payment_method = mp_payment.get("payment_method_id")
        payment.payment_type = mp_payment.get("payment_type_id")
        payment.mp_response = mp_payment
        payment.updated_at = datetime.utcnow()
        
        # Mapear estado
        old_order_status = order.status
        
        if status == "approved":
            payment.status = PaymentStatus.APPROVED
            payment.paid_at = datetime.fromisoformat(mp_payment.get("date_approved", "").replace("Z", "+00:00")) if mp_payment.get("date_approved") else datetime.utcnow()
            
            if order.status == OrderStatus.PLACED:
                order.status = OrderStatus.PAID
                order.updated_at = datetime.utcnow()
                
                # Actualizar contadores
                buyer = db.query(User).filter(User.id == order.buyer_id).first()
                seller = db.query(User).filter(User.id == order.seller_id).first()
                if buyer:
                    buyer.purchases_count = (buyer.purchases_count or 0) + 1
                if seller:
                    seller.sales_count = (seller.sales_count or 0) + 1
                
                # Enviar notificaciones
                try:
                    notify_payment_approved(db, order)
                except Exception as e:
                    logger.warning(f"Error enviando notificación: {e}")
                
        elif status == "rejected":
            payment.status = PaymentStatus.REJECTED
        elif status in ["pending", "in_process"]:
            payment.status = PaymentStatus.IN_PROCESS
        
        db.commit()
        
        return {
            "message": f"Estado sincronizado: {status}",
            "payment_id": str(payment_id),
            "payment_status": payment.status.value,
            "order_status": order.status.value,
            "previous_order_status": old_order_status.value,
            "synced": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error sincronizando pago: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# ============== REEMBOLSOS ==============

def process_refund(db: Session, order: Order, full_refund: bool = True) -> dict:
    """
    Procesa un reembolso para una orden rechazada/cancelada.
    
    Args:
        db: Sesión de base de datos
        order: Orden a reembolsar
        full_refund: 
            - True: Reembolso total (vendedor rechaza) - devuelve 100%
            - False: Reembolso parcial (comprador cancela) - devuelve 95% (sin comisión TopGreen)
    
    Returns:
        dict con resultado del reembolso
    """
    print(f"🔍 Buscando pago para orden {order.order_number} (ID: {order.id})")
    
    # Buscar el pago asociado a la orden
    payment = db.query(Payment).filter(
        Payment.order_id == order.id,
        Payment.status == PaymentStatus.APPROVED
    ).first()
    
    if not payment:
        # Intentar buscar cualquier pago de la orden
        any_payment = db.query(Payment).filter(Payment.order_id == order.id).first()
        if any_payment:
            print(f"⚠️ Pago encontrado pero con estado: {any_payment.status}, mp_payment_id: {any_payment.mp_payment_id}")
        else:
            print(f"❌ No hay ningún pago registrado para esta orden")
        logger.warning(f"No se encontró pago aprobado para orden {order.order_number}")
        return {"success": False, "message": "No hay pago aprobado para reembolsar"}
    
    print(f"✅ Pago encontrado: mp_payment_id={payment.mp_payment_id}, total={payment.total_amount}")
    
    if not payment.mp_payment_id:
        logger.warning(f"Orden {order.order_number} no tiene mp_payment_id")
        return {"success": False, "message": "No hay ID de pago de MercadoPago"}
    
    # Obtener el vendedor para usar su access_token (Split Payment)
    seller = db.query(User).filter(User.id == order.seller_id).first()
    if not seller or not seller.mp_access_token:
        print(f"⚠️ Vendedor sin access_token de MercadoPago, usando token del marketplace")
        seller_sdk = sdk  # Usar SDK del marketplace como fallback
    else:
        print(f"🔑 Usando access_token del vendedor: {seller.email}")
        seller_sdk = mercadopago.SDK(seller.mp_access_token)
    
    try:
        # Calcular monto a reembolsar
        if full_refund:
            # Reembolso total (vendedor rechaza)
            refund_amount = float(payment.total_amount)
            refund_type = "total"
        else:
            # Reembolso parcial (comprador cancela) - descuenta comisión TopGreen
            refund_amount = float(payment.seller_amount)  # 95% del total
            refund_type = "parcial"
        
        logger.info(f"Iniciando reembolso {refund_type} de ${refund_amount} para orden={order.order_number}")
        print(f"📤 Enviando reembolso a MercadoPago: payment_id={payment.mp_payment_id}, amount={refund_amount}")
        
        # Realizar reembolso en MercadoPago usando SDK del vendedor
        if full_refund:
            # Reembolso total
            refund_response = seller_sdk.refund().create(payment.mp_payment_id)
        else:
            # Reembolso parcial - especificar monto
            refund_response = seller_sdk.refund().create(payment.mp_payment_id, {"amount": refund_amount})
        
        print(f"📥 Respuesta de MercadoPago: status={refund_response.get('status')}, response={refund_response.get('response')}")
        
        if refund_response["status"] in [200, 201]:
            refund_data = refund_response["response"]
            
            # Actualizar estado del pago
            payment.status = PaymentStatus.REFUNDED
            payment.refund_id = str(refund_data.get("id", ""))
            payment.refunded_at = datetime.now()
            payment.refund_amount = float(refund_data.get("amount", refund_amount))
            
            db.commit()
            
            logger.info(f"✅ Reembolso {refund_type} exitoso: ${payment.refund_amount} para orden {order.order_number}")
            
            return {
                "success": True,
                "message": f"Reembolso {refund_type} de ${payment.refund_amount} procesado exitosamente",
                "refund_id": payment.refund_id,
                "amount": payment.refund_amount,
                "refund_type": refund_type
            }
        else:
            error_msg = refund_response.get("response", {}).get("message", "Error desconocido")
            logger.error(f"Error en reembolso MP: {refund_response}")
            return {
                "success": False, 
                "message": f"MercadoPago rechazó el reembolso: {error_msg}",
                "mp_response": refund_response
            }
            
    except Exception as e:
        logger.exception(f"Error procesando reembolso: {e}")
        return {"success": False, "message": f"Error técnico: {str(e)}"}


class RefundRequest(BaseModel):
    """Request para reembolso manual"""
    full_refund: bool = True  # True = total (100%), False = parcial (95%)


@router.post("/refund/{order_id}")
def refund_order_payment(
    order_id: str,
    refund_data: Optional[RefundRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Endpoint para reembolsar el pago de una orden.
    
    Parámetros:
    - full_refund: True = reembolso total (100%), False = parcial (95%)
    
    Solo puede ser usado por:
    - El vendedor (cuando rechaza) → reembolso total
    - El comprador (cuando cancela) → reembolso parcial
    - Admin → cualquier tipo
    """
    # Buscar la orden
    order = db.query(Order).filter(
        (Order.id == order_id) | (Order.order_number == order_id)
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    
    # Verificar permisos
    is_seller = str(order.seller_id) == str(current_user.id)
    is_buyer = str(order.buyer_id) == str(current_user.id)
    is_admin = current_user.role.value == "admin"
    
    if not is_seller and not is_buyer and not is_admin:
        raise HTTPException(status_code=403, detail="No tienes permiso para reembolsar esta orden")
    
    # Solo se puede reembolsar si la orden fue pagada
    if order.status not in [OrderStatus.PAID, OrderStatus.CONFIRMED, OrderStatus.REJECTED, OrderStatus.CANCELLED]:
        raise HTTPException(
            status_code=400, 
            detail=f"No se puede reembolsar una orden en estado {order.status.value}"
        )
    
    # Determinar tipo de reembolso
    if refund_data:
        full_refund = refund_data.full_refund
    else:
        # Por defecto: vendedor = total, comprador = parcial
        full_refund = is_seller or is_admin
    
    # Procesar reembolso
    result = process_refund(db, order, full_refund=full_refund)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return result
