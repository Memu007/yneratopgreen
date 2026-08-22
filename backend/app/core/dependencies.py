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

# La cookie NO autentica rutas protegidas. Es una credencial ambiental: el
# navegador la manda sola, sin que la página lo pida, y eso alcanzaba para que
# un sitio ajeno actuara en nombre de quien lo visitara. Estaba demostrado, no
# supuesto: una carga multipart desde otro origen reemplazaba la documentación
# fiscal de un vendedor. Lo que lo cierra no es un atributo bien puesto ni un
# token de comprobación, es que **no hay camino**: acá la credencial sale del
# header `Authorization` y de ningún otro lado.
#
# La cookie sigue existiendo por un único motivo, y sólo la lee
# `get_current_user_optional`: la vuelta de Mercado Pago es una navegación de
# nivel superior, y ninguna cabecera puede acompañarla. Esa ruta ya se defiende
# sola con su `state` de un solo uso.
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


def token_del_header(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> str:
    """
    El token de acceso, del header `Authorization`. De ahí y de ningún otro lado.

    No mira la cookie a propósito. Una cookie viaja sola en cualquier petición
    que el navegador haga hacia acá, la haya pedido nuestra página o la de un
    tercero; el header lo pone quien escribe la llamada. Por eso la cookie no
    puede ser la credencial de algo que cambia estado.

    Que acá no se lea la cookie es también lo que hace innecesaria la vieja
    regla de credenciales en conflicto: no hay dos fuentes que puedan
    contradecirse, hay una.
    """
    token = credentials.credentials if credentials else None

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autenticado. Token no encontrado.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return token


def get_current_user(
    token: str = Depends(token_del_header),
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

    Es el ÚNICO lugar que lee la cookie, y existe por la vuelta de Mercado
    Pago: una navegación de nivel superior a la que ninguna cabecera puede
    acompañar. Esa ruta no queda expuesta por leerla, porque se defiende con su
    `state` de un solo uso, que además se compara contra esta identidad.

    La comprobación de contradicción se conserva acá aunque una navegación no
    pueda traer header: si mañana esta dependencia se usa en una ruta que sí
    los recibe, una cookie de una cuenta y un header de otra volverían a
    personalizar en silencio por la primera. Con las dos, la respuesta queda
    anónima; no se rechaza, porque acá no estar autenticado es válido.
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
