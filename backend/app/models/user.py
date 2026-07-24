"""
Modelo de Usuario - Sistema de autenticación y perfiles
"""
from sqlalchemy import Column, String, Boolean, DateTime, Enum as SQLEnum, Integer, Numeric
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.db.base import Base


class UserRole(str, enum.Enum):
    """Roles de usuario en el sistema"""
    ADMIN = "admin"
    USER = "user"  # Usuario normal (puede comprar y vender)


class User(Base):
    __tablename__ = "users"

    # Identificación
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    whatsapp = Column(String(50), nullable=True)
    
    # Autenticación
    password_hash = Column(String(255), nullable=False)
    role = Column(SQLEnum(UserRole), nullable=False, default=UserRole.USER)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    
    # Perfil adicional
    avatar_url = Column(String(500), nullable=True)
    bio = Column(String(500), nullable=True)
    location = Column(String(255), nullable=True)
    
    # Reputación y estadísticas
    rating_average = Column(Numeric(3, 2), default=0.0, nullable=False)  # Promedio de calificaciones (0 = sin calificaciones)
    rating_count = Column(Integer, default=0, nullable=False)  # Cantidad de calificaciones recibidas
    sales_count = Column(Integer, default=0, nullable=False)  # Ventas completadas
    purchases_count = Column(Integer, default=0, nullable=False)  # Compras completadas
    
    # Mercado Pago - Vinculación de cuenta de vendedor (OAuth)
    mp_user_id = Column(String(50), nullable=True)  # ID de usuario en Mercado Pago
    mp_access_token = Column(String(500), nullable=True)  # Token para recibir pagos
    mp_refresh_token = Column(String(500), nullable=True)  # Token para renovar access_token
    mp_token_expires_at = Column(DateTime, nullable=True)  # Expiración del access_token
    mp_linked_at = Column(DateTime, nullable=True)  # Fecha de vinculación de cuenta MP
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_login = Column(DateTime, nullable=True)
    
    # Relaciones
    products = relationship("Product", back_populates="seller", cascade="all, delete-orphan")
    carts = relationship("Cart", back_populates="user", cascade="all, delete-orphan")
    orders_as_buyer = relationship("Order", foreign_keys="Order.buyer_id", back_populates="buyer")
    orders_as_seller = relationship("Order", foreign_keys="Order.seller_id", back_populates="seller")
    audit_logs = relationship("AuditLog", back_populates="user")

    def __repr__(self):
        return f"<User {self.email} ({self.role})>"
