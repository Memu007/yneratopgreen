"""
Modelo de tokens de verificación de correo.

En la base se guarda el HASH del token, nunca el token en claro: quien lea la
tabla no puede verificar cuentas ajenas. El valor original existe sólo en el
enlace que recibe la persona.
"""
from sqlalchemy import Column, DateTime, ForeignKey, String, Index
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.db.base import Base


class EmailVerificationToken(Base):
    __tablename__ = "email_verification_tokens"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # sha256 en hexadecimal: 64 caracteres. Único para que dos tokens no puedan
    # colisionar en silencio.
    token_hash = Column(String(64), nullable=False, unique=True, index=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)

    # Un solo uso: al verificar se sella consumed_at. invalidated_at lo sella el
    # reenvío sobre los pendientes anteriores. Los dos son nulos mientras el
    # token sirve.
    consumed_at = Column(DateTime, nullable=True)
    invalidated_at = Column(DateTime, nullable=True)

    user = relationship("User")

    __table_args__ = (
        Index("ix_email_verification_tokens_user_pendiente", "user_id", "consumed_at"),
    )

    def __repr__(self):
        return f"<EmailVerificationToken user={self.user_id} vence={self.expires_at}>"
