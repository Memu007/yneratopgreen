"""
API Router para notificaciones de usuario
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from app.db.base import get_db
from app.models.notification import Notification, NotificationType
from app.core.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationResponse(BaseModel):
    id: str
    type: str
    title: str
    message: str
    order_id: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    notifications: List[NotificationResponse]
    unread_count: int
    total: int


@router.get("", response_model=NotificationListResponse)
def get_notifications(
    limit: int = 50,
    include_read: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtener notificaciones del usuario actual"""
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    
    if not include_read:
        query = query.filter(Notification.is_read == False)
    
    notifications = query.order_by(desc(Notification.created_at)).limit(limit).all()
    
    unread_count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).count()
    
    total = db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).count()
    
    return NotificationListResponse(
        notifications=[NotificationResponse.model_validate(n) for n in notifications],
        unread_count=unread_count,
        total=total
    )


@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtener cantidad de notificaciones no leídas"""
    count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).count()
    
    return {"unread_count": count}


@router.post("/{notification_id}/read")
def mark_as_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Marcar una notificación como leída"""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    
    notification.is_read = True
    notification.read_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Notificación marcada como leída"}


@router.post("/read-all")
def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Marcar todas las notificaciones como leídas"""
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update({
        Notification.is_read: True,
        Notification.read_at: datetime.utcnow()
    })
    db.commit()
    
    return {"message": "Todas las notificaciones marcadas como leídas"}


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Eliminar una notificación"""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    
    db.delete(notification)
    db.commit()
    
    return {"message": "Notificación eliminada"}


# === Función helper para crear notificaciones ===

def create_notification(
    db: Session,
    user_id: str,
    notification_type: NotificationType,
    title: str,
    message: str,
    order_id: str = None
):
    """Helper para crear una notificación"""
    notification = Notification(
        user_id=user_id,
        type=notification_type.value,
        title=title,
        message=message,
        order_id=order_id
    )
    db.add(notification)
    db.commit()
    return notification


def notify_order_placed(db: Session, order):
    """Notificar al comprador que su pedido fue realizado"""
    create_notification(
        db=db,
        user_id=order.buyer_id,
        notification_type=NotificationType.ORDER_PLACED,
        title="Pedido realizado",
        message=f"Tu pedido #{order.order_number} fue creado exitosamente. Procede al pago para continuar.",
        order_id=order.id
    )


def notify_order_received(db: Session, order):
    """Notificar al vendedor que recibió un nuevo pedido"""
    create_notification(
        db=db,
        user_id=order.seller_id,
        notification_type=NotificationType.ORDER_RECEIVED,
        title="Nueva venta recibida",
        message=f"Tienes un nuevo pedido #{order.order_number} pendiente de pago.",
        order_id=order.id
    )


def notify_payment_approved(db: Session, order):
    """Notificar pago aprobado a comprador y vendedor"""
    # Al comprador
    create_notification(
        db=db,
        user_id=order.buyer_id,
        notification_type=NotificationType.PAYMENT_APPROVED,
        title="Pago aprobado",
        message=f"El pago de tu pedido #{order.order_number} fue aprobado. El vendedor será notificado.",
        order_id=order.id
    )
    # Al vendedor
    create_notification(
        db=db,
        user_id=order.seller_id,
        notification_type=NotificationType.PRODUCT_SOLD,
        title="¡Venta confirmada!",
        message=f"El pago del pedido #{order.order_number} fue aprobado. Por favor confirma y envía el pedido.",
        order_id=order.id
    )


def notify_order_confirmed(db: Session, order):
    """Notificar al comprador que el vendedor confirmó el pedido"""
    create_notification(
        db=db,
        user_id=order.buyer_id,
        notification_type=NotificationType.ORDER_CONFIRMED,
        title="Pedido confirmado",
        message=f"El vendedor confirmó tu pedido #{order.order_number}. Pronto será enviado.",
        order_id=order.id
    )


def notify_order_shipped(db: Session, order):
    """Notificar al comprador que el pedido fue enviado"""
    create_notification(
        db=db,
        user_id=order.buyer_id,
        notification_type=NotificationType.ORDER_SHIPPED,
        title="Pedido enviado",
        message=f"Tu pedido #{order.order_number} está en camino. Te avisaremos cuando llegue.",
        order_id=order.id
    )


def notify_order_delivered(db: Session, order):
    """Notificar a ambas partes que el pedido fue entregado"""
    # Al comprador
    create_notification(
        db=db,
        user_id=order.buyer_id,
        notification_type=NotificationType.ORDER_DELIVERED,
        title="Pedido entregado",
        message=f"Tu pedido #{order.order_number} fue marcado como entregado. ¡Gracias por tu compra!",
        order_id=order.id
    )
    # Al vendedor
    create_notification(
        db=db,
        user_id=order.seller_id,
        notification_type=NotificationType.ORDER_DELIVERED,
        title="Entrega confirmada",
        message=f"El comprador confirmó la recepción del pedido #{order.order_number}. ¡Venta completada!",
        order_id=order.id
    )


def notify_order_cancelled(db: Session, order, cancelled_by_buyer: bool = True):
    """Notificar cancelación del pedido"""
    if cancelled_by_buyer:
        # Notificar al vendedor que el comprador canceló
        create_notification(
            db=db,
            user_id=order.seller_id,
            notification_type=NotificationType.ORDER_CANCELLED,
            title="Pedido cancelado",
            message=f"El comprador canceló el pedido #{order.order_number}.",
            order_id=order.id
        )
        # También notificar al comprador que se le descontará la comisión
        create_notification(
            db=db,
            user_id=order.buyer_id,
            notification_type=NotificationType.ORDER_CANCELLED,
            title="Cancelaste tu pedido",
            message=f"Tu pedido #{order.order_number} fue cancelado. Se te devolverá el 95% del monto (se descuenta la comisión del 5%).",
            order_id=order.id
        )
    else:
        # Notificar al comprador que el vendedor rechazó
        create_notification(
            db=db,
            user_id=order.buyer_id,
            notification_type=NotificationType.ORDER_REJECTED,
            title="Pedido rechazado",
            message=f"El vendedor rechazó tu pedido #{order.order_number}. El monto total será reembolsado.",
            order_id=order.id
        )


def notify_welcome(db: Session, user_id: str, user_name: str):
    """Notificación de bienvenida al registrarse"""
    create_notification(
        db=db,
        user_id=user_id,
        notification_type=NotificationType.WELCOME,
        title="¡Bienvenido a TopGreen!",
        message=f"Hola {user_name}, tu cuenta fue creada exitosamente. Explorá el marketplace y comenzá a comprar o vender productos agrícolas."
    )
