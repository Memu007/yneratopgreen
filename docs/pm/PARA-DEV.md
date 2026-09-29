# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Decisión sobre RECONCILIADOR-PROGRAMADO-1 — aceptada y publicada

Sobre `8170d8b` (producto en `1241b48`). Tu informe `14e884c` difiere sólo en
`docs/pm`. Evidencia en `REPRODUCCION-RECONCILIADOR-PROGRAMADO-1-2026-09-29.md`,
sección «La vuelta».

- **Los cuatro cambios:** como se pidieron. Bien reconocido lo de
  `MP_TOKEN_KEY`.
- **Suite completa desde base nueva, sobre este código:** 223/224. Sólo cae
  el 131, de entorno.
- **Negativos:** tus 10 dan su rojo en la primera corrida. También dan rojo
  los dos míos nuevos:
  - la línea nombra la variable y además escribe su valor. El 224 lo caza
    sólo por «escribió el valor», así que ese control distingue;
  - `timeout 600` con un horario de 10 minutos. El 223 da rojo en el borde.
- **El comando a mano, como en producción, leído de `RAILWAY.md`:** barre,
  sale con 0 y no migra. Cada error sale con 2 y nombra la variable, sin su
  valor.
- **Puertas:** verdes.

**Queda sin verificar, y está dicho:** que `timeout` esté dentro de la imagen.
Si faltara, el paso «Ver que corrió» de `RAILWAY.md` lo muestra.

**Publicada por PM en `5d8df5d` el 29/09**, con autorización de Emi. Vos no
integres ni despliegues.

---

## Tarea activa — DESVINCULAR-CON-COBROS-1

**Decisión de Emi (29/09, «1, pasale la de Mercado Pago»).** Prepara Mercado
Pago sin depender de sus claves. Es condición para encender el cobro.

**Rama y base:** `claude/dev-role-repo-3l0kp3`, desde el último commit PM.

### Problema

Hoy un vendedor puede desvincular su cuenta de Mercado Pago con cobros en
curso: `/mp-oauth/unlink` borra las credenciales sin mirar nada. Sin su token,
ni el reconciliador ni el aviso pueden preguntarle a Mercado Pago por esas
compras. La orden queda «colocada» y la mercadería reservada hasta que vuelva a
vincular. En la base local de PM quedaron 7 así, las del 224.

Pasa lo mismo si reconecta con **otra** cuenta: la vuelta de Mercado Pago
guarda la cuenta nueva sin compararla con la anterior (`guardar_credenciales`
pisa `mp_user_id`).

La plata no corre riesgo: sin apagar el link no se libera nada
(`cerrar_cobro` → «diferido»). Lo que queda trabado es la orden y el stock, sin
que nadie sepa por qué. `docs/homologacion-mercadopago.md` ya dice «No
desvincular a los vendedores» para un rollback; esto lo vuelve regla del
producto.

### Qué entra

1. **La regla, en la API:** mientras un vendedor tenga cobros de Mercado Pago
   en curso, no puede desvincular ni pasar a otra cuenta. Renovar y reconectar
   la misma cuenta siguen permitidos.
2. **Qué es «en curso»:** una orden de Mercado Pago de ese vendedor con la
   reserva viva (reservada o cierre pendiente), o con un pago aprobado o en
   revisión cuyo link sigue abierto. Es el conjunto del reconciliador sin la
   condición de vencimiento.
   - Comprobá en el código que no falte ningún caso en el que todavía haga
     falta su token.
   - El criterio vive en un solo lugar.
3. **La respuesta:**
   - `unlink` contesta un conflicto, con un motivo propio y cuántos cobros hay
     en curso;
   - la vuelta de Mercado Pago con otra cuenta vuelve con un motivo propio y
     no toca las credenciales.
4. **La pantalla:**
   - el panel dice por qué no se puede y cuándo se va a poder, en vez de «No
     se pudo desvincular la cuenta.»;
   - «Podés desvincularla cuando quieras» dice la condición;
   - si la guía de usuario recorre esos textos, se actualiza junto.

### Casos

- Con una orden reservada no desvincula, las credenciales quedan y la
  pantalla lo explica. Cuando la orden termina, desvincula.
- Con cierre pendiente, no desvincula.
- Con un pago aprobado y el link abierto, no desvincula.
- Con sólo órdenes terminadas, desvincula.
- Las órdenes de otro vendedor no lo frenan.
- Reconectar con otra cuenta con cobros en curso vuelve con el motivo, y sigue
  la cuenta de antes. Con la misma cuenta, reconecta.

### Negativos

Cada uno da rojo por su motivo y deja el árbol como estaba.

- La regla sólo en la pantalla: la API desvincula igual.
- El criterio sin cierre pendiente.
- El criterio sin el link abierto de un pago aprobado.
- La vuelta de Mercado Pago acepta otra cuenta.
- La pantalla vuelve al mensaje genérico.
- Las órdenes de otro vendedor también lo frenan.

### Antes de empezar

- **La suite desvincula en 103 lugares**, muchos en un `finally` con
  `.catch(() => {})`. Con la regla, una vendedora con una orden abierta queda
  vinculada sin que nadie se entere. Un caso siguiente, o el mismo corrido dos
  veces como en los sabotajes, puede chocar con «cuenta en uso». Resolvelo en
  los casos, cerrando las órdenes como lo haría el producto. **Nada de atajos
  en el producto para la suite.**
- **La carrera:** una compra que se confirma mientras el vendedor desvincula.
  Fijate si una orden puede quedar con la preferencia de una cuenta que ya se
  borró, y decilo con evidencia.

### Fuera de alcance

- Las órdenes que ya quedaron trabadas. En producción no hay ninguna: Mercado
  Pago no está habilitado.
- Revocar el permiso del lado de Mercado Pago.
- Habilitar Mercado Pago y sus credenciales.
- Integración y despliegue.

### Aceptación verificable

1. Los casos y los negativos de arriba.
2. Suite completa desde una base recién creada.
3. Build, lint, tipos, `compileall`, `alembic check` y diff-check con
   `cr-at-eol`.
4. a11y y contraste de la pantalla que cambia, y las guías.
5. PM reproduce: con una orden reservada, `unlink` da conflicto; la orden
   vence con el reconciliador y `unlink` pasa.

### Frená y consultá

- Si hace falta una migración.
- Si arreglar la carrera toca el checkout.
- Si encontrás un caso en el que el token haga falta después de que la orden
  terminó.

### Entrega en `PARA-PM.md`

- el SHA;
- el criterio y dónde vive;
- los textos nuevos, que lee Emi;
- los casos y los negativos, con su salida;
- la suite y las puertas;
- los riesgos, con lo que encontraste de la carrera.

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
    `RECONCILIADOR-PROGRAMADO-1`, en sus reproducciones;
  - ingresar con una contraseña de más de 72 bytes da 500 (bcrypt);
  - cambiar la propia contraseña desde la pantalla: la API tiene `/auth/change-password` y ninguna pantalla lo usa;
- **antes del 01/12/2026:** sacar de `railway.toml` la configuración del
  Backend y del Frontend (Railway deja de leerla ese día). Pieza propia;
- el correo (#15);
- las cuentas de prueba de Mercado Pago;
- la mejora de la logística en los filtros, por definir;
- Inicio (#5) y misión y visión (#12), cuando lleguen de la clienta.
