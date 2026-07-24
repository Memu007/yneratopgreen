"""
API Router para mensajes de contacto
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from uuid import UUID
from datetime import datetime

from app.db.base import get_db
from app.models.contact import ContactMessage
from app.models.user import User, UserRole
from app.core.dependencies import get_current_user
from app.schemas.contact import (
    ContactMessageCreate,
    ContactMessageResponse,
    ContactMessageListResponse
)

router = APIRouter(prefix="/contact", tags=["contact"])


@router.post("", response_model=ContactMessageResponse, status_code=201)
async def submit_contact_message(
    message_data: ContactMessageCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Enviar mensaje de contacto (endpoint público, no requiere autenticación).
    Cualquier persona puede enviar un mensaje desde el formulario web.
    """
    # Obtener IP y user agent del request
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent", "")
    
    # Crear mensaje
    new_message = ContactMessage(
        full_name=message_data.full_name,
        email=message_data.email,
        phone=message_data.phone,
        subject=message_data.subject,
        message=message_data.message,
        ip_address=client_ip,
        user_agent=user_agent[:500]  # Limitar longitud
    )
    
    db.add(new_message)
    db.commit()
    db.refresh(new_message)
    
    return ContactMessageResponse.model_validate(new_message)


@router.get("", response_model=ContactMessageListResponse)
def get_contact_messages(
    unread_only: bool = False,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Obtener listado de mensajes de contacto.
    Solo administradores pueden ver los mensajes.
    """
    # Verificar que sea admin
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Solo administradores pueden ver los mensajes de contacto"
        )
    
    # Query base
    query = db.query(ContactMessage)
    
    # Filtrar solo no leídos si se solicita
    if unread_only:
        query = query.filter(ContactMessage.is_read == False)
    
    # Contar total y no leídos
    total = query.count()
    unread_count = db.query(func.count(ContactMessage.id)).filter(
        ContactMessage.is_read == False
    ).scalar()
    
    # Aplicar paginación y ordenar por más reciente
    messages = query.order_by(
        ContactMessage.created_at.desc()
    ).offset((page - 1) * page_size).limit(page_size).all()
    
    return ContactMessageListResponse(
        items=[ContactMessageResponse.model_validate(msg) for msg in messages],
        total=total,
        unread_count=unread_count
    )


@router.get("/{message_id}", response_model=ContactMessageResponse)
def get_contact_message_detail(
    message_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Obtener detalle de un mensaje de contacto.
    Al leerlo, se marca como leído automáticamente.
    """
    # Verificar que sea admin
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Solo administradores pueden ver los mensajes"
        )
    
    message = db.query(ContactMessage).filter(
        ContactMessage.id == message_id
    ).first()
    
    if not message:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    
    # Marcar como leído si no lo estaba
    if not message.is_read:
        message.is_read = True
        message.read_at = datetime.utcnow()
        db.commit()
        db.refresh(message)
    
    return ContactMessageResponse.model_validate(message)


@router.patch("/{message_id}/mark-replied")
def mark_message_as_replied(
    message_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Marcar mensaje como respondido.
    """
    # Verificar que sea admin
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Permiso denegado")
    
    message = db.query(ContactMessage).filter(
        ContactMessage.id == message_id
    ).first()
    
    if not message:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    
    message.is_replied = True
    message.replied_at = datetime.utcnow()
    
    # Asegurar que también esté marcado como leído
    if not message.is_read:
        message.is_read = True
        message.read_at = datetime.utcnow()
    
    db.commit()
    
    return {"message": "Mensaje marcado como respondido"}


@router.delete("/{message_id}")
def delete_contact_message(
    message_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Eliminar mensaje de contacto.
    Solo administradores.
    """
    # Verificar que sea admin
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Permiso denegado")
    
    message = db.query(ContactMessage).filter(
        ContactMessage.id == message_id
    ).first()
    
    if not message:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    
    db.delete(message)
    db.commit()
    
    return {"message": "Mensaje eliminado"}
