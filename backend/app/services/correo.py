"""
Envío de correo, con dos transportes y una sola interfaz.

- `outbox`: escribe el mensaje en una carpeta local. Es el de desarrollo y el
  de pruebas: el archivo es un correo real en formato RFC 822, así que la suite
  lee el enlace del mismo cuerpo que recibiría la persona. No hace falta un
  endpoint de prueba que devuelva el token, que sería un agujero.
- `smtp`: el productivo, con `smtplib` de la biblioteca estándar. No se agrega
  ninguna dependencia.

Ningún transporte registra el cuerpo del mensaje: el enlace lleva el token y
no tiene por qué aparecer en los logs.
"""
from abc import ABC, abstractmethod
from datetime import datetime
from email.message import EmailMessage
from pathlib import Path
import smtplib
import ssl
import uuid

import structlog

from app.core.config import settings

logger = structlog.get_logger()


class ErrorDeCorreo(Exception):
    """El mensaje no se pudo entregar al transporte."""


class TransporteDeCorreo(ABC):
    @abstractmethod
    def enviar(self, destinatario: str, asunto: str, cuerpo: str) -> None:
        ...


class TransporteOutbox(TransporteDeCorreo):
    """Guarda cada mensaje como un .eml en una carpeta que no se publica."""

    def __init__(self, carpeta: str):
        self.carpeta = Path(carpeta)

    def enviar(self, destinatario: str, asunto: str, cuerpo: str) -> None:
        try:
            self.carpeta.mkdir(parents=True, exist_ok=True)
        except OSError as error:
            raise ErrorDeCorreo(
                f"No se pudo crear la carpeta de outbox ({self.carpeta}): {error}"
            ) from error

        mensaje = EmailMessage()
        mensaje["From"] = settings.EMAIL_FROM
        mensaje["To"] = destinatario
        mensaje["Subject"] = asunto
        mensaje["Date"] = datetime.utcnow().strftime("%a, %d %b %Y %H:%M:%S +0000")
        # 8bit y no el quoted-printable por defecto: con QP el enlace queda
        # escrito como "token=3D..." y cortado por un salto blando, así que ni
        # una persona ni la suite pueden copiarlo del archivo. El mensaje sigue
        # siendo un correo válido; sólo cambia la codificación del cuerpo.
        mensaje.set_content(cuerpo, cte="8bit")

        # El nombre lleva la marca de tiempo para que el más reciente sea
        # evidente, y un sufijo al azar para que dos envíos del mismo segundo
        # no se pisen.
        nombre = f"{datetime.utcnow():%Y%m%d_%H%M%S}_{uuid.uuid4().hex[:8]}.eml"
        try:
            (self.carpeta / nombre).write_bytes(bytes(mensaje))
        except OSError as error:
            raise ErrorDeCorreo(f"No se pudo escribir el mensaje: {error}") from error

        logger.info("correo_guardado_en_outbox", archivo=nombre, asunto=asunto)


class TransporteSMTP(TransporteDeCorreo):
    """Entrega por SMTP. STARTTLS por defecto."""

    def enviar(self, destinatario: str, asunto: str, cuerpo: str) -> None:
        if not settings.SMTP_HOST:
            raise ErrorDeCorreo("SMTP_HOST no está configurado")

        mensaje = EmailMessage()
        mensaje["From"] = settings.EMAIL_FROM
        mensaje["To"] = destinatario
        mensaje["Subject"] = asunto
        mensaje.set_content(cuerpo)

        try:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as servidor:
                if settings.SMTP_TLS:
                    servidor.starttls(context=ssl.create_default_context())
                if settings.SMTP_USER:
                    servidor.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                servidor.send_message(mensaje)
        except (smtplib.SMTPException, OSError) as error:
            raise ErrorDeCorreo(f"SMTP rechazó el mensaje: {error}") from error

        logger.info("correo_enviado_por_smtp", asunto=asunto)


def obtener_transporte() -> TransporteDeCorreo:
    transporte = (settings.EMAIL_TRANSPORT or "outbox").strip().lower()
    if transporte == "smtp":
        return TransporteSMTP()
    if transporte == "outbox":
        return TransporteOutbox(settings.EMAIL_OUTBOX_DIR)
    raise ErrorDeCorreo(
        f"EMAIL_TRANSPORT desconocido: «{transporte}». Los valores son «outbox» y «smtp»."
    )
