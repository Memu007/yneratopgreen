"""
Configuración de la aplicación usando Pydantic Settings.
Lee variables de entorno desde backend/.env
"""
from pydantic_settings import BaseSettings
from pydantic import field_validator
from pathlib import Path
from typing import List
import os

# Raíz del backend, o sea la carpeta que contiene app/. El .env se busca
# siempre acá y no en el directorio desde el que se ejecuta el proceso: antes
# era una ruta relativa, así que levantar la API desde la raíz del repositorio
# leía el .env del frontend y fallaba con claves que Settings no declara.
DIRECTORIO_BACKEND = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Configuración de la aplicación"""
    
    # Entorno
    ENV: str = "local"
    
    # API
    API_PREFIX: str = "/api"
    PROJECT_NAME: str = "TopGreen Marketplace"
    VERSION: str = "1.0.0"
    
    # Base de datos
    DATABASE_URL: str
    
    # JWT
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_MINUTES: int = 60 * 24  # 24 horas para desarrollo
    REFRESH_TOKEN_DAYS: int = 30
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:5174", "http://localhost", "http://127.0.0.1:5173", "http://127.0.0.1:5174"]
    
    # Correo saliente. "outbox" escribe el mensaje en una carpeta local y es lo
    # que usan desarrollo y la suite; "smtp" es el productivo.
    EMAIL_TRANSPORT: str = "outbox"
    EMAIL_FROM: str = "TopGreen <no-responder@topgreen.local>"
    EMAIL_OUTBOX_DIR: str = "outbox"
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_TLS: bool = True

    # Uploads - Almacenamiento de archivos
    UPLOAD_DIR: str = "/data/uploads"
    PUBLIC_UPLOAD_BASE: str = "/uploads"
    MAX_UPLOAD_SIZE_MB: int = 10
    ALLOWED_IMAGE_TYPES: List[str] = ["image/jpeg", "image/png", "image/webp"]
    
    # Storage Backend: "local", "s3", "cloudinary"
    STORAGE_BACKEND: str = "local"
    
    # AWS S3 (solo si STORAGE_BACKEND = "s3")
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_S3_BUCKET: str = ""
    AWS_S3_REGION: str = "us-east-1"
    AWS_S3_ENDPOINT: str = ""  # Para S3 compatibles (MinIO, DigitalOcean Spaces)
    
    # Cloudinary (solo si STORAGE_BACKEND = "cloudinary")
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    
    # Mercado Pago - Credenciales del Marketplace (recibe comisión)
    MP_PUBLIC_KEY: str = ""
    MP_ACCESS_TOKEN: str = ""
    
    # Mercado Pago - OAuth para vincular la cuenta de cada vendedor.
    # El vendedor cobra en su cuenta: TopGreen no recibe ni redistribuye
    # fondos de terceros. Sin estas tres —o sin la clave de cifrado de acá
    # abajo— la integración se ofrece apagada.
    MP_APP_ID: str = ""  # Application ID del marketplace
    MP_CLIENT_SECRET: str = ""  # Client Secret del marketplace
    MP_REDIRECT_URI: str = ""  # URL de callback OAuth

    # Clave Fernet con la que se cifran las credenciales del vendedor antes de
    # tocar la base. Vive fuera del repositorio. Si falta, no se vincula nada:
    # guardar un token de tercero en claro no es una alternativa aceptable.
    MP_TOKEN_KEY: str = ""

    # Interruptor del cobro por Mercado Pago. **Apagado por defecto.**
    # Con esto en falso ninguna ruta de comprador crea preferencias, el
    # checkout no ofrece el medio y la venta por transferencia funciona igual.
    # Se enciende recién cuando exista el webhook firmado, la consulta de
    # estado y la política de stock: hasta entonces, cobrar de verdad sería
    # prometer algo que no podemos confirmar.
    MP_CHECKOUT_HABILITADO: bool = False

    # A dónde vuelve el comprador desde Mercado Pago y a dónde avisa MP. Son
    # URLs públicas y se configuran; no se arman con NGROK_URL ni se adivinan.
    # La de notificación queda vacía hasta que exista el webhook.
    MP_NOTIFICACION_URL: str = ""

    # Bases de los servicios de Mercado Pago. Son configuración porque la
    # prueba automatizada levanta un doble local y apunta la API ahí; en
    # producción no se definen y quedan estos valores.
    MP_AUTH_BASE_URL: str = "https://auth.mercadopago.com.ar"
    MP_API_BASE_URL: str = "https://api.mercadopago.com"
    
    # URL de ngrok (para desarrollo)
    NGROK_URL: str = ""
    
    # URLs Frontend (para callbacks de pago)
    FRONTEND_URL: str = "http://localhost:5173"
    
    @field_validator("UPLOAD_DIR", "EMAIL_OUTBOX_DIR")
    @classmethod
    def _resolver_carpeta(cls, valor: str) -> str:
        """Una carpeta relativa se resuelve contra backend/, no contra el
        directorio de trabajo. Así `UPLOAD_DIR=uploads` es siempre
        backend/uploads, y una instalación nativa no necesita permisos sobre
        /data. Docker sigue pasando la ruta absoluta /data/uploads."""
        ruta = Path(valor).expanduser()
        if not ruta.is_absolute():
            ruta = DIRECTORIO_BACKEND / ruta
        return str(ruta)

    class Config:
        env_file = str(DIRECTORIO_BACKEND / ".env")
        case_sensitive = True


# Instancia global de configuración
settings = Settings()
