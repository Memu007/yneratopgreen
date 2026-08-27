"""
Utilidades de seguridad: hashing de contraseñas y JWT tokens

Los JWT se firman y se validan con PyJWT. Antes era `python-jose`, que se
retiró por su cadena de dependencias: arrastra `ecdsa`, y `ecdsa` tiene el
ataque de temporización Minerva (CVE-2024-23342) declarado fuera de alcance
por su propio proyecto, o sea sin arreglo posible. Ninguna versión de
`python-jose` existe sin esa dependencia.

El cambio es de biblioteca y no de contrato: mismo algoritmo, mismas
reclamaciones, mismo vencimiento y el mismo secreto. Un token emitido por la
implementación anterior sigue siendo válido acá y viceversa, así que nadie
pierde la sesión al desplegar. El caso 130 de la suite lo comprueba.
"""
from datetime import datetime, timedelta
from typing import Optional
import jwt
from jwt import PyJWTError
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
    except PyJWTError:
        return None

