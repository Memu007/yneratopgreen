"""
Modelo de Rating - Sistema de calificaciones entre usuarios
"""
from sqlalchemy import Column, String, DateTime, Integer, Numeric, ForeignKey, Text, CheckConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.db.base import Base


class Rating(Base):
    """
    Calificación de una transacción.
    El comprador califica al vendedor después de recibir el producto.
    Opcionalmente, el vendedor puede calificar al comprador.
    """
    __tablename__ = "ratings"

    # Identificación
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Referencia a la orden (una calificación por orden por persona)
    order_id = Column(String(36), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Quién califica y a quién
    reviewer_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)  # Quien da la calificación
    reviewed_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)  # Quien recibe la calificación
    
    # Calificación (1-5 estrellas)
    score = Column(Integer, nullable=False)
    
    # Comentario opcional
    comment = Column(Text, nullable=True)
    
    # Tipo: 'buyer_to_seller' o 'seller_to_buyer'
    rating_type = Column(String(20), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Constraints
    __table_args__ = (
        CheckConstraint('score >= 1 AND score <= 5', name='check_score_range'),
    )
    
    # Relaciones
    order = relationship("Order", backref="ratings")
    reviewer = relationship("User", foreign_keys=[reviewer_id], backref="ratings_given")
    reviewed = relationship("User", foreign_keys=[reviewed_id], backref="ratings_received")

    def __repr__(self):
        return f"<Rating {self.score}★ from {self.reviewer_id} to {self.reviewed_id}>"
