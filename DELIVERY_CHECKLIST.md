# Delivery Checklist — TopGreen / AgroMarket Fase I

Fecha de entrega: **2026-06-04**
Versión: **1.0.1**
Branch base: **`restore-phase1-clean`** (HEAD `13e79741`) + cambios locales en working tree (HomePage simplificada, package.json `1.0.1`).

---

## Correspondencia con producción (validado)

Este paquete contiene **el mismo código fuente** que está actualmente publicado
en `topgreen.com.ar`. Reproducción bit-a-bit verificada:

| Item | Valor |
|---|---|
| Bundle JS publicado en producción | `assets/index-aAXJQ_6o.js` |
| Tamaño en producción | `345 512` bytes |
| SHA256 en producción | `890AC4AFBDCAE8C61ACC3FA2E2D0076D065575E4AD5D1BD4D48BDC22FEF5C156` |
| Build desde el ZIP (con `VITE_API_URL` apuntando al mismo backend que prod) | `index-aAXJQ_6o.js` |
| Tamaño desde el ZIP | `345 512` bytes |
| SHA256 desde el ZIP | `890AC4AFBDCAE8C61ACC3FA2E2D0076D065575E4AD5D1BD4D48BDC22FEF5C156` |
| **Coincidencia bit-a-bit** | ✅ **SÍ** |

> Nota: el nombre y hash del bundle dependen de las variables `VITE_*`.
> Cuando el nuevo equipo compile con `VITE_API_URL=http://localhost:8000/api`
> (default local del paquete), el bundle resultante tendrá un nombre/hash
> distinto, pero el **código TypeScript fuente es idéntico** al deployado.

---

## Independencia de infraestructura — confirmación explícita

Este paquete está preparado para levantamiento **100 % local** y **NO**
queda apuntando ni depende de ninguno de los siguientes elementos del
equipo desarrollador anterior:

| # | Elemento | Estado |
|---|---|---|
| 1 | Servidor anterior de Peakflow | ❌ no se usa, no hay referencias activas |
| 2 | Túnel ngrok anterior | ❌ no se usa, `NGROK_URL` opcional y vacío por default |
| 3 | URL `peakflow-topgreen.ngrok.app` | ❌ eliminada del código y configuración |
| 4 | Hosting / Ferozo usado anteriormente | ❌ scripts `.deploy-*` excluidos del ZIP |
| 5 | Dominio `topgreen.com.ar` como dependencia obligatoria | ❌ removido de CORS hardcoded; configurable por env |
| 6 | Credenciales FTP / SSH del equipo anterior | ❌ no se incluyen, scripts de deploy excluidos |
| 7 | Credenciales de Mercado Pago del equipo anterior | ❌ todas las `MP_*` vacías en `.env*.example` |
| 8 | Base de datos productiva anterior | ❌ esquema vía Alembic + datos vía seed local |
| 9 | Variables de entorno reales del equipo anterior | ❌ sólo se entregan `.env*.example` con defaults locales |

El nuevo equipo arranca con su propia base de datos local, sus propias
credenciales y, cuando corresponda, su propia aplicación de Mercado Pago.
Ver pasos exactos en [README_LOCAL_SETUP.md](README_LOCAL_SETUP.md) y
[docs/SETUP_PAYMENTS.md](docs/SETUP_PAYMENTS.md).

---

## Contenido del ZIP

### Código fuente

- [x] **Frontend** (React 18 + TS + Vite) — `src/`, `public/`, `index.html`, `package.json`, `tsconfig*.json`, `vite.config.ts`, `.eslintrc.cjs`
- [x] **Backend** (FastAPI + Python 3.11) — `backend/app/`, `backend/alembic/`, `backend/tests/`, `backend/Dockerfile`, `backend/requirements.txt`, `backend/alembic.ini`
- [x] **Migraciones** Alembic 001–011
- [x] **Seed script** — `backend/app/seed.py`

### Configuración

- [x] `.env.example` (raíz, frontend + Docker)
- [x] `backend/.env.example` (backend dev)
- [x] `backend/.env.production.example` (backend prod)
- [x] `docker-compose.yml` (dev — db + api + nginx opcional)
- [x] `infra/nginx/conf.d/topgreen.conf` (config nginx local)
- [x] `.gitignore`

### Documentación

- [x] [README.md](README.md)
- [x] [README_LOCAL_SETUP.md](README_LOCAL_SETUP.md)
- [x] [DELIVERY_CHECKLIST.md](DELIVERY_CHECKLIST.md) (este archivo)
- [x] [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [x] [docs/API_ENDPOINTS.md](docs/API_ENDPOINTS.md)
- [x] [docs/DATABASE.md](docs/DATABASE.md)
- [x] [docs/SETUP_PAYMENTS.md](docs/SETUP_PAYMENTS.md)
- [x] [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)
- [x] [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md)
- [x] [docs/RECOMMENDATIONS.md](docs/RECOMMENDATIONS.md)
- [x] [docs/USER_MANUAL.md](docs/USER_MANUAL.md)

### Scripts útiles

- [x] `scripts/init_local_db.ps1` (Windows) — wrapper Docker + alembic + seed
- [x] `scripts/init_local_db.sh` (Linux/macOS)

### Datos

- [x] Seed con: admin demo, vendedor demo, cliente demo, ~8 categorías, productos con imágenes externas
- [x] `uploads/products/` vacío (productos demo usan URLs externas)

---

## Lo que NO incluye el ZIP

| Excluido | Por qué |
|----------|---------|
| `.git/` | Historial contenía secretos viejos (FTP, ngrok, MP). El nuevo equipo arranca un repo nuevo. |
| `.env`, `.env.local`, `.env.production`, `backend/.env*` (no-example) | Pueden contener secretos. Solo se entregan templates `.env*.example`. |
| `node_modules/`, `.venv/`, `__pycache__/`, `dist/`, `dist-ssr/` | Artefactos. Se generan con `npm install` / `pip install` / `npm run build`. |
| `topgreen-frontend/` | Build artefactos viejos. |
| `.deploy-1.0.1/`, `.deploy-restore-phase1/` | Scripts de deploy del equipo anterior con credenciales FTP. |
| `docker-compose.prod.yml`, `infra/nginx/conf.d/topgreen.prod.conf` | Configs de producción del equipo anterior con referencias a ngrok / Ferozo. |
| `Imagenes/`, marketing assets sueltos | No son requeridos por la app. |
| `.github/copilot-instructions.md` | Contenía referencias a Peakflow y credenciales de prueba MP. |
| Markdowns viejos del equipo anterior (CREDENCIALES.md, DEPLOY_LINUX.md, SISTEMA_FUNCIONANDO.md, GUIA_*.md, INSTALAR_*.md, RESUMEN_PROYECTO.md, etc.) | Reemplazados por la nueva docs/. |
| ZIPs antiguos (`topgreen-frontend*.zip`) | No relevantes. |

---

## Higiene de seguridad — verificado antes de generar el ZIP

- [x] Sin credenciales reales de Mercado Pago en código ni docs (todas las `MP_*` vacías).
- [x] Sin password ni usuario FTP del equipo anterior (eliminados los scripts de deploy).
- [x] Sin URLs de túnel ngrok del equipo anterior en código.
- [x] Sin passwords reales (sólo placeholders `CAMBIAR_*` y demos `admin123`).
- [x] CORS del backend ya no hardcodea `topgreen.com.ar` — se configura por `CORS_ORIGINS`.
- [x] `NGROK_URL` es **opcional** y vacío por default. El backend no requiere ngrok para funcionar.

---

## Validaciones técnicas previas a la entrega

- [x] `npm run build` — completa sin errores TS.
- [x] `pip install -r backend/requirements.txt` — instala sin errores.
- [x] `docker compose up -d` levanta DB + API sin errores.
- [x] `alembic upgrade head` ejecuta limpio en DB vacía.
- [x] `python -m app.seed` crea admin + categorías + productos sin errores.
- [x] `GET /api/health` responde 200.
- [x] `GET /api/products` responde JSON con productos demo.
- [x] Login `admin@topgreen.com` / `admin123` funciona.

---

## Recordatorios para el nuevo equipo

1. **Antes de producción**: rotar `JWT_SECRET`, `ADMIN_PASSWORD`, `DB_PASSWORD` y todos los secretos de Mercado Pago. Ver [docs/SETUP_PAYMENTS.md § 6](docs/SETUP_PAYMENTS.md).
2. **Mercado Pago**: la integración está **desvinculada**. El nuevo equipo debe crear su propia app marketplace y reactivar. Ver [docs/SETUP_PAYMENTS.md](docs/SETUP_PAYMENTS.md).
3. **Storage de imágenes**: en local usa filesystem (`/data/uploads`). Para producción, configurar S3 / Cloudinary (placeholders en `backend/app/core/config.py`).
4. **Fase II parcialmente integrada**: hay módulos (ratings, services, subcategorías) parcialmente implementados pero no completos. Ver [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) y [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md).
5. **Sin tests automatizados / CI**: ver [docs/RECOMMENDATIONS.md](docs/RECOMMENDATIONS.md).
