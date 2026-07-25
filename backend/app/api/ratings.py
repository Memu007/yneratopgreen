"""
API Router para calificaciones de usuarios
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional

from app.db.base import get_db
from app.models.rating import Rating
from app.models.order import Order, OrderStatus
from app.models.user import User
from app.core.dependencies import get_current_user

router = APIRouter(prefix="/ratings", tags=["ratings"])


class RatingCreate(BaseModel):
    """Schema para crear una calificación"""
    order_id: str
    score: int = Field(..., ge=1, le=5, description="Calificación de 1 a 5 estrellas")
    comment: Optional[str] = Field(None, max_length=500)


class RatingResponse(BaseModel):
    """Schema de respuesta de calificación"""
    id: str
    order_id: str
    reviewer_name: str
    score: int
    comment: Optional[str]
    rating_type: str
    created_at: datetime


class UserReputationResponse(BaseModel):
    """Schema de reputación de usuario"""
    user_id: str
    user_name: str
    rating_average: float
    rating_count: int
    sales_count: int
    purchases_count: int


@router.post("/", response_model=RatingResponse)
def create_rating(
    rating_data: RatingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Crear una calificación para una orden completada.
    
    - El comprador califica al vendedor cuando la orden está DELIVERED
    - Solo se puede calificar una vez por orden
    """
    # Buscar la orden (puede venir como order_number o como UUID)
    order = db.query(Order).filter(Order.order_number == rating_data.order_id).first()
    if not order:
        # Intentar buscar por ID directo
        order = db.query(Order).filter(Order.id == rating_data.order_id).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    
    # Verificar que la orden esté entregada
    if order.status != OrderStatus.DELIVERED:
        raise HTTPException(
            status_code=400, 
            detail="Solo puedes calificar órdenes entregadas"
        )
    
    # Determinar quién califica a quién
    if order.buyer_id == current_user.id:
        # Comprador califica al vendedor
        rating_type = "buyer_to_seller"
        reviewed_id = order.seller_id
    elif order.seller_id == current_user.id:
        # Vendedor califica al comprador
        rating_type = "seller_to_buyer"
        reviewed_id = order.buyer_id
    else:
        raise HTTPException(status_code=403, detail="No tienes permiso para calificar esta orden")
    
    # Verificar que no haya calificado ya
    existing_rating = db.query(Rating).filter(
        Rating.order_id == order.id,
        Rating.reviewer_id == current_user.id
    ).first()
    
    if existing_rating:
        raise HTTPException(status_code=400, detail="Ya has calificado esta orden")
    
    # Crear la calificación
    rating = Rating(
        order_id=order.id,
        reviewer_id=current_user.id,
        reviewed_id=reviewed_id,
        score=rating_data.score,
        comment=rating_data.comment,
        rating_type=rating_type
    )
    
    db.add(rating)
    
    # Actualizar promedio del usuario calificado
    reviewed_user = db.query(User).filter(User.id == reviewed_id).first()
    if reviewed_user:
        # Calcular nuevo promedio
        all_ratings = db.query(Rating).filter(Rating.reviewed_id == reviewed_id).all()
        total_score = sum(r.score for r in all_ratings) + rating_data.score
        new_count = len(all_ratings) + 1
        new_average = total_score / new_count
        
        reviewed_user.rating_average = round(new_average, 2)
        reviewed_user.rating_count = new_count
    
    db.commit()
    db.refresh(rating)
    
    return RatingResponse(
        id=rating.id,
        order_id=rating.order_id,
        reviewer_name=current_user.full_name,
        score=rating.score,
        comment=rating.comment,
        rating_type=rating.rating_type,
        created_at=rating.created_at
    )


@router.get("/user/{user_id}", response_model=UserReputationResponse)
def get_user_reputation(
    user_id: str,
    db: Session = Depends(get_db)
):
    """Obtener la reputación de un usuario"""
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    return UserReputationResponse(
        user_id=user.id,
        user_name=user.full_name,
        rating_average=float(user.rating_average),
        rating_count=user.rating_count,
        sales_count=user.sales_count,
        purchases_count=user.purchases_count
    )


@router.get("/user/{user_id}/reviews", response_model=list[RatingResponse])
def get_user_reviews(
    user_id: str,
    db: Session = Depends(get_db)
):
    """Obtener todas las calificaciones recibidas por un usuario"""
    ratings = db.query(Rating).filter(Rating.reviewed_id == user_id).order_by(Rating.created_at.desc()).all()
    
    result = []
    for rating in ratings:
        reviewer = db.query(User).filter(User.id == rating.reviewer_id).first()
        result.append(RatingResponse(
            id=rating.id,
            order_id=rating.order_id,
            reviewer_name=reviewer.full_name if reviewer else "Usuario",
            score=rating.score,
            comment=rating.comment,
            rating_type=rating.rating_type,
            created_at=rating.created_at
        ))
    
    return result


@router.get("/order/{order_id}/can-rate")
def can_rate_order(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Verificar si el usuario puede calificar una orden"""
    order = db.query(Order).filter(Order.id == order_id).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    
    # Verificar participación
    if order.buyer_id != current_user.id and order.seller_id != current_user.id:
        return {"can_rate": False, "reason": "No eres parte de esta orden"}
    
    # Verificar estado
    if order.status != OrderStatus.DELIVERED:
        return {"can_rate": False, "reason": "La orden no ha sido entregada"}
    
    # Verificar si ya calificó
    existing = db.query(Rating).filter(
        Rating.order_id == order_id,
        Rating.reviewer_id == current_user.id
    ).first()
    
    if existing:
        return {"can_rate": False, "reason": "Ya has calificado esta orden"}
    
    return {"can_rate": True, "reason": None}
