"""
Modelos de Orden - Sistema de compras y ventas
"""
from sqlalchemy import Column, String, DateTime, Integer, Numeric, ForeignKey, Enum as SQLEnum, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.db.base import Base


class OrderStatus(str, enum.Enum):
    """Estados de la orden"""
    DRAFT = "draft"  # Borrador (no confirmada)
    PLACED = "placed"  # Pedido realizado
    CONFIRMED = "confirmed"  # Confirmado por vendedor
    PAID = "paid"  # Pagado
    SHIPPED = "shipped"  # Enviado
    DELIVERED = "delivered"  # Entregado
    CANCELLED = "cancelled"  # Cancelado
    REJECTED = "rejected"  # Rechazado por vendedor
    AWAITING_TRANSFER_RECEIPT = "awaiting_transfer_receipt"
    TRANSFER_RECEIPT_SUBMITTED = "transfer_receipt_submitted"


class Order(Base):
    __tablename__ = "orders"

    # Identificación
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_number = Column(String(50), unique=True, nullable=False, index=True)  # Número de orden visible
    
    # Participantes
    buyer_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    seller_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Estado
    status = Column(SQLEnum(OrderStatus), default=OrderStatus.PLACED, nullable=False, index=True)
    
    # Montos
    subtotal = Column(Numeric(14, 2), nullable=False)
    shipping_cost = Column(Numeric(14, 2), default=0, nullable=False)
    total_amount = Column(Numeric(14, 2), nullable=False)
    currency = Column(String(3), default="ARS", nullable=False)
    
    # Dirección de envío (JSON para flexibilidad)
    shipping_address_json = Column(JSON, nullable=True)
    # Destino del padrón oficial. Queda NULL en las órdenes anteriores a la
    # logística: siguen siendo legibles, sin destino calculable.
    shipping_locality_id = Column(
        String(20),
        ForeignKey("localities.id"),
        nullable=True,
        index=True,
    )

    # Notas
    buyer_notes = Column(String(500), nullable=True)
    seller_notes = Column(String(500), nullable=True)
    cancellation_reason = Column(String(500), nullable=True)
    transfer_receipt_url = Column(String(500), nullable=True)
    transfer_cbu = Column(String(64), nullable=True)
    transfer_alias_bancario = Column(String(100), nullable=True)
    transfer_account_holder = Column(String(255), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    confirmed_at = Column(DateTime, nullable=True)
    shipped_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    
    # Relaciones
    buyer = relationship("User", foreign_keys=[buyer_id], back_populates="orders_as_buyer")
    seller = relationship("User", foreign_keys=[seller_id], back_populates="orders_as_seller")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    payment = relationship("Payment", back_populates="order", uselist=False)

    def __repr__(self):
        return f"<Order {self.order_number} - {self.status}>"


class OrderItem(Base):
    __tablename__ = "order_items"

    # Identificación
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String(36), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(String(36), ForeignKey("products.id"), nullable=False, index=True)
    
    # Snapshot de datos (por si el producto cambia después)
    product_name_snapshot = Column(String(255), nullable=False)
    product_image_snapshot = Column(String(500), nullable=True)
    unit_price_snapshot = Column(Numeric(12, 2), nullable=False)
    
    # Cantidad y total
    quantity = Column(Integer, nullable=False)
    total_price = Column(Numeric(14, 2), nullable=False)  # unit_price * quantity
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relaciones
    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")

    def __repr__(self):
        return f"<OrderItem {self.quantity}x {self.product_name_snapshot}>"
