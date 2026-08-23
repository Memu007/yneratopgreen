# Estados y contrato de datos

La composición aprobada no autoriza contenido fijo ni nuevas promesas.

## Preview de Inicio

| Estado | Representación | Acción |
|---|---|---|
| Loading | Tres skeletons con la geometría final; `aria-busy=true`. | Ninguna. |
| Éxito | Hasta tres operaciones reales. El total usa `response.total`. | CTA real de cada anatomía y `Ver todas las operaciones`. |
| Vacío | `Todavía no hay operaciones publicadas.` | `Publicar una oferta`. |
| Error | `No pudimos cargar las operaciones.` | `Reintentar` y Mercado sigue navegable. |
| Offline | `Sin conexión. Revisá tu red e intentá de nuevo.` | `Reintentar`. |

No llenar el vacío con imágenes demo, categorías inventadas ni cards guardadas
en código.

## Preview de Servicios

| Estado | Representación | Acción |
|---|---|---|
| Loading | Tres skeletons textuales; no skeleton de foto. | Ninguna. |
| Éxito | Hasta tres publicaciones `servicio`/`logistica` con cobertura, modalidad, responsable y precio/modalidad reales. | Acción definida por anatomía. |
| Vacío | `Todavía no hay servicios publicados.` | `Publicar un servicio`. |
| Error | `No pudimos cargar los servicios.` | `Reintentar`. |
| Offline | Copy global de sin conexión. | `Reintentar`. |

Una publicación sin cobertura/modalidad obligatoria no se completa desde el
título. Se omite el dato opcional o se reporta deuda de integridad.

## Hero y activos

- Error de imagen hero: reservar el espacio con `surface-subtle`, mantener copy
  y CTA; no usar ilustración de categoría.
- `alt` Home: describe cosecha y descarga, no repite el H1.
- `alt` Servicios: describe relevamiento aéreo e inundación; no afirma que sea
  una publicación ni un prestador.
- Respetar `prefers-reduced-motion`; no usar video autoplay en el hero.

## Mercado

Mantener los estados aceptados de UX-2B: carga, vacío filtrado, error, offline,
disabled, sin stock, pausado, sin foto, foto rota, texto largo y precio no
publicado. Esta extensión cambia superficie y jerarquía, no semántica.

## Fuente de cada dato

| Dato | Fuente |
|---|---|
| Total de operaciones | `ProductListResponse.total`. |
| Primeras operaciones | `getProducts` con orden canónico vigente. |
| Tipo de operación | `operationKind`/`isService`, nunca título o precio. |
| Precio/modalidad | `precioVisible` y `pricingType`. |
| Cobertura | `coverageZones`. |
| Ubicación | Contrato actual; no reordenar texto libre. |
| Acción | `accionDe(product)`. |
| Foto de publicación | URL real + `ProductImage`; nunca asset conceptual. |
