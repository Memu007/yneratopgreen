# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Decisión sobre PAGO-ORDEN-CERRADA-1 — aceptada en rama

Sobre `b3b5f3c` (producto en `c1e7f0c`). Tu informe y el merge `ad9c0c6`
difieren sólo en `docs/pm`. Evidencia en
`REPRODUCCION-PAGO-ORDEN-CERRADA-1-2026-09-28.md`.

- **Casos:** 220, 221 y 222, 3/3 en base recién creada.
- **Negativos:** tus 8 dan su rojo. También dan rojo los dos míos:
  - un aviso que dice «AgroBoeda te devuelve el pago». El 220 lo caza con la
    regla que aflojaste, así que aflojarla no abrió la puerta;
  - el texto de la orden cerrada para dos cobros. El 221 ve
    «pago_tras_cierre». Es el borde opuesto a tu `api-dice-mas-de-un-pago`.
- **Suite completa desde base nueva:** 221/222. Sólo cae el 131, de entorno.
- **Puertas, auditorías y las dos guías:** verdes.

**Tus tres preguntas:**

1. **Los textos:** aceptados. Los lee Emi.
2. **«Devolvé el pago desde Mercado Pago»:** se queda. Es una operación de la
   cuenta de quien vende, y el aviso no promete que se haga.
3. **El efecto del P2:** aceptado. Y tenés razón en lo que implica: el
   reconciliador no está programado en ningún lado. Programarlo es condición
   para habilitar Mercado Pago. Va como tarea propia, porque toca Railway.

**P3, sin tarea:**

- la orden cerrada que además tiene dos cobros no tiene caso;
- se dice «mercadería» también cuando la publicación es un servicio;
- el panel de administración no ve estos pagos;
- **propuesta mía, la decide Emi:** decirle a quien vende, en la orden
  cerrada, que si la entrega baje el stock de la publicación. Hoy la unidad
  sigue a la venta.

Emi autorizó publicarla el 29/09: la publica PM. Vos no integres ni
despliegues.

---

## Tarea activa — RECONCILIADOR-PROGRAMADO-1

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
- Si programarlo exige otro plan de Railway o un costo nuevo.

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
  - los cuatro de `PAGO-ORDEN-CERRADA-1`;
  - ingresar con una contraseña de más de 72 bytes da 500 (bcrypt);
  - cambiar la propia contraseña desde la pantalla: la API tiene `/auth/change-password` y ninguna pantalla lo usa;
- el correo (#15);
- las cuentas de prueba de Mercado Pago;
- la mejora de la logística en los filtros, por definir;
- Inicio (#5) y misión y visión (#12), cuando lleguen de la clienta.
