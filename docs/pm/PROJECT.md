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
| Comprador | Buscar por texto, categoría y ubicación; ver detalle; carrito; comprar o pedir cotización; seguir sus órdenes |
| Vendedor / prestador | Publicar y administrar publicaciones, cotizar consultas, ver sus ventas, cobrar |
| Transportista | Ofrecer cobertura logística, ser seleccionado o cotizar un envío |
| Admin | Gestionar usuarios, publicaciones, órdenes y categorías; validar cuentas; ver estadísticas |

**Brecha:** el código sólo distingue `admin` y `user`. Comprador y
vendedor están unificados y **el transportista no existe**. Los cuatro
perfiles son requisito contractual.

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
| Filtros geográficos | **No existen.** La documentación de entrega los declara, pero no hay migración, ni columnas, ni código |

## MVP contractual — lo que falta

El alcance vinculante está en `docs/PM_ROADMAP.md` (versión 3, auditada
el 20-07-2026), no en la documentación de entrega. Brechas mayores:

| Brecha | Estado |
|--------|--------|
| PostgreSQL + PostGIS | El contrato lo define; el código usa SQL Server |
| Geolocalización y búsqueda por radio | No existe nada |
| Transportistas y logística de cercanía | No existe la entidad ni el flujo |
| Transferencia bancaria con comprobante | No existe CBU/alias, carga ni aprobación |
| Roles separados (4 perfiles) | Sólo `admin` y `user` |
| Validación real de cuentas | Hay campo `is_verified`, sin flujo |
| Modos `compra_directa` / `consulta_cotizacion` | No implementados |
| Categorías Bienes/Ganado y Tecnología de Cultivo | Incompletas |
| Seguridad: rate limiting, JWT en `localStorage` | Sin resolver |

Estimación del roadmap: **9–11 semanas** desde que se apruebe la línea
base. El producto es un prototipo funcional, no un MVP contractual.

## Benchmark — Agrofy

**El cliente no pidió Agrofy y no lo conoce.** Es una referencia interna
del equipo, adoptada por decisión de PM el 20-07-2026, para tener un
modelo mental de cómo se ordena un marketplace agropecuario.

Consecuencia: **Agrofy no justifica alcance.** No es requisito de nada.
Sirve para resolver *cómo* implementar algo que el contrato ya pide
(cómo agrupar filtros, qué campos lleva una ficha de maquinaria), nunca
para decidir *qué* construir. Si un patrón de Agrofy no se puede trazar
a un requisito del PDF, no entra: es alcance que nos inventamos y no está
pagado.

**Se usa como referencia para:** estructura del buscador (texto +
categoría + ubicación), taxonomía agropecuaria y subcategorías, qué
filtros aplican por categoría, qué campos lleva cada ficha técnica según
tipo de publicación, perfil público de vendedor tipo sucursal, y la
separación entre compra directa y consulta/cotización.

**No se toma:** HTML, CSS ni JS del sitio, textos literales, marca,
logotipos, imágenes, ni el diseño visual distintivo. Los patrones se
reimplementan desde cero con identidad propia de TopGreen.

La logística geográfica es el diferencial propio de TopGreen y no sale
del benchmark.

## Fuente de verdad del alcance

El alcance vinculante es el **PDF del contrato**. `PM_ROADMAP.md` v3 es
un resumen de ese PDF hecho en la auditoría del 20-07-2026, no el
contrato en sí.

**El PDF no está en el repositorio.** Mientras no esté, toda decisión de
alcance se está tomando sobre un resumen de segunda mano. Conseguirlo o
transcribir sus requisitos es prioritario.

## Fuera de alcance

Publicidad y posiciones patrocinadas, financiación y canje, portal
editorial y SEO masivo, suscripciones para vendedores, recomendaciones
con IA, multi-país y multi-idioma, paridad con Agrofy.

Tampoco entran: mensajería comprador ↔ vendedor, reviews de productos,
favoritos, cupones.

## Restricciones heredadas de la entrega

- Las credenciales de Mercado Pago se entregaron vacías. El equipo actual
  usa su propia aplicación.
- Las imágenes se guardan en filesystem local (`/data/uploads`). La
  propia entrega lo marca como no apto para producción.
- No hay dependencia del equipo anterior: ni servidor, ni túnel, ni
  hosting, ni base productiva previa.
- Las credenciales demo del seed (`admin123`, etc.) deben cambiarse antes
  de producción.
