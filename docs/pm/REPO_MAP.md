# Mapa técnico resumido

Referencia para ubicar código sin recorrer el repositorio.

## Stack

| Capa | Tecnología | Puerto local |
|------|-----------|--------------|
| Frontend | React 18 + TypeScript + Vite | `5173` |
| Backend | FastAPI + Python 3.11 | `8000` |
| Base de datos | PostgreSQL 16 + PostGIS 3.4 | `5433` en el host, `5432` dentro de Docker |
| Pagos | Mercado Pago Marketplace (Split) | desvinculado |

Sólo está habilitada la extensión `postgis`. `postgis_tiger_geocoder`,
`postgis_topology` y `fuzzystrmatch` se eliminan en el arranque vía
`infra/postgres/init/99_topgreen_postgis_only.sh`, que corre después del
init de la imagen y sobrevive a `docker compose down -v`.

## Frontend — `src/`

Entrada: `src/main.tsx` → `src/App.tsx`.

**Navegación**: por estado, no por router. `App.tsx` mantiene
`currentSection` de tipo `PageSection`:
`home | marketplace | about | services | contact | payment-success |
payment-failure | payment-pending`.
No hay `react-router`; `package.json` solo declara `react` y `react-dom`.
Consecuencia: no existe URL por producto ni deep link.

### Pantallas — `src/components/Pages/`

| Archivo | Rol |
|---------|-----|
| `HomePage.tsx` | Portada y acceso al marketplace |
| `AboutPage.tsx` | Institucional |
| `ServicesPage.tsx` | Estática: describe servicios de la empresa, no es marketplace de servicios |
| `ContactPage.tsx` | Formulario de contacto general |
| `PaymentResultPage.tsx` | Éxito / pendiente / error de pago |

### Componentes de dominio — `src/components/`

`Header/`, `Footer/`, `ProductGrid/`, `ProductCard/`, `ProductDetail/`,
`FilterSidebar/`, `Cart/`, `Checkout/`, `AddProduct/`, `UserDashboard/`,
`AdminPanel/`, `SellerProfile/`, `Auth/`, `Toast/`.

### Estado global — `src/contexts/`

`AuthContext.tsx`, `CartContext.tsx`, `ThemeContext.tsx` (claro/oscuro).

Otros: `src/hooks/`, `src/types/`, `src/utils/`, `src/data/`.

## Backend — `backend/app/`

### API — `backend/app/api/`

| Módulo | Cubre |
|--------|-------|
| `auth.py` | Registro, login JWT, perfil, cambio de password |
| `catalog.py` | Categorías, subcategorías, form options |
| `products.py` | CRUD de publicaciones e imágenes |
| `cart.py` | Carrito persistido por usuario |
| `orders.py` | Órdenes comprador y vendedor, estados |
| `payments.py` | Preferences, webhook, sync de Mercado Pago |
| `mp_oauth.py` | Vinculación OAuth de vendedores |
| `ratings.py` | Calificaciones de vendedores (Fase II parcial) |
| `notifications.py` | Notificaciones in-app |
| `contact.py` | Formulario de contacto |
| `admin.py` | Usuarios, productos, órdenes, categorías, stats |

### Modelos — `backend/app/models/`

`user`, `product`, `product_image`, `category`, `subcategory`,
`form_option`, `cart`, `order`, `payment`, `rating`, `notification`,
`contact`, `audit`.

Otros: `core/` (config y seguridad), `db/`, `schemas/`,
`services/storage.py` (subida de imágenes a filesystem),
`middlewares/`.

### Migraciones

**Una sola migración**: `766eee72137f_esquema_inicial_postgresql`,
generada desde los modelos. 15 tablas, 40 índices, sin `DROP` ni `ALTER`.
`alembic upgrade head` verificado, y un autogenerate posterior no detecta
diferencias.

Las 10 migraciones heredadas de SQL Server se eliminaron: describían un
esquema anterior al rediseño de los modelos. Quedan en el historial de
git.

Los modelos son la fuente de verdad del esquema. Cualquier cambio de
esquema se hace en el modelo y se genera la migración.

**No hay geolocalización todavía.** Ninguna tabla tiene coordenadas.
PostGIS está instalado y disponible, sin usar.

## Documentación de entrega — `docs/`

`PROJECT_STATUS.md` (qué está hecho, parcial y faltante),
`ARCHITECTURE.md`, `DATABASE.md`, `API_ENDPOINTS.md`,
`SETUP_PAYMENTS.md`, `USER_MANUAL.md`, `KNOWN_ISSUES.md`,
`RECOMMENDATIONS.md`, `PM_ROADMAP.md`, `PM_DEV_GUIDE.md`.

Raíz: `README.md`, `README_LOCAL_SETUP.md`, `DELIVERY_CHECKLIST.md`,
`docker-compose.yml`.

## Levantar en local

```bash
./scripts/init_local_db.sh   # crea la base, migra y siembra
npm install && npm run dev
```

El script es idempotente y reproducible desde cero
(`docker compose down -v` y volver a correrlo). El seed también es
repetible: reconoce los registros existentes.

El equivalente en Windows es `scripts/init_local_db.ps1`.

Verificado el 2026-07-25 con los diez smoke tests en verde. El
quickstart de tres comandos del `README.md` describe el flujo anterior de
SQL Server y **no es válido**.
