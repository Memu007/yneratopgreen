# Levantar TopGreen / AgroMarket localmente

Esta guía describe dos caminos para levantar el proyecto en una máquina nueva:

- **Camino A: Docker Compose** (recomendado, todo en contenedores).
- **Camino B: Nativo** (Python, Node y PostgreSQL instalados directamente).

Las URLs y puertos son idénticos en ambos casos.

---

## URLs locales

| Servicio | URL |
|----------|-----|
| Frontend (Vite dev) | http://localhost:5173 |
| Backend (FastAPI) | http://localhost:8000/api |
| API Docs (Swagger) | http://localhost:8000/api/docs |
| API Docs (ReDoc) | http://localhost:8000/api/redoc |
| Base de datos (PostgreSQL) | `localhost:5433` (usuario: `topgreen`) |

---

## Camino A — Docker Compose (recomendado)

### Requisitos

| Herramienta | Versión |
|-------------|---------|
| Docker Desktop (Windows/macOS) o Docker Engine + Compose v2 (Linux) | ≥ 24 |
| Node.js | 20 LTS |
| npm | ≥ 10 (viene con Node 20) |
| Git | ≥ 2.40 |
| Espacio libre en disco | ~2 GB (imagen PostgreSQL+PostGIS) |
| RAM disponible para Docker | ≥ 4 GB |

### Pasos

1. **Clonar / descomprimir el proyecto** y entrar al directorio raíz.

2. **Variables de entorno**:
   ```powershell
   copy .env.example .env
   copy backend\.env.example backend\.env
   ```
   Editar `.env` y `backend\.env` reemplazando los placeholders
   `CAMBIAR_*`. Los valores por default ya apuntan a `localhost`.

   > **Importante**: Los valores por default ya funcionan para desarrollo
   > local. Si cambiás el password en `.env`, actualizá también
   > `DATABASE_URL` en `backend/.env`.

3. **Levantar contenedores DB + API**:
   ```powershell
   docker compose up -d
   ```
   En el primer arranque PostgreSQL tarda ~10 s en estar healthy.
   Verificar:
   ```powershell
   docker compose ps
   docker logs topgreen-api -f
   ```

4. **Crear el esquema (migraciones Alembic)**:
   ```powershell
   docker exec topgreen-api alembic upgrade head
   ```
   Esto debe correr todas las migraciones disponibles.

5. **Cargar datos de prueba (seed)**:
   ```powershell
   docker exec topgreen-api python -m app.seed
   ```
   Crea: admin, vendedor demo, cliente demo, ~8 categorías y un puñado de
   productos con imágenes externas.

6. **Frontend (modo dev con hot reload)**:
   ```powershell
   npm install
   npm run dev
   ```
   Abrir http://localhost:5173.

7. **Login con cuenta demo**: `admin@topgreen.com` / `admin123`.

### Comandos útiles (Docker)

```powershell
# Ver logs en vivo
docker logs topgreen-api -f
docker logs topgreen-db -f

# Reiniciar el backend tras cambiar backend/.env
docker compose restart topgreen-api

# Bajar todo (sin perder datos)
docker compose down

# Bajar TODO incluyendo datos (rebuild desde cero)
docker compose down -v

# Levantar también nginx con frontend buildado (perfil opcional)
npm run build
docker compose --profile fullstack up -d
# Esto sirve el frontend en http://localhost
```

---

## Camino B — Instalación nativa (sin Docker)

### Requisitos

| Herramienta | Versión |
|-------------|---------|
| Python | 3.11.x (3.12 también funciona) |
| Node.js | 20 LTS |
| PostgreSQL | 16+ (con extensión PostGIS 3.4) |
| PostGIS | 3.4+ |
| Git | ≥ 2.40 |

### Pasos

1. **Crear DB en PostgreSQL**:
   ```sql
   CREATE DATABASE topgreen;
   CREATE EXTENSION postgis;
   ```

2. **Backend**:
   ```powershell
   cd backend
   python -m venv .venv
   .venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   copy .env.example .env
   ```
   Editar `backend/.env` y poner `DATABASE_URL` con tu instancia local:
   ```
   DATABASE_URL=postgresql+psycopg://topgreen:TuPass@localhost:5433/topgreen
   ```

3. **Migraciones + seed**:
   ```powershell
   alembic upgrade head
   python -m app.seed
   ```

4. **Levantar API**:
   ```powershell
   uvicorn app.main:app --reload --port 8000
   ```

5. **Frontend** (en otra terminal, en la raíz del proyecto):
   ```powershell
   copy .env.example .env
   npm install
   npm run dev
   ```

---

## Variables de entorno explicadas

### Raíz (`.env`)

| Variable | Para qué | Default |
|----------|----------|---------|
| `VITE_API_URL` | URL que el frontend usa para llamar al backend | `http://localhost:8000/api` |
| `VITE_IMAGES_URL` | Base URL para servir imágenes de uploads | `http://localhost:8000` |
| `DB_PASSWORD` | Password del usuario `topgreen` de PostgreSQL (lo lee `docker-compose.yml`) | `CAMBIAR_PASSWORD_LOCAL_SEGURO_2026!` |

### Backend (`backend/.env`)

Ver comentarios inline en [`backend/.env.example`](backend/.env.example).
Las variables críticas son:

- `DATABASE_URL` — string de conexión.
- `JWT_SECRET` — secreto para firmar tokens (≥ 32 chars).
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — credenciales del admin del seed.
- `MP_*` — credenciales de Mercado Pago (vacías por default; ver
  [docs/SETUP_PAYMENTS.md](docs/SETUP_PAYMENTS.md)).
- `NGROK_URL` — opcional, sólo si querés exponer webhooks de MP en local.

---

## Datos de prueba (seed)

| Email | Password | Rol |
|-------|----------|-----|
| `admin@topgreen.com` | `admin123` | Admin |
| `vendedor@ejemplo.com` | `vendedor123` | Vendedor |
| `cliente@ejemplo.com` | `cliente123` | Cliente |

El seed también crea ~8 categorías (Semillas, Fertilizantes, Herramientas,
Maquinaria, Agroquímicos, etc.) y productos demo con URLs de imágenes
externas (picsum.photos). Es **idempotente**: podés re-correrlo sin duplicar.

Para resetear datos:
```powershell
docker compose down -v          # borra volumen db_data
docker compose up -d
docker exec topgreen-api alembic upgrade head
docker exec topgreen-api python -m app.seed
```

---

## Smoke test rápido

```powershell
# 1. Health
curl http://localhost:8000/api/health

# 2. Listar productos
curl http://localhost:8000/api/products

# 3. Login admin
curl -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@topgreen.com","password":"admin123"}'
```

Los tres deben devolver JSON 200 OK.

---

## Troubleshooting

### `topgreen-db` no llega a healthy
- Verificar que el puerto 5433 no esté en uso por otro proceso.
- En Windows, asignarle ≥ 2 GB de RAM a Docker Desktop.

### `topgreen-api` reinicia en loop
- Ver `docker logs topgreen-api`.
- Causa más común: `DATABASE_URL` apunta a un host inalcanzable o `db` aún no terminó de iniciar.
- Las migraciones se ejecutan **manualmente** (no en arranque del container). Si faltan, los endpoints fallan con 500.

### `npm install` falla
- Verificar Node 20 LTS. Versiones < 18 no funcionan con Vite 5.
- Si hay error de red, probar `npm install --no-audit --no-fund`.

### `npm run dev` arranca pero la web no llama al backend
- Verificar que `VITE_API_URL` en `.env` apunta a `http://localhost:8000/api` (con `/api` al final).
- Probar `curl http://localhost:8000/api/health` desde el host.

### CORS error en navegador
- El backend permite `http://localhost:5173` y `http://localhost:5174` por
  default. Si el frontend corre en otro puerto, agregarlo a `CORS_ORIGINS`
  en `backend/.env` (formato JSON: `["http://localhost:3000"]`).

### Mercado Pago: el botón de pago no aparece o el checkout devuelve 503
- Es el comportamiento esperado: la integración viene **desvinculada**
  por seguridad. Ver [docs/SETUP_PAYMENTS.md](docs/SETUP_PAYMENTS.md).

---

## ¿Y producción?

Esta guía es solo para **desarrollo local**. Para producción, el nuevo
equipo deberá:
1. Configurar storage de imágenes externo (S3 / Cloudinary) — el
   `STORAGE_BACKEND` está preparado pero no wireado.
2. Deploy a su propia infraestructura (NO usar Ferozo/ngrok del equipo
   anterior).
3. Configurar HTTPS y un dominio propio.
4. Rotar **todos** los secretos (ver
   [docs/SETUP_PAYMENTS.md § 6](docs/SETUP_PAYMENTS.md)).
5. Configurar su propia app de Mercado Pago.

Ver [docs/RECOMMENDATIONS.md](docs/RECOMMENDATIONS.md) para más detalles.
