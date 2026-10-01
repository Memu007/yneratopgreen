# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## SESIONES-AL-CAMBIAR-1: entrega

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `57adab6`; después integré tus `086f9a1` y `c21fb9d`, sólo `docs/pm` |
| código | `cc439b9` · `f306af7` (sólo comentarios) |
| caso, negativos y guías | `617f809` |
| caso 130, el contrato del token | `f0ac6df` |
| rama publicada | `8892b24` |
| no integrado, no desplegado | `main` sigue en `30f9791` |

**Resultado.**

- **Cambiar la propia contraseña cierra todas las sesiones de la cuenta**, de
  acceso y de renovación, en cualquier dispositivo. La que cambió recibe
  tokens nuevos en la misma respuesta y sigue adentro, sin volver a ingresar.
- **Restablecer desde el panel cierra todas**, también la de quien acababa de
  cambiarla.
- **Cambiar el estado de la cuenta cierra todas**, al desactivar y al
  reactivar, por el botón y por la edición.
- **No cierra la sesión de ninguna otra cuenta, ni cambia `JWT_SECRET`.** Un
  token emitido antes de esta pieza sigue sirviendo hasta que su cuenta cierre
  las sesiones: al desplegar nadie queda afuera.
- **Lo que contesta una sesión cerrada:** 401 «Tu sesión se cerró. Ingresá de
  nuevo.». En el sitio, quien estaba en otro dispositivo queda con «Ingresar»
  al hacer cualquier cosa.

**Nada para decidir.**

## Desactivar: qué pasaba antes

Lo pediste en el punto 3. Medido con el 236 contra el código de antes:

- **Mientras la cuenta estaba inactiva, la sesión no servía.** El acceso daba
  403 «Usuario inactivo» y la renovación, 401.
- **Al reactivarla, la sesión de antes volvía a servir**, con acceso y
  renovación (200), hasta 30 días y renovable. Ahora no vuelve.

## Cómo funciona

- Cada cuenta tiene un número, `sesion_version`, que viaja en cada token.
- Cerrar las sesiones es subir ese número; un token con otro número recibe
  401.
- Se eligió un número y no una fecha porque la fecha del token tiene
  precisión de un segundo: un cambio y un ingreso en el mismo segundo se
  confundían.

**Tres bordes que cerré y no estaban pedidos:**

1. **El choque.** Si la persona cambia la contraseña mientras el panel se la
   restablece, gana siempre el panel. Lo que pasaba en el primer borrador era
   que los dos escribían el mismo número, y quien cambió seguía adentro con
   su contraseña. La suma se hace en la base, y el cambio propio sólo vale si
   su sesión sigue vigente al guardarlo.
2. **Una pestaña con un pedido en vuelo.** Si otra pestaña del mismo
   navegador estaba renovando el token viejo justo durante el cambio, su
   rechazo borraba la sesión nueva y la persona quedaba afuera. Ahora el
   navegador no tira una sesión que se guardó mientras preguntaba.
3. **Cuentas que ya estaban inactivas al desplegar.** Sus tokens no llevan el
   número. Por eso reactivar también cierra: si no, al reactivarlas, sus
   sesiones de antes volverían.

## Migración

`20261001_0100_ba10450712c6`, aditiva:

- suma `users.sesion_version`, entero, no nulo, con 0 por omisión;
- en PostgreSQL 11 o más, agregar una columna con valor fijo no reescribe la
  tabla;
- la vuelta atrás borra la columna; con eso los tokens vuelven a valer como
  antes de esta pieza.

**Probada como en producción**, dentro del 236:

- con los archivos que copia `backend/Dockerfile.railway`, su entrypoint,
  `ENV=production` y sin `.env`;
- con el `preDeployCommand` que lee de `backend/railway.toml`
  (`railway-entrypoint migrate`);
- sobre una base sin siembra.

Pasos:

1. Sube hasta la revisión anterior.
2. Crea dos cuentas de antes, una activa y otra no.
3. Corre `migrate`: tiene que decir `Running upgrade a47300b5554c ->
   ba10450712c6`.
4. Las dos cuentas quedan en 0.
5. `alembic check` sale limpio.
6. Baja: la columna se va y las cuentas quedan.
7. Vuelve a subir.

**Aviso de entorno.** En mi entorno el rol de la base no es superusuario y
no puede instalar PostGIS en una base vacía. La base sin siembra es una
copia de la local a la que el caso le borra todas las tablas y tipos de la
aplicación; antes de migrar comprueba que no quede ninguna. Queda sólo
PostGIS, que en producción también existe antes de la primera migración.

## Caso y negativos

**Caso 236.** Usa cuentas propias, también la de administración; no depende
de la siembra.

- **Por la API, llamada directo:**
  - **A.** Con dos sesiones, cambiar la contraseña en una deja en 401 a la
    otra y a los tokens viejos, con acceso y con renovación. La que cambió
    sigue y se renueva.
  - **B.** Restablecer desde el panel cierra todas, también la del cambio.
  - **C.** Desactivar y reactivar, por el botón y por la edición, no revive
    la sesión de antes.
  - **D.** Un token sin el número sirve, y renueva con 0, hasta el primer
    cierre. El de una cuenta que ya estaba inactiva antes de esta pieza no
    vuelve al reactivarla.
  - **E.** El choque: cinco vueltas, con el restablecer saliendo 0, 50, 150,
    300 y 600 ms después del cambio. El panel gana en las cinco. Medido: el
    cambio respondió 401 en tres vueltas y 200 en dos, así que se probaron
    los dos órdenes.
- **En el navegador, en 1440:**
  - **F.** La pestaña que cambió sigue adentro al recargar, aunque otra
    pestaña tuviera en vuelo la renovación del token viejo.
  - El otro dispositivo queda con «Ingresar» y sin tokens.
- Al final, las sesiones de otras cuentas siguen.
- **G.** La migración, como en la sección anterior.

**Contra el código de antes** (`57adab6`), el 236 encuentra 28 problemas:

- la otra sesión, los tokens viejos y las sesiones de antes del restablecer
  responden 200;
- la sesión de antes de desactivar vuelve al reactivar;
- el cambio no devuelve tokens nuevos;
- en el choque queda la contraseña del cambio;
- el otro dispositivo sigue adentro.

`python3 scripts/sabotajes_sesiones_al_cambiar_1.py` → «todos dieron el rojo esperado» (once) y «src y backend después: como estaban»

| sabotaje | rojo del 236 |
|---|---|
| `acceso-sin-comprobar` (pedido): las rutas protegidas no miran la versión | 14 problemas: «A, la otra sesión: con el token de acceso, /auth/me responde 200 y tenía que ser 401», y lo mismo en el restablecer, el reactivar, el token de antes y el choque; el otro dispositivo sigue adentro. Nada de la renovación ni de la migración |
| `renovacion-sin-comprobar`: la renovación no la mira | 13 problemas: «A, la otra sesión: con el token de renovación, /auth/refresh responde 200 y tenía que ser 401», y lo mismo en los mismos lugares; el otro dispositivo se renueva solo y sigue adentro. Nada del acceso |
| `restablecer-no-cierra`: el panel restablece sin cerrar | 19 problemas: las tres sesiones de antes del restablecer siguen, con acceso y renovación, y en el choque queda la contraseña del cambio. Nada del cambio propio ni del reactivar |
| `reactivar-revive`: cambiar el estado no cierra | 4 problemas: reactivada por el botón, la sesión de antes vuelve, y también la de una cuenta inactiva desde antes del despliegue. La edición no se tocó y no cae |
| `solo-al-desactivar`: cierra al desactivar y no al reactivar, como mi primer borrador | 2 problemas: sólo la cuenta inactiva desde antes del despliegue recupera su token al reactivarla |
| `cambio-sin-condicion`: el cambio propio cierra aunque su sesión ya no valga | 9 problemas: en las vueltas del choque de 0, 50 y 150 ms queda la contraseña del cambio y su sesión sigue |
| `suma-en-python`: el número se suma en Python, como en mi primer borrador | 11 problemas: lo mismo, y en la vuelta de 300 ms queda la contraseña del panel pero la sesión del cambio sigue: los dos escribieron el mismo número |
| `token-viejo-afuera`: un token sin el número no sirve | 2 problemas: «D, un token de antes de la versión: /auth/me responde 401 y tenía que seguir en 200», y no renueva. Al desplegar, todas las cuentas quedarían afuera |
| `migracion-sin-valor`: la columna nueva sin valor por omisión | 1 problema: «G: «railway-entrypoint migrate» salió con 1: … NotNullViolation … column "sesion_version" of relation "users" contains null values» |
| `tira-la-nueva`: el navegador tira la sesión ante el rechazo del token viejo | 3 problemas: la pestaña que cambió queda sin sesión y afuera al recargar, y la otra pestaña del mismo navegador también. Nada del otro dispositivo |
| `cambio-sin-sesion-nueva`: la pantalla no guarda los tokens del cambio | 3 problemas: los mismos |

**Las frases nuevas de las guías también caen con el comportamiento roto.**
Lo corrí a mano, en escritorio:

- **`guia-admin.mjs`, sin cerrar al restablecer ni al reactivar:** caen el
  paso 5, con «reactivada, la sesión de antes vuelve: /auth/me 200,
  /auth/refresh 200», y el paso 6, con «restablecida, la sesión de antes
  sigue». También cae el 7, de arrastre: el 6 cortó antes de anotar la
  contraseña nueva.
- **`guia-usuario.mjs`, con toda sesión vigente:** cae el paso 23, con «la
  sesión del otro dispositivo sigue: /auth/me 200, /auth/refresh 200».
- **`guia-usuario.mjs`, sin guardar los tokens del cambio:** cae el paso 23,
  con «la sesión que guardó la pestaña después del cambio no sirve».

## Cómo verificarlo

Con el entorno arriba. El caso crea sus propias cuentas, también la de
administración:

```bash
SMOKE_CASOS=236 node scripts/smoke.mjs
# → 1/1 pasaron; 0 fallaron

REINICIAR_API="<tu reinicio>" python3 scripts/sabotajes_sesiones_al_cambiar_1.py acceso-sin-comprobar
# → [ROJO ESPERADO] … «A, la otra sesión: con el token de acceso, /auth/me responde 200 y tenía que ser 401»
```

## Puertas

| puerta | resultado |
|---|---|
| suite completa desde base nueva, sobre `f0ac6df` | **235/236**. Sólo cae el **131**, de entorno: «puente docker: sólo se traduce 'docker exec'». Pasan el 130, el 235 y el 236 |
| la corrida anterior, sobre `617f809` | 234/236: el 131 y el **130**, por el contrato del token. Lo corregí en `f0ac6df` y repetí la suite entera |
| tipos, lint, build | verdes: `npm run lint` sin avisos y `npm run build` con `tsc` |
| `compileall`, `node --check`, parseo de Python | verdes |
| `alembic check` | `No new upgrade operations detected.` |
| diff-check con `cr-at-eol` sobre `57adab6..f0ac6df` | limpio; ninguna línea cambia sólo por el final |
| a11y `--todas` | 78 de 78 pantallas, «SIN VIOLACIONES BLOQUEANTES, COBERTURA COMPLETA» |
| contraste | «las 82 mediciones exigidas se hicieron», «TODO OK, COBERTURA COMPLETA» |
| auditoría móvil | 12 de 12 recorridos y 39 pantallas: 0 desbordes, 0 controles tapados, 0 errores de consola y 0 respuestas 4xx/5xx |
| `guia-admin.mjs` | «LA GUÍA Y EL PANEL COINCIDEN: 26 pasos en escritorio y celular» |
| `guia-usuario.mjs` | «LA GUÍA Y EL SITIO COINCIDEN: 23 pasos en escritorio y celular» |

**Líneas con CR por archivo, contra la base:**

| archivo | base | ahora |
|---|---|---|
| `admin.py`, `dependencies.py`, `api.ts` | todo CRLF | todo CRLF |
| `backend/app/api/auth.py` | 736 de 786 | 762 de 812: las 26 agregadas, como sus vecinas |
| `backend/app/models/user.py` | 149 de 173 | 153 de 177: las 4 agregadas, como sus vecinas |
| `scripts/smoke.mjs` | 4 | 4 (las mismas) |
| `CambiarClave.tsx`, la migración, las dos guías, sus scripts y el script de negativos | 0 | 0 |

## Lo que cambié de otro caso

**El 130 fijaba las claves del token** en `exp`, `sub` y `type`. Lo hacía
para que su forma no cambiara sin que nadie lo notara, y esta pieza la cambia
a propósito.

- Ahora exige exactamente `exp`, `sub`, `sv` y `type`, con `sv` entero.
- Sigue exigiendo que el token no lleve datos de la cuenta.
- Que un token sin `sv` siga sirviendo lo mide el 236.

Commit aparte: `f0ac6df`.

## Riesgos

- **Quien esté en otro dispositivo cuando se cierre su sesión** no ve un
  aviso propio: al tocar algo, el sitio vuelve a «Ingresar». Pasa lo mismo
  que con una sesión vencida.
- **Una cuenta desactivada con el sitio abierto** antes veía errores de
  «Usuario inactivo» en cada pedido; ahora queda con «Ingresar». Si intenta
  entrar, ve «Usuario inactivo. Contacte al administrador.», igual que antes.
- **Salir no cierra las otras sesiones.** «Salir» sólo olvida la sesión en
  ese navegador, como antes. No estaba pedido.
