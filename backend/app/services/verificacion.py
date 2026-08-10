"""
Verificación de correo: emisión, reenvío y consumo de tokens.

Reglas que sostiene este módulo:

- el token es aleatorio criptográfico y en la base sólo vive su sha256;
- vence exactamente a las 24 horas de emitido;
- es de un solo uso, y dos consumos simultáneos aceptan exactamente uno;
- emitir uno nuevo invalida todos los pendientes de esa persona.
"""
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import quote
import hashlib
import secrets

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.email_verification import EmailVerificationToken
from app.models.user import User
from app.services.correo import obtener_transporte

HORAS_DE_VIGENCIA = 24


class ResultadoDeVerificacion:
    """Motivos por los que un token no sirve. Se distinguen para que la
    interfaz pueda ofrecer el reenvío sólo cuando tiene sentido."""

    OK = "ok"
    INVALIDO = "invalido"
    VENCIDO = "vencido"
    YA_USADO = "ya_usado"


def _hashear(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _armar_enlace(token: str) -> str:
    """El token va en el FRAGMENTO, no en el query.

    El navegador nunca manda el fragmento al servidor, asi que el token no
    aparece en el registro de acceso de quien sirva el frontend. Con `?token=`
    quedaba escrito ahi por meses, que es un lugar donde nadie lo va a buscar.
    """
    base = (settings.FRONTEND_URL or "").rstrip("/")
    return f"{base}/verificar-correo#token={quote(token)}"


def _cuerpo_del_mensaje(nombre: str, enlace: str) -> str:
    return (
        f"Hola {nombre},\n\n"
        "Creaste una cuenta en TopGreen. Para poder ingresar, confirmá tu correo "
        "entrando en este enlace:\n\n"
        f"{enlace}\n\n"
        f"El enlace vence en {HORAS_DE_VIGENCIA} horas y sirve una sola vez.\n\n"
        "Si no fuiste vos, ignorá este mensaje: sin confirmar, la cuenta no se "
        "puede usar.\n\n"
        "TopGreen\n"
    )


def invalidar_pendientes(db: Session, user_id: str) -> int:
    """Sella los tokens que todavía servían. Devuelve cuántos."""
    ahora = datetime.utcnow()
    return (
        db.query(EmailVerificationToken)
        .filter(
            EmailVerificationToken.user_id == user_id,
            EmailVerificationToken.consumed_at.is_(None),
            EmailVerificationToken.invalidated_at.is_(None),
        )
        .update({EmailVerificationToken.invalidated_at: ahora}, synchronize_session=False)
    )


def emitir_y_enviar(db: Session, usuario: User) -> None:
    """Invalida los anteriores, emite uno nuevo y lo manda por correo.

    No hace commit: lo decide quien llama, para que el alta del usuario y su
    token entren o no entren juntos. Si el correo falla, la excepción sube y
    la transacción se descarta.
    """
    invalidar_pendientes(db, usuario.id)

    token = secrets.token_urlsafe(32)
    ahora = datetime.utcnow()
    db.add(
        EmailVerificationToken(
            user_id=usuario.id,
            token_hash=_hashear(token),
            created_at=ahora,
            expires_at=ahora + timedelta(hours=HORAS_DE_VIGENCIA),
        )
    )
    # El token queda en la base antes de que salga el correo: si el envío
    # falla, se deshace todo junto y no queda un token emitido que nadie
    # recibió.
    db.flush()

    obtener_transporte().enviar(
        destinatario=usuario.email,
        asunto="Confirmá tu correo en TopGreen",
        cuerpo=_cuerpo_del_mensaje(usuario.full_name, _armar_enlace(token)),
    )


def consumir(db: Session, token: str) -> tuple[str, Optional[User]]:
    """Intenta consumir el token. Devuelve (resultado, usuario)."""
    if not token or not token.strip():
        return ResultadoDeVerificacion.INVALIDO, None

    fila = (
        db.query(EmailVerificationToken)
        .filter(EmailVerificationToken.token_hash == _hashear(token.strip()))
        .first()
    )
    if fila is None or fila.invalidated_at is not None:
        return ResultadoDeVerificacion.INVALIDO, None
    if fila.consumed_at is not None:
        return ResultadoDeVerificacion.YA_USADO, None

    ahora = datetime.utcnow()
    if fila.expires_at <= ahora:
        return ResultadoDeVerificacion.VENCIDO, None

    # El consumo es un UPDATE condicional: dos verificaciones simultáneas
    # compiten por la misma fila y sólo una la encuentra sin consumir. Sin
    # esto, las dos leerían consumed_at nulo y las dos darían por buena la
    # verificación.
    filas = (
        db.query(EmailVerificationToken)
        .filter(
            EmailVerificationToken.id == fila.id,
            EmailVerificationToken.consumed_at.is_(None),
            EmailVerificationToken.invalidated_at.is_(None),
        )
        .update({EmailVerificationToken.consumed_at: ahora}, synchronize_session=False)
    )
    if filas != 1:
        return ResultadoDeVerificacion.YA_USADO, None

    usuario = db.query(User).filter(User.id == fila.user_id).first()
    if usuario is None:
        return ResultadoDeVerificacion.INVALIDO, None

    usuario.is_verified = True
    usuario.updated_at = ahora
    return ResultadoDeVerificacion.OK, usuario
