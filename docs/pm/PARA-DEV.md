# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** Vos leelo, no lo
edites.

Para responder, escribí en `docs/pm/PARA-PM.md` y pusheá. Ese archivo es
tuyo y la PM no lo toca.

**Antes de cada tarea:**

```bash
git pull origin main
cat docs/pm/PARA-DEV.md
```

---

## Si es tu primer día

Leé **`docs/pm/ONBOARDING-DEV.md`** antes que esto. Está todo: los roles,
cómo levantar el proyecto, las trampas conocidas, las reglas y el estado
real de lo construido. Son diez minutos y te ahorran una semana.

Después volvé acá.

---

## Contexto de esta semana

**El jueves 30 de julio hay demostración con la clienta y se firma el
contrato.** Todo lo de esta semana apunta a esa reunión.

La dev anterior perdió el contexto y no dejó informe. Lo que sigue es lo
que **yo verifiqué contra el código**, no lo que dijo nadie.

---

## Tareas 2, 3 y 4: aprobadas las tres

Revisé el código, no sólo el informe. La transferencia bancaria es la
mejor entrega del proyecto hasta ahora.

**Lo que verifiqué de la transferencia:**

- La cadena de migraciones quedó intacta y la nueva es aditiva: valores de
  enum con `IF NOT EXISTS`, columnas anulables, ningún renombre. Y el
  `downgrade` resuelve bien que PostgreSQL no sepa quitar valores de un
  enum, recreando el tipo. Eso no te lo pedí.
- **La autorización está donde tiene que estar.** Adjuntar comprobante:
  sólo el comprador, `403` para cualquier otro. Validar: sólo el vendedor
  dueño, `403` para cualquier otro. Rechazo sin motivo: `400`. Y el
  estado se verifica antes de cada transición.
- El caso 16 hace exactamente lo que pedí: registra un segundo vendedor,
  confirma el `403`, y recién después aprueba con el correcto
  contrastando contra SQL.
- 18/18 en verde, con el caso 18 manejando Chromium de verdad por todo el
  recorrido.

**Dos cosas que resolviste sin que te las pidiera** y que valen más que
el resto:

1. **Una orden por vendedor** cuando el carrito mezcla publicaciones de
   varios. Eso no estaba en el enunciado y sin eso el flujo se rompía en
   silencio con dos vendedores.
2. Reportaste la corrida previa en 17/18 y el selector ambiguo que la
   causó, en vez de mostrar sólo la buena.

Y la lista de "decisiones no inventadas" —sin conciliación bancaria, sin
definir la transferencia insuficiente, sin avisos por correo— es
exactamente el reflejo correcto. Lo de la transferencia insuficiente va a
las preguntas para la clienta.

**Del relevamiento móvil:** respetaste el cambio de prioridad y no
corregiste nada. El resultado es mejor de lo que esperaba —cero
desbordes, cero errores de consola, cero respuestas fallidas en 36
pantallas— y confirma que aparcarlo fue la decisión correcta.

---

## Para discutir, antes de las tareas: ¿la plataforma toca la plata?

Esto es una discusión, no una instrucción. **Quiero que me contradigas si
ves algo distinto**, porque de acá sale una definición que va al contrato
que se firma el jueves.

### La afirmación que quiero sostener

*"TopGreen no participa de los pagos. El dinero va directo de la cuenta
del comprador a la del vendedor. La plataforma nunca recibe ni retiene
fondos."*

Eso importa mucho más de lo que parece: una plataforma que cobra, retiene
comisión y le gira el resto al vendedor está manejando **fondos de
terceros**, y en la Argentina eso entra en el régimen de proveedores de
servicios de pago, con registro ante el Banco Central. Es otro negocio y
otro riesgo. El contrato pide "checkout básico" y nada más.

### Lo que necesito que verifiques, y es lo importante

El código heredado trae **split payments y OAuth de vendedores** de
Mercado Pago: exactamente el esquema en el que la plataforma sí cobra.

**Si ese código es alcanzable desde la interfaz, la afirmación de arriba
es falsa** y no la podemos poner en un contrato.

Decime, con evidencia:

1. ¿Hay algún camino desde la interfaz que llegue al split o al OAuth de
   vendedores? ¿Botón, ruta, o una respuesta de la API que lo habilite?
2. ¿Los endpoints existen y responden, aunque nadie los llame desde el
   frontend?
3. Si están activos, ¿alcanza con no mostrarlos, o hay que desactivarlos
   en el backend?

**No los borres todavía.** Sólo quiero saber el estado real. La decisión
de qué hacer con ese código es mía, pero no la puedo tomar sin esto.

### Y decime si ves algo que se me escapa

Tres cosas donde tu criterio vale más que el mío:

- **Guardar el CBU en nuestra base.** ¿Te parece bien, o hay una forma
  más prudente? Es dato bancario de gente real.
- **El comprobante como imagen.** Mi lectura es que no prueba nada y que
  por eso está bien que decida el vendedor. ¿Coincidís, o hay algo que se
  pueda validar de verdad sin integrar con un banco?
- **La transferencia insuficiente**, que vos misma marcaste. ¿Se te
  ocurre alguna forma en que el sistema hoy quede en un estado
  inconsistente si eso pasa?

Si algo de esto te parece que estoy exagerando, decilo. Prefiero
discutirlo hoy que descubrirlo con un contrato firmado.

---

## Tarea 5 bis: dejar claro que el comprobante no verifica nada

Chica, va junto con la anterior. Es una decisión de producto, no un
arreglo.

**El problema:** el comprobante que sube el comprador es una imagen. No
prueba absolutamente nada: se falsifica en dos minutos con cualquier
editor. Si un vendedor aprueba mirando el archivo, le pueden robar la
mercadería con un PNG.

El diseño ya es el correcto —decide el vendedor, no el sistema—, pero **la
pantalla no se lo dice**, y eso es lo que hay que arreglar.

### Qué hacer

En la pantalla donde el vendedor aprueba o rechaza, un texto visible antes
de los botones. Con este sentido, y podés ajustar la redacción:

> **Verificá el dinero en tu cuenta bancaria antes de aprobar.** Este
> comprobante es sólo un registro: no confirma que la transferencia se
> haya acreditado.

Y en la pantalla del comprador, cuando ve el CBU, algo que deje claro que
la plataforma no participa del pago:

> El pago es una transferencia directa a la cuenta del vendedor. TopGreen
> no recibe ni retiene el dinero.

### Criterio de aceptación

1. Los dos textos aparecen en sus pantallas, verificado en navegador.
2. El del vendedor está **antes** de los botones de aprobar y rechazar,
   no debajo ni en letra chica.
3. `npm run smoke` en verde.

**No cambies la lógica.** El flujo está bien, falta que la pantalla lo
explique.

---

## Tarea 5: el respaldo de imágenes, en todas partes

Sale de tu propio relevamiento, pero **no es un arreglo de celular**: pasa
igual en una pantalla grande.

Encontraste que en la tabla de administración las imágenes que no cargan
muestran el ícono roto del navegador. Fui a mirar y es peor de lo que
reportaste: **`ProductCard.tsx` es el único componente con `onError`.**

Sin respaldo están el detalle de la publicación, el carrito, el checkout,
el panel del vendedor y el de administración. Todos usan `<img>` pelado.

Eso importa ahora porque **el recorrido de la demostración del jueves pasa
por los cinco**, y las imágenes del seed vienen de `picsum.photos`, que
falla cuando se le antoja. Un ícono roto en la pantalla de checkout
delante de la clienta es exactamente el tipo de detalle que arruina una
reunión buena.

### Qué hacer

Aplicá **el mismo respaldo que ya existe** en `ProductCard.tsx` a los
demás. No inventes uno nuevo ni rediseñes: el que hay ya está aprobado y
verificado en claro y oscuro.

### Criterio de aceptación

1. Ningún `<img>` del recorrido de la demostración queda sin `onError`.
2. Con una URL de imagen rota a propósito, cada una de esas pantallas
   muestra el respaldo y no el ícono del navegador.
3. Un caso en la suite que fuerce el fallo en al menos una pantalla
   distinta del catálogo.
4. `npm run smoke` en verde.

### Lo que NO es esta tarea

No toques el tamaño de los controles ni las pestañas que necesitan
desplazamiento. Eso es de la lista de celular y va al final.

---

## Cambio de prioridad: la vista en celular se aparca

**Terminá la vuelta que estás haciendo, pero cambia qué entregás.**

**No arregles nada de celular.** Sólo entregá el inventario: las capturas,
la lista de lo que está roto, el inventario de consola y el de red. La
información sirve; las correcciones son gasto ahora.

Motivo: el mismo que aplicamos a la seguridad. Faltan por construir
transportistas y el pago por transferencia, que traen pantallas nuevas.
Ajustar hoy lo que va a cambiar es pagar dos veces por lo mismo.

**Las correcciones de celular se hacen al final**, junto con la revisión
de seguridad y antes de desplegar. Están en `NOW.md`.

Si ya arreglaste algo en esta vuelta, dejalo, no lo revirtás. Pero no
sigas.

**Lo que sigue después es la Tarea 4, pago por transferencia bancaria.**
Está más abajo, es contractual y no depende de nadie.

---

## Desbloqueo de la Tarea 2: usá Playwright, no el navegador integrado

**Que no eludieras el bloqueo fue lo correcto, y lo convierto en regla
permanente:** una política de seguridad de tu entorno no se rodea nunca,
ni con CDP, ni con otro navegador, ni con un túnel. Se reporta. Si alguna
vez una tarea mía parece pedirte lo contrario, la tarea está mal.

Dicho eso, **no estás bloqueada**. El camino ya existe en el repositorio y
vos misma lo corriste ayer sin darte cuenta.

### La prueba

Tu propia corrida del smoke dio 12/12, y los casos 09 y 10 son esto:

```
[PASS] 09 Publicar producto como vendedor desde la interfaz — UI + API + DB
[PASS] 10 Fallo de imagen visible sin perder la publicación — UI + DB
```

Esos dos casos **abren Chromium de verdad contra
`http://localhost:5173`**, hacen clic, completan un formulario y suben una
imagen. Mirá `scripts/smoke.mjs`: `chromium.launch()` en la línea 344 y
`page.goto(FRONTEND_URL)` en la 372.

O sea: Playwright llega a localhost en tu entorno. Lo que está restringido
es la herramienta de navegación interactiva, que es otra superficie. **No
la necesitás.**

### Qué hacer

Escribí un script nuevo, `scripts/mobile-audit.mjs`, con el mismo patrón
que `smoke.mjs`. **No lo metas dentro del smoke**: la suite es la red de
seguridad de la demostración y no la quiero tocando a tres días.

Lo que ya está resuelto ahí y podés copiar:

- `chromium.launch({ headless: true })` y `browser.newContext(...)`. Para
  emular teléfono, el contexto acepta `viewport`, `isMobile`, `hasTouch` y
  `deviceScaleFactor`; también podés importar `devices` de `playwright`.
- **El inventario de consola ya tiene patrón**: `page.on('pageerror')` y
  `page.on('console')` están usados en `smoke.mjs` desde la línea 362.
  Copialo, pero **sin filtrar**: yo quiero todo, errores y advertencias.
- Para el inventario de red, `page.on('response')` y anotá las que no
  sean `2xx` o `3xx`.
- Las capturas con `page.screenshot({ path })`, a
  `docs/pm/evidence/mobile-2026-07-26/`.

La captura que dejaste ya está en el lugar correcto. Seguí esa
convención.

### Cambio de orden: hacé la Tarea 3 primero

Reportaste esto:

```
Port 5173 is in use, trying another one...
Port 5174 is in use, trying another one...
Local: http://127.0.0.1:5175/
```

Ese es exactamente el problema que la Tarea 3 resuelve, y te acaba de
costar tiempo dentro de otra tarea. **Hacela ahora, antes de la
auditoría**: una línea en `package.json`, `vite --port 5173
--strictPort`.

Con eso, si el puerto está ocupado Vite falla con un mensaje claro en vez
de arrancar en un puerto que el backend rechaza. Matá los procesos viejos
y arrancá limpio.

Orden nuevo: **Tarea 3, después Tarea 2.**

---

## Tarea 1: aprobada

Evidencia completa y contrastada. Los doce casos en verde, las
subcategorías dan 7/6/7/5/6/4/8, ninguna publicación sin categoría,
ninguna categoría vacía, Acopio con sus dos publicaciones visibles en la
interfaz, y el seed corrido dos veces sin duplicar nada.

**Lo mejor del informe no son los números: es que explicaste el que no
cerraba.** Las consultas dan 32 publicaciones y el seed son 30, y en vez
de dejarlo pasar aclaraste que las dos de más las crea el propio smoke.
Ese es el reflejo que hace que pueda confiar en el resto sin repetir todo.

### Arrancá la Tarea 2 ahora, sin esperarme

Escribiste que quedabas a la espera de la próxima instrucción. **No hace
falta.** La Tarea 2 ya está acá abajo, con sus criterios: eso es lo que
significa que esté escrita en este archivo.

La regla de "una tarea por vez" es para que no mezcles trabajo en un mismo
commit, no para pedir permiso entre tarea y tarea. Terminás, commiteás,
informás y **seguís con lo próximo que esté escrito**. Frenás sólo si algo
se rompe o si tenés que tomar una decisión que es mía.

Leé abajo lo de las skills y los tres criterios nuevos de la Tarea 2 antes
de empezar.

---

## Respuesta a tu informe del bloqueo

Buen primer informe. Los dos hallazgos son correctos y los verifiqué.

### El contenedor: destruilo, tenés autorización

`topgreen-db` pertenece a un checkout viejo de Codex que **ya no está en
uso**: esa dev perdió el contexto y por eso entraste vos. No hay trabajo
activo ahí.

**Que no lo borraras por tu cuenta fue lo correcto.** Ante la duda de
destruir datos de otro, frenar y preguntar es exactamente lo que quiero.
Pero en este caso no se pierde nada, y por diseño:

Esa base **no contiene nada que exista sólo ahí**. Se reconstruye entera
con `alembic upgrade head` más `python -m app.seed`, que es idempotente y
está verificado. Que la base sea desechable fue una decisión explícita del
proyecto, justamente para que nadie quede rehén de un contenedor.

Adelante:

```bash
docker rm -f topgreen-db topgreen-api
```

Y si quedan volúmenes colgados, `docker volume ls` y borrá los de
`topgreen`. Después corré el smoke desde cero.

### Tenías razón sobre `REPO_MAP.md`

Decía "no hay geolocalización todavía, ninguna tabla tiene coordenadas".
Es falso: `localities` tiene `Geography(POINT, 4326)` con índice GIST y
4.028 registros del padrón, y `products.locality_id` referencia ese
padrón. **Ya lo corregí**, con el detalle de cómo está implementado.

Hiciste bien en no editarlo: `docs/pm/` es mío. Reportarlo es lo que
correspondía, y es la regla 6 funcionando —cuando el código y la
documentación se contradicen, gana el código y hay un documento que
arreglar—.

### Sobre la Tarea 1

Revisé tus dos publicaciones de Acopio contra el código: están completas.
Ambas figuran en `product_taxonomy` y en `product_localities`, con slugs
propios y localidades del padrón. Bien resuelto.

Y valoro que declararas que el chequeo de sintaxis con `ast.parse` es
sólo eso, en vez de venderlo como prueba de que funciona. Todavía falta
la evidencia real; ahora la vas a poder generar.

### Tarea 1.3, nueva y chica

El smoke se rompió por un conflicto de nombre de contenedor y no te dio
un mensaje útil. Va a volver a pasar.

En `scripts/smoke.sh`, donde hace la limpieza previa, agregá un
`docker rm -f topgreen-db topgreen-api` tolerante a fallo antes de
levantar. Que la suite se limpie sola en vez de morir con un error de
Docker. **No cambies nada más del script.**

**Ya la hiciste** mientras yo escribía esto, commit `ddde564`. Una línea,
tolerante a fallo, en el lugar correcto y sin tocar nada más. Así.

---

## Tu recomendación de seguridad: aceptada, con fecha

Recomendaste el material de seguridad. **Tenés razón en el fondo y te lo
acepto. La discusión es cuándo, y ahí te la discuto.**

### Por qué no ahora

**Hoy la superficie de ataque es cero.** No hay despliegue, no hay URL
pública, no hay usuarios reales, no hay datos reales y no hay credenciales
de Mercado Pago. Una vulnerabilidad que nadie puede alcanzar no cuesta
nada durante una semana más.

Lo que sí cuesta es el tiempo: a tres días de la demostración, cada hora
va a la vista en celular, que es lo que el cliente **sí** va a tocar el
jueves.

Y hay una razón mejor que la del calendario: **auditar ahora sería
certificar la mitad del sistema.** Faltan transportistas, transferencia
bancaria y la puesta en marcha de los pagos, que son exactamente los
bloques que tocan datos personales y dinero. Revisar antes de que existan
obliga a revisar dos veces.

### Por qué igual va, y en serio

El contrato incluye **90 días de garantía**. Un problema de seguridad que
se despliegue se arregla gratis y con urgencia, en el peor momento
posible. O sea que la revisión no es opcional: es la forma más barata de
no trabajar de más después.

**Queda agendada como condición para desplegar**, al final. La fase 5 no
arranca sin eso. Está anotado en `NOW.md` para que no dependa de que
alguno se acuerde.

### La única excepción, y no es una auditoría

Cuando arranque el módulo de transportistas, **antes de la primera línea**
hay que responder quién puede ver los datos de contacto de quién. Ese
módulo muestra teléfonos, direcciones y ubicaciones de personas reales.

Definido al empezar, es un parámetro. Definido al auditar, es reescribir
el módulo. Está en `NOW.md` con las tres preguntas concretas.

No te toca resolverlo a vos y no es para ahora: es para que cuando te
llegue esa tarea, la pregunta ya venga contestada en el enunciado.

### Lo que ya verifiqué yo, hoy

Hice la parte urgente, que es la única que no puede esperar porque el
repositorio se entrega al cliente y ya lo clonó gente:

- **No hay secretos en el repositorio ni en el historial.** Revisé los
  115 commits: lo único que aparece son marcadores `APP_USR-xxxx` en la
  documentación de pagos.
- `.gitignore` cubre `.env`, `.env.*`, `*.pem` y `*.key`. Sólo están
  versionados los `.example`, con valores `CAMBIAR_*`.
- Las contraseñas se guardan con **bcrypt** y sal por contraseña.
- **CORS no tiene comodín**: es una lista explícita de orígenes.

Nada de esto estaba roto. Bien, pero había que mirarlo.

### Lo que sí adopto desde ahora, porque es gratis

No es trabajo, es una regla. **Estas cosas se preguntan antes de
tocarlas**, aunque parezcan parte de la tarea:

- Flujos de autenticación o cambios en la lógica de sesión.
- Configuración de CORS.
- Manejadores de subida de archivos.
- Permisos, roles y quién puede ver qué.
- Integraciones con servicios externos.
- Nuevas dependencias.

Se suma a la lista de "qué no tocar" del final.

Y tres que ya valen como prohibición permanente: **nunca** un comodín `*`
en CORS, **nunca** un secreto en el código, y **nunca** una traza de error
interna devuelta al usuario.

---

## Sobre instalar skills de agente: no, y qué tomamos igual

Se evaluó instalarte un paquete de skills de agente. **Decisión: ninguna
antes del jueves.**

Motivo: faltan tres días para la demostración y la firma. Cambiar cómo
trabajás y cerrar las tareas pendientes al mismo tiempo es mover dos
variables a la vez, justo cuando menos margen hay para depurar si algo
sale raro. No es un juicio sobre tu forma de trabajar: estás yendo bien.

Y hay una familia que queda descartada siempre: las de especificación,
planificación y registro de decisiones. Eso es literalmente lo que hace
`docs/pm/`. Instalarlas crearía una segunda fuente de verdad, manejada
desde el lado del código y sin el contrato ni la clienta a la vista.

**Pero sí adopto tres cosas concretas**, y valen para la Tarea 2. Están
más abajo, integradas en los criterios.

---

## Estado de la taxonomía

Se cargó la taxonomía real de la clienta en `backend/app/seed.py`, commit
`43911d7`. **Lo verifiqué nombre por nombre y está bien hecho:**

- Los conteos dan exacto: 7 / 6 / 7 / 5 / 6 / 4 / 8 = **43
  subcategorías**, con los nombres literales de la clienta.
- Las cuatro subcategorías "Otros" usan clave compuesta
  `category_id + slug`. Confirmé en el modelo que `Subcategory.slug` no
  tiene índice único global, así que no se pisan entre sí.
- **28 publicaciones, ninguna huérfana.** Todas con categoría y localidad.

**Pero la tarea no está cerrada.** Faltan dos cosas, y son la Tarea 1.

---

## Tarea 1: cerrar la taxonomía

Corta. Sirve además para confirmar que tenés el entorno andando.

### 1.1 Acopio quedó vacío

De las cuatro categorías de servicio, hay publicaciones en Asesoramiento
(3), Contratistas (5) y Logística (2). **Acopio tiene cero.**

En la demostración la clienta va a hacer clic ahí, porque el acopio es un
servicio central del negocio agrícola, y va a ver una categoría vacía.

Agregá **una o dos publicaciones verosímiles** del rubro: recepción y
acondicionamiento de granos, guarda en silo bolsa, secado. Con localidad
del padrón, como todas las demás.

### 1.2 No hay evidencia de que el seed se haya corrido

Es lo que más me importa. Necesito, con la salida pegada en tu informe:

1. **El seed corrido dos veces seguidas**, con la salida de la segunda:
   no se tiene que duplicar nada.
2. **Consulta SQL: subcategorías por categoría.** Tiene que dar
   7/6/7/5/6/4/8 en las siete de la clienta. Acá el número fijo vale,
   porque es la especificación y no un dato que crece con el seed.
3. **Consulta SQL: publicaciones por categoría.** Ninguna en cero.
4. **Consulta SQL: publicaciones sin categoría.** Tiene que dar cero.
5. **`npm run smoke` en verde.**
6. En la interfaz, el filtro de categorías muestra la taxonomía nueva.

Si algo de esto falla, **frená y contame**. Es mejor saberlo hoy que el
jueves.

### El campo de 120 hectáreas: dejalo como está

Vas a ver en Tierras y parcelas una publicación de un campo de
$950.000.000 con botón de agregar al carrito. Sí, es absurdo. **Es una
decisión mía y está en el guión de la demostración a propósito.**

No lo toques, no lo borres, no intentes arreglarlo.

---

## Tarea 2: verificar y arreglar la vista en celular

Después de la Tarea 1.

La clienta es del sector agro: **va a abrir el sitio en el teléfono**, en
la reunión o apenas salga. El contrato pide "plataforma web responsive" y
"diseño optimizado para dispositivos móviles", y nadie lo verificó nunca
en una pantalla chica.

**Tratá esto como no hecho.** La dev anterior dijo haber revisado
catálogo, filtros, detalle, carrito y checkout en 390×844 sin desbordes,
pero no dejó capturas ni informe. Puede servirte como pista de dónde
probablemente **no** están los problemas; no como trabajo hecho.

**Lo que más me preocupa:** los filtros son el centro de la demostración.
El de localidades tiene miles de opciones y el de categorías ahora tiene
12 categorías con 43 subcategorías colgando. En pantalla chica eso puede
volverse una lista impracticable.

### Qué verificar

Con Playwright, desde `scripts/mobile-audit.mjs`. Tamaños: 390×844
(iPhone), 360×800 (Android) y una tableta.

**No uses el navegador integrado**: está restringido por política y ya
sabemos que no llega a localhost. El script sí.

Recorrido completo en cada tamaño:

1. Pantalla inicial y navegación al catálogo.
2. **El panel de filtros**: ¿se ve? ¿se abre y se cierra? ¿provincia,
   localidad y categoría se pueden usar con el dedo?
3. Catálogo: ¿las tarjetas se acomodan o se desbordan?
4. Detalle de una publicación.
5. Carrito y checkout hasta la pantalla de pago.
6. Formulario de publicación, que es largo.
7. Panel de vendedor y panel de administración.

En cada uno mirá: desbordes horizontales, texto cortado, botones
superpuestos o demasiado chicos para el dedo, y elementos que tapen otros.

### Qué arreglar: nada. Anulado

Esta sección quedó sin efecto por el cambio de prioridad de arriba.

**No corrijas nada de celular.** Ni lo roto. Documentalo y seguí. Las
correcciones se hacen al final, cuando estén todas las pantallas que
faltan y se toquen una sola vez.

Lo que sí quiero de esta vuelta: el inventario completo, con el detalle
de qué está roto y cuán roto. Con eso decido cuánto trabajo es, y si algo
resulta tan grave que el jueves se nota, lo reevalúo yo.

### Las tres cosas que adopto del material de skills

Son las únicas que se pisan con trabajo real pendiente. No hace falta
instalar nada: van acá como criterio.

**1. La consola tiene que quedar limpia.** En cada pantalla que visites,
mirá la consola del navegador y anotá errores **y advertencias**. Hoy no
tenemos ni idea de qué tira la aplicación en ejecución, porque nadie
miró nunca.

No arregles las advertencias en esta tarea: **anotalas**. Yo decido qué
se toca. Pero un error de consola en el recorrido de la demostración sí
se arregla, porque es lo que deja pantalla en blanco.

La razón de fondo, que es la historia de este repositorio: *"analizar el
código no reemplaza abrirlo en un navegador"*. Acá se documentó durante
meses funcionalidad que nunca había corrido.

**2. Las peticiones de red también se miran.** Mientras recorrés, mirá
los códigos de estado. Cualquier `4xx` o `5xx` que aparezca sin que la
interfaz avise, anotalo: es un fallo silencioso. Ya tuvimos uno —la
subida de imágenes fallaba sin decir nada— y apareció así.

Cuidado especial con CORS: si ves fallos de origen cruzado, lo más
probable es que Vite se haya corrido de puerto. Es el problema de la
Tarea 3, no un bug nuevo.

**3. Capturas de antes y después, no sólo del resultado.** De cada cosa
que arregles, quiero el par. Sirve para dos cosas: que yo pueda juzgar si
valió la pena tocarlo, y tener material de la reunión del jueves.

### Lo que NO adoptamos, para que quede claro

**Nada de métricas de rendimiento.** LCP, CLS, INP, trazas: fuera de
alcance. No están en el contrato, no se ven en una demostración y abren
un pozo sin fondo a tres días de la firma.

Si notás algo groseramente lento, decilo en una línea y seguí.

### Criterio de aceptación, recortado

Es un relevamiento, no un arreglo. Alcanza con:

1. Capturas de las siete pantallas en 390×844 y en 360×800.
2. **Lista de lo roto**, cada cosa con su pantalla y su tamaño, y una
   marca de gravedad: *impide usar* / *molesta* / *feo*.
3. **Inventario de consola**: errores y advertencias, por pantalla, sin
   filtrar.
4. **Inventario de red**: cualquier respuesta que no sea `2xx` ni `3xx`,
   con la pantalla donde apareció.
5. `npm run smoke` sigue en verde, porque no cambiaste código de producto.

Los tres inventarios son lo que más me sirve. Las capturas son para poder
juzgar sin volver a levantarlo.

---

## Tarea 3, si te queda tiempo

En `package.json`, el script `dev` es `vite` a secas. Si el puerto 5173
está ocupado, Vite se corre solo a otro y el backend lo rechaza por CORS,
con errores que no dicen nada. Ya nos pasó.

Cambialo a `vite --port 5173 --strictPort`, para que falle con un mensaje
claro en vez de arrancar en un puerto que no funciona. **No toques la
configuración de CORS del backend.**

---

## Tarea 4: pago por transferencia bancaria

**Es lo próximo grande, y arrancás con esto cuando cierres el
relevamiento de celular.**

Verifiqué que está en cero: no existe ni un campo de CBU ni de alias en
los modelos ni en los esquemas. Lo único que hay es una mención en
`ContactPage.tsx`.

### Por qué esta y no otra cosa

Es el único bloque contractual grande que **no depende de nadie**.
Transportistas está trabado hasta que la clienta defina zonas o radio;
Mercado Pago está trabado sin credenciales. Este no.

Y en el campo argentino es el que más se va a usar de verdad: nadie
compra una cosechadora con tarjeta.

### Qué pide el contrato, textual

> *"Transferencia bancaria directa: el sistema muestra el CBU/Alias del
> vendedor, el comprador adjunta el comprobante, y el vendedor lo valida
> manualmente."*

Tres cosas. **Ni una más.** Sin conciliación automática, sin avisos por
correo, sin integración bancaria, sin verificar el CBU contra nada.

### El recorrido, mínimo

1. **El vendedor carga su CBU y su alias** en su perfil. Los dos
   opcionales, pero si no tiene ninguno no puede ofrecer transferencia.
2. **En el checkout aparece "Transferencia bancaria"** como medio de
   pago. Al elegirlo se muestran CBU, alias, titular y el monto.
3. **La orden queda esperando comprobante.**
4. **El comprador adjunta el comprobante.** Reutilizá el mecanismo de
   subida que ya existe y ya arreglamos: valida el resultado y avisa el
   motivo si falla.
5. **El vendedor ve las órdenes con comprobante** en su panel y las
   aprueba o rechaza, con un motivo si rechaza.
6. **La orden cambia de estado** según lo que decida.

### Aprobación explícita para tocar el esquema

**Te autorizo a modificar modelos y generar una migración**, sólo para
esto:

- `users`: `cbu` y `alias_bancario`.
- `orders`: referencia al comprobante y los estados nuevos del flujo.

Los estados nuevos se agregan al enum existente, **sin renombrar ni
eliminar los que ya están**. La migración se genera desde los modelos,
como la anterior, y se verifica que un autogenerate posterior no detecte
diferencias.

Todo lo demás del esquema sigue congelado.

### Criterio de aceptación

1. Un vendedor sin CBU ni alias **no puede** ofrecer transferencia.
   Verificado por API.
2. El comprador ve el CBU del vendedor correcto: contrastado contra la
   consulta SQL equivalente, no contra un valor fijo.
3. El comprobante queda guardado y asociado a la orden. Verificado en
   base.
4. Un comprobante fallido **avisa el motivo** y no rompe la orden. Es el
   mismo caso que ya resolviste con las imágenes.
5. Aprobar y rechazar cambian el estado, y el rechazo guarda el motivo.
6. **Un vendedor no puede validar el comprobante de otro.** Verificado
   con dos vendedores distintos.
7. Casos nuevos en la suite de humo que cubran el camino completo y el
   punto 6.
8. `npm run smoke` en verde.

El punto 6 es el que más me importa. Es plata.

### Frená y preguntá si

- Tenés que cambiar cómo funciona el checkout que ya existe.
- El flujo te obliga a tocar Mercado Pago.
- Aparece la duda de qué pasa si el comprador transfiere de menos.
  **Esa la contesta la clienta**, no la inventes.

### Sobre el jueves

**No la apures para que entre en la demostración.** Si queda completa y
verificada, la mostramos y suma mucho. Si queda a medias, no se muestra y
no pasa nada.

Media función en una demostración de firma es peor que ninguna.

---

## Lo que no encaje: se aparca, no se fuerza

Hay preguntas abiertas con la clienta. Si al trabajar encontrás algo que
no entra claro en ninguna categoría:

**No lo fuerces a "Otros" ni inventes una categoría para que entre.**

Dejalo donde está, que la aplicación siga funcionando, y anotalo en tu
informe en una lista aparte: "pendiente de definición". Yo la sumo a las
preguntas para la clienta.

Una lista corta de pendientes explícitos vale más que un mapeo completo
con decisiones inventadas.

---

## Las reglas, en corto

El detalle está en `ONBOARDING-DEV.md`. Lo mínimo:

1. **Si no lo corriste, decí que no lo corriste.** Un "probado" sin salida
   pegada cuenta como no probado.
2. **Una tarea por vez.** Terminás, commiteás, pusheás, informás.
3. **Commit y push apenas termina cada pieza**, antes del informe.
4. **Sos adversarial.** Si te pido algo técnicamente mal, decilo antes de
   hacerlo.
5. **Empezar no necesita permiso.** Lo que está acá ya está aprobado.
6. **Gana el código** cuando la documentación lo contradice. Y avisá.

**Qué no tocar:** el esquema de la base, modelos y migraciones sin
aprobación; funcionalidad que no se pidió; credenciales reales de Mercado
Pago; `docs/PROJECT_STATUS.md`.
