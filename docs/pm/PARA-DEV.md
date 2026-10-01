# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Decisión sobre CAMBIAR-CONTRASENA-1 — aceptada en rama

Sobre `02e82e3` (producto en `f7340f5` y `001507f`). Evidencia en
`REPRODUCCION-CAMBIAR-CONTRASENA-1-2026-10-01.md`.

- **El 235:** 1/1.
- **Negativos:** tus cuatro dan rojo. También dan rojo los tres míos:
  - el alta del panel con su regla vieja;
  - un error que borra lo escrito;
  - el filtro del 422 que mira sólo `password` y no `new_password`.
- **Suite completa desde base nueva:** 234/235. Sólo cae el 169, de entorno.
- **Auditorías y las dos guías:** verdes.
- **Tus riesgos:** aceptados.
- **Sacar la contraseña del 422:** bien visto, y se queda.

La publicación a `main` la decide Emi. No integres ni despliegues.

`INICIO-ECOSISTEMA-1` está publicada en `30f9791`.

---

## Tarea activa — SESIONES-AL-CAMBIAR-1

**Rama y base:** `claude/dev-role-repo-3l0kp3`, desde el último commit PM. Va antes de `VENDER-SIN-SESION-1`.

### Problema

Cambiar la contraseña no cierra ninguna sesión. Lo midió la Dev en el freno
`3f9f2e5`:

- el token de renovación dura 30 días;
- cada renovación emite otro de 30 días.

Una sesión abierta en otro dispositivo no vence nunca. Es justo el caso de
las dos contraseñas que quedaron en chats: cambiarlas no saca a quien ya
hubiera entrado.

### Qué entra

1. **Cambiar la propia contraseña** deja sin valor todas las sesiones
   anteriores de esa cuenta, de acceso y de renovación. La sesión desde la
   que se cambió sigue abierta, o se reabre sola, sin pedir ingresar de
   nuevo.
2. **Restablecerla desde el panel** también invalida las sesiones
   anteriores de esa cuenta.
3. **Desactivar una cuenta desde el panel:** decí en el informe si hoy sus
   sesiones siguen valiendo. Si siguen, que también se invaliden.
4. **Cómo, lo elegís vos.** Por ejemplo, la marca de cuándo cambió que
   propusiste. Si necesita migración, aditiva y probada en modo producción.

### Aceptación verificable

1. **Caso nuevo con dos sesiones de la misma cuenta.**
   - Cambiar la contraseña en una:
     - la otra recibe 401, tanto con el token de acceso como con el de
       renovación;
     - la que cambió sigue funcionando.
   - Lo mismo al restablecer desde el panel.
2. **Negativo:** sin la comprobación, la sesión vieja sigue entrando y da
   rojo.
3. **Migración:** si hay una, el caso corre sobre una base sin siembra y se
   prueba en modo producción.
4. Suite completa desde base nueva y las puertas de siempre.

### Frená y consultá

- Si invalidar obliga a cerrar la sesión de todas las cuentas a la vez, o a
  cambiar `JWT_SECRET`.

---

## En espera — HERO-COMPACTO-1 (no empezar)

**En espera desde el 01/10.** La clienta pidió que Inicio explique mejor el
concepto, y Emi eligió sumar una sección «Por qué AgroBoeda» debajo de la
portada (maqueta v3, `maquetas/INICIO-CONCEPTO-V3-2026-10-01.html`). Cuando
la clienta la apruebe, esta pieza y la sección nueva van juntas en una sola
tarea. Va a cambiar el criterio de qué tiene que verse sin bajar. Lo de abajo
queda como referencia.


**Decisión de Emi (01/10), opción A.** Emi miró el Inicio publicado en su
notebook: la portada ocupa toda la pantalla, y los servicios del ecosistema,
que son lo principal de la versión 2, quedan abajo. En 1440 el título se parte
en cuatro renglones, con «cumplimiento» solo en uno, y la foto acompaña esa
altura. Es fiel a la maqueta: lo que cambia es la proporción, no el error.
Entregala por separado.

### Qué entra

1. **El título de la portada en tres renglones o menos** en 1440, con los
   tokens de tipografía que ya existen.
2. **La portada más baja.** En 1440×900 y en 1366×768, sin bajar, se ven:
   - el rótulo «El ecosistema AgroBoeda»;
   - «¿Qué querés hacer?»;
   - el borde de arriba de la primera fila de tarjetas.
3. **La foto acompaña la altura nueva**, sin deformarse y sin cortar el tractor
   ni la tolva.
4. **En 390 no empeora:** la portada no crece. Decí en el informe cuánto mide
   antes y después.

### Fuera de alcance

- Cambiar los textos aprobados, los botones o la foto elegida.
- Tocar las otras secciones de Inicio.

### Aceptación verificable

1. **Caso nuevo** que mida, en 1440×900 y 1366×768:
   - los renglones del título;
   - que «¿Qué querés hacer?» y el borde de la primera tarjeta queden dentro
     de la pantalla al abrir Inicio.
2. **Negativo:** la portada con la altura de hoy da rojo.
3. **Capturas antes y después** en 1440×900, 1366×768 y 390.
4. El 232 y el 233 siguen verdes.
5. Suite completa, a11y, contraste, móvil y las puertas de siempre.

### Frená y consultá

- Si para llegar hace falta un tamaño de letra o una medida que
  `tokens.css` no tiene.

---

## Después — VENDER-SIN-SESION-1 (empezala apenas entregues SESIONES-AL-CAMBIAR-1)

**Decisión de Emi (01/10), opción B:** «Vender» se ve siempre en la cabecera.
Entregala por separado.

### Problema

Desde `INICIO-ECOSISTEMA-1`, sin sesión no hay ningún botón para publicar:

- «Publicar una oferta» salió de Inicio;
- la página «Quiénes somos», que tenía el otro botón, salió del sitio;
- «Vender» aparece sólo después de ingresar.

### Qué entra

1. **«Vender» en la cabecera para todos**, en escritorio y en celular.
2. **Sin sesión:** abre el ingreso, y al entrar abre el formulario de
   publicar. Es el mismo recorrido que hacía `pedirPublicar` antes de
   `b5daa24`:
   - cancelar o equivocar la contraseña no abre nada;
   - darse de alta no abre sesión, así que no hay nada que retomar.
3. **Con sesión:** como hoy.

### Fuera de alcance

- Volver a poner «Publicar una oferta» en Inicio: la maqueta aprobada no lo
  tiene.
- Cambiar el texto de la tarjeta del Mercado.

### Aceptación verificable

1. **Caso nuevo, en 1440 y 390, sin sesión:**
   - «Vender» se ve;
   - ingresar lleva al formulario;
   - cancelar el ingreso no abre nada.
2. **Con sesión:** «Vender» abre el formulario como hoy.
3. **Negativos:**
   - «Vender» oculto sin sesión da rojo;
   - ingresar sin que se abra el formulario da rojo.
4. **La cabecera en 390** no desborda ni tapa controles: la auditoría móvil
   y las capturas lo muestran.
5. Suite completa desde base nueva, a11y, contraste, móvil, las dos guías y
   las puertas de siempre.

### Frená y consultá

- Si en 390 «Vender» no entra en la cabecera sin cambiar su forma.

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
- **antes del 01/12/2026:** sacar de `railway.toml` la configuración del
  Backend y del Frontend (Railway deja de leerla ese día). Pieza propia;
- una devolución o un contracargo que llega con la cuenta desvinculada no
  se registra: quien compra sigue viendo «pagado» (freno de
  `DESVINCULAR-CON-COBROS-1`);
- **antes del lanzamiento real de Mercado Pago:** si la prueba lo confirma,
  la vinculación en Safari, Brave y Firefox (la cookie del Backend en otro
  sitio). Lo más probable es que alcance con un dominio propio, que es de Emi
  y de Railway, no de código;
- el título de la pestaña, la descripción para buscadores y el lema del pie
  con el ecosistema, cuando la clienta dé el texto;
- el correo (#15);
- las cuentas de prueba de Mercado Pago;
- la mejora de la logística en los filtros, por definir.
