# Manifiesto de capturas

Las capturas se producen desde los HTML/CSS del paquete. Todas conservan el
viewport nominal exacto; las versiones desplazadas cambian sólo el scroll
vertical para mostrar contenido que queda debajo del primer pliegue.

| Prototipo | 1440×900 | 768×1024 | 390×844 |
|---|---|---|---|
| Catálogo · primer pliegue | `marketplace-1440x900.png` | `marketplace-768x1024.png` | `marketplace-390x844.png` |
| Catálogo · resultados | `marketplace-1440x900-resultados.png` | `marketplace-768x1024-resultados.png` | `marketplace-390x844-resultados.png` |
| Detalle · primer pliegue | `detalle-1440x900.png` | `detalle-768x1024.png` | `detalle-390x844.png` |
| Detalle · operación | — | — | `detalle-390x844-operacion.png` |
| Tablero · primer pliegue | `estados-1440x900.png` | `estados-768x1024.png` | `estados-390x844.png` |
| Tablero · anatomías | — | — | `estados-390x844-anatomias.png` |

Los artefactos del motor de captura —paginación, controles nativos y anotaciones
PDF— se neutralizan únicamente durante el render. La fuente entregable conserva
`details`, botones, enlaces, foco y media queries semánticos. La comparación de
implementación se hace contra sistema, jerarquía y comportamiento según
`PARIDAD.md`, no por píxel ciego.
