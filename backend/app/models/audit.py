"""
Modelo de Auditoría - Registro de acciones importantes del sistema
"""
from sqlalchemy import Column, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.db.base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    # Identificación
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    
    # Acción
    action = Column(String(100), nullable=False, index=True)  # login, create_product, update_order, etc
    entity = Column(String(100), nullable=True)  # product, order, user, etc
    entity_id = Column(String(36), nullable=True, index=True)
    
    # Metadata adicional (JSON flexible)
    metadata_json = Column(JSON, nullable=True)
    
    # IP y User Agent
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)
    
    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Relaciones
    user = relationship("User", back_populates="audit_logs")

    def __repr__(self):
        return f"<AuditLog {self.action} by user {self.user_id}>"
