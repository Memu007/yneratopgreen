# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Tarea activa — PRIMARY-IMAGE-INTEGRITY-1

### Problema y prioridad

`product_images` permite hoy más de una fila `is_primary=true` para la misma
publicación. `QUERY-IMG-1` hizo que el catálogo tolere ese dato, pero no evitó
que se siga creando desde carga o administración. La base debe sostener la
regla de negocio: una publicación puede tener **cero o una** imagen principal,
nunca dos.

Es la próxima pieza porque ya estaba adoptada como deuda canónica, no depende
de credenciales, pagos ni decisiones de la clienta y cierra integridad antes de
la puerta final del MVP.

Base de trabajo: `main`/rama Dev en `0bd7fbc`.

### Alcance

1. Agregar una migración Alembic que, antes de crear la restricción:
   - encuentre publicaciones con más de una imagen principal;
   - conserve como principal una sola fila de forma determinista: menor
     `display_order` y, ante empate, menor `id`;
   - cambie las demás a `is_primary=false` sin borrar imágenes;
   - cree un índice único parcial sobre `product_images(product_id)` sólo para
     filas con `is_primary=true`.
2. Hacer compatibles con esa regla todos los caminos vigentes que mutan
   imágenes. La primera carga debe dejar exactamente una principal; cargas
   posteriores no deben reemplazarla; al borrar la principal se promueve una
   sola imagen restante con el mismo orden determinista. Dos operaciones
   simultáneas no pueden producir dos principales ni responder `5xx` por una
   carrera evitable.
3. Agregar el caso permanente **179** al arnés. Debe observar la migración, la
   restricción real de PostgreSQL y los recorridos de carga/borrado, no sólo el
   resultado del catálogo.
4. Dejar un negativo discriminante reproducible en base descartable: sin el
   índice/guarda que corresponda, el caso debe ponerse rojo al admitir dos
   principales; restaurada la candidata, debe volver a verde.

### Fuera de alcance

- No cambiar `QUERY-IMG-1`, paginación, contratos de respuesta ni la UI.
- No rediseñar la galería, agregar reordenamiento manual ni un endpoint nuevo
  para elegir imagen principal.
- No arreglar el N+1 del carrito ni otras deudas registradas.
- No tocar Railway, datos remotos ni hacer deploy. Esta pieza incluye una
  migración y queda en rama hasta revisión PM y una puerta operativa explícita.

### Criterios de aceptación ejecutables

1. Sobre una base descartable preparada con dos o más primarias por producto,
   `alembic upgrade head` termina verde, no borra archivos/filas y deja como
   principal exactamente la de menor `display_order, id`.
2. Después de migrar, una inserción SQL directa de una segunda principal para
   el mismo `product_id` es rechazada por PostgreSQL; una secundaria sigue
   permitida.
3. Primera carga, carga múltiple y carga posterior conservan cero o una
   principal según corresponda, sin cambiar la principal existente.
4. Borrar la principal promueve exactamente una restante de forma determinista;
   borrar la última deja cero. Vendedor ajeno continúa en `403` y los límites
   actuales de cantidad/formato/tamaño no se debilitan.
5. Dos primeras cargas concurrentes admisibles terminan sin `5xx`, conservan
   las imágenes aceptadas y dejan una sola principal.
6. `alembic downgrade -1` retira únicamente la nueva restricción; no intenta
   recrear duplicados ni pierde imágenes. Un nuevo `upgrade head` vuelve a
   quedar verde.
7. Caso 179 verde en candidata, rojo discriminante documentado y verde tras
   restaurar. Casos 20, 162 y 172 siguen verdes.
8. Suite completa desde base limpia, build, lint, `tsc --noEmit`,
   `compileall`, `pip check`, `alembic check` y `diff-check` verdes. Si Docker o
   PostGIS no están disponibles en el entorno Dev, entregá las puertas que sí
   podés ejecutar y pedí explícitamente la reproducción Docker a PM; no
   elimines ni rebajes la compuerta.

### Evidencia y decisiones que hay que leer

- `docs/pm/NOW.md`, apartado de pendientes canónicos.
- `docs/pm/ROADMAP-CIERRE-MVP-2026-08-31.md`, Puerta 5.
- `docs/pm/REPRODUCCION-FILTROS-MARCAS-2026-09-20.md` sólo para preservar la
  composición aceptada; esta tarea no reabre marcas.
- `backend/app/api/catalog.py`, selección determinista vigente de primaria.
- `backend/app/api/products.py`, carga y borrado de imágenes.
- `scripts/smoke.mjs`, casos 20, 162 y 172.

### Frenar y consultar

Frená antes de continuar si la corrección exige borrar imágenes, elegir una
regla distinta de `display_order, id`, modificar datos remotos, desplegar la
migración o ampliar el contrato/UI. Un rojo heredado se informa y clasifica;
no se cambia la expectativa para hacerlo verde.

### Entrega mínima

1. Un commit de producto + migración + regresión.
2. `docs/pm/PARA-PM.md` reemplazado con: cambio, SHA exacto, pruebas y
   resultados, negativo discriminante, riesgos y cualquier puerta que deba
   reproducir PM.
3. No integrar a `main` ni desplegar.
