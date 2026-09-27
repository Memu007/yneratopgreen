# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Tarea activa — AVISOS-DE-PAGO-1

**Rama y base:** `claude/dev-role-repo-3l0kp3`, desde el último commit PM.

### Decisión sobre NOTIF-TEXTOS-1

**Aceptada en rama** sobre `4db386b`. Evidencia en
`REPRODUCCION-NOTIF-TEXTOS-1-2026-09-27.md`.

- **Casos:** el 79 corre solo sobre una base recién creada, y el 210 pasa.
- **Negativos:** tus cuatro dan rojo, y los dos míos también. Uno de los
  míos saca la notificación del envío, y el 210 la echa de menos porque
  cuenta las exactas.
- **Suite completa desde base nueva:** 209/210. Sólo cae el 169, de entorno.
- **Auditorías y las dos guías:** verdes.
- **Tu pregunta: opción A.** La B queda atada a la decisión sobre los datos
  de contacto, que está pendiente de Emi.
- **Los errores de la API en «tú»:** P3, sin tarea por ahora.

**Aviso de entorno:** tu script de negativos llama a
`entorno_nativo.sh --reiniciar-api` sin mirar `REINICIAR_API`, como los dos
anteriores. PM lo corrió con su propio reinicio. En los scripts nuevos, que
`REINICIAR_API` mande.

La publicación a `main` la decide Emi. No integres ni despliegues.

### Problema y prioridad

Quien paga por transferencia no se entera de lo que pasa con su pago:

- si quien vende rechaza el comprobante, la orden queda «Rechazado» y a
  quien compra no le llega nada;
- si lo aprueba, tampoco;
- por Mercado Pago, cuando se acredita el pago, no se avisa a nadie.

La notificación «Pago aprobado» existe, pero nadie la manda, y trata de «tú».

### Qué entra

1. **Rechazar el comprobante** le avisa a quien compra. El aviso dice lo que
   pasó y el paso que existe en Mis Compras, si existe. Por ejemplo, volver a
   enviar el comprobante, si el producto lo permite; si no, no se promete.
2. **Aprobar el comprobante** les avisa a quien compra y a quien vende.
3. **Pago acreditado por Mercado Pago**, confirmado por el producto, avisa a
   los dos. Una sola vez, aunque la confirmación llegue repetida.
4. **«Pago aprobado» y «¡Venta confirmada!»** se reescriben:
   - en «vos»;
   - sin prometer envío ni plazos.

   Aplican las mismas reglas que en NOTIF-TEXTOS-1.

### Fuera de alcance

- El correo (#15): las notificaciones son las del sitio.
- Datos de contacto en los avisos (la opción B).
- Cambiar qué hace el producto con la orden al aprobar o rechazar.
- Integración y despliegue.

### Aceptación verificable

1. **Caso nuevo por transferencia.**
   - Comprobante rechazado: quien compra recibe un aviso.
   - Comprobante aprobado: reciben uno quien compra y uno quien vende.
   - Se leen en la API y en «Notificaciones», en los dos anchos.
2. **Caso nuevo por Mercado Pago**, con el doble local.
   - Pago acreditado: un aviso para cada parte.
   - La misma confirmación repetida no suma avisos.
3. **Negativos:**
   - sin el aviso del rechazo da rojo;
   - un aviso duplicado con la confirmación repetida da rojo.
4. El 210 sigue pasando: las cuentas exactas cambian donde corresponde.
5. Suite completa desde base nueva, a11y, contraste, móvil, las dos guías y
   las puertas de siempre.

### Frená y consultá

- Si avisar cambia el orden de lo que hace la API al aprobar o al rechazar,
  o si el aviso de Mercado Pago no tiene un solo lugar donde el pago se da
  por confirmado.

### Entrega en `PARA-PM.md`

- SHA;
- la tabla de avisos: cuándo se manda, a quién y con qué texto;
- los casos y los negativos;
- las puertas;
- los riesgos.

## Después (no empezar todavía)

Lo decide la PM. Lo que depende de Emi puede reordenar la cola:

- el correo (#15);
- las cuentas de prueba de Mercado Pago;
- las decisiones de la clienta: #5, #10, #12, #11b y la logística.
