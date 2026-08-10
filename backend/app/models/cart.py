"""
Modelos de Carrito - Sistema de carrito de compras
"""
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Numeric, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.db.base import Base


class CartStatus(str, enum.Enum):
    """Estados del carrito"""
    ACTIVE = "active"
    CONVERTED = "converted"  # Convertido en orden
    ABANDONED = "abandoned"  # Abandonado


class Cart(Base):
    __tablename__ = "carts"

    # Identificación
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Estado
    status = Column(SQLEnum(CartStatus), default=CartStatus.ACTIVE, nullable=False, index=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relaciones
    user = relationship("User", back_populates="carts")
    items = relationship("CartItem", back_populates="cart", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Cart {self.id} for user {self.user_id}>"


class CartItem(Base):
    __tablename__ = "cart_items"

    # Identificación
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    cart_id = Column(String(36), ForeignKey("carts.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(String(36), ForeignKey("products.id"), nullable=False, index=True)
    
    # Cantidad y precio snapshot
    quantity = Column(Integer, nullable=False, default=1)
    unit_price_snapshot = Column(Numeric(12, 2), nullable=False)  # Precio al momento de agregar
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relaciones
    cart = relationship("Cart", back_populates="items")
    product = relationship("Product", back_populates="cart_items")

    def __repr__(self):
        return f"<CartItem {self.quantity}x product {self.product_id}>"
