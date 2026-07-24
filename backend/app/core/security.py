"""
Utilidades de seguridad: hashing de contraseñas y JWT tokens
"""
from datetime import datetime, timedelta
from typing import Optional
from jose import jwt, JWTError
import bcrypt
from .config import settings


def hash_password(password: str) -> str:
    """Hashea una contraseña usando bcrypt"""
    # Convertir a bytes y hashear
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica una contraseña contra su hash"""
    password_bytes = plain_password.encode('utf-8')
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hashed_bytes)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Crea un JWT access token"""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_MINUTES)
    
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """Crea un JWT refresh token (larga duración)"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Optional[dict]:
    """Decodifica y valida un JWT token"""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


def create_oauth_state_token(user_id: str, expires_minutes: int = 30) -> str:
    """
    Crea un token TG-xxx para el state de OAuth de MercadoPago.
    
    Este token permite identificar al usuario cuando vuelve del callback
    de autorización de MP, incluso si hay múltiples usuarios autorizando
    al mismo tiempo.
    
    Formato: TG-{jwt_encoded}
    """
    expire = datetime.utcnow() + timedelta(minutes=expires_minutes)
    data = {
        "sub": user_id,
        "exp": expire,
        "type": "oauth_state",
        "iat": datetime.utcnow()
    }
    token = jwt.encode(data, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return f"TG-{token}"


def decode_oauth_state_token(state: str) -> Optional[str]:
    """
    Decodifica y valida un token TG-xxx de OAuth state.
    
    Retorna el user_id si el token es válido, None si no lo es.
    """
    # Verificar que empieza con TG-
    if not state or not state.startswith("TG-"):
        return None
    
    # Extraer el JWT (quitar el prefijo TG-)
    token = state[3:]
    
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        
        # Verificar que es un token de tipo oauth_state
        if payload.get("type") != "oauth_state":
            return None
        
        return payload.get("sub")  # user_id
    except JWTError:
        return None
