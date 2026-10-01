# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Decisión sobre INICIO-ECOSISTEMA-1 — aceptada en rama

Sobre `69068d9` (producto en `b5daa24` y `7d7d808`). Evidencia en
`REPRODUCCION-INICIO-ECOSISTEMA-1-2026-10-01.md`.

- **Capturas:** coinciden con la maqueta, y las diferencias son las que
  declaraste.
- **Casos:** 232, 233 y 234 en 3/3.
- **Negativos:** tus seis dan rojo. También dan rojo los tres míos:
  - el título sin «cumplimiento»;
  - dos servicios cambiados de lugar;
  - las fotos sin carga diferida.
- **Suite completa desde base nueva:** 233/234. Sólo cae el 169, de entorno.
- **Auditorías y las dos guías:** verdes.
- **La banda en 390 y los casos retirados:** aceptados.
- **El camino para publicar sin sesión:** Emi eligió que «Vender» se vea
  siempre. Es `VENDER-SIN-SESION-1`, abajo, después de esta tarea.

Buen cierre de una pieza empezada por otra cuenta. Rehacer la evidencia era
lo correcto.

La publicación a `main` la decide Emi. No integres ni despliegues.

---

## Tarea activa — CAMBIAR-CONTRASENA-1

**Rama y base:** `claude/dev-role-repo-3l0kp3`, desde el último commit PM.

### Respuesta al freno (01/10, `3f9f2e5`)

- **Opción A.** Una sola regla en la API, de 6 caracteres a 72 bytes, y la
  usan los cuatro lugares: registro, cambio, alta desde el panel y
  restablecer desde el panel. Sin cambiar cómo se guarda nada.
- **Los 72 bytes:** se acepta lo que elegiste.
  - En el registro, el cambio y el panel: 422 con un mensaje claro.
  - En el ingreso: «Email o contraseña incorrectos».
  - Sin truncar y sin hash previo.

  El mensaje final va en la entrega.
- **Las sesiones abiertas:** gracias por medirlo. Va como pieza propia,
  `SESIONES-AL-CAMBIAR-1`, apenas entregues ésta y antes de
  `VENDER-SIN-SESION-1`. En esta pieza no se toca.
- **El caso y la guía:** suman el alta y el restablecer desde el panel con
  más de 72 bytes, sin 500.

Seguí.

### Problema y prioridad

Nadie puede cambiar su propia contraseña desde el sitio.

- La API tiene `/auth/change-password`, pero ninguna pantalla lo usa.
- El panel no deja restablecer la propia.
- Hay dos contraseñas que quedaron escritas en chats el 28/09: la de
  administración de Emi y la de `prueba@example.com`. Hoy Emi sólo puede
  cambiarlas desde la consola de Railway.
- La clienta va a recibir una cuenta creada desde el panel, con una
  contraseña que eligió otra persona.

Además, ingresar con una contraseña de más de 72 bytes da un error 500 en
vez de «contraseña incorrecta», porque bcrypt no acepta más.

### Qué entra

1. **«Cambiar contraseña» en «Mi cuenta»,** para cualquier rol.
   - Pide la contraseña actual, la nueva y su repetición.
   - Muestra los mensajes de la API en «vos».
   - Sin la actual correcta no cambia nada, y el error se puede corregir sin
     perder lo escrito en los otros campos.
2. **Las mismas reglas que el registro** para la contraseña nueva, en la API
   y no sólo en la pantalla.
3. **Más de 72 bytes**, en el ingreso, en el registro y en el cambio: un
   mensaje claro, nunca un 500. Decí en el informe cuál elegiste y por qué.
4. **La guía de uso** suma el paso, y `guia-usuario.mjs` lo comprueba. Si
   la guía del panel nombra cómo cambiar la contraseña, también.

### Fuera de alcance

- Recuperar la contraseña por correo (espera el #15).
- Cambiar las dos contraseñas reales: eso lo hace Emi en el sitio.
- Cerrar las otras sesiones abiertas al cambiar la contraseña. Si hoy
  siguen valiendo, decilo en el informe con cuánto duran, para que PM
  decida.
- Integración y despliegue.

### Aceptación verificable

1. **Caso nuevo, en escritorio y celular:**
   - cambiar la contraseña;
   - salir, entrar con la nueva y ver que la vieja ya no entra.
2. **Errores:**
   - con la actual mal, no cambia nada y los otros campos siguen escritos;
   - si las dos nuevas no coinciden, no se manda nada;
   - una nueva que no cumple las reglas, rechazada por la API llamada
     directo.
3. **73 bytes** en el ingreso, el registro y el cambio: ningún 500.
4. **Negativos:**
   - la API sin validar la nueva da rojo;
   - la pantalla que no pide la actual da rojo.
5. Suite completa desde base nueva, a11y, contraste, móvil, las dos guías y
   las puertas de siempre.

### Frená y consultá

- Si las reglas del registro no están en un solo lugar de la API.
- Si el límite de 72 bytes obliga a cambiar cómo se guardan las contraseñas
  ya creadas.

### Entrega en `PARA-PM.md`

- SHA;
- los casos y los negativos;
- las guías;
- las puertas;
- lo de las sesiones abiertas;
- los riesgos.

---

## Siguiente — SESIONES-AL-CAMBIAR-1 (apenas entregues CAMBIAR-CONTRASENA-1)

**Prioridad:** antes de `VENDER-SIN-SESION-1`. Entregala por separado.

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

## Después — HERO-COMPACTO-1 (apenas entregues SESIONES-AL-CAMBIAR-1)

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

## Después — VENDER-SIN-SESION-1 (empezala apenas entregues HERO-COMPACTO-1)

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
