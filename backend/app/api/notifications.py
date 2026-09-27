"""
API Router para notificaciones de usuario
"""
import logging

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

logger = logging.getLogger(__name__)


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
#
# Los textos dicen lo que pasó y nada más, en el «vos» del sitio. No prometen
# lo que el producto no hace: AgroBoeda no tiene el dinero de un pedido, no
# sabe cuándo llega un envío y no manda más avisos que los de acá. Si nombran
# un próximo paso, es uno que la persona tiene en «Mi cuenta».

def create_notification(
    db: Session,
    user_id: str,
    notification_type: NotificationType,
    title: str,
    message: str,
    order_id: str = None,
    confirmar: bool = True,
):
    """Helper para crear una notificación.

    `confirmar=False` la deja en la transacción de quien llama, sin `commit`:
    es para el aviso que tiene que quedar escrito junto con lo que avisa.
    """
    notification = Notification(
        user_id=user_id,
        type=notification_type.value,
        title=title,
        message=message,
        order_id=order_id
    )
    db.add(notification)
    if confirmar:
        db.commit()
    return notification


def notify_order_placed(db: Session, order):
    """Notificar al comprador que su pedido fue realizado"""
    create_notification(
        db=db,
        user_id=order.buyer_id,
        notification_type=NotificationType.ORDER_PLACED,
        title="Pedido realizado",
        message=f"Tu pedido #{order.order_number} fue creado y está pendiente de pago. En Mis Compras tenés cómo pagarlo.",
        order_id=order.id
    )


def notify_order_received(db: Session, order):
    """Notificar al vendedor que recibió un nuevo pedido"""
    create_notification(
        db=db,
        user_id=order.seller_id,
        notification_type=NotificationType.ORDER_RECEIVED,
        title="Nueva venta recibida",
        message=f"Tenés un nuevo pedido #{order.order_number} pendiente de pago.",
        order_id=order.id
    )


def notify_payment_approved(db: Session, order):
    """Mercado Pago acreditó el pago de una orden: se avisa a las dos partes.

    La llama `cobro.aplicar` en la transición a pagada, que pasa una sola vez
    por orden: una confirmación repetida encuentra la orden ya pagada y no
    llega acá.

    Va dentro de la transacción de quien confirma el pago, sin `commit`: el
    webhook y el reconciliador tienen la fila bloqueada y deciden cuándo
    soltarla. Así el aviso queda escrito si queda escrita la transición, y
    sólo entonces. Y va en un savepoint: si escribir el aviso falla, se pierde
    el aviso, no el pago.
    """
    # Lo que ya estaba pendiente se escribe afuera del savepoint: si eso falla,
    # no es una falla del aviso y no se la tapa.
    db.flush()
    try:
        with db.begin_nested():
            create_notification(
                db=db,
                user_id=order.buyer_id,
                notification_type=NotificationType.PAYMENT_APPROVED,
                title="Pago aprobado",
                message=f"Mercado Pago acreditó el pago de tu pedido #{order.order_number}.",
                order_id=order.id,
                confirmar=False,
            )
            # Decía «¡Venta confirmada!» y «Por favor confirma y envía el
            # pedido»: confirmar es un paso que falta, y enviar no aplica a un
            # servicio ni a un retiro.
            create_notification(
                db=db,
                user_id=order.seller_id,
                notification_type=NotificationType.PRODUCT_SOLD,
                title="Venta pagada",
                message=(
                    f"Mercado Pago acreditó el pago del pedido #{order.order_number}. "
                    "Ya podés confirmar el pedido en Mis Ventas."
                ),
                order_id=order.id,
                confirmar=False,
            )
    except Exception as error:  # noqa: BLE001
        logger.warning("No se pudo avisar el pago de %s: %s", order.order_number, error)


def notify_transfer_approved(db: Session, order):
    """Quien vende aprobó la transferencia: se avisa a las dos partes."""
    create_notification(
        db=db,
        user_id=order.buyer_id,
        notification_type=NotificationType.PAYMENT_APPROVED,
        title="Pago aprobado",
        message=f"El vendedor aprobó la transferencia de tu pedido #{order.order_number}.",
        order_id=order.id
    )
    create_notification(
        db=db,
        user_id=order.seller_id,
        notification_type=NotificationType.PRODUCT_SOLD,
        title="Venta pagada",
        message=(
            f"Aprobaste la transferencia del pedido #{order.order_number}. "
            "Ya podés confirmar el pedido en Mis Ventas."
        ),
        order_id=order.id
    )


def notify_transfer_rejected(db: Session, order):
    """Quien vende rechazó la transferencia: se avisa a quien compra.

    La orden queda rechazada y no se puede volver a mandar el comprobante, así
    que no se ofrece: se dice dónde está el motivo, que quien vende escribió.
    """
    create_notification(
        db=db,
        user_id=order.buyer_id,
        notification_type=NotificationType.ORDER_REJECTED,
        title="Transferencia rechazada",
        message=(
            f"El vendedor rechazó la transferencia de tu pedido #{order.order_number} "
            "y el pedido quedó rechazado. El motivo está en Mis Compras."
        ),
        order_id=order.id
    )


def notify_order_confirmed(db: Session, order):
    """Notificar al comprador que el vendedor confirmó el pedido"""
    create_notification(
        db=db,
        user_id=order.buyer_id,
        notification_type=NotificationType.ORDER_CONFIRMED,
        title="Pedido confirmado",
        message=f"El vendedor confirmó tu pedido #{order.order_number}.",
        order_id=order.id
    )


def notify_order_shipped(db: Session, order):
    """Notificar al comprador que el pedido fue enviado"""
    create_notification(
        db=db,
        user_id=order.buyer_id,
        notification_type=NotificationType.ORDER_SHIPPED,
        title="Pedido enviado",
        # La llegada no la avisa nadie: la confirma quien compra, con
        # «Confirmar Recepción».
        message=(
            f"El vendedor marcó tu pedido #{order.order_number} como enviado. "
            "Cuando lo recibas, confirmá la recepción en Mis Compras."
        ),
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
        # Y al comprador. Decía «Se te devolverá el 95% del monto (se
        # descuenta la comisión del 5%)»: AgroBoeda hoy no cobra esa comisión
        # ni tiene el dinero para devolverlo, y cómo se explica la comisión
        # está por decidir (la clienta, 20/09).
        create_notification(
            db=db,
            user_id=order.buyer_id,
            notification_type=NotificationType.ORDER_CANCELLED,
            title="Cancelaste tu pedido",
            message=f"Tu pedido #{order.order_number} fue cancelado.",
            order_id=order.id
        )
    else:
        # Notificar al comprador que el vendedor rechazó. Decía «El monto
        # total será reembolsado.»: AgroBoeda no tiene ese dinero y no
        # reembolsa nada. Por Mercado Pago, una orden cobrada no se puede
        # rechazar (409); por transferencia, lo pagado está en la cuenta del
        # vendedor.
        create_notification(
            db=db,
            user_id=order.buyer_id,
            notification_type=NotificationType.ORDER_REJECTED,
            title="Pedido rechazado",
            message=f"El vendedor rechazó tu pedido #{order.order_number}.",
            order_id=order.id
        )


def notify_welcome(db: Session, user_id: str, user_name: str):
    """Notificación de bienvenida al registrarse"""
    create_notification(
        db=db,
        user_id=user_id,
        notification_type=NotificationType.WELCOME,
        title="¡Bienvenido/a a AgroBoeda!",
        message=(
            f"Hola {user_name}, tu cuenta fue creada. En el Mercado podés publicar "
            "un equipo, un insumo o un servicio, o buscar lo que necesitás."
        )
    )
