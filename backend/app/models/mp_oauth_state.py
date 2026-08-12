"""Estados de OAuth de Mercado Pago.

El `state` es lo único que ata la vuelta de Mercado Pago con la persona que
inició el vínculo. Si fuera adivinable, o reusable, o eterno, alcanzaría con
que alguien fabricara un callback para colgar su cuenta de cobro del vendedor
equivocado. Así que vive acá, en una fila con dueño y con vencimiento, y se
gasta una sola vez.

Se guarda la **huella** del state, no el state. El valor viaja en una URL —o
sea que termina en el historial del navegador, en los logs del proxy y en el
`Referer`—, y lo que está en la base no tiene por qué servir para fabricar un
callback válido.
"""
from sqlalchemy import Column, String, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.db.base import Base


class MPOAuthState(Base):
    __tablename__ = "mp_oauth_states"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # SHA-256 en hexadecimal del state que viajó. Único: dos filas no pueden
    # reclamar el mismo callback.
    state_hash = Column(String(64), nullable=False, unique=True)

    creado_el = Column(DateTime, default=datetime.utcnow, nullable=False)
    expira_el = Column(DateTime, nullable=False)
    # Se sella al consumirlo. La fila queda como evidencia de que ya se usó,
    # que es justo lo que hace falta para rechazar el segundo callback.
    usado_el = Column(DateTime, nullable=True)

    user = relationship("User")

    __table_args__ = (
        Index("ix_mp_oauth_states_user_id", "user_id"),
    )
