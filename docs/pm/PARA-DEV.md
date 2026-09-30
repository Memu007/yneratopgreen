# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Decisión sobre DESVINCULAR-CON-COBROS-1 — aceptada en rama

Sobre `777bee1` (producto en `bcc8ca5` y `a27fc7c`). Tu informe `d1a6a3e`
difiere sólo en `docs/pm`. Evidencia en
`REPRODUCCION-DESVINCULAR-CON-COBROS-1-2026-09-30.md`.

- **Suite completa desde base nueva:** 229/230. Sólo cae el 131, de entorno.
  La lista de casos que tuvieron que terminar ventas coincide con la tuya.
- **Negativos:** tus 7 dan su rojo. También dan rojo los dos míos:
  - la misma cuenta frenada al volver y al renovar: el 229 lo ve. Es el camino
    para destrabar una orden, así que me importaba que estuviera cubierto;
  - el reconciliador con el criterio sin el vencimiento: el 225 ve que barrió
    la venta vigente. Cubre el cambio de `_candidatas`.
- **El punto 5, reproducido con un caso mío:** 409 con 1 y las credenciales
  iguales; vencida y barrida, la reserva se libera, la orden se cancela y el
  link se apaga; el segundo `unlink` da 200 y no queda nada guardado.
- **Pantalla:** capturas en los dos anchos, a11y `--todas`, contraste,
  auditoría móvil y las dos guías, verdes.
- **Puertas:** verdes.

**Tus preguntas:**

1. **Los textos:** aceptados. Los lee Emi.
2. **La orden sin link también frena:** aceptado. Es coherente con la regla.
3. **El link abierto de un pago devuelto:** va a la lista de antes de
   habilitar Mercado Pago, como pieza chica. No es de esta.

**Una cosa de método:** `smoke.mjs` perdió sus 4 terminadores CRLF (líneas
36326 a 36329, de un caso de `AVISOS-DE-PAGO-1`). Mismo texto, fuera de tu
zona, y el diff-check con `cr-at-eol` no lo ve. Restauralos en la próxima pieza
que toque ese archivo, y antes de entregar compará los CR de cada archivo con
la base.

**P3, sin tarea:** `sin_vinculo` en el reintento del link quedó sin caso (se
alcanza con una credencial que no abre); el número del 409 se cuenta después de
decidir y podría decir 0; la confirmación común sin rol de diálogo.

La publica PM si Emi lo autoriza. Vos no integres ni despliegues.

---

## Tarea activa — LINK-ABIERTO-DEVUELTO-1

**Decisión de PM (30/09), dentro del arranque de Mercado Pago que pidió Emi.**
Es el punto 3 de tu entrega de `DESVINCULAR-CON-COBROS-1`. Va antes de la
prueba de Mercado Pago en el sitio publicado, para que la prueba corra sobre el
código final.

**Rama y base:** `claude/dev-role-repo-3l0kp3`, desde el último commit PM.

### Problema

Un pago devuelto o con contracargo cuyo link no se pudo apagar queda fuera de
`cobro.en_curso`: el link abierto mira sólo `APPROVED` y `EN_REVISION`. Tampoco
lo mira el reconciliador. El link queda abierto para siempre, se puede volver a
pagar, y quien vende puede desvincular. Lo leíste en el código; no está
reproducido.

### Qué entra

1. **Reproducirlo primero**, con un caso y el producto de la base: pago
   aprobado, falla apagar el link, llega la devolución, vuelve a fallar. El
   reconciliador no lo mira y desvincular pasa.
2. **Que el link abierto mire los cuatro estados con cobro** (`CON_COBRO`), en
   el criterio único. Comprobá que:
   - el reconciliador lo apaga sin cambiar el estado del pago ni mover stock;
   - desvincular frena mientras tanto;
   - nada de lo que ya barría cambia.
3. **Los 4 terminadores CRLF de `smoke.mjs`** (líneas 36326 a 36329),
   restaurados.

### Casos y negativos

- El caso nuevo: rojo con la base, verde con el cambio.
- Negativo: el criterio sin los estados nuevos da rojo.
- Negativo: el reconciliador cambia el estado del pago devuelto al apagar el
  link, y eso da rojo.

### Aceptación verificable

1. El caso y los negativos.
2. Suite completa desde una base recién creada.
3. Build, lint, tipos, `compileall`, `alembic check`, diff-check con
   `cr-at-eol`, y la cuenta de CR por archivo contra la base.

### Frená y consultá

- Si apagar el link de un pago devuelto cambia su estado o mueve stock.
- Si hace falta una migración.

### Entrega en `PARA-PM.md`

- el SHA;
- el caso con su rojo de la base;
- los negativos, la suite y las puertas;
- los riesgos.

No integres ni despliegues.

---

## Después (no empezar todavía)

Lo decide la PM. Lo que depende de Emi puede reordenar la cola:

- la parte B de las publicaciones de prueba (el transportista y el flete),
  cuando ande el correo;
- P3:
  - los errores de la API en «tú»;
  - las guías que no nombran los avisos de pago;
  - los tres de `COBRO-CONCURRENTE-1`;
  - los cuatro de `PAGO-ORDEN-CERRADA-1` y los de
    `RECONCILIADOR-PROGRAMADO-1` y `DESVINCULAR-CON-COBROS-1`, en sus
    reproducciones;
  - ingresar con una contraseña de más de 72 bytes da 500 (bcrypt);
  - cambiar la propia contraseña desde la pantalla: la API tiene `/auth/change-password` y ninguna pantalla lo usa;
- **antes del 01/12/2026:** sacar de `railway.toml` la configuración del
  Backend y del Frontend (Railway deja de leerla ese día). Pieza propia;
- una devolución o un contracargo que llega con la cuenta desvinculada no
  se registra: quien compra sigue viendo «pagado» (freno de
  `DESVINCULAR-CON-COBROS-1`);
- **antes del lanzamiento real de Mercado Pago:** si la prueba lo confirma,
  la vinculación en Safari, Brave y Firefox (la cookie del Backend en otro
  sitio). Lo más probable es que alcance con un dominio propio, que es de Emi
  y de Railway, no de código;
- el correo (#15);
- las cuentas de prueba de Mercado Pago;
- la mejora de la logística en los filtros, por definir;
- Inicio (#5) y misión y visión (#12), cuando lleguen de la clienta.
