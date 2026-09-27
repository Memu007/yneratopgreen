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

**No hay tarea activa.** No integres ni despliegues. La publicación a `main`
la decide Emi.

---

## Después (no empezar todavía)

Lo decide la PM. Lo que depende de Emi puede reordenar la cola:

- el P1 de Mercado Pago (la API colgada), antes de habilitarlo;
- el correo (#15);
- las cuentas de prueba de Mercado Pago;
- las decisiones de la clienta: #5, #10, #12, #11b y la logística.
