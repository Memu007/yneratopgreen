# Reproducción PM — PRIMARY-IMAGE-INTEGRITY-1

Fecha: 2026-09-22.

## Decisión

**ACEPTADA EN RAMA, NO INTEGRADA Y NO DESPLEGADA.**

- Producto, migración y regresión: `cfeff88`.
- Informe Dev: `19e6327`, corregido documentalmente por `6a6e36e`.
- Base: `0bd7fbc`, que continúa siendo `main` y el runtime demostrativo.

El cambio introduce una migración de esquema. La aceptación técnica no
autoriza empujarla a `main` ni ejecutarla en Railway: eso requiere una puerta
operativa y autorización explícita.

## Qué comprobó PM

- La migración desmarca duplicados antes de crear el índice único parcial
  `uq_product_images_primaria_unica` sobre `product_images(product_id) WHERE
  is_primary`; conserva la menor pareja `display_order, id` y no borra filas.
- PostgreSQL rechaza una segunda principal y sigue aceptando secundarias.
- Carga y borrado serializan por la publicación; borrar la principal promueve
  en la misma transacción la restante de menor `display_order, id`.
- El cambio del caso 172 es correcto: con la restricción activa ya no puede
  fabricar dos primarias por SQL. La tolerancia del catálogo ante el dato sucio
  sigue probada en el 179 mientras la migración está temporalmente abajo.
- `catalog.py`, contratos y UI no cambiaron.

## Evidencia independiente

- Caso 179 focal: **1/1**.
- Casos 162 y 172 focales: **2/2**; el 20 pasó dentro de la suite completa.
- Cuatro sabotajes: **4/4 rojos** —sin índice, sin limpieza previa, promoción
  sin orden y toda carga marcada como principal—; candidata restaurada verde.
- Suite desde base limpia: **178/179** en una sola corrida. El único rojo fue
  el caso 136 porque el host de PM no tenía ejecutable `npx`; el caso no llegó
  a construir el frontend. Con un adaptador temporal fuera del repositorio,
  el mismo caso pasó **1/1** y confirmó igualdad de revisión entre frontend,
  health y log. Quedan cubiertos los **179/179** casos; el 131 pasó.
- Build, lint, `tsc --noEmit`, `node --check`, `compileall`, `pip check`,
  `alembic check` y `diff-check` compatible con CRLF: verdes.

No se repitieron a11y ni contraste porque el candidato no modifica superficies
visibles, componentes ni estilos.

## Riesgos adyacentes, no bloqueantes

- El orden de exhibición puede repetir un número después de borrar una imagen
  intermedia y subir otra; el desempate por `id` mantiene el resultado
  determinista.
- El límite total de tres imágenes se comprueba antes del tramo serializado;
  una carrera con cargas múltiples podría merecer una tarea propia si se
  reproduce. No altera la unicidad de la principal aceptada aquí.
- El almacenamiento se modifica antes de confirmar la transacción de base;
  era comportamiento previo y queda fuera de esta pieza.

La próxima tarea activa es `CART-IMG-QUERY-1`.
