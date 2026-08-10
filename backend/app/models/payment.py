"""
Modelo de Pagos - Integración con Mercado Pago
"""
from sqlalchemy import Column, String, DateTime, Numeric, ForeignKey, Enum as SQLEnum, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.db.base import Base


class PaymentStatus(str, enum.Enum):
    """Estados del pago"""
    PENDING = "pending"  # Pendiente (preferencia creada)
    APPROVED = "approved"  # Aprobado por MP
    REJECTED = "rejected"  # Rechazado
    CANCELLED = "cancelled"  # Cancelado
    REFUNDED = "refunded"  # Reembolsado
    IN_PROCESS = "in_process"  # En proceso


class Payment(Base):
    __tablename__ = "payments"

    # Identificación
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String(36), ForeignKey("orders.id"), nullable=False, index=True)
    
    # Datos de Mercado Pago
    mp_preference_id = Column(String(100), nullable=True, index=True)  # ID de preferencia
    mp_payment_id = Column(String(100), nullable=True, index=True)  # ID de pago confirmado
    mp_merchant_order_id = Column(String(100), nullable=True)  # ID de orden en MP
    mp_external_reference = Column(String(100), nullable=True, index=True)  # Referencia externa (order_number)
    
    # Estado
    status = Column(SQLEnum(PaymentStatus), default=PaymentStatus.PENDING, nullable=False)
    
    # Montos
    total_amount = Column(Numeric(14, 2), nullable=False)  # Monto total pagado
    commission_amount = Column(Numeric(14, 2), nullable=False)  # Comisión TopGreen
    commission_percent = Column(Numeric(5, 2), nullable=False)  # Porcentaje aplicado
    seller_amount = Column(Numeric(14, 2), nullable=False)  # Monto para el vendedor
    
    # Datos del pagador (snapshot de MP)
    payer_email = Column(String(255), nullable=True)
    payer_name = Column(String(255), nullable=True)
    
    # Método de pago
    payment_method = Column(String(50), nullable=True)  # credit_card, debit_card, etc.
    payment_type = Column(String(50), nullable=True)  # visa, mastercard, etc.
    
    # URLs
    init_point = Column(String(500), nullable=True)  # URL para pagar
    
    # Datos adicionales de MP
    mp_response = Column(JSON, nullable=True)  # Respuesta completa de MP
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    paid_at = Column(DateTime, nullable=True)  # Cuando se confirmó el pago
    
    # Datos de reembolso
    refund_id = Column(String(100), nullable=True)  # ID del reembolso en MP
    refunded_at = Column(DateTime, nullable=True)  # Cuando se hizo el reembolso
    refund_amount = Column(Numeric(14, 2), nullable=True)  # Monto reembolsado
    
    # Relaciones
    order = relationship("Order", back_populates="payment")

    def __repr__(self):
        return f"<Payment {self.id} - {self.status}>"
