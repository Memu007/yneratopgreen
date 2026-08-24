# Originales de la clienta, fuera de lo que se sirve

Estos archivos estaban en `public/`, que Vite copia entero al build y publica
por URL. Ninguno se usa hoy en el producto y dos de ellos no deberían salir a
la red tal como están:

| Archivo | Peso | Por qué está acá |
|---|---:|---|
| `DJI_0079.JPG` | 5,9 MB | Fuente de los dos derivados del hero de Inicio. Contiene EXIF con GPS. `ACTIVOS.md` prohíbe servirlo. |
| `relevamiento-inundacion.jpg` | 175 KB | Fuente del hero interino de Servicios. |
| `relevamiento-inundacion-01.jpg` | 181 KB | Variante de la misma toma, sin uso. |
| `cosecha-01.jpg` | 291 KB | Sin uso desde que la portada dejó de tener fotografía de relleno. |
| `video-servicios.mp4` | 20,9 MB | El video con overlay que UX-2C retiró de Servicios. |

Se mueven, no se borran: son material de la clienta y siguen siendo la fuente
de los derivados aprobados. Acá quedan versionados y trazables, pero no se
publican con el sitio.

`extension-comercial/ACTIVOS.md` los nombra todavía con su ruta anterior
—`public/DJI_0079.JPG`, `public/relevamiento-inundacion.jpg`—: es el documento
de Diseño y no se edita desde Dev. Esta es la ruta nueva.

Lo que sigue en `public/` porque el producto lo usa: `topG.png` (favicon),
`MercedesRaiz.jpg` y `video-topgreen.mp4` (Quiénes somos, que esta pieza no
rehace), los wordmarks, las fuentes, los estados y los cuatro WebP comerciales.
