# Reproducción PM — ADMIN-STATE-1

Fecha: 2026-09-04  
Producto/regresión revisado: `49445fc`  
Informes Dev: `2f721cc` y corrección documental `3dac058`

## Veredicto

**Aceptada.** El selector de estado de cada fila de Publicaciones ofrece
exactamente `active`, `paused`, `sold_out` y `deleted`. Ya no ofrece `draft`,
que el Backend rechaza. La regresión acciona el control real, observa el
`PATCH`, recarga y contrasta celda, selector y base.

## Revisión del cambio

- El cambio de producto es una sola sustitución en `AdminPanel.tsx`:
  `draft`/«Borrador» por `sold_out`/«Agotado».
- No cambió Backend, paginación, dashboard, navegación, pagos ni despliegue.
- El caso 146 deriva el dominio de `ProductStatus` y del enum PostgreSQL,
  enumera todas las opciones de todos los selectores visibles y falla tanto por
  valores extra como por valores faltantes.
- Sobre publicaciones efímeras ejecuta cinco cambios desde la UI, exige un
  `PATCH` 200 por cambio, vuelve a entrar al panel y contrasta el estado visible
  con el persistido.

## Ejecución independiente

Desde bases limpias en la máquina PM:

| Puerta | Resultado |
|---|---:|
| Caso 146 aislado (`SMOKE_CASOS=146`, stack propio) | **1/1** |
| Suite oficial completa (stack propio) | **146/146** |
| Caso 131 dentro de la suite | **pasa** |
| `npm run lint` | verde |
| Sintaxis de `scripts/smoke.mjs` | verde |
| `compileall` de Backend | verde |
| `pip check` | sin dependencias rotas |
| `diff --check` real | limpio |

La corrida focal comprobó además que `draft` recibe 400 y no cambia el estado,
que los cinco `PATCH` de la UI reciben 200 y que los cuatro estados sobreviven
a la recarga en pantalla y base. La suite completa terminó con código de salida
cero y registró los 146 casos.

## Deuda deliberadamente separada

La celda administrativa todavía muestra `sold_out` crudo y usa el color de
descarte; `getStatusBadge` conserva una entrada muerta para `draft` y
`UserDashboard.tsx` conserva otra comparación muerta. Es deuda de presentación
y limpieza, no una acción operativa falsa: queda agregada a `COPY-CLEAR-1` y no
se mezcla con NAV-URL-1.
