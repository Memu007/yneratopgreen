"""
Modelo de Notificación - Notificaciones in-app para usuarios
"""
from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.db.base import Base


class NotificationType(str, enum.Enum):
    """Tipos de notificación"""
    ORDER_PLACED = "order_placed"           # Compra realizada (para comprador)
    ORDER_RECEIVED = "order_received"       # Venta recibida (para vendedor)
    ORDER_CONFIRMED = "order_confirmed"     # Pedido confirmado por vendedor
    ORDER_SHIPPED = "order_shipped"         # Pedido enviado
    ORDER_DELIVERED = "order_delivered"     # Pedido entregado
    ORDER_CANCELLED = "order_cancelled"     # Pedido cancelado
    ORDER_REJECTED = "order_rejected"       # Pedido rechazado
    PAYMENT_APPROVED = "payment_approved"   # Pago aprobado
    PAYMENT_FAILED = "payment_failed"       # Pago fallido
    PRODUCT_SOLD = "product_sold"           # Producto vendido
    WELCOME = "welcome"                     # Bienvenida al registrarse
    SYSTEM = "system"                       # Notificación del sistema


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    type = Column(String(50), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    
    # Referencia opcional a orden relacionada
    order_id = Column(String(36), ForeignKey("orders.id"), nullable=True)
    
    # Estado
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    read_at = Column(DateTime, nullable=True)
    
    # Relaciones
    user = relationship("User", backref="notifications")
    order = relationship("Order", backref="notifications")

    def __repr__(self):
        return f"<Notification {self.type} for user {self.user_id}>"
