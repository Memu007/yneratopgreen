"""
Aplicación principal FastAPI - TopGreen Marketplace Backend
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from pathlib import Path
import structlog

# Configurar logger
logger = structlog.get_logger()

class Aplicacion(FastAPI):
    """FastAPI con la base defensiva por FUERA del manejador de errores.

    `add_middleware` no alcanza para el 500. Starlette arma la pila con
    `ServerErrorMiddleware` SIEMPRE en la capa 0, o sea por fuera de todo lo que
    uno registre; cuando una excepción no controlada sube, esa capa la atrapa y
    escribe su propia respuesta con el `send` crudo del servidor. El middleware
    de uno nunca ve ese `http.response.start`, así que el 500 salía pelado
    mientras 200, 401 y 404 salían con las cinco cabeceras.

    `build_middleware_stack` es el punto de extensión previsto para esto: no es
    privado —no lleva guión bajo— y la propia FastAPI lo redefine para meter su
    `AsyncExitStackMiddleware`. Acá se envuelve la pila ya armada, de modo que
    hay UNA sola capa que pone las cabeceras y cubre todas las respuestas, la
    del 500 incluida. No hay un segundo camino que pueda divergir.

    `CabecerasDefensivas` se resuelve cuando el método corre —en el primer
    pedido—, no cuando la clase se define, así que puede quedar más abajo.
    """

    def build_middleware_stack(self):
        return CabecerasDefensivas(super().build_middleware_stack())


# Crear aplicación FastAPI
app = Aplicacion(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    docs_url=f"{settings.API_PREFIX}/docs",
    redoc_url=f"{settings.API_PREFIX}/redoc",
    openapi_url=f"{settings.API_PREFIX}/openapi.json"
)

# Configurar CORS - Permitir orígenes específicos
# Defaults para desarrollo local. Para agregar dominios productivos,
# configurar la variable CORS_ORIGINS en .env (ver backend/.env.example).
DEFAULT_LOCAL_ORIGINS = [
    "http://localhost",
    "http://localhost:80",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]

# settings.CORS_ORIGINS viene desde .env (List[str]). Se combinan con los defaults locales.
configured_origins = list(getattr(settings, "CORS_ORIGINS", []) or [])
origins = list(dict.fromkeys(DEFAULT_LOCAL_ORIGINS + configured_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Cabeceras defensivas en TODA respuesta: la correcta, la que falla, la que no
# existe y la descarga.
#
# Va como middleware puro de ASGI y no como `@app.middleware("http")` porque
# el decorador de Starlette envuelve la respuesta y no alcanza a lo que
# responde el propio enrutador antes de llegar a la aplicación —un 404 sin ruta,
# por ejemplo—. Acá se toca el mensaje `http.response.start`, que es por donde
# sale TODO, incluida la documentación y los archivos estáticos de `/uploads`.
#
# Lo que NO hace, a propósito: no pone `Content-Security-Policy`. La API
# devuelve JSON y archivos, no documentos con recursos, y la única página HTML
# que sirve es la documentación interactiva, que trae sus propios archivos de
# un CDN: una política restrictiva la dejaría en blanco sin proteger nada. La
# política de contenido es del Frontend, que es quien ejecuta código.
#
# Tampoco toca CORS: queda por FUERA de `CORSMiddleware` —y de todo lo demás,
# ver `Aplicacion` arriba— y sólo agrega claves que no existían. Las respuestas
# que ya traían una de estas cabeceras conservan la suya: no se duplica ni se
# contradice nada.
CABECERAS_DEFENSIVAS = (
    # El navegador ignora esto sobre HTTP, así que ponerlo siempre no rompe el
    # entorno local y cubre el despliegue, donde la TLS la termina la
    # plataforma y la aplicación nunca ve el `https`. Sin `preload`.
    (b"strict-transport-security", b"max-age=31536000; includeSubDomains"),
    (b"x-content-type-options", b"nosniff"),
    (b"x-frame-options", b"DENY"),
    (b"referrer-policy", b"strict-origin-when-cross-origin"),
    (
        b"permissions-policy",
        b"accelerometer=(), autoplay=(), camera=(), display-capture=(), "
        b"encrypted-media=(), fullscreen=(), geolocation=(), gyroscope=(), "
        b"magnetometer=(), microphone=(), midi=(), payment=(), "
        b"picture-in-picture=(), publickey-credentials-get=(), "
        b"screen-wake-lock=(), usb=(), xr-spatial-tracking=()",
    ),
)


class CabecerasDefensivas:
    """Suma la base defensiva a cada respuesta, sin pisar lo que ya venga."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def enviar(mensaje):
            if mensaje["type"] == "http.response.start":
                cabeceras = mensaje.setdefault("headers", [])
                puestas = {nombre.lower() for nombre, _ in cabeceras}
                for nombre, valor in CABECERAS_DEFENSIVAS:
                    if nombre not in puestas:
                        cabeceras.append((nombre, valor))
            await send(mensaje)

        await self.app(scope, receive, enviar)


# No va por `add_middleware`: eso la dejaría por DENTRO de
# `ServerErrorMiddleware` y el 500 saldría sin cabeceras. La instala
# `Aplicacion.build_middleware_stack`, arriba.

# Montar directorio de uploads (para servir imágenes).
# StaticFiles exige que la carpeta ya exista, así que se crea antes. En una
# instalación nativa recién clonada no hay ninguna, y el error de origen
# —"Directory '/data/uploads' does not exist"— no decía qué había que cambiar.
directorio_de_subidas = Path(settings.UPLOAD_DIR)
try:
    directorio_de_subidas.mkdir(parents=True, exist_ok=True)
except OSError as error:
    raise RuntimeError(
        f"No se pudo crear UPLOAD_DIR ({directorio_de_subidas}): {error}. "
        "En una instalación nativa poné una carpeta del proyecto, por ejemplo "
        "UPLOAD_DIR=uploads en backend/.env."
    ) from error

app.mount("/uploads", StaticFiles(directory=str(directorio_de_subidas)), name="uploads")


# Health check endpoint
@app.get("/api/health")
async def health_check():
    """Endpoint para verificar que el servidor está funcionando"""
    return {
        "status": "ok",
        "service": "TopGreen Marketplace API",
        "version": settings.VERSION,
        "environment": settings.ENV
    }


@app.get("/")
async def root():
    """Root endpoint - redirige a docs"""
    return {
        "message": "TopGreen Marketplace API",
        "docs": f"{settings.API_PREFIX}/docs"
    }


# Event handlers
@app.on_event("startup")
async def startup_event():
    """Acciones al iniciar la aplicación"""
    logger.info("starting_application", env=settings.ENV, version=settings.VERSION)


@app.on_event("shutdown")
async def shutdown_event():
    """Acciones al cerrar la aplicación"""
    logger.info("shutting_down_application")


# Importar y registrar routers
#
# `payments` NO se monta: el cobro por Mercado Pago todavía no está construido
# y el módulo heredado que quedó en el repositorio no es autoridad de nada.
# `mp_oauth` sí, porque vincular la cuenta del vendedor no mueve un peso.
from app.api import (
    auth, catalog, products, cart, orders, contact,
    ratings, admin, notifications, logistics, mp_oauth, mp_webhook,
    documentacion
)

app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(catalog.router, prefix=settings.API_PREFIX)
app.include_router(products.router, prefix=settings.API_PREFIX)
app.include_router(cart.router, prefix=settings.API_PREFIX)
app.include_router(orders.router, prefix=settings.API_PREFIX)
app.include_router(contact.router, prefix=settings.API_PREFIX)
app.include_router(ratings.router, prefix=settings.API_PREFIX)
app.include_router(admin.router, prefix=settings.API_PREFIX)
app.include_router(notifications.router, prefix=settings.API_PREFIX)
app.include_router(logistics.router, prefix=settings.API_PREFIX)
app.include_router(mp_oauth.router, prefix=settings.API_PREFIX)
app.include_router(mp_webhook.router, prefix=settings.API_PREFIX)
app.include_router(documentacion.router, prefix=settings.API_PREFIX)
app.include_router(documentacion.router_admin, prefix=settings.API_PREFIX)
