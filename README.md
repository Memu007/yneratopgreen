# TopGreen / AgroMarket — Fase I

> **Marketplace agropecuario** con catálogo de productos, carrito, checkout e
> integración de Mercado Pago Split Payments (5% comisión marketplace / 95%
> vendedor).

Este repositorio es la **entrega de Fase I** preparada para que un nuevo
equipo técnico levante el proyecto en local desde cero, sin dependencias
del equipo original (sin servidor de Peakflow, sin túnel ngrok obligatorio,
sin credenciales del equipo anterior).

**Correspondencia con producción**: el código fuente de este paquete
coincide con la versión actualmente publicada en `topgreen.com.ar`.
Reproducción bit-a-bit del bundle JS verificada — ver
[DELIVERY_CHECKLIST.md](DELIVERY_CHECKLIST.md). La configuración de
despliegue (URLs, nginx, CORS) está sanitizada para entorno local.

---

## Independencia de infraestructura — qué NO requiere este paquete

Este paquete está preparado para **levantamiento 100 % local** y **NO** queda
apuntando ni depende de ninguno de los siguientes elementos del equipo
anterior:

- ❌ Servidor anterior del equipo desarrollador previo (Peakflow).
- ❌ Túnel ngrok anterior.
- ❌ URL `peakflow-topgreen.ngrok.app` (eliminada del código y configuración).
- ❌ Hosting / Ferozo usado anteriormente.
- ❌ Dominio `topgreen.com.ar` como dependencia obligatoria (puede usarse, pero no es requerido para correr o desplegar).
- ❌ Credenciales FTP / SSH del equipo anterior.
- ❌ Credenciales de Mercado Pago del equipo anterior (todas las variables `MP_*` se entregan vacías).
- ❌ Base de datos productiva anterior (se entrega esquema vía migraciones Alembic + datos demo vía seed).
- ❌ Variables de entorno reales del equipo anterior (sólo `.env*.example` con valores locales o placeholders `CAMBIAR_*`).

El nuevo equipo crea sus propias credenciales, su propia base de datos local,
su propia aplicación de Mercado Pago y su propia infraestructura de
despliegue. Más detalles en [DELIVERY_CHECKLIST.md](DELIVERY_CHECKLIST.md) y
[docs/SETUP_PAYMENTS.md](docs/SETUP_PAYMENTS.md).

---

## Stack

| Capa | Tecnología | Puerto local |
|------|-----------|--------------|
| Frontend | React 18 + TypeScript + Vite | `5173` |
| Backend | FastAPI + Python 3.11 | `8000` |
| Base de datos | PostgreSQL 16 + PostGIS 3.4 | `5433` (host) / `5432` (Docker) |
| Pagos | Mercado Pago Marketplace (Split) | — (requiere reactivar) |

---

## Documentación incluida

Antes de hacer cualquier cosa, leé en este orden:

1. **[README_LOCAL_SETUP.md](README_LOCAL_SETUP.md)** — Cómo levantar el proyecto localmente (paso a paso, Docker o nativo).
2. **[docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)** — Qué está implementado, qué está parcial, qué falta.
3. **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — Diagrama, flujos, decisiones técnicas.
4. **[docs/DATABASE.md](docs/DATABASE.md)** — Esquema, migraciones, seed.
5. **[docs/API_ENDPOINTS.md](docs/API_ENDPOINTS.md)** — Endpoints principales.
6. **[docs/SETUP_PAYMENTS.md](docs/SETUP_PAYMENTS.md)** — Cómo reactivar Mercado Pago.
7. **[docs/USER_MANUAL.md](docs/USER_MANUAL.md)** — Manual operativo (admin / vendedor / comprador).
8. **[docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md)** — Bugs y limitaciones conocidos.
9. **[docs/RECOMMENDATIONS.md](docs/RECOMMENDATIONS.md)** — Recomendaciones para continuar.
10. **[DELIVERY_CHECKLIST.md](DELIVERY_CHECKLIST.md)** — Checklist de qué incluye la entrega.

---

## Levantar el proyecto en 3 comandos (Docker)

```bash
# 1. Variables de entorno (defaults locales)
cp .env.example .env
cp backend/.env.example backend/.env

# 2. Levantar DB + API + migraciones + seed
./scripts/init_local_db.sh

# 3. Frontend dev
npm install
npm run dev
```

Detalles, alternativa nativa y troubleshooting en
[README_LOCAL_SETUP.md](README_LOCAL_SETUP.md).

---

## Smoke tests integrales

El segundo comando elimina los volúmenes Docker locales, reinicializa la
aplicación y ejecuta los 41 casos:

```bash
npm install
npm run smoke
```

---

## Accesibilidad

Dos puertas distintas y complementarias. Las dos necesitan la API en `:8000`
y el frontend en `:5173`, con el seed cargado, y miden en **1440x900 y
390x844**.

```bash
npm run a11y         # axe: falla ante violaciones serious o critical
npm run a11y -- --todas   # ademas lista las minor y moderate
npm run contraste    # parejas texto/fondo: 4,5:1 normal, 3:1 grande
```

**Ninguna reemplaza a la otra.** `a11y` cubre nombres accesibles, roles,
rotulos y estructura, que el barrido de contraste no mira. `contraste` cubre
lo que axe deja en "incompleto": gradientes, texto sobre foto, capas
translucidas y opacidad heredada. Detalle de cada una en la cabecera de
`scripts/a11y.mjs` y `scripts/contraste.mjs`.

---

## Credenciales demo (creadas por el seed)

| Rol | Email | Password |
|-----|-------|----------|
| Admin | `admin@topgreen.com` | `admin123` |
| Vendedor | `vendedor@ejemplo.com` | `vendedor123` |
| Cliente | `cliente@ejemplo.com` | `cliente123` |

**⚠️ Cambiar antes de producción.**

---

## Versión

`1.0.1` (último build deployado a producción durante el handover).
