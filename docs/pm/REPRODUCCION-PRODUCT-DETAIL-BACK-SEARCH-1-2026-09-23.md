# Reproducción PM — PRODUCT-DETAIL-BACK-SEARCH-1

Fecha: 2026-09-23. Base de la tarea `f42c760`; producto, caso 186 y negativo
`ce0380e`; informe Dev `2c300bf` (sólo `docs/pm/PARA-PM.md`, verificado con
`git diff --stat ce0380e 2c300bf`). `main` permanece en `0bd7fbc`.
**Aceptada en rama**, sin integración ni despliegue.

## Qué se revisó

El diff de producto toca sólo `src/hooks/useProductFilters.ts`: la relectura
de la barra al volver con Atrás/Adelante pasa de un efecto a un ajuste de
estado durante el dibujo, con la misma condición de antes (sólo cuando cambia
la versión de la barra y nunca sobre la barra de una ficha). No cambia formato
de URLs ni semántica de filtros. Lo demás es el caso 186 en `scripts/smoke.mjs`
y `scripts/sabotajes_product_detail_back_search_1.py`.

La corrección de la medición de Dev se acepta: el «8 de 20 pierde la
búsqueda» era un cuadro de unos 16 ms sin `q`, el buscador vacío y 24 tarjetas,
corregido al cuadro siguiente. El defecto era real y más chico que lo
informado. La prioridad ya no se reordena porque la pieza llegó terminada.

## Entorno PM

Copia aislada (`git worktree`) en `ce0380e`. Base `postgis/postgis:16-3.4`
(PostGIS 3.4.3) en Docker real, recién creada, con migraciones y siembra demo.
API nativa en 8000 (Python 3.11) contra esa base, alcanzada por el arnés con
un puente local que traduce sólo `docker exec topgreen-api`; frontend de
desarrollo en 5173. Valores de `.env` inventados.

Limitación declarada: el repositorio fija Playwright 1.62 (Chromium build
1234) y este entorno trae Chromium 141 (build 1194). PM ejecutó con ese
Chromium. No se observó incompatibilidad, pero no es el navegador fijado.

## Resultados

| Verificación | Resultado |
|---|---|
| Caso 186 sobre la candidata | **1/1** — 10 vueltas (5 «Volver al Mercado», 5 Atrás del navegador), **1.493 cuadros** mirados: ninguna escritura ni cuadro sin `q`, buscador siempre con la búsqueda, ninguna tarjeta ajena; «Semillas» + tipo + orden conservados; entrada directa sin búsqueda inventada (24 tarjetas, buscador vacío) |
| Negativo: hook de `f42c760` repuesto | **rojo esperado**, 10 de 10 vueltas: «la barra se escribió como `/?section=marketplace`; el cuadro 1 de 148 tenía la barra `?section=marketplace`, el buscador vacío y 24 tarjetas, 23 ajenas». Árbol restaurado (`src` como estaba) |
| Casos relacionados 147, 148, 183, 185 | **4/4** |
| Build, lint, `tsc --noEmit`, `node --check` del arnés, compilación del script, diff-check CRLF sobre `f42c760..ce0380e` | verdes |

## Sonda independiente PM

La sonda de Dev mira `q`, texto y tarjetas; no mira si el hueco sin tarjetas
que deja el pedido de más en segundo plano («Visto y no tocado» del informe)
muestra un falso «No hay operaciones con estos filtros». PM lo midió aparte en
8 vueltas (mitad botón, mitad Atrás): **0 cuadros** con ese mensaje, **0
cuadros sin `q`**; el hueco es el estado «Cargando operaciones» durante 1–2
cuadros y el final siempre muestra la publicación buscada. Se clasifica **P3**
y queda registrado, sin tarea.

## Hallazgo para la pieza siguiente

Sobre la misma candidata, a 390 px y con «Filtros» cerrado, Tab desde ese
botón recorre **11 controles invisibles** (tipo, categoría, provincia, precio
mínimo y máximo, casilla de stock, valoración, condición, marca, «Limpiar
filtros» y «Ver N resultados») antes de llegar a «Ordenar». El registro previo
hablaba de cuatro. Pasa como insumo a `FILTER-COLLAPSE-FOCUS-1`.

No se tocó `main`, Railway, backend ni datos reales. Contenedor, copia y
procesos temporales se retiran al cerrar la revisión.
