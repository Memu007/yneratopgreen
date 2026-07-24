# Mapa técnico resumido

Referencia para ubicar código sin recorrer el repositorio.

## Stack

| Capa | Tecnología | Puerto local |
|------|-----------|--------------|
| Frontend | React 18 + TypeScript + Vite | `5173` |
| Backend | FastAPI + Python 3.11 | `8000` |
| Base de datos | SQL Server 2022 | `1433` |
| Pagos | Mercado Pago Marketplace (Split) | desvinculado |

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

`backend/alembic/versions/` — 10 archivos, de `001` a `010`. Las de
Fase II relevantes: 004 `publication_type`, 005 `category_service`,
006 `subcategories`, 007 `form_options`, 009 FK
`product.subcategory_id`, 010 `ratings`.

**No existe la migración `011`.** `docs/PROJECT_STATUS.md` la declara
("migración 011 agrega `lat`, `lng` y un índice geo") pero el archivo no
está en el repositorio, no hay ninguna migración que mencione `lat`,
`lng` ni índices espaciales, y `backend/app/models/product.py` no tiene
coordenadas. Verificado el 2026-07-24. No hay geolocalización de ningún
tipo en el código.

## Documentación de entrega — `docs/`

`PROJECT_STATUS.md` (qué está hecho, parcial y faltante),
`ARCHITECTURE.md`, `DATABASE.md`, `API_ENDPOINTS.md`,
`SETUP_PAYMENTS.md`, `USER_MANUAL.md`, `KNOWN_ISSUES.md`,
`RECOMMENDATIONS.md`, `PM_ROADMAP.md`, `PM_DEV_GUIDE.md`.

Raíz: `README.md`, `README_LOCAL_SETUP.md`, `DELIVERY_CHECKLIST.md`,
`docker-compose.yml`.

## Levantar en local

```powershell
copy .env.example .env
copy backend\.env.example backend\.env
docker compose up -d
docker exec topgreen-api alembic upgrade head
docker exec topgreen-api python -m app.seed
npm install
npm run dev
```

Detalle y alternativa nativa en `README_LOCAL_SETUP.md`.
