"""
Schemas para mensajes de contacto
"""
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from uuid import UUID
from datetime import datetime


class ContactMessageCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    phone: Optional[str] = Field(None, max_length=50)
    subject: str = Field(..., min_length=5, max_length=255)
    message: str = Field(..., min_length=10)


class ContactMessageResponse(BaseModel):
    id: UUID
    full_name: str
    email: str
    phone: Optional[str]
    subject: str
    message: str
    is_read: bool
    is_replied: bool
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class ContactMessageListResponse(BaseModel):
    items: list[ContactMessageResponse]
    total: int
    unread_count: int
