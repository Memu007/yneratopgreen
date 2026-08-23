# Tokens, contraste y ocupación cromática

Medición WCAG realizada sobre colores sRGB. Umbrales contractuales: 4,5:1 para
texto normal, 3:1 para texto grande y límites/estados no textuales esenciales.

## A — Mercado a cielo abierto · recomendada

| Rol | Token | Valor | Uso |
|---|---|---:|---|
| Canvas | `commercial.canvas` | `#F4F1EA` | Fondo principal cálido, sin beige rústico. |
| Surface | `commercial.surface` | `#FFFFFF` | Controles y contenido comercial. |
| Ink | `commercial.ink` | `#17213D` | Tipografía, reglas y controles; no grandes placas. |
| Muted | `commercial.muted` | `#566074` | Texto secundario. |
| Action | `commercial.action` | `#B93424` | CTA primario, foco comercial y orientación. |
| Action hover / link | `commercial.action-strong` | `#8F281D` | Hover y links comerciales sobre fondo claro. |
| Border | `commercial.border` | `#CBD1D8` | Separación decorativa, no control. |
| Control border | `commercial.control-border` | `#7C8494` | Límite esencial de campos y selects. |
| Photo support | `commercial.photo-support` | `#E7ECEF` | Fondo de carga/fallback, nunca overlay. |
| Positive | `commercial.positive` | `#1F6B4F` | Estado semántico, no identidad agro. |
| Positive bg | `commercial.positive-bg` | `#E7F3ED` | Fondo del estado. |

| Par medido | Ratio | Resultado |
|---|---:|---|
| Ink / canvas | 14,09:1 | AAA |
| Ink / surface | 15,89:1 | AAA |
| Muted / canvas | 5,61:1 | AA |
| Muted / surface | 6,32:1 | AA |
| Action / canvas | 5,20:1 | AA |
| Action / surface | 5,87:1 | AA |
| Blanco / action | 5,87:1 | AA |
| Action strong / canvas | 7,48:1 | AAA |
| Action strong / surface | 8,44:1 | AAA |
| Control border / surface | 3,76:1 | AA no textual |
| Positive / positive bg | 5,63:1 | AA |

## B — Inventario industrial · variante archivada

Se conserva para demostrar la decisión. **Dev no implementa estos valores ni
crea un segundo tema.**

| Rol | Valor | Ratio relevante |
|---|---:|---:|
| Canvas | `#EEF2F2` | — |
| Surface | `#FFFFFF` | — |
| Ink | `#122C3A` | 12,87:1 sobre canvas; 14,51:1 sobre blanco |
| Muted | `#4F626B` | 5,66:1 sobre canvas; 6,38:1 sobre blanco |
| Action | `#20566E` | 7,11:1 sobre canvas; 8,02:1 con blanco |
| Control border | `#687D86` | 4,32:1 sobre blanco |
| Positive / positive bg | `#286650` / `#E2EEE9` | 5,68:1 |

## Regla de ocupación

- Canvas + surface: **55–78 %** de la primera pantalla.
- Fotografía: **22–40 %** del viewport; Inicio y Servicios destinan 56 % del
  ancho del hero desktop.
- Superficie rellena con `ink` o `action`: máximo **8 %** de los píxeles de la
  primera pantalla, excluyendo texto y fotografía.
- Ninguna placa oscura continua puede superar **64 px** de alto. `ink` no puede
  usarse como fondo de hero ni de sección institucional.
- Overlay o degradado sobre foto: **0 %**.
- Verde queda reservado a éxito/stock verificable. No se usa como señal de
  “agro” ni como fondo de marca.

La variante B mejora contraste y frialdad internacional, pero aumenta el riesgo
de volver a una identidad industrial genérica. Ese es el motivo de conservarla
como control y recomendar A.
