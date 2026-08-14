"""Cada intento de pago que Mercado Pago informa sobre una orden.

Una preferencia no es un pago: es un link, y por un link se puede intentar
pagar más de una vez. La tarjeta rebota, la persona vuelve y paga con otra. Si
guardáramos un solo estado por orden, ese segundo intento aprobado se quedaría
tapado por el rechazo del primero —o al revés, un rechazo viejo llegando tarde
borraría una aprobación—. Por eso cada intento tiene su fila.

La fila es también el candado: `mp_payment_id` es única, así que el mismo aviso
repetido, en paralelo o fuera de orden encuentra la fila que ya está y no
genera una segunda transición.

No se guarda el cuerpo de Mercado Pago ni ningún dato del pagador: los
identificadores para poder volver a consultar, el estado, el importe con su
moneda para poder compararlos y las dos fechas que hacen falta para saber qué
noticia es más nueva.
"""
from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Numeric,
    String,
)
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.db.base import Base


class MPIntentoDePago(Base):
    __tablename__ = "mp_intentos_de_pago"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # A qué orden y a qué intención local pertenece.
    order_id = Column(
        String(36), ForeignKey("orders.id"), nullable=False, index=True
    )
    payment_id = Column(
        String(36), ForeignKey("payments.id"), nullable=False, index=True
    )

    # El identificador del pago en Mercado Pago. Único: es lo que hace que un
    # aviso duplicado no se convierta en dos intentos.
    mp_payment_id = Column(String(100), nullable=False, unique=True, index=True)

    # El estado tal como lo devuelve la consulta a Mercado Pago, en minúsculas:
    # pending, in_process, approved, rejected, cancelled, refunded,
    # charged_back. No se traduce acá; traducir es decidir, y esa decisión vive
    # en el servicio de cobro.
    estado = Column(String(30), nullable=False, index=True)

    # Importe y moneda del intento, para poder compararlos con la orden.
    monto = Column(Numeric(14, 2), nullable=False)
    moneda = Column(String(3), nullable=False)

    # Cuándo lo actualizó Mercado Pago. Es lo que ordena las noticias: una que
    # trae una fecha anterior a la última que aplicamos es una noticia vieja.
    mp_actualizado_el = Column(DateTime, nullable=True)
    mp_aprobado_el = Column(DateTime, nullable=True)

    creado_el = Column(DateTime, default=datetime.utcnow, nullable=False)
    actualizado_el = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    payment = relationship("Payment", back_populates="intentos")

    def __repr__(self):
        return f"<MPIntentoDePago {self.mp_payment_id} - {self.estado}>"
