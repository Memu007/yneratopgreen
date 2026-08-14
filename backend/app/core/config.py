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
    #
    # El webhook firmado, la consulta de estado y la reserva de stock ya
    # existen y están probados contra un doble local. Eso no alcanza para
    # encenderlo: falta operarlo con credenciales reales, con la URL de aviso
    # publicada y con el reconciliador programado. Encenderlo es una decisión
    # de puesta en producción, no una consecuencia de que el código exista.
    MP_CHECKOUT_HABILITADO: bool = False

    # A dónde vuelve el comprador desde Mercado Pago y a dónde avisa MP. Son
    # URLs públicas y se configuran; no se arman con NGROK_URL ni se adivinan.
    #
    # La de notificación **no puede llevar query string**: Mercado Pago degrada
    # el aviso a IPN —un GET con `topic` e `id`, sin firma— cuando la URL trae
    # parámetros, y ahí se pierde lo único que autentica el aviso. Vacía
    # significa que no se declara ninguna y MP no avisa a nadie.
    MP_NOTIFICACION_URL: str = ""

    # El secreto con el que Mercado Pago firma cada aviso. Vive fuera del
    # repositorio, igual que la clave de cifrado. **Sin esto no se procesa un
    # solo aviso**: un webhook que no se puede autenticar es un endpoint por el
    # que cualquiera declara pagos ajenos.
    MP_WEBHOOK_SECRET: str = ""

    # Cuánta diferencia se acepta entre el reloj del aviso y el nuestro. Un
    # aviso viejo reenviado es un aviso repetido, y el margen existe para que
    # no lo sea para siempre.
    MP_TOLERANCIA_FIRMA_SEGUNDOS: int = 300

    # Cuánto vive un link de pago, y con él la reserva de stock que lo
    # acompaña. Va igual a la vigencia oficial de la preferencia: que el link
    # muera después que la reserva sería habilitar un cobro sin mercadería.
    MP_MINUTOS_DE_VIGENCIA: int = 30

    # Margen que se espera **después** del vencimiento antes de liberar una
    # reserva. Un pago iniciado en el último segundo tarda en aparecer en la
    # consulta a Mercado Pago; liberar sin ese margen es soltar mercadería que
    # quizá ya se cobró.
    MP_MINUTOS_DE_GRACIA: int = 10

    # Bases de los servicios de Mercado Pago. Son configuración porque la
    # prueba automatizada levanta un doble local y apunta la API ahí; en
    # producción no se definen y quedan estos valores.
    MP_AUTH_BASE_URL: str = "https://auth.mercadopago.com.ar"
    MP_API_BASE_URL: str = "https://api.mercadopago.com"
    
    # URL de ngrok (para desarrollo)
    NGROK_URL: str = ""
    
    # URLs Frontend (para callbacks de pago)
    FRONTEND_URL: str = "http://localhost:5173"
    
    @field_validator("MP_NOTIFICACION_URL")
    @classmethod
    def _url_de_aviso_sin_parametros(cls, valor: str) -> str:
        """La base configurada se declara limpia: sin query string.

        No es que Mercado Pago rechace una URL con parámetros. Es que el
        parámetro que decide **qué clase de aviso llega** lo tiene que poner el
        código y no el entorno: la documentación oficial indica agregar
        `source_news=webhooks` a la `notification_url` de la preferencia para
        recibir exclusivamente Webhooks —los firmados— y no IPN. Ese parámetro
        lo agrega `mp_preferencia.url_de_aviso()`.

        Si además se aceptara query arbitraria del entorno, una variable mal
        puesta podría pisarlo o sumar ruido a una URL pública. Así que la base
        entra limpia y el único parámetro que viaja es el oficial.

        Se falla al arrancar y no en la primera notificación perdida.
        """
        if valor and "?" in valor:
            raise ValueError(
                "MP_NOTIFICACION_URL se declara sin parámetros: el único que viaja "
                "es source_news=webhooks, y lo agrega el código al armar la preferencia"
            )
        return valor

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
