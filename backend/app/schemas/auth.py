"""
Schemas de Autenticación - Validación de requests y responses
"""
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from typing import List, Optional
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
    # El detalle de la declaración lo escribe el transportista; la fecha la
    # pone el servidor y no viaja en el pedido.
    carrier_certification_detail: Optional[str] = Field(None, max_length=500)
    carrier_coverage_radius_km: Optional[float] = Field(None, gt=0)
    carrier_capacity: Optional[str] = Field(None, max_length=255)
    # Los tres opcionales. Que sean opcionales no es un descuido: un
    # transportista tiene que poder darse de alta sin ellos, y un perfil que
    # ya existía no puede volverse inválido porque aparecieron campos nuevos.
    # Los `max_length` de acá son un tope contra un envío desmedido, no el
    # límite que se le anuncia a la persona: ese lo aplica el servicio, en
    # castellano y diciendo el número. Dos capas con el mismo número harían
    # ganar siempre a la que peor lo explica.
    carrier_vehicle_model: Optional[str] = Field(None, max_length=500)
    carrier_plate: Optional[str] = Field(None, max_length=500)
    carrier_cargo_types: Optional[List[str]] = None
    carrier_cargo_other: Optional[str] = Field(None, max_length=500)

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
        if not (self.carrier_certification_detail or "").strip():
            raise ValueError(
                "Contá qué habilitación tenés: organismo, tipo y número si lo hay"
            )
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
    # Derivados del padrón: la interfaz necesita el nombre para mostrarlo y la
    # provincia para poder abrir el selector en la localidad guardada.
    carrier_base_locality_name: Optional[str] = None
    carrier_base_province_id: Optional[str] = None
    carrier_base_province_name: Optional[str] = None
    carrier_transport: Optional[str]
    carrier_transport_certified: bool
    carrier_certification_detail: Optional[str] = None
    carrier_certification_declared_at: Optional[datetime] = None
    carrier_coverage_radius_km: Optional[float]
    carrier_capacity: Optional[str]
    carrier_vehicle_model: Optional[str] = None
    # El dominio aparece acá porque esta respuesta es la del propio perfil y la
    # de administración: quien lo escribió tiene que poder verlo y corregirlo.
    # A lo público no sale nunca desde este esquema, que no se usa en el
    # directorio ni en el catálogo.
    carrier_plate: Optional[str] = None
    carrier_cargo_types: List[str] = []
    carrier_cargo_other: Optional[str] = None
    rating_average: float = 5.0
    rating_count: int = 0
    sales_count: int = 0
    purchases_count: int = 0
    created_at: datetime
    last_login: Optional[datetime]

    @field_validator("carrier_cargo_types", mode="before")
    @classmethod
    def _sin_declarar_es_lista_vacia(cls, valor):
        """En la base «no declaró nada» es NULL; para quien consume la
        respuesta es una lista vacía. Que la diferencia se resuelva acá y no en
        cada pantalla."""
        return valor or []

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
    # Perfil de transportista. `is_carrier` no entra acá a propósito: quién
    # puede volverse transportista, o dejar de serlo, es una política que
    # todavía no está decidida. Desde el perfil sólo se editan los datos de
    # quien ya lo es.
    carrier_base_locality_id: Optional[str] = Field(None, max_length=20)
    carrier_transport: Optional[str] = Field(None, max_length=255)
    carrier_transport_certified: Optional[bool] = None
    # La fecha de la declaración no se acepta desde afuera: la escribe el
    # servidor cuando cambia el detalle o se vuelve a declarar.
    carrier_certification_detail: Optional[str] = Field(None, max_length=500)
    carrier_coverage_radius_km: Optional[float] = Field(None, gt=0)
    carrier_capacity: Optional[str] = Field(None, max_length=255)
    # Los `max_length` de acá son un tope contra un envío desmedido, no el
    # límite que se le anuncia a la persona: ese lo aplica el servicio, en
    # castellano y diciendo el número. Dos capas con el mismo número harían
    # ganar siempre a la que peor lo explica.
    carrier_vehicle_model: Optional[str] = Field(None, max_length=500)
    carrier_plate: Optional[str] = Field(None, max_length=500)
    carrier_cargo_types: Optional[List[str]] = None
    carrier_cargo_other: Optional[str] = Field(None, max_length=500)


class ChangePasswordRequest(BaseModel):
    """Request para cambiar contraseña"""
    current_password: str
    new_password: str = Field(..., min_length=6, max_length=100)


# === VERIFICACIÓN DE CORREO === #

class RegistroPendienteResponse(BaseModel):
    """Respuesta del alta. No lleva tokens: la cuenta no tiene sesión hasta
    que se confirma el correo."""
    email: EmailStr
    verification_required: bool = True
    message: str


class VerificarCorreoRequest(BaseModel):
    """El token viaja en el cuerpo y no en la URL de la API: así no queda en
    los registros de acceso del servidor ni en el encabezado Referer."""
    token: str = Field(..., min_length=16, max_length=512)


class ReenviarVerificacionRequest(BaseModel):
    email: EmailStr


class MensajeResponse(BaseModel):
    message: str
