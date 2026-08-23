# Tokens y tipografía

La fuente reutilizable es [`tokens.css`](./tokens.css). Esta tabla explica la
intención y las combinaciones válidas; Opus no debe reemplazar roles por tonos
“parecidos”.

## Tipografías

| Familia | Pesos usados | Uso | Fallback | Origen/licencia |
|---|---|---|---|---|
| Newsreader variable | 400, 520, 600 | Wordmark, display, H1–H3 | Georgia, Times New Roman, serif | Google Fonts; OFL 1.1 incluida |
| Work Sans variable | 400, 500, 570, 600, 650, 700 | UI, cuerpo, etiquetas, números | Inter, system-ui, Segoe UI, sans-serif | Google Fonts; OFL 1.1 incluida |

Archivos oficiales incluidos en `assets/fonts/`. Si una fuente no carga, la
composición debe conservar tamaños y line-height; no ocultar contenido durante
la carga (`font-display: swap`).

## Escala tipográfica desktop

| Estilo | Familia | Tamaño / línea | Peso | Tracking | Uso |
|---|---|---:|---:|---:|---|
| Display | Newsreader | 72 / 71 px | 520 | -0,025 em | Portada o tablero, no catálogo rutinario |
| H1 | Newsreader | 56 / 57 px | 520 | -0,025 em | Título de pantalla |
| H2 | Newsreader | 40 / 43 px | 520 | -0,025 em | Sección principal |
| H3 | Newsreader | 28 / 32 px | 520 | -0,02 em | Publicación o bloque |
| H4 | Work Sans | 22 / 28 px | 600 | -0,01 em | Subsección funcional |
| H5 | Work Sans | 18 / 24 px | 650 | 0 | Grupo de controles |
| H6 | Work Sans | 16 / 22 px | 650 | 0 | Encabezado compacto |
| Cuerpo | Work Sans | 16 / 24 px | 400 | 0 | Lectura y controles |
| Cuerpo pequeño | Work Sans | 14 / 20 px | 400 | 0 | Ayuda y metadata |
| Etiqueta | Work Sans | 12 / 15 px | 650 | 0,07 em | Categoría/estado; mayúsculas |
| Dato | Work Sans | 16 / 22 px | 600 | 0 | Especificaciones y tablas |

En mobile: H1 `38/39`, H2 `30/33`, H3 `24/28` y Display `42/41`. Cuerpo y
controles no bajan de 16 px; cuerpo pequeño no baja de 14 px.

## Números, moneda y unidades

- Precios y datos usan Work Sans con `font-variant-numeric: tabular-nums`.
- Argentina inicial: `Intl.NumberFormat('es-AR')`; ejemplo `$98.000.000`.
- Mostrar código `ARS` cuando convivan monedas: `ARS 98.000.000`.
- No truncar precios. En mobile bajan hasta 40 px y pueden ocupar línea propia.
- Unidades con espacio no separable: `50 kg`, `350 km`, `3.400 h`, `180 HP`.
- Decimales con coma; miles con punto. La moneda y el locale deben ser datos de
  formato, no texto hardcodeado en el componente.
- `A cotizar` reemplaza precio ausente; `$0` está prohibido.

## Títulos largos y mayúsculas

- Catálogo: máximo visual de tres líneas; conservar nombre completo en el DOM y
  nombre accesible. No cortar por caracteres en los datos.
- Detalle: sin truncado; `overflow-wrap: anywhere` sólo como última defensa.
- Mayúsculas únicamente en etiquetas de 12 px y códigos de operación.
- No escribir títulos, botones ni párrafos completos en mayúsculas.

## Color y contraste

| Rol | Token | Valor | Uso / ratio mínimo comprobado |
|---|---|---|---|
| Canvas | `--tg-color-canvas` | `#F8F7F3` | Fondo general |
| Superficie | `--tg-color-surface` | `#FFFFFF` | Paneles y controles |
| Superficie sutil | `--tg-color-surface-subtle` | `#E8ECF4` | Selección y fallback |
| Texto | `--tg-color-text` | `#17213D` | 14,83:1 sobre canvas; 15,89:1 sobre blanco |
| Texto secundario | `--tg-color-text-secondary` | `#596174` | 5,78:1 sobre canvas |
| Marca / acción | `--tg-color-brand` | `#17213D` | Blanco encima: 15,89:1 |
| Acento | `--tg-color-accent` | `#B93424` | 5,47:1 sobre canvas; blanco encima 5,87:1 |
| Link / info | `--tg-color-link` | `#1D4E89` | 7,83:1 sobre canvas |
| Éxito | `--tg-color-success` | `#1F6B4F` | 5,98:1 sobre canvas |
| Advertencia | `--tg-color-warning` | `#79520F` | 6,47:1 sobre canvas |
| Error | `--tg-color-error` | `#A22F2F` | 6,57:1 sobre canvas |
| Borde de control | `--tg-color-border-control` | `#7C8494` | 3,51:1 sobre canvas; límite no textual |
| Borde sutil | `--tg-color-border` | `#CFD3DC` | Separación decorativa; no delimita controles |
| Foco | `--tg-color-focus` | `#B93424` | Outline de 3 px, no depende del borde |

Ratios calculados según WCAG 2.2. No redondear un fallo hacia arriba. Los
controles disabled usan colores explícitos, no opacidad heredada; están exentos
de contraste pero deben seguir siendo reconocibles.

## Espaciado, grilla y ancho

- Escala: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80 px`.
- Contenedor máximo: `1320 px`.
- Texto de lectura: máximo `760 px`.
- Desktop: 12 columnas, gutter exterior 48 px, gap 24 px.
- Tablet: 8 columnas, gutter exterior 32 px, gap 20 px.
- Mobile: 4 columnas, gutter exterior 20 px, gap 16 px.

## Bordes, radios, elevación y overlays

- Radios: `0, 2, 4, 6 px`. Tarjetas: 0; botones/campos: 2; modal: 4.
- Tarjetas y paneles no llevan sombra. La jerarquía usa regla, borde y fondo.
- Sombra sólo en modal, drawer y toast: `0 20px 60px rgba(23,33,61,.18)`.
- Overlay modal: `rgba(23,33,61,.72)`.
- Bordes de control: 1 px `#7C8494`; seleccionado: 2 px índigo.

## Breakpoints y movimiento

- Mobile: `0–599 px`.
- Tablet: `600–1023 px`.
- Desktop: `>=1024 px`.
- Desktop amplio: `>=1280 px`.
- Control táctil mínimo: `44×44 px`.
- Transición necesaria: `160 ms`, easing `cubic-bezier(.2,.8,.2,1)`.
- Sólo color, borde, overlay y apertura/cierre. Sin parallax, levitación de
  tarjetas ni animación del wordmark.
- Respetar `prefers-reduced-motion: reduce`.
