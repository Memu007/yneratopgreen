# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Tarea activa — NOTIF-TEXTOS-1

**Rama y base:** `claude/dev-role-repo-3l0kp3`, desde el último commit PM.

### Decisión sobre PUBLISH-FIELDS-1 y REV1-PENDIENTES-1

**Las dos, aceptadas en rama** sobre `4d5e409`. Evidencia en
`REPRODUCCION-PUBLISH-FIELDS-1-Y-REV1-PENDIENTES-1-2026-09-27.md`.

- **Casos:** 207, 208 y 209 en 3/3.
- **Negativos:** tus seis dan rojo, y los cuatro míos también. Uno de los
  míos deja «Editar» mostrando la marca sin mandarla, y el 207 lo agarra.
- **Suite completa desde base nueva:** 208/209. Sólo cae el 169, de entorno.
- **Auditorías y las dos guías:** verdes.
- **Decisiones sobre tus avisos:**
  - «Editar» sin categoría editable: se acepta la comprobación por la API;
  - el total en Inicio se queda;
  - «optimizar sus operaciones» se queda hasta que se reescriba con misión y
    visión;
  - la corrección del 95 % se acepta, y fue una buena lectura del pedido.

La publicación a `main` la decide Emi. No integres ni despliegues.

### Problema y prioridad

Hay notificaciones que le dicen a la gente cosas falsas sobre su dinero. La
peor es la del rechazo: cuando quien vende rechaza un pedido, quien compra
lee «El monto total será reembolsado.». AgroBoeda no tiene ese dinero y no
reembolsa nada. Es la misma clase de defecto que el 95 % que corregiste.

### Qué entra

1. **Recorré todos los textos de `notifications.py`** que ve una persona.
   Para cada uno, anotá qué promete y si el producto lo cumple.
   - Corregí lo que afirme algo falso sobre dinero, reembolsos, envíos o
     avisos que el producto no manda. La primera es «El monto total será
     reembolsado.».
   - El texto nuevo dice lo que pasó, sin promesas. Si hace falta un próximo
     paso, que sea uno que exista en el producto.
2. **Mismo tono que el resto del sitio.** Las notificaciones tratan de «tú»
   («Tienes», «Procede», «confirma»); el sitio usa el «vos».
   - La de bienvenida dice «marketplace» y «productos agrícolas»; la
     devolución #1 pidió «agropecuario».
3. **El comentario de `AboutPage.tsx`** sobre «Nuestro equipo» le atribuye a
   la clienta un motivo que no dio. Ella dijo «por ahora». El repositorio se
   le entrega: el comentario tiene que decir sólo eso.
4. **El caso 79 tiene que correr solo.** Hoy, suelto, falla con «Cannot read
   properties of undefined (reading 'localityId')», porque depende de datos
   de casos anteriores. En la suite pasa.

### Fuera de alcance

- Cambiar cuándo se manda cada notificación, o a quién.
- Hablar de comisión o de retener fondos (#11b), que espera a Emi y la
  clienta.
- El correo (#15), que Emi ve el 28/09.
- Integración y despliegue.

### Aceptación verificable

1. **Caso nuevo** que dispare cada notificación que cambiaste y lea su texto
   donde lo ve la persona:
   - ninguna promete reembolso, devolución ni porcentaje;
   - todas usan el «vos».
2. **Negativo:** volver a poner «El monto total será reembolsado.» da rojo.
3. `SMOKE_CASOS=79 node scripts/smoke.mjs` pasa sobre una base recién
   creada.
4. Las dos guías coinciden. Si alguna cita una notificación, se actualiza.
5. Suite completa desde base nueva, a11y, contraste, móvil y las puertas de
   siempre.

### Frená y consultá

- Si un texto necesita una decisión de producto, por ejemplo qué pasa con
  el dinero de un pedido rechazado ya pagado por Mercado Pago. Traé la
  pregunta con una recomendación; no la resuelvas en el texto.

### Entrega en `PARA-PM.md`

- SHA;
- la tabla de textos: antes, después y por qué;
- los casos y el negativo;
- las guías;
- las puertas;
- los riesgos.

## Después (no empezar todavía)

Lo decide la PM. Lo que depende de Emi puede reordenar la cola:

- el correo (#15);
- las cuentas de prueba de Mercado Pago;
- las decisiones de la clienta: #5, #10, #12, #11b y la logística.
