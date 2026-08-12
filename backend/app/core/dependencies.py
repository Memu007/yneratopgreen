"""
Dependencies de Autenticación - Para proteger endpoints
"""
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional

from app.core.security import decode_token
from app.db.base import get_db
from app.models.user import User, UserRole


security = HTTPBearer(auto_error=False)

# Una petición puede traer la credencial en la cookie o en el header. Cuando
# trae las dos y no son el mismo token, no tiene UNA identidad: tiene dos, y
# quedarse con cualquiera de ellas es decidir por quien la mandó. Antes ganaba
# la cookie en silencio, así que una petición con el header de una cuenta y la
# cookie de otra se ejecutaba como la segunda. La regla es la misma para el
# token de acceso y para el de refresco.
CREDENCIALES_EN_CONFLICTO = "Credenciales en conflicto"


def hay_conflicto_de_credenciales(
    request: Request,
    nombre_de_cookie: str,
    del_header: Optional[str],
) -> bool:
    """
    Si la petición trae cookie y header, y no son el mismo token.
    """
    de_cookie = request.cookies.get(nombre_de_cookie)
    return bool(de_cookie and del_header and de_cookie != del_header)


def bearer_del_header(request: Request) -> Optional[str]:
    """
    El token del header Authorization, para quien no use la dependencia.
    """
    encabezado = request.headers.get("Authorization")
    if encabezado and encabezado.startswith("Bearer "):
        return encabezado[7:]
    return None


def credencial_unica(
    request: Request,
    nombre_de_cookie: str,
    del_header: Optional[str],
) -> Optional[str]:
    """
    La única credencial de la petición, o None si no trae ninguna.

    No hay preferencia entre cookie y header. Si vienen las dos y difieren,
    corta acá: antes de decodificar nada, antes de mirar la base y sin decir
    cuál de las dos servía. Tampoco se sigue con la otra después de rechazar
    una.
    """
    if hay_conflicto_de_credenciales(request, nombre_de_cookie, del_header):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=CREDENCIALES_EN_CONFLICTO,
            headers={"WWW-Authenticate": "Bearer"},
        )
    return request.cookies.get(nombre_de_cookie) or del_header


def get_token_from_cookie_or_header(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> str:
    """
    Obtiene el token JWT de la cookie o del header Authorization

    Con las dos presentes y distintas, la petición se rechaza: ver
    `credencial_unica`.
    """
    token = credencial_unica(
        request,
        "access_token",
        credentials.credentials if credentials else None,
    )

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autenticado. Token no encontrado.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return token


def get_current_user(
    token: str = Depends(get_token_from_cookie_or_header),
    db: Session = Depends(get_db)
) -> User:
    """
    Obtiene el usuario actual desde el token JWT
    """
    # Decodificar token
    payload = decode_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verificar que es un access token
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de tipo incorrecto",
        )
    
    # Obtener user_id del payload
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido: user_id no encontrado",
        )
    
    # Buscar usuario en la DB
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado",
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo",
        )

    # Sin correo confirmado no se accede a nada protegido, aunque el token sea
    # válido y esté vigente. Es el cierre que impide que un token emitido antes
    # de confirmar siga sirviendo.
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Tu cuenta todavía no está confirmada. Buscá el correo que te "
                "enviamos o pedí un enlace nuevo."
            ),
        )

    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Verifica que el usuario esté activo
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo"
        )
    return current_user


def require_role(allowed_roles: list[UserRole]):
    """
    Dependency factory para requerir roles específicos
    
    Uso:
        @app.get("/admin/users", dependencies=[Depends(require_role([UserRole.ADMIN]))])
    """
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Acceso denegado. Roles permitidos: {[r.value for r in allowed_roles]}"
            )
        return current_user
    
    return role_checker


# Shortcuts para roles comunes
def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Solo administradores"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Solo administradores."
        )
    return current_user


def require_seller(current_user: User = Depends(get_current_user)) -> User:
    """Solo vendedores o admins"""
    if current_user.role not in [UserRole.USER, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Solo vendedores."
        )
    return current_user


# Dependency opcional (no falla si no hay token)
def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Obtiene el usuario actual si existe token, sino retorna None
    Útil para endpoints públicos que pueden personalizar la respuesta si hay usuario

    Con credenciales contradictorias la respuesta queda anónima: personalizar
    sería elegir una de las dos identidades, que es justo lo que no se puede
    hacer. No se rechaza porque acá no estar autenticado es una respuesta
    válida.
    """
    try:
        if hay_conflicto_de_credenciales(
            request,
            "access_token",
            credentials.credentials if credentials else None,
        ):
            return None

        token = request.cookies.get("access_token")
        if not token:
            return None
        
        payload = decode_token(token)
        if not payload:
            return None
        
        user_id = payload.get("sub")
        if not user_id:
            return None
        
        # También acá: una cuenta sin confirmar es, para el resto del sistema,
        # como no estar autenticado.
        user = db.query(User).filter(
            User.id == user_id,
            User.is_active == True,
            User.is_verified == True,
        ).first()
        return user
    except:
        return None
