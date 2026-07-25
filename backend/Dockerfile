FROM --platform=linux/amd64 python:3.11-slim

# Variables de entorno para Python
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Crear usuario no-root
RUN useradd -m -u 1000 appuser

# Directorio de trabajo
WORKDIR /app

# Instalar utilidades mínimas del sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements
COPY requirements.txt .

# Instalar dependencias Python
RUN pip install --no-cache-dir -r requirements.txt

# Copiar configuración de Alembic
COPY alembic.ini .
COPY alembic ./alembic

# Copiar código de la aplicación
COPY ./app ./app

# Crear directorio para uploads
RUN mkdir -p /data/uploads && chown -R appuser:appuser /data

# Cambiar a usuario no-root
USER appuser

# Exponer puerto
EXPOSE 8000

# Comando por defecto
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
