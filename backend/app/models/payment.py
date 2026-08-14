"""
Modelo de Pagos - Integración con Mercado Pago
"""
from sqlalchemy import Boolean, Column, String, DateTime, Numeric, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.db.base import Base


class PaymentStatus(str, enum.Enum):
    """Estado de la intención de pago de una orden.

    No es el estado de un intento —eso vive en `mp_intentos_de_pago`— sino el
    resumen de todos ellos: si alguno se aprobó, la intención está aprobada, y
    ningún rechazo posterior la hace retroceder.
    """
    PENDING = "pending"  # Pendiente (preferencia creada)
    APPROVED = "approved"  # Aprobado por MP
    REJECTED = "rejected"  # Rechazado
    CANCELLED = "cancelled"  # Cancelado
    REFUNDED = "refunded"  # Devuelto: Mercado Pago informó una devolución
    IN_PROCESS = "in_process"  # En proceso
    # Contracargo: el comprador desconoció el pago ante su banco o ante MP y el
    # dinero se retiró. No lo ejecutamos nosotros y no lo revertimos nosotros;
    # es un estado para que el vendedor lo vea y actúe.
    CHARGED_BACK = "charged_back"
    # Mas de un pago aprobado distinto para la misma orden. Checkout Pro puede
    # entregar varios intentos por la misma preferencia, y si dos llegan a
    # acreditarse, resumir eso como "aprobado" contaria una sola venta cuando
    # hay dos cobros. No se consolida mercaderia dos veces y no se devuelve
    # plata sola: queda este estado, que pide que una persona lo mire, y los
    # dos identificadores siguen guardados en `mp_intentos_de_pago`.
    EN_REVISION = "en_revision"


class Payment(Base):
    __tablename__ = "payments"

    # Identificación
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    # Única: una orden tiene una intención de pago y no dos. Es lo que hace
    # que reintentar -doble clic, timeout, respuesta perdida- reutilice la
    # misma en vez de fabricar otra.
    order_id = Column(
        String(36), ForeignKey("orders.id"), nullable=False, index=True, unique=True
    )
    
    # Datos de Mercado Pago
    mp_preference_id = Column(String(100), nullable=True, index=True)  # ID de preferencia
    mp_payment_id = Column(String(100), nullable=True, index=True)  # ID de pago confirmado
    mp_merchant_order_id = Column(String(100), nullable=True)  # ID de orden en MP
    mp_external_reference = Column(String(100), nullable=True, index=True)  # Referencia externa (order_number)
    
    # Estado
    status = Column(SQLEnum(PaymentStatus), default=PaymentStatus.PENDING, nullable=False)
    
    # Monto. Uno solo, y sale del total ya congelado en la orden.
    #
    # Acá vivían `commission_amount`, `commission_percent` y `seller_amount`.
    # Se fueron porque mentían: TopGreen no cobra comisión por venta, y
    # `seller_amount` guardaba el 100 % del total, que no es lo que el vendedor
    # cobra —Mercado Pago le descuenta la suya—. Un número que nadie puede
    # sostener es peor que ningún número.
    total_amount = Column(Numeric(14, 2), nullable=False)
    
    # Datos del pagador (snapshot de MP)
    payer_email = Column(String(255), nullable=True)
    payer_name = Column(String(255), nullable=True)
    
    # Método de pago
    payment_method = Column(String(50), nullable=True)  # credit_card, debit_card, etc.
    payment_type = Column(String(50), nullable=True)  # visa, mastercard, etc.
    
    # URLs
    init_point = Column(String(500), nullable=True)  # URL para pagar

    # Hasta cuándo vale ese link. Es el mismo instante que se le declara a
    # Mercado Pago como fin de vigencia de la preferencia, y el mismo que hace
    # vencer la reserva de stock: si el link muriera después que la reserva, se
    # podría cobrar mercadería que ya se le dio a otro.
    expires_at = Column(DateTime, nullable=True, index=True)
    
    # El cuerpo completo de la respuesta de Mercado Pago NO se guarda. Traía
    # datos del pagador y de la aplicación que no necesitamos para nada, y lo
    # que no se guarda no se filtra. Queda lo que hace falta: identificadores,
    # la URL para pagar, el importe y nuestro propio estado.
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    paid_at = Column(DateTime, nullable=True)  # Cuando se confirmó el pago
    
    # Devolución. Estos dos campos **registran lo que Mercado Pago informa**,
    # no una acción nuestra: TopGreen no ejecuta reembolsos. `refund_id` se
    # fue con el módulo heredado, que era el que devolvía dinero.
    refunded_at = Column(DateTime, nullable=True)  # Cuando MP informó la devolución
    refund_amount = Column(Numeric(14, 2), nullable=True)  # Monto devuelto según MP

    # Si el link de pago ya esta apagado del lado de Mercado Pago.
    #
    # Se apaga apenas el primer pago se acredita, porque una preferencia sigue
    # sirviendo despues de cobrada y nada impide que alguien vuelva a pagarla.
    # Como apagarlo es una llamada a Mercado Pago y puede fallar, hace falta
    # saber si quedo hecho: mientras esto sea falso con un cobro acreditado, el
    # reconciliador lo vuelve a intentar.
    link_cerrado = Column(Boolean, default=False, nullable=False)

    # Relaciones
    order = relationship("Order", back_populates="payment")
    intentos = relationship(
        "MPIntentoDePago",
        back_populates="payment",
        cascade="all, delete-orphan",
        order_by="MPIntentoDePago.creado_el",
    )

    def __repr__(self):
        return f"<Payment {self.id} - {self.status}>"
