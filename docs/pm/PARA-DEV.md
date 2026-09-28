# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Decisión sobre COBRO-CONCURRENTE-1 — aceptada en rama

Sobre `599dded` (producto en `5893d19`). Tu informe `94e333d` difiere sólo en
`docs/pm`. Evidencia en `REPRODUCCION-COBRO-CONCURRENTE-1-2026-09-28.md`.

- **Casos:** 213 a 219, 7/7 en base recién creada.
- **Negativos:** tus 15 dan su rojo, cada uno por su motivo. También dan rojo
  los dos míos, que atacan el candado mismo:
  - la espera entre intentos con `time.sleep`: el 213 ve la API sin
    responder;
  - el `NOWAIT` sin savepoint: el 214 ve respuestas 500, y la API sigue viva.
- **Suite completa desde base nueva:** 218/219. Sólo cae el 131, de entorno.
- **Puertas:** verdes.
  - Lint, tipos, build, `compileall`, `pip check`, `node --check`,
    `alembic check` y diff-check.
  - Las dos guías, con 26 y 22 pasos.
- **La recuperación funciona.** En los cinco sabotajes que colgaban la API,
  el caso la destrabó cortando las esperas en la base, sin reiniciarla.

**Lo que cambiaste de más, aceptado:**

- apagar el link antes de aplicar. Comprobé en el código que `hay_cobro`
  equivale a lo que devolvía `aplicar`;
- los cuatro lugares fuera del cobro.

**P2, a la pieza del pago a una orden cerrada:** el borde del reconciliador
que declaraste. Se acepta tu propuesta: `_una` no reintenta apagar el link si
`sincronizar` ya lo intentó en ese barrido.

**P3, sin tarea:**

- ante el 409, «Cancelar» y «Rechazar» muestran el error genérico: mostrar el
  mensaje de la API;
- al subir fotos, si se cumple el tope, los archivos quedan guardados sin su
  fila;
- ningún caso mira el camino «ocupada» del reconciliador.

**Un detalle del informe.** En «Cómo verificarlo» pusiste
`REINICIAR_API="docker restart topgreen-api"` para mi entorno. Mi API es
nativa: usé el reinicio por omisión, y funcionó.

La publicación a `main` la decide Emi. No integres ni despliegues.

---

## Tarea activa: ninguna

No empieces nada. La próxima la asigno cuando Emi ordene la cola.

---

## Después (no empezar todavía)

Lo decide la PM. Lo que depende de Emi puede reordenar la cola:

- el pago que llega a una orden ya cerrada, con el P2 del reconciliador, antes
  de habilitar Mercado Pago;
- cargar las publicaciones de prueba en el sitio publicado
  (`PUBLICACIONES-DE-PRUEBA-2026-09-27.md`), si Emi lo pide;
- P3:
  - los errores de la API en «tú»;
  - las guías que no nombran los avisos de pago;
  - los tres de `COBRO-CONCURRENTE-1`;
- el correo (#15);
- las cuentas de prueba de Mercado Pago;
- la mejora de la logística en los filtros, por definir;
- Inicio (#5) y misión y visión (#12), cuando lleguen de la clienta.
