"""
API de Autenticación - Login, Register, Logout, etc
"""
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.db.base import get_db
from app.models.user import User
from app.schemas.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    UserResponse,
    AuthResponse,
    UserUpdateRequest,
    ChangePasswordRequest
)
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token
)
from sqlalchemy import func
from app.core.dependencies import get_current_user
from app.core.config import settings
from app.api.notifications import notify_welcome
from app.models.order import Order
from app.models.locality import Locality


router = APIRouter(prefix="/auth", tags=["autenticación"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register_user(
    user_data: UserRegisterRequest,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    Registrar nuevo usuario
    
    - Verifica que el email no esté en uso
    - Hashea la contraseña
    - Crea el usuario en la DB
    - Retorna tokens JWT en cookies HttpOnly
    """
    # Verificar si el email ya existe
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El email ya está registrado"
        )

    if user_data.is_carrier:
        locality_exists = db.query(Locality.id).filter(
            Locality.id == user_data.carrier_base_locality_id
        ).first()
        if not locality_exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La localidad base no pertenece al padrón",
            )
    
    # Crear nuevo usuario
    new_user = User(
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        full_name=user_data.full_name,
        phone=user_data.phone,
        role=user_data.role,
        is_active=True,
        is_verified=False,
        is_carrier=user_data.is_carrier,
        carrier_base_locality_id=(
            user_data.carrier_base_locality_id if user_data.is_carrier else None
        ),
        carrier_transport=(
            user_data.carrier_transport.strip() if user_data.is_carrier else None
        ),
        carrier_transport_certified=(
            user_data.carrier_transport_certified if user_data.is_carrier else False
        ),
        carrier_coverage_radius_km=(
            user_data.carrier_coverage_radius_km if user_data.is_carrier else None
        ),
        carrier_capacity=(
            (user_data.carrier_capacity or "").strip() or None
            if user_data.is_carrier
            else None
        ),
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Crear tokens
    access_token = create_access_token(data={"sub": new_user.id})
    refresh_token = create_refresh_token(data={"sub": new_user.id})
    
    # Setear cookies HttpOnly
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_MINUTES * 60,
        samesite="none",
        secure=True
    )
    
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=settings.REFRESH_TOKEN_DAYS * 24 * 60 * 60,
        samesite="none",
        secure=True
    )
    
    # Enviar notificación de bienvenida
    try:
        notify_welcome(db, new_user.id, new_user.full_name)
    except Exception as e:
        # No fallar si la notificación falla
        pass
    
    return AuthResponse(
        user=UserResponse.model_validate(new_user),
        access_token=access_token,
        refresh_token=refresh_token,
        message="Usuario registrado exitosamente"
    )


@router.post("/login", response_model=AuthResponse)
def login_user(
    credentials: UserLoginRequest,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    Iniciar sesión
    
    - Verifica email y contraseña
    - Genera tokens JWT
    - Retorna cookies HttpOnly
    """
    # Buscar usuario por email
    user = db.query(User).filter(User.email == credentials.email).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos"
        )
    
    # Verificar contraseña
    if not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos"
        )
    
    # Verificar que esté activo
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo. Contacte al administrador."
        )
    
    # Actualizar last_login
    user.last_login = datetime.utcnow()
    db.commit()
    
    # Crear tokens
    access_token = create_access_token(data={"sub": user.id})
    refresh_token = create_refresh_token(data={"sub": user.id})
    
    # Setear cookies HttpOnly
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_MINUTES * 60,
        samesite="none",
        secure=True
    )
    
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=settings.REFRESH_TOKEN_DAYS * 24 * 60 * 60,
        samesite="none",
        secure=True
    )
    
    # Calcular ventas y compras reales
    sales_count = db.query(func.count(Order.id)).filter(
        Order.seller_id == user.id
    ).scalar() or 0

    purchases_count = db.query(func.count(Order.id)).filter(
        Order.buyer_id == user.id
    ).scalar() or 0

    user_data = UserResponse.model_validate(user)
    user_data.sales_count = sales_count
    user_data.purchases_count = purchases_count

    return AuthResponse(
        user=user_data,
        access_token=access_token,
        refresh_token=refresh_token,
        message="Inicio de sesión exitoso"
    )


@router.post("/logout")
def logout_user(response: Response):
    """
    Cerrar sesión
    
    - Elimina las cookies de tokens
    """
    response.delete_cookie(key="access_token")
    response.delete_cookie(key="refresh_token")
    
    return {"message": "Sesión cerrada exitosamente"}


@router.post("/refresh", response_model=AuthResponse)
def refresh_access_token(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    Renovar access token usando refresh token
    
    - Lee el refresh_token desde cookies o header Authorization
    - Valida y genera nuevo access_token
    """
    # Intentar obtener refresh token desde cookie
    refresh_token = request.cookies.get("refresh_token")
    
    # Si no hay cookie, intentar desde header Authorization
    if not refresh_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            refresh_token = auth_header[7:]  # Remover "Bearer "
    
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token no encontrado"
        )
    
    # Decodificar refresh token
    payload = decode_token(refresh_token)
    
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido"
        )
    
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no válido"
        )
    
    # Crear nuevos tokens
    access_token = create_access_token(data={"sub": user.id})
    new_refresh_token = create_refresh_token(data={"sub": user.id})
    
    # Setear cookies
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_MINUTES * 60,
        samesite="none",
        secure=True
    )
    
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        max_age=settings.REFRESH_TOKEN_DAYS * 24 * 60 * 60,
        samesite="none",
        secure=True
    )
    
    # Calcular ventas y compras reales
    sales_count = db.query(func.count(Order.id)).filter(
        Order.seller_id == user.id
    ).scalar() or 0

    purchases_count = db.query(func.count(Order.id)).filter(
        Order.buyer_id == user.id
    ).scalar() or 0

    user_data = UserResponse.model_validate(user)
    user_data.sales_count = sales_count
    user_data.purchases_count = purchases_count

    return AuthResponse(
        user=user_data,
        access_token=access_token,
        refresh_token=new_refresh_token,
        message="Token renovado exitosamente"
    )


@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obtener información del usuario actual
    
    - Requiere autenticación (token JWT)
    """
    # Calcular ventas y compras reales en lugar del contador guardado
    sales_count = db.query(func.count(Order.id)).filter(
        Order.seller_id == current_user.id
    ).scalar() or 0

    purchases_count = db.query(func.count(Order.id)).filter(
        Order.buyer_id == current_user.id
    ).scalar() or 0

    user_data = UserResponse.model_validate(current_user)
    user_data.sales_count = sales_count
    user_data.purchases_count = purchases_count
    return user_data


@router.patch("/me", response_model=UserResponse)
def update_current_user(
    update_data: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Actualizar perfil del usuario actual
    """
    # Actualizar campos si vienen en el request
    if update_data.full_name is not None:
        current_user.full_name = update_data.full_name
    
    if update_data.phone is not None:
        current_user.phone = update_data.phone
    
    if update_data.whatsapp is not None:
        current_user.whatsapp = update_data.whatsapp
    
    if update_data.bio is not None:
        current_user.bio = update_data.bio
    
    if update_data.location is not None:
        current_user.location = update_data.location
    
    if update_data.avatar_url is not None:
        current_user.avatar_url = update_data.avatar_url

    if update_data.cbu is not None:
        current_user.cbu = update_data.cbu.strip() or None

    if update_data.alias_bancario is not None:
        current_user.alias_bancario = update_data.alias_bancario.strip() or None
    
    current_user.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(current_user)
    
    # Calcular ventas y compras reales
    sales_count = db.query(func.count(Order.id)).filter(
        Order.seller_id == current_user.id
    ).scalar() or 0

    purchases_count = db.query(func.count(Order.id)).filter(
        Order.buyer_id == current_user.id
    ).scalar() or 0

    user_data = UserResponse.model_validate(current_user)
    user_data.sales_count = sales_count
    user_data.purchases_count = purchases_count
    return user_data


@router.post("/change-password")
def change_password(
    password_data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cambiar contraseña del usuario actual
    """
    # Verificar contraseña actual
    if not verify_password(password_data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Contraseña actual incorrecta"
        )
    
    # Actualizar contraseña
    current_user.password_hash = hash_password(password_data.new_password)
    current_user.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {"message": "Contraseña actualizada exitosamente"}
