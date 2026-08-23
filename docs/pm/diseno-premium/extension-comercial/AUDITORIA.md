# Auditoría del handoff aprobado

Fecha: 2026-08-23
Alcance: sólo `docs/pm/diseno-premium/extension-comercial/`; producto sin
modificar durante Diseño.

## Axe + navegador

- axe-core `4.12.1`, inyectado localmente;
- Chromium headless por HTTP local;
- tres prototipos × tres viewports;
- fuentes y assets locales esperados antes de auditar;
- control de consola, errores de página y overflow horizontal.

| Prototipo | Viewport | Violaciones axe | Serious/critical | Consola/página | Overflow |
|---|---:|---:|---:|---:|---:|
| Inicio | 1440×900 | 0 | 0 | 0 | 0 px |
| Inicio | 768×1024 | 0 | 0 | 0 | 0 px |
| Inicio | 390×844 | 0 | 0 | 0 | 0 px |
| Servicios | 1440×900 | 0 | 0 | 0 | 0 px |
| Servicios | 768×1024 | 0 | 0 | 0 | 0 px |
| Servicios | 390×844 | 0 | 0 | 0 | 0 px |
| Mercado | 1440×900 | 0 | 0 | 0 | 0 px |
| Mercado | 768×1024 | 0 | 0 | 0 | 0 px |
| Mercado | 390×844 | 0 | 0 | 0 | 0 px |

Resultado: **9/9 sin violaciones, errores ni desborde**. Esta auditoría prueba
los prototipos, no sustituye las puertas sobre el producto implementado.

## Contraste de tokens

| Par | Ratio |
|---|---:|
| Ink / canvas | 14,09:1 |
| Muted / canvas | 5,61:1 |
| Action / canvas | 5,20:1 |
| Blanco / action | 5,87:1 |
| Action strong / canvas | 7,48:1 |
| Action strong / surface | 8,44:1 |
| Control border / surface | 3,76:1 |

El precheck de pares no reemplaza axe sobre el DOM; ambos se registran.

## Ocupación de color oscuro/acción

Medición exacta de píxeles `#17213D` y `#B93424` en el primer viewport
1440×900. Incluye texto y controles, por lo que es conservadora respecto de la
regla de superficies rellenas.

| Superficie | Ink | Action | Combinado |
|---|---:|---:|---:|
| Inicio | 1,62 % | 1,21 % | 2,83 % |
| Servicios | 1,15 % | 1,48 % | 2,63 % |
| Mercado | 1,23 % | 0,42 % | 1,65 % |

Las tres quedan por debajo del máximo contractual de 8 %. No hay overlay ni
gradiente sobre fotografía.

## Activos

- cuatro WebP de producción con dimensiones, peso y SHA-256 en `ACTIVOS.md`;
- EXIF/GPS retirado de derivados;
- cuatro imágenes conceptuales separadas y hashadas para impedir copia
  accidental;
- fuentes/wordmark/fallbacks heredados sin modificación.

## Pruebas manuales pendientes para Dev

El prototipo no puede probar callbacks React ni datos. La implementación debe
repetir:

- header por rol, login/publicar/carrito/callback MP;
- filtro de Servicios y URL;
- preview loading/vacío/error/offline;
- cards y detalle de las cuatro anatomías;
- zoom 200 %, teclado, capas, red/fotos rotas;
- build, lint, contraste, a11y, hito y suite completa.
