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
| Base de datos (PostgreSQL) | Docker: `localhost:5433` · nativo: `localhost:5432` (usuario: `topgreen`) |

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

   POSIX:
   ```bash
   cp .env.example .env
   cp backend/.env.example backend/.env
   ```
   PowerShell:
   ```powershell
   copy .env.example .env
   copy backend\.env.example backend\.env
   ```
   Reemplazar los placeholders `CAMBIAR_*` en los dos archivos.

   > **Con Docker no hay que tocar `DATABASE_URL`.** El contenedor de la
   > API la arma con `DB_USER`, `DB_PASSWORD` y `DB_NAME` del `.env` de la
   > raíz, así que cambiar la contraseña ahí alcanza. Lo mismo con
   > `UPLOAD_DIR`: dentro del contenedor siempre es `/data/uploads`, el
   > volumen persistente.

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
| PostgreSQL | 16+ |
| PostGIS | 3.4+ (paquete `postgresql-16-postgis-3` o equivalente) |
| Git | ≥ 2.40 |

**No hace falta `.env` en la raíz.** Sin él, el navegador pide `/api` y
`/uploads` al mismo origen que sirve la página y Vite los reenvía al
backend nativo.

### Pasos

1. **Crear el rol y la base.** PostGIS se instala **dentro de la base
   `topgreen`** y no en `postgres`: de ahí el `-d topgreen` de la tercera
   línea. Elegí una contraseña y usá la misma en el paso 3.

   POSIX:
   ```bash
   sudo -u postgres psql -c "CREATE ROLE topgreen LOGIN PASSWORD 'TuPassword';"
   sudo -u postgres createdb -O topgreen topgreen
   sudo -u postgres psql -d topgreen -c "CREATE EXTENSION IF NOT EXISTS postgis;"
   ```
   PowerShell (con las herramientas de PostgreSQL en el `PATH`):
   ```powershell
   psql -U postgres -c "CREATE ROLE topgreen LOGIN PASSWORD 'TuPassword';"
   createdb -U postgres -O topgreen topgreen
   psql -U postgres -d topgreen -c "CREATE EXTENSION IF NOT EXISTS postgis;"
   ```

2. **Entorno de Python y dependencias.**

   POSIX:
   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env
   ```
   PowerShell:
   ```powershell
   cd backend
   python -m venv .venv
   .venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   copy .env.example .env
   ```

3. **Editar `backend/.env`.** Hay dos placeholders para reemplazar, y nada
   más que borrar:

   | Clave | Qué poner |
   |---|---|
   | `DATABASE_URL` | la contraseña del paso 1: `postgresql+psycopg://topgreen:TuPassword@localhost:5432/topgreen` |
   | `JWT_SECRET` | una cadena propia de 32 caracteres o más |

   `UPLOAD_DIR=uploads` ya viene listo: es `backend/uploads`, la API la crea
   sola al arrancar y no necesita permisos sobre `/data`.

4. **Migraciones y datos demo**, desde `backend/` y con el entorno activado:
   ```bash
   alembic upgrade head
   python -m app.seed
   ```
   El seed trae las localidades oficiales, las categorías y el catálogo de
   demostración. Es idempotente: correrlo dos veces no duplica nada.

5. **Levantar la API**, desde `backend/`:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   Comprobar desde otra terminal: `curl http://localhost:8000/api/health`.

6. **Frontend**, en otra terminal y en la raíz del proyecto:
   ```bash
   npm install
   npm run dev
   ```
   Abrir http://localhost:5173 y entrar con `admin@topgreen.com` /
   `admin123`.

   Si en algún momento definís `VITE_API_URL`, el navegador deja de usar el
   proxy y llama directo a ese host; entonces el origen del frontend tiene
   que estar en `CORS_ORIGINS` de `backend/.env`.

---

## Variables de entorno explicadas

Son dos archivos con dos dueños distintos, y no se pisan:

| Archivo | Quién lo lee | Qué contiene |
|---|---|---|
| `.env` (raíz) | `docker-compose.yml` y Vite | credenciales del PostgreSQL en contenedor, y opcionalmente las `VITE_*` |
| `backend/.env` | `Settings` de FastAPI | la configuración de la aplicación |

`Settings` **rechaza toda clave que no declara**. Por eso en `backend/.env`
no van `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` ni `DB_PASSWORD`: la
conexión de la API es una sola variable, `DATABASE_URL`.

### Raíz (`.env`)

| Variable | Para qué | Default |
|----------|----------|---------|
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | crean el usuario y la base del contenedor, y arman la `DATABASE_URL` que recibe la API en Docker | `topgreen` / `topgreen` / placeholder |
| `DB_EXPOSED_PORT` | puerto del host para llegar al PostgreSQL del contenedor | `5433` |
| `VITE_API_URL` | si se define, el frontend llama directo a esa URL en vez de pasar por el proxy | sin definir |
| `VITE_IMAGES_URL` | base de las imágenes subidas; misma lógica | sin definir |

Nada de esto hace falta para el Camino B.

### Backend (`backend/.env`)

Ver los comentarios de [`backend/.env.example`](backend/.env.example). Las
críticas son:

- `DATABASE_URL` — string de conexión. En Docker lo pisa
  `docker-compose.yml` con los datos del `.env` de la raíz.
- `JWT_SECRET` — secreto para firmar tokens (≥ 32 caracteres).
- `UPLOAD_DIR` — carpeta de las imágenes subidas. Un valor relativo se
  resuelve contra `backend/`. En Docker lo pisa `docker-compose.yml` con
  `/data/uploads`, que es el volumen persistente.
- `CORS_ORIGINS` — sólo importa si el navegador llama a otro origen.
- Las credenciales del admin del seed **no son configurables**: son
  `admin@topgreen.com` / `admin123` y están escritas en `app/seed.py`.
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

Para resetear datos con Docker:
```powershell
docker compose down -v          # borra volumen db_data
docker compose up -d
docker exec topgreen-api alembic upgrade head
docker exec topgreen-api python -m app.seed
```

Para resetear datos en instalación nativa (borra y rehace la base):
```bash
sudo -u postgres dropdb --if-exists topgreen
sudo -u postgres createdb -O topgreen topgreen
sudo -u postgres psql -d topgreen -c "CREATE EXTENSION IF NOT EXISTS postgis;"
cd backend && alembic upgrade head && python -m app.seed
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
- Sin `VITE_API_URL`, el navegador pide `/api` al propio Vite y Vite lo
  reenvía a `http://localhost:8000`. Verificar que la API esté levantada:
  `curl http://localhost:8000/api/health`.
- Si `VITE_API_URL` **sí** está definida, el navegador llama directo a esa
  URL. Tiene que terminar en `/api` y el origen del frontend tiene que
  estar permitido por `CORS_ORIGINS`.
- Vite lee el `.env` una sola vez, al arrancar: después de cambiarlo hay
  que reiniciar `npm run dev`.

### La API no arranca y dice que no pudo crear `UPLOAD_DIR`
- Pasa cuando `backend/.env` pide una carpeta sin permisos, típicamente
  `/data/uploads`, que es la ruta del contenedor. En instalación nativa va
  `UPLOAD_DIR=uploads`, que es `backend/uploads`.

### La API no arranca y se queja de claves de más en el `.env`
- `Settings` sólo acepta las claves que declara. `DB_HOST`, `DB_PORT`,
  `DB_NAME`, `DB_USER` y `DB_PASSWORD` van en el `.env` de la raíz, que lo
  lee `docker-compose.yml`; en `backend/.env` la conexión es una sola
  variable, `DATABASE_URL`.
- Si venís de una copia anterior, borrá también `ADMIN_EMAIL`,
  `ADMIN_PASSWORD` y `ADMIN_NAME`: se quitaron porque no las leía nadie, y
  un `.env` viejo que las conserve ahora impide arrancar.

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
