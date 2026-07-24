# Ynera TopGreen — Alcance estable

Marketplace agropecuario. Este documento cubre lo que no cambia entre
sesiones. El estado móvil vive en `NOW.md`.

## Qué es

Plataforma donde vendedores del sector agropecuario publican productos y
compradores los encuentran, los agregan a un carrito y pagan. La
plataforma cobra una comisión sobre cada venta.

## Actores

| Actor | Puede |
|-------|-------|
| Comprador | Buscar y filtrar catálogo, ver detalle, carrito, comprar, ver sus órdenes, calificar vendedores |
| Vendedor | Publicar y administrar sus productos, ver sus ventas, vincular su cuenta de cobro |
| Admin | Gestionar usuarios, productos, órdenes y categorías; ver estadísticas |

Los roles en base son `admin` y `user`. Vendedor y comprador no son roles
distintos: cualquier usuario puede publicar y comprar.

## Modelo de negocio

Split payment vía Mercado Pago Marketplace: 5 % para la plataforma, 95 %
para el vendedor. El porcentaje es configurable
(`MP_COMMISSION_PERCENT`). Moneda única: ARS.

## Recorrido comprador

Catálogo → filtros → detalle de producto → carrito → checkout → pago →
resultado de pago → seguimiento de la orden.

## Alcance Fase I — construido

Autenticación con JWT, catálogo con filtros por categoría, texto y rango
de precio, CRUD de publicaciones con imágenes, carrito persistido,
órdenes con estados (`pending`, `paid`, `shipped`, `delivered`,
`cancelled`), panel de administración, integración de pagos completa a
nivel de código, diseño responsive con modo claro y oscuro.

Detalle en `docs/PROJECT_STATUS.md`.

## Fase II — presente pero incompleto

Estos módulos están entrelazados en migraciones, modelos y UI. No se
apagan con un feature flag. Cada uno necesita una decisión explícita:

| Módulo | Estado |
|--------|--------|
| Ratings de vendedores | API y UI funcionando, sin tests ni validación a escala |
| Productos vs servicios | Campos en base y UI parcial; `ServicesPage` es estática |
| Subcategorías | Tabla y endpoint listos; sin CRUD en admin ni datos de seed |
| Form options dinámicos | Tabla y endpoint listos; el frontend usa listas hardcoded |
| Filtros geográficos | Columnas e índice listos; sin búsqueda por proximidad en UI |

## Fuera de alcance

Almacenamiento externo de imágenes, búsqueda full-text, email
transaccional, recuperación de contraseña, mensajería comprador ↔
vendedor, reviews de productos, favoritos, cupones, multi-moneda,
multi-idioma, tests E2E, CI/CD, telemetría.

## Restricciones heredadas de la entrega

- Las credenciales de Mercado Pago se entregaron vacías. El equipo actual
  usa su propia aplicación.
- Las imágenes se guardan en filesystem local (`/data/uploads`). La
  propia entrega lo marca como no apto para producción.
- No hay dependencia del equipo anterior: ni servidor, ni túnel, ni
  hosting, ni base productiva previa.
- Las credenciales demo del seed (`admin123`, etc.) deben cambiarse antes
  de producción.
