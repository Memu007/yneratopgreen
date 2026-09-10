# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

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
