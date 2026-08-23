# Reglas responsive

Las capturas son consecuencias de estas reglas; no son la especificación.

## 1440×900 — desktop

- Contenedor máximo 1320 px, gutter exterior 48 px.
- Header sticky completo: wordmark, buscador, acciones y navegación.
- Catálogo: filtro lateral de 268 px sticky; resultados al lado.
- Activo de alto valor ocupa ancho completo de resultados; las otras anatomías
  forman tres columnas sólo cuando caben sin bajar de 280 px.
- Detalle: galería/cuerpo a la izquierda y resumen de operación sticky a la
  derecha. Nada tapa el footer.
- Orden de teclado sigue DOM: marca, búsqueda, sesión, navegación, filtros,
  orden, resultados y paginación.

## 768×1024 — tablet

- Gutter exterior 32 px, grilla de 8 columnas.
- Header en dos líneas: marca/acciones y búsqueda completa; navegación visible.
- Filtro lateral se reemplaza por `details`/drawer sobre el flujo. No consume
  una columna permanente.
- Catálogo de dos columnas; activo de alto valor ocupa ambas.
- Detalle: galería, resumen y cuerpo en una columna. El resumen deja de ser
  sticky para evitar saltos y superposición.

## 390×844 — mobile

- Gutter exterior 20 px, grilla de 4 columnas.
- Header no sticky: marca y sesión, búsqueda debajo, navegación en dos columnas.
- Nunca se ocultan búsqueda, precio, ubicación, condición, vendedor ni CTA.
- Filtros cerrados por defecto; al abrirse son parte del flujo y terminan con
  `Ver N resultados`. No bloquean resultados de forma permanente.
- Catálogo en una columna. No hay dependencia de hover.
- Detalle: título, imagen/fallback, precio, condición, acción, vendedor,
  logística y especificaciones en ese orden.
- Tabla técnica se transforma a pares etiqueta/valor; no hay scroll horizontal.

## Límites de contenido

| Contenido | Catálogo | Detalle |
|---|---|---|
| Título | 3 líneas visuales; nombre completo accesible | Sin truncado |
| Precio | Línea propia; no ellipsis | Línea propia; puede bajar a 40 px |
| Ubicación | 2 líneas | Sin truncado razonable |
| Vendedor | 2 líneas | Sin truncado |
| Datos técnicos | Máximo 3 visibles | Tabla/lista completa presente |
| Botón | Texto completo; puede ocupar ancho total | Texto completo |

Las acciones y controles principales —botones, campos, selects, checks, radios,
carga de archivo, cierre de capas y tabs— tienen un área mínima de `44×44 px`.
No se extiende esa regla a todo enlace textual: breadcrumbs y enlaces inline,
de tablero o pie cumplen WCAG 2.5.8 mediante un target de al menos `24×24 px`,
separación suficiente respecto de targets vecinos o la excepción inline cuando
forman parte de una línea de texto. Ninguna acción depende de hover.
`:focus-visible` usa outline externo de 3 px. Se verifica que
`scrollWidth === clientWidth` en los tres viewports antes de aceptar.
