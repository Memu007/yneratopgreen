# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## COPY-CLEAR-1 — lo que la pantalla promete y lo que la pantalla hace

**Resultado: los seis puntos entregados. Dos correcciones a tu inventario del
punto 6, con la medición. Y un hallazgo fuera de alcance que te importa: `a11y`
está roja en la base aceptada, no por esta pieza.**

- Producto/regresión: `9f25d59`
- **En mi rama, no en `main`.** No integré, no desplegué, no toqué Backend,
  schema, dependencia, pagos, datos remotos, Railway, activos de marca,
  mensajería ni recuperación automática.

---

### 1. La marca vuelve a Inicio (A7): conservado

No lo toqué. El 156 sigue verde —lo corrí— y lo único que le cambié es el
rótulo del enlace a Registro, que esta misma pieza reescribió: buscaba
`/Reg[íi]strate aqu[íi]/i` y ahora dice «Registrate acá». Lo mismo en
`a11y.mjs` y en `contraste.mjs`, que lo buscaban igual.

### 2. Buscar tiene una acción real

Medido antes de tocar nada: `searchQuery` era una sola variable para lo
tecleado y lo aplicado, así que **cada tecla** cambiaba `q`, salía a la API y
redibujaba la grilla; y `handleSearchSubmit` era `console.log('Búsqueda
realizada:', searchQuery)`. Las dos mitades del defecto que describiste.

Ahora hay dos estados y **una sola forma de pasar de uno al otro**: el clic o
Enter aplican lo escrito, recortado. Vacío limpia el filtro. Es el patrón que
el buscador de usuarios de Administración ya usaba, y viven los dos en
`useProductFilters`, que es donde ya vivían los filtros y su sincronía con la
barra.

Sin motor, sin fuzzy, sin índice, sin endpoint y sin paginación: la consulta
que sale es la misma `search=` del servidor que ya existía.

**Acá me equivoqué y lo cuento porque importa.** Mi primera versión dejaba el
texto tecleado en `App` y lo sincronizaba con un efecto sobre lo aplicado. El
168 lo puso rojo dos corridas seguidas: `vaciar la búsqueda dejó la consulta en
la barra: …&q=Zarandaja16`. El efecto llegaba tarde y **pisaba lo que la
persona acababa de escribir**. Lo moví al hook, donde lo aplicado y lo tecleado
cambian en el mismo commit, y la carrera deja de existir por construcción.

Lo que no puedo decirte es que el caso atrape esa carrera siempre: **la
atrapaba de manera intermitente** —la primera corrida con el defecto pasó— y
cuando reproduje el efecto adentro del hook, no la atrapó (2/2 verde). Así que
lo que hay es una prueba determinista de la propiedad vecina —«Limpiar filtros»
limpia el campo, la barra y la grilla a la vez— y no una prueba de la carrera.
Lo digo en vez de venderte un negativo que no tengo.

### 3. Contacto no promete planes

Verifiqué la regla contra el producto antes de escribirla, porque es una
afirmación sobre dinero:

- `mp_preferencia.py:158` — «Nada de `marketplace_fee`: ni el 5 % de antes ni un
  cero. AgroBoeda no cobra comisión por venta.»
- `models/payment.py:62` — `commission_amount`, `commission_percent` y
  `seller_amount` se fueron del modelo.

La FAQ dice ahora que AgroBoeda no cobra comisión por la venta en este MVP y
que el pago va al vendedor. **Y agrega una frase que no me pediste:** que lo que
cobre el medio de pago corre por cuenta de ese medio. El propio comentario del
modelo dice que Mercado Pago le descuenta lo suyo al vendedor; callarlo sería la
misma clase de promesa, al revés.

De paso, en la FAQ de al lado quedaba «completa tu perfil» en una oración que ya
voseaba dos veces.

### 4. Contraseña: salida honesta

El Login no tenía **ninguna** salida: probar, fallar, volver a probar. Ahora
dice «¿Olvidaste tu contraseña? Todavía no hay recuperación automática» y ofrece
«Escribinos por Contacto». Sin token, sin correo, sin endpoint, sin modal, sin
formulario y sin plazo. La herramienta manual de administración no se tocó.

Un detalle que no es cosmético: la salida **no** pasa por `cerrarAutenticacion`.
Esa función ejecuta la continuidad pendiente, así que si el ingreso venía de una
tarjeta, al volver reabriría esa publicación encima de Contacto. Quien va a
pedir ayuda no vuelve a lo que estaba haciendo: la continuidad se descarta, y el
caso lo comprueba abriendo el Login **desde una tarjeta** a propósito.

### 5. Voseo es-AR

Reemplacé sólo formas verbales de segunda persona, revisadas una por una, y
sobre pantallas que el caso después visita:

| Dónde | Antes | Ahora |
| --- | --- | --- |
| Login | ¿No tienes cuenta? / Regístrate aquí | ¿No tenés cuenta? / Registrate acá |
| Quiénes somos | Contáctanos | Contactanos |
| Carrito vacío | Agrega productos para comenzar tu compra | Agregá productos para empezar tu compra |
| Vaciar carrito | ¿Estás seguro de que quieres vaciar el carrito? | ¿Seguro que querés vaciar el carrito? |
| Checkout | Completa tus datos para recibir el pedido | Completá tus datos… |
| Mi cuenta | Aún no tienes compras / Explora el marketplace y realiza tu primera compra | Todavía no tenés compras / Explorá el mercado y hacé tu primera compra |
| Mi cuenta | Aún no tienes ventas / Publica productos y espera… | Todavía no tenés ventas / Publicá productos y esperá… |
| Mi cuenta | No tienes notificaciones | No tenés notificaciones |
| Alta de publicación | Solo puedes agregar N imagen(es) más | Sólo podés agregar N imagen(es) más |
| Error visible | Sesión expirada. Por favor, inicia sesión nuevamente. | Sesión expirada. Volvé a iniciar sesión. |
| Error visible | Error de red. Por favor, verifica tu conexión. | No pudimos conectarnos. Revisá tu conexión y probá de nuevo. |

No toqué sustantivos («tu cuenta» queda) ni coincidencias correctas: en
`AdminPanel` hay «Vuelve a aparecer en el catálogo», que es tercera persona —la
publicación vuelve— y está bien escrita. Una regex la habría marcado.

### 6. Estados en español: dos correcciones a tu inventario

Acá vengo con la medición, porque lo que pediste no coincide del todo con lo
que hay.

**a. `getStatusBadge` no tiene ninguna rama `draft`.** Busqué `draft` en todo
`src/`: aparece en cuatro lugares y ninguno es ése. Lo que `getStatusBadge` sí
tiene es un mapa completo para su propio tipo, y nunca imprime un token: recibe
un estado ya traducido por `mapBackendStatus`, que además cae a `'pending'` ante
cualquier valor desconocido.

**b. De las dos referencias a `draft`, sólo una está muerta.**

| Dónde | ¿Muerta? | Medición |
| --- | --- | --- |
| `aPublicacionDelPanel` | **Sí** | `ProductStatus` tiene cuatro valores en el modelo, y el tipo de la base también: `["ACTIVE","PAUSED","SOLD_OUT","DELETED"]`. Una publicación en borrador no existe. **Eliminada.** |
| `ESTADOS_DE_ORDEN.draft` + el `.filter(token !== 'draft')` de Administración | **No** | `OrderStatus` sí tiene `DRAFT`, y la base también. El filtro la excluye a propósito —una orden en borrador todavía no es un pedido— pero la traduce si aparece en la tabla, y el 160 la busca en la vista sin filtro justamente por eso. Sacarla dejaría sin nombre a un estado real. **No la toqué.** |

**c. Lo que sí estaba mal, y lo encontró la aserción nueva.** El selector de
estado de cada fila tenía sus opciones escritas a mano y **en masculino**
—«Activo», «Pausado», «Agotado», «Eliminado»— mientras el badge de la MISMA
fila decía «Activa» y «Pausada». El mismo estado con dos nombres a dos
centímetros. Ahora las opciones salen del mismo diccionario que el badge y que
el filtro; el `value` sigue siendo el token del Backend.

Ninguna celda ni badge muestra un token crudo: `estados.ts` no devuelve el
token ni siquiera cuando no conoce el estado —dice «Estado sin traducir»— y eso
ya estaba y lo conservé.

### 7. Las pruebas

**Caso 160, extendido** con lo que pediste:

- Los catorce rótulos se fijan **exactos**, uno por uno. Lo que había comparaba
  la pantalla contra el diccionario del producto: comprueba que los dos están
  de acuerdo, no que lo que dicen esté en castellano. Con `active: 'Active'`
  los catorce seguían de acuerdo. La lista nueva no puede envejecer en
  silencio: se exige que cubra exactamente los estados que declara la base.
  (Detalle medido: lo que se fija sale de `textContent` y no de `innerText`,
  porque el badge se dibuja con `text-transform: uppercase` y `innerText` vuelve
  «ACTIVA».)
- El selector ofrece castellano con el token adentro del `value`, y el **cuerpo
  del PATCH** lleva el token. Se mira el pedido, no el resultado: que la base
  termine bien no dice con qué palabra se lo pidieron.

**Caso 168, nuevo**: búsqueda por clic y por Enter con la consulta recortada,
`q` puesta y limpiada, «Limpiar filtros», el rastro por consola medido en el
navegador y no leído del archivo, la FAQ sin planes, la salida de soporte desde
un Login abierto desde una tarjeta, y el voseo sobre siete superficies que el
caso **visita** —Login, Quiénes somos, carrito vacío, confirmación de vaciar,
Checkout y las tres solapas vacías de Mi cuenta—. La puerta de tuteo no es
sobre palabras sueltas: son las frases exactas que esta pieza retiró, buscadas
sobre el texto que la pantalla dibujó.

**Los rojos.** Contra la base anterior, revirtiendo un archivo por vez para que
cada familia caiga sola:

| Familia | Base anterior | Rojo |
| --- | --- | --- |
| Buscar | `App.tsx` | escribir disparó la búsqueda sola: 1 consulta(s) nuevas y la grilla pasó de 46 a 0 tarjetas |
| Planes | `ContactPage.tsx` | la FAQ sigue prometiendo algo que no existe (/planes/i) |
| Voseo del Login | `LoginModal.tsx` | el Login no vosea la invitación a registrarse: «…¿No tienes cuenta? Regístrate aquí» |
| Voseo del carrito | `CartModal.tsx` | el carrito vacío no vosea: «…Agrega productos para comenzar tu compra» |
| Voseo del panel | `UserDashboard.tsx` | «Mis Compras» no dice «Todavía no tenés compras» |
| Estados | base anterior entera | la opción con value «active» se lee «Activo» y en es-AR es «Activa» |

Ese último no es un sabotaje: es el defecto real que la aserción nueva
encontró en la base aceptada.

Y los que no podían salir de la base anterior, porque ahí ya estaban bien, con
el producto roto a propósito:

| Sabotaje | Rojo |
| --- | --- |
| Login sin la salida de soporte, el voseo intacto | el Login no dice nada para quien olvidó la contraseña |
| «Limpiar filtros» limpia lo aplicado y no el campo | limpiar filtros dejó q=null y el campo en «Zarandaja168 …» |
| El PATCH manda el rótulo en vez del token | el PATCH mandó `{"status":"agotada"}` y el Backend espera el token «sold_out» |

### 8. Compuertas

- 156 + 160 + 168 focales desde base limpia: **3/3**.
- **Suite completa desde base limpia: 165/168.** Rojos: el 131 de siempre, y el
  **167 y el 168 por el límite antifuerza-bruta del Backend**. El punto 9 lo
  explica: no es de esta pieza, y lo medí.
- `npm run lint`, `npx tsc --noEmit`, `node --check scripts/smoke.mjs` y
  `diff-check`: verdes.
- Contraste y capturas: no los corrí. No estrené ningún estilo —la salida de
  soporte usa `helpText`, que ya existía y ya usa el registro—.

**Corrí la suite completa tres veces, no una, y te digo por qué.** La primera la
mandé con la salida canalizada a `tail` y me quedé sin los mensajes de los
rojos: una corrida que no puedo leer no es una medición. La segunda es la que
informo. La tercera fue sobre la base anterior, para el punto 9.

En la primera corrida también cayó el **137**, y ése sí era mío: entra al
mercado con `q=` en la URL y después hacía `buscador.fill('')` esperando que
vaciar el campo soltara la búsqueda. Desde esta pieza eso ya no alcanza —buscar
es una acción—, así que ahora aplica el vacío con Enter y espera a que `q` se
vaya de la barra, en vez de contar hasta 1200. Verde.

### 9. El 167 y el 168 caen por el límite de ingresos, y no es de esta pieza

`POST /auth/login` contesta **429 «Demasiados intentos de ingreso»**. El 168 ni
llega a arrancar: se lo come en 8 ms, en su primera llamada.

El mecanismo, medido sobre `logs/api.log` de la corrida:

- `limite_de_intentos.py` permite **30 fallos de credencial por IP en 10
  minutos**. Sólo cuentan los 401 de credencial; un ingreso correcto devuelve la
  marca.
- El caso **134**, que prueba justamente ese límite, gasta **24 de los 30** en
  un solo minuto, desde `127.0.0.1`.
- Del 134 al 167 pasan **seis minutos**, o sea que el 167 llega adentro de la
  misma ventana, con seis fallos de margen que se van repartiendo los casos del
  medio. El fallo número 31 es el 429, y el que lo recibe es el 167.
- El 168 corre justo después y hereda la ventana agotada.

**Y esto ya pasaba.** Corrí la suite completa **sobre la base anterior**, sin
nada mío:

```
base anterior : 164/167 — FAIL 114, FAIL 131, FAIL 167
esta entrega  : 165/168 — FAIL 131, FAIL 167, FAIL 168
```

El 167 falla en las dos con **el mismo mensaje**: «un ingreso correcto no
reanudó la compra: hubo que volver a apretar "Continuar compra"». Lo que agrega
esta entrega es el 168, que muere por la misma ventana gastada.

Dicho de frente: **hace tres entregas que nadie corre la suite entera**, y el
167 —que escribí yo— nunca se había medido adentro de una. Es exactamente la
deuda que venís haciéndome cerrar: un caso que depende de un recurso que no
reservó. Acá el recurso no es una fila, es el presupuesto de ingresos fallidos.

**No lo arreglé** y te digo por qué. El arreglo honesto no está en el 167: está
en que el 134 no se lleve 24 de 30 justo antes. Y las salidas que se me ocurren
—que el 134 haga sus fallos por correo detrás de un `X-Forwarded-For`, que caen
en la bolsa «identidad-no-confiable» y no en la de `127.0.0.1`; o separar el 134
del 167 más de diez minutos— tocan el diseño del 134 o el orden de la suite, que
es una decisión tuya y una pieza propia. Meterla acá sería ampliar el alcance de
una pasada editorial hasta el limitador antifuerza-bruta.

El 114 cayó sólo en la corrida de la base anterior («el titular no ve sus cargas
declaradas») y pasó en la mía: es otro arnés intermitente, y lo dejo anotado.

### 10. `npm run a11y -- --todas` está ROJA, y tampoco es de esta pieza

Esto es lo que más me importa que leas.

```
[serious] color-contrast — 6 elementos en:
  escritorio/panel del comprador, del vendedor, del transportista
  celular/panel del comprador, del vendedor, del transportista
  · <span class="_soloEscritorio_…">María Cliente</span>
```

Lo medí con axe directamente: **`#1e2420` sobre `#355c48` = 2,08:1**, con 4,5:1
exigido, en 13,5 px normal.

**Y da idéntica contra la base anterior**: guardé mis cambios de `src/`, corrí
`a11y` sobre `HEAD` y salieron las mismas seis. No la trae COPY-CLEAR-1.

El mecanismo, hasta donde llegué sin tocar nada: la celda «Mi cuenta» lleva
`aria-current="page"` cuando la sección activa es la cuenta, y
`Header.module.css:132-137` le pone `background-color: var(--tg-color-surface)`
con `color: var(--tg-color-text)`. Ese par funciona en el resto del sitio, pero
la cabecera vive adentro de `tg-sobre-marca`, donde los tokens no valen lo
mismo: queda el texto oscuro sobre el verde de la banda. Sólo se ve estando en
Mi cuenta, que es exactamente el estado que `a11y` mide y que la suite no.

**No lo arreglé**: me dijiste que no rehaga marca, navegación ni estilos, y un
hallazgo fuera de alcance se informa. El arreglo propuesto es de una línea:
darle a esa regla el par de la banda —el mismo `--tg-color-text-inverse` que ya
usa `.celda`— o re-escopar `--tg-color-text` adentro de `tg-sobre-marca`. Decime
si lo abro como pieza propia.

### 11. Lo demás que queda dicho

- El caso 131 sigue rojo por entorno, como siempre.
- El caso 143 sigue dejando residuo —su servicio y su producto con stock 0
  quedan publicados—, como te dije en la entrega anterior.
- La FAQ de «¿Cuáles son las formas de pago?» dice «Aceptamos transferencias
  bancarias directas al vendedor» y el producto también cobra por Mercado Pago.
  Es una afirmación incompleta en la misma grilla que acabo de corregir. No la
  toqué: no estaba en el alcance y es una decisión tuya.
- Sigue esperando tu palabra lo del carrito sin sesión.

`CAT-PAGE-1` no lo empecé.

---

## TEST-SUITE-167S — dos verdes que afirmaban sobre un estado que no fabricaron

**Resultado: los dos puntos cerrados, cada uno con su rojo viejo reproducido y
su rojo nuevo medido. Sólo arnés: el diff de `src/` y `backend/` está vacío.**

- Arnés: `d7e17f9`
- **En mi rama, no en `main`.** No integré, no desplegué, no toqué Backend,
  endpoint, router, dependencia, rediseño, Railway, datos remotos, pagos ni
  secretos. No corrí suite completa, build, lint, a11y, contraste ni capturas.

Antes de tocar nada reproduje las dos premisas. Las dos se sostienen, y las dos
son la misma falla de método: **el caso afirmaba sobre un estado que no había
puesto él.** Lo anoto así porque no son dos arreglos distintos.

---

### 1. Caso 139 — «la primera tarjeta que ofreciera ingresar» no es una precondición

Inicio y Servicios no dibujan el catálogo: dibujan las **tres publicaciones más
nuevas**. `useVistaPrevia` pide `page_size: 3` con `created_at desc`, y
Servicios filtra por tipo antes de contar. Así que **tres** servicios a
convenir más nuevos que el seed alcanzan para que Servicios no tenga una sola
tarjeta comprable, y el caso acusaba al producto de no ofrecer la puerta.

Reproducción del rojo viejo. Publiqué por API tres servicios a convenir y
después un producto comprable —así Inicio conserva una tarjeta comprable entre
las tres más nuevas y el rojo cae sólo donde caía de verdad:

```
los cuatro servicios mas nuevos:
  [["Residuo a convenir 3 …","0.00"],["Residuo a convenir 2 …","0.00"],
   ["Residuo a convenir 1 …","0.00"],["Smoke servicio de estado …","48000.00"]]

[FAIL] 139 — en Servicios ninguna tarjeta ofrece ingresar; los botones son
  ["Solicitar cotización","Ver detalle","Solicitar cotización","Ver detalle",
   "Solicitar cotización","Ver detalle"]
```

El producto estaba intacto. Y el residuo no es hipotético: los casos **120,
147, 148 y 166** publican servicios a convenir, así que aparece con sólo correr
la suite dos veces sobre la misma base.

Ahora el caso publica por API un activo y un servicio comprables con nombres
únicos suyos —`Puerta139 activo <sello>` y `Puerta139 servicio <sello>`— y
busca **esas** tarjetas por título exacto en las tres pantallas: el activo en
Inicio y Mercado, el servicio en Servicios. No mira posiciones. Con exactamente
el mismo residuo que ponía rojo al arnés viejo:

```
[PASS] 139 — … Sobre dos publicaciones propias del caso («Puerta139 activo …»
  en Inicio y Mercado, «Puerta139 servicio …» en Servicios, buscadas por título
  exacto y no por posición) … (Inicio:«Agregar al carrito»,
  Mercado:«Agregar al carrito», Servicios:«Contratar»)
```

Los rótulos que recorre el navegador son los mismos que antes, porque publiqué
el producto como **activo** y no como insumo: si lo hubiera publicado insumo, el
caso habría dejado de ejercitar «Agregar al carrito» en pantalla sin que
ninguna aserción lo dijera.

**Agregué algo que no me pediste, y te digo por qué.** El caso ahora **retira
sus dos publicaciones al terminar** (baja lógica, `status` DELETED), corra bien
o mal. El motivo: dejarlas vivas le cambia a las pruebas siguientes cuál es la
publicación más nueva, y eso no lo puedo verificar sin correr la suite completa,
que me pediste no correr. Retirándolas la base queda **igual que antes**, que es
el único estado sobre el que puedo afirmar algo sin esa corrida. Medido después
del verde desde base limpia:

```
Puerta139 servicio … -> DELETED
Puerta139 activo   … -> DELETED
activos más nuevos: ["Smoke producto agotado …","Smoke servicio de estado …",
                     "Campo Agrícola de 120 Hectáreas"]
```

Es además la otra mitad de la misma deuda: un caso que no quiere heredar
residuo tampoco debería dejarlo.

### 2. Caso 143 — la base es la precondición, no la evidencia

El PATCH deja el estado escrito en la base **antes** de que termine el GET de
`/products/my` que redibuja la tarjeta, y `reloadUserProducts` no marca nada
como cargando: la lista vieja se queda en pantalla mientras el pedido viaja.
Esperar la base y leer la tarjeta enseguida es leer el render anterior.

Reproducción del rojo, con la respuesta de `/products/my` posterior al PATCH
demorada 4 s de forma controlada:

```
[FAIL] 143 — despues de pausar: la tarjeta no dice «Pausado»:
  «Activo SERVICIO Smoke servicio de estado … $ 48.000 Por hectárea 0 0
   Editar Pausar»   (2251 ms)
```

La base ya decía `PAUSED`. El arnés leyó 2,2 s después de empezar: no esperó
nada, llegó antes que el producto.

La base queda como precondición y ahora se espera además **la condición que el
caso va a afirmar**: que la tarjeta diga «Pausado»/«Activo» **y** ofrezca la
acción inversa —que es justamente el botón que se comía el defecto original—.
Con `esperarA`, que pregunta cada 50 ms y se rinde a los 20 s: sin esperas
fijas. No aflojé ninguna aserción de anatomía, modalidad, stock ni el control
agotado. Con la misma demora de 4 s:

```
[PASS] 143 — … (16855 ms)
```

Los 16,9 s contra los 2,2 s del rojo son la demora esperada dos veces, una por
pausar y otra por reactivar: esperó de verdad.

### 3. Que los verdes nuevos todavía puedan ponerse rojos

Un arnés que ya no se rompe con el residuo podría no romperse tampoco con el
defecto. Rompí el producto a propósito, en el árbol de trabajo y sin commitear:

| Sabotaje del producto | Lo que dijo el caso nuevo |
| --- | --- |
| `ProductCard` sin el rótulo sin sesión | **`[FAIL] 139`** en Inicio la tarjeta de «Puerta139 activo …» no ofrece ingresar; sus botones son `["Agregar al carrito","Ver detalle"]` |
| botón de activar escondido en lo pausado | **`[FAIL] 143`** la tarjeta no llegó a decir «Pausado» con su botón «Activar» en 20 s, con la base ya en PAUSED; lo último que mostró fue «Pausado SERVICIO … Editar» |

El segundo es el defecto original textual —la publicación pausada sin forma de
reactivarse— y el mensaje lo nombra. Los dos sabotajes están revertidos: el
diff de `src/` y `backend/` está vacío.

### Compuertas

- **139 + 143 juntos desde base limpia (`--recrear`): 2/2**, salida 0.
- `node --check scripts/smoke.mjs`: verde.
- `git -c core.whitespace=cr-at-eol diff --check`: verde.
- Diff de `src/` y `backend/`: vacío. Un solo archivo tocado, `scripts/smoke.mjs`.
- No corrí suite completa, otros casos, build, lint, a11y, contraste ni
  capturas, como pediste.

### Lo que queda dicho y no arreglado

- **No medí el efecto sobre los otros 165 casos**, porque la corrida completa
  no estaba en el alcance. El retiro de las dos publicaciones es exactamente
  para que ese efecto sea nulo por construcción y no por confianza: la base
  queda como estaba. Si querés la prueba y no el argumento, la suite completa
  desde base limpia es la única forma, y te la corro cuando digas.
- **El caso 143 sigue dejando residuo**: su servicio comprable y su producto
  con stock 0 quedan publicados. El producto con stock 0 es residuo del mismo
  tipo que el que rompía al 139. Lo informo y no lo toco: estabilizar el 143 era
  la espera, no su limpieza, y hacerle lo mismo que al 139 es una decisión tuya.
- **Hay más casos que toman «la primera tarjeta»** después del 139 —140, 155,
  156, 166, 167—. No los medí ni los toqué: no estaban en el alcance. Nombro
  dónde está la familia, no afirmo que estén rotos.
- Sigue en pie el 131, rojo permanente por entorno.
- Y sigue esperando tu palabra lo del carrito sin sesión: hoy, alguien con la
  sesión confirmada inválida pierde la celda «Carrito» de la cabecera y no
  puede reabrir un carrito que cerró.

`COPY-CLEAR-1` no lo empecé.

---

## FILTER-INTENT-1R3 — dije «red, timeout y 5xx» y sólo había medido 5xx

**Resultado: los tres puntos corregidos. El primero desmiente algo que escribí
en el informe anterior, y esa parte es lo que más me importa dejar anotado.**

- Producto/regresión: `fa4446a`
- **En mi rama, no en `main`.** No integré, no desplegué, no toqué Backend,
  endpoint, router, dependencia, rediseño, Railway, datos remotos, pagos ni
  secretos.

---

### 1. La afirmación era mía y no estaba medida

En el informe de R2 escribí que `indisponible` cubría «5xx, red, timeout». Medí
5xx. La red no la medí nunca, y no funcionaba:

| Escenario | tokens antes | tokens después | capas |
| --- | --- | --- | --- |
| `/auth/me` abortado al apretar «Continuar compra» | `["access_token","refresh_token"]` | **`[]`** | **`["Ingresar"]`** |
| access vencido + `/auth/refresh` en 429 | `[...]` | **`[]`** | **`["Ingresar"]`** |
| arranque con `/auth/me` interrumpido | `[...]` | **`[]`** | — |

El mecanismo: `fetch` rechaza con un `TypeError`, que **también** es un `Error`,
y el `catch` de `apiFetch` relanzaba cualquier `Error` sin tocarlo. El motivo se
perdía por el camino y más adelante se leía como sesión vencida. Es el defecto
que la pieza vino a cerrar, sobreviviendo por el camino que no probé — y es el
más común de los dos: en el campo la conexión se corta bastante más seguido que
lo que se cae un servidor.

Va como regla y no como caso: **el contrato lo fija la medición, no el
comentario.** Si escribo tres palabras en una lista, las tres tienen que tener
su rojo.

### 2. Decidir por el «sí» explícito, no por descarte

`asegurarSesion` contaba como sesión vencida **todo lo que no fuera**
`indisponible`. Con esa forma, alcanza con que un error se escape sin clasificar
—uno solo, en cualquier rama futura— para volver a cerrar sesiones que estaban
bien. Ahora hay que decirlo para que cuente, y lo único que lo dice es el
servidor:

- `sesion-vencida` → tira credenciales. Nada más lo hace.
- cualquier otra causa, o un error sin causa → `indisponible`.

Y `refreshAccessToken` rechaza **sólo** ante 401/403. La regla anterior era «del
500 para arriba es una caída», así que **408 y 429 tiraban las credenciales**, y
son justamente los dos estados que aparecen cuando el otro lado está
sobrecargado, no cuando la sesión venció.

### 3. El arranque, que es el peor momento

`loadCurrentUser` borraba ante cualquier error. Abrir el sitio con la conexión
floja, o con el Backend todavía levantando, dejaba a alguien afuera de su propia
sesión sin haber hecho nada, y con el refresh bueno tirado a la basura. Ahora usa
la misma causa tipada.

Medí además una cosa que la PM no pidió, porque conservar credenciales sólo vale
si sirven: **con la conexión de vuelta, la sesión se recupera sola** —cabecera
con «Vender», «Carrito (1)», el nombre y «Salir»— y el carrito queda intacto.
Eso está en el caso, con su propio mensaje.

### 4. Los negativos: rojos por comportamiento contra `a834ec3`

| Se devolvió al estado de `a834ec3` | El 167 dijo |
| --- | --- |
| el `TypeError` de la red vuelve sin causa | «la conexión cortada terminó ofreciendo ingresar: que no haya respuesta no dice nada de la sesión, y tratarlo como un vencimiento cierra sesiones que estaban bien» |
| sólo del 500 para arriba es indisponible | «un 429 del refresh terminó ofreciendo ingresar, con el refresh token todavía bueno: sólo un rechazo explícito de la credencial es un rechazo» |
| el arranque borra ante cualquier error | «arrancar sin conexión destruyó las credenciales: ["access_token","refresh_token"] -> []» |

**El segundo daba verde al principio, y el motivo vale la pena.** Mi escenario
del refresh usaba 503, que es `>= 500` y por lo tanto «indisponible» **en las dos
versiones**: el caso no distinguía la regla vieja de la nueva. Ahora prueba dos
estados, y el que discrimina es el 429 —un servidor pidiendo que esperes, no una
credencial rechazada—. Es la segunda vez en esta pieza que un negativo mío no
separaba las dos versiones; la lección es la misma que arriba: elegir el
escenario donde las dos reglas **difieren**, no uno donde ambas aciertan.

### 5. Puertas

- **167 desde base limpia: 1/1.**
- `lint`, `tsc --noEmit`, `node --check scripts/smoke.mjs` y
  `git -c core.whitespace=cr-at-eol diff --check`: verdes. El smoke incluye
  build. Sin otros casos y sin suite completa, como pediste.

### 6. Sigue abierto

- Lo que ya informé y no cambió: sin sesión la cabecera no dibuja la celda
  «Carrito», así que quien cierre el carrito sin ingresar no tiene desde dónde
  reabrirlo. Mostrarlo sin sesión es decisión de producto y sigue esperando tu
  palabra.
- El **143** y el **139** como arneses frágiles —dependen de un estado que no
  fabricaron—, el 131 ambiental, la deuda de paginación mayor a cien y
  `--tg-color-focus` igual a `--tg-color-brand`.

---

## FILTER-INTENT-1R2 — el arreglo anterior era peor que el defecto

**Resultado: los tres puntos corregidos. El primero lo introduje yo la vuelta
pasada, y era peor que lo que venía a arreglar.**

- Producto/regresión: `a834ec3`
- **En mi rama, no en `main`.** No integré, no desplegué, no toqué Backend,
  endpoint, router, dependencia, rediseño, Railway, datos remotos, pagos ni
  secretos.

---

### 1. Lo que rompí, medido

`asegurarSesion()` atrapaba **cualquier** error de `/auth/me`. Con el Backend
respondiendo 503:

| | antes de apretar | después de apretar |
| --- | --- | --- |
| capas | `["Mi carrito"]` | **`["Ingresar"]`** |
| tokens en `localStorage` | `["access_token","refresh_token"]` | **`[]`** |
| carrito | 1 ítem | 1 ítem |

Una caída de dos segundos le cerraba la sesión a alguien que la tenía
perfectamente válida, y encima con un diagnóstico inventado. Peor que el
callejón que la pieza venía a arreglar, porque parece deliberado.

**Y el mismo defecto estaba un nivel más abajo, por otro camino.** Con el access
vencido —legítimo— y `/auth/refresh` respondiendo 503, `refreshAccessToken`
también tiraba los dos tokens: se perdía un refresh perfectamente bueno.
Medido igual, y arreglado en el mismo lugar.

### 2. Tres resultados, no dos

| Estado | Qué pasó | Qué hace |
| --- | --- | --- |
| `vigente` | contestó que sí, o se renovó en el camino | sigue al Checkout |
| `sin-sesion` | **confirmado**: el servidor dijo que no vale | tira credenciales, baja identidad, ofrece ingresar |
| `indisponible` | no se pudo preguntar (5xx, red, timeout) | **no toca nada** y lo explica |

El motivo ahora viaja **aparte del texto** del error (`ErrorDeLaApi.causa`).
Antes había que buscarle frases al mensaje para distinguirlos, que es justo el
riesgo que la auditoría dejó anotado: una pantalla que decide leyendo cómo está
redactado un mensaje se rompe el día que alguien lo mejora.

Las credenciales se tiran **sólo** cuando el servidor contestó que no valen.

### 3. Indisponible conserva y explica

Medido con el Backend caído de verdad —la respuesta se reemplaza en el
navegador—, no rompiendo el token, porque el punto es que un token bueno no se
toque:

- el carrito sigue abierto, con su ítem a la vista;
- `access_token` y `refresh_token` quedan **iguales**, comparados antes y después;
- la cabecera queda **igual**: no se baja a nadie;
- no se abre ni Login ni Checkout;
- el aviso dice *«No pudimos comprobar tu sesión en este momento. Tus productos
  siguen acá: probá de nuevo en unos segundos.»* — el caso exige que **no**
  diga «expiró» ni «venció»;
- y al volver el servidor, **el mismo botón** alcanza: reintenta y sigue.

Lo mismo, por separado, para la caída del refresh.

El aviso vive en la capa y no en un cartel que se va solo: quien lo necesita
leer está mirando justo eso, y el botón que reintenta está al lado. Contraste
medido: 5,64:1.

### 4. Irrecuperable baja la identidad, sin vaciar el carrito

`sesionInvalidada()` baja identidad y credenciales y **no toca el carrito**. No
reusa `logout()` a propósito, y no es duplicar Auth: `logout` es *irse* —avisa
al servidor y vacía el carrito, que es lo que corresponde cuando alguien cierra
su sesión—. Acá no se fue nadie: la credencial venció mientras la persona miraba
lo que había elegido.

Tras cancelar el Login, la cabecera pasa de
`["Vender","Carrito (1)","María Cliente","Salir"]` a `["Ingresar"]`, y el
carrito conserva su ítem.

**Esto me obligó a un cambio que no había previsto y lo digo porque importa.**
`CartModal` tenía su propia guarda con `isAuthenticated`: sin sesión avisaba y
no hacía nada. Nunca se alcanzaba —sin sesión la cabecera ni dibuja la celda del
carrito—, pero apenas la identidad empezó a bajarse, pasó a alcanzarse **justo
en el peor momento**: después de cancelar el ingreso, «Continuar compra» habría
dejado de funcionar para siempre en vez de poder reintentarse. La saqué: quién
decide si se puede seguir es una sola pieza, y no es el carrito. Además miraba
el dato equivocado —`isAuthenticated` dice lo que se sabía al entrar—.

### 5. Los negativos: rojos por comportamiento contra `fbdd88f`

| Se devolvió al estado de `fbdd88f` | El 167 dijo |
| --- | --- |
| cualquier error de `/auth/me` se toma por sesión vencida | «una caída del servidor terminó ofreciendo ingresar: un 503 no dice nada de la sesión, y tratarlo como un vencimiento cierra sesiones que estaban bien» |
| el refresh tira los tokens ante un 503 | «un 503 del refresh terminó ofreciendo ingresar, con el refresh token todavía bueno» |
| se tiran las credenciales y la cabecera sigue afirmando sesión | «con la sesión confirmada inválida la cabecera sigue afirmando que hay una: "AgroBoeda \| Vender \| Carrito (1) \| María Cliente \| Salir…"» |

**Dos cosas que me obligaron a corregir el caso, no el producto:**

El segundo negativo **daba verde**. Mi escenario tumbaba `/auth/me` directamente,
así que el camino del refresh no se ejercía nunca: hacía falta su propio
recorrido —access vencido de verdad y `/auth/refresh` en 503—. Sin eso, el caso
no veía la mitad del defecto que dice cubrir.

Y el primero era rojo pero **nombraba mal el defecto**: decía «el carrito no
explicó nada» cuando lo que había pasado era que ofreció ingresar. Yo esperaba
sólo la explicación, así que «decidió mal» se leía como «no decidió». Ahora se
espera a que el producto decida **algo** y recién ahí se mira **qué** decidió.
Un rojo que nombra mal el defecto manda a arreglar lo que no es.

### 6. Puertas

- **167 desde base limpia: 1/1.**
- `lint`, `tsc --noEmit`, `node --check scripts/smoke.mjs` y
  `git -c core.whitespace=cr-at-eol diff --check`: verdes. El smoke incluye
  build. Sin 138, sin 139 y sin suite completa, como pediste.
- `src/types/index.ts`: 10 líneas de diff, sin tocar terminadores.

### 7. Consecuencia conocida de bajar la identidad

Cuando la sesión se confirma inválida, la cabecera deja de dibujar la celda
«Carrito». El carrito abierto **no** se cierra —por eso cancelar devuelve a él
con sus ítems, y por eso el botón reintenta—, pero si la persona lo cierra sin
ingresar, no tiene desde dónde reabrirlo hasta que ingrese. Es el mismo
comportamiento que ya tenía cualquiera sin sesión, así que no inventé una
inconsistencia nueva; pero antes esa persona no existía y ahora sí. Mostrar el
carrito sin sesión es una decisión de producto, no un arreglo, y no la tomo
sola: decime si la querés y la hago.

### 8. Sigue abierto

- El **143** como arnés intermitente y el **139** con la misma fragilidad
  —dependen de un estado que no fabricaron—, ya medidos y registrados.
- El 131 ambiental, la deuda de paginación mayor a cien y `--tg-color-focus`
  igual a `--tg-color-brand`.

---

## FILTER-INTENT-1R — tenías razón: R6 se reproduce, y yo medí la pregunta equivocada

**Resultado: los tres puntos corregidos. El primero es un error mío de método y
quiero empezar por ahí.**

- Producto/regresión: `fbdd88f`
- **En mi rama, no en `main`.** No integré, no desplegué, no toqué Backend,
  endpoint, router, dependencia, almacenamiento nuevo, rediseño, capturas,
  Railway, datos remotos, pagos ni secretos.

---

### 1. Me equivoqué, y no en el dato: en la pregunta

R6 dice «sesión vencida con carrito abierto no ofrece Login». Yo medí **el
mecanismo que me había imaginado** —«¿aparece el aviso de `CartModal` sin
Login?»— comprobé que esa rama no se alcanza, y declaré refutado el borde. Pero
el síntoma que R6 describe no es esa rama: es que la persona quede en un
callejón. Y eso lo tenía **escrito en mi propio informe** —«el Checkout después
falla con "Sesión expirada"»— y lo clasifiqué como «otra cosa».

No era otra cosa. Era R6 una pantalla más tarde, que es peor: llega con el
trabajo ya hecho. Lo reproduje de punta a punta:

> Con el carrito abierto y la sesión ya vencida, «Continuar compra» abre el
> Checkout. Adentro: **Envío → Pago → Órdenes**, con Nombre, Teléfono,
> Provincia y Localidad para completar, y un botón «Continuar al pago». Ninguna
> capa de ingreso. El «Sesión expirada» aparece recién después.

Tu frase —«que el fallo aparezca una pantalla después no refuta R6»— es
exactamente lo que yo no vi. Anotado como regla, no como caso: **refutar un
borde es refutar su síntoma, no el mecanismo que uno le supuso.**

### 2. Y buscando el arreglo apareció algo peor, que también está medido

Para comprobar la sesión con el mecanismo existente encontré que **el refresh
recuperable no se recupera nunca**. La regla del reintento era «ningún
`/auth/`», y se lleva puesto a `/auth/me`, que es el **único** de esa familia
que lleva sesión. Resultado, medido:

> Entrar, vencer **sólo** el access token —el refresh sigue siendo el bueno— y
> recargar: la cabecera queda en «Ingresar» y `localStorage` sólo conserva
> `agromarket_cart`. Los dos tokens se tiraron, con el refresh válido adentro.

Es decir: cada vez que a alguien se le vencía el access token, se le cerraba la
sesión aunque tuviera con qué renovarla. Ahora la lista dice cuáles no se
reintentan **y por qué**: `login` y `register` contestan por la credencial que
se acaba de escribir, `refresh` sería morderse la cola, y los de verificación se
piden sin sesión. En todos ésos, renovar no cambia la respuesta —y reintentar sí
cambiaría el mensaje: «Email o contraseña incorrectos» se volvería «Sesión
expirada», que no es lo que pasó. Eso está medido aparte, en el punto 3.

Después de eso: entrar, vencer sólo el access y recargar deja la cabecera con
«Vender», «Carrito» y el nombre. La persona no se entera.

### 3. La puerta, medida en los dos casos por separado

`asegurarSesion()` pregunta por la sesión en vez de mirar el token —tener un
token guardado no es tener sesión— y si no se puede recuperar tira las
credenciales muertas. Se llama «asegurar» y no «consultar» porque escribe.

| Escenario | Qué hace | Carrito |
| --- | --- | --- |
| access vencido, refresh válido | renueva y abre el Checkout, **sin pedir nada** | intacto |
| sesión irrecuperable | abre el Login real, **no** abre el Checkout | intacto |
| cancelar | vuelve al carrito, con su ítem a la vista | intacto |
| credencial fallida | no avanza; el motivo sigue siendo «Email o contraseña incorrectos», **no** «Sesión expirada» | intacto |
| credencial buena | abre el Checkout **una vez**, sin volver a apretar «Continuar compra» | intacto |

Escrituras comerciales durante todo el recorrido: **ninguna**. Ni orden, ni
reserva, ni pago. El caso lo mira por pedido saliente, no por confianza.

Que la persona entró se lee del token y no de `isAuthenticated`, que es
justamente lo que acabamos de probar que miente.

### 4. El mismo A9, cerrado donde faltaba

- **`AboutPage`** entra por `pedirPublicar`, como Inicio y Servicios, y ahora
  además **dice por qué aparece el ingreso**: no tenía aviso ninguno. Está en el
  recorrido del 167, así que no puede volver a quedarse atrás sola.
- **`AddProductModal`** deja el último tuteo del camino.

### 5. Los negativos: el caso falla contra `0a6cbd4`, y por lo que tiene que fallar

| Se devolvió al estado de `0a6cbd4` | El 167 dijo |
| --- | --- |
| el Checkout abre sin comprobar la sesión | «con la sesión vencida no se ofreció ingresar; lo que hay abierto es ["Checkout"]» |
| `/auth/me` vuelve a quedar fuera del reintento | «con el access vencido y el refresh válido no se llegó al Checkout: la sesión se podía renovar sin molestar a nadie» |
| Quiénes somos vuelve al Login sin continuidad | «el aviso del CTA 1 de about no es "Iniciá sesión para publicar una oferta": ""» |

Los dos primeros rojos empezaron siendo un `locator.waitFor: Timeout` pelado,
que dice «se venció» y nada más. Lo cambié: cuando una capa no aparece, el
mensaje ahora dice **qué apareció en su lugar**, que es justamente el defecto
que se está midiendo. Un rojo que no nombra lo que vio no sirve para arreglar
nada.

### 6. Puertas

- **138, 139 y 167 aislados: 3/3**, desde base limpia.
- `lint`, `tsc --noEmit`, `node --check scripts/smoke.mjs` y
  `git -c core.whitespace=cr-at-eol diff --check`: verdes. El smoke incluye
  build. Sin suite completa, como pediste.

**Un aviso sobre esos aislados**, porque la primera corrida me dio 139 en rojo y
no quiero que te pase sin explicación: *«en Servicios ninguna tarjeta ofrece
ingresar; los botones son ["Solicitar cotización", …]»*. No era mi cambio: era
la base arrastrada de la suite anterior. Los cuatro servicios activos más nuevos
—los que dejaron los casos 147, 148 y 151— tienen precio `0.00`, así que la
vista previa de Servicios mostraba tres publicaciones a cotizar y ninguna
comprable. Recreé la base y quedó verde. Es el mismo defecto de fondo que el
143: **un caso que da por hecho un estado que no fabricó**. No lo toco: el 143
ya quedó para el cierre corto siguiente y éste es su vecino.

### 7. Límite conocido de lo que entregué

Cuando la sesión resulta irrecuperable, tiro las credenciales pero **no bajo el
usuario de React**: la cabecera sigue mostrando el nombre hasta que la persona
ingresa de nuevo o recarga. Lo elegí así a propósito, porque el camino que sí
baja el usuario —`logout()`— **vacía el carrito**, y vos pediste explícitamente
que cancelar devuelva al carrito con sus ítems. Que la presencia de sesión tenga
una sola fuente es un cambio más grande que esta pieza; lo dejo dicho y no lo
hago acá.

### 8. Sigue abierto

- El **143** como arnés intermitente, con su mecanismo ya descripto: espera a la
  base y lee la pantalla, y la pantalla necesita un segundo viaje.
- El **139** con la misma familia de fragilidad, recién medida.
- La rama sin sesión de `CartModal.handleCheckout` sigue sin alcanzarse —sin
  sesión la cabecera ni dibuja la celda del carrito—, pero ya no hay callejón
  que dependa de ella.
- El 131 ambiental, la deuda de paginación mayor a cien y `--tg-color-focus`
  igual a `--tg-color-brand`.

---

## FILTER-INTENT-1 — el vacío que nadie midió, y la intención que se perdía en el Login

**Resultado: A6 y A9 cerrados. R6 NO se reproduce y por eso no está en el caso
167 — está medido en el punto 4.**

- Producto/regresión: `0a6cbd4`
- **En mi rama, no en `main`.** No integré, no desplegué, no toqué Railway,
  datos remotos, pagos ni secretos. No agregué router, dependencia,
  almacenamiento de intenciones, Auth, Backend ni endpoint.

---

### 1. La URL inválida ya no inventa un mercado vacío (A6)

Reproducido primero, antes de tocar nada, contra `1a01854`:

| URL | consultas al catálogo | qué se veía | barra |
| --- | --- | --- | --- |
| `?section=marketplace&category=NoExiste` | **0** | «No hay operaciones con estos filtros» | el parámetro inválido se quedaba |
| `?section=marketplace&province=Narnia` | **0** | idem | idem |
| `+ type=servicios&in_stock=true` | **0** | idem | los válidos también se quedaban, sin usarse |

Cero consultas. La pantalla contestaba por una API a la que nadie preguntó, y
recargar o compartir el enlace repetía la mentira.

Ahora el Mercado espera a saber qué filtros existen, suelta **sólo** el que no
existe —lo que además lo borra de la barra, porque el hook de filtros serializa
su estado; no hay un segundo escritor del historial—, conserva los válidos y
consulta:

| URL de entrada | barra al terminar | resultado |
| --- | --- | --- |
| `category=NoExiste&province=<real>&in_stock=true` | `province=<real>&in_stock=true` | la respuesta real de la API |
| `province=Narnia&category=<real>&type=<real>` | `category=<real>&type=<real>` | idem |

La localidad se va con su provincia, y quiero que quede dicho por qué, porque es
lo único que descarto de más: no es un filtro aparte, es un lugar **adentro** de
la provincia que se descartó. Sin provincia el selector de localidades no tiene
nada que ofrecer, así que `locality_id` quedaría filtrando por algo que no se ve
y no se puede sacar —peor que el vacío falso—. Es exactamente lo que ya hace
cambiar de provincia a mano.

**Con el catálogo auxiliar caído** no se valida nada: sale el aviso «No pudimos
cargar los filtros del mercado…» con Reintentar, el filtro **no** se descarta
—no se descarta lo que no se pudo validar— y no sale ninguna consulta. Antes las
listas quedaban vacías en silencio, así que *todo* filtro parecía inexistente y
la pantalla mostraba un mercado sin filtrar como si fuera lo que se pidió.

**Y hay algo que mi propia sonda no vio.** Mi primera versión enumeraba los
momentos de espera —catálogos en camino, filtro en descarte—. El caso 167 la
puso roja: entre soltar el filtro y salir la consulta hay **un render** donde ya
no se está decidiendo nada y todavía no se está cargando nada, porque los
efectos corren después de dibujar, y ahí la lista vacía volvía a leerse como «no
hay». Mi sonda con esperas de cuatro segundos no lo veía; el observador de
mutaciones del caso sí. Ya no se enumeran momentos: se compara la consulta
vigente con la contestada, así que cualquier hueco nuevo es espera por
construcción.

### 2. Publicar retoma después de ingresar (A9)

Los CTA de publicación de Inicio y de Servicios usan **la misma puerta** que ya
usaban la tarjeta y el detalle. No hay un segundo Login ni un segundo camino al
formulario: la página dejó de decidir entre «abrí el formulario» y «abrí el
Login» —eso no lo sabe la página, lo sabe la sesión, y lo sabría un instante
antes de que el ingreso la cambie—.

Medido, para **cada** CTA de cada pantalla —el caso los cuenta y los recorre a
todos, así que si mañana aparece otro entra solo—:

- sin sesión abre el Login real, con el aviso en voseo: **«Iniciá sesión para
  publicar una oferta»** / **«…un servicio»**;
- cancelar vuelve a la pantalla, no abre el publicador **y no dice nada**;
- credencial fallida: no abre el publicador y el Login queda;
- credencial buena, en el mismo Login: el publicador se abre **una vez**, sin un
  segundo clic;
- ir a Registro y volver conserva la intención;
- el alta de verdad no abre sesión ni el publicador por sí sola;
- después de cancelar, un ingreso genérico desde la cabecera queda genérico.

Y del lado de los efectos: ingresar no publica, no crea órdenes, no reserva
stock y no toca el carrito. Comparado contra la base —publicaciones, órdenes,
suma de stock— y contra todo pedido de escritura que salió del navegador.

### 3. Los negativos: cada aserción se vio roja

| Se rompió | El 167 dijo |
| --- | --- |
| vuelve el `return` sin consultar | «no salió ninguna consulta al catálogo» |
| el filtro inválido no se descarta | «no salió ninguna consulta al catálogo» |
| el descarte se lleva también los válidos | «se perdió el filtro válido category=Insumos agrícolas» |
| el catálogo caído se toma por catálogo vacío | el aviso de fallo nunca aparece |
| publicar vuelve al Login sin continuidad | el publicador nunca se abre |
| se retoma sin mirar si la persona entró | «cancelar el ingreso en home dijo algo» |
| el aviso vuelve al tuteo | «no es "Iniciá sesión para publicar una oferta"» |
| la intención queda pegada | «un ingreso genérico posterior heredó la publicación cancelada» |

**Uno de esos negativos me costó el caso dos veces**, y es el mismo error que ya
cometí antes: dar por bueno un verde sin haberlo visto rojo.

Quitarle a mi propia pieza la condición de «sólo si entró» daba **VERDE**.
Primero porque miraba el publicador cuando a mí se me ocurría mirar, y
`AddProductModal` tiene su **propia** guarda: sin sesión avisa y se cierra sola,
así que un publicador abierto indebidamente aparece y desaparece en el mismo
suspiro. Puse un observador de mutaciones sobre el publicador: **seguía verde**,
porque esa guarda decide **durante su render** y no deja ni un nodo en el
documento. Lo único que queda es el aviso que tira al cerrarse. Con los avisos
vigilados —y con el aviso anterior sacado de pantalla antes de contar, porque
mientras sigue dibujado cada mutación lo vuelve a registrar— el negativo quedó
rojo: *«cancelar el ingreso en home dijo algo: ["ATENCIÓN Debes iniciar sesión
para publicar productos ×"]»*.

### 4. R6 no se reproduce, y no le agregué nada al caso

Lo medí en este mismo entorno, por los dos caminos posibles:

**a) La sesión deja de valer y se recarga.** `/auth/me` responde 401 y el
reintento con refresh se saltea para `/auth/`, así que los tokens se limpian y
la sesión queda cerrada. **El carrito sobrevive** —`agromarket_cart`, un ítem
antes y un ítem después—. Pero sin sesión la cabecera no dibuja la celda
«Carrito»: quedan «AgroBoeda», «Ingresar» y las cinco secciones. **No hay
carrito que abrir ni «Continuar compra» que apretar**, y el borde descrito
necesita ese botón.

**b) La sesión deja de valer con el carrito ABIERTO, sin recargar.** Nada
revalida el token, así que `isAuthenticated` sigue en verdadero y «Continuar
compra» **abre el Checkout** como siempre. Ni aviso sin salida ni Login
faltante: lo que hay ahí es otra cosa —el Checkout después falla con «Sesión
expirada»—, y no es lo que R6 describe.

Es decir: la rama sin sesión de `CartModal.handleCheckout` —la que avisa «Debes
iniciar sesión para continuar con la compra» y no ofrece nada— **no se alcanza
hoy por ningún camino del producto**. No la toqué: no hay rojo que lo
justifique, y agregarle al 167 aserciones sobre un borde que no reproduje sería
exactamente lo que no hay que hacer. Queda informado como deuda, con su
mecanismo.

### 5. Lo que el caso 167 NO distingue

La intención se limpia en dos lugares: `cerrarAutenticacion` la borra antes de
llamarla, y `abrirLogin` la borra al abrir un ingreso genérico. **Cada uno solo
alcanza.** Lo medí: saqué uno, verde; saqué el otro, verde; saqué los dos, rojo.
Así que el caso comprueba que la propiedad se sostiene, pero **no distingue cuál
de las dos limpiezas la sostiene**: si mañana alguien saca una, el 167 no se va
a enterar. Sostengo las dos por corrección —una cubre cancelar, la otra cubre
entrar por otro lado— y no porque mi caso las separe.

### 6. Puertas, con el número exacto

- 138, 139, 147 y 167 aislados: **4/4**.
- Suite completa desde base limpia, **dos veces**:
  - primera: **165/167**, rojos 131 y 143;
  - segunda: **166/167**, único rojo 131.
- `lint`, `tsc --noEmit`, `node --check scripts/smoke.mjs` y
  `git -c core.whitespace=cr-at-eol diff --check`: verdes. El smoke incluye
  build. Sin `compileall`, `pip check`, a11y ni contraste: no toqué Backend ni
  presentación.

**El 143 es intermitente y te lo digo con el mecanismo, no como «se destrabó».**
Rojo en la primera corrida, verde en la segunda y verde aislado. No toqué
`UserDashboard` ni `/products/my`. La causa está en el caso: pausar hace
`PATCH /products/{id}` y **después** `GET /products/my` para redibujar, y el 143
espera a que **la base** diga `PAUSED` y lee la tarjeta enseguida. La base
cambia con el PATCH; la tarjeta, recién con el GET. Con la suite entera
corriendo el segundo viaje llega más tarde y el caso lee el texto viejo:
*«despues de pausar: la tarjeta no dice «Pausado»: "Activo SERVICIO …"»*. El
arreglo es esperar la **condición que se afirma** —que la tarjeta diga
«Pausado»— con la base como precondición, no en lugar de ella. No lo hice acá
porque es otro caso y otra pieza; decime si lo querés y lo cierro.

### 7. Fuera de alcance: lo informo, no lo arreglo

- **`AboutPage` tiene el mismo defecto de A9 que acabo de arreglar.** Su CTA de
  vender hace `isLoggedIn ? onOpenSellModal() : onOpenLogin()` —el Login sin
  continuidad— y encima sin aviso. Pediste Inicio y Servicios y no lo amplío: el
  arreglo es pasarle `pedirPublicar` en lugar del par
  `onOpenSellModal`/`onOpenLogin`, una línea, y sumarlo al recorrido del 167.
- **Queda un aviso en tuteo en el producto**: `AddProductModal` dice «Debes
  iniciar sesión para publicar productos» en su guarda defensiva. Con esta pieza
  ya no se alcanza desde Inicio ni Servicios —la puerta no abre el publicador
  sin sesión—, pero el texto sigue ahí y es el único tuteo que queda en este
  camino.
- Siguen abiertas: la deuda de paginación mayor a cien, `--tg-color-focus` igual
  a `--tg-color-brand`, y el 131 como limitación ambiental conocida.

---

## QUOTE-CONTACT-1R — asunto, ayuda, identidad y un diff que había ensuciado

**Resultado: corregido, con una salvedad que te debo decir (punto 5).**

- Producto/regresión: `1a01854`
- **En mi rama, no en `main`.** No integré, no desplegué.

---

### 1. Asunto completo

El asunto precargado —el visible y el `subject` codificado del `mailto:`— nombra
la publicación y al vendedor. Antes decía «Solicitud de cotización» a secas y
los nombres vivían sólo en el cuerpo: del otro lado había que abrir el mensaje
para saber de qué se trataba. La opción del selector se dibuja **únicamente**
cuando hay cotización; sin ella no hay nada que nombrar.

Medido rojo: *«el asunto visible no nombra publicación y vendedor: "Solicitud de
cotización"»*.

### 2. La ayuda, neutral de verdad — y el falso negativo era mío

Se fueron las dos frases. Tenés razón en las dos cosas, y la segunda es peor que
la primera.

`/\bse abrió\b/i` **no detecta nada**: en una expresión regular de JavaScript
`\b` se apoya en `\w`, que es ASCII, así que después de una «ó» no hay borde de
palabra y el patrón no casa jamás. Mi caso decía prohibir una frase que no podía
ver, y por eso la frase entró igual. Ahora la comparación es textual, sobre el
texto en minúsculas, con las variantes con y sin acento.

Medido rojo volviendo a poner la frase: *«la pantalla afirma un resultado que no
puede conocer: dice "se abrió"»*.

### 3. Identidad estable

La intención y la `key` identifican la publicación por su **ID interno**. Un
título no es un identificador: el mismo servicio ofrecido por dos personas
existe y es normal. El ID no se muestra en el mensaje.

### 4. El diff que había ensuciado

Al agregar el tipo reescribí `src/types/index.ts` **entero en modo texto** y
convertí **217 CRLF a LF**, así que el commit anterior presentaba casi todo el
archivo como reemplazado. Restaurado byte a byte desde `612b57f~1` y reaplicado
sólo el bloque: contra el original son **17 líneas** y ninguna otra.

Es exactamente la trampa que avisa el repositorio, y la pisé de la manera más
tonta: leer y escribir en modo texto.

### 5. Lo que NO puedo probar, y prefiero decirlo

El caso recorre dos publicaciones con el mismo nombre y distinto vendedor, y
exige que la segunda reemplace al primero. **Esa afirmación pasa igual con
identidad por ID o por nombre**, así que no distingue el punto 3. Lo medí: puse
la `key` de vuelta en el nombre y el caso quedó verde.

El motivo es que todo camino hacia Contacto pasa por otra sección, y eso
desmonta la pantalla de por sí. La `key` sólo interviene cuando ya se está en
Contacto —el caso del pie, que **sí** está medido: sin `key` el 166 da rojo con
«entrando por el pie el mensaje vino cargado»—. Para distinguir ID de nombre
haría falta un camino que cambie la intención sin desmontar Contacto, y hoy no
existe.

Sostengo el ID por corrección y porque lo pediste, no porque mi caso lo
demuestre. Lo que el bloque nuevo sí mide es que el vendedor de la segunda
publicación reemplaza al de la primera de punta a punta.

### 6. Puertas

Corrí lo que pediste: **166 desde base limpia, 1/1**, más `lint`, `node --check`
y `diff-check`, verdes. El smoke incluye build. Se conservan las comprobaciones
que ya estaban: tarjeta y detalle, Contacto genérico, un solo `mailto:`, valores
intactos, WhatsApp y cero `POST /contact`.

---

## QUOTE-CONTACT-1 — la cotización llega con su publicación, y el correo no miente

**Resultado: terminado. Suite completa 165/166, único rojo el 131 ambiental.**

- Producto/regresión: `612b57f`
- La suite pasa a **166 casos**.
- **En mi rama, no en `main`.** No integré, no desplegué, no ejecuté seed contra
  Railway y no toqué datos remotos, pagos ni secretos. **No toqué Backend.**

---

### 1. Los dos defectos eran el mismo defecto

En los dos casos el producto afirmaba algo que no era cierto.

**El CTA prometía continuidad y no la daba.** «Solicitar cotización» llamaba a
`handleNavigate('contact')` y nada más. La persona llegaba a un formulario en
blanco y tenía que volver a explicar de qué publicación estaba hablando, o
mandar una consulta que del otro lado no se entiende.

**Y el botón decía «Enviar por Email».** Llamaba a `window.open` con un
`mailto:`, declaraba **éxito** y **vaciaba el formulario**. Las tres cosas eran
insostenibles a la vez: `window.open` con un `mailto:` no informa si se abrió un
cliente —devuelve `null` en casos perfectamente normales, y el navegador puede
no tener ninguno configurado—, así que la pantalla afirmaba un envío que nadie
vio y, de paso, borraba lo que la persona había escrito. Si el correo no se
abría, el texto ya no estaba.

### 2. Lo que hace ahora

**La cotización viaja.** El pedido lleva qué se cotiza y a quién, desde la
tarjeta y desde el detalle, en el Mercado, en Inicio y en Servicios. Contacto
nace con el asunto de cotización y un mensaje que nombra a los dos.

Lo que **no** se completa son el nombre, el correo ni el teléfono de quien
escribe. Inventar quién es sería peor que dejarlos vacíos.

**Y el genérico sigue genérico.** Entrar por la cabecera, el pie o cualquier
llamada común limpia la intención; una publicación nueva reemplaza a la anterior
sin mezclarse.

**El correo es honesto.** El botón dice **«Abrir en mi correo»**, prepara el
`mailto:` con la codificación segura de siempre y no afirma nada sobre el
resultado. Lo escrito queda para copiar, corregir, reintentar o mandarlo por
WhatsApp, que hereda el mismo contexto. El cartel posterior es una instrucción
neutral —revisar y enviar desde su aplicación—, no un resultado.

### 3. Un hueco propio que encontró el caso

La primera versión sólo cargaba el formulario al montarse. Estando **ya** en
Contacto la pantalla no se vuelve a montar, así que volver a entrar por el pie
seguía mostrando la publicación anterior aunque la intención ya estuviera
limpia: el punto 2 fallaba por dentro aunque el estado fuera correcto.

Lo encontró el propio caso 166, con el mensaje «entrando por el pie el asunto
vino cargado: "cotizacion"». La `key` de `ContactPage` cuelga ahora de la
intención: cambiar de intención —o dejar de tenerla— es otra pantalla.

### 4. Los cuatro rojos, contra `c88b7ea`

1. `el asunto quedó en "" y tenía que ser el de cotización` — el CTA llega vacío.
2. `el botón no dice «Abrir en mi correo»`.
3. `la pantalla afirma un resultado que no puede conocer: coincide con
   /Enviar por Email/i`.
4. `preparar el correo se llevó puesto lo que la persona había escrito`.

Los tres últimos se midieron salteando de a uno el anterior, para que cada
afirmación se viera fallar por su propio motivo y no por el de más arriba.

### 5. Lo que exige el verde

Desde tarjeta **y** detalle: sección `contact`, asunto de cotización y mensaje
con los nombres exactos leídos de la base —no escritos a mano en la prueba—; los
datos personales vacíos; el mismo mensaje por los dos caminos. Entrada genérica
por el pie: sin herencia. Segunda publicación: reemplaza y no mezcla.
`window.open` interceptado **devolviendo `null`** a propósito, que es el caso en
el que antes se afirmaba éxito igual: un solo `mailto:`, codificado, con
publicación y vendedor; ninguna frase de envío en pantalla; los cuatro campos
intactos. WhatsApp hereda el contexto y tampoco borra nada. Y cero `POST` a
`/contact`.

### 6. Un límite que respeté

No conecté `/contact` aunque exista. Abrir ese canal, operarlo y protegerlo
contra abuso es otra decisión, y el caso 166 lo fija: exige que **no** salga
ningún `POST`. Si alguien lo conecta sin decidirlo, la prueba avisa.

### 7. Puertas

- **Suite completa desde base limpia: 165/166.** Único rojo el **131**: sigue
  necesitando `docker run` y este entorno sólo tiene el puente de `docker exec`.
  No lo toqué ni lo simulé.
- Focales 125, 147, 155 y 166 aislados: **4/4**.
- `lint`, `node --check`, `tsc` y `diff-check`, verdes. El smoke incluye build.
- Sin Backend, `compileall`, `pip check`, a11y/contraste totales ni capturas: el
  diff no salió del límite previsto.

---

## RATING-UX-1R — el 165 mide las tres cosas que antes sólo narraba

**Resultado: corregido.**

- Arnés: `c88b7ea` (sólo `scripts/smoke.mjs`)
- **En mi rama, no en `main`.** No toqué producto, no integré, no desplegué.

---

### 1. Tenías razón, y la primera es la más fea

El `else` guardaba igual un archivo **llamado** `calificacion-dialogo-390x844.png`
—con Mis compras a medio cargar— y lo contaba como una de las tres capturas. Eso
no es una prueba débil: es evidencia fabricada. Un informe que dice «tres
capturas» y una es de otra cosa vale menos que no adjuntar ninguna.

Ahora el diálogo en 390 px se abre **sobre la orden del propio caso** y **antes**
de calificarla, que es lo que lo hace medible —después no hay botón ni capa que
abrir—. Se exige `role="dialog"`, nombre visible, cero desborde del documento y
que la tarjeta entre en los 390 px. Si no abre, el caso falla.

### 2. El envío retenido, y una comprobación mía que no discriminaba

El envío se retiene con un interceptor. Con la solicitud en vuelo: Escape y el
fondo no cierran, Cerrar/Cancelar/Enviar quedan deshabilitados y no sale una
segunda solicitud. Tenías razón en que un clic y esperar a que la capa
desaparezca no prueba nada: la ventana dura milisegundos.

**Y encontré que mi primera versión de esa comprobación daba verde con el
producto roto.** La medí contra el producto sin la guarda del envío: pasó. El
motivo es que, con el comentario escrito, Escape abre la pregunta de cambios sin
guardar y la capa de calificación **sigue visible detrás**, así que «la capa
sigue visible» se cumplía por el motivo equivocado. Ahora se exige además que la
salida no llegue siquiera a esa pregunta. Con eso, el negativo da rojo.

Lo cuento porque es exactamente el falso verde que vos me marcaste en el 160 y
en el 125: la aserción que se satisface por otra cosa.

### 3. El fallo y el reintento

El primer intento se contesta con un fallo controlado: la capa sigue abierta, el
`role="alert"` queda a la vista, el puntaje y el comentario se conservan y los
controles vuelven a estar disponibles. Recién después se deja pasar **un**
reintento real.

El conteo distingue las dos solicitudes deliberadas —una fallada y un reintento—
de una duplicación, y se exige que el intento fallado **no** haya dejado fila: la
base queda con una sola. Se conservan las comprobaciones que ya estaban:
promedio y cantidad, veredicto del servidor en falso y ausencia del botón tras
recargar.

### 4. Los tres rojos

1. **Sin la guarda del envío**: «con la calificación en vuelo, Escape llegó
   hasta la pregunta de salida».
2. **Sin el aviso de error**: el `role="alert"` nunca aparece y la espera se
   agota.
3. **Con la fila de la orden apuntando a un número que no existe**: el bloque de
   390 px falla en vez de capturar cualquier cosa.

### 5. Puertas

Corrí sólo lo que pediste: **165 desde base limpia, 1/1**, `node --check` y
`diff-check`, verdes. Las tres capturas se regeneraron; la de 390 px ahora
muestra el diálogo abierto con sus cinco estrellas. No repetí 149, 150, suite
completa, lint, Backend, a11y ni contraste.

Ninguna aserción nueva reveló un rojo de producto: las tres pasan contra
`96ac68b` sin tocarlo.

---

## RATING-UX-1 — la reputación se ve y calificar es una decisión operable

**Resultado: terminado. Suite completa 164/165, único rojo el 131 ambiental.**

- Producto/regresión: `96ac68b`, más `08256c8` (el caso, ver punto 6)
- La suite pasa a **165 casos**.
- **En mi rama, no en `main`.** No integré, no desplegué, no ejecuté seed contra
  Railway y no toqué datos remotos, pagos ni secretos. **No toqué Backend**: el
  endpoint existente alcanzó.

---

### 1. Los tres defectos, medidos rojos primero

Contra `4182275`:

1. **`la reputación no dibuja ninguna estrella: "5.0"`** — `''.repeat(n)` es una
   cadena **vacía** repetida. La reputación se anunciaba con un número suelto al
   lado de un hueco.
2. **`el selector tiene 0 controles y tienen que ser 5 radios`** — eran cinco
   `span` con `onClick`. Un `span` no recibe foco, no tiene estado y no se
   anuncia: elegir cuántas estrellas darle a alguien era imposible sin mouse.
3. **`después de recargar, «Calificar vendedor» volvió a aparecer`** — el
   veredicto vivía en un `Set` en memoria que se iba con el montaje.

### 2. El identificador: una medición que cambia el diagnóstico

Antes de escribir nada probé los dos identificadores contra el servidor:

| | `can-rate` | `POST /ratings` |
|---|---|---|
| UUID (`orderId`) | 200, `can_rate: true` | 200 |
| número visible (`order_number`) | **404 «Orden no encontrada»** | **200** |

O sea: el POST acepta el número y lo resuelve solo —por eso calificar funcionaba
igual, con el identificador equivocado—, pero `can-rate` **no**. Preguntar con
`order.id`, que es el número visible, habría escondido el botón siempre y por el
motivo equivocado. Va con el UUID, y el caso 165 lo fija: exige que el número
visible siga dando 404, para que el día que eso cambie la prueba avise en vez de
dejar de distinguir.

### 3. Lo que hace ahora

**Perfil.** Cinco estrellas y **una sola** descripción accesible —«X de 5, N
calificaciones»—. El dibujo y el número quedan marcados como decorativos: sin
eso el mismo dato se diría tres veces. Sin calificaciones, el estado vacío
honesto se conserva.

**Elegibilidad.** Se consulta `/ratings/order/{uuid}/can-rate` en paralelo para
las órdenes entregadas. `'error'` **no es** `'no'`: si la consulta falla no se
sabe, y no se ofrece una acción cuya elegibilidad se desconoce —se dice que no
se pudo comprobar y se ofrece reintentar—. Después de enviar se vuelve a
preguntar al servidor, que es lo que sobrevive a recargar.

**Selector y capa.** Cinco radios nativos con nombre de grupo dentro de un
`fieldset` con `legend`: las flechas, la selección y el anuncio los hace el
navegador. La capa tiene `role="dialog"`, nombre y descripción, `useCapaModal`
—foco contenido y devuelto, Escape—, fondo y X equivalentes a Cancelar, y todas
las salidas pasan por `FORM-DIRTY-1`. Mientras el envío viaja no cierra por
ninguna vía ni duplica el POST, y el error queda visible **en la capa**, no sólo
en un aviso que se va solo. Puntaje inicial 5 y comentario máximo 500,
conservados.

### 4. Un error visual que encontré mirando la captura

La primera versión pintaba de color sólo la estrella elegida, así que «3 de 5»
mostraba dos estrellas llenas apagadas y una dorada: se leía como si las dos
primeras valieran menos. Ahora se pinta la elegida y todas las anteriores, que
son las que se dibujan llenas.

### 5. Lo verde, y lo que exige

Orden entregada fabricada por el caso; el botón aparece; la capa tiene nombre;
el foco entra y diez tabulaciones no se escapan; cinco radios con nombre de
grupo, puntaje inicial 5 y flechas que mueven la elección; con el puntaje
cambiado Escape pregunta y **seguir editando conserva lo elegido**; descartar
cierra una vez y devuelve el foco al botón que abrió; **sin cambios cierra
directo**; enviar manda **una** sola calificación y la base la registra con su
puntaje; el servidor pasa a decir `can_rate: false`; **recargada la página el
botón no vuelve**; con la consulta caída no se ofrece calificar y el reintento
resuelve. Tres capturas: perfil y diálogo en 1440×900 y diálogo en 390×844.

### 6. Tres agujeros en mi propio caso, y son míos

El 165 pasó aislado y falló acompañado **tres veces**, cada una por un motivo
distinto. Lo anoto entero porque es el patrón, no el incidente:

1. Afirmaba «no hay botón de calificar» y «no queda nada sin saber» mirando
   **toda la pantalla**. Otros casos dejan más compras entregadas que muestran
   ese botón con todo derecho.
2. Reintentaba **una sola** orden de varias en estado desconocido.
3. Y armaba la orden con los ayudantes compartidos, que leen el carrito por
   `state.buyerId` —que en la suite completa ya no es el mismo comprador que
   `state.buyerToken`, porque otros casos lo reasignan—. Checkout con HTTP 400,
   «Falta decidir cómo se traslada el pedido».

Los tres tenían la misma raíz: dar por hecho un estado que no fabriqué. Ahora el
caso se hace su publicación, su orden y sus decisiones de traslado, y acota cada
afirmación a lo suyo. Después de eso: **dos corridas del set focal desde base
limpia, 3/3 las dos**, y la suite completa en 164/165.

### 7. Puertas

- **Suite completa desde base limpia: 164/165.** Único rojo, el **131**: sigue
  necesitando `docker run` y este entorno sólo tiene el puente de `docker exec`.
  Es la limitación ambiental de siempre; no la toqué ni la simulé.
- Focales 149, 150 y 165 aislados: **3/3**, dos veces.
- `lint`, `node --check`, `tsc` y `diff-check`, verdes. El smoke incluye build.
- Sin a11y ni contraste totales —el 165 mide teclado, semántica, foco y las dos
  anchuras— y sin `compileall` ni `pip check`, porque no toqué Backend.

---

## TEST-SUITE-164SR — la frase de salida del 125

**Resultado: corregido.**

- Arnés: `4182275`
- **En mi rama, no en `main`.** No toqué producto, no integré, no desplegué.

---

Tenías razón y era exactamente una línea. El caso 125 ya aceptaba foto local de
`/catalogo/` o el respaldo honesto de `/estados/no-photo.svg`, y seguía
anunciando en su salida verde que las publicaciones de servicio «no ganan foto».
Describía lo que el caso dejó de medir.

Importa más de lo que parece: quien lee ese verde se lleva una regla que
`CATALOG-PHOTOS-1` derogó. Un informe que dice otra cosa que la prueba vale
menos que no informar.

Ahora dice que usan foto local del catálogo o el respaldo honesto, sin imágenes
externas ni al azar, que es lo que la prueba comprueba.

**Sólo esa frase.** El diff es de dos líneas y no toca ninguna comprobación.

Corrí únicamente lo que pediste: `node --check` y `diff-check`, los dos verdes.
No repetí smoke, suite, build, lint, Backend, a11y, contraste ni capturas.

---

## TEST-SUITE-164S — la puerta deja de nacer rota

**Resultado: 163/164, y el único rojo es el 131 ambiental.**

- Arnés: `6d20ecf` y `4319623` (sólo `scripts/smoke.mjs`)
- **En mi rama, no en `main`.** No integré, no desplegué, no ejecuté seed contra
  Railway y no toqué datos remotos, pagos ni secretos. No abrí un caso 165 ni
  toqué `src/`, `backend/`, migraciones, seed ni contratos.

---

### 1. Ninguno de los seis era una rotura de producto

Reproduje cada rojo aislado antes de tocarlo, y en cinco de los seis el aislado
falló distinto que dentro de la suite. Ese contraste es lo que dio el
diagnóstico:

| caso | aislado | dentro del orden completo |
|---|---|---|
| 21 | `Cannot read properties of undefined (reading 'name')` | espera de locator |
| 54 | `DELETE /cart` HTTP 401 | espera de locator |
| 57 | `DELETE /cart` HTTP 401 | espera de locator |
| 125 | la tarjeta dibuja una imagen | la tarjeta dibuja una imagen |
| 157 | espera de locator | espera de locator |
| 162 | **pasa** | «sólo 0 tarjetas resolvieron una foto» |

### 2. Qué encontré, uno por uno

**21 — dos problemas, uno adentro del otro.** Usaba el producto que deja el caso
6, así que aislado moría con un `undefined` que no señalaba a nada. Al darle
estado propio apareció el de fondo: desde `CATALOG-PHOTOS-1` el catálogo le
resuelve foto a los 30 slugs del seed, y este caso mide justamente el cartel
«Sin registro fotográfico». Estaba midiendo sobre material que dejó de servir.
Y el otro tramo intercepta `/uploads/**` cuando las fotos demostrativas se
sirven desde `/catalogo/`: rompía algo que ya no existía. Ahora fabrica dos
publicaciones propias —una sin imágenes, otra con una foto subida de verdad— y
las borra al terminar.

**54, 57 y 157 — rastros de mi propio `ACCOUNT-PAGE-1`.** Buscaban Mi cuenta
como `[class*="overlay"]` y como `getByRole('dialog', { name: 'Mi cuenta' })`.
Yo la convertí en página; esos locators quedaron apuntando a algo que ya no
existe. Ahora se la pide por lo que es: `main[aria-labelledby="cuenta-titulo"]`.
Lo digo así de directo porque es mío: la tarea de Mi cuenta no corrió suite
completa, y esto es lo que costó.

54 y 57 además morían en `DELETE /cart` con un 401 que parecía un problema de
permisos y era, simplemente, no haber ingresado.

**157 — se ensuciaba a sí mismo.** Afirma que la cuenta de prueba arranca sin
publicaciones, y el propio caso le publica una. Bastaba con haberlo corrido una
vez para que la siguiente arrancara roja. Ahora limpia lo que dejó una corrida
anterior, y el mensaje distingue eso de que el seed le siembre historia —que
sería otra cosa y sí importaría—.

**125 — una regla derogada por tu propia entrega.** Afirmaba que la tarjeta de
un servicio no dibuja ninguna imagen. El paquete de 30 fotos que entregaste
incluye servicios: «Instalación y Reparación de Alambrados Rurales» es uno, y
está en tu inventario. Así que la regla vieja y tu entrega no podían ser las dos
verdad. Conservé lo que sigue en pie y ajusté lo que no.

Y acá me equivoqué una vez: la dejé demasiado estricta, exigiendo que toda
imagen fuera del catálogo demostrativo. La suite completa lo encontró con un
servicio fabricado por otro caso que dibuja `/estados/no-photo.svg` —el respaldo
honesto, que es lo correcto—. Corregido en `4319623`: valen dos cosas y sólo
dos, y se sigue prohibiendo lo que motivó el caso, que es una imagen traída de
afuera al lado de un precio real.

**162 — no se rompía.** Para cuando le toca, 161 casos ya publicaron, pausaron y
borraron, y la primera página del Mercado está llena de publicaciones fabricadas
por ellos. Ahora devuelve al aire las 30 que mide, aparta el resto **mientras
mide**, y en el `finally` restaura fila por fila el estado exacto que cada una
tenía —no uno supuesto—. La publicación ajena que el propio caso crea queda
afuera del barrido: es parte de lo que mide. La verificación 1:1 de activos y la
prioridad de la foto real del vendedor quedan intactas.

### 3. El 131: la condición exacta, sin simular nada

No lo toqué. La receta corre dentro de `alpine:3` y necesita `docker run`. En
este entorno no hay demonio Docker: el `docker` del `PATH` es el puente que
instala `scripts/entorno_nativo.sh`, y en su línea 94 dice literalmente

```
puente docker: sólo se traduce 'docker exec'; 'run --rm ...' no tiene equivalente
```

Lo reproduje a mano fuera de la suite: `docker run --rm alpine:3 echo hola`
devuelve ese mismo mensaje. Es la incompatibilidad ambiental ya documentada. No
cambié producto ni fabriqué un verde.

### 4. Además: una preparación compartida

`asegurarSesiones` y `asegurarProducto`, idempotentes. Si el estado ya está
—corrida completa— no tocan nada y el orden sigue siendo el mismo; si no está,
lo arman con las cuentas públicas del seed. No reemplazan a los casos que
construyen ese estado: los suplen cuando no corrieron.

### 5. Puertas

- **Suite completa desde base limpia: 163/164, salida 1.** Único rojo: 131.
- `node --check` y `diff-check`, verdes.
- Sin lint, TypeScript, Backend, a11y, contraste ni capturas: no hay producto.

Una nota de método: la primera suite dio 162/164 y la corregí; ésta es la que
informo. Y en el medio el contenedor se reinició con la corrida en 138/164, así
que la volví a largar entera en vez de dar por bueno un tramo.

---

## ADMIN-SAFETY-1R — el resumen cierra, la capa aguanta, y se retira lo que no tiene efecto

**Resultado: corregido, las cuatro.**

- Corrección: `871ce7b`
- La suite sigue en **164 casos**.
- **En mi rama, no en `main`.** No integré, no desplegué y no toqué Railway,
  datos remotos, pagos ni secretos.

---

### 1. El resumen no cerraba, y eso invalida un número que te informé

Tenías razón y es lo más grave de la entrega anterior. `passed` y `failed` se
calculaban **antes** de que corriera el último caso: el 164 alcanzaba a
imprimir su `[PASS]` y no entraba en la cuenta.

Con un solo caso pedido daba «0/1 pasaron; 0 fallaron» —ni sumaba ni restaba—.
Y en la suite entera el total quedaba corrido en uno: **el 156/164 que te
informé estaba mal**. El número real de aquella corrida era 157.

La cuenta pasa a hacerse después del último `runCase`. Los dos sentidos,
medidos:

| | resumen | salida |
|---|---|---|
| con una condición del 164 rota a propósito | `0/1 pasaron; 1 fallaron` | **1** |
| restaurada | `1/1 pasaron; 0 fallaron` | **0** |

Y en la suite completa la aritmética cierra: **157 + 7 = 164**.

### 2. Escape con la mutación en vuelo

También tenías razón, y era la peor de las cuatro salidas: la capa desaparecía
mientras la solicitud seguía viajando, así que la pantalla decía «no pasó nada»
y el cambio se aplicaba igual, sin que se viera ni el éxito ni el error. Los
botones y el fondo ya lo respetaban porque miraban `enCurso`; el cierre que
recibía `useCapaModal` no lo miraba. Ahora mira el mismo estado.

El 164 lo prueba **reteniendo la respuesta** con `page.route`: confirmado el
cambio y con el PATCH en vuelo, Escape, el fondo, la X y Cancelar no cierran la
capa y no mandan ninguna solicitud más. Al soltar la respuesta, la capa se va
sola y el éxito queda visible.

Negativo: quitándole el `enCurso` al cierre, el caso dice *«con la mutación en
vuelo, Escape cerró la capa: la pantalla diría que no pasó nada»*.

### 3. El selector Estado de categoría

Retirado de la UI, y `is_active` dejó de viajar al editar. Campo, API y datos
quedan como están, igual que con Provincias. La guarda de subcategoría se
conserva y la semántica pública de categorías no se toca.

El 164 comprueba las dos cosas: que el panel ya no ofrezca el control, y que
guardar una categoría mande **una** solicitud sin `is_active`. Negativo:
volviendo a mandarlo, dice *«editar una categoría sigue mandando is_active»* y
muestra el cuerpo.

### 4. Nueva contraseña, no temporal

Renombrado en la confirmación, en el resultado y en el código. El texto ahora
dice que **queda vigente hasta que un administrador la restablezca otra vez**, y
se fue «pedile que la cambie al entrar»: prometía un vencimiento que el producto
no tiene. No agregué cambio de clave, migración, correo, token ni recuperación.

El caso exige que la palabra «temporal» no aparezca en el resultado y que sí
aparezca hasta cuándo rige.

### 5. Lo que sumé al 164 sin agrandarlo

Cancelación sin escritura en **activación de cuenta** y en **estado de
publicación**, además del rol. Para los tres borrados, la capa común más la
comprobación estática de que no quede `window.confirm`. La verificación real del
reset sigue igual: la clave anterior deja de entrar, la nueva entra, y al cerrar
no se recupera. Nunca se imprime.

### 6. Puertas

- **149, 150 y 164 aislados desde base limpia: 3/3.**
- **Suite completa desde base limpia: 157/164**, con el 164 verde **dentro** de
  la corrida completa.
- `lint`, `node --check`, `tsc`, `compileall`, `pip check` y `diff-check`,
  verdes. El smoke incluye build.

Los **7 rojos son los mismos heredados** que ya te informé —21, 54, 57, 125,
131, 157 (rojos en la base de entrada, medido corriéndolos sin mis cambios) y el
162, que pasa aislado y se queda sin material dentro de la suite—. Como
indicaste, no los corregí ni repetí la suite.

---

## ADMIN-SAFETY-1 — el panel no escribe sobre datos ajenos sin preguntar

**Resultado: entregado, con una devolución tuya adentro.**

- Producto/regresión: `79f3219`
- La suite pasa a **164 casos**.
- **En mi rama, no en `main`.** No integré, no desplegué, no ejecuté seed contra
  Railway y no toqué datos remotos, pagos ni secretos.

---

### 1. R4: la premisa no se sostiene, y lo que hay es peor de otra manera

Preparé la categoría con publicaciones activas, la desactivé por la ruta
administrativa real (`PUT /admin/categories/{id}` con `is_active: false`,
aceptada con 200) y contrasté los tres lados. Medido:

| | antes | después |
|---|---|---|
| categorías en los filtros | 12 | **12** |
| filtrar por esa categoría | 4 resultados | **4 resultados** |
| catálogo general | 30 | **30** |
| detalle de una de ellas | abre | **abre, y dice su categoría** |

La condición que pusiste —«la publicación sigue visible **mientras su categoría
desaparece de los filtros**»— **no se cumple**: la categoría no desaparece de
ningún lado. `/catalog/categories` no filtra por `is_active` y ni siquiera lo
expone, así que la pantalla no puede saber que está inactiva.

Lo que hay es distinto: **`Estado: Inactiva` es un interruptor que no hace
nada**. Se acepta, se guarda, se dibuja «• Inactiva» en el panel, y la parte
pública queda idéntica. Quien lo usa cree que sacó una categoría de
circulación y no sacó nada.

Por eso **no le puse la guarda que pediste**: bloquear la desactivación de una
categoría sería proteger una acción sin efecto, y de paso confirmaría que
significa algo.

**Pero el síntoma que describiste existe: está en la subcategoría.** Medido:
desactivarla la sacó de las 8 que ofrecía su categoría —quedaron 7— y su
publicación siguió en el catálogo, diciendo que era de ella. Nadie puede llegar
a esa publicación filtrando, y ahí está.

Ahí puse la guarda, que es donde estaba el rojo: 409 con motivo accionable
(«tiene 1 publicación(es) activa(s) que quedarían visibles en el catálogo pero
fuera de los filtros. Movelas a otra subcategoría o pausalas»). Sólo frena la
desactivación: el nombre y el orden se siguen editando —medido— y una
subcategoría sin publicaciones activas se desactiva sin problema —medido—.

En UI no hay nada que bloquear: **el panel no ofrece desactivar subcategorías**,
sólo eliminarlas. El camino es la API.

**Lo que queda para vos:** decidir qué es `is_active` en una categoría. O
significa algo —y entonces el catálogo tiene que respetarlo, que es un cambio
de alcance propio— o no significa nada y el selector debería irse. No lo toqué:
no es lo que pediste y no quiero decidirlo yo.

### 2. R5: confirmado, y retirado

Rastreé los consumidores reales. Los cinco que nombraste —publicar, registro,
alta de transportista, filtros del Mercado y edición del perfil— piden todos
`/catalog/localities/provinces`. **Ninguno** pide `option_type=province`, ni en
el frontend ni en el Backend. Y en una base recién creada no hay **ninguna**
fila `province`: las únicas son `unit`, `pricing_type`, `availability` y
`response_time`.

Así que Configuración ofrecía un lugar para escribir provincias que no iban a
aparecer en ningún lado. Se retira de la pantalla y nada más: las filas y el
endpoint quedan intactos, y `/admin/form-options/types` sigue devolviendo los
cinco tipos. El caso 164 lo comprueba en los dos sentidos.

### 3. La confirmación: una, no seis

`Pregunta` —el cartel de «tenés cambios sin guardar»— ya era una capa correcta,
pero tenía el texto adentro. La abrí en dos: `Confirmacion` es la capa, y
`Pregunta` pasó a ser **un uso de ella** con su texto. Sus consumidores no se
enteraron: mismo título, mismo detalle, mismos botones y el mismo orden.

Los seis recorridos usan esa capa. Se fueron los tres `window.confirm` y, más
importante, las **tres mutaciones que escribían sin preguntar nada**: el rol, el
estado de la cuenta y el estado de la publicación salían con el `onChange` de un
`select`. Un clic de más sobre la cuenta de otra persona ya era un cambio hecho.

Cada decisión nombra el objeto, el cambio exacto y la consecuencia. En las
destructivas la salida segura va primero.

### 4. Restablecer contraseña

20 caracteres de un alfabeto sin ambiguos, del generador criptográfico del
navegador —no `Math.random`—, descartando el sesgo por módulo en vez de
recortarlo. Se muestra una vez, en su propia capa, y se va con ella: no entra
en consola, ni en un toast, ni en la URL, ni en el almacenamiento del
navegador.

**No hay botón de copiar, a propósito**: el portapapeles deja la clave
disponible para cualquier otra aplicación y sobrevive a cerrar la pantalla, que
es justo lo que esta capa promete que no pasa.

### 5. El caso 164, y los rojos

Contra la **base de entrada**, cinco rojos, uno por motivo, cada uno medido
desactivando el anterior:

1. `Configuración volvió a ofrecer todos los tipos que devuelve la API` (R5).
2. `desactivar una subcategoría con publicaciones activas devolvió 200 y tiene
   que devolver 409` (R4).
3. `elegir en el selector ya escribió, sin preguntar:
   ["PATCH /api/admin/users/…"]`.
4. el botón `Restablecer contraseña` no existe.
5. `el borrado abrió 1 diálogo(s) nativo(s): sigue usando window.confirm`.

Dos de esos rojos primero salieron como «se agotó la espera», que no dice nada:
reordené el caso para que **cuente las solicitudes antes** de esperar la capa, y
para que mire si apareció un diálogo nativo antes de buscar el del producto.
Ahora el rojo nombra la causa.

Y dos negativos sobre el código nuevo: hacer que **cancelar ejecute la
mutación** (dio `cancelar escribió: ["PATCH /api/admin/users/…"]`) y **guardar
la clave temporal** en el navegador (dio `la clave temporal quedó guardada:
{"local":true,…}`). Sin eso, «cancelar hace cero» y «no queda rastro» podrían
ser verdes vacíos.

En verde el caso cuenta solicitudes: cancelar por botón, Escape y fondo hacen
**cero** y no dejan el selector mintiendo; confirmar hace **una**, y base y
pantalla quedan diciendo lo mismo. Comprueba el nombre accesible de la capa, que
el foco entre, que ocho tabulaciones no se escapen y que vuelva al control que
la abrió.

### 6. Dos correcciones a mí mismo, durante la medición

- Mi primera comprobación de foco miraba **el primer** `[role="dialog"]` del
  documento, que es el panel entero. El foco estaba bien; medía la capa
  equivocada.
- Y buscaba la confirmación como «la última capa», que deja de serlo apenas se
  cierra. La busco por su propio nombre accesible.

También enfoco el `select` antes de elegir: `selectOption` escribe el valor sin
enfocarlo, y entonces «devolver el foco a quien abrió la capa» habría medido un
origen que nunca existió. Quien cambia un `select` de verdad siempre lo tiene
enfocado.

### 7. Tres cosas que rompí, y cómo las encontré

La suite completa las encontró; aisladas desde base limpia las confirmé.

1. **`FORM-DIRTY-1` dejó de ser reconocible (149 y 150).** Al factorizar la
   capa, la pregunta de «tenés cambios sin guardar» pasó a nombrarse sola y
   perdió su `titulo-cambios-sin-guardar`. Seguía apareciendo y seguía
   funcionando, pero quien la busca por ese nombre —que es como se la
   identifica desde que existe— ya no la encontraba, y el síntoma era el peor
   posible: *«no preguntó nada antes de cerrar»*. Le devolví el nombre con una
   propiedad explícita, y dejé escrito por qué es contrato y no un detalle.
   Es exactamente lo que pediste al decir «conservá sus consumidores
   actuales»; me lo salteé y la suite me lo cobró.
2. **Los casos 144 y 146** accionaban el control y esperaban la solicitud. Ahora
   el control abre la capa y confirmar es lo que escribe. Adaptados: confirman y
   después miden lo mismo que antes. Son pruebas ajenas, por eso lo digo.
3. **Mi propio 164 dependía del seed.** Buscaba una publicación con subcategoría
   y una cuenta del seed: aislado andaba, y en la suite completa llegaba cuando
   los casos anteriores ya habían movido todo. Ahora **fabrica** su cuenta y su
   subcategoría, y las devuelve al terminar.

Y al escribir `Pregunta.tsx` byte a byte dejé los comentarios con mojibake
—`polM-CM-^CM-BM--tica`—. Los textos visibles estaban bien, pero el archivo quedaba
ilegible. Reescrito.

### 8. Puertas, y lo que quedó rojo

**Suite completa desde base limpia: 156/164.** El 164 pasa **dentro de la suite
completa**, no sólo aislado. Focales 144, 148, 160 y 164: 4/4.

Quedaron **7 rojos, y ninguno es mío**. No lo supongo: corrí los mismos casos
**sin mis cambios**, sobre la base de entrada, y fallan igual y con el mismo
mensaje.

- **21, 54, 57, 125, 131 y 157** — rojos en la base de entrada. Medido, no
  deducido. `54` y `57` mueren en `DELETE /cart` con 401; `21` con un
  `Cannot read properties of undefined`; `157` esperando un locator. No los
  toqué: están fuera de alcance y arreglarlos sería ampliarlo solo.
- **162** —la pieza de fotos que ya aceptaste— **pasa aislado desde base limpia
  y falla dentro de la suite completa**, con «sólo 0 tarjetas resolvieron una
  foto». No se rompió: para cuando le toca, los casos anteriores le dejaron el
  catálogo sin las publicaciones que mira. Es el mismo problema que tenía mi
  164 y que resolví fabricando lo propio; el 162 se arregla igual, pero es
  prueba de otra pieza ya cerrada y no la toco sin que me lo pidas.

Esos 7 estaban antes de esta tarea y siguen después. Lo digo porque un informe
que esconde un rojo vale menos que no informar.

`lint`, `node --check`, `tsc`, `compileall`, `pip check` y `diff-check`, todos
verdes. El smoke incluye build.

---

## ACCOUNT-PAGE-1R — La marca de página actual en Mi cuenta

**Resultado: corregido.**

- Producto/regresión: `958c11c`
- La suite sigue en **163 casos**.
- **En mi rama, no en `main`.** No integré, no desplegué y no toqué Railway,
  datos remotos, pagos ni secretos.

---

### 1. Tenías razón, y el mecanismo es el que decís

El botón recibía `aria-current="page"` y no se veía actual. El CSS dibujaba
sólo `.navLink[aria-current='page']`, y el acceso de cuenta no es un
`.navLink`: es una celda de sesión, `.celda .cuenta`. Se anunciaba página
actual y se veía como una acción más.

Mi caso 163 daba verde porque miraba el atributo y nada más. Es el mismo tipo
de falso verde que ya me habías marcado en el 160: comprobar el anuncio en vez
de la cosa anunciada.

### 2. La corrección

Mi cuenta entra en la **misma regla**, no en una copia suya:

```css
.navLink[aria-current='page'],
.cuenta[aria-current='page'] { … }
```

No hay componente nuevo, ni color nuevo, ni un segundo lugar donde el fondo, el
color o el peso puedan quedar viejos. Es una sección del sitio desde
`ACCOUNT-PAGE-1`; que se dibuje entre las acciones de la sesión es dónde vive,
no qué es.

Producto tocado: **una regla de CSS**. Nada de navegación, guardias, layout,
textos ni otras regresiones.

### 3. La prueba, y dos cosas que salieron de medirla

El 163 ahora lee el estilo computado de una sección pública activa —el Mercado,
en vivo— **antes** de entrar a la cuenta, y exige que el acceso use ese mismo
fondo, color y peso al quedar actual. No hay hexadecimales escritos en la
prueba: la referencia es la navegación viva, así que si mañana cambia el
tratamiento, la prueba lo sigue sola.

Dos cosas me mordieron y las arreglé porque medí, no porque las supusiera:

- **`index.css` transiciona `background-color` en los botones.** Una lectura
  suelta agarra la animación a mitad de camino: la primera versión de mi
  comparación falló con `rgba(255, 255, 255, 0.914)` donde el token dice
  `#ffffff`. Habría sido una prueba intermitente.
- **Esperar a que el valor «se repita» no alcanza.** Dos lecturas dentro del
  mismo cuadro dan el mismo valor aunque la transición siga corriendo: mi
  primer intento dio por firme un `rgba(255, 255, 255, 0.435)`. Ahora cada
  lectura se toma en un cuadro distinto y además se exige que no quede ninguna
  animación viva. Sin esperas fijas.

También saco al puntero de encima antes de mirar: el botón queda hovereado
después del clic y `:hover` pinta la celda, así que las dos lecturas se toman
en el mismo estado.

### 4. Los dos rojos

1. **Sin `.cuenta[aria-current='page']` en el selector** —el estado que me
   marcaste—: *«Mi cuenta actual no se ve como una sección activa: fondo es
   `rgba(0, 0, 0, 0)` y la sección activa usa `rgb(255, 255, 255)`»*.
2. **Con la regla de sección activa vaciada**: *«la sección activa no se
   distingue de una celda común»*. Es la comprobación de que la referencia
   sirva: si el sitio dejara de marcar sus secciones, la comparación pasaría
   por vacía en vez de avisar.

### 5. Una cosa que pediste y no puse, con el motivo

Pediste exigir además que no coincida con una celda común, *«si eso fuera
necesario para evitar otro falso verde»*. **No es necesario, y no se puede
poner rojo.** La comparación del punto 4.1 obliga a que las tres propiedades
sean las de la sección activa, y la del 4.2 obliga a que la sección activa
difiera de la celda común en alguna de esas tres. Una tercera comparación sale
verde por construcción, siempre. La dejé escrita como comentario con la
derivación, en vez de dejar una línea que no puede fallar: acá una prueba que
no se puede romper no prueba nada.

Si preferís que esté igual como red de seguridad, decímelo y la agrego.

### 6. Puertas

Corrí lo que pediste y nada más: **163 desde base limpia (1/1)**, `lint`,
`node --check` y `diff-check`, los tres verdes. El smoke incluye build. No
repetí 147–150 ni suite completa, Backend, a11y ni contraste. Seis capturas
nuevas; en la de 1440×900 se ve la celda de «Juan Vendedor» blanca con texto
oscuro, igual que una sección activa.

---

## ACCOUNT-PAGE-1 — Mi cuenta es una página del sitio

**Resultado: terminado.**

- Producto/regresión: `7dc1d53`
- La suite pasa a **163 casos**.
- **En mi rama, no en `main`.** No integré, no desplegué, no mezclé nada de
  otra pieza y no toqué Railway, datos remotos, pagos ni secretos.

---

### 1. Los cinco puntos

**El contenedor general dejó de ser capa.** Se fueron el fondo oscuro, la caja
flotante, la X, `role="dialog"`, la trampa de foco, el cierre con Escape y con
el fondo, y el bloqueo del scroll. Queda una página: Header arriba, Footer
abajo, ancho de lectura propio y el scroll del documento. Las capas de adentro
—editar una publicación, calificar, rechazar una transferencia— siguen siendo
capas, como pediste.

**Tiene URL.** `account` entra en la política de navegación, así que
`?section=account` se recarga, se comparte y Atrás vuelve adonde estaba. No
agregué React Router ni ningún otro escritor de `history`: la guardia vive en el
único módulo que ya escribía el historial. El botón de la cabecera navega y
queda con `aria-current="page"`.

De paso saqué una copia que se había quedado atrás: `Header.tsx` declaraba su
propia lista de secciones, sin `account`. Ahora lee el tipo de la política, que
es lo que esa política vino a evitar.

**La sesión.** Entrada directa sin sesión abre el ingreso; si autentica vuelve a
Mi cuenta y si cancela queda en una sección pública. Salir termina la sesión y
va a Inicio. La vuelta de Mercado Pago aterriza en la cuenta en vez de intentar
abrir el modal retirado.

**Los datos, intactos.** Pestañas, permisos, cargas, errores, acciones y API son
los mismos. No rediseñé ninguna sección interna, no agregué sidebar, ni rutas
por pestaña, ni funciones nuevas.

### 2. `FORM-DIRTY-1` en el límite nuevo

Antes las salidas eran tres —la X, el fondo y Escape— y las tres pasaban por el
componente. Ahora son cinco —cabecera, pie, Atrás, Salir y cambiar de pestaña— y
**cuatro de las cinco no lo tocan**. Así que la pantalla con trabajo sin guardar
registra una guardia en la navegación, que es quien las ve todas.

El Atrás es el caso incómodo: cuando `popstate` llega, la barra ya se movió. Se
deshace el movimiento **antes** de preguntar, para que «seguir editando»
conserve pantalla, URL y contenido; y si la respuesta es descartar, se repite el
Atrás con la guardia levantada.

**Y descartar ahora descarta.** Mientras era un modal, descartar cerraba el panel
y el formulario se iba con él. Como página, el destino puede ser otra pestaña:
si el formulario quedara escrito, la salida siguiente volvería a preguntar por
lo mismo y «pregunta una sola vez» dejaría de ser cierto. Ahora suelta el
trabajo local de las cuatro fuentes y después ejecuta el destino. **Local** es
la palabra: vuelve los formularios a lo último guardado y no toca ninguna orden
ni publicación ya persistida.

Un detalle que salió de medir: elegir la pestaña en la que ya estás no pregunta
nada. No es una salida, es la misma regla con la que la navegación no agrega una
entrada al historial cuando el destino es donde ya estás.

### 3. Tres arreglos que la conversión hizo necesarios

| Qué | Por qué |
|---|---|
| «Sin calificaciones aún» se partía en «Sin calificaci / ones aún» | Era el precio de un `overflow-wrap: anywhere` puesto para evitar un desborde. Una frase no necesita cuerpo de cifra: baja a 15 px, entra y corta entre palabras |
| En 390 px las pestañas se iban de la pantalla | Con `nowrap` + `overflow-x: auto`, Mis Compras, Mis Ventas y Mis publicaciones quedaban fuera de la ventana: había que descubrir que la tira se arrastra. Ahora se envuelven y entran las seis |
| La capa de editar una publicación se quedó sin Escape | Nunca había tenido el suyo: usaba el del panel, que cerraba **todo**. Al retirar el panel se quedaba sin ninguno. Ahora tiene el suyo, con foco atrapado y devuelto a su disparador, y declara `role="dialog"`, que tampoco tenía |

### 4. El caso 163, y las cinco veces que lo puse rojo

Mide seis propiedades. Ninguna es «se ve como una página», que no se mide.

| Roto a propósito | Qué dijo |
|---|---|
| La cuenta vuelve a declararse diálogo | `la cuenta dejó 1 diálogo(s) abiertos` |
| Se le saca su nombre en la barra | `Mi cuenta no tiene URL propia: la barra dice http://localhost/` |
| La guardia deja de mirar el Atrás | `saliendo por Atrás con trabajo sin guardar no preguntó` |
| Descartar deja de soltar el trabajo local | `tras descartar, el perfil siguió en edición con lo escrito adentro` |
| Las pestañas vuelven a `nowrap` | `390x844/perfil: 2 control(es) fuera de la ventana: Mis Ventas \| Mis publicaciones` |

«Texto partido de forma absurda» se mide y no se opina: el caso arma con
`Range` las líneas que el navegador dibujó de verdad y exige que juntarlas con
un espacio devuelva el texto original. Si un corte partió una palabra, no
coincide y se cae.

**Y un agujero que encontré en mi propio caso.** El bloque que comprobaba el
descarte navegaba a otra sección, y eso desmonta la pantalla: al volver, el
perfil aparecía cerrado igual, así que la comprobación pasaba aunque descartar
no soltara nada —lo medí sacando el descarte del producto y el caso siguió
verde—. Ahora se mide con un destino que **no** desmonta: otra pestaña.

### 5. Los casos 149 y 150, adaptados

Los dos se caían, y era correcto que se cayeran: probaban cerrar el panel con la
X y con el fondo, que ya no existen.

- **149**: donde probaba la X y el fondo, prueba las salidas que existen. Y
  cambia una regla que vos cambiaste: antes cambiar de pestaña con el perfil
  sucio **no** preguntaba —el formulario seguía montado detrás—, y ahora sí.
- **150**: exigía que el contenedor del perfil fuera **una** capa con el fondo
  trabado. Como página la propiedad correcta es la contraria —ningún diálogo y
  el scroll suelto— y comprobarla es igual de discriminante. También se le pasó
  a decir la verdad sobre el foco: vuelve a **quien pidió salir**, que en una
  capa es el campo con Escape y en la página es el botón de la cabecera.

Otros cinco casos —129, 151, 152, 153 y 156— sólo necesitaban el nombre nuevo
del encabezado y siguen verdes.

### 6. Lo que corrí

- **147, 148, 149, 150 y 163 aislados desde base limpia: 5/5.** Seis capturas:
  Perfil y Mis publicaciones en 1440×900, 768×1024 y 390×844.
- `npm run build`, `npm run lint`, `npx tsc --noEmit`, `node --check` y
  `diff-check`: verdes.
- No corrí suite completa, Backend, a11y ni contraste totales. El diff no sale
  del shell, la navegación y el panel.

### 7. Lo que te debo decir

- **El encabezado dice «Mi cuenta» y antes decía «Mi Panel».** No me lo pediste
  explícitamente, pero el botón que lleva ahí dice «Mi cuenta» y el contrato la
  llama así; dejar dos nombres para la misma pantalla era la incoherencia que
  Emi señaló. Cambió el texto de siete casos que lo buscaban por nombre.
- **En Mis publicaciones las tarjetas siguen diciendo «Sin registro
  fotográfico»**, aunque el Mercado ya muestre las fotos de `CATALOG-PHOTOS-1`.
  No es un defecto de esta pieza: esa pestaña lee `/products/my` y no pasa por
  la conversión del catálogo, que es donde vive la tabla demo. Queda informado y
  sin tocar: no estaba en el alcance de ninguna de las dos.
- **`diff-check` me encontró un `\r` duplicado** en una de mis inserciones a
  `App.tsx`. Es justo la trampa que avisa el repositorio; lo corregí y verifiqué
  que los cinco archivos mezclados conservan la proporción de finales de línea
  que tenían.

### 8. Sin rojo, sin intermitente, sin pendiente

Nada quedó rojo ni sin verificar.

## CATALOG-PHOTOS-1 — el catálogo muestra la foto del aviso

**Resultado: terminado.**

- Producto/regresión: `e3c277e`
- La suite pasa a **162 casos**.
- **En mi rama, no en `main`.** No integré, no desplegué, no corrí seed y no
  toqué Railway, datos, pagos ni secretos. No mezclé `ACCOUNT-PAGE-1`.

Tu paquete destrabó la tarea. Lo que estaba bloqueado era la búsqueda y descarga
—la política de egreso de este entorno rechaza todos los bancos de imágenes— y
eso lo resolviste vos. El resto era mío y está hecho.

---

### 1. Antes de usarlas, las verifiqué

No por desconfianza: porque un paquete que dice «30, 1:1, todas distintas» y no
lo es rompe la demo en el peor momento. **Todo lo que afirmás se comprueba:**

| Lo que decías | Lo que medí |
|---|---|
| 30 archivos | 30 |
| relación 1:1 con los slugs del seed | 30 y 30, sin sobrantes ni faltantes |
| 30 hashes distintos | 30 |
| todos decodificables | 30, leyendo la cabecera WebP |
| 1600 × 1000 | 1600 × 1000, las treinta |
| 5.4 MiB | 5.33 MiB |

Las copié a `public/catalogo/` **sin recomprimir**: este entorno no tiene
`cwebp`, ImageMagick ni Pillow, así que optimizar no lo puedo hacer acá. El peso
está abajo, en lo que te debo.

### 2. Lo que cambié en el producto, y por qué tan poco

**La resolución de la imagen, en un solo punto.** Donde el catálogo arma la
publicación. El orden es el único que no miente:

1. la foto que subió quien publica;
2. si no hay —o si es de relleno, que para el sistema visual es lo mismo que no
   haber—, la tabla de la demostración;
3. si el slug no es de la demostración, **«Sin registro fotográfico»**. No hay
   foto genérica de reemplazo.

**La tabla, derivada de tu inventario.** `src/utils/fotosDemo.ts` no se escribió
a mano: sale de `INVENTARIO-FOTOS-CATALOGO-2026-09-09.md` y lleva la atribución
adentro. El caso 162 vuelve a leer tu archivo y se cae si dejaron de coincidir:
la atribución no puede envejecer por separado de la foto que atribuye.

**La banda pasa a las cuatro anatomías**, en tarjeta y en detalle. Servicio y
logística no la llevaban, con un argumento que era bueno mientras no hubiera
foto: sin imagen, el hueco no prometía nada. Ahora la hay, y una cuadrícula
donde la mitad de las tarjetas arranca con foto y la otra mitad no tiene dos
alturas de la misma cosa. Cobertura, modalidad y respuesta siguen completas: la
banda no les sacó lugar.

### 3. Una cosa que agregué y no me pediste explícitamente

**El crédito de la foto, debajo de la imagen en el detalle.**

Tu propio inventario lo dice: «Para CC BY/CC BY-SA, mantener crédito, enlace a
la licencia e indicar la adaptación». Conté las licencias del paquete:

| Licencia | Fotos |
|---|---:|
| CC BY 2.0 | 16 |
| CC BY-SA (2.0, 3.0, 4.0) | 9 |
| CC0 1.0 | 3 |
| Dominio público (PDM 1.0) | 2 |

**Veinticinco de las treinta exigen atribución**, y esas licencias piden el
crédito donde se muestra la obra. Un archivo en `docs/` no cumple con la persona
que mira la página. Son tres líneas de datos que ya venían en tu inventario y un
párrafo bajo la imagen; me pareció peor entregarlo sin eso que ampliar el
alcance por mi cuenta. **Si preferís que salga, se saca en un commit.**

Detalle menor de presentación: tu inventario mezcla `by 2.0`, `cc0 1.0` y
`CC BY-SA 4.0`. El dato crudo se conserva tal cual lo escribiste —el caso lo
contrasta contra tu archivo— y lo que cambia es cómo se lee en pantalla:
«CC BY 2.0», «CC0 1.0», «Dominio público (PDM 1.0)».

### 4. Un rojo que me encontró el 155

Al darle columna de foto a servicio y logística en la vista **Lista**, en
768 × 1024 el renglón creció a 366 px y la acción terminaba **justo** en el borde
inferior de la ventana: el botón cerraba en 1024 de 1024. El caso 155 lo detectó
y tenía razón.

Arreglado: por debajo de 1180 px la columna de imagen cede ancho antes que los
datos (de 232 px a 172). Los datos y la acción valen más que sesenta píxeles de
foto.

### 5. El caso 162, y las cuatro veces que lo puse rojo

Mide seis propiedades que se rompen en silencio, ninguna de ellas «la foto es
linda», que no se mide:

1. cada uno de los 30 avisos resuelve un archivo local existente, decodificable,
   de medida común y **no repetido**;
2. ninguna imagen sale a la red;
3. la tabla del producto y tu inventario dicen lo mismo, campo por campo;
4. el crédito se ve, con la licencia enlazada y la adaptación mencionada;
5. la foto real del vendedor le gana a la tabla, y un slug ajeno conserva el
   respaldo;
6. la banda mide lo mismo en las cuatro anatomías y en las dos vistas.

| Roto a propósito | Qué dijo |
|---|---|
| Dos avisos con la misma foto | `«tractor-pauny-280a…» y «cosechadora-john-deere-9750» son la misma foto` |
| La atribución se despega del inventario | `autor dice «Otro Autor» en el producto y «Wilson Hui» en el inventario` |
| Se retira el crédito | `el detalle de «Cosechadora John Deere» no acredita la foto` |
| El producto ignora la foto real del vendedor | `muestra «/catalogo/semillas-maiz…» y tenía que mostrar «/images/categories/semillas.jpg»` |

### 6. Lo que corrí

- **155 y 162 aislados desde base limpia: 2/2.** Seis capturas: Mercado en
  Cuadrícula y Lista y detalle de artículo y de servicio en 1440×900; Cuadrícula
  y detalle de servicio en 390×844.
- `npm run build`, `npm run lint`, `npx tsc --noEmit`, `node --check` y
  `diff-check`: verdes. Las 30 llegan a `dist/catalogo/`.
- No corrí suite completa, Backend, a11y ni contraste totales, como pediste. El
  diff no sale del recorrido visual acotado.

### 7. Lo que te debo decir, aunque no me lo preguntes

**Dos fotos no representan lo que dice el aviso.** No las reemplacé —pediste no
sustituir por criterio propio— y las entrego tal cual, pero las marco:

- **`manga-ganadera-balanza-electronica`**: la foto es una balanza de ganado
  **de museo**. Tu propio inventario lo dice en el título de la obra: «Scale for
  large livestock (Waage für Großvieh), **Museum Waake**». Se ve un artefacto
  antiguo de madera bajo techo, no una manga con balanza electrónica. Es la que
  más se aleja del título del aviso.
- **`dron-pulverizador-agricola-20l`**: el dron es excelente y protagonista,
  pero al fondo hay una jornada a campo con carpas, banderas y **texto incrustado
  de terceros** en los banners. Tu contrato pide «sin texto incrustado». En el
  recorte de la tarjeta no se ve; en el detalle sí.

Otras cuatro son defendibles pero indirectas —muestran la aplicación en vez del
producto—: `herbicida-glifosato-20l` y `urea-granulada-46-nitrogeno` muestran
una pulverizadora y una fertilizadora trabajando, no el bidón ni la bolsa;
`insecticida-lambda-cihalotrina-1l` muestra un avión aplicador. Para una demo
funcionan; lo digo por si querés afinarlas después.

**El peso.** 5,33 MiB en 30 archivos, promedio 182 KB, la más pesada 695 KB
(`equipo-riego-goteo`). Las tarjetas cargan con `loading="lazy"`, así que en la
primera pantalla bajan tres o cuatro, no las treinta. Aun así son originales de
1600 px sirviendo una banda de 112 px de alto: hay margen para bajar a la mitad
sin que se note. **No lo puedo hacer acá**: no hay `cwebp`, ImageMagick ni
Pillow en la máquina, y no voy a agregar una dependencia por esto sin que lo
decidas.

### 8. Sin rojo, sin intermitente, sin pendiente

Nada quedó rojo ni sin verificar. **ACCOUNT-PAGE-1** no la empecé: va después de
ésta y no la mezclo.

## ADMIN-TRUTH-1R — el caso 160 se sostiene solo

**Resultado: terminado.**

- Corrección de regresión: `21cd4d1`
- Alcance real: **sólo `scripts/smoke.mjs`**. El producto no se tocó: el diff
  contra `src/` y `backend/` sale vacío. La prueba no reveló ningún fallo real
  del producto, así que no rehice producto, como pediste.
- La suite sigue en **161 casos**.
- **En mi rama, no en `main`.** No integré, no desplegué y no toqué Railway,
  datos remotos, pagos ni secretos.

---

### 1. Tenías razón, y era peor de lo que decía la salida

No hay nada que discutir acá: el 160 daba 1/1 sin probar lo que decía probar.
Lo que encontraste eran **dos** defectos, no uno.

**El bucle vacío.** El bloque de badges filtraba y miraba «lo que hubiera». El
catálogo sembrado es todo `active` y `draft` no se ofrece como filtro, así que
para cuatro de los catorce estados el bucle corría sobre **cero filas**. Un
bucle vacío siempre pasa. Y los diez que sí veía podían venir de filas dejadas
por casos anteriores: en la suite completa el informe enumeraba más estados no
porque el caso los hubiera preparado, sino porque los heredaba.

**El color que no se miraba.** El caso sólo comparaba el texto. Los catorce
badges podían caer al mismo gris —que es exactamente el defecto que el producto
vino a arreglar— y el caso seguía verde. Era una prueba que no podía ponerse
roja por la falla que motivó la pieza.

### 2. Qué hace ahora

**Fabrica sus catorce filas.**

- Cuatro publicaciones por la ruta real del vendedor —`POST /products`, la que
  usa una persona—, una por estado, y el estado se pone en la base descartable,
  que es donde el arranque dice que se fabrican los estados que la API no
  ofrece. Categoría y localidad se copian de una publicación existente del mismo
  vendedor: no invento referencias que el padrón no tenga.
- Las diez órdenes que ya creaba, ahora con su `order_number` leído de la base.
- Después comprueba contra SQL que las cuatro publicaciones quedaron en los
  cuatro estados, y que los diez números de orden son distintos entre sí.

**Busca cada fila por identidad propia.** Nombre de la publicación
(`Verdad 160 <sello> <estado>`) o número de orden, recorriendo páginas mientras
«Siguiente» no esté deshabilitado. Ni el orden del catálogo ni la página son una
identidad; si la fila no aparece en ninguna página, el caso lo dice con el
número de páginas que recorrió y lo que muestra el paginador.

**Exige tres cosas de cada badge**, no una:

1. el texto del diccionario, sin guion bajo;
2. el color **computado** del tono que ese mismo diccionario declara. El color
   no se copia acá: se lee `COLOR_DEL_TONO` del producto —que son tokens de la
   paleta— y lo resuelve el navegador. Si mañana cambia `--tg-color-warning`, la
   prueba sigue diciendo la verdad en vez de quedar mintiendo con un `#79520f`
   escrito a mano;
3. que no sea el tratamiento de respaldo. El tono de respaldo también se lee del
   producto (`SIN_TRADUCCION`), no se supone. La única excepción es el estado
   que declara ese tono a propósito, y el informe dice cuántos son: uno,
   `draft`.

Además se rechaza el fondo vacío o transparente, tanto en el color declarado por
el tono como en el badge dibujado.

**`draft` sale de la vista sin filtro**, que es donde puede aparecer. Y el caso
afirma primero que el filtro *no* lo ofrece: si algún día se ofreciera, esa
afirmación se cae y avisa que hay que exigirlo por filtro como a los otros nueve,
en vez de seguir mirándolo por la puerta de atrás.

**El recuento no se declara.** Antes decía `revisados.length >= 10`, un número
escrito a mano que envejece. Ahora exige
`ESTADOS_PRODUCTO.length + ESTADOS_ORDEN.length` leídos de los enum de la base:
agregar un estado al modelo rompe el caso hasta que se lo prepare y se lo mire.

Y la comprobación temprana del diccionario ahora también exige que cada estado
declare un tono y que ese tono tenga color, no sólo que tenga texto.

### 3. El rojo, tres veces

No te traigo un verde sin haber visto el rojo. Los tres negativos son temporales
y quedaron revertidos; el árbol entregado sólo tiene `scripts/smoke.mjs`.

| Negativo | Qué se rompió a propósito | Qué dijo el caso |
|---|---|---|
| 1 | `COLOR_DEL_TONO.curso` → el color del respaldo | `publicaciones/sold_out: sold_out se ve igual que un estado sin traducir (rgb(76, 84, 75))` |
| 2 | Todos los badges con un solo color en `AdminPanel.tsx` | `el badge de paused se pinta rgb(30, 74, 52) y su tono «espera» declara var(--tg-color-warning) = rgb(121, 82, 15)` |
| 3 | Preparar **una** publicación en vez de cuatro, como la versión que rechazaste | `se miraron 11 badges y la base declara 14 estados: …` |

El tercero es el que importa para tu devolución: reproduce el falso verde y
ahora es rojo.

### 4. Un defecto mío que apareció al medir

El primer intento se cayó en `órdenes/draft`: la fila no aparecía «en ninguna de
las 1 página(s)». No era el producto. Esperar «que haya filas» después de
cambiar el filtro **se cumple al instante con la tabla anterior**, que sigue
dibujada mientras llega la nueva: el caso leía el filtro viejo.

Lo arreglé con una condición que la tabla vieja no puede cumplir a la vez: el
total que declara la base para ese estado —contrastado contra SQL, así que de
paso comprueba que el filtro filtra— y que todo lo dibujado sea de ese estado.
Con el filtro sin poner, sólo el total. El mensaje de error incluye lo que
mostraba el paginador cuando se agotó el tiempo.

Lo digo porque es la clase de espera que produce verdes que no valen, y estaba
en mi código.

### 5. Lo que corrí

- `./scripts/entorno_nativo.sh --recrear` y `SMOKE_CASOS=160`: **1/1**, desde
  base limpia, con los catorce estados enumerados en la salida —cada uno con su
  texto y su color computado— y `el tratamiento de respaldo (rgb(76, 84, 75)) lo
  comparten sólo los 1 que declaran el tono «neutro»`.
- `node --check scripts/smoke.mjs` y
  `git -c core.whitespace=cr-at-eol diff --check`: limpios.
- No corrí suite completa, 145/146, build separado, a11y, contraste ni Backend,
  como pediste.

**Una excepción, y la aviso.** Factoricé los lectores del diccionario, que 145 y
146 también usan. Tu instrucción de no correr 145/146 suponía que el diff no los
tocaba, y dejó de ser cierto por mi cambio. En vez de correrlos, medí lo que
importa directamente: ejecuté la implementación vieja —sacada de
`git show HEAD:`— y la nueva sobre el mismo archivo, y devuelven **exactamente
lo mismo** en los dos diccionarios. `textosDeEstado` no cambió de
comportamiento, así que la premisa de 145 y 146 no cambió. Si preferís la
corrida igual, decímelo.

### 6. Sin rojo, sin intermitente, sin pendiente

No quedó nada rojo ni sin verificar en esta corrección. El 131 ambiental no
entra acá: no corrí la suite completa.

---

## Lo que sigue en cola, y no empecé

- **`CATALOG-PHOTOS-1`**: leído. No lo empecé, porque dijiste que cerrara esta
  corrección y frenara. Queda esperando que la actives.
- **`ACCOUNT-PAGE-1`**: leído. Va después de las fotos; no lo mezclo.

## Deuda anterior, sin tocar

- **`--tg-color-focus` es igual a `--tg-color-brand` (`#1e4a34`)**: cualquier
  superficie verde marca nace con el anillo de foco invisible. Sigue abierto.
- **El monograma transparente es para fondos oscuros**, no para claros.
- **La cuenta publicada**: registro tu decisión: la creaste y verificaste vos en
  una operación aparte, y no requiere acción mía. Le avisé a Emi que la vio con
  sesión iniciada en el sitio publicado.

## Y una cosa que hice fuera de tu canal, y te la digo

Emi pidió en el chat que la landing dejara de mostrar `info@topgreen.com.ar` y
comprobó que en el sitio publicado seguía apareciendo. Con su autorización
explícita llevé a `main` **sólo** `CONTACTO-MARCA-1` (`1c1fc45`): el pie, la
página de Contacto y su caso 161. Nada de `ADMIN-TRUTH-1` ni de
`LOGO-INTEGRATION-1R` fue integrado; siguen retenidos en la rama, como pediste.

Un detalle para que no te sorprenda: en `main` el caso entra numerado **161 con
un hueco en el 160**, porque el 160 es de `ADMIN-TRUTH-1` y ese sigue en la
rama. El hueco se cierra solo cuando integres.
