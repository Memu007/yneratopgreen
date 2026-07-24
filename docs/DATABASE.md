# Base de datos — TopGreen

## Motor

**SQL Server 2022** (Developer en Docker para dev, 2019+ compatible).

Connection string esperado:
```
mssql+pyodbc://sa:<password>@<host>:1433/<db>?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes
```

---

## Tablas principales

| Tabla | Propósito | Migración que la crea |
|-------|-----------|----------------------|
| `users` | Usuarios (admin / vendedor / cliente). Roles, MP OAuth tokens. | 001 + 003 |
| `categories` | Categorías raíz. Tiene `is_service` (Fase II). | 001 + 005 |
| `subcategories` | Subcategorías por categoría (Fase II). | 006 |
| `form_options` | Opciones para formularios dinámicos por subcategoría (Fase II). | 007 |
| `products` | Publicaciones (productos y servicios). Campos `publication_type`, `pricing_type`, etc. | 001 + 004 + 009 + 011 |
| `product_images` | Imágenes de cada producto. | 001 |
| `cart_items` | Items en carrito por usuario. | 001 |
| `orders` | Órdenes de compra. | 001 |
| `order_items` | Líneas de orden. | 001 |
| `payments` | Tracking de pagos MP. | 002 |
| `ratings` | Calificaciones de compradores a vendedores (Fase II). | 010 |
| `notifications` | Notificaciones in-app. | 008 |

Modelos SQLAlchemy: `backend/app/models/`.

---

## Migraciones (Alembic)

Listado completo en `backend/alembic/versions/`:

| # | Archivo | Fase | Resumen |
|---|---------|------|---------|
| 001 | `001_initial_mssql_migration.py` | I | Esquema base (users, products, categories, cart, orders) |
| 002 | `002_add_payments_table.py` | I | Tabla `payments` |
| 003 | `003_add_mp_oauth_fields.py` | I | Campos OAuth MP en users (`mp_access_token`, `mp_refresh_token`, etc.) |
| 004 | `004_add_service_fields.py` | II | Campos `publication_type`, `pricing_type`, `experience_years`, etc. |
| 005 | `005_category_service.py` | II | Flag `is_service` en categories |
| 006 | `006_subcategories.py` | II | Tabla `subcategories` |
| 007 | `007_form_options.py` | II | Tabla `form_options` |
| 008 | `008_add_notifications.py` | I | Tabla `notifications` |
| 009 | `009_add_product_subcategory.py` | II | FK `product.subcategory_id` |
| 010 | `010_add_ratings_table.py` | II | Tabla `ratings` con avg/count cacheado en users |
| 011 | `011_add_indexed_filters_and_geo.py` | II | Índices para filtros + lat/lng |

> **Importante**: las migraciones de Fase II **no se pueden separar** sin
> romper FKs. Si el nuevo equipo decide no usar features de Fase II,
> simplemente no los expone en el frontend — pero las tablas quedan.
> Ver [PROJECT_STATUS.md](PROJECT_STATUS.md).

---

## Comandos Alembic

```powershell
# Aplicar TODAS las migraciones pendientes
docker exec topgreen-api alembic upgrade head

# Ver versión actual de la DB
docker exec topgreen-api alembic current

# Ver historial
docker exec topgreen-api alembic history --verbose

# Bajar 1 migración
docker exec topgreen-api alembic downgrade -1

# Resetear a vacío
docker exec topgreen-api alembic downgrade base

# Crear migración nueva (desarrollo)
docker exec topgreen-api alembic revision --autogenerate -m "descripcion"
```

---

## Seed de datos demo

Script: `backend/app/seed.py`

```powershell
docker exec topgreen-api python -m app.seed
```

Crea (idempotente — no duplica):

| Recurso | Detalle |
|---------|---------|
| Admin | `admin@topgreen.com` / `admin123` (rol `admin`) |
| Vendedor | `vendedor@ejemplo.com` / `vendedor123` |
| Cliente | `cliente@ejemplo.com` / `cliente123` |
| Categorías | 8 categorías (Semillas, Fertilizantes, Herramientas, Maquinaria, Agroquímicos, Servicios, etc.) |
| Productos | ~10–15 productos con imágenes públicas (Unsplash) |

---

## Resetear la DB completa

```powershell
# Bajar todo y BORRAR el volumen db_data
docker compose down -v

# Levantar de nuevo (DB vacía)
docker compose up -d

# Esperar healthcheck (~30s)
docker compose ps

# Re-aplicar migraciones + seed
docker exec topgreen-api alembic upgrade head
docker exec topgreen-api python -m app.seed
```

---

## Backup / Restore (manual)

### Backup
```powershell
docker exec topgreen-db /opt/mssql-tools18/bin/sqlcmd `
  -S localhost -U sa -P "$env:DB_PASSWORD" -C `
  -Q "BACKUP DATABASE topgreen TO DISK='/var/opt/mssql/backup/topgreen.bak' WITH INIT"

docker cp topgreen-db:/var/opt/mssql/backup/topgreen.bak ./topgreen.bak
```

### Restore
```powershell
docker cp ./topgreen.bak topgreen-db:/var/opt/mssql/backup/topgreen.bak

docker exec topgreen-db /opt/mssql-tools18/bin/sqlcmd `
  -S localhost -U sa -P "$env:DB_PASSWORD" -C `
  -Q "RESTORE DATABASE topgreen FROM DISK='/var/opt/mssql/backup/topgreen.bak' WITH REPLACE"
```

---

## Inspección rápida

```powershell
# Conectarse con sqlcmd dentro del container
docker exec -it topgreen-db /opt/mssql-tools18/bin/sqlcmd `
  -S localhost -U sa -P "$env:DB_PASSWORD" -C -d topgreen

# Una vez dentro:
1> SELECT name FROM sys.tables;
2> GO

1> SELECT id, email, role FROM users;
2> GO
```

O con un cliente GUI (Azure Data Studio, DBeaver, SSMS) apuntando a
`localhost:1433` con usuario `sa`.
