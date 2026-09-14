# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

Este archivo contiene únicamente la tarea activa y su hilo de devoluciones
hasta el cierre. La historia anterior permanece en Git; el cierre de
`CAT-PAGE-1` está en `REPRODUCCION-CAT-PAGE-1-2026-09-14.md`.

---

## 2026-09-14 — QUERY-IMG-1

**Base excepcional autorizada por PM:** Emi postergó la publicación de `main`
para no disparar Railway. Continuá en `claude/dev-role-repo-3l0kp3` después de
traer este relevo, que contiene el merge local aceptado `fafa5cb`. No te bases
en `origin/main`, que sigue viejo. Registrá el SHA exacto del relevo como base.

### Problema confirmado y prioridad

El inventario `acbf3b6` midió el listado del Mercado: 24 publicaciones producen
26 consultas SQL, 24 de ellas a `product_images`. El código vigente confirma la
raíz: `backend/app/api/catalog.py` ya hace un `outerjoin` con la imagen primaria,
pero no selecciona su URL y vuelve a consultar una vez por cada tarjeta.

Después de cerrar la paginación, este es el siguiente borde de volumen: la
cantidad de consultas no debe crecer con el tamaño de página.

### Alcance mínimo

1. Medí primero el número de consultas SQL reales de
   `GET /api/catalog/products` con dos tamaños de página, incluido 24, y
   conservá ese rojo contra la base.
2. Hacé que la URL de la imagen primaria viaje en la consulta del listado que
   ya trae producto, vendedor y ubicación. Eliminá sólo la consulta por tarjeta.
3. Conservá exactamente el contrato y la semántica actuales: misma
   `primary_image` para una publicación con imagen primaria, `null` cuando no
   hay, mismo total, orden, filtros y paginación.
4. No cargues la colección completa de imágenes para resolver una URL y no
   agregues caché, dependencia ni una segunda consulta masiva si el join vigente
   alcanza.

### Regresión exigida

Agregá el caso 172. Debe fabricar o identificar de forma determinista un
conjunto con publicaciones con imagen primaria y sin imagen, llamar al endpoint
real y contar sentencias SQL durante la petición.

Debe demostrar:

- rojo contra la base porque las consultas a `product_images` crecen con las
  tarjetas;
- verde en la candidata con un número acotado que no crece al pasar del tamaño
  chico a 24;
- URLs de imagen y `null` idénticos a los esperados por base, no sólo un conteo
  de consultas;
- total, IDs y orden de la respuesta sin cambios;
- la medición no cuenta el SQL con el que el propio caso fabrica o inspecciona
  datos.

### Compuertas

- caso 172 focal y rojo discriminante contra la base;
- casos 171 y 172 juntos;
- suite smoke completa desde base limpia;
- build, lint, `tsc --noEmit`, `node --check`, `compileall`, `pip check` y
  `git diff --check`;
- a11y y contraste sólo si el alcance se desvía y cambia una superficie visible.

### Fuera de alcance y freno

- No optimices carrito, órdenes, administración, detalle ni otros posibles
  N+1: registralos aparte si los medís, sin tocarlos.
- No cambies archivos de imagen, carga/almacenamiento, Cloudinary, UI, fotos del
  seed, esquema, migraciones, filtros, orden, paginación, Railway ni datos
  remotos.
- Frená y consultá si la base permite varias imágenes primarias por producto y
  resolverlo sin cambiar cardinalidad exige una restricción/migración, o si la
  medición contradice el N+1 confirmado.
- No empieces `RISK-REC-1`, no integres y no despliegues.

### Entrega

Reemplazá `docs/pm/PARA-PM.md` con rama, SHA base, SHA candidato, diff completo,
conteos SQL antes/después, rojo/verde, pruebas, riesgos y cualquier hallazgo
adyacente no implementado. Frená después de entregar.
