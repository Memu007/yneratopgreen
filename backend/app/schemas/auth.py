"""
Schemas de Autenticación - Validación de requests y responses
"""
from pydantic import BaseModel, EmailStr, Field, model_validator
from typing import Optional
from datetime import datetime

from app.models.user import UserRole


# === REGISTRO === #

class UserRegisterRequest(BaseModel):
    """Request para registro de usuario"""
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)
    full_name: str = Field(..., min_length=2, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    role: UserRole = UserRole.USER  # Por defecto usuario normal
    is_carrier: bool = False
    carrier_base_locality_id: Optional[str] = Field(None, max_length=20)
    carrier_transport: Optional[str] = Field(None, max_length=255)
    carrier_transport_certified: bool = False
    carrier_coverage_radius_km: Optional[float] = Field(None, gt=0)
    carrier_capacity: Optional[str] = Field(None, max_length=255)

    @model_validator(mode="after")
    def validate_carrier_profile(self):
        if not self.is_carrier:
            return self
        if not self.carrier_base_locality_id:
            raise ValueError("La localidad base es obligatoria para transportistas")
        if not self.carrier_transport or not self.carrier_transport.strip():
            raise ValueError("El transporte es obligatorio para transportistas")
        if not self.carrier_transport_certified:
            raise ValueError("El transporte debe estar habilitado")
        if self.carrier_coverage_radius_km is None:
            raise ValueError("El radio de cobertura es obligatorio para transportistas")
        return self
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "juan@ejemplo.com",
                "password": "mipassword123",
                "full_name": "Juan Pérez",
                "phone": "+54 11 1234-5678",
                "role": "user"
            }
        }


# === LOGIN === #

class UserLoginRequest(BaseModel):
    """Request para login"""
    email: EmailStr
    password: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "juan@ejemplo.com",
                "password": "mipassword123"
            }
        }


# === RESPONSE === #

class UserResponse(BaseModel):
    """Response con datos del usuario (sin password)"""
    id: str
    email: str
    full_name: str
    phone: Optional[str]
    whatsapp: Optional[str]
    role: UserRole
    is_active: bool
    is_verified: bool
    avatar_url: Optional[str]
    bio: Optional[str]
    location: Optional[str]
    cbu: Optional[str]
    alias_bancario: Optional[str]
    is_carrier: bool
    carrier_base_locality_id: Optional[str]
    carrier_transport: Optional[str]
    carrier_transport_certified: bool
    carrier_coverage_radius_km: Optional[float]
    carrier_capacity: Optional[str]
    rating_average: float = 5.0
    rating_count: int = 0
    sales_count: int = 0
    purchases_count: int = 0
    created_at: datetime
    last_login: Optional[datetime]
    
    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    """Response de autenticación exitosa"""
    user: UserResponse
    access_token: Optional[str] = None  # Token para usar en Authorization header
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    message: str = "Autenticación exitosa"
    
    class Config:
        json_schema_extra = {
            "example": {
                "user": {
                    "id": "uuid-123",
                    "email": "juan@ejemplo.com",
                    "full_name": "Juan Pérez",
                    "role": "user",
                    "is_active": True
                },
                "access_token": "eyJ...",
                "token_type": "bearer",
                "message": "Autenticación exitosa"
            }
        }


# === ACTUALIZACIÓN === #

class UserUpdateRequest(BaseModel):
    """Request para actualizar perfil de usuario"""
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    whatsapp: Optional[str] = Field(None, max_length=50)
    bio: Optional[str] = Field(None, max_length=500)
    location: Optional[str] = Field(None, max_length=255)
    avatar_url: Optional[str] = Field(None, max_length=500)
    cbu: Optional[str] = Field(None, max_length=64)
    alias_bancario: Optional[str] = Field(None, max_length=100)


class ChangePasswordRequest(BaseModel):
    """Request para cambiar contraseña"""
    current_password: str
    new_password: str = Field(..., min_length=6, max_length=100)
