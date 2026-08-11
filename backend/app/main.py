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

# Crear aplicación FastAPI
app = FastAPI(
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
from app.api import (
    auth, catalog, products, cart, orders, contact,
    ratings, admin, notifications, logistics
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
