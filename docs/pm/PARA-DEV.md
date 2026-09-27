# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Decisión sobre AVISOS-DE-PAGO-1 — aceptada en rama

Sobre `c6792ff` (producto y casos en `a97911b`). Evidencia en
`REPRODUCCION-AVISOS-DE-PAGO-1-2026-09-27.md`.

- **Casos:** 210, 211 y 212 en 3/3.
- **Negativos:** tus cuatro dan rojo, y también los dos míos:
  - el rechazo que avisa «Pago aprobado»;
  - los avisos de Mercado Pago a la parte equivocada.

  Los dos se cazan porque contás los avisos exactos por cuenta. Muy bien
  eso.
- **Suite completa desde base nueva:** 211/212. Sólo cae el 131, de entorno.
- **Auditorías y las dos guías:** verdes.
- **Tu `REINICIAR_API` funcionó** con el reinicio por omisión. Gracias.

**El P1: confirmado, y ya existía.** El 213 cuelga la API sobre tu SHA y
también con el código de producto de `2e86854`. Se corrige en una tarea
aparte, antes de habilitar Mercado Pago. No la empieces: la asigno cuando
Emi ordene la cola.

**Tu pregunta: sin aviso, como recomendaste.** Un pago que llega a una orden
ya cerrada no dice «Pago aprobado», porque sería falso. Que nadie se entere de
ese pago queda con el P1, antes de habilitar Mercado Pago.

**P3, sin tarea:** las guías no nombran los avisos nuevos.

La publicación a `main` la decide Emi. No integres ni despliegues.

---

## Tarea activa — COBRO-CONCURRENTE-1

**Rama y base:** `claude/dev-role-repo-3l0kp3`, desde el último commit PM.

**Es dinero:** revisión más fuerte y suite completa de PM.

### Problema y prioridad

Es tu P1, confirmado por PM (`REPRODUCCION-AVISOS-DE-PAGO-1-2026-09-27.md`):
el 213 cuelga la API sobre `c6792ff` y también con el producto de `2e86854`.

- El aviso de Mercado Pago (`procesar_pago`) y la vuelta de quien compra
  (`sincronizar`, desde `estado_del_pago`) toman la fila de la orden con
  `FOR UPDATE` (`cobro.py:506` y `:553`).
- Con la fila tomada esperan a Mercado Pago (`await apagar_link`).
- Otra confirmación de la misma orden pide la fila con una llamada síncrona.
  Esa llamada frena el único bucle del proceso, y la primera ya no puede
  terminar.
- Producción corre un solo proceso de uvicorn (`railway-entrypoint.sh`): se
  cuelga todo AgroBoeda, no sólo esa orden.

El mismo patrón, sin reproducir:

- «Rechazar» (`orders.py:712`) y «Cancelar» (`orders.py:851`) de una orden
  de Mercado Pago toman la fila y esperan a Mercado Pago en
  `_terminar_el_cobro` → `cerrar_cobro`;
- el reconciliador (`app/reconciliar.py`) corre en otro proceso. Si tiene la
  fila mientras consulta a Mercado Pago, un aviso de esa orden congela la API
  hasta que termine.

**Prioridad:** la Fase 4 (16/10–29/10) es habilitar Mercado Pago, y con esto
no se puede. Hoy no está habilitado.

### Qué entra

1. **Ningún camino de la API espera una fila tomada frenando el proceso.**
   - Inventario por código, no por memoria: todo `with_for_update()`
     alcanzable desde un `async def`.
   - El informe dice con qué comando lo encontraste y qué hiciste con cada
     uno.
2. **Las reglas vigentes se mantienen:**
   - el link se apaga con la fila tomada;
   - el stock se consolida una vez;
   - los avisos de `AVISOS-DE-PAGO-1` salen una vez por orden.
3. **Una confirmación que encuentra la fila tomada espera sin frenar a nadie,
   con tope.**
   - Al terminar, el resultado es el mismo que hoy da una confirmación
     repetida.
   - Si se cumple el tope, ninguna respuesta queda colgada, y el informe dice
     qué recibe cada camino:
     - el aviso, algo que Mercado Pago reintente;
     - la vuelta, «en proceso»;
     - «Rechazar» y «Cancelar», un error claro para probar de nuevo.
   - La dirección que propusiste (`NOWAIT` en un savepoint y reintento con
     `await asyncio.sleep`) está aceptada. Si encontrás una mejor, contá por
     qué.
4. **El 213 entra a la suite y corre siempre.** Si alguna vez vuelve a colgar
   la API, el caso la recupera, así el rojo queda sólo en el 213 y el resto de
   la suite sigue.

### Casos

- **Ráfaga:** cinco confirmaciones o más del mismo pago a la vez, mezclando
  aviso y vuelta.
  - La salud responde en menos de 2 segundos durante toda la ráfaga.
  - Terminan todas.
  - La orden queda pagada una vez, el stock baja una vez, sale un solo par de
    avisos y el link queda apagado.
- **«Cancelar» y «Rechazar» contra una confirmación:** una orden de Mercado
  Pago se cancela, y otra se rechaza, mientras llega una confirmación del
  mismo pago.
  - La API no se cuelga.
  - El estado final es el que ya definen los casos de rechazo y cancelación
    con cobro.
- **El reconciliador:** con el reconciliador sosteniendo la fila, un aviso de
  esa orden no congela la API. Otras peticiones responden.

### Negativos

Cada uno da rojo por su motivo y deja el árbol como estaba. El reinicio sale
de `REINICIAR_API`.

- El aviso vuelve a esperar la fila con el bloqueo síncrono: el 213 da rojo.
- «Cancelar» vuelve a esperarla igual: su caso da rojo.
- El link se apaga con la fila suelta: da rojo el caso que protege esa regla.
- Uno por cada otro camino que arregles.

### Fuera de alcance

- El pago que llega a una orden ya cerrada. Queda sin aviso (decisión del
  27/09) y va en una pieza propia, también antes de habilitar Mercado Pago.
- Habilitar Mercado Pago, cuentas de prueba, OAuth real y credenciales.
- Más procesos o workers de uvicorn, y cualquier cambio en Railway.
- Integración y despliegue.

### Aceptación verificable

1. Los casos y los negativos de arriba.
2. Suite completa desde una base recién creada, con el 213 adentro.
3. Build, lint, tipos, `compileall`, `alembic check` y diff-check con
   `cr-at-eol`.
4. a11y, contraste, auditoría móvil y las dos guías, sólo si cambia algo
   visible.

### Frená y consultá

- Si el arreglo necesita soltar la fila antes de apagar el link.
- Si hace falta una migración o cambiar la configuración de Railway.
- Si el estado final de un rechazo o una cancelación contra un cobro no es el
  que ya definen los casos.
- Si el inventario encuentra caminos fuera del cobro y el arreglo no es el
  mismo y chico.

### Entrega en `PARA-PM.md`

- SHA;
- el inventario, con su comando;
- los casos y los negativos, con su salida;
- la suite y las puertas;
- los riesgos.

No integres ni despliegues.

---

## Después (no empezar todavía)

Lo decide la PM. Lo que depende de Emi puede reordenar la cola:

- el pago que llega a una orden ya cerrada, antes de habilitar Mercado Pago;
- P3: los errores de la API en «tú», y las guías que no nombran los avisos de pago;
- el correo (#15);
- las cuentas de prueba de Mercado Pago;
- las decisiones de la clienta: #5, #10, #12, #11b y la logística.
