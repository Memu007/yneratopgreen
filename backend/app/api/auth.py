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
    ChangePasswordRequest,
    RegistroPendienteResponse,
    VerificarCorreoRequest,
    ReenviarVerificacionRequest,
    MensajeResponse,
)
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token
)
from sqlalchemy import func
from app.core.dependencies import (
    bearer_del_header,
    credencial_unica,
    get_current_user,
)
from app.core.config import settings
from app.api.notifications import notify_welcome
from app.models.order import Order
from app.models.locality import Locality
from app.services.correo import ErrorDeCorreo
from app.services import verificacion
from app.services.verificacion import ResultadoDeVerificacion
import structlog


logger = structlog.get_logger()

router = APIRouter(prefix="/auth", tags=["autenticación"])

# Un mismo texto para toda respuesta de reenvío. Si dijéramos «esa cuenta no
# existe» o «ya está verificada», cualquiera podría averiguar qué correos están
# registrados probando de a uno.
RESPUESTA_GENERICA_DE_REENVIO = (
    "Si el correo corresponde a una cuenta sin confirmar, te enviamos un enlace "
    "nuevo. Revisá tu casilla."
)

MOTIVO_PENDIENTE = (
    "Tu cuenta todavía no está confirmada. Buscá el correo que te enviamos o "
    "pedí un enlace nuevo."
)


@router.post(
    "/register",
    response_model=RegistroPendienteResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_user(
    user_data: UserRegisterRequest,
    db: Session = Depends(get_db)
):
    """
    Registrar nuevo usuario

    - Verifica que el email no esté en uso
    - Hashea la contraseña
    - Crea el usuario SIN verificar
    - Manda el enlace de confirmación y NO devuelve sesión: ni tokens ni
      cookies. La cuenta no sirve hasta confirmar el correo.
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
        carrier_certification_detail=(
            user_data.carrier_certification_detail.strip()
            if user_data.is_carrier and user_data.carrier_certification_detail
            else None
        ),
        # La fecha la pone el servidor: nadie la escribe ni la retrodata.
        carrier_certification_declared_at=(
            datetime.utcnow() if user_data.is_carrier else None
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
    db.flush()

    # El alta y el envío van juntos: si el correo no sale, no queda una cuenta
    # a la que nadie pueda entrar nunca.
    try:
        verificacion.emitir_y_enviar(db, new_user)
    except ErrorDeCorreo as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "No pudimos enviarte el correo de confirmación, así que no "
                "creamos la cuenta. Probá de nuevo en un rato."
            ),
        ) from error

    db.commit()
    db.refresh(new_user)

    # Enviar notificación de bienvenida
    try:
        notify_welcome(db, new_user.id, new_user.full_name)
    except Exception as e:
        # No fallar si la notificación falla
        pass

    return RegistroPendienteResponse(
        email=new_user.email,
        message=(
            f"Te mandamos un correo a {new_user.email}. Confirmalo para poder "
            "ingresar; el enlace vence en 24 horas."
        ),
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

    # Sin correo confirmado no hay sesión. El motivo es explícito a propósito:
    # acá ya se probó la contraseña, así que decirlo no revela nada que quien
    # pregunta no sepa, y sin el motivo real la persona no sabe qué hacer.
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=MOTIVO_PENDIENTE,
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


@router.post("/verify-email", response_model=MensajeResponse)
def verify_email(
    datos: VerificarCorreoRequest,
    db: Session = Depends(get_db)
):
    """
    Confirmar el correo con el token del enlace.

    No devuelve sesión: confirma y la persona entra por el login normal.
    """
    resultado, usuario = verificacion.consumir(db, datos.token)

    if resultado == ResultadoDeVerificacion.OK:
        db.commit()
        return MensajeResponse(
            message=f"Listo, {usuario.full_name}. Ya podés iniciar sesión."
        )

    db.rollback()

    motivos = {
        ResultadoDeVerificacion.VENCIDO: (
            "El enlace venció. Pedí uno nuevo desde el ingreso."
        ),
        ResultadoDeVerificacion.YA_USADO: (
            "Este enlace ya se usó. Si todavía no podés entrar, pedí uno nuevo."
        ),
        ResultadoDeVerificacion.INVALIDO: (
            "El enlace no es válido. Pedí uno nuevo desde el ingreso."
        ),
    }
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=motivos[resultado],
    )


@router.post("/resend-verification", response_model=MensajeResponse)
def resend_verification(
    datos: ReenviarVerificacionRequest,
    db: Session = Depends(get_db)
):
    """
    Reenviar el enlace de confirmación.

    Responde lo mismo exista o no la cuenta, esté o no verificada: si el texto
    cambiara, esto sería un buscador de correos registrados.
    """
    usuario = db.query(User).filter(User.email == datos.email).first()

    if usuario is None or usuario.is_verified or not usuario.is_active:
        return MensajeResponse(message=RESPUESTA_GENERICA_DE_REENVIO)

    try:
        # Invalida los pendientes y emite uno solo. No crea otra cuenta ni
        # duplica la que ya está.
        verificacion.emitir_y_enviar(db, usuario)
        db.commit()
    except ErrorDeCorreo:
        # El fallo del transporte NO puede salir al llamador. Si acá
        # devolviéramos 503 y en los otros dos casos 200, el código de estado
        # diría «esta cuenta existe y está pendiente» cada vez que el correo
        # esté caído o mal configurado, que es justo lo que la respuesta
        # genérica quiere evitar. Queda registrado adentro, sin la dirección ni
        # el token.
        db.rollback()
        logger.error("reenvio_de_verificacion_sin_enviar")

    return MensajeResponse(message=RESPUESTA_GENERICA_DE_REENVIO)


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
    # Cookie o header, pero no las dos con tokens distintos: en ese caso
    # corta antes de decodificar, de mirar la base y de emitir nada.
    refresh_token = credencial_unica(
        request, "refresh_token", bearer_del_header(request)
    )

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

    # Un refresh token emitido antes de esta pieza no puede servir para saltear
    # la confirmación.
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=MOTIVO_PENDIENTE,
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


CAMPOS_DE_TRANSPORTISTA = (
    "carrier_base_locality_id",
    "carrier_transport",
    "carrier_transport_certified",
    "carrier_certification_detail",
    "carrier_coverage_radius_km",
    "carrier_capacity",
)


def _aplicar_perfil_de_transportista(
    update_data: UserUpdateRequest,
    current_user: User,
    db: Session,
) -> None:
    """Valida y aplica los datos de transportista de una edición de perfil.

    Trabaja sobre el estado *prospectivo* —lo enviado sobre lo guardado— y
    recién asigna cuando el conjunto entero es válido. Así una edición parcial,
    por ejemplo vaciar el transporte, no puede dejar un perfil que el alta
    habría rechazado. No devuelve nada: modifica el usuario en memoria y la
    escritura la hace el commit del endpoint.
    """
    enviados = update_data.model_dump(exclude_unset=True)
    cambios = {campo: enviados[campo] for campo in CAMPOS_DE_TRANSPORTISTA if campo in enviados}
    if not cambios:
        return

    if not current_user.is_carrier:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Tu cuenta no tiene perfil de transportista, así que no hay "
                "datos de transporte para editar."
            ),
        )

    prospectivo = {
        campo: cambios.get(campo, getattr(current_user, campo))
        for campo in CAMPOS_DE_TRANSPORTISTA
    }
    localidad = (prospectivo["carrier_base_locality_id"] or "").strip() or None
    transporte = (prospectivo["carrier_transport"] or "").strip() or None
    habilitado = bool(prospectivo["carrier_transport_certified"])
    detalle = (prospectivo["carrier_certification_detail"] or "").strip() or None
    radio = prospectivo["carrier_coverage_radius_km"]
    capacidad = (prospectivo["carrier_capacity"] or "").strip() or None

    if not localidad:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La localidad base es obligatoria para transportistas",
        )
    if not db.query(Locality.id).filter(Locality.id == localidad).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La localidad base no pertenece al padrón",
        )
    if not transporte:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El transporte es obligatorio para transportistas",
        )
    if not habilitado:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El transporte debe estar habilitado",
        )
    if not detalle:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Contá qué habilitación tenés: organismo, tipo y número si lo hay",
        )
    # El esquema ya rechaza un radio no positivo que venga en el envío; esto
    # cubre además un valor guardado que hubiera quedado fuera de contrato.
    if radio is None or float(radio) <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El radio de cobertura tiene que ser mayor que cero",
        )

    # Una declaración nueva —o un detalle distinto— es una declaración nueva, y
    # lleva la fecha de hoy. Guardar sin cambiar el detalle no la mueve: sería
    # rejuvenecer una declaración vieja sin que nadie declarara nada.
    declaracion_nueva = (
        detalle != current_user.carrier_certification_detail
        or current_user.carrier_certification_declared_at is None
        or not current_user.carrier_transport_certified
    )

    current_user.carrier_base_locality_id = localidad
    current_user.carrier_transport = transporte
    current_user.carrier_transport_certified = habilitado
    current_user.carrier_certification_detail = detalle
    if declaracion_nueva:
        current_user.carrier_certification_declared_at = datetime.utcnow()
    current_user.carrier_coverage_radius_km = radio
    current_user.carrier_capacity = capacidad


@router.patch("/me", response_model=UserResponse)
def update_current_user(
    update_data: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Actualizar perfil del usuario actual
    """
    # El perfil de transportista se valida entero y ANTES de tocar el modelo:
    # un envío parcial no puede dejarlo en un estado que el alta rechazaría.
    _aplicar_perfil_de_transportista(update_data, current_user, db)

    # Actualizar campos si vienen en el request
    if update_data.full_name is not None:
        current_user.full_name = update_data.full_name
    
    # Un campo vacío se guarda como ausente, igual que CBU y alias. Si no, una
    # cuenta sin teléfono que abre el perfil y guarda sin tocar nada pasaría de
    # "sin dato" a "cadena vacía": el mismo dibujo en pantalla, otro valor en
    # base y otra respuesta de la API.
    if update_data.phone is not None:
        current_user.phone = update_data.phone.strip() or None

    if update_data.whatsapp is not None:
        current_user.whatsapp = update_data.whatsapp.strip() or None

    if update_data.bio is not None:
        current_user.bio = update_data.bio.strip() or None

    if update_data.location is not None:
        current_user.location = update_data.location.strip() or None

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
