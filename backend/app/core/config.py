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
    MP_COMMISSION_PERCENT: float = 5.0  # Porcentaje de comisión para TopGreen
    
    # Mercado Pago - OAuth para vincular vendedores (Split Payments)
    MP_APP_ID: str = ""  # Application ID del marketplace
    MP_CLIENT_SECRET: str = ""  # Client Secret del marketplace
    MP_REDIRECT_URI: str = ""  # URL de callback OAuth
    
    # URL de ngrok (para desarrollo)
    NGROK_URL: str = ""
    
    # URLs Frontend (para callbacks de pago)
    FRONTEND_URL: str = "http://localhost:5173"
    
    @field_validator("UPLOAD_DIR")
    @classmethod
    def _resolver_directorio_de_subidas(cls, valor: str) -> str:
        """Un UPLOAD_DIR relativo se resuelve contra backend/, no contra el
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
