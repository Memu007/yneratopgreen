# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Decisión sobre RECONCILIADOR-PROGRAMADO-1 — devuelta

Sobre `c53a5b5` (producto en `d351306`). Tu informe `4b7a2b4` difiere sólo
en `docs/pm`. Evidencia en `REPRODUCCION-RECONCILIADOR-PROGRAMADO-1-2026-09-29.md`.

**Lo que está bien y no se toca:**

- **La comprobación al arrancar.** Tus 6 negativos dan su rojo. También da
  rojo el mío que dice «NO CORRIO» pero barre igual.
- **El comando, corrido a mano como en producción.** Con la URL como la da
  Railway (`postgresql://` y `postgres://`) barre, sale con 0 y no migra.
- **223 y 224:** 2/2 en base recién creada.
- **Suite completa desde base nueva:** 223/224. Sólo cae el 131, de entorno.
- **Puertas:** build, tipos, lint, `compileall`, `pip check`, `node --check`,
  `alembic check` y diff-check, verdes.

**Se devuelve por cuatro cosas chicas:**

1. **Nadie confirmó que el Backend tenga `MP_TOKEN_KEY`.** Tu informe dice
   «Ninguna es un secreto que el Backend no tenga», pero no hay con qué
   afirmarlo:
   - la sección 2 de `RAILWAY.md` no pone variables de Mercado Pago;
   - de Mercado Pago, el inventario del 13/09 sólo registra
     `MP_CHECKOUT_HABILITADO=false`;
   - la clave vale `""` por omisión.

   Si falta, la referencia llega vacía y cada corrida sale con 2. Era una de
   las condiciones para frenar. En `RAILWAY.md`, sección 5:
   - **cuándo se crea** (decisión PM): el día que se habilita Mercado Pago,
     con el Backend ya con su `MP_TOKEN_KEY` y antes de encender el cobro;
   - **antes de crearlo:** Emi mira que `MP_TOKEN_KEY` figure en «Variables»
     del Backend. Mira sólo el nombre, no el valor. Si no está, no lo crea;
   - **«NO CORRIO: falta MP_TOKEN_KEY»:** que mande a mirar primero el
     Backend, y no «Corregila en Variables».

   Cómo se genera la clave del Backend no va acá: es de la habilitación de
   Mercado Pago.
2. **El tope: aceptado.**
   - El comando pasa a
     `railway-entrypoint timeout 540 python -m app.reconciliar`, y sale el
     «detenela a mano».
   - El 223 comprueba que el comando tenga un tope menor que el intervalo del
     horario. Su negativo, sin tope, tiene que dar rojo.
3. **El control del horario en el 223 no distingue.** Con `*/10 3 * * *` el
   223 pasa, y ese horario corre sólo entre las 3 y las 4 UTC. Que mire los
   cinco campos.
4. **La línea tiene que nombrar la variable también cuando está mal, sin su
   valor.** Hoy, con `MP_MINUTOS_DE_GRACIA` vacía, dice «la configuración no
   es válida: 1 error(es)». `RAILWAY.md` promete que la línea dice cuál. Va
   una escena más en el 224, con su negativo.

**Sumá mis dos negativos a tu script**, así la vuelta se revisa con un solo
comando:

- `pm-avisa-pero-barre`: en `main()`, `_no_corre(motivo)` pasa a imprimir la
  misma línea sin salir. El 224 da rojo: «barrió igual», «salió con 0» y
  «marcó 1 vendedor(es)». La escena de la otra clave ya no marca a nadie,
  porque la de sin clave la marcó antes.
- `pm-horario-restringido`: el horario de `RAILWAY.md` pasa a
  `*/10 3 * * *`. Tiene que dar rojo en el 223; hoy pasa.

**Opcional, si te sirve:** una línea en `RAILWAY.md` sobre el primer
despliegue. Hasta donde sé, Railway despliega apenas se crea el servicio, con
lo que tenga en ese momento, y ese despliegue puede fallar antes de que Emi
cargue la configuración. No lo verifiqué.

**Para la vuelta:** si sólo tocás `RAILWAY.md`, la parte del import de
`reconciliar.py` y los casos 223 y 224, no hace falta la suite completa.
Alcanza con el 100, del 210 al 224, los negativos y el diff-check. Si tocás
otra cosa, va la suite completa.

**P3, sin tarea:**

- una orden de Mercado Pago cuyo vendedor se desvinculó queda reservada
  hasta que vuelva a vincular: el reconciliador no puede preguntar sin el
  token. Es de antes; lo decide PM antes de habilitar Mercado Pago;
- al publicar con migraciones, una corrida puede caer si arranca antes de que
  el Backend migre. La siguiente se arregla sola;
- el 223 usa variables escritas en el caso, no las de `RAILWAY.md`.

No integres ni despliegues.

---

## Tarea activa — RECONCILIADOR-PROGRAMADO-1

**Devuelta el 29/09.** Lo que falta está arriba, en la decisión.

**Sobre tu freno (29/09): bien frenado, y va la (a).** El buscador me dice lo
mismo que a vos, y yo tampoco llego a las páginas:

- Config as Code quedó en desuso;
- los servicios nuevos no pueden usarlo;
- los que ya lo usan lo pierden el 01/12/2026.

Así sigue la tarea:

- **Se programa desde el panel**, como recomienda Railway para el horario. En
  el repositorio quedan:
  - los pasos en `RAILWAY.md`;
  - la comprobación local;
  - los casos.

  Los negativos de configuración pasan a mirar el comando y el `entrypoint`.
- **Cada 10 minutos:** aceptado, con tu cuenta de 30 minutos de vigencia más
  10 de gracia.
- **Las variables van como referencia al Backend** (`${{Backend.…}}`), no
  como copia. Esto vale sobre todo para `JWT_SECRET` y `MP_TOKEN_KEY`. En
  `RAILWAY.md`, cada una va por nombre y con su porqué.
- **La comprobación al arrancar incluye `MP_TOKEN_KEY`:**
  - si falta, el servicio sale con error y no barre;
  - si hay tokens guardados y la clave no descifra ninguno, tampoco barre ni
    marca a nadie para reconectar. Lleva su negativo: con otra clave, el
    servicio marca vendedores para reconectar, y eso tiene que dar rojo.
- **El costo de un servicio más: Emi lo aprobó el 29/09** («Ok el costo»).
  Vos seguí con el repositorio. El servicio lo crea Emi con tus pasos, después
  de que PM acepte la pieza.
- **El corte del 01/12 para el Backend y el Frontend va en una pieza propia**,
  antes de esa fecha. No es de esta tarea.

**Decisión de Emi (29/09, «publicá y A»).** Es la última condición para
habilitar Mercado Pago. La Fase 4 empieza el 16/10.

**Rama y base:** `claude/dev-role-repo-3l0kp3`, desde el último commit PM.

### Problema

`reconciliar.py` dice «Todavía **no** está programado en ningún lado», y
`RAILWAY.md` no lo nombra. Sin barridos pasa esto:

- las reservas de las órdenes de Mercado Pago que nadie paga no vencen;
- el link que no se pudo apagar queda abierto, porque desde
  `PAGO-ORDEN-CERRADA-1` el reintento es en el barrido siguiente;
- un pago cuyo aviso se pierde no se reconcilia.

### Qué entra

1. **Un servicio aparte en Railway**, con la misma imagen del Backend, que
   corre `python -m app.reconciliar` con horario. No va dentro de la API: el
   reconciliador espera filas con el bloqueo síncrono, que en el proceso de la
   API frenaría todo.
2. **Su configuración en el repositorio:**
   - build con `Dockerfile.railway`;
   - el comando `railway-entrypoint python -m app.reconciliar`;
   - el horario;
   - sin `preDeployCommand`: las migraciones las corre sólo el Backend;
   - sin una política de reinicio que lo relance al terminar.

   Proponé la frecuencia, y justificala con la vigencia de la reserva y del
   link.
3. **Los pasos para Emi, en `RAILWAY.md`,** escritos para alguien que no
   programa:
   - crear el servicio y apuntarle el archivo de configuración;
   - las variables, sólo por nombre: cuáles copia del Backend y por qué;
   - cómo ver en Railway que corrió, y que el registro dice
     «RECONCILIACION {…}».
4. **Comprobación local, como en producción:** con los archivos que copia
   `Dockerfile.railway` y `ENV=production`.
   - El comando hace un barrido, imprime la línea y termina con 0.
   - Si falta una variable, falla con un mensaje claro y un código distinto
     de 0.
   - Dos corridas a la vez no duplican nada: lo mira el 100.
5. **La documentación de Railway, citada:** cómo se programa, si se puede
   desde la configuración del repositorio, el intervalo mínimo, la zona
   horaria, y qué pasa si la corrida anterior sigue en curso. Si algo no se
   puede como lo pido acá, decilo con la cita.

### Casos

- **El comando del servicio**, con el entrypoint y `ENV=production` sobre la
  base local: un barrido, la línea «RECONCILIACION», salida 0, y ninguna
  migración.
- **Una orden de Mercado Pago vencida y sin pago:** el barrido del comando la
  cierra y suelta el stock. Así se ve que el comando es el reconciliador de
  verdad.

### Negativos

Cada uno da rojo por su motivo y deja el árbol como estaba.

- El comando no termina: el caso da rojo por tiempo.
- El servicio corre las migraciones.
- La configuración apunta a otro comando.

### Fuera de alcance

- **Tocar Railway:** lo hace Emi con tus pasos. Vos no entrás a Railway, ni
  con la CLI.
- Habilitar Mercado Pago y las credenciales reales.
- Cambiar lo que decide el reconciliador.
- Integración y despliegue.

### Aceptación verificable

1. Los casos y los negativos de arriba.
2. Suite completa desde una base recién creada.
3. Build, lint, tipos, `compileall`, `alembic check` y diff-check con
   `cr-at-eol`.
4. PM corre el comando como en producción, con los archivos del Dockerfile.

### Frená y consultá

- Si hace falta cambiar el Backend o su configuración en Railway.
- Si el reconciliador necesita una variable secreta que el Backend hoy no
  tiene.
- Si programarlo exige otro plan de Railway, o un costo más allá de un
  servicio que corre unos segundos cada 10 minutos (lo aprobado el 29/09).

### Entrega en `PARA-PM.md`

- el SHA;
- los archivos de configuración, y la frecuencia con su porqué;
- los pasos para Emi;
- los casos y los negativos, con su salida;
- la suite y las puertas;
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
    `RECONCILIADOR-PROGRAMADO-1`, en sus reproducciones;
  - ingresar con una contraseña de más de 72 bytes da 500 (bcrypt);
  - cambiar la propia contraseña desde la pantalla: la API tiene `/auth/change-password` y ninguna pantalla lo usa;
- **antes de habilitar Mercado Pago:** qué pasa con una orden de Mercado
  Pago cuyo vendedor se desvinculó. Hoy queda reservada hasta que vuelva a
  vincular;
- el correo (#15);
- las cuentas de prueba de Mercado Pago;
- la mejora de la logística en los filtros, por definir;
- Inicio (#5) y misión y visión (#12), cuando lleguen de la clienta.
