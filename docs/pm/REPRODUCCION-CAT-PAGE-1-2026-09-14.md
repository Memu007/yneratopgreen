# Reproducción PM — CAT-PAGE-1

Fecha: 2026-09-14.

## Composición aceptada

- producto inicial: `a521631`;
- devolución PM: `617a71b`;
- corrección de producto y arnés: `575f757`;
- informe Dev: `b1cc77f`, documental respecto del SHA probado;
- integración local en `main`: `fafa5cb`.

No se publicó `main`, no se desplegó y no se tocaron Railway ni datos remotos.

## Qué revisó la PM

El delta R1 incluye en `consultaVigente` los valores remotos de subcategoría,
calificación mínima, orden y página. El caso 171 demora la respuesta del
catálogo y observa tanto cuadros pintados como mutaciones del DOM; cada
dimensión se mueve en una transición donde es el único cambio de consulta.

Sobre una API y una base Docker locales construidas desde `575f757`, la PM
obtuvo:

- caso 171 con 115 publicaciones fabricadas y retiradas al final: **1/1**;
- cinco páginas de hasta 24 resultados, publicación 101 alcanzable y ninguna
  fila repetida o perdida;
- filtros, total y órdenes calculados en servidor sobre el conjunto completo;
- cuatro transiciones demoradas sin presentar la grilla anterior como si fuera
  la respuesta nueva.

## Negativo discriminante

En el worktree temporal, sin guardar ni publicar el cambio, la PM quitó sólo
`pagina` de `consultaVigente` y repitió el caso 171. Resultado: **0/1**. El caso
detectó dos estados —uno por commit y otro por cuadro— donde el control ya decía
«Página 2 de 5» y seguían visibles las 24 publicaciones anteriores sin carga.

Restaurado el archivo, Git quedó limpio y el mismo caso volvió a **1/1**. Esto
demuestra que la regresión discrimina el defecto devuelto en R1.

## Puertas complementarias

PM: build, lint, `tsc --noEmit`, `node --check` y `diff-check`, todos verdes.

Dev, desde base limpia sobre `575f757`: suite **170/171**, con único rojo el
caso 131 ambiental ya clasificado; a11y **72/72**, contraste **80/80** y revisión
visual en 1440×900 y 390×844, sin desborde. La PM no repitió la suite completa:
la pieza no toca dinero, permisos, migraciones ni seguridad, el caso nuevo fue
reproducido con su negativo y la corrida integral de Dev cubre el resto.

## Decisión

`CAT-PAGE-1` queda **ACEPTADA E INTEGRADA LOCALMENTE**. `page` y `sort` siguen
la política de navegación existente: viven en la URL y se restauran con la
entrada, pero no crean una entrada nueva por cada clic. La publicación de la
composición continúa pendiente de autorización explícita de Emi por el
auto-deploy de Railway.
