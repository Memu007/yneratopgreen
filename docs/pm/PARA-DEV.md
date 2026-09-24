# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Tarea activa — ADMIN-PANEL-DEFECTS-1, parte 2: el checkout

**Rama y base:** `claude/dev-role-repo-3l0kp3`, desde el último commit PM.

### Decisión sobre la parte 1 (`8f2c543` + `1ff7b87`)

**Verificada y correcta.** Hiciste bien en frenar ante la otra vía.

Reproduje:

- el caso 190 en 1/1;
- tu negativo del P1, que da rojo y nombra seis caminos;
- un negativo mío (sólo «borrar foto» sin la regla), que da rojo y nombra
  sólo ese camino;
- el negativo de `admin.py`, que da rojo en el paso 14;
- tus tres negativos de interfaz, en rojo;
- la guía en 26/26 y 26/26;
- a11y 76/76, contraste 84/84 y auditoría 12/12.

Evidencia en `REPRODUCCION-ADMIN-PANEL-DEFECTS-1-2026-09-24.md`.

También reproduje tu hallazgo del checkout, por API y en local: una
publicación eliminada por el administrador después de estar en el carrito
se compra por transferencia, con 200 y la orden creada.

### Decisiones PM

- **Checkout:** se toma tu opción 1. El checkout rechaza cualquier
  publicación que no esté activa (eliminada, pausada o agotada) antes de
  crear la primera orden.
  - El mensaje nombra la publicación, así quien compra sabe cuál sacar.
  - No se crea ninguna orden ni se reserva stock de ningún vendedor.
  - Vale para los dos medios, transferencia y Mercado Pago, porque comparten
    `preparar_checkout`.
- **Órdenes que ya existían:** siguen su curso. No se tocan.
- **Carrera entre fotos y borrado:** queda como P3, sin tarea.

### Alcance

- La regla de arriba en el checkout.
- La pantalla de checkout muestra ese rechazo de forma entendible, con la
  publicación nombrada, y deja seguir cuando se saca del carrito. Si hoy ya
  muestra el mensaje del servidor, alcanza con comprobarlo.

### Fuera de alcance

- Cambiar lo que hace el carrito al agregar o sincronizar.
- Tocar las órdenes existentes.
- Avisos a quien compra o a quien vende.

### Aceptación verificable

1. **El caso 190 o uno nuevo prueba la vía del checkout:**
   - con la publicación en el carrito, el administrador la elimina, la pausa
     o la marca agotada;
   - el checkout, por transferencia y con la ruta combinada, falla nombrando
     la publicación;
   - no se crea ninguna orden y el stock reservado no cambia;
   - después de sacarla del carrito, el checkout del resto funciona.
2. **Negativo:** con el checkout de la base, el caso da rojo y nombra el
   estado que dejó pasar.
3. **Navegador:** el mensaje se ve en la pantalla de checkout, por lo menos
   a 390 px y en escritorio.
4. **Regresión:** los casos de checkout, transferencia, Mercado Pago
   simulado, stock y logística que dependan de `preparar_checkout`. Elegilos
   y justificá la lista. No hace falta repetir la suite completa: la corro
   yo sobre la candidata final.
5. Build, lint, tipos, `compileall` y diff-check con `cr-at-eol`.

### Frená y consultá

- Si rechazar en el checkout rompe un recorrido existente que hoy compra algo
  que no está activo a propósito.

### Entrega en `PARA-PM.md`

- SHA;
- salida del caso y del negativo;
- captura o descripción del mensaje en pantalla;
- lista de regresión con su resultado.

No integres ni despliegues.
