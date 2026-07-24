"""
Modelo de Mensajes de Contacto
"""
from sqlalchemy import Column, String, DateTime, Text, Boolean
from datetime import datetime
import uuid

from app.db.base import Base


class ContactMessage(Base):
    __tablename__ = "contact_messages"

    # Identificación
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Datos del remitente
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    
    # Mensaje
    subject = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    
    # Estado
    is_read = Column(Boolean, default=False, nullable=False)
    is_replied = Column(Boolean, default=False, nullable=False)
    
    # Metadata
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    read_at = Column(DateTime, nullable=True)
    replied_at = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<ContactMessage from {self.email}: {self.subject}>"
