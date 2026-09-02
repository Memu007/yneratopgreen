# PM → Dev

Canal de la PM hacia la dev. **Solo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

Antes de empezar:

```bash
git pull origin main
cat docs/pm/PARA-DEV.md
```

---

## 2026-09-02 — TAREA VIGENTE: CART-RECOVERY-1, recuperar un carrito local inválido

`TRANSFER-REC-1` queda **aceptada** en producto/regresión `14d561b` e informe
`a9c3fbd`. PM verificó build y lint, y ejecutó la suite oficial desde base
limpia: el primer pase dio 140/141 por un rojo viejo en el caso 121; ese caso
pasó 1/1 aislado y la repetición completa cerró **141/141** con salida 0. El
caso nuevo 141 pasó en ambos pases completos. Evidencia completa en
`REPRODUCCION-TRANSFER-REC-1-2026-09-02.md`.

Corrección de alcance: el informe dice por error que `TRANSFER-REVIEW-1` quedó
cerrada. **No quedó cerrada ni fue abierta**; sigue en la cola del roadmap.

### Defecto a reproducir antes de tocar código

Escribí un valor inválido en `localStorage.agromarket_cart` y recargá. Hoy
`CartContext` ejecuta `JSON.parse` sin captura, cae en el `ErrorBoundary` y
«Recargá» vuelve a caer con el mismo dato. Reproducí al menos:

1. JSON malformado;
2. JSON válido cuya raíz no sea un arreglo.

La prueba debe fallar contra `14d561b` por la caída real de la aplicación, no
por buscar texto interno o asumir la implementación.

### Alcance mínimo

1. Si la copia local no puede convertirse en un carrito mínimamente usable,
   descartá **sólo** `agromarket_cart`, arrancá con carrito local vacío y dejá
   la aplicación navegable.
2. Un carrito local válido debe conservarse sin cambios y seguir mostrando sus
   ítems después de recargar.
3. Si existe una sesión con un carrito válido en el servidor, recuperar la
   copia local dañada no debe enviar un `sync` vacío, borrar ni modificar ese
   carrito. El servidor sigue siendo autoridad al entrar al checkout.

### Límites

- Preferencia: corrección mínima en Frontend y regresión de navegador.
- Sin Backend, endpoint, migración, dependencia ni formato nuevo de
  persistencia. Sin refactor general de carrito, autenticación o checkout.
- No limpies tokens, preferencias ni todo `localStorage`; sólo la clave dañada.
- No abras `SERVICE-STATE-1`, administración, navegación, BOEDA, Mercado Pago
  ni otros hallazgos UX. No despliegues.

### Puerta de aceptación

1. Caso nuevo rojo contra `14d561b` y verde después que cubra ambos valores
   inválidos, recarga real y aplicación utilizable.
2. El mismo caso prueba por separado que un carrito local válido sobrevive y
   que un carrito servidor válido no se pierde ni recibe una sincronización
   vacía por la recuperación local.
3. Suite completa desde base limpia con el nuevo total, más build, lint,
   compileall, `pip check`, `diff --check`, accesibilidad y contraste verdes.
4. Producto/regresión en un commit e informe separado en `PARA-PM.md`. Frená
   ahí y pedime revisión; una sola tarea activa.

---

## 2026-09-01 — TAREA VIGENTE: TRANSFER-REC-1, recuperar la transferencia desde Mis compras

`TEST-HARNESS-MAC-1S` queda **aceptada** en corrección `78972cf` e informe
`d24fece`. PM reconstruyó la imagen, creó un volumen documental nuevo y
comprobó crear/leer/borrar como UID 1000. Después ejecutó `npm run smoke` dos
veces en esta Mac: ambas corridas partieron del borrado de contenedores y
volúmenes anterior, terminaron **140/140** y devolvieron salida 0. No hubo
despliegue ni cambio de producto. El lanzador deja DB/API activas al salir por
diseño; la limpieza que garantiza la base nueva ocurre al comienzo de cada
corrida.

### Defecto a reproducir antes de tocar código

Como comprador: checkout por transferencia, crear la orden, cerrar el checkout
sin adjuntar comprobante, recargar la aplicación y entrar a **Mis compras**.
Hoy la orden queda correctamente en `awaiting_transfer_receipt`, pero la vista
sólo permite cancelarla: no recupera los datos bancarios ni ofrece la carga del
comprobante. Guardá una evidencia roja breve de ese recorrido.

El Backend ya entrega en la orden `seller_cbu`, `seller_alias_bancario`,
`seller_bank_holder`, `payment_method` y `order_number`, y ya admite
`POST /orders/{id}/transfer-receipt`. Esta tarea debe consumir ese contrato; no
crear otro.

### Alcance mínimo

1. Mapeá en la orden de comprador los campos existentes que faltan. Para una
   transferencia en `awaiting-transfer-receipt`, Mis compras debe mostrar el
   snapshot de titular y CBU y/o alias, el número de orden como concepto de
   pago y el total correspondiente.
2. Desde esa misma orden permití elegir y adjuntar el comprobante por la ruta
   existente, con el mismo contrato de archivo y autorización del checkout.
   Un error debe quedar legible y permitir reintentar.
3. Al terminar la carga, refrescá la fuente real: la orden debe pasar a
   `transfer-receipt-submitted`, verse como **Comprobante a Revisar** y no
   seguir ofreciendo otra carga como si faltara.
4. La continuidad debe sobrevivir cierre del checkout, reapertura del panel y
   recarga completa. No leas los datos bancarios actuales del perfil: mostrale
   al comprador el snapshot congelado en la orden.

### Límites

- Preferencia: Frontend y regresión. No cambies Backend salvo que una prueba
  discriminante demuestre que el contrato arriba descrito falta de verdad.
- Sin endpoint, migración, estado de orden, almacenamiento ni dependencia
  nuevos. Sin refactor general del checkout o del panel.
- No abras `TRANSFER-REVIEW-1`, `FORM-DIRTY-1`, navegación, administración,
  Mercado Pago, BOEDA ni otros hallazgos UX. No despliegues.
- Conservá cancelación, permisos, validación de archivo y todas las puertas de
  seguridad existentes.

### Puerta de aceptación

1. Regresión de navegador roja contra `d24fece` y verde después: crear la
   transferencia, cerrar antes de adjuntar, recargar, entrar a Mis compras,
   comprobar snapshot/concepto/total, adjuntar y ver **Comprobante a Revisar**.
2. En esa regresión, cambiá los datos bancarios del vendedor después de crear
   la orden y demostrá que Mis compras conserva los originales del snapshot.
3. La suite completa debe cerrar con el nuevo total desde base limpia; además,
   build, lint, compileall, `pip check`, `diff --check`, accesibilidad y
   contraste quedan verdes.
4. Entregá producto/regresión en un commit e informe separado en
   `PARA-PM.md`. Frená ahí y pedime revisión; una sola tarea activa.

## 2026-09-01 — DEVOLUCIÓN VIGENTE: TEST-HARNESS-MAC-1S, dos raíces siguen rojas

La corrección `33e5200` y el informe `501c7e0` **no quedan aceptados todavía**.
El caso 131 sí queda bien resuelto en Alpine, pero la corrida oficial de PM en
macOS/Docker Desktop dio **97/140**. La reproducción y las pruebas focales están
en `REPRODUCCION-SMOKE-PM-2026-09-01.md`.

No son 43 arreglos. Persisten dos raíces:

1. **Separá la URL pública de la interna.** Compose pisa hoy
   `MP_AUTH_BASE_URL` y `MP_API_BASE_URL` con `host.docker.internal`. La primera
   construye la URL que recibe el navegador: macOS no resuelve ese hostname y
   los casos 62–66 fallan con `fetch failed`. Dejá `MP_AUTH_BASE_URL` en
   `127.0.0.1:8099`, como la escribe `smoke.sh`, y sobrescribí sólo
   `MP_API_BASE_URL` para que la API dentro del contenedor llegue al host. PM
   probó que host→loopback y contenedor→`host.docker.internal` responden ambos
   HTTP 401 en el endpoint vacío del doble.
2. **Prepará el destino del volumen privado en la imagen.** Un volumen nuevo
   montado en `/data/documentos` da `PermissionError` con UID 1000. El control
   en `/data/uploads` permite crear, leer y borrar. La diferencia es que el
   Dockerfile crea/chown-ea uploads pero no documentos. Agregá
   `/data/documentos` al directorio privado preparado antes de cambiar a
   `appuser`, o una solución mínima equivalente. Sin `chmod 777`, sin carpeta
   pública y sin nginx.

### Alcance y puerta

- Conservá el arreglo del caso 131 y todo lo válido de `4b1a493`/`33e5200`.
- Podés tocar `docker-compose.yml`, el paso de directorios del Dockerfile y el
  arnés sólo si hace falta afirmar las dos propiedades. No cambies producto,
  dependencias, migraciones, seed, Railway ni datos.
- Antes de la suite completa, probá: URL de autorización resoluble en host,
  intercambio del contenedor contra el doble y crear/leer/borrar como
  `appuser` sobre un volumen documental **nuevo**.
- Después pedime otra vez dos corridas oficiales: `npm run smoke` debe dar
  **140/140 dos veces**, cada una desde base limpia en esta Mac.
- Entregá corrección e informe separados. No abras `TRANSFER-REC-1` y no
  despliegues.

## 2026-08-31 — DEVOLUCIÓN VIGENTE: TEST-HARNESS-MAC-1R, la puerta oficial sigue roja

La entrega de arnés `4b1a493` e informe `eb719c2` **no queda aceptada**. La
honestidad del informe fue correcta y PM confirma que CRLF, el ayudante de
Settings, las sustituciones 86/110, la lectura interna de documentos y el
rótulo del lanzador están bien orientados. Pero la prueba que faltaba dio
**96/140** en macOS/Docker Desktop.

No son 44 arreglos. PM aisló tres raíces:

1. **Doble MP inaccesible (33 rojos):** Compose usa
   `host.docker.internal`, pero `levantarDoble()` sigue con
   `servidor.listen(..., '127.0.0.1')`. Ligalo a una interfaz alcanzable desde
   el contenedor. Es un servidor de prueba con valores inventados; no cambies
   URLs ni seguridad del producto. Verificá desde `topgreen-api` que responde
   antes de correr la suite completa.
2. **Carpeta documental no escribible (10 rojos):** el log real muestra
   `PermissionError` sobre `/app/documentos`. En la configuración local de
   Compose, dale al API una `DOCUMENTOS_DIR` privada y escribible bajo `/data`,
   separada de `/data/uploads`. No hagas `chmod 777`, no muevas documentos a la
   carpeta pública y no cambies el servicio de producto. Comprobá escritura y
   borrado como `appuser` dentro del contenedor.
3. **Detección BSD sed falsa (caso 131):** la sonda de una sola expresión
   clasifica macOS como compatible, pero la receta real de dos `-e` falla. La
   suite ya depende de Docker: eliminá la heurística y ejecutá siempre la receta
   extraída dentro de `alpine:3`. Es más corto y prueba el entorno real del
   Dockerfile.

Los 33 fallos MP son 62–66, 70, 75–100 y 117. Los 10 de documentos son 101–109
y 116. El restante es 131. La corrida filtrada 2,3,6,101–109 reprodujo el 500
documental por separado. Evidencia completa en
`REPRODUCCION-SMOKE-PM-2026-08-31.md`.

### Alcance de la devolución

- Podés tocar únicamente `scripts/lib/mp-doble.mjs`, `docker-compose.yml` y la
  rama del caso 131 en `scripts/smoke.mjs`, además del informe final.
- Conservá los arreglos válidos de `4b1a493`; no reescribas el arnés completo.
- No cambies producto, dependencias, migraciones, seed, Railway ni datos.
- No saltees casos ni abras TRANSFER-REC-1. No despliegues.

### Puerta de aceptación

1. Pruebas focales: contenedor→doble responde; `appuser` crea/lee/borra en la
   carpeta documental privada; receta CSP válida pasa en Alpine y variables
   vacías fallan.
2. `npm run smoke` oficial **140/140 dos veces**, cada vez desde base limpia en
   la Mac de PM. Dev puede aportar su verde nativo, pero no sustituye esta
   puerta; al terminar pedime expresamente las dos corridas de PM.
3. Conservá las puertas estáticas anteriores y entregá commit de corrección e
   informe separados. No despliegues.

## 2026-08-31 — TAREA VIGENTE: TEST-HARNESS-MAC-1, hacer oficial la reproducción local

TEST-IMG-1 queda aceptada en prueba `4c015f0` e informe `cb0875b`. PM revisó el
diff y reprodujo sintaxis, build, lint y `diff --check`. La consulta excluye
publicaciones llenas, afirma su precondición y mantiene el aumento exacto de
una imagen. El ajuste extra `fa8b382` también queda aceptado por separado:
reutiliza `esperarA`, vuelve a resolver los botones del caso 140 durante la
espera y conserva la misma aserción semántica. No hubo producto ni despliegue.

### Defecto confirmado por PM

En macOS con Docker Desktop, `npm run smoke` no es hoy una puerta oficial
reproducible. La evidencia completa está en
`docs/pm/REPRODUCCION-SMOKE-PM-2026-08-31.md`. Son cinco defectos del arnés:

1. `.env.example` mezcla finales CRLF/LF y el bootstrap deja `\r` en variables
   de base;
2. el proceso dentro de Docker necesita una URL alcanzable del host, mientras
   navegador y comprobaciones locales usan loopback;
3. los casos 86 y 110 agregan claves dotenv ya existentes y no prueban el valor
   que creen haber reemplazado;
4. el caso 105 intenta leer desde macOS una ruta que sólo existe dentro del
   contenedor;
5. el caso 131 ejecuta en BSD `sed` una receta que pertenece a Alpine/GNU.

PM reconstruyó un entorno descartable correcto y obtuvo 136/140. Las cuatro
propiedades rojas pasaron al ejecutarlas en el contexto correcto, y la imagen
Railway construyó. Esto no autoriza a declarar 140/140: hay que corregir el
lanzador y los casos.

### Resultado esperado

Un checkout limpio en macOS con Docker Desktop ejecuta **el comando oficial**
`npm run smoke` y termina 140/140, sin configuración manual ni ejecución
directa alternativa. La solución conserva compatibilidad razonable con Linux,
no debilita aserciones y no agrega dependencias.

### Alcance mínimo

- Tocá sólo el arnés y su documentación inmediata: `scripts/smoke.mjs`,
  `scripts/smoke.sh`, `scripts/init_local_db.sh`, `docker-compose.yml` o los
  ejemplos de entorno únicamente si cada archivo resulta necesario.
- Normalizá o limpiá `\r` en el único punto de lectura que gobierna el
  bootstrap; no repartas parches por variable.
- Separá explícitamente la URL que usa el contenedor para alcanzar el host de
  la URL loopback del navegador, usando una capacidad nativa de Docker Compose
  que funcione en Docker Desktop y Linux.
- Para 86/110, reemplazá la clave existente de forma única y verificá que no
  queden duplicados antes de instanciar Settings.
- Para 105, verificá archivos donde realmente viven —dentro del contenedor o
  mediante una frontera pública ya existente— sin exponer rutas internas.
- Para 131, ejecutá la receta CSP en el entorno para el que fue escrita o
  volvela portable con herramientas ya disponibles. La imagen final debe
  seguir demostrando que recibió los valores esperados.
- Corregí el rótulo obsoleto de cantidad de casos del lanzador si todavía dice
  117. No abras ninguna otra limpieza.

### Fuera de alcance

- Sin cambios en `backend/`, `src/`, migraciones, seed, reglas de negocio,
  dependencias, Railway ni datos persistentes.
- No saltees casos por sistema operativo, no conviertas fallas en warnings y no
  reduzcas controles de seguridad.
- No vuelvas a modificar los casos 116/140 salvo que una prueba discriminante
  demuestre que esta pieza los rompe.
- No empieces TRANSFER-REC-1 ni hallazgos UX. No despliegues.

### Puertas de aceptación

1. Reproducción roja breve de cada uno de los cinco defectos antes del cambio y
   explicación del punto único corregido.
2. `npm run smoke` 140/140 dos veces, cada vez desde una base limpia creada por
   el propio lanzador, en macOS/Docker Desktop.
3. Evidencia de que Linux conserva el camino: configuración Compose válida y
   sin ramas que salteen casos; si no hay host Linux disponible, declararlo sin
   inventar un verde.
4. `node --check scripts/smoke.mjs`, `bash -n` de los guiones tocados, build,
   lint, compileall, `pip check` y `diff --check` en verde.
5. Un commit de arnés y otro separado con el informe en `PARA-PM.md`. No
   producto, no dependencias, no despliegue.

Después de aceptación corresponde TRANSFER-REC-1. No la abras en este turno.

## 2026-08-31 — TAREA VIGENTE: TEST-IMG-1, quitar el azar del caso 116

ORD-SELF-1R queda aceptada en producto `40b589b` e informe `99e828f`. La
corrección mueve `get_or_create_cart()` después de todas las validaciones de
`/cart/sync`; la regresión separa `/items` de `/sync`, se pone roja contra
`ecbb375`, conserva cero carritos ante dos rechazos distintos y demuestra que
un sync vacío válido sigue creando su carrito. PM reprodujo build, lint,
compileall, sintaxis del guion de entorno y `diff --check` con la política CRLF.
Docker local sigue apagado, por lo que 140/140 permanece como evidencia de Dev.

### Hallazgo reproducido por Dev y confirmado por PM

El caso 116 elige una publicación del vendedor con:

```sql
SELECT id FROM products WHERE seller_id = ... ORDER BY id LIMIT 1
```

Los IDs del seed son UUID aleatorios y una de las dieciséis publicaciones ya
tiene el máximo de tres imágenes. Cuando esa queda primera, la carga positiva
con Bearer responde `400`; el caso se pone rojo aunque la defensa CSRF siga
correcta. La frecuencia informada y coherente con ese estado es cercana a
1/16. Además, la aserción actual omite el cuerpo de la respuesta y esconde el
motivo real.

### Resultado esperado

El caso 116 conserva exactamente su objetivo de seguridad, pero elige de forma
determinista una publicación del vendedor que tenga lugar para al menos una
imagen. Si la carga positiva falla, el error muestra estado y cuerpo. Ninguna
línea de producto cambia.

### Alcance mínimo

- Tocá sólo `scripts/smoke.mjs` y después `docs/pm/PARA-PM.md` en el commit de
  informe.
- Reemplazá la selección azarosa por una consulta que cuente imágenes por
  publicación y exija `COUNT < 3` antes de elegir. No hardcodees un UUID ni el
  nombre de una publicación del seed.
- Afirmá antes de la carga que el candidato existe y que su conteo inicial es
  menor que tres; después debe aumentar exactamente en uno.
- Si `imagenConCabecera` falla, incluí en la aserción HTTP y cuerpo serializado,
  como ya hace la carga de documentación.
- Demostrá en una base descartable controlada que la consulta anterior podía
  seleccionar una publicación llena y que la nueva la excluye. No cambies el
  límite real de tres ni vacíes imágenes para fabricar un verde.

### Fuera de alcance

- Sin cambios en `backend/`, `src/`, migraciones, seed, imágenes reales,
  dependencias, Railway ni datos persistentes.
- No arregles `GET /cart`, `get_or_create_cart` ni ningún hallazgo de las
  auditorías UX en esta pieza.
- No hagas limpieza general de la suite ni cambies otros casos intermitentes.
- No despliegues.

### Puertas de aceptación

1. Reproducción controlada del defecto de selección anterior y exclusión
   comprobada por la consulta nueva.
2. Caso 116 verde y repetible; las cuatro mutaciones siguen rechazando cookie
   sola y aceptando Bearer.
3. Suite 140/140 dos veces desde bases limpias y caso 116 dos veces sobre una
   misma base si sus demás precondiciones lo permiten; si no, explicar la
   precondición exacta en vez de borrar estado.
4. `node --check scripts/smoke.mjs`, build, lint, compileall, `pip check`,
   `diff --check`, accesibilidad, contraste e hito en verde.
5. Un commit de prueba y otro separado con el informe. No desplegar.

Después de aceptar TEST-IMG-1, la siguiente pieza del roadmap es
TEST-HARNESS-MAC-1 y recién después TRANSFER-REC-1; no abras ninguna en el
mismo turno. PM reprodujo el 31/08 cinco defectos de portabilidad/configuración
del arnés, no del producto. La evidencia y el alcance futuro están en
`docs/pm/REPRODUCCION-SMOKE-PM-2026-08-31.md`. **No los corrijas dentro de
TEST-IMG-1.**

## 2026-08-31 — DEVOLUCIÓN VIGENTE: ORD-SELF-1R, `/cart/sync` no crea un carrito al rechazar

La entrega ORD-SELF-1 de producto `ecbb375` e informe `bbdf05d` **no queda
aceptada todavía**. La regla central, las defensas de checkout y el estado de
interfaz son correctos, pero la evidencia afirma una propiedad que el camino de
sincronización no cumple.

### Brecha confirmada por PM

En `backend/app/api/cart.py`, `sync_cart()` ejecuta
`get_or_create_cart(db, current_user.id)` antes de resolver y validar los ítems.
Ese helper hace `commit` cuando no existe carrito activo. Por lo tanto, una
cuenta sin carrito que envía su propia publicación recibe el `409` correcto,
pero puede quedar con un carrito `ACTIVE` nuevo y vacío.

El caso 140 no discrimina este borde:

- prueba `/cart/sync` con el vendedor después de haberle creado un carrito
  ajeno legítimo;
- la cuenta sin carrito es el admin, pero con ella sólo prueba
  `POST /cart/items`, no `POST /cart/sync`;
- la lectura estática sólo comprueba que la regla compartida aparezca en los
  archivos, no que preceda a `get_or_create_cart`.

Por eso no alcanza para sostener en el informe que el freno de sync va antes de
la creación ni que ambos endpoints conservan cero carritos.

### Corrección mínima

- En `/cart/sync`, resolvé y validá el payload completo antes de crear un
  carrito. Recién después de pasar publicación propia, existencia, estado,
  stock y contrato monetario se puede obtener o crear el carrito y reemplazar
  sus ítems.
- No cambies el comportamiento válido: un sync vacío válido puede seguir
  representando un carrito vacío según el contrato actual; si mover la creación
  vuelve ambiguo ese caso, frená e informalo antes de decidir.
- Extendé el caso 140 con una identidad que no tenga ningún carrito: enviá por
  `/cart/sync` una publicación propia, exigí `409` y comprobá en SQL que tanto
  `carts` como `cart_items` permanecen en cero.
- La nueva aserción debe ponerse roja contra `ecbb375` por la fila de carrito
  creada y verde después de la corrección. No alcanza con cambiar una
  comprobación estática.
- Corregí en el informe la afirmación falsa sobre el orden de
  `get_or_create_cart` y separá qué prueba `/items` de qué prueba `/sync`.

### Fuera de alcance

- No toques otros hallazgos de las auditorías UX, navegación, transferencias,
  administración, Mercado Pago, Railway, seed ni datos.
- No limpies carritos históricos ni cambies mensajes, interfaz o la excepción
  deliberada de cotización.
- No arregles el caso 116 dentro de esta devolución. Queda registrado como el
  siguiente bloque corto de confiabilidad de pruebas.
- No despliegues.

### Puertas de aceptación

1. Rojo verificable contra `ecbb375` y verde con la corrección para
   `/cart/sync` sin carrito previo.
2. `409` con el mismo mensaje; cero filas nuevas en `carts`, `cart_items`,
   órdenes, pagos, reservas y notificaciones.
3. El sync mixto conserva entero un carrito anterior y el sync ajeno válido
   sigue funcionando.
4. Suite completa desde base limpia, build, lint, compileall, `pip check`,
   `diff --check`, accesibilidad, contraste e hito en verde.
5. Un commit de producto y otro separado con el informe en `PARA-PM.md`.

Cuando ORD-SELF-1R quede aceptada, la siguiente pieza será TEST-IMG-1: volver
determinista el caso 116 sin cambiar producto. La cola completa y su relación
con las tres auditorías está en
`docs/pm/ROADMAP-CIERRE-MVP-2026-08-31.md`.

## 2026-08-30 — TAREA VIGENTE: ORD-SELF-1, nadie compra su propia publicación

UX-COH-1S queda aceptada en `aadecb5` con informe `6d14d1d`. La espera fija del
caso 139 fue reemplazada por `esperarA`, una condición real ya existente; PM
reprodujo build, lint, compileall, `diff-check` y que el cambio no toca
`src/` ni Backend. Docker sigue apagado para PM, por lo que 139/139 permanece
como evidencia de Dev. Las otras esperas fijas informadas no pertenecen a esta
tarea y no se limpian en bloque.

### Hallazgo P1 reproducido

Una cuenta autenticada puede agregar al carrito una publicación cuyo
`seller_id` es su propio `user.id`. La interfaz tampoco distingue ese caso. Es
un estado de negocio inválido: si llega a checkout, comprador y vendedor serían
la misma persona y se contaminarían órdenes, stock, pagos, calificaciones y
notificaciones.

### Resultado esperado

La regla vive en el servidor y se aplica antes de escribir: una cuenta nunca
puede agregar, sincronizar ni convertir en orden una publicación propia. La
interfaz evita ofrecer la compra cuando ya conoce que la publicación es de la
sesión actual; el Backend sigue siendo autoridad frente a URL directa, carrito
viejo o llamada manual.

### Alcance mínimo

- Cerrá `POST /cart/items` y `POST /cart/sync` cuando
  `product.seller_id == current_user.id`, con el mismo `409` y un mensaje
  accionable. El rechazo no crea carrito, no borra ni reemplaza el existente y
  no cambia cantidades.
- Agregá una segunda defensa en el servicio compartido que prepara el checkout,
  antes de la primera orden o efecto. Debe cubrir tanto transferencia como
  Mercado Pago y un carrito legacy ya contaminado. Si `payment-options` consume
  ese carrito antes del checkout, tampoco debe presentar a la propia cuenta
  como contraparte válida.
- En tarjeta y detalle, si la sesión coincide con `product.seller.id`, el CTA de
  compra no agrega ni abre checkout. Mostrá un estado honesto y no accionable,
  **«Tu publicación»**. No construyas edición, mensajería ni navegación nueva.
- Si un carrito local anterior contiene una publicación propia, no la borres en
  silencio: al sincronizar o continuar debe explicar que hay que quitarla.
- Aplicá la regla a productos y servicios comprables. No cambies el flujo de
  cotización sin precio, porque hoy no crea compra ni orden.

### Fuera de alcance

Sin migración, seed, limpieza de carritos históricos, rediseño, cambios de
precio/stock, pagos, Mercado Pago, logística, ratings, navegación Atrás,
performance, Railway ni despliegue. No agregues dependencias.

### Criterios ejecutables

1. Una regresión roja contra `aadecb5` demuestra que el vendedor puede agregar
   su propio producto. En verde, `/cart/items` y `/cart/sync` responden `409`
   sin filas nuevas ni cambios al carrito previo.
2. Inyectá sólo en la base descartable un carrito legacy con un ítem propio. Los
   medios de pago y ambos checkouts lo rechazan antes de crear orden, reservar
   stock, notificar, preparar preferencia o escribir pago; el carrito queda
   activo para que la persona quite el ítem.
3. Un carrito mixto con una publicación propia y otra ajena se rechaza entero;
   no compra parcialmente la ajena. Tras quitar la propia, la ajena conserva el
   recorrido normal.
4. En Inicio, Mercado y Servicios, tarjeta y detalle de una publicación propia
   muestran «Tu publicación» y no modifican el carrito. Una publicación ajena
   conserva las etiquetas y acciones aceptadas en UX-COH-1R.
5. La regla no depende del rol declarado: aplica también a admin o transportista
   si publican y navegan con la misma identidad.
6. La suite completa queda al menos 140/140 desde base limpia, dos veces. Build,
   lint, compileall, `pip check`, a11y, contraste, hito y `diff-check` quedan
   verdes. Producto e informe van en commits separados.

### Freno

Frená si impedirlo exige borrar datos existentes, cambiar el contrato de pagos
o decidir qué hacer con órdenes históricas donde comprador y vendedor ya sean
iguales. Traé cantidad y evidencia; no las repares. No arregles B4/C1–C3 ni las
esperas fijas restantes.

Respondé sólo en `docs/pm/PARA-PM.md`, avisale a Emi y frená. **No despliegues.**

---

## 2026-08-30 — UX-COH-1S, devolución histórica ya aceptada

Este bloque conserva la devolución que originó `aadecb5`; quedó cerrada y
aceptada en la tarea vigente de arriba.

La funcionalidad de `ee14047` queda **aceptada**: las tres superficies reales
de `ProductCard` usan el mismo Login, tarjeta y detalle no producen efectos
silenciosos y el activo dice «Agregar al carrito». También acepto el ajuste
antes/después del caso 138 y los selectores `exact: true`.

En ese momento la entrega no quedó cerrada por una contradicción verificable entre el
informe y la regresión nueva. El caso 139 contiene:

```js
await page.waitForTimeout(1200);
```

El informe afirma que no se usaron esperas y el freno de UX-COH-1R prohibía
esperas fijas para forzar el verde. En una máquina lenta, 1,2 segundos no
demuestran que el carrito vaya a actualizarse; sólo demuestran que a la máquina
de la Dev le alcanzó ese tiempo.

### Corrección única autorizada

- Reemplazá esa espera por una espera de condición real y acotada: el carrito
  pasa de cero a uno después del segundo gesto. Puede ser `waitForFunction` o
  la primitiva equivalente ya disponible; el timeout debe fallar con un mensaje
  accionable.
- Corregí en `PARA-PM.md` la afirmación sobre esperas y reportá rojo contra
  `ee14047`, verde después de la corrección y dos corridas completas desde base
  limpia.
- No cambies comportamiento, copy, componentes, Backend, datos, seed, pagos,
  Mercado Pago, Railway ni otros hallazgos UX. No agregues dependencias y no
  despliegues.
- La suite debe quedar al menos 139/139; build, lint, compileall, `pip check` y
  `diff-check` siguen siendo puertas. Producto y corrección del informe van en
  commits separados.

Cuando termines, respondé sólo en `docs/pm/PARA-PM.md`, avisale a Emi y frená.
El siguiente bloque será impedir que una persona compre su propia publicación,
pero **no lo abras todavía**.

---

## 2026-08-06 — Corrección logística `823c3fe`: aceptada

La puerta de UX/UI de logística de Fase 1 queda cerrada con `823c3fe` y su
informe `a2e5abb`.

Verificación independiente de PM:

- el conjunto visible sale del origen y destino actuales;
- las 12 combinaciones de pedido y destino producen 22 tarjetas coherentes;
- ninguna distancia a origen ni a destino supera el radio;
- cambiar destino fuerza `elegido = null` y `necesitaFlete = true`;
- por eso desaparece el contacto y el checkout vuelve a bloquear.

La frase del informe que dice que el pedido B no muestra a Ledesma es
incorrecta: la tabla sí lo muestra en cinco destinos. Es un error narrativo
menor, no del prototipo, y no reabre la entrega.

No vuelvas a tocar el prototipo salvo una devolución nueva. Cuando la Pieza B
productiva lo reemplace, se decidirá si se conserva como evidencia o se elimina.

---

## 2026-08-06 — Contraste `10b830f`: base aceptada, pieza abierta

La dev hizo bien en frenar y reportar: la orden decía explícitamente no ampliar
el alcance si la medición encontraba una deuda mayor. Se aceptan los cambios de
`10b830f` como base correcta —tokens de texto, gradiente primario y 12 usos—,
pero **la tarea no queda cerrada** porque el criterio 1 sigue incumplido.

Decisión de PM sobre las dos paletas: **opción 2**. No se unifican ni se
rediseña la marca, y tampoco se difiere la deuda visible a Fase 5. Se corrigen
sólo las parejas texto/fondo que fallan, conservando la paleta emerald global y
la paleta oliva de los componentes.

---

## Tarea activa única: cerrar el contraste del tema claro

Continuá sobre `10b830f` y corregí los aproximadamente treinta selectores
fallidos que ya identificaste en los ocho componentes.

### Alcance

- Sólo los selectores visibles que el barrido confirmó por debajo de **4,5:1**
  para texto normal o **3:1** para texto grande e iconos informativos.
- Conservá las dos familias cromáticas. Elegí, para cada caso, el tono más
  cercano de la misma familia que cumpla; en gradientes podés oscurecer el
  extremo claro o reforzar el overlay sin cambiar layout ni composición.
- Las estrellas que comunican calificación deben alcanzar 3:1 contra el fondo.
  Si alguna marca es puramente decorativa, documentala como tal y no la cuentes
  como información.
- Para texto sobre foto, medí el overlay efectivo y verificá visualmente los
  extremos claros y oscuros de la imagen; no declares aprobado un caso que el
  medidor no puede resolver.
- Reutilizá los tokens creados donde corresponda. No hace falta convertir toda
  la paleta oliva en tokens para cerrar esta pieza.

### Fuera de alcance

- Sin rediseño, unificación de paletas, cambio de layout ni tema oscuro.
- Sin backend, seed, API, logística, dependencias nuevas ni `axe` todavía.
- No normalices CRLF ni abras un diff masivo de higiene.
- No corrijas colores de bordes o decoración si no fallan como texto o control.

### Criterios de aceptación

1. El mismo recorrido principal medido en **1440×900 y 390×844** termina con
   cero textos visibles por debajo del mínimo. Los casos sobre imagen que no
   puedan automatizarse quedan verificados y explicados uno por uno.
2. Gradientes y overlays cumplen en todo su recorrido, no sólo en un extremo.
3. No aparecen desbordes nuevos, pérdida de foco, errores de consola ni cambios
   de jerarquía visual.
4. El informe trae cantidad de selectores fallidos antes/después y una tabla
   breve por selector/uso con texto, fondo y ratio final.
5. `npm run build`, la suite **25/25** y
   `git -c core.whitespace=cr-at-eol diff --check` quedan en verde.
6. Un commit de código y otro separado con el informe en `PARA-PM.md`.

Cuando esto quede aceptado, la pieza siguiente será incorporar
`@axe-core/playwright` como control automático separado, tal como quedó
registrado en `CRONOGRAMA.md`.

---

## 2026-08-09 — Contraste `918c4b9`: aceptado

La corrección de contraste queda cerrada con el código `918c4b9` y el informe
`0d1f1b5`.

Verificación independiente de PM desde el estado publicado en GitHub:

- el diff queda limitado a 18 archivos visuales, sin backend ni cambio de flujo;
- la compilación de TypeScript y Vite termina en verde;
- `git -c core.whitespace=cr-at-eol diff --check` no encuentra errores;
- la suite oficial recreada desde una base local limpia termina **25/25**;
- el filtro combinado por provincia y localidad vuelve a coincidir con SQL;
- las estrellas ya no dependen sólo del color: usan forma llena y vacía.

Se acepta dejar los controles deshabilitados con su aspecto actual: oscurecerlos
haría que parecieran disponibles y WCAG no exige contraste mínimo para ese
estado. También se confirma una deuda distinta, no de contraste: hay cuatro
apariciones visibles, en tres contextos, que todavía llaman `AgroMarket` a un
producto cuya marca es TopGreen. Se corrige en la pieza siguiente antes de
cualquier demostración.

---

## Tarea activa única: puerta automática de accesibilidad e identidad visible

Es una pieza mínima de cierre de Fase 1. No abras desarrollo de las Fases 2 a 5.

### Alcance

1. Cambiá sólo las cuatro apariciones visibles de `AgroMarket` por `TopGreen`:
   las dos variantes del encabezado y los textos comerciales de inicio y panel.
   El nombre técnico del paquete y el comentario histórico pueden quedar como
   están; no hagas una migración de nombres internos.
2. Incorporá `@axe-core/playwright` sobre el Playwright ya existente y agregá
   un comando dedicado y documentado, por ejemplo `npm run a11y`.
3. Medí en 1440x900 y 390x844 las rutas principales públicas y autenticadas:
   inicio/catálogo, ingreso, registro, detalle, carrito/checkout y los paneles
   de comprador, vendedor y administración.
4. El control debe fallar ante violaciones `serious` o `critical` y reportar
   regla, ruta y elemento afectado. No reemplaza el barrido de contraste ni la
   suite funcional.

### Límite adversarial

Primero medí. Si aparecen más de diez familias distintas de fallas o alguna
corrección exige rediseño, backend o cambio de flujo, frená y traé el inventario
a PM antes de ampliar el alcance. Dentro de ese límite, corregí sólo problemas
semánticos pequeños y evidentes. Sin dependencias adicionales, salvo
`@axe-core/playwright`; sin tema oscuro ni retoques cosméticos.

### Criterios de aceptación

1. Ningún texto visible de la interfaz dice `AgroMarket`; la marca mostrada es
   `TopGreen` y no cambia el layout.
2. El comando de accesibilidad es reproducible, cubre las dos medidas y termina
   con cero violaciones `serious` o `critical` en el recorrido acordado.
3. `npm run build`, `npm run a11y`, la suite oficial **25/25** y
   `git -c core.whitespace=cr-at-eol diff --check` quedan en verde.
4. Un commit de código y otro separado con el informe en `PARA-PM.md`. El
   informe lista rutas/medidas, resultado antes/después y cualquier regla menor
   que se haya decidido no bloquear.

---

## Nota de PM — mejora aprobada para Fase 3, no es la tarea activa

No la implementes durante la pieza de accesibilidad. Cuando corresponda cerrar
buscador y catálogo en Fase 3, la ubicación del detalle deja de ser texto
muerto:

- si la publicación tiene sólo provincia, hacer clic lleva al marketplace con
  esa provincia aplicada;
- si tiene localidad oficial, aplica provincia y localidad;
- el modal se cierra, la URL refleja los filtros y recargar conserva el mismo
  resultado;
- el conjunto mostrado debe coincidir con la consulta equivalente de la API y
  SQL, como en la evidencia actual de filtros.

La fuente debe ser la ubicación oficial de la **publicación**, no el texto libre
del perfil del vendedor. Hoy el detalle toma `seller.location`, invierte sus
partes y por eso puede mostrar `Argentina, Córdoba`; no construyas navegación
sobre ese dato incorrecto. Esto probablemente exige exponer provincia y
localidad en las respuestas públicas del catálogo.

Límite: reutilizar filtros existentes. Sin mapa, GPS, distancias, ranking ni
recomendaciones. Como mejora hermana, evaluá si el breadcrumb de categoría y
subcategoría del mismo detalle puede llevar al catálogo filtrado reutilizando
el mismo patrón; proponelo antes de implementarlo.

Desde ahora, al revisar una pantalla podés proponer mejoras de este tipo en
`PARA-PM.md`, pero no ejecutarlas sin aprobación. Cada propuesta debe traer en
cinco líneas: problema observado, beneficio para el usuario, reutilización o
cambio necesario, esfuerzo estimado y fase recomendada. PM decide si entra, se
posterga o se rechaza; no se arma una lista de ideas sin evidencia.

---

## 2026-08-09 — `83c4b59`: producto aceptado, puerta todavía abierta

Se aceptan la corrección visible `AgroMarket` → `TopGreen`, los nombres
accesibles, los cambios semánticos de autenticación, los colores del panel y el
ajuste legítimo del caso 20. PM reprodujo `npm run a11y -- --todas`: 40
pantallas, cero violaciones de cualquier impacto. La compilación también queda
verde y el diff funcional está acotado.

Decisiones solicitadas:

- **conservar** `npm run contraste`; la evidencia debe quedar reproducible;
- **conservar** quienes somos, servicios y contacto en la puerta;
- **postergar Escape** para los modales a Fase 5: es una mejora válida, pero no
  bloquea esta puerta y cambia comportamiento en varios componentes;
- llevar la deuda previa de `npm run lint` a Fase 5, antes de seguridad y
  despliegue; no mezclarla con esta pieza;
- después de cerrar esta corrección, la siguiente pieza será el seed con datos
  bancarios demo, no la instalación sin Docker.

La tarea no se acepta completa todavía porque los dos guiones pueden declarar
una pantalla revisada aunque no hayan logrado llegar a ella. Ejemplos concretos:
`detalle`, `Agregar`, `Mis Compras` y `Mis Productos` silencian el error con
`.catch(() => {})`; administración omite el recorrido con `return` o `if` si no
encuentra el botón o una pestaña. Hoy las rutas existen y la corrida da verde,
pero una regresión futura podría reducir o falsear la cobertura sin hacer fallar
la puerta. Para un control permanente, eso es un falso verde.

## Tarea activa única: hacer que las puertas verifiquen su propio recorrido

Corregí únicamente `scripts/a11y.mjs` y `scripts/contraste.mjs` para que una
pantalla esperada que no se abrió sea un fallo, no una omisión silenciosa.

### Alcance

- Quitá los `catch` vacíos y los `if/return` que ocultan la ausencia de una
  navegación requerida.
- Antes de medir cada pantalla, esperá y comprobá un marcador propio de esa
  pantalla: encabezado, diálogo, pestaña activa o control inequívoco.
- La ejecución debe exigir el inventario completo actual: **40 pantallas** en
  `a11y` y **34 mediciones** en `contraste`, además de los nombres esperados.
  Estos números son parte de la especificación de esta puerta, no datos del
  seed.
- Si una acción opcional no forma parte de una pantalla medida, eliminála del
  recorrido en vez de silenciar su error.

### Fuera de alcance

- Sin cambios en `src/`, backend, estilos, dependencias o suite funcional.
- Sin Escape, lint, seed, instalación, nuevas rutas ni nuevas reglas.
- No rehagas los medidores ni cambies sus umbrales.

### Criterios de aceptación

1. Una navegación requerida rota hace fallar el comando antes de informar
   éxito. Mostrá un rojo controlado alterando temporalmente un selector y luego
   restaurándolo; no se versiona la rotura.
2. Con la aplicación correcta: `npm run a11y -- --todas` informa 40 pantallas y
   cero violaciones; `npm run contraste` informa 34 mediciones y cero textos
   fuera de umbral.
3. `npm run build`, la suite 25/25 y
   `git -c core.whitespace=cr-at-eol diff --check` quedan verdes.
4. Un commit de código y otro separado con el informe actualizado en
   `PARA-PM.md`.

---

## 2026-08-09 — `d2063c9`: cobertura aceptada, queda una salida falsa

Se acepta la corrección de los dos falsos verdes, el inventario exigido, los
marcadores por pantalla y las tres líneas de nombres accesibles en el detalle.
Ese desvío de `src/` era necesario: apareció sólo al abrir la pantalla real y
cierra una violación crítica. También se acepta excluir controles
deshabilitados del contraste; coincide con la decisión anterior y ahora la
cantidad excluida queda visible.

PM revisó el recorrido nuevo y reprodujo compilación y sintaxis de ambos
guiones en verde. La cobertura ya no puede disminuir, repetirse o cambiar de
nombre silenciosamente.

Queda un solo falso verde, distinto y concreto, en `scripts/contraste.mjs`:
`ok(!desborda, ...)` agrega un desborde horizontal a `fallos`, pero
`todoBien` sólo consulta `reales.length` y `cobertura`. Por eso el comando puede
registrar un desborde, imprimir `TODO OK` y salir con código 0.

## Tarea activa única: cerrar la salida del barrido de contraste

- Tocá sólo `scripts/contraste.mjs`.
- El éxito final y el código de salida deben depender también de que
  `fallos.length === 0`.
- Demostrá un rojo temporal forzando un desborde y restaurá el guion; después
  dejá `npm run contraste` verde con 34/34.
- Corré `npm run a11y -- --todas`, `npm run build` y `git diff --check`.
- Sin `src/`, backend, dependencias, lint, Escape, seed ni instalación.
- Un commit de código y otro con el informe. Después de aceptar esto, la tarea
  siguiente es el seed con datos bancarios demo.

---

## 2026-08-09 — `5924fbb`: puerta de accesibilidad cerrada

Aceptado. La salida final de `scripts/contraste.mjs` ahora depende de
`fallos.length === 0`; el rojo controlado por desborde salió con código 1 y la
corrida restaurada quedó 34/34. La cobertura accesible quedó 40/40 y la
compilación verde. No hacía falta repetir la suite funcional 25/25 para este
cambio aislado del guion: la última corrida sobre el mismo producto sigue
vigente.

## Tarea activa única: seed bancario demo utilizable desde cero

La instalación limpia crea publicaciones de demostración de dos vendedores
—administrador y vendedor—, pero ninguno recibe CBU ni alias. Por eso el flujo
de transferencia exige una configuración manual que una demo recién instalada
no debería necesitar.

### Alcance

- Agregá al seed un CBU sintético de 22 dígitos y un alias inequívocamente demo
  para `admin@topgreen.com` y `vendedor@ejemplo.com`. No uses datos reales.
- Ambos usuarios deben quedar listos porque los dos son dueños de publicaciones
  del catálogo demo. El comprador no necesita datos bancarios.
- Al volver a correr el seed, completá únicamente campos bancarios vacíos. No
  sobrescribas un CBU o alias no vacío que alguien haya personalizado y no
  dupliques registros.
- Agregá un caso automatizado que parta del seed limpio y compruebe que una
  publicación de cada vendedor ofrece las opciones de transferencia sin hacer
  antes un `PATCH` manual. Contrastá también CBU y alias entre API y base.
- Conservá el caso negativo de vendedor sin datos bancarios. Aislalo creando el
  estado faltante dentro de la prueba y restaurándolo, para que no dependa de
  que el seed venga incompleto.

### Fuera de alcance

- Sin cambios de esquema, migraciones, modelos, endpoints, interfaz ni reglas
  de checkout.
- Sin integración bancaria, validación externa de CBU, Mercado Pago, cifrado ni
  datos productivos.
- No corrijas todavía el mensaje genérico que la interfaz muestra cuando la API
  rechaza el pago; será la pieza siguiente y separada.

### Criterios de aceptación

1. Desde base limpia, el seed deja CBU y alias demo en los dos usuarios que
   publican; una segunda ejecución no duplica ni cambia los valores.
2. Si antes de repetir el seed se reemplazan esos campos por valores no vacíos,
   el seed los conserva.
3. Sin configuración manual, las publicaciones de ambos vendedores permiten
   obtener opciones de transferencia y los datos devueltos coinciden con SQL.
4. El rechazo a un vendedor sin datos bancarios sigue cubierto por una prueba
   aislada y verde.
5. Quedan verdes la suite oficial completa —informá su nuevo total si agregás un
   caso—, `npm run build` y
   `git -c core.whitespace=cr-at-eol diff --check`.
6. Un commit de código y otro separado con el informe en `PARA-PM.md`, indicando
   archivos, pruebas, resultado de dos corridas del seed y cualquier desvío.

---

## 2026-08-09 — `652bc34`: seed bancario aceptado

Aceptado. Los dos vendedores demo quedan bancarizados desde la primera corrida,
la actualización es idempotente campo por campo y no pisa valores propios. El
caso positivo nace sin `PATCH`, el negativo crea y restaura su propio estado, y
la suite sube legítimamente a 26/26. PM revisó el diff y reprodujo compilación y
sintaxis del guion en verde.

También se acepta el hallazgo informado: no se acepta esconderlo bajando
precios del seed. Hoy dos publicaciones válidas para el catálogo provocan un
500 al entrar al carrito porque los snapshots y totales admiten menos que
`products.price`.

## Tarea activa única: eliminar el techo oculto de precios del carrito

Corregí el contrato monetario para que cualquier precio unitario que el sistema
acepta en una publicación pueda pasar al carrito y a una orden con cantidad 1,
incluidos los dos productos caros del seed. Si una cantidad hace superar el
máximo admitido para un total, la API debe rechazarla antes de escribir y con un
4xx entendible; nunca debe llegar como error 500 de PostgreSQL.

### Alcance

- Agregá una migración nueva desde la cabeza actual; no reescribas la migración
  inicial.
- Conservá `products.price` y los precios unitarios/snapshots con capacidad al
  menos equivalente a `NUMERIC(12,2)`.
- Unificá subtotales, totales, envío y montos derivados en una capacidad
  explícita que cubra holgadamente el catálogo actual. `NUMERIC(14,2)` es el
  piso aceptable para totales; incluí también las columnas monetarias de
  `payments` para no trasladar la misma incompatibilidad a Fase 4.
- Actualizá modelos y migración juntos. Auditá todas las columnas monetarias
  alcanzables; no tomes como suficiente la lista de cinco del informe porque
  `shipping_cost` y los montos de pago también forman parte del contrato.
- Validá en la API el máximo publicable y el máximo calculado de carrito/orden
  antes del `commit`. Una publicación o total fuera del contrato devuelve 4xx
  claro y no deja escrituras parciales.
- Cambiá el caso 13 para que deje de esquivar el problema eligiendo siempre la
  publicación más barata: al menos el producto de $950.000.000 debe entrar al
  carrito y ofrecer transferencia.
- Agregá una prueba que complete una orden de transferencia con un producto por
  encima de $100.000.000 y la contraste con SQL. Agregá además un caso de total
  deliberadamente fuera del nuevo rango y verificá 4xx, mensaje y ausencia de
  escritura parcial.

### Fuera de alcance

- No bajes precios ni elimines publicaciones para hacer verde la prueba.
- Sin cambios visuales, Mercado Pago, comisiones nuevas, monedas, conversión,
  cuotas ni refactor general de `float` a `Decimal`.
- No arregles todavía el mensaje genérico del frontend; es la pieza siguiente.
- Sin cambios en accesibilidad, seed bancario, logística o instalación.

### Criterios de aceptación

1. La migración se aplica sobre una base con los datos actuales y también desde
   una base limpia; el esquema final coincide con los modelos.
2. El campo de $950.000.000 y la cosechadora de $125.000.000 pueden agregarse al
   carrito sin 500. Al menos uno completa una transferencia y sus importes API
   coinciden con SQL.
3. Todo precio unitario admitido por `products.price` cabe en los snapshots. Un
   total superior al límite documentado devuelve 4xx antes de persistir.
4. No queda ninguna columna monetaria del flujo carrito → orden → pago con un
   rango menor e incompatible con la etapa anterior.
5. Suite oficial completa, `npm run build` y
   `git -c core.whitespace=cr-at-eol diff --check` verdes; informá el total nuevo
   si agregás casos.
6. Un commit de código y otro con `PARA-PM.md`. El informe debe enumerar tipos
   antes/después, prueba de migración limpia y existente, respuestas del caso
   caro y del caso fuera de rango, y cualquier desvío.

---

## 2026-08-09 — `61624ce`: migración correcta, tarea devuelta

No aceptado todavía. La ampliación de las once columnas, el contrato central,
la compra de $950.000.000 y la prevalidación de ambos checkouts están bien. Pero
dos criterios de la tarea no se cumplen en todos los caminos públicos.

### Hallazgo 1 — el carrito persiste un total que el contrato rechaza

`cart.py` importa `validar_total` pero nunca lo usa. `POST /cart/items` guarda
el producto máximo con cantidad 200 y devuelve éxito; recién el checkout lo
rechaza. Los dos `PUT/PATCH` de cantidad hacen lo mismo. El caso 28 sólo compara
`orders` y `order_items`, no el carrito, y luego lo limpia en el `finally`.

La aceptación pedía validar el máximo calculado de **carrito/orden antes del
commit** y no dejar escrituras parciales. El checkout debe conservar su defensa,
pero el estado imposible no puede entrar al carrito.

### Hallazgo 2 — editar el precio salta el contrato

`POST /products` llama a `validar_precio_unitario`, pero
`PATCH /products/{product_id}` asigna `price` y hace `commit` sin validarlo. Un
precio superior a `NUMERIC(12,2)` todavía puede terminar en un 500 de base por
la ruta de edición.

## Corrección activa única

- En alta y en las dos rutas de actualización del carrito, calculá antes del
  `commit` el total prospectivo por vendedor —incluyendo los demás ítems de ese
  vendedor— y pasalo por `validar_total`. Si no entra, devolvé 400 y preservá
  exactamente el carrito anterior.
- Conservá la validación previa en ambos checkouts como defensa en profundidad.
- En edición de producto, si viene `price`, validalo antes de modificar el
  modelo.
- Extendé el caso fuera de rango para comprobar POST, PUT y PATCH del carrito:
  400, techo visible y contenido/conteo anterior de `cart_items` intacto.
- Agregá una comprobación de edición de producto fuera de rango: 400 y precio
  anterior intacto en SQL.
- No cambies migración, precisiones, interfaz ni el resto del alcance. No abras
  todavía el refactor de `float` ni el mensaje del frontend.
- Suite completa, compilación, `alembic check` y `diff --check` verdes. Un
  commit de corrección y otro con el informe actualizado.

---

## 2026-08-09 — `b2f2e89`: cuatro caminos cerrados, `sync` sigue abierto

No aceptado todavía. POST/PUT/PATCH del carrito y PATCH de producto quedaron
corregidos como se pidió. La mutación por `sync`, que la dev encontró y agregó
al alcance, no queda protegida para el total agregado y tampoco fue incorporada
al caso 28.

### Evidencia

`POST /cart/sync` borra los ítems y luego llama
`validar_total_prospectivo(cart, product, quantity)` dentro del mismo bucle que
va creando los nuevos. El helper suma `cart.items`, pero esa colección se carga
vacía después del borrado y los `CartItem` nuevos se crean sólo con `cart_id`,
sin agregarse a la relación ya cargada. Así, cada línea puede validarse sola y
dos líneas del mismo vendedor que juntas exceden el techo entran igualmente.

Además, el caso 28 prueba POST/PUT/PATCH y checkout, pero no `/cart/sync`; por
eso el 28/28 no demuestra la quinta ruta declarada en el informe.

## Corrección activa única

- En `/cart/sync`, hacé una primera pasada sin escribir: resolvé productos,
  aplicá la regla de stock, agrupá el payload efectivo por vendedor y validá
  cada línea y el total agregado del vendedor.
- Esa validación completa debe ocurrir antes de borrar el carrito anterior y
  antes de cualquier `add/flush`. Recién después persistí el reemplazo.
- Si el payload repite un `product_id`, normalizalo a una sola línea sumando las
  cantidades o rechazalo de forma explícita; no permitas dos filas duplicadas
  que vuelvan ambiguo el cálculo.
- Ajustá el helper de las otras mutaciones para que, al reemplazar una fila,
  omita sólo esa fila concreta y no todas las filas con el mismo `product_id`;
  así tampoco subestima carritos heredados con duplicados.
- Extendé el caso 28 con dos líneas individualmente válidas del mismo vendedor
  cuyo total conjunto exceda el techo. `/cart/sync` debe responder 400 con el
  máximo visible y preservar exactamente las filas, productos y cantidades del
  carrito previo.
- Sin otros cambios. Suite 28/28, compilación, `alembic check` y `diff --check`
  verdes; commit de corrección e informe separado.

---

## 2026-08-10 — `5616aec`: contrato monetario aceptado

Aceptado. `sync` ahora resuelve, normaliza y valida el reemplazo completo antes
de borrar o escribir; el total se agrega por vendedor y el carrito previo queda
intacto ante el 400. El helper omite sólo la fila reemplazada y el caso 28 cubre
el agregado de dos líneas, no sólo cada línea. Se conserva la decisión de sumar
duplicados del mismo producto: para una sincronización desde `localStorage` es
la interpretación más útil y evita filas ambiguas.

Con esto quedan aceptados `61624ce`, `b2f2e89` y `5616aec`: migración, productos
caros, límites previos a escritura y los cinco caminos del carrito. Suite
28/28. PM revisó el diff, compiló el backend y confirmó `diff --check` en verde;
no repitió la misma suite completa ya informada.

## Tarea activa única: no ocultar errores al sincronizar y pagar

Hoy `CheckoutModal.syncBackendCart` captura **cualquier** error de `/cart/sync`
y prueba POST/PUT por producto. Ese fallback puede sustituir el motivo real por
“Producto no encontrado en el carrito”. Además, el backend de `sync` todavía
salta productos inexistentes/inactivos y recorta cantidades al stock sin
avisar; la interfaz puede crear una orden con menos de lo que el usuario cree.

### Alcance

- Eliminá el fallback POST/PUT del checkout. `/cart/sync` es el único camino de
  sincronización; su error debe propagarse sin reemplazar el mensaje original.
- Hacé atómico el contrato de `sync`: antes de borrar el carrito, rechazá con
  400 y motivo claro si un producto no existe, está inactivo, no tiene stock o
  la cantidad pedida supera el disponible. No saltees ni recortes en silencio.
- Validá que cada cantidad sea positiva en el esquema de entrada. Conservá la
  normalización de duplicados ya aceptada y aplicá stock sobre la suma.
- Ante cualquier rechazo, preservá exactamente el carrito backend anterior. El
  carrito local del navegador tampoco se vacía ni se reemplaza.
- Mostrá en el cuadro de pago el `detail` real entregado por la API, tanto al
  cargar opciones de transferencia como al crear la orden. El usuario debe
  poder corregir el carrito o volver; no cierres el modal ni generes una orden.
- Si el texto visible de error no tiene semántica accesible, agregá `role="alert"`
  o equivalente usando el estilo existente; sin rediseñar el checkout.

### Pruebas obligatorias

1. API: `sync` con producto inexistente, inactivo, sin stock y cantidad superior
   al stock devuelve 400 con motivo específico y deja filas/cantidades previas
   idénticas. Incluí duplicado cuya suma supera el stock.
2. Navegador: forzá un error real de `sync`, avanzá al pago y verificá que se ve
   exactamente ese motivo; comprobá que no se hicieron los POST/PUT de fallback
   y que no se creó ninguna orden.
3. Navegador: vendedor sin CBU/alias muestra el motivo real de
   `/orders/transfer-options`, no un mensaje del carrito; restaurá los datos en
   `finally`.
4. El flujo válido de transferencia sigue completándose.

### Fuera de alcance y entrega

- Sin migraciones, nuevas pantallas, cambios de diseño, Mercado Pago, logística
  ni instalación.
- No abras aún el refactor monetario de `float` a `Decimal`; queda obligatorio
  antes de Fase 4.
- Suite completa —informá el nuevo total si agregás un caso—, build,
  accesibilidad de las pantallas tocadas y `diff --check` verdes.
- Un commit de código y otro con `PARA-PM.md`; detallá rutas, mensajes visibles,
  preservación del carrito y cualquier desvío.

---

## 2026-08-10 — `e915d6a`: errores de checkout aceptados

Aceptado. `sync` dejó de descartar o recortar ítems, valida duplicados sobre la
suma y preserva el carrito previo; el checkout ya no reemplaza el motivo real
con POST/PUT de respaldo. Los casos 29–31 prueban API, navegador, cero órdenes,
cero fallback y restauración bancaria. La suite queda 31/31 y accesibilidad
40/40. PM revisó los recorridos, compiló backend y guion y confirmó
`diff --check`.

Se mantiene fuera del MVP inmediato el botón “quitar” dentro del aviso. El
usuario ya puede cerrar el checkout y corregir el carrito; no corresponde abrir
otra interacción sin un bloqueo contractual. El refactor `float` → `Decimal`
sigue reservado obligatoriamente para antes de Fase 4.

## Tarea activa única: instalación nativa que funcione siguiendo la guía

El Camino B de `README_LOCAL_SETUP.md` no es reproducible en una máquina limpia:
`backend/.env.example` contiene seis claves que `Settings` rechaza
(`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `BASE_URL`) y el
proxy de Vite apunta a `localhost:80`, que sólo existe con nginx. La solución
debe preservar Docker y Railway, no intercambiar un camino roto por otro.

### Alcance

- Separá con claridad qué configuración consume Docker y cuál consume FastAPI.
  `backend/.env.example`, copiado como indica la guía, debe ser aceptado por
  `Settings` sin borrar líneas manualmente. No debilites `Settings` permitiendo
  extras: eliminá la duplicación o mové esas variables al dueño correcto.
- El script Docker debe leer `DB_NAME`/`DB_USER` de la configuración raíz, no
  depender de claves inválidas dentro del `.env` del backend.
- Hacé coherentes `DATABASE_URL`, puerto de PostgreSQL y `UPLOAD_DIR` para el
  camino nativo. Una persona sin permisos sobre `/data` debe poder iniciar la
  API y servir uploads desde una carpeta del proyecto. Docker debe conservar su
  volumen persistente.
- Corregí el proxy de Vite para que, aun sin `.env`, `/api` apunte al backend
  nativo en `localhost:8000`. Si existe `VITE_API_URL`, debe seguir mandando.
- Reescribí sólo las secciones necesarias de `README_LOCAL_SETUP.md`: comandos
  POSIX y PowerShell, conexión a la base correcta antes de crear PostGIS,
  variables que realmente hay que cambiar y URLs finales.
- No commitees `.env`, secretos, entornos virtuales, dependencias ni bases.

### Verificación obligatoria

1. Desde una copia limpia sin `.env` y **sin usar Docker**, seguí literalmente
   el Camino B: entorno Python nuevo, dependencias, PostgreSQL/PostGIS,
   migraciones, seed dos veces, API `:8000` y Vite `:5173`.
2. Comprobá health, login demo, catálogo y una imagen/upload desde el navegador;
   ninguna llamada puede intentar `localhost:80` ni fallar por CORS.
3. Demostrá que copiar `backend/.env.example` y sustituir sólo los placeholders
   documentados carga `Settings` sin claves extra.
4. Verificá que `docker compose config` y la inicialización Docker sigan
   recibiendo DB, API y volumen de uploads correctos. No destruyas una base del
   usuario para probar: usá un entorno descartable.
5. Verificá que Railway no cambió de contrato o documentá y justificá cualquier
   ajuste imprescindible.
6. Suite 31/31, build y `diff --check` verdes. Si la suite oficial exige Docker,
   separá claramente esa evidencia de la prueba nativa.

### Fuera de alcance y entrega

- Sin cambios de producto, checkout, pagos, logística, interfaz ni esquema de
  datos. Sin instaladores nuevos ni soporte para motores distintos de
  PostgreSQL 16 + PostGIS.
- Un commit de código/configuración/documentación y otro con `PARA-PM.md`.
  Informá comandos exactos, entorno limpio utilizado, resultado nativo, prueba
  Docker/Railway y cualquier desvío.

---

## 2026-08-10 — `82c1df8`: camino nativo probado, entrega devuelta

No aceptado todavía. Se acepta provisionalmente la separación raíz/backend, la
ruta nativa de uploads, la creación previa al montaje, el proxy `:8000`, las
`VITE_*` comentadas y la guía reescrita. La prueba nativa fue completa. Quedan
dos incumplimientos concretos.

### Hallazgo 1 — el template productivo quedó inválido

`backend/.env.production.example` ahora contiene `DATABASE_URL` **dos veces** y
todavía conserva `DB_PASSWORD` y `BASE_URL`. Esas dos claves no existen en
`Settings`, por lo que copiar el template a un archivo leído por Pydantic vuelve
a producir el mismo `extra_forbidden` que esta pieza debía eliminar. El informe
dice que las seis claves se corrigieron, pero el archivo no coincide.

Además, el encabezado dice “copiar como `.env.production`”, aunque `Settings`
sólo carga automáticamente `backend/.env`. La instrucción debe decir cómo se
usa realmente en ejecución nativa y cómo se traslada a Railway.

### Hallazgo 2 — Docker no fue ejecutado

El criterio pedía inicialización Docker, no sólo `docker compose config`. La PM
confirmó que el demonio está disponible mediante `rtk proxy docker info`
(servidor 28.1.1). Ya existen `topgreen-db` y `topgreen-api` saludables: no los
detengas, recrees ni uses para una prueba destructiva.

## Corrección activa única

- Dejá `backend/.env.production.example` con una sola `DATABASE_URL` y sólo
  claves declaradas por `Settings`. Corregí su instrucción de uso: FastAPI lee
  automáticamente `backend/.env`; en Railway las variables se cargan en el
  entorno, no renombrando el template.
- Eliminá `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `ADMIN_NAME` de `Settings` y de los
  dos templates: están muertas, el seed no las usa y mantenerlas promete una
  configuración inexistente. Actualizá la mención correspondiente de la guía;
  no cambies el seed en esta pieza.
- Agregá una comprobación que cargue ambos templates —sustituyendo sólo los
  placeholders documentados— y falle ante duplicados o claves extra. Puede ser
  una prueba liviana existente; no armes el instalador nativo automatizado que
  propusiste. Esa automatización se posterga a Fase 5.
- Ejecutá Docker en un proyecto **descartable y aislado**, con nombres,
  puertos, red y volúmenes distintos mediante un override temporal. No toques
  los contenedores ni volúmenes `topgreen-*` existentes. Comprobá migraciones,
  seed, health y persistencia/servicio de uploads; eliminá sólo los recursos
  temporales identificados al terminar.
- Conservá las `VITE_*` comentadas: se aprueba el default por mismo origen.
- Repetí `docker compose config`, build, 31/31 y `diff --check`. Sin cambios de
  producto ni más archivos de configuración fuera de lo indicado.
- Commit de corrección e informe separado con nombres del proyecto Docker
  temporal, puertos usados, comandos y prueba de que los contenedores existentes
  siguieron saludables.

---

## 2026-08-10 — `896386a`: instalación aceptada

Aceptado. Las dos plantillas cargan con el `Settings` real, sin duplicados ni
claves muertas; el caso 32 deja la regresión versionada. La instalación nativa
ya había quedado probada en `82c1df8`.

La PM completó la evidencia Docker que la dev no podía ejecutar por política de
egreso. Proyecto aislado `tgpmcheck`, puertos `55443/58010`, imágenes locales:
seis migraciones hasta `a1c4f7e9b2d3`, seed dos veces, conteos
`3/30/12/4028`, health 200 y upload servido antes y después de reiniciar la API.
Se eliminaron sólo sus contenedores, red y volúmenes. `topgreen-db` y
`topgreen-api` originales siguieron saludables. Suite informada: 32/32.

Decisiones solicitadas: se conservan las `VITE_*` comentadas; no se versiona un
instalador nativo adicional ahora —queda para Fase 5—; las claves `ADMIN_*`
muertas quedan correctamente eliminadas.

## Tarea activa única: validación de registro por correo

Es la primera deuda contractual de Fase 2. Al registrarse, comprador, vendedor
o transportista debe quedar sin verificar, recibir un enlace de un solo uso con
24 horas de vigencia y no poder iniciar sesión hasta usarlo. Debe existir
reenvío sin crear otra cuenta. Recuperación de contraseña no entra.

### Contrato backend

- Agregá una migración nueva y un modelo específico para tokens de verificación
  con usuario, **hash** del token, creación, vencimiento y consumo/invalidez. No
  guardes el token crudo en base ni uses el JWT de sesión como verificación.
- Generá tokens criptográficamente aleatorios. Vencen exactamente a las 24 h,
  son de un solo uso y la verificación concurrente no puede aceptar dos veces el
  mismo token.
- `POST /auth/register` crea `is_verified=false`, envía el correo y devuelve una
  respuesta pendiente **sin access token, refresh token ni cookies de sesión**.
- Agregá endpoints para verificar el token y reenviar por email. El reenvío
  invalida todos los tokens anteriores no usados y no duplica al usuario.
- La respuesta de reenvío debe ser genérica para email inexistente, ya
  verificado o pendiente; no reveles qué cuentas existen.
- `login`, `refresh`, `get_current_user` y el acceso opcional deben impedir que
  un usuario no verificado use tokens viejos o consiga sesión. Seed y usuarios
  creados por administración siguen verificados.
- Normalizá los errores: pendiente, vencido, ya usado/inválido y correo no
  enviado deben ser controlados; ningún caso termina en 500 ni deja una sesión.

### Transporte de correo

- Definí una interfaz mínima con dos transportes: `outbox` local/pruebas y SMTP
  productivo. Preferí biblioteca estándar; no agregues una dependencia si no es
  necesaria.
- El outbox guarda el mensaje verificable en una carpeta no pública e ignorada
  por Git. La suite debe poder leer el enlace real sin un endpoint de prueba.
- Sumá sólo las variables necesarias a `Settings` y a ambas plantillas:
  transporte, remitente, host/puerto/credenciales/TLS, outbox y URL del frontend.
  No commitees credenciales ni el contenido del outbox.
- El enlace apunta al frontend y contiene el token sólo en la URL que recibe el
  usuario. No lo imprimas en logs normales ni lo devuelvas en la API.

### Interfaz

- Registro exitoso deja de dar la bienvenida/iniciar sesión. Muestra “revisá tu
  correo”, el email usado y una acción de reenvío; no guarda tokens locales.
- El enlace abre una vista mínima que verifica una vez y ofrece ir a iniciar
  sesión. Muestra estados claro de éxito, vencido/inválido y reenvío.
- Login bloqueado muestra el motivo real y permite pedir reenvío. No agregues
  recuperación de contraseña, magic link ni rediseño general de autenticación.
- Los mensajes de estado/error deben ser accesibles y no revelar información
  adicional sobre cuentas ajenas.

### Pruebas obligatorias

1. Registro API: usuario `false`, sin JWT/cookies; outbox contiene enlace y la
   base sólo el hash. Login y endpoint protegido quedan bloqueados.
2. Enlace vigente: verifica, marca consumo, permite login y falla al reutilizar
   el mismo token. Dos verificaciones simultáneas aceptan exactamente una.
3. Vencimiento forzado: rechaza; reenvío conserva un usuario, invalida el token
   anterior, emite otro y el nuevo verifica. Reenvío de desconocido/verificado
   responde igual sin enviar correo.
4. Tokens de sesión anteriores de un usuario no verificado fallan también en
   refresh y rutas protegidas.
5. Navegador real: registro → aviso pendiente → enlace del outbox → éxito →
   login. Cubrí también login pendiente + reenvío y un enlace vencido.
6. Adaptá los primeros casos de la suite: ya no es válido esperar JWT al
   registrar ni login antes de verificar. Seed, admin y recorrido completo deben
   seguir verdes.

### Límites y entrega

- Sin recuperación de contraseña, cambio de email, OAuth, captcha, campañas,
  proveedor transaccional pago ni diseño de plantillas comerciales.
- Sin cambios en perfiles, transportistas B/C, pagos, catálogo o despliegue.
- Migración limpia y sobre base existente, `alembic check`, suite completa,
  build, accesibilidad de las vistas nuevas y `diff --check` verdes.
- Un commit de código y otro con `PARA-PM.md`. Informá modelo de amenaza,
  contrato de cada endpoint, mensajes del outbox, pruebas de 24 h/un solo uso,
  total final de la suite y cualquier desvío.

---

## 2026-08-10 — Decisión PM sobre riesgos de cronograma

La propuesta `6747e78` no cambia la tarea activa. Seguí con validación de
correo hasta entregar sus criterios completos; no abras Railway, Mercado Pago,
transportistas ni documentación de estado en paralelo.

1. **Railway: riesgo aceptado, ensayo condicionado.** Si correo queda aceptado
   por PM antes del 18/08, la pieza siguiente podrá ser un ensayo descartable
   de una jornada como máximo y deberá terminar antes del 20/08. Usará datos
   demo, sin secretos productivos ni presentación a la clienta. Si no entra en
   esa ventana, vuelve a Fase 5: no consume la puerta de perfiles de Fase 2.
   Configuración o URL de ensayo no cuentan como despliegue contractual.
2. **Mercado Pago: dependencia real, sin implementación adelantada.** PM pide
   que la aplicación quede bajo la cuenta de la clienta y que el acceso de
   prueba se entregue por canal seguro antes del 10/09. No guardes ni pidas
   secretos en GitHub. La reconstrucción sigue en Fase 4.
3. **Transportistas: no hay dos preguntas abiertas.** Contacto y radio ya se
   cerraron el 05/08: radio sobre origen y destino; contacto visible al
   comprador después de seleccionar; transportista sin contacto del comprador
   ni detalle financiero. No las vuelvas a elevar a la clienta.
4. **`PROJECT_STATUS.md`: el problema es real, borrar no se aprueba.** Al hacer
   el ensayo Railway, reemplazalo por un aviso breve de documento histórico y
   enlaces a la documentación vigente. No dediques ahora una reescritura ni lo
   uses como fuente.

No hay corrimiento contractual ni consumo del colchón. La próxima entrega que
PM espera es el commit de validación de correo y su informe separado.

---

## 2026-08-10 — `cb6d888`: correo devuelto una vez

No aceptado todavía. Se acepta provisionalmente el modelo con hash, 24 horas,
consumo condicional, bloqueo de `login`/`refresh`/rutas, alta sin sesión, los dos
transportes y el flujo visual. La compilación independiente quedó verde y el
diff está limpio. No repitas trabajo ya cerrado. Corregí estas tres puertas.

### Hallazgo 1 — el token sí entra en registros normales

`VerifyEmailPage` lee el token pero conserva `?token=...` en la barra mientras
hace `POST /auth/verify-email`. La PM lo reprodujo con navegador: esa llamada
llevó el encabezado
`Referer: http://127.0.0.1:5173/verificar-correo?token=abcdefghijklmnop`.
Además, los botones cambian el estado de React pero conservan la ruta y el
query; al recargar reaparece la verificación con un token usado.

- Capturá el token en memoria y quitá inmediatamente el query con
  `history.replaceState`, **antes** de llamar a la API.
- Al ir al inicio o al login, la URL debe quedar en `/`, sin conservar
  `/verificar-correo` ni el token.
- En el caso de navegador, interceptá la petición de verificación y exigí que
  ni su URL ni `Referer` contengan el token. Exigí también URL limpia después de
  abrir el login y después de recargar.

### Hallazgo 2 — el fallo del transporte enumera cuentas

`POST /auth/resend-verification` devuelve 200 con texto genérico para cuenta
inexistente o verificada, pero devuelve 503 sólo cuando la cuenta pendiente
existe y el transporte falla. Durante una caída o mala configuración SMTP, el
código HTTP revela qué cuenta está pendiente y contradice el contrato genérico.

- Para reenvío, estado y cuerpo externos deben seguir siendo idénticos para
  inexistente, verificada y pendiente aunque el transporte falle. Hacé rollback
  y registrá internamente el fallo sin email ni token; no lo expongas al caller.
- Forzá un transporte fallido en una prueba mínima y compará código y cuerpo
  con los otros dos estados. El alta inicial sí puede conservar su 503 y
  rollback: ahí todavía no existe una cuenta que enumerar y la persona necesita
  saber que debe reintentar.

### Hallazgo 3 — falta el vencimiento en navegador

El caso 35 prueba vencimiento por API. El caso 37 abre en navegador un token
**invalidado por reenvío**, no uno vencido. La tarea pedía expresamente el
estado vencido en interfaz.

- Dentro del recorrido de navegador, emití otro token, vencelo por SQL, abrí su
  enlace y comprobá el mensaje de vencimiento y el formulario de reenvío.
- No hace falta crear otro caso si ampliar el 37 deja la regresión clara.

### Decisiones solicitadas

- `PaymentResultPage`: esperar a Fase 4 y sumar esa pantalla al barrido cuando
  se reconstruya Mercado Pago; hoy esas rutas están fuera del flujo habilitado.
- Ensayo Railway: usa `outbox` y sólo datos demo. No se piden credenciales SMTP
  para una prueba descartable. Producción sí exige `EMAIL_TRANSPORT=smtp` y
  credenciales reales; el ensayo no cuenta como producción.

Límites: no refactorices autenticación, no agregues rate limiting, colas ni
proveedores, y no toques pagos. Conservá el resto de los 37 casos, build,
accesibilidad, contraste, migración y `diff --check` verdes. Un commit de
corrección y el informe separado; informá la evidencia exacta de los tres
hallazgos.

---

## 2026-08-10 — `7262955`: tres hallazgos cerrados; fragmento aprobado

Aceptadas las tres correcciones: la URL se limpia antes del `POST`, salir vuelve
a `/`, el fallo del transporte mantiene 200 y cuerpo genérico con rollback y
registro interno, y el caso 37 distingue un token vencido de uno invalidado.
La compilación independiente y `diff --check` quedaron verdes. No rehagas esas
soluciones.

Se aprueba tu recomendación de eliminar la última aparición del token en el
access log. Es parte de la misma puerta —no dejar tokens en registros normales—
y se cierra ahora, no en Railway ni en Fase 5.

### Corrección final única

- Armá el enlace como `/verificar-correo#token=...`, no con query. Leé el token
  desde `window.location.hash`, guardalo sólo en memoria y limpiá el fragmento
  antes de llamar a la API. El servidor debe recibir únicamente
  `GET /verificar-correo`.
- Retirá el `<meta name="referrer" content="strict-origin">`: con fragmento ya
  no protege ningún token y dejar una política global redundante agrega un
  efecto lateral innecesario.
- Adaptá el lector del correo y el caso 37. Con el token vigilado, exigí **cero
  peticiones totales** cuya URL o `Referer` lo contengan —incluido el documento,
  no sólo la API—, barra limpia, recarga sin reconsumo y salida a `/`.
- Conservá el cuerpo del `POST /auth/verify-email`; el token no pasa a query de
  API ni se devuelve en respuestas o logs.

Sin caso nuevo, proveedor, refactor ni cambios fuera de esos cuatro archivos y
el informe. Repetí 37/37 porque el parser del enlace alimenta toda la suite,
además de build y `diff --check`; no hace falta repetir accesibilidad ni
contraste si el DOM y los estilos no cambian. Un commit mínimo y el informe
separado.

---

## 2026-08-10 — `ccc0794`: correo aceptado

Aceptado. El enlace usa fragmento, el servidor recibe sólo
`GET /verificar-correo`, el token se limpia antes del `POST`, el cambio de hash
procesa un enlace nuevo sin gastar dos veces el mismo, el `meta referrer`
redundante salió y la vigilancia exige cero peticiones con el token. Build
independiente y `diff --check` verdes; suite informada 37/37.

Los dos marcadores `?token=` que quedaron en `a11y.mjs` y `contraste.mjs` miden
el estado incompleto con el mismo DOM y estilos que el inválido. No bloquean la
aceptación. Alinealos cuando esos guiones vuelvan a tocarse; no abras otra
corrección de correo por eso.

## Tarea activa única: ensayo descartable de Railway

Objetivo: descubrir ahora los defectos de despliegue que no aparecen en Docker
local, sin llamar producción a este entorno ni consumir la puerta de perfiles
de Fase 2. Tope total: una jornada y cierre antes del 20/08.

**Relevo PM 2026-08-10:** Gate A quedó cerrado por la PM porque tu bloqueo de
egreso no se reproduce en su entorno. Tu commit `0cf960b` queda aceptado junto
con la construcción y el ensayo Docker completo documentados en `NOW.md`. Gate
B está parcialmente creado en Railway y queda en manos de la próxima PM porque
tu sesión no tiene acceso; no hagas más cambios ni abras otra tarea hasta que
la PM entrante termine el contraste del estado externo.

### Gate A — hacelo ahora, sin cuenta Railway

- `railway whoami` responde hoy `Unauthorized`. No intentes login interactivo,
  no crees recursos y no pidas ni guardes tokens en GitHub.
- Corregí `RAILWAY.md`: elimina las `ADMIN_*` que `Settings` ya no acepta;
  documentá las variables reales de correo. Para el ensayo se usa `outbox`,
  `EMAIL_OUTBOX_DIR=/data/outbox` y sólo datos demo. Producción exigirá SMTP.
- Ajustá cualquier contradicción entre la guía, los dos `railway.toml`, los dos
  Dockerfiles y los entrypoints. Conservá el monorepo actual: Frontend raíz
  `/`, Backend raíz `/backend`, archivo de configuración absoluto por servicio.
- Construí las dos imágenes Railway localmente. En recursos Docker aislados,
  comprobá: PostGIS, pre-deploy de migraciones, seed dos veces, API y frontend
  saludables, `/verificar-correo` directo sin 404, catálogo, outbox, upload y
  persistencia de `/data` tras reiniciar. No toques `topgreen-*`.
- Reemplazá `docs/PROJECT_STATUS.md` por un aviso breve de documento histórico
  y enlaces a las fuentes vigentes; no lo reescribas entero ni borres historia.
- Si Gate A descubre un defecto imprescindible, corregí sólo configuración,
  entrypoint o documentación. Un cambio de producto frena y vuelve a PM.

### Gate B — autorizado por Emi el 2026-08-10, después de cerrar Gate A

La CLI ya está autenticada como Emiliano Sejumil y la cuenta usa Hobby. Emi
confirmó que `strong-playfulness` es un proyecto de prueba, no final ni
importante, y autorizó reutilizarlo. No crees otro proyecto. Hoy contiene sólo
el servicio raíz `yneratopgreen`, con auto-deploy de `main`, ningún volumen y el
dominio `ynerav.up.railway.app`. El último deploy (`46109ba`) figura `SUCCESS`,
pero la PM comprobó que sólo sirve el frontend: `/health` da texto `ok` y las
rutas `/api/health` y `/api/catalog/categories` devuelven `text/html` del SPA.
Ese verde no satisface Gate B.

Con autorización:

- Reutilizá `strong-playfulness` como proyecto inequívocamente descartable con
  datos demo, secreto JWT aleatorio sólo en Railway,
  `EMAIL_TRANSPORT=outbox`, PostGIS privado y volumen Backend en `/data`. No uses
  SMTP, Mercado Pago ni datos reales.
- Desplegá desde `main` los tres servicios. Verificá HTTPS y dominios, health de
  ambos servicios, migraciones, PostGIS, seed idempotente, catálogo, CORS,
  registro y enlace leído desde `/data/outbox`, ruta directa de confirmación y
  login posterior.
- Subí una imagen demo, redesplegá o reiniciá Backend y comprobá que sigue
  servida. Comprobá que la base conserva usuarios y catálogo. Railway sólo usa
  el healthcheck al desplegar; no lo presentes como monitoreo continuo.
- Registrá uso estimado, límites y disponibilidad de backups, pero no actives
  backups pagos ni restaures nada en este ensayo. No elimines el proyecto al
  terminar: reportá el resultado y esperá autorización de PM para limpiarlo.

### Evidencia y freno

- Si Emi todavía no autenticó Railway al cerrar Gate A, entregá Gate A y
  reportá el bloqueo; no abras otra pieza ni excedas la jornada.
- Sin secretos, contenido de outbox ni tokens en commits o informe. Sí se pueden
  informar dominios demo, IDs no sensibles, estados, tiempos y costo estimado.
- Corré sólo las pruebas proporcionales a los archivos tocados, build,
  validación de plantillas y `diff --check`. No repitas 37/37 salvo que cambies
  producto, correo o seed.
- Un commit de Gate A/configuración y documentación; si Gate B se habilita, otro
  commit sólo si el despliegue exige un ajuste versionable. Informe separado en
  `PARA-PM.md` con una tabla Gate A/Gate B y cada criterio.

## Tarea cerrada y aceptada: error de validación legible

Gate B quedó cerrado por PM en el proyecto descartable de Railway. No tenés que
entrar a Railway, repetir el despliegue ni tocar su configuración.

### Evidencia que dispara esta tarea

En `https://ynerav.up.railway.app`, el alta con un dominio de correo que
`EmailStr` rechaza devuelve el detalle estructurado normal de FastAPI y el modal
muestra literalmente `[object Object]`. Con un correo válido, el registro,
outbox, confirmación y login funcionan. La causa está acotada al manejo común de
errores HTTP en `src/utils/api.ts`: hoy entrega `errorData.detail` directamente
a `new Error(...)`, aunque FastAPI puede devolver una lista de objetos.

### Resultado exigido

- Convertí cualquier `detail` de FastAPI en un mensaje humano estable: cadena,
  lista de errores de validación u otra forma inesperada. Nunca debe llegar
  `[object Object]` a la interfaz.
- Conservá sin cambios los mensajes de negocio que ya son cadenas, en especial
  registro pendiente, correo no enviado, login sin verificar y confirmación.
- Agregá una regresión ejecutable para el `422` estructurado y una para un
  `detail` de texto. Comprobá además el modal de registro con correo inválido.
- Corré sólo esas regresiones, el build y `git diff --check`.

### Límites y freno

No cambies validación de correo, backend, Railway, perfiles, catálogo ni textos
comerciales. No diseñes una jerarquía nueva de excepciones si una normalización
pequeña en el cliente alcanza. Si la corrección obliga a tocar el backend o
rompe un mensaje de negocio existente, frená e informá.

Entregá un solo commit y un informe mínimo en `PARA-PM.md`: causa, archivos,
pruebas exactas y cualquier riesgo. Ahí termina la tarea; no abras otra mejora.

**Aceptada por PM el 2026-08-10:** `ca23451`, informe `085f2b5`. Build
independiente y los dos mensajes reproducidos en Railway. No la reabras.

## Tarea cerrada y aceptada: perfil transportista editable de Fase 2

### Situación comprobada

El alta ya guarda `is_carrier`, localidad base, transporte, declaración de
certificación, radio y capacidad. `/auth/me` los devuelve. Pero
`UserUpdateRequest`, `PATCH /auth/me`, `AuthContext.updateProfile` y el panel de
perfil no permiten editarlos. Por eso la puerta contractual de Fase 2 sigue
abierta aunque el registro inicial funcione.

### Resultado exigido

- Un usuario que ya es transportista puede ver y editar desde su perfil:
  localidad base del padrón oficial, transporte habilitado, declaración de
  certificación, radio de cobertura positivo y capacidad.
- La actualización se valida también en backend: localidad existente y perfil
  transportista completo/coherente. Un payload parcial no puede dejarlo en un
  estado inválido.
- Guardar, recargar la página y volver a iniciar sesión conserva los cambios.
  `GET /auth/me` y la interfaz muestran lo mismo.
- La edición general de comprador/vendedor y sus mensajes actuales no cambia.
- Agregá la regresión integral mínima: alta y confirmación de un transportista,
  edición de los cinco datos, recarga/GET, rechazo de localidad inexistente y
  radio no positivo. Actualizá el conteo documentado sólo si el caso entra en
  la suite oficial.
- Corré la regresión nueva, build, pruebas proporcionales y `git diff --check`.

### Alcance y freno

No conviertas al transportista en un rol nuevo y no permitas crear un perfil
incompleto. No implementes todavía listado compatible, PostGIS por radio,
selección/contacto, estados logísticos, tarifa, ruteo, GPS, documentos ni
verificación oficial. No toques Railway.

Usá los campos y el padrón existentes; una migración sólo se justifica si es
imprescindible para cumplir un dato contractual ya documentado, no para prever
funciones futuras. Si aparece una ambigüedad que cambie quién puede convertirse
en transportista o abandonar esa condición, frená: esa política no está
decidida y es de PM/Emi.

Entregá un commit de producto y el informe mínimo separado en `PARA-PM.md` con
causa, archivos, pruebas exactas y riesgos. Ahí termina la tarea.

**Aceptada por PM el 2026-08-10:** producto `c484513`, informe `b753b17`. El
hash `d4623b4` escrito en el informe no corresponde al historial publicado; el
commit de producto real es `c484513`. Build independiente verde. En Railway la
PM reprodujo alta y confirmación, actualización de los cinco campos, lectura
posterior con localidad/provincia derivadas y rechazo atómico de una localidad
inexistente. No reabras esta pieza.

## Tarea cerrada y aceptada: integridad y accesibilidad de la edición del perfil

### Situación comprobada

`UserDashboard` inicializa teléfono, WhatsApp, provincia, ciudad y dirección
con constantes demo. Abrir edición y guardar puede escribir esos datos falsos
sobre una cuenta real. También muestra un email editable que el guardado no
envía. Los controles generales anteriores no tienen etiquetas asociadas y los
barridos miden el panel sólo en lectura, por lo que hoy pueden quedar verdes sin
abrir el modo edición.

### Resultado exigido

- El formulario se hidrata únicamente con datos reales de `/auth/me`; si un
  dato no existe, empieza vacío. No inventa teléfono ni ubicación.
- Definí una sola representación reversible para la ubicación disponible hoy.
  Abrir y guardar sin cambios debe conservar exactamente el valor persistido,
  incluso si está vacío o no tiene las tres partes esperadas. No agregues un
  padrón nuevo ni una migración para resolverlo.
- El email se muestra como dato de sólo lectura, salvo que exista un camino
  real y ya probado para actualizarlo. No dejes un control que aparenta guardar
  y luego se ignora.
- Cancelar restaura todos los campos generales y de transportista al último
  estado guardado. Una edición abandonada no puede reaparecer en el guardado
  siguiente.
- Cada control del modo edición tiene nombre accesible mediante `label`/`id` o
  un equivalente semántico. Incorporá el modo edición del perfil al barrido de
  accesibilidad en escritorio y celular; una falla al abrirlo no puede omitirse
  silenciosamente.
- Agregá una regresión de integridad mínima: cuenta con datos reales y cuenta
  sin datos, abrir/cancelar/guardar sin cambios y cambiar un dato explícito.
  Contrastá el resultado con `GET /auth/me` o SQL, no con constantes.

### Alcance y freno

Es una corrección del perfil existente. No cambies el modelo de usuario, no
agregues campos de provincia/ciudad/dirección, no conviertas la ubicación libre
en padrón, no abras directorio de transportistas, pagos, catálogo ni Railway.
No rediseñes el panel y no hagas retoques cosméticos.

Si conservar una ubicación libre sin pérdida exige decidir un modelo nuevo,
frená y traé el caso exacto: no adivines una estructura. Si el barrido descubre
una familia distinta de accesibilidad fuera del modo edición, reportala y no la
mezcles con esta pieza.

Entregá un commit de producto y otro separado con el informe en `PARA-PM.md`.
Corré la regresión nueva, el barrido de accesibilidad en sus dos medidas, build
y `git diff --check`; no repitas pruebas de pagos, catálogo o Railway si estos
archivos no los afectan. Ahí termina la tarea.

**Aceptada por PM el 2026-08-11:** producto `c5d2caa`, informe `6dfff09`. Build
y `diff --check` independientes verdes. La PM desplegó el Backend nuevo en el
Railway descartable y comprobó que una cuenta con teléfono, WhatsApp y ubicación
ausentes sigue con los tres valores `null` después de guardar campos vacíos.
La edición del perfil abrió y pasó axe en escritorio y celular.

El barrido externo completo sí encontró un rojo ajeno a esta pieza: dos
`scrollable-region-focusable` serios en las tablas móviles de productos y
órdenes de administración. No invalida el arreglo de perfil, pero reabre la
puerta global y dispara la tarea siguiente.

## Tarea cerrada y aceptada: cobertura accesible de perfiles y administración

### Evidencia y resultado exigido

1. Reproducí en 390×844 las dos violaciones `scrollable-region-focusable` de
   `administración: productos` y `administración: órdenes`. Hacé que esas
   regiones desplazables sean alcanzables y utilizables por teclado, con foco
   visible y nombre comprensible. No suprimas la regla, no bajes el umbral y no
   agregues `tabIndex` sin comprobar el recorrido real.
2. Se aprueba agregar **un cuarto usuario demo transportista** al seed. Debe
   usar una localidad oficial y tener completos los cinco datos existentes:
   localidad base, transporte, declaración de habilitación, radio positivo y
   capacidad. Seed inicial y repetido deben dejar exactamente una cuenta, sin
   duplicar ni alterar las tres cuentas demo actuales.
3. Usá esa cuenta en `a11y.mjs` para abrir el perfil transportista en lectura y
   edición en escritorio y celular. Exigí un marcador propio de sus controles;
   si la cuenta no es transportista o la sección no abre, la puerta falla. El
   inventario pasa de 46 a **48 pantallas**.
4. El comando completo termina 48/48, con cero violaciones `serious` o
   `critical`. Conservá además build, contraste y `diff --check` verdes. Agregá
   sólo la regresión mínima de idempotencia del seed si la suite actual no lo
   demuestra.

### Alcance y freno

Esta pieza cierra una puerta existente; no rediseñes las tablas ni el panel.
No abras directorio o matching de transportistas, contactos, tarifas, estados
logísticos, pagos, catálogo ni Railway. El usuario demo no publica, compra ni
recibe privilegios nuevos.

Si el rojo de las tablas no se reproduce localmente, no declares verde: traé
la diferencia de navegador/DOM y verificá la semántica del elemento desplazable
con la evidencia externa indicada arriba. Si aparece otra familia distinta de
violaciones, frená y reportala antes de ampliar.

Entregá un commit de producto y otro separado con el informe en `PARA-PM.md`.
Ahí termina la tarea.

**Aceptada por PM el 2026-08-11:** producto `6fd060d`, informe `1f7150f`. Tu
objeción aritmética es correcta: el inventario es 50 y no 48. Build y
`diff --check` independientes verdes. La PM desplegó el Backend nuevo en el
Railway descartable; el seed creó el transportista en la primera corrida y lo
reconoció en la segunda. El barrido público terminó **50/50**, sin violaciones
de ningún impacto. No reabras esta pieza.

## Tarea activa única — bloque largo: listado compatible de transportistas

Objetivo vertical: en el checkout, una persona elige un destino del padrón y
ve, por cada futura orden/vendedor del carrito, los transportistas cuya base
cubre el destino y todos sus orígenes. Es la Pieza B de logística y el bloque
que falta para demostrar la geolocalización de fletes del hito intermedio. No
incluye todavía elegir transportista ni revelar contacto.

### 1. Cerrar primero el dato contractual incompleto

Hoy sólo existen el texto del vehículo y un booleano. `ALCANCE-Y-LIMITES.md` y
`DECISIONS.md` exigen que la habilitación sea una **declaración con detalle y
fecha**.

- Agregá detalle de la declaración y fecha registrada por el servidor. La
  persona no escribe ni retrodata la fecha.
- Registro y edición de transportista exigen el detalle; una declaración nueva
  o un cambio de detalle actualiza la fecha. Se muestra como declaración del
  transportista, nunca como verificación de TopGreen.
- No inventes detalle para perfiles existentes. Si la migración encuentra uno
  sin detalle, queda incompleto y no aparece como compatible hasta completarlo.
  El transportista demo sí debe quedar completo e idempotente.
- Migración reversible, esquema/API, registro, perfil y regresión. Sin archivos,
  organismos externos, vencimientos ni validación oficial.

### 2. Destino oficial y persistente

- Reemplazá provincia fija + ciudad libre del checkout por los selectores
  encadenados del padrón ya usado en catálogo y perfiles. La dirección exacta
  sigue siendo texto libre y no entra al cálculo.
- Cada checkout nuevo envía y valida `shipping_locality_id`. Persistilo en cada
  orden creada, con FK a localidades; las órdenes históricas deben seguir
  leyendo aunque no tengan ese dato. Provincia y ciudad visibles se derivan del
  padrón, no de texto aportado por el cliente.
- Cambiar provincia o localidad invalida inmediatamente cualquier resultado
  anterior. Una respuesta tardía no puede pisar el destino actual.

### 3. Compatibilidad geográfica por carrito

- El backend deriva los grupos del carrito activo: una futura orden por
  vendedor. No acepta que el cliente le dicte vendedor, origen ni radio.
- Para cada grupo, un transportista es compatible sólo si su base está dentro
  de su radio declarado respecto del destino **y de cada localidad de origen
  distinta** de los productos de ese grupo. Un producto sin localidad oficial
  hace que ese grupo no pueda declarar compatibilidad; no se adivina desde
  texto libre.
- Usá `ST_DWithin` sobre `localities.coordinates` para filtrar en base. No
  calcules distancias en Python ni traigas todos los transportistas para
  filtrarlos en memoria. `ST_Distance` puede producir las distancias visibles
  en km.
- Sólo entran cuentas activas, verificadas, transportistas, con declaración
  completa, base válida y radio positivo. La capacidad se muestra pero no
  filtra. No ordenes por “mejor”; el directorio no recomienda.
- La respuesta y las tarjetas muestran nombre, base, vehículo, declaración,
  fecha, radio, capacidad y distancias rectas a destino y a cada origen. No
  envían email, teléfono, WhatsApp, domicilio, CBU ni alias.
- La interfaz distingue cargando, sin coincidencias, grupo sin origen oficial y
  error real. Un destino nuevo reemplaza el listado anterior; no lo mezcla.

### 4. Evidencia obligatoria

- Regresión integral con al menos dos vendedores y orígenes distintos, límites
  dentro/fuera del radio y cambio de destino. Para cada grupo, compará la API
  con SQL/PostGIS equivalente; no uses cantidades fijas del seed.
- Demostrá que un candidato que falla en un solo origen queda afuera, que un
  perfil incompleto queda afuera y que ningún campo de contacto aparece ni en
  el JSON ni en el DOM.
- Demostrá validación y persistencia del destino en las órdenes nuevas sin
  romper lectura de órdenes históricas ni los dos checkouts actuales.
- Build, suite completa, accesibilidad, contraste y `diff --check` verdes. Si
  agregás recorridos permanentes, actualizá el inventario exigido con la cuenta
  correcta y explicala.

### Límites y freno

Bloque estimado de **1–2 días**. No implementes selección de transportista,
contacto, asignación a la orden, vista logística del transportista, tarifa,
ruteo, GPS, mapas, peso/capacidad automática, suscripciones ni pagos nuevos.
No toques Railway. No uses distancia por caminos ni una API externa.

Si el modelo actual de carrito no permite identificar los orígenes por grupo,
o una migración obliga a romper órdenes existentes, frená con el caso concreto
antes de cambiar la regla contractual. Entregá un commit de producto y otro
separado con el informe en `PARA-PM.md`. Ahí termina la tarea.

### Revisión PM de la entrega `e3fe9cb`: no aceptada todavía

El informe `e063c18`, el build independiente y el `diff --check` están verdes,
pero la evidencia funcional tiene un falso verde que bloquea la aceptación:

- `CartContext` mantiene el carrito visible en almacenamiento local y no lo
  sincroniza al agregar, quitar o cambiar cantidades.
- `CheckoutModal` consulta `/logistics/compatible-carriers` al elegir localidad
  antes de ejecutar `/cart/sync`; esa sincronización ocurre recién al avanzar
  a pago.
- El caso 43 prepara por API el carrito del servidor antes de abrir la interfaz.
  Por eso no demuestra que el listado corresponda al carrito que la persona
  acaba de armar en pantalla y puede pasar aunque la integración real falle.

Corregí únicamente esta integración dentro de la tarea ya entregada:

1. Antes de la primera consulta de compatibilidad para el destino elegido,
   sincronizá y esperá el carrito local exacto mediante `/cart/sync`. Si falla
   la sincronización, no consultes compatibilidad y mostrá el error real.
2. El estado de carga debe cubrir sincronización y consulta. La protección
   contra respuestas tardías debe cubrir ambas operaciones: una respuesta de
   un carrito o destino anterior no puede reemplazar el estado vigente.
3. Si el carrito visible cambia con el checkout abierto, invalidá el resultado
   y volvé a sincronizar antes de mostrar compatibilidad. Podés reutilizar una
   sincronización sólo mientras puedas demostrar que representa exactamente el
   mismo snapshot del carrito.
4. Reemplazá el falso verde por una regresión que empiece con carrito servidor
   vacío o deliberadamente distinto, agregue el producto sólo desde la UI,
   abra checkout, elija destino y compruebe que los grupos corresponden
   exactamente al carrito visible. Caso preferido: servidor con producto A y
   UI con producto B; la respuesta debe reflejar B y nunca A.
5. Conservá la comparación SQL/PostGIS y la privacidad del caso 43, pero su
   tramo UI no puede depender del carrito preparado antes por API.

No cambies la migración, la regla geográfica, la declaración, la persistencia
de órdenes, Railway ni abras selección, contacto o asignación. Corré el caso
corregido, la suite y puertas proporcionales, build y `diff --check`. Entregá
un nuevo commit de producto y el informe separado; ahí vuelve a PM.

### Segunda revisión PM de `1ec7082`: todavía no aceptada

El caso A/B nuevo corrige el falso verde original y el alcance se mantuvo bien,
pero la protección declarada para ambas operaciones no está completa:

1. El número de consulta evita que una promesa vieja actualice React, pero no
   evita que su `POST /cart/sync` escriba después de un POST nuevo. Si cambia el
   carrito mientras la primera sincronización está en vuelo, la vieja puede
   terminar última, sobrescribir el carrito servidor y hacer que la consulta
   vigente lea el snapshot anterior. El `if (!vigente()) return` ocurre después
   de que esa escritura ya sucedió.
2. Cuando `localityId` queda vacío, el efecto retorna antes de incrementar
   `consultaDeFletes`. Cambiar provincia borra la localidad; una respuesta en
   vuelo del destino anterior sigue siendo considerada vigente y puede volver
   a escribir `fletes` aunque ya no haya destino.

Corregí sólo esas dos carreras. Serializá o coordiná las sincronizaciones para
que una escritura vieja nunca pueda quedar como estado final ni alimentar la
consulta vigente; cancelar del lado cliente no alcanza si el servidor ya pudo
procesar el POST. Invalidá la generación antes de cualquier retorno por destino
vacío.

Agregá una regresión determinista que demore la sincronización vieja, cambie el
carrito, deje terminar primero la nueva y luego libere la vieja; al consultar,
servidor y listado deben representar únicamente el snapshot nuevo. Agregá el
caso de cambiar provincia o vaciar destino con una respuesta anterior en vuelo:
al finalizar no debe reaparecer ningún listado viejo. No alcanza una prueba
dependiente de tiempos naturales de red.

No reescribas el caso A/B que ya sirve ni amplíes el módulo. Corré los casos
enfocados, suite y puertas proporcionales, build y `diff --check`; entregá nuevo
commit de producto e informe separado. Ahí vuelve a PM.

### Tercera revisión PM de `db85ff4`: todavía no aceptada

La cola es correcta dentro de una instancia y la generación ahora se mueve
antes del retorno. Acepto que el caso 46 no discrimina el arreglo sin volver
observable estado interno: no cambies la interfaz para fabricar esa prueba.

El caso 45, en cambio, no cumple la regresión pedida. No cambia el carrito
mientras la primera sincronización está retenida: el destino dispara B y el
pago intenta sincronizar el mismo B. Que haya una sola escritura demuestra la
deduplicación del mismo retrato, no que A y B se serialicen ni cuál queda al
final.

Hay además un recorrido normal que conserva la carrera: la cola y el retrato
son `useRef` del `CheckoutModal`. Si la persona elige destino con el snapshot A,
cierra el modal mientras el POST está en vuelo, modifica el carrito y reabre
checkout con B, la instancia nueva crea otra cola. El POST B puede terminar
primero y el POST A de la instancia desmontada puede terminar último,
sobrescribiendo el carrito vigente.

Corregí la coordinación en el dueño mínimo que sobreviva al desmontaje del
modal y cubra todas las sincronizaciones de este carrito. No agregues una
segunda solución ni una dependencia. La regresión determinista debe:

1. armar A sólo desde la interfaz, abrir checkout, elegir destino y retener su
   `/cart/sync`;
2. cerrar checkout, cambiar el carrito visible de A a B desde la interfaz y
   reabrirlo;
3. elegir destino, dejar terminar la sincronización B y recién después liberar
   A;
4. comprobar que servidor, listado y paso de pago representan sólo B;
5. ponerse rojo con la cola local actual y verde con la coordinación corregida.

No hace falta otra prueba para el caso 46 ni tocar su corrección. No reabras
PostGIS, migraciones, declaración, órdenes, Railway o la Pieza C. Corré el caso
enfocado, suite y puertas proporcionales, build y `diff --check`; entregá nuevo
commit de producto e informe separado. Ahí vuelve a PM.

### Cuarta revisión PM de `fe73073`: falta el límite de identidad

El caso 45 nuevo sí usa A/B distintos, fuerza el orden y se pone rojo con la
cola local. La coordinación en `CartContext` es el dueño correcto y esa parte
queda conforme. No la reescribas otra vez.

Queda un problema de integridad entre sesiones: `retratoEncolado` resume sólo
producto y cantidad, y la cola sobrevive al logout porque vive en el proveedor.
Si la cuenta A ya sincronizó X, cierra sesión y la cuenta B arma el mismo X, la
función puede considerarlo sincronizado aunque el carrito servidor de B esté
vacío o sea distinto. Además, un turno de A encolado pero todavía no iniciado
ejecuta `apiFetch` cuando le llega el turno; si para entonces entró B, puede usar
las credenciales vigentes de B para escribir la instantánea de A.

Corregí sólo el límite de sesión:

1. La deduplicación debe incluir la identidad autenticada, no sólo el retrato
   del carrito. Un login nuevo nunca hereda “ya sincronizado” de otro usuario.
2. Trabajo encolado bajo una sesión no puede comenzar usando credenciales de
   una sesión posterior. Al salir o cambiar de identidad debe descartarse de
   forma segura o conservar explícitamente su identidad original; no alcanza
   con vaciar los ítems visibles.
3. Una petición que ya salió antes del logout puede terminar para su usuario
   original, pero no puede bloquear ni sobrescribir el carrito de la cuenta
   nueva.

Agregá una regresión determinista, sin recargar: A sincroniza un carrito X,
cierra sesión, entra B con carrito servidor vacío o distinto, arma el mismo X
desde la interfaz y elige destino. Debe salir una sincronización nueva y sólo el
carrito de B debe quedar en X. Cubrí además un turno de A encolado pero aún no
iniciado al cambiar de cuenta: nunca debe salir autenticado como B ni escribir
en su carrito.

No cambies autenticación general, no agregues dependencia y no abras alcance.
Conservá los casos 43, 45 y 46. Corré el caso nuevo o ampliado, suite y puertas
proporcionales, build y `diff --check`; entregá nuevo commit de producto e
informe separado. Ahí vuelve a PM.

### Quinta revisión PM: Pieza B aceptada

Aceptados producto `e3fe9cb` con cierre `93ea92c` e informe final `8dc9543`.
Los casos 43, 45, 47 y 48 ahora miden los recorridos reales pedidos. Build y
`diff --check` independientes verdes. La PM intentó la suite completa, pero no
pasó de la preparación porque el daemon de Docker local está apagado; se acepta
la evidencia 48/48 informada junto con la inspección de las regresiones. No
reabras esta pieza.

## Tarea activa única — credenciales contradictorias

Tu hallazgo queda confirmado en código: los endpoints protegidos prefieren la
cookie de acceso sobre el Bearer, y refresh hace lo mismo con su cookie. Si
ambos pertenecen a usuarios distintos, hoy la API opera silenciosamente como
uno de ellos. Es un límite de identidad, no una preferencia de transporte.

### Resultado exigido

1. Una sola credencial presente sigue funcionando, tanto cookie como Bearer.
2. Si cookie y Bearer están presentes y son el mismo token, funciona una sola
   vez como esa identidad.
3. Si ambos están presentes y difieren, la API responde 401 sin revelar cuál
   era válido y sin leer datos privados ni ejecutar ninguna escritura. No gana
   cookie ni header y no se intenta continuar con uno después de rechazar otro.
4. Aplicá la misma regla a access y refresh. Los endpoints opcionales no pueden
   personalizar una respuesta bajo credenciales contradictorias: deben quedar
   anónimos o rechazar de forma consistente, sin elegir identidad.
5. Login, refresh automático, logout y los clientes actuales de una sola fuente
   siguen funcionando. No cambies tokens, expiraciones, cookies, localStorage,
   roles, CORS ni criptografía.

### Evidencia obligatoria

- Regresión con dos cuentas reales: header A + cookie B sobre `/auth/me` y una
  escritura protegida como `/cart/sync` debe dar 401 y dejar ambas cuentas sin
  cambios. Invertí A/B para demostrar que el orden no decide.
- Los equivalentes con sólo header, sólo cookie y ambos iguales deben conservar
  identidad y funcionar.
- Repetí la matriz para `/auth/refresh`, usando refresh tokens; una contradicción
  no emite tokens nuevos ni modifica cookies de sesión.
- Conservá 43, 45, 47 y 48. Suite completa, build y `diff --check`; pruebas de
  accesibilidad/contraste sólo si tocás interfaz, cosa que no debería hacer falta.

### Alcance y freno

Resolvé la fuente contradictoria en el punto común mínimo. No refactorices toda
la autenticación, no cambies el contrato de respuestas salvo el conflicto, no
agregues revocación, sesiones en base, CSRF, OAuth ni dependencias. Si una
fuente única existente depende realmente de la precedencia actual, traé el
recorrido antes de ampliar. Entregá commit de producto e informe separado; ahí
vuelve a PM.

**Aceptada por PM:** producto `70b0d7b`, informe `ce5ae84`. Build, sintaxis
Python y `diff --check` independientes verdes; la dev informa 50/50. La regla
401 ante tokens distintos coincide con el criterio y no se detectó elección de
identidad posterior al rechazo. No reabras esta pieza.

## Tarea activa única — bloque largo: selección e inclusión del flete

Objetivo vertical: completar la Pieza C usando el flujo aprobado en
`docs/ux/logistica/`. Para cada grupo del carrito —una futura orden por
vendedor— el comprador debe elegir explícitamente un transportista compatible
o declarar que coordina el traslado por su cuenta. La decisión llega a la orden
y cada participante ve únicamente lo necesario.

Bloque estimado de **1–2 días**. Mantené esfuerzo Extra: toca autorización,
privacidad, migración y los dos checkouts.

### 1. Decisión explícita y contacto protegido

- La elección es por grupo/vendedor, no una sola para todo el carrito. Ninguna
  orden puede quedar en el estado ambiguo “necesito flete pero no elegí”.
- Las dos únicas decisiones válidas son transportista seleccionado o traslado
  por cuenta propia. La interfaz no avanza hasta resolver todos los grupos.
- Antes de elegir, el listado conserva cero email, teléfono, WhatsApp,
  domicilio y datos bancarios. Al seleccionar, el backend vuelve a derivar el
  grupo del carrito y revalida que ese transportista cubra destino y todos sus
  orígenes; recién entonces devuelve al comprador email y los teléfonos de
  contacto disponibles. No confíes en los candidatos enviados por el cliente.
- Cambiar destino, productos, cantidades o vendedor invalida inmediatamente
  selección y contacto de los grupos afectados. Una respuesta tardía no puede
  restaurarlos. Quitar/cambiar selección vuelve a ocultar el contacto.
- “Por cuenta propia” no revela contacto ni crea un transportista ficticio.

### 2. Persistencia y atomicidad de los dos checkouts

- Persistí por orden el modo de traslado y, cuando corresponda, el
  transportista elegido mediante una relación válida. Migración reversible;
  órdenes históricas sin esos datos siguen legibles y se muestran como traslado
  no definido, no se reinterpretan como cuenta propia.
- Transferencia y Mercado Pago reciben el mapa de decisiones, pero el backend
  deriva los grupos reales. Debe exigir exactamente una decisión por grupo,
  rechazar grupos extra, vendedores inyectados, transportistas incompatibles,
  inactivos o incompletos y cualquier carrier en modo cuenta propia.
- Revalidá todo justo antes de crear órdenes. Si falla una decisión, no se crea
  ninguna orden, no se descuenta stock y no queda una operación parcial.
- La compatibilidad se exige al elegir y otra vez al confirmar; que el perfil,
  radio, origen o destino cambien entre ambos pasos debe producir un error
  visible y conservar el carrito.

### 3. Vistas y límites de privacidad

- Comprador: en checkout/resumen e historial ve su decisión. Si eligió
  transportista, ve nombre, base, transporte, capacidad y contacto; si eligió
  cuenta propia, ve esa frase y nada más.
- Vendedor: en la venta ve transportista elegido y su contacto, o que el
  comprador coordina por su cuenta. No gana acciones logísticas nuevas.
- Transportista elegido: vista propia de operaciones asignadas con origen,
  destino, artículos y cantidades existentes. No recibe teléfono/email del
  comprador, precios, totales, comprobantes, CBU, alias ni otros datos
  financieros. Un transportista no elegido no puede enumerar ni abrir la
  operación.
- Una asignación histórica sigue visible aunque el perfil luego quede
  incompleto o inactivo; eso no lo vuelve elegible para operaciones nuevas.
- No agregues aceptar/rechazar viaje, estados de entrega, chat, notificaciones,
  tarifa ni pago al transportista.

### 4. Evidencia obligatoria

- Recorrido integral con al menos dos vendedores: uno resuelto con
  transportista y otro por cuenta propia. Probá ambos checkouts y contrastá
  órdenes/stock con SQL, sin cantidades fijas del seed.
- Contacto ausente antes de seleccionar tanto en JSON como DOM; presente sólo
  para el comprador después de revalidar. Quitar selección y cambiar destino o
  carrito vuelven a ocultarlo.
- Inyección de carrier incompatible/de otro grupo y decisiones faltantes o
  extra: rechazo atómico, cero órdenes nuevas y stock intacto.
- Autorización de las tres vistas: comprador y vendedor ven lo permitido;
  carrier elegido ve sólo necesidad logística; carrier ajeno recibe 403/404;
  ningún JSON ni DOM del carrier contiene datos financieros o contacto del
  comprador.
- Orden histórica sin decisión sigue legible. Migración downgrade/upgrade y
  `alembic check` verdes.
- Suite completa, build, accesibilidad en escritorio/celular para cada pantalla
  nueva, contraste y `diff --check`. Actualizá los inventarios con aritmética
  explícita si agregás recorridos permanentes.

### Alcance y freno

Reutilizá el padrón, la consulta PostGIS, el agrupamiento del carrito, las
órdenes y el prototipo ya aprobados. No rediseñes el checkout fuera de ese
acuerdo y no agregues dependencias. No implementes mapas, distancia por ruta,
GPS, cálculo de peso/capacidad, precio o cobro del flete, Carta de Porte,
mensajería, planes ni Railway.

Si los dos checkouts no pueden validar todas las decisiones antes de la primera
escritura, frená con el caso concreto: no aceptamos compensar órdenes parciales
después. Entregá commit de producto e informe separado; ahí vuelve a PM.

### Primera revisión PM de `ecfaa4c`: todavía no aceptada

La arquitectura general, la revalidación compartida, la atomicidad previa a la
primera fila y los límites de las tres vistas quedan conformes. Build, sintaxis
Python y `diff --check` independientes verdes. No reescribas esas partes.

Quedan dos defectos funcionales concretos:

1. **Una selección tardía restaura una decisión descartada.**
   `elegirTransportista` sólo compara la generación de destino/carrito. Si el
   POST está en vuelo y la persona cambia ese grupo a “coordino por mi cuenta”,
   la generación no cambia; cuando llega la respuesta, vuelve a guardar modo
   `carrier` y revela el contacto. El caso 52 espera cada respuesta y por eso no
   cubre la carrera.
2. **El origen de una operación histórica es mutable.** `_operacion` recorre
   `item.product.locality`, que es la localidad actual de la publicación. El
   vendedor puede editarla después de la compra y el transportista pasa a ver
   otro punto de retiro. Nombre y cantidad ya son snapshots; el origen de la
   carga también debe representar el momento de la orden.

Corregí únicamente esos dos puntos:

- Cada cambio de decisión de un grupo —por cuenta propia, quitar, cambiar o una
  nueva selección— invalida cualquier selección anterior en vuelo para ese
  grupo. Una respuesta tardía puede terminar en red, pero no cambiar la decisión
  ni volver a mostrar contacto. No hace falta bloquear toda la pantalla.
- Guardá por ítem de orden el origen oficial usado al confirmar. Debe ser un
  snapshot estructurado y legible aunque después cambie la publicación. Las
  operaciones nuevas lo leen de ahí; los ítems históricos sin snapshot siguen
  legibles sin inventar origen. Migración reversible y sin reinterpretar datos
  anteriores.

### Regresiones exigidas

1. Retené determinísticamente la respuesta de `/logistics/select-carrier`,
   elegí “por cuenta propia” antes de liberarla y comprobá que, al llegar, sigue
   modo propio, no aparece contacto y el checkout envía `self`. La prueba debe
   ponerse roja con `ecfaa4c`; no uses tiempos naturales de red.
2. Creá una orden con transportista y origen A, cambiá después la localidad de
   la publicación a B y comprobá por API y DOM del transportista que la
   operación conserva A. Restaurá la publicación al terminar.
3. Una orden/ítem anterior sin snapshot de origen sigue siendo legible y no se
   presenta falsamente como A ni B. Probá downgrade/upgrade y `alembic check`.

Conservá los casos 51–55; ajustá el inventario sólo si agregás una ruta visual
permanente, no por sumar regresiones dentro de una ruta existente. Corré casos
enfocados, suite completa, build, puertas visuales proporcionales y
`diff --check`. No agregues restricciones, snapshots de contacto, estados
logísticos ni dependencias fuera de estos dos defectos. Entregá commit de
producto e informe separado; ahí vuelve a PM.

**Aceptada por PM:** producto inicial `ecfaa4c`, cierre `a960eef`, informe
`75379a2`. Las regresiones 56–58 discriminan contra la versión anterior; ambos
checkouts congelan origen y la respuesta tardía ya no recupera contacto. Build,
sintaxis Python y `diff --check` independientes verdes. La dev informa 58/58,
56/56 y 40/40. No reabras la Pieza C.

## Tarea activa única — puerta del hito intermedio

No construyas otra función. El segundo hito depende de **demostrar juntas** las
tres capacidades textuales: catálogo, búsquedas y geolocalización funcional.
Hoy existen, pero su evidencia está repartida entre casos distintos.

Dejá un único recorrido de navegador, reproducible desde base limpia, que:

1. use el catálogo real y aplique categoría más provincia/localidad desde la
   interfaz; contraste los resultados visibles con SQL, sin cantidades fijas;
2. abra un producto del resultado, lo agregue, elija destino oficial y muestre
   el grupo/origen que el servidor derivó;
3. muestre al menos un transportista compatible calculado por PostGIS, sin
   contacto previo; lo seleccione, revele contacto y cree la orden;
4. contraste por SQL destino, origen congelado, transportista y modo de traslado;
5. entre como el transportista y muestre esa operación sin datos financieros ni
   contacto del comprador.

El recorrido debe usar sólo datos que deja el **seed idempotente**. No puede
preparar productos, radios, carritos u orígenes por API/SQL antes de abrir el
navegador. Si el seed actual no ofrece un tramo compatible, hacé el cambio
mínimo sobre el transportista demo o una publicación demo existente y probá
seed inicial + repetido sin duplicar. SQL se usa después para contrastar, no
para fabricar el escenario.

Agregá un comando explícito y corto para ejecutar esta puerta sin correr casos
ajenos; debe terminar con un resumen legible para una demostración y rojo ante
cualquier paso omitido. Reutilizá Playwright y helpers existentes, sin nueva
dependencia ni segundo framework. Conservá la suite completa y las puertas ya
aceptadas; build y `diff --check` verdes.

No toques Railway, Mercado Pago, estilos, migraciones, privacidad ni reglas de
compatibilidad salvo que descubras un defecto reproducible —en ese caso frená y
reportalo. Entregá commit de producto y el informe separado. Esta tarea va en
esfuerzo **Alto**, no Extra. Ahí vuelve a PM para decidir si el hito intermedio
queda habilitado para presentar y cobrar.

### Primera revisión PM de `1e8822d`: todavía no aceptada

El alcance es correcto y no hay cambios de producto. Build, sintaxis y
`diff --check` independientes están verdes. La PM no pudo ejecutar la ruta
oficial desde base limpia porque su Docker local está apagado; eso es un límite
del entorno PM, no un defecto atribuido a la entrega. No reabras el recorrido ni
sumes casos.

Corregí sólo estos dos falsos positivos de la puerta:

1. En el paso del catálogo, eliminá `waitForTimeout(1200)`. Sincronizá con una
   señal determinística de la consulta de productos correspondiente a la
   categoría, provincia y localidad elegidas, y recién después compará DOM con
   SQL. Una respuesta más lenta no puede producir una medición prematura.
2. En la vista del transportista, delimitá la comprobación a la tarjeta de
   `Operación #${datos.orden}`. Dentro de esa tarjeta deben estar el producto,
   la cantidad y el recorrido de esa orden; dentro de esa misma tarjeta no
   pueden aparecer importes, datos financieros ni contacto del comprador. La
   presencia de esos textos en otra operación no puede hacer pasar el caso.

Agregá una regresión mínima o una falla forzada que demuestre cada discriminante
sin crear otro framework. Conservá el comando, los seis pasos, el helper SQL y
la suite completa. El informe separado debe citar el commit real `1e8822d` como
entrega inicial —no `cc08aa2`— y el nuevo commit de cierre. Esfuerzo **Alto**.

**Aceptada por PM:** producto inicial `1e8822d`, cierre `3580faa`, informe
`803e8e9`. Las dos fallas forzadas discriminan los falsos positivos anteriores;
build, sintaxis y `diff --check` independientes verdes. La Dev informa puerta
6/6 y suite 58/58. El hito intermedio queda habilitado para presentar y cobrar.

## Tarea activa única — contrato monetario antes de Fase 4

Objetivo: que ningún total que se guarda o decide una orden pase por aritmética
binaria `float`. Cerrá juntos los dos recorridos existentes —checkout común y
transferencia— antes de reconstruir Mercado Pago.

Alcance exacto:

1. Usá `Decimal` desde el precio `NUMERIC` hasta subtotal, total, snapshot y
   persistencia en ambos checkouts. Incluí los totales del carrito sincronizado
   y `transfer-options`, porque alimentan esos recorridos. Multiplicación y suma
   monetarias no pueden volver a `float`.
2. Reutilizá `app/core/montos.py` y los límites `NUMERIC(12,2)` / `(14,2)` ya
   aceptados. Centralizá sólo lo mínimo que evite repetir conversión o
   cuantización. No agregues una segunda política de redondeo.
3. Conservá el contrato JSON que hoy consume el frontend. Si el borde exige un
   número JSON, convertí sólo después de calcular y validar el `Decimal`; no
   uses esa conversión para persistir ni continuar aritmética.
4. No toques distancias, ratings, stock ni otros `float` no monetarios. No
   actives ni refactorices `payments.py`: sus routers siguen desmontados y se
   reconstruyen en la siguiente pieza. No hace falta migración; las columnas ya
   son `Numeric` con precisión correcta.

Regresiones obligatorias, en ambos checkouts:

- tres unidades de un precio con centavos simples (por ejemplo 0,10) conservan
  exactamente 0,30 en opción/carrito, respuesta y SQL;
- 99 unidades de `9.999.999.999,97` conservan exactamente
  `989.999.999.997,03`; esta prueba debe ponerse roja contra el cálculo `float`
  anterior y contrastar snapshots, subtotal y total por API y SQL;
- varios vendedores mantienen total independiente y, si uno excede el máximo,
  el rechazo ocurre antes de escribir cualquier orden y el carrito sigue
  activo, como ya exige la atomicidad aceptada.

No uses comparación redondeada de pantalla como única prueba: el discriminante
de centavos debe observar el valor de API y SQL. Conservá suite, puerta del hito,
build y `diff --check` verdes. Entregá commit de producto e informe separado con
los comandos y una demostración explícita de rojo contra la versión anterior.
Esta pieza va en esfuerzo **Extra** por cruzar los dos caminos que crean órdenes;
no abras Mercado Pago ni cambios visuales.

**Aceptada por PM:** producto `2220e94`, informe `8abaeb2`. Los casos 59–61
discriminan contra la aritmética anterior; build, sintaxis, importes exactos y
`diff --check` independientes verdes. La Dev informa suite 61/61 y puerta 6/6.
No reabras esta pieza.

## Consulta técnica adversarial — quién cobra por Mercado Pago

No implementes nada todavía. PM releyó el PDF original y corrigió una premisa:
la propuesta promete «checkout básico» para crédito, débito y dinero en cuenta,
pero no define destinatario, split ni OAuth. «Sin OAuth de vendedores» fue una
interpretación interna posterior, no texto ofrecido a la clienta.

Contrastá, con documentación oficial vigente y el código actual, esta hipótesis
de PM: **Checkout Pro usando el token OAuth de cada vendedor, sin comisión de
marketplace, es la forma mínima y más segura de cumplir el checkout vendido sin
que TopGreen reciba ni redistribuya fondos de terceros.** Sé adversarial; si la
hipótesis es falsa o incompleta, decilo.

Respondé en `PARA-PM.md`, sin código ni dependencias, con evidencia concreta:

1. si Mercado Pago Argentina admite ese flujo y si `marketplace_fee` puede
   omitirse o quedar efectivamente en cero;
2. quién figura como cobrador y quién paga la comisión normal de Mercado Pago;
3. si Checkout Pro cubre crédito, débito y dinero en cuenta en ese modelo;
4. qué onboarding, credenciales, OAuth, refresh, cifrado y revocación requiere
   por vendedor;
5. cómo se alinea con una orden por vendedor y qué pasa con un carrito de varios
   vendedores;
6. qué hace falta para preferencia, retorno, webhook firmado, idempotencia y
   estados, separando prueba automática de credenciales reales externas;
7. tamaño aproximado y riesgos frente a la alternativa de que cobre TopGreen.

No uses el módulo heredado como autoridad: tiene split 5 %, OAuth y supuestos
viejos. Señalá qué puede reutilizarse sólo después de compararlo con la API
actual. Esta consulta va en esfuerzo **Alto**, no Extra. Hasta que PM responda,
no montes `payments.py`, no restaures comisión y no cambies esquema ni entorno.

**Análisis aceptado por PM:** informe `925de4e`, con una corrección contractual.
Mercado Pago está prometido explícitamente en el PDF y no puede correrse sin
acuerdo con la clienta. Para cumplir específicamente ese requisito sin que
TopGreen cobre fondos ajenos, OAuth por vendedor es el camino mínimo seguro.

PM confirmó directamente en la documentación oficial:

- Checkout Pro de marketplace usa el token OAuth de cada vendedor;
- la comisión de Mercado Pago se descuenta de los fondos del vendedor y la de
  marketplace puede ser cero (`marketplace_fee: 0`);
- Checkout Pro sigue creando preferencias en `/checkout/preferences`; API
  Orders es una alternativa de Checkout API, no el reemplazo de este flujo;
- el modelo general disponible es 1:1; 1:N requiere cartera asesorada/contacto
  comercial con Mercado Pago;
- webhooks llevan firma y se reintentan, por lo que firma, consulta posterior e
  idempotencia propia son obligatorias.

Emi confirmó las consecuencias de producto: cada vendedor vincula Mercado Pago,
cobra directamente y paga la comisión normal; TopGreen aplica comisión de
marketplace cero. Un carrito multivendedor se paga por órdenes separadas. La
implementación queda habilitada por piezas y pasa a **Extra**.

## Tarea activa única — Pieza MP-A: vínculo OAuth seguro del vendedor

Construí sólo la base que permite conectar una cuenta vendedora de Mercado Pago
sin activar todavía preferencias, pagos, retornos ni webhooks. El resultado debe
permitir vincular, consultar el estado, renovar/revincular y desvincular desde el
panel del vendedor sin exponer secretos.

### Contrato de seguridad y producto

1. El flujo usa OAuth oficial con estado aleatorio, de un solo uso, con
   vencimiento y ligado al usuario que inició el vínculo. Callback repetido,
   vencido, alterado o asociado a otra sesión no vincula nada.
2. Access token, refresh token y cualquier verificador sensible quedan cifrados
   en reposo con una clave fuera del repositorio. No debe quedar ningún token
   recuperable como texto plano en base, respuesta, URL ni log. La migración
   retira o invalida las columnas heredadas en claro sin intentar conservar
   vínculos demo inseguros.
3. Un mismo usuario de Mercado Pago no puede quedar vinculado a dos cuentas de
   TopGreen. El refresh rota credenciales de manera atómica; token vencido,
   revocado, clave incorrecta o respuesta externa inválida fallan cerrado y
   dejan un estado accionable de «reconectar», nunca un 500 opaco.
4. Desvincular borra localmente todas las credenciales y el identificador
   asociado. Eliminá la vía `manual-link`: pegar un access token no es un método
   permitido.
5. El panel del vendedor muestra sólo desconectado, conectado o requiere
   reconexión, con acciones coherentes. Ningún dato secreto ni error crudo de
   Mercado Pago llega al navegador. Conservá la UI existente; no rediseñes.
6. Configuración ausente devuelve un estado seguro y explícito sin degradar el
   resto del marketplace. Actualizá ejemplos y documentación de variables sin
   valores reales. Verificá contra documentación oficial si el SDK fijado se
   usa en esta pieza; actualizalo sólo si aporta una API utilizada y compatible.

Podés reescribir o reemplazar `mp_oauth.py`; el archivo heredado no es
autoridad. **No montes ni refactorices `payments.py`**, no restaures el 5 %, no
crees preferencias y no cambies estados de órdenes o stock. No agregues
suscripciones, custodia, 1:N, conciliación, reembolsos ni credenciales reales.

### Evidencia obligatoria

- Migración upgrade/downgrade y `alembic check`; una inspección de base prueba
  que los tokens ficticios no aparecen en claro.
- Pruebas con el servicio externo simulado: éxito, timeout/error, estado
  alterado/vencido/reutilizado, cuenta MP duplicada, refresh con rotación,
  revocación y desvinculación. La misma prueba verifica que respuesta y logs no
  contienen secretos.
- Una regresión demuestra que `manual-link` ya no existe y que los routers de
  cobro siguen en 404; sólo queda activo el alcance OAuth aceptado.
- Recorrido de navegador del vendedor en escritorio y celular: desconectado →
  iniciar vínculo simulado → conectado → desvinculado/reconectar. Accesibilidad
  y contraste proporcionales a las pantallas tocadas.
- Suite completa, puerta del hito, build, sintaxis Python y `diff --check`
  verdes. Si agregás recorridos permanentes, actualizá inventarios con
  aritmética explícita.

### Condición de freno y entrega

Si Mercado Pago no permite asegurar alguno de estos estados sin una decisión
de producto adicional, o la migración encuentra tokens reales no nulos, frená
y reportá el caso antes de borrarlos. No pruebes con credenciales de producción.

Entregá un commit de producto y otro separado con el informe en `PARA-PM.md`:
decisiones tomadas, esquema final, versión/dependencias justificadas, comandos,
resultados y riesgos residuales. Ahí vuelve a PM. La Pieza MP-B —preferencia por
orden y secuencia multivendedor— no empieza hasta que MP-A sea aceptada.

### Primera revisión PM de `5aee032`: todavía no aceptada

La arquitectura y el límite de la pieza son correctos: las credenciales quedan
cifradas, `manual-link` desaparece, sólo se monta OAuth y el módulo que mueve
dinero sigue apagado. PM obtuvo build, sintaxis Python y `diff --check` verdes.
No reescribas esos bloques ni abras preferencias, órdenes o webhooks.

Quedan tres defectos acotados y falta la entrega documental:

1. **El freno destructivo acepta cualquier texto.** La migración documenta que
   sólo `MP_MIGRACION_DESCARTAR_TOKENS=1` autoriza el descarte, pero comprueba
   sólo que la variable sea no vacía. Hoy `=0`, `=false` o un error tipográfico
   también borran credenciales. Exigí igualdad exacta con `1` y probá que sin
   variable, con `0` y con `false` la migración se detiene sin modificar nada;
   sólo con `1` avanza.
2. **Una clave Fernet mal formada todavía puede producir 500 al renovar.**
   `integracion_configurada()` considera configurada cualquier cadena no vacía;
   después `refresh_token_de()` captura `NoSeDescifra`, pero no
   `SinClaveDeCifrado`. El caso 71 usa otra clave Fernet válida y no discrimina
   este camino. Agregá una regresión con una clave no vacía inválida: estado,
   inicio y renovación deben fallar cerrados con una respuesta accionable, sin
   500 ni secreto.
3. **Cancelar no gasta el `state`.** El callback retorna `cancelado` antes de
   llamar a `consumir_estado`; ese intento queda vigente hasta expirar aunque
   ya volvió de Mercado Pago. Consumí y validá el `state` también en la salida
   cancelada, y comprobá que repetirlo después devuelve `estado_invalido` y no
   escribe vínculo.

Eliminá además los dos helpers JWT de OAuth que quedaron sin ningún llamador en
`core/security.py`: el contrato nuevo dice que el `state` vive sólo en base y
dejar una segunda implementación muerta contradice esa propiedad.

Conservá los casos 62–71 y sumá sólo los discriminantes anteriores. Corré los
casos enfocados y una única vez al final la suite completa, hito, accesibilidad,
contraste, build, migración upgrade/downgrade, `alembic check` y `diff --check`.
Entregá un commit de corrección y el informe separado que todavía falta en
`PARA-PM.md`, con resultados reales y aritmética de inventarios. Esfuerzo
**Extra**. Ahí vuelve a PM; MP-B sigue cerrada.

**Aceptada por PM:** producto inicial `5aee032`, corrección `e5cb94e` e informes
`81f89ce` y `38a952b`. Los casos 72–74 discriminan los tres defectos contra la
entrega inicial. PM obtuvo build, sintaxis, revisión directa de los
discriminantes y `diff --check` verdes; Docker local apagado impidió repetir la
suite. La Dev informa 74/74, hito 6/6, accesibilidad 56/56 y contraste 40/40.
No reabras MP-A.

## Tarea activa única — Pieza MP-B: contrato plural y preferencias seguras

Prepará el checkout por vendedor y una preferencia estable de Checkout Pro por
orden, pero **no habilites cobros reales todavía**. Esta pieza corre de punta a
punta contra el doble local; la activación productiva queda cerrada hasta que
MP-C acepte webhook, estados y reserva/liberación de stock.

### 1. Decisión de producto

- Mercado Pago es opcional por vendedor. Sin vínculo usable, el vendedor sigue
  publicado y ofrece transferencia si tiene CBU o alias.
- El carrito se resuelve por grupos de vendedor. Cada grupo exige exactamente
  un medio disponible y una decisión logística; un grupo puede usar Mercado
  Pago y otro transferencia.
- Un carrito multivendedor genera una orden por vendedor y, para cada grupo MP,
  una preferencia y un pago separado. La pantalla lo explica antes de confirmar.

### 2. Contrato y atomicidad local

Corregí el contrato singular de `/orders/checkout`: nunca puede crear varias
órdenes y devolver sólo la primera. Reutilizá la validación y creación común de
los dos checkouts; no mantengas una tercera copia de totales, stock, snapshots o
logística.

Antes de la primera escritura, el servidor deriva los grupos del carrito y
revalida en conjunto: destino, traslado, medio elegido, datos bancarios cuando
corresponda, vínculo MP legible, precio vigente, cantidades y totales. Una
decisión faltante, extra, de otro vendedor o ya no disponible rechaza todo sin
órdenes nuevas y deja el carrito activo.

La respuesta es plural y estable: una entrada por orden con vendedor, medio,
total congelado y estado de preparación. Transferencia conserva su snapshot
bancario; MP tiene una única fila de pago por orden. No uses el modelo heredado
como contrato: eliminá o migrá campos de comisión/respuesta cruda que mientan o
no hagan falta. Comisión TopGreen es cero.

### 3. Preferencia de Checkout Pro

- Usá la superficie estable de **preferencias**, no Orders beta. Verificá y
  fijá una versión oficial compatible del SDK sólo si realmente se usa; no
  actualices por decoración.
- La autorización es el access token descifrado del vendedor. Vínculo caído
  antes de crear deja ese grupo sin MP y no cae a transferencia en silencio.
- Importe, moneda e ítems salen de la orden y sus snapshots ya persistidos. No
  se recalcula dinero, no hay aritmética `float` y no se toma el precio actual
  después de confirmar.
- Omití `marketplace_fee`; no mandes 5 ni una comisión duplicada. Usá
  `external_reference` inequívoca, URLs públicas por configuración y una clave
  de idempotencia estable por orden.
- Persistí sólo identificadores, URL necesaria, importe exacto y estado propio.
  No guardes el cuerpo completo de Mercado Pago ni secretos.
- Reintentar tras timeout, doble clic o respuesta perdida reutiliza la misma
  orden/idempotencia y nunca crea otra orden ni otra intención local.

### 4. Cerrado hasta MP-C

Agregá un interruptor explícito de checkout MP, apagado por defecto y en los
ejemplos/Railway. Con él apagado, ninguna ruta de comprador crea preferencias,
el esquema/UX no ofrece pagar por MP y transferencia sigue funcionando. La
suite lo enciende sólo contra el doble local. No uses credenciales reales.

La UI puede demostrar la cola de órdenes y enlaces contra el doble, pero no
declara «pagado» por volver de una URL: retorno del navegador no es evidencia
de pago. Todavía no descuentes ni reserves stock por Mercado Pago, y por eso la
bandera productiva no se habilita. MP-C incorporará webhook firmado, consulta a
MP, estados idempotentes y la política de stock antes de permitir dinero real.

### 5. Evidencia y freno

- Un vendedor MP y otro por transferencia: decisiones visibles por grupo,
  confirmación única, dos órdenes y una sola preferencia; respuesta y SQL
  coinciden sin cantidades fijas del seed.
- Dos vendedores MP: dos órdenes/preferencias diferenciadas y reanudables;
  doble clic, timeout antes/después de la respuesta y reintento no duplican.
- Vínculo ausente, revocado o ilegible; elección inyectada; decisión faltante o
  extra: rechazo anterior a toda escritura externa/local y carrito intacto.
- Payload capturado por el doble: total exacto desde snapshot, vendedor
  correcto, `external_reference`, retornos/notificación configurados y ausencia
  de `marketplace_fee`, token, secreto y floats recalculados.
- Con bandera apagada: cero preferencia y cero oferta MP en API/DOM; transferencia
  completa sigue verde. Ningún retorno modifica orden o pago.
- Migraciones ida/vuelta y `alembic check`; suite completa, hito, build,
  accesibilidad/contraste proporcionales y `diff --check` verdes.

Si crear la preferencia exige comprometer stock, marcar pagado por retorno o
activar una ruta real antes de MP-C, frená: no tapes ese borde con rollback
después de un efecto externo. Entregá commit de producto e informe separado con
rojo contra la versión anterior, comandos, inventarios y riesgos. Esfuerzo
**Extra**. Ahí vuelve a PM; no abras webhook ni producción.

### Primera revisión PM de `c671a4c`: todavía no aceptada

El alcance principal queda conforme: regla común de checkout, respuesta plural,
medio por vendedor, preferencia sin comisión, pago único por orden, bandera
apagada y eliminación del módulo heredado. PM obtuvo build, sintaxis y
`diff --check` verdes; no reabras esos bloques ni agregues webhook o stock.

Quedan tres defectos funcionales de MP-B:

1. **El doble clic probado no es el doble clic peligroso.** El caso 77 dispara
   cinco veces `payment-link` sobre una orden ya creada. Dos
   `POST /orders/checkout` simultáneos todavía pueden leer el mismo carrito
   `ACTIVE`, crear dos juegos de órdenes y dos preferencias: `carrito_activo()`
   no bloquea la fila y `crear_ordenes()` recién la convierte al final. Cerrá la
   carrera en base —no con un booleano del navegador— y probala reteniendo dos
   confirmaciones concurrentes. Exactamente una convierte el carrito; la otra
   recibe 4xx accionable, sin nuevas órdenes, pagos ni preferencias.
2. **Una orden terminal conserva una puerta de pago.** `payment-link` comprueba
   dueño y medio, pero no estado. Después de cancelar o rechazar una orden MP,
   vuelve a entregar la preferencia existente; si todavía no existía, puede
   crearla. Una orden `CANCELLED`, `REJECTED` o cualquier estado no pagable no
   ofrece ni crea link. Marcá coherentemente la intención local al cancelar y
   dejá explícito el riesgo residual del link externo ya conocido para MP-C.
   No inventes reembolso ni llames a Mercado Pago en esta pieza.
3. **La reanudación existe sólo como API.** El informe reconoce que cerrar el
   modal deja al comprador sin forma visible de recuperar el link. «Reanudable»
   fue criterio de MP-B, no una mejora posterior. En `Mis compras`, sólo el
   comprador y sólo para su orden MP todavía pagable ve «Continuar pago» o
   «Preparar pago» usando la ruta idempotente. Nunca aparece en transferencia,
   vendedor, transportista ni orden terminal; recargar conserva la salida.

Agregá regresiones que se pongan rojas contra `c671a4c` para los tres puntos,
incluido navegador en escritorio y celular para recuperación/ausencia del CTA.
Conservá 75–81 y ajustá inventarios sólo si realmente aparece una pantalla
nueva; una acción dentro de «Mis compras» no crea por sí sola otra pantalla.
Corré suite completa una vez al final, hito, build, accesibilidad, contraste,
migración ida/vuelta, `alembic check` y `diff --check`. Entregá corrección de
producto e informe separado. Esfuerzo **Extra**; MP-C sigue cerrada.

### Segunda revisión PM de `fe4a0b2`: queda una corrección bloqueante

Los tres defectos anteriores quedan conformes por código y por las regresiones
82–84: la conversión condicional del carrito cierra la doble confirmación, una
orden terminal ya no ofrece ni crea pago y «Mis compras» recupera el enlace
sólo para el comprador. PM obtuvo build, sintaxis y `diff --check` verdes. No
reabras esos bloques.

Queda un único 500 reproducible por inspección en la misma salida terminal que
acabás de tocar: `update_order_status()` guarda el estado previo como
`current_status`, pero al cancelar o rechazar evalúa `old_status`, que no existe.
La suite 84/84 no lo ve porque el caso 83 usa `POST /cancel`, no
`PATCH /orders/{id}/status`. Corregí la referencia y agregá una regresión que
atraviese esta segunda ruta hasta un estado terminal y que quede roja contra
`fe4a0b2`; debe probar respuesta no-500, estado persistido, intención local
anulada y la restauración de stock que corresponda al estado anterior. No
amplíes alcance ni abras MP-C.

Después corré una sola vez la suite completa y las puertas proporcionales.
Entregá producto e informe separados. Esfuerzo **Extra**. MP-B se acepta apenas
este borde quede cerrado.

## Tarea activa — MP-C: verdad del pago, estados y stock

MP-B queda aceptada en `abebedb` con informe `c406a4b`. El arreglo de
`current_status` y el caso 85 cierran el último borde; no lo vuelvas a trabajar.

Esta pieza completa el núcleo seguro de Checkout Pro **contra el doble local**.
La bandera productiva continúa apagada. No uses credenciales reales, no toques
Railway, no agregues suscripciones, comisión, cuotas propias, conciliación
contable, reembolsos manuales ni rediseño visual. Esfuerzo **Extra**.

### 1. La única verdad es Mercado Pago

Montá el tópico `payment` como Webhook, no IPN. La URL de preferencia no debe
degradar la notificación firmada: usá la forma oficial que conserva Webhooks.
Validá antes de procesar `x-signature`, `x-request-id` y `data.id` con HMAC
SHA-256, comparación constante, secreto obligatorio fuera del repo y tolerancia
temporal explícita. Firma ausente, mal formada, vencida o incorrecta no toca la
base ni consulta cuentas ajenas.

El cuerpo sólo enruta. Después de autenticar, consultá `/v1/payments/{id}` con
el token OAuth descifrado del vendedor y tomá de esa respuesta el estado real.
Antes de asociarlo verificá como mínimo: vendedor/cobrador vinculado,
`external_reference`, preferencia, orden, moneda e importe `Decimal` exacto.
Un ID de otro vendedor, monto o moneda alterados y referencias cruzadas no
mueven nada. Token revocado o MP transitorio dejan respuesta reintentable, no
un falso rechazo ni un 200 que pierda el evento.

La vuelta `success`, `pending` o `failure` del navegador sólo informa que se
está verificando y refresca el estado local. Ningún query param marca pagado.

Documentación oficial contrastada por PM el 13/08:

- https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/payment-notifications
- https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/configure-back-urls

### 2. Máquina idempotente y eventos fuera de orden

Persistí sólo los identificadores y campos operativos necesarios, nunca el
cuerpo crudo ni tokens. Una preferencia puede producir más de un intento: un
rechazo inicial no puede tapar una aprobación posterior, y una notificación
vieja no puede hacer retroceder un pago aprobado. Duplicar o paralelizar el
mismo evento produce exactamente una transición y un efecto de stock.

Como mínimo distinguí `pending`, `in_process`, `approved`, `rejected`,
`cancelled/expired`, `refunded` y `charged_back` si la API de pagos los devuelve.
No inventes equivalencias destructivas: pendiente/en proceso conserva la orden
pagable; aprobado deja pago `APPROVED` y orden `PAID`; rechazo de un intento no
cancela una preferencia todavía reutilizable. Para devolución o contracargo,
dejá un estado local explícito y accionable, sin ejecutar un reembolso nuevo.

Bloqueá las filas necesarias para que webhook, cancelación, vencimiento y
reintento no compitan. El vendedor no puede confirmar ni enviar manualmente una
orden MP no pagada; transferencia conserva sus transiciones aceptadas.

### 3. Reserva y vencimiento sin sobreventa

Al confirmar un grupo MP, reservá sus cantidades de forma atómica en la misma
transacción local que crea la orden. Dos compradores por la última unidad dan
una sola reserva; el otro recibe 4xx claro antes de cualquier preferencia. La
reserva reduce disponibilidad pero no aumenta `sales_count`. La aprobación la
consolida una sola vez; cancelar, expirar o terminar sin cobro la libera una
sola vez. Servicios no reservan unidades.

La preferencia lleva vigencia oficial (`expires`, inicio y fin) igual al plazo
local. Definí un plazo razonable y configurable para los medios contractuales
—crédito, débito y dinero en cuenta—, sin habilitar efectivo/ticket que exija
esperas incompatibles. Una reserva vencida **no se libera sólo por el reloj**:
el reconciliador consulta primero a MP con el vendedor correcto. Si hay pago
aprobado, lo procesa; si no lo hay y la preferencia terminó, cierra y libera.
Debe existir una entrada idempotente ejecutable para reconciliar vencidas; en
esta pieza se prueba contra el doble, pero todavía no se programa en Railway.

Si la API oficial no permite cerrar de forma segura el link ya emitido o aparece
una carrera en la que se puede cobrar después de liberar stock, frená y
documentá el caso con evidencia. No lo tapes con un reembolso automático ni
habilites la bandera.

### 4. Evidencia adversarial

Extendé el doble para firmar Webhooks y devolver pagos consultables. Las nuevas
regresiones deben ponerse rojas contra MP-B y cubrir, sin cantidades fijas del
seed:

1. firma válida; firma ausente, alterada, vencida y `data.id` cambiado;
2. evento válido pero pago de otro vendedor, referencia/preferencia cruzada,
   importe o moneda distintos;
3. retorno del navegador falso no cambia nada; sólo webhook + consulta aprobada
   marca `PAID`;
4. duplicado, paralelo y fuera de orden: un único pago/efecto; rechazo seguido
   de aprobación funciona y aprobación seguida de rechazo no retrocede;
5. dos compradores por la última unidad: una reserva/orden MP y cero
   preferencias para el perdedor; ventas no suben antes de aprobar;
6. aprobación consolida una vez; cancelación o vencimiento conciliado libera
   una vez; repetir cualquiera no altera stock;
7. token revocado y MP caído devuelven condición reintentable, mantienen el
   estado anterior y luego convergen al reintentar;
8. comprador, vendedor y recarga ven pendiente, aprobado o problema de forma
   coherente; nunca un éxito derivado de `back_url`.

Con bandera apagada siguen siendo cero las preferencias y cobros reales. Corré
suite completa una vez al final, hito, build, accesibilidad/contraste sólo si
cambia DOM visible, migración ida/vuelta con datos, `alembic check` y
`diff --check`. Entregá commit de producto e informe separado, incluyendo rojo
contra MP-B, tabla de estados, campos persistidos, inventario de efectos y
riesgos que impidan activar producción. Ahí vuelve a PM; no abras despliegue.

### Primera revisión PM de `9fa0eaf`: todavía no aceptada

La arquitectura principal queda conforme: firma HMAC, consulta con token del
cobrador, asociación por orden/importe/moneda, intentos idempotentes, reserva
atómica, retorno no autoritativo, estado visible y bandera apagada. PM obtuvo
build, sintaxis Python y `diff --check` verdes. No reabras esos bloques ni
agregues alcance. La suite 93/93 no fuerza seis bordes bloqueantes:

1. **La primera preferencia fallida deja una reserva inmortal.**
   `crear_ordenes()` confirma orden y reserva; recién después
   `preparar_pago()` crea `Payment.expires_at`. Si MP falla antes de esa fila,
   la orden queda `RESERVADA` sin `Payment`, y `_candidatas()` la excluye por
   su `JOIN payments`: nunca vence ni libera. Persistí la intención y su plazo
   en la misma transacción local que la reserva, antes del efecto externo. Un
   timeout/rechazo permanente seguido de abandono debe entrar al reconciliador,
   terminar sin pago y liberar exactamente una vez.
2. **La URL configurada no fuerza Webhooks como afirma el informe.** La
   documentación oficial vigente dice que, al configurar `notification_url`
   en una preferencia, se agrega `source_news=webhooks` para recibir
   exclusivamente Webhooks. El validador actual prohíbe cualquier query y el
   caso 86 consagra esa regla equivocada. Conservá una base configurable sin
   parámetros y agregá vos únicamente el parámetro oficial al payload; no
   aceptes query arbitraria del entorno. Además autenticá con `data.id` de la
   URL y headers **antes** de parsear el cuerpo: hoy se lee entero y se permite
   usar el ID del cuerpo antes de validar, contra el contrato escrito.
   Fuente: https://www.mercadopago.com.ar/developers/es/docs/checkout-bricks/additional-content/your-integrations/notifications/webhooks
3. **Una orden MP ya pagada todavía se cancela sin reembolso.** En `/cancel`,
   `venia_pagada=True` evita el 409: comprador o vendedor dejan la orden
   terminal y restauran stock aunque el dinero siga con el vendedor. Una orden
   MP con cobro acreditado no se cancela por estas rutas; queda `PAID` y el
   inventario no se mueve. Probá ambos roles después del webhook aprobado, no
   sólo el pago que aparece durante la cancelación.
4. **El vendedor puede quitar stock ya reservado.** `PATCH /products/{id}`
   acepta bajar `stock` por debajo de `stock_reservado` —incluso mientras otra
   transacción reserva—; después `consolidar()` recorta a cero con `greatest` y
   oculta la falta. Serializá edición y reserva sobre la fila de producto y
   rechazá todo stock explícito inferior a lo reservado. Probá edición normal,
   edición inválida y carrera contra la última unidad.
5. **La preferencia queda viva después del primer cobro.** Checkout Pro puede
   entregar varios intentos por la misma preferencia; hoy una primera
   aprobación no la vence y dos IDs aprobados se resumen como un solo éxito.
   Cerrá el link al primer aprobado. Si aparece más de una aprobación, no
   consolides stock dos veces ni reembolses: dejá un estado operativo visible
   que exija revisión y conserve todos los IDs. Probá dos pagos aprobados
   distintos y la falla transitoria al cerrar el link.
6. **El reconciliador pierde el candado antes de decidir.** `_una()` bloquea la
   orden, pero `cobro.sincronizar()` hace `commit`; luego `_una()` revisa y
   cierra/libera sin haber recuperado el bloqueo. Forzá un webhook aprobado
   entre la búsqueda vacía y el cierre: nunca debe quedar cobro con reserva
   liberada ni estado terminal falso. Mantené o recuperá el bloqueo en la
   sección local que decide y hacé el commit en un solo dueño transaccional.

Agregá una regresión discriminante por punto, roja contra `9fa0eaf`; las de
concurrencia deben retener exactamente el intercalado peligroso, no confiar en
dos llamadas que quizá se serialicen solas. Conservá los casos 86–93. Corré al
final suite completa, hito, build, migración ida/vuelta con datos,
`alembic check` y `diff --check`; accesibilidad/contraste sólo si cambia DOM.
Entregá producto e informe separados. Esfuerzo **Extra**. La bandera, Railway
y credenciales reales siguen fuera de alcance.

## 2026-08-14 — MP-C aceptada; siguiente portón MP-D

MP-C queda aceptada con `b47ae14`, `39c3907` y `98ca684`; informe final
`0f9646b`. Los seis bordes de la revisión quedan cerrados. También quedan
aceptadas las dos correcciones que encontraste al revisar tu propia entrega:
dos cobros no dejan de ser dos porque uno se devuelva, y el diff de
`UserDashboard.tsx` vuelve a mostrar sólo las siete líneas reales.

PM verificó el código de las seis correcciones y sus regresiones, build,
sintaxis Python y `diff --check`. No repitió la suite porque Docker local sigue
apagado; 99/99, hito 6/6, migración y puertas visuales continúan como evidencia
tuya. Buena objeción sobre el intercalado del caso 99: la prueba final retiene
la búsqueda que decide, demuestra el `FOR UPDATE` y no fabrica un falso verde.

### Tarea activa única — MP-D: preparar la homologación real sin encenderla

No agregues funciones de producto ni rediseño. No uses una cuenta, comprador,
tarjeta ni dinero reales. No toques Railway todavía y no cambies
`MP_CHECKOUT_HABILITADO=false`. Esfuerzo **Extra**.

Hacé primero una pasada adversarial corta contra la documentación oficial
vigente de Mercado Pago y el código aceptado, limitada a los contratos que el
doble no puede probar: OAuth de cuenta de prueba, forma real de la preferencia,
campos reales de `/v1/payments`, firma del Webhook, cierre de preferencia y
estados/tipos contractuales. No reescribas lo que ya está probado si coincide.

Después dejá lista, pero sin ejecutarla, una homologación reproducible sobre el
Railway descartable:

1. checklist exacto de cuentas de prueba, aplicación y secretos que Emi debe
   crear o autorizar, sin pedir ni guardar contraseñas ni tokens en el repo;
2. variables mínimas y URLs exactas de OAuth, retorno y notificación, siempre
   con secretos fuera de Git y bandera todavía apagada;
3. comando único del reconciliador, frecuencia propuesta y prueba de que dos
   ejecuciones solapadas no duplican efectos; no agregues una cola ni un
   framework si la entrada idempotente actual alcanza;
4. guion de punta a punta con vendedor y comprador de prueba: vincular,
   preferencia, pago aprobado/rechazado, Webhook firmado, estado visible,
   stock, cancelación segura y reconciliación de aviso perdido;
5. criterio de rollback: qué se apaga, qué avisos se siguen aceptando y cómo se
   preservan cobros ya ocurridos.

Implementá sólo un hueco de código o configuración si la documentación oficial
o una prueba local demuestra que existe. Toda afirmación sobre la API real
debe llevar fuente oficial y fecha. Si la homologación necesita una acción
humana o credencial de Emi, frená exactamente ahí y entregá un informe breve
con lo que falta; no lo sustituyas por credenciales inventadas ni abras alcance.

Entregá cualquier corrección de producto en commit separado y el informe en
`PARA-PM.md`. Si no hace falta código, entregá sólo el informe. Ahí vuelve a
PM; desplegar al Railway descartable y mover dinero de prueba requieren una
orden posterior explícita.

### Primera revisión PM de MP-D `86d755b`: preparación buena, corrección corta

El freno fue correcto: no correspondía sortear la política de red ni citar de
memoria. El runbook es útil, el alcance se respetó y el caso 100 prueba dos
procesos realmente solapados con efectos atribuibles. PM revisó el diff y
`diff --check`; Docker local sigue apagado, por lo que 100/100 continúa como
evidencia informada por vos.

PM sí pudo abrir la documentación oficial vigente el 14/08. No ejecutes la
homologación ni agregues infraestructura: corregí sólo el documento, el
comentario técnico falso y, si hace falta, aserciones documentales de la suite.

1. **Webhooks en el panel no es opcional.** Para Checkout Pro se configura la
   URL de prueba, se selecciona el evento **Pagos** y se guarda; recién ahí se
   genera el secreto de firma. La `notification_url` de cada preferencia tiene
   prioridad y `source_news=webhooks` sigue siendo la forma oficial de pedir
   Webhooks en vez de IPN. Convertí el `[VERIFICAR]` del runbook en paso
   obligatorio y explicá que panel y payload cumplen funciones distintas.
   Fuentes:
   https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/payment-notifications
   y
   https://www.mercadopago.com.ar/developers/es/docs/checkout-bricks/additional-content/your-integrations/notifications/webhooks
2. **Marketplace distingue tres perfiles de prueba:** integrador, vendedor y
   comprador. El checklist actual nombra la cuenta real de TopGreen, vendedor y
   comprador, pero no resuelve el perfil integrador. Decí explícitamente qué
   cuenta es dueña de la aplicación y cuál actúa como integradora en la prueba;
   si el panel real es quien lo determina, dejá esa única comprobación humana
   cerrada y no inventes una cuarta cuenta. Fuentes:
   https://www.mercadopago.com.ar/developers/es/docs/your-integrations/test/accounts
   y
   https://www.mercadopago.com.ar/developers/es/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace
3. **Firma confirmada.** El manifiesto, omisión de campos ausentes y minúscula
   alfanumérica coinciden. La página llama milisegundos al `ts` pero muestra un
   ejemplo de diez dígitos; el código ya tolera segundos y milisegundos sin
   cambiar el valor firmado. Registrá esa inconsistencia oficial, no abras un
   cambio funcional.
4. **Respuesta de pago confirmada parcialmente.** La referencia oficial de
   `GET /v1/payments/{id}` documenta `collector_id` arriba, metadata,
   `external_reference`, moneda e importe; no documenta `preference_id`. La
   política actual —compararlo sólo si viene y atar fuerte por metadata— queda
   correcta y debe decirse así.
   Fuente:
   https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-pro/get-payment/get
5. **Cierre de preferencia compatible, todavía sujeto a prueba real.** La API
   oficial de actualización acepta `expires`, `expiration_date_from` y
   `expiration_date_to`; la homologación debe confirmar que una fecha pasada
   deja inutilizable el link y qué devuelve al repetir. No confundas esto con
   `date_of_expiration`, que la guía usa para pagos offline.
   Fuente:
   https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-pro/preferences/update-preference/put
6. **Medios.** `excluded_payment_types: ticket` está documentado. No presentes
   `atm` como universal hasta observarlo en `GET /v1/payment_methods` con el
   token argentino de prueba; dejalo como dato a confirmar en la ejecución, no
   como bloqueo de preparación.
   Fuente:
   https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-settings/payment-methods

Además corregí conceptualmente un resto de MP-C: el comentario previo a
`MP_NOTIFICACION_URL` en `backend/app/core/config.py` todavía afirma que toda
query degrada a IPN, mientras el validador y el payload ya implementan el
parámetro oficial. Cambiá sólo ese comentario; no cambies la validación.

En el guion de aviso perdido, reemplazá «apuntar a otro lado» por un fallo
controlado y reversible de la URL de prueba —sin dominio ajeno y con una sola
orden en vuelo—, seguido de restauración y reconciliación. Conservá la bandera
apagada y no toques Railway.

Entregá corrección documental/informe separados. No repitas suite completa:
una comprobación focal de lo que toques y `diff --check` alcanzan. Esfuerzo
**Alto** para esta corrección corta; Extra ya no aporta.

## 2026-08-14 — Preparación MP-D aceptada; pausa en la puerta humana

Aceptados el runbook `86d755b`, el caso 100, la corrección `13434a4` y el
informe `76611d0`. La devolución quedó resuelta sin ampliar alcance: panel y
payload diferenciados, tres perfiles, contratos oficiales incorporados,
comentario falso corregido sin tocar el validador y aviso perdido limitado al
dominio propio. PM verificó el diff y `diff --check`; el caso 95 focal informado
es proporcional al cambio.

No abras otra pieza ni toques Railway. No hay tarea activa para Dev hasta que
Emi complete las acciones humanas del runbook y autorice explícitamente la
ejecución de la homologación. La bandera permanece apagada, el Webhook sigue
sin credenciales y no se usa dinero real.

## 2026-08-14 — Homologación externa todavía bloqueada; sin tarea de código

PM ejecutó dos intentos controlados en Railway. El segundo llegó al pago con
comprador de prueba, pero Mercado Pago lo frenó correctamente porque el
vendedor demo estaba vinculado por error a la cuenta real de Emi. No hubo pago
ni Webhook; la orden se canceló, el stock se liberó una vez, el link quedó
cerrado y `MP_CHECKOUT_HABILITADO=false` volvió a quedar efectivo. La cuenta
real fue desvinculada del vendedor demo.

No corrijas producto ni cambies el runbook: éste ya exigía vendedor y comprador
de prueba. La próxima acción es humana de PM/Emi: acceder al panel integrador,
usar la cuenta **vendedora** de prueba ya creada, autorizarla por OAuth y recién
entonces repetir el guion. Dev sigue sin tarea activa hasta una devolución que
demuestre un defecto de código.

## 2026-08-14 — Vendedor de prueba correcto; falta aislar la sesión compradora

PM vinculó correctamente el vendedor demo a la cuenta vendedora de prueba y
abrió una preferencia real con una compradora de prueba. Mercado Pago llegó a
la revisión de ARS 18.500, pero devolvió su error genérico al confirmar, primero
con una tarjeta guardada y luego con la Visa de prueba oficial y titular
`APRO`. En ambos intentos quedaron cero pagos, cero Webhooks y cero filas en
`mp_intentos_de_pago`.

La orden `ORD-20260814-630AEE45` se canceló por la ruta normal. PM contrastó en
base: orden y pago cancelados, reserva liberada, link cerrado, stock 240,
reservado 0 y ventas 0. Railway quedó en `SUCCESS`, health verde y
`MP_CHECKOUT_HABILITADO=false` efectivo.

**No hay tarea activa de Dev.** La documentación oficial de Checkout Pro pide
hacer la compra de prueba en incógnito para evitar duplicidad de credenciales;
este ensayo cambió vendedor y comprador dentro del mismo perfil. PM/Emi debe
repetir una sola aprobación con sesiones aisladas. Sólo vuelve a Dev si ese
ensayo falla y aporta evidencia de una solicitud propia o un pago consultable.

## Tarea activa única — Documentación de vendedores revisada

Emi aprobó esta pieza como cortesía sin costo para la primera clienta. Es
independiente de la homologación externa de Mercado Pago: no investigues MP-D,
no toques Railway ni cambies ninguna bandera. Esfuerzo **Alto**, no Extra.

### Resultado de producto

Una persona que quiera vender puede presentar CUIT, razón social y una única
constancia fiscal PDF. La clienta la revisa desde administración y decide
pendiente, aprobada o rechazada. Una aprobación muestra el distintivo exacto
**«Documentación revisada»** donde se identifica públicamente al vendedor. No
uses «Vendedor verificado» ni texto que garantice identidad, solvencia o
ausencia de fraude.

La revisión es informativa y **no bloquea** registro, publicaciones, catálogo,
checkout, transferencias ni Mercado Pago. No conviertas esta cortesía en KYC.

### Alcance cerrado

- Datos: CUIT argentino con validación formal, razón social y un PDF vigente
  presentado por el propio usuario. Conservá sólo el archivo actual; al
  reemplazarlo, el anterior deja de ser accesible y se elimina del almacenamiento.
- Estados: sin presentación, pendiente, aprobada y rechazada. Presentar o
  reemplazar documentación siempre vuelve a pendiente y retira el distintivo.
- El usuario ve su estado y, ante rechazo, un motivo breve y accionable. No ve
  identidad interna del administrador.
- Administración tiene una cola filtrable, abre el PDF privado y aprueba o
  rechaza. Rechazar exige motivo; cada decisión registra administrador, fecha y
  transición en la auditoría existente.
- El PDF sólo puede verlo su titular y un administrador. Nunca queda en URL
  pública, respuesta de catálogo, logs ni nombre de archivo predecible. Aplicá
  límite razonable de tamaño y comprobá extensión, tipo declarado y firma PDF;
  un archivo disfrazado debe fallar antes de persistirse.
- El distintivo público deriva del estado aprobado actual. Mostralo en el bloque
  de vendedor que ya existe en el detalle de publicación y en cualquier otro
  componente de identidad que ya reutilice ese mismo dato, sin crear una ruta o
  perfil público nuevo. No expongas CUIT, razón social, PDF, motivo ni datos de
  revisión.

### Fuera de alcance y condición de freno

Sin RENAPER, ARCA, DNI, selfie, biometría, OCR, consulta fiscal automática,
alertas de vencimiento, monitoreo periódico, puntuación de riesgo, bloqueo de
cuentas ni garantía antifraude. Sin dependencia nueva salvo que la validación
segura del PDF sea imposible con lo que ya existe; si ocurre, frená y proponé
una sola opción con su motivo antes de instalarla. No rediseñes administración.

Si el modelo actual de usuarios impide ofrecerlo sin inventar un rol vendedor,
no agregues un rol: proponé el criterio mínimo que reutilice publicaciones o el
panel existente y esperá decisión de PM.

### Evidencia adversarial y aceptación

1. Usuario A no puede presentar, leer ni reemplazar documentación de B; un no
   administrador no puede listar pendientes ni decidir estados.
2. CUIT inválido, PDF sobredimensionado, tipo incorrecto y archivo renombrado a
   `.pdf` fallan sin fila ni archivo huérfano.
3. Presentación válida queda pendiente y sin distintivo; aprobación admin crea
   una sola transición auditada y muestra «Documentación revisada» únicamente
   para ese vendedor.
4. Rechazo exige motivo, lo muestra al titular y nunca muestra distintivo;
   volver a presentar retira el rechazo y queda pendiente.
5. Reemplazar una presentación aprobada quita el distintivo, conserva sólo el
   archivo nuevo y no deja una URL anterior utilizable.
6. Dos decisiones administrativas concurrentes no producen un estado sin
   autor, una auditoría falsa ni dos efectos contradictorios aceptados.
7. Publicar y comprar siguen funcionando en los cuatro estados; esta pieza no
   altera pagos, stock ni la elegibilidad actual para vender.

La regresión debe demostrar al menos permisos, archivo disfrazado, ciclo
aprobación→reemplazo y decisión concurrente contra la versión anterior. Corré
suite completa desde base limpia, puerta del hito, migración ida/vuelta con
datos, `alembic check`, build y `diff --check`. Como cambia interfaz visible,
corré accesibilidad y contraste en las vistas nuevas o modificadas, en ambas
medidas. Entregá commit de producto y luego informe separado en `PARA-PM.md`,
con inventario de datos guardados, permisos, archivos eliminados y pruebas.
Ahí volvés a PM; no abras otra mejora.

## 2026-08-15 — Primera revisión PM de `b8fee0e`: base conforme, dos cierres

La pieza no queda aceptada todavía. Se conservan el modelo informativo, los
permisos, el almacenamiento privado, la interfaz, el distintivo exacto y los
casos 101–108. PM obtuvo build, sintaxis de Python y guiones y `diff --check`
verdes; Docker continúa apagado, por lo que 108/108 y las demás puertas siguen
siendo evidencia informada por vos.

Corregí únicamente estos dos bordes:

1. **Una decisión puede aprobar un archivo que el administrador nunca vio.**
   La fila y su `id` sobreviven al reemplazo. Si administración abre la cola o
   el PDF A, el titular lo reemplaza por B y luego se aprueba usando el mismo
   `documentacion_id`, la ruta actual aprueba B aunque la persona revisó A.
   La decisión debe llevar un discriminante de la presentación que se mostró
   —el `presentado_el` que ya devuelve la cola alcanza si se compara de forma
   exacta— y responder 409 si la presentación cambió. La aprobación vigente no
   debe cambiar, no debe auditarse una revisión y el distintivo debe seguir
   apagado hasta recargar la cola y revisar la presentación actual. No expongas
   `archivo_ruta` ni agregues historial de PDFs.
2. **La privacidad depende hoy de escribir bien una variable.**
   Los ejemplos separan `DOCUMENTOS_DIR` de `UPLOAD_DIR`, pero la configuración
   acepta que sean iguales o que documentos quede dentro del árbol servido en
   `/uploads`. En ese caso una constancia pasa a ser pública sin que el código
   falle. Hacé que la aplicación rechace al arrancar, con mensaje accionable,
   todo `DOCUMENTOS_DIR` que resuelto sea igual a `UPLOAD_DIR` o descendiente
   suyo. Conservá los valores actuales de desarrollo y producción.

Agregá una regresión discriminante por punto, roja contra `b8fee0e`: decisión
con versión vieja después de un reemplazo, y arranque/configuración con carpeta
privada dentro de uploads. Después dejá verdes los casos 101–108 y las nuevas.
Corré suite completa, build, migración ida/vuelta con datos, `alembic check` y
`diff --check`; accesibilidad y contraste no hace falta repetirlos si el DOM no
cambia. Entregá producto e informe separados. Esfuerzo **Alto**; no abras otra
función, MP-D ni Railway.

## 2026-08-15 — Documentación de vendedores aceptada

Aceptados el producto base `b8fee0e`, el cierre `9988879` y el informe final
`bbb0d2d`. La decisión identifica obligatoriamente la presentación que la cola
mostró y una versión vieja recibe 409 sin estado, auditoría ni distintivo. La
configuración rechaza al arrancar una carpeta documental igual o descendiente
del árbol público de uploads.

PM verificó el diff, la comparación bajo candado, el rechazo real de una ruta
peligrosa, la carga de una ruta segura, build, sintaxis y `diff --check`.
Docker local sigue apagado, por lo que 110/110, migración ida/vuelta y
`alembic check` son evidencia informada por vos, no repetida por PM. Los casos
109 y 110 son discriminantes y el DOM no cambió, así que no se repiten las
puertas visuales.

La cortesía queda cerrada. **No hay tarea activa para Dev antes de la firma.**
No abras otra función, MP-D ni Railway. Volvés sólo ante una orden nueva de PM
o si el ensayo externo aislado de Mercado Pago demuestra un defecto propio.

## Tarea activa única — Simulación UX de logística en dos recorridos

Emi autoriza esta excepción antes de la firma porque logística es un recorrido
crítico. No es una función productiva ni reabre backend: prepará un prototipo
aislado, navegable y descartable para revisar el producto antes de tocar la
aplicación. Esfuerzo **Alto**, no Extra.

### Límite de producto que el prototipo debe decir con claridad

El MVP vigente es un **directorio geográfico**: el transportista declara su
capacidad y cobertura; en una compra se listan opciones compatibles; el
comprador selecciona una y recién entonces obtiene el contacto. TopGreen no
cotiza ni cobra el flete, no reserva disponibilidad y no administra estados de
un servicio logístico. La coordinación económica ocurre entre las partes.

Por eso el segundo recorrido termina en **seleccionar y contactar**, no en un
pago ficticio ni en «servicio contratado». Si el prototipo demuestra que Emi
necesita cotización, aceptación, pago o seguimiento dentro de TopGreen, se
documenta como decisión de alcance posterior y no se implementa acá.

### Entregable aislado

Creá una revisión navegable fuera del árbol productivo, por ejemplo
`prototypes/logistica-dos-recorridos.html`, sin dependencias nuevas y sin tocar
`src/`, backend, migraciones, seed, Railway, Mercado Pago ni las puertas
existentes. Debe poder abrirse con un servidor estático y usar la identidad
visual y el lenguaje actual de TopGreen; no una landing genérica.

Debe ofrecer desde el inicio dos caminos independientes, con Atrás, Siguiente,
reinicio y cambio de recorrido:

1. **Ofrecer logística / alta del transportista**
   - elegir registrarse como transportista;
   - localidad base;
   - vehículo: tipo, marca/modelo y dominio;
   - capacidad de carga;
   - cargas o usos permitidos;
   - declaración y detalle de habilitación, sin afirmar verificación de
     TopGreen;
   - radio de cobertura;
   - resumen final de lo que verá el comprador.
2. **Necesito logística / recorrido comprador**
   - compra y origen del producto;
   - destino de entrega;
   - decisión explícita entre traslado propio o «Necesito flete»;
   - lista de transportistas compatibles con ambas puntas;
   - comparación de vehículo, capacidad, usos permitidos, cobertura y
     declaración de habilitación, sin exponer contacto todavía;
   - selección de una opción;
   - contacto visible después de seleccionar;
   - confirmación de la compra del producto y aviso claro de que precio y
     coordinación del flete se acuerdan directamente.

### Actual versus propuesta

El prototipo puede probar campos nuevos, pero debe distinguirlos visualmente y
en una nota final:

- **ya existe:** localidad, descripción libre del transporte, capacidad libre,
  declaración/detalle de habilitación, radio, compatibilidad geográfica,
  selección y contacto posterior;
- **propuesta para validar:** marca/modelo, dominio separado y categorías de
  cargas permitidas.

No presentes esos tres campos como terminados ni modifiques el esquema para
soportarlos.

### Criterios de aceptación

1. Ambos recorridos se completan por separado y pueden reiniciarse sin recargar.
2. Cada paso muestra contexto suficiente para entender qué se decide y por qué.
3. La opción propia no obliga a elegir transportista; la opción con flete no
   avanza sin una selección compatible.
4. Ningún texto promete precio, pago, reserva, verificación oficial o
   contratación dentro de TopGreen.
5. La revisión funciona a 1440×900 y 390×844 sin corte horizontal, conserva
   foco visible y no arroja errores de consola.
6. Entregá un commit del prototipo y otro con informe en `PARA-PM.md`: enlace
   local exacto, mapa de pantallas, campos actuales/propuestos y decisiones que
   Emi tiene que tomar. No corras la suite de producto: no debe haber producto
   modificado.

Ahí volvés a PM. No conviertas ninguna conclusión del prototipo en código real
sin una aprobación nueva.

## 2026-08-15 — Primera revisión PM de `8002fea`: prototipo conforme, recorrido de alta bloqueado

La entrega todavía no queda aceptada. El recorrido comprador sí fue reproducido
completo: cambia de cuatro a cinco pasos al pedir flete, no avanza sin elegir,
mantiene oculto el contacto hasta la selección y cierra sin prometer cotización,
pago, reserva ni seguimiento. El alcance aislado y la separación entre campos
actuales y propuestos también quedan conformes.

Hay un defecto bloqueante y discriminante en el alta. En **Capacidad de carga**,
escribí `Hasta 30 toneladas` y hacé clic inmediatamente en **Siguiente**: el
valor se borra, aparece «Escribí tu capacidad de carga» y el recorrido queda en
el paso 4. PM lo reprodujo con escritura normal, con `fill` y también saliendo
del campo con Tab. Por lo tanto contradice la comprobación informada y también
la corrección de clic perdido descripta en `PARA-PM.md`.

La causa está acotada: los campos de texto ordinarios guardan en `datos` sólo
por `change`; el manejador `input` sincroniza únicamente el campo que lleva
`data-pista`. Cuando la validación redibuja desde el estado todavía viejo,
vacía el DOM. Corregí sólo la sincronización inmediata de estado para todos los
textos, números y textarea, sin volver a redibujar en cada tecla. Conservá el
tratamiento actual de radios, checks y selects.

### Criterios de cierre

1. Marca/modelo, dominio, capacidad, detalle de habilitación y radio conservan
   lo escrito aunque se pulse **Siguiente** sin desenfocar antes.
2. El primer clic avanza cuando el campo obligatorio es válido y el resumen
   final conserva exactamente esos valores.
3. Ambos recorridos siguen completos; «por mi cuenta», selección/contacto y los
   límites de producto no cambian.
4. Repetí la acción exacta en 1440×900 y 390×844 y comprobá consola y corte
   horizontal. No hace falta correr la suite de producto.
5. Un commit mínimo del prototipo y otro del informe corregido. No toques
   `src/`, backend, dependencias ni conviertas propuestas en producto.

Ahí volvés a PM. No abras otra pieza.

## 2026-08-15 — Prototipo logístico aceptado

Aceptados el prototipo base `8002fea`, la corrección `c26495d` y el informe
final `ee2fefb`. La sincronización inmediata conserva textos, números y textarea
sin redibujar por tecla; radios, checks y selects continúan por `change`.

PM reprodujo el caso exacto en escritorio y 390×844: escribió capacidad y
pulsó **Siguiente** sin desenfocar; el primer clic avanzó al paso 5 y el valor no
se borró. También completó el alta y confirmó en el resumen marca/modelo,
dominio, capacidad, carga, habilitación y radio. En móvil no hubo corte
horizontal y la consola quedó sin errores.

Los dos recorridos aislados quedan cerrados. **No hay tarea activa para Dev.**
No conviertas los tres campos propuestos en producto hasta que Emi y PM decidan
si entran, si las cargas sólo se muestran o también filtran, y si la ficha
alcanza para comparar. El límite del MVP sigue siendo selección y contacto, sin
cotización, reserva, cobro ni seguimiento del flete.

## 2026-08-22 — Tarea activa única: datos logísticos validados en producto

La firma quedó confirmada. Implementá el primer bloque postfirma: llevar al
producto real los tres datos opcionales ya aprobados en la decisión del
2026-08-15 y probados en `prototypes/logistica-dos-recorridos.html`.

Antes de editar, leé esa decisión y recorré el flujo actual completo en
`backend/app/models/user.py`, esquemas y rutas de autenticación/logística,
servicio de coincidencia, alta/edición de perfil, checkout y casos de logística
del smoke. Elegí vos el esquema mínimo; no dupliques campos existentes.

### Resultado y alcance

- **Marca/modelo:** dato opcional, editable y visible para comparar antes de
  seleccionar transportista.
- **Dominio:** dato opcional y privado. No puede aparecer en el directorio,
  respuesta de candidatos, catálogo, logs ni otro recurso público; se revela
  junto con el contacto únicamente después de una selección válida por el flujo
  autorizado existente.
- **Cargas permitidas:** selección múltiple opcional, con «Otra» y detalle libre.
  Se muestra como declaración del transportista, pero no filtra, ordena ni
  excluye candidatos.
- Alta, edición y transportista demo deben soportar los tres datos. Perfiles
  existentes y campos vacíos siguen funcionando sin completar nada.
- Migración reversible y segura para datos existentes. No sobrescribas valores
  personalizados al repetir el seed.

### Fuera de alcance

Sin cotización, reserva, disponibilidad, pago, seguimiento, compatibilidad
automática por carga, validación del dominio, ARCA/RENAPER, rol nuevo ni rediseño
general. No toques Mercado Pago, Railway, documentación de vendedores ni
banderas productivas.

### Criterios de aceptación

1. Alta y edición conservan exactamente los tres datos; vacíos siguen válidos y
   otro usuario no puede modificarlos.
2. Antes de seleccionar, API y DOM muestran marca/modelo y cargas declaradas,
   pero nunca dominio ni contacto. Después de una selección válida, la respuesta
   existente revela dominio y contacto; quitar o cambiar selección no conserva
   datos privados viejos.
3. Con los mismos transportistas, agregar, quitar o cambiar cargas declaradas no
   modifica el conjunto ni el orden de candidatos compatibles. La coincidencia
   sigue dependiendo sólo de las reglas geográficas vigentes.
4. «Otra» conserva su detalle; duplicados, espacios y valores inválidos quedan
   normalizados o rechazados de forma consistente, con límites explícitos.
5. Migración ida/vuelta con datos existentes, seed repetido y regresiones de
   privacidad, permisos y ausencia de filtro pasan. Las regresiones deben fallar
   contra el commit anterior por la propiedad que prueban.
6. Corré suite completa desde base limpia, puerta del hito, `alembic check`,
   build y `diff --check`. Como cambia interfaz, corré accesibilidad y contraste
   en alta, perfil y selección, en escritorio y 390×844.

Entregá un commit de producto y luego informe separado en `PARA-PM.md` con
migración, superficies donde aparece cada dato, evidencia y riesgos. Si el flujo
actual no permite mantener el dominio fuera de la respuesta preselección, frená
y proponé una sola corrección mínima antes de continuar. No abras otra mejora.

## 2026-08-22 — Primera revisión de `0395d67`: base conforme, cierre devuelto

La arquitectura y el alcance quedan bien encaminados: el dominio está ausente
del contrato y la consulta de candidatos, marca/modelo y cargas se comparan, y
las cargas no entran en la regla geográfica. PM obtuvo build, sintaxis Python y
`diff --check` verdes. Docker local continúa apagado, por lo que 114/114 y las
puertas visuales siguen siendo evidencia informada por vos.

La entrega **todavía no queda aceptada** por una inconsistencia discriminante en
el normalizador compartido. Hoy:

```python
normalizar(None, "Bidones sueltos") == (None, "Bidones sueltos")
```

Eso permite guardar `carrier_cargo_other` sin haber declarado `otra`; el texto
queda huérfano e invisible. Contradice la regla del propio servicio y el criterio
de normalización consistente. La prueba actual cubre quitar `otra`, pero no
cubre enviar el detalle solo desde un alta o una edición sin cargas.

### Corrección mínima

- Corregí la raíz únicamente en `app.services.cargas.normalizar`: si el estado
  prospectivo no contiene `otra`, el detalle no puede sobrevivir. Elegí limpiar
  o rechazar, pero mantené la misma política en alta y edición y explicala.
- Agregá una regresión que atraviese API y SQL para detalle sin `otra`; debe
  fallar contra `0395d67` por conservar el valor huérfano.
- Sin migración nueva, rediseño, campos, dependencias ni cambios visuales.
- Corregí en el informe el hash inexistente `3aa6d32`: el commit de producto
  publicado es `0395d67`.
- Corré la regresión, suite completa, sintaxis y `diff --check`. No repitas
  accesibilidad, contraste, hito ni migración: esta corrección no toca esas
  superficies y su evidencia anterior se conserva.

Entregá un commit mínimo y luego el informe corregido. No abras el hotfix de
seguridad ni otra función hasta que PM cierre esta pieza.

## 2026-08-22 — Datos logísticos aceptados

Aceptados producto `0395d67`, corrección `4a57722` e informes `510c39f` y
`580f254`. El detalle de «Otra» queda gobernado por el estado prospectivo y no
por la forma del pedido; alta, edición, actualización legítima y limpieza
convergen en el normalizador compartido. La corrección del ayudante de stock es
válida: usa unidades libres y elimina la dependencia del UUID aleatorio.

PM reprodujo directamente los tres contratos del normalizador, sintaxis Python,
`node --check` y `diff --check`; además conservaba build verde sobre el producto
base. Docker local sigue apagado, así que la ejecución 115/115 permanece como
evidencia informada por vos. La evidencia visual anterior se conserva porque la
corrección no cambió interfaz.

La pieza queda cerrada. No vuelvas a tocar logística salvo una regresión nueva.

## Tarea activa única — hotfix de `python-multipart`

El contraste externo encontró `python-multipart==0.0.6` en
`backend/requirements.txt`. Esa versión está afectada por la vulnerabilidad alta
de ReDoS en el análisis de `Content-Type`, y el producto usa multipart en cargas
de imágenes, comprobantes y documentación. Como el Backend descartable está
expuesto, esta deuda no espera a la auditoría integral de Fase 5.

### Alcance

- Confirmá el aviso oficial y elegí la versión corregida mínima que sea
  compatible con el FastAPI actual. Actualizá sólo los pines estrictamente
  necesarios; sin actualización general de dependencias.
- Instalá desde cero y comprobá que la versión efectiva sea la declarada y que
  no queden dependencias incompatibles.
- Corré los recorridos existentes que atraviesan multipart: imagen de producto,
  comprobante de transferencia y documentación del vendedor. Luego suite
  completa desde base limpia, sintaxis Python y `diff --check`.
- Dejá evidencia del pin anterior/nuevo y de los recorridos cubiertos. No hagas
  una prueba de denegación de servicio contra Railway ni fabriques una carga
  costosa para demostrar el advisory.

### Fuera de alcance

Sin cambios de producto, UI, modelos, migraciones, Railway, Mercado Pago ni
subida general de FastAPI/SQLAlchemy. Tampoco resuelvas todavía localStorage o
CSRF: requieren una decisión de arquitectura separada y serán la siguiente
revisión de seguridad.

Entregá un commit mínimo de dependencia y otro con informe. Esfuerzo **Alto**,
no Extra. Si la versión corregida exige una actualización encadenada o rompe un
flujo multipart existente, frená y traé una sola opción mínima antes de ampliar.

## 2026-08-22 — Hotfix `python-multipart` aceptado

Aceptados dependencia `b496ed4` e informe `0bad6a0`. PM confirmó en el JSON
oficial de PyPI que `0.0.31` no tiene vulnerabilidades registradas y que las
versiones anteriores acumulan los avisos descritos; `0.0.32` sólo incorpora una
mejora posterior de rendimiento, por lo que `0.0.31` cumple la decisión de usar
la mínima corregida. También obtuvo sintaxis Python y `diff --check` verdes.

La Dev informa instalación limpia, `pip check`, los tres recorridos multipart y
suite 115/115. Docker local de PM sigue apagado, así que la suite integral no se
repitió de forma independiente.

El cambio de código queda cerrado, pero **la exposición del Backend descartable
no queda cerrada hasta desplegar `b496ed4` y comprobar la versión efectiva dentro
del contenedor**. Esa acción corresponde ahora a PM/Emi porque Railway quedó
fuera de tu tarea y su auto-deploy de Backend no es confiable.

No hay tarea nueva para Dev hasta ese despliegue. Después se abre por separado
la decisión CSRF/localStorage; no adelantes diseño ni otra función.

## 2026-08-22 — Consulta de arquitectura: CSRF y tokens, sin implementación

El hotfix ya está desplegado: Railway marcó
`c73a0f2b-4a03-423a-a074-99bdf9c6cf77` como `SUCCESS`, el log de build confirma
`python-multipart-0.0.31` y `/api/health` responde 200. Esta consulta abre la
decisión siguiente, pero **todavía no autoriza cambios**.

Auditá el flujo real vigente de autenticación en frontend y Backend: cookies
`HttpOnly`/`Secure`/`SameSite`, tokens devueltos en el cuerpo, `localStorage`,
header `Authorization`, refresh, logout, CORS y todas las rutas que mutan estado,
incluidas las cargas multipart. Buscá riesgo explotable, no cumplimiento
cosmético.

Respondé en `docs/pm/PARA-PM.md`, sin tocar código ni otros documentos:

1. Riesgo real de CSRF y XSS del esquema actual, con archivos y líneas.
2. Una comparación breve entre: mantener Bearer/localStorage, pasar a cookies
   solamente o conservar un híbrido mínimo.
3. Una única recomendación para este MVP. Decí si exige token CSRF, validación
   de `Origin`/`Referer`, cambio de `SameSite` o una combinación y en qué rutas.
4. Cambios exactos por archivo, regresiones necesarias y esfuerzo estimado.
5. Qué dejarías explícitamente fuera por YAGNI.
6. Criterios de aceptación suficientes para que PM pueda verificar la pieza.

Condiciones adversariales: no supongas que CORS detiene formularios simples ni
que `HttpOnly` resuelve CSRF; tampoco propongas una reescritura si una defensa
más pequeña cierra el riesgo. Considerá el entorno actual de Railway y el futuro
dominio productivo, pero no agregues soporte para clientes API externos que no
están en el contrato. No mezcles diseño, pagos, rate limiting ni otras deudas.

Volvé a PM con el informe y frená. PM elige; no implementes todavía.

## 2026-08-22 — Decisión PM sobre `717f40b` y tarea activa única: cerrar CSRF

La auditoría queda **aceptada en el hallazgo**: demostraste un CSRF real sobre
multipart, restauraste el dato y no modificaste producto. También es correcta
la arquitectura base: Bearer para la API protegida y una cookie `Lax` limitada
a reconocer la navegación de vuelta de Mercado Pago. No se agrega token CSRF.

La implementación propuesta necesita dos correcciones obligatorias antes de
codificar:

1. **No saques `credentials: 'include'` del frontend.** Producción llama desde
   `ynerav.up.railway.app` al origen distinto del Backend. Ese modo no sólo
   envía cookies: determina si el navegador respeta `Set-Cookie` en la respuesta.
   Quitarlo de login o refresh impediría guardar/renovar la cookie que luego
   necesita el callback de Mercado Pago; quitarlo de logout impediría confiar
   en su borrado cruzado. Se conserva por funcionalidad, aunque las rutas
   protegidas ignoren la cookie.
2. **`POST /api/auth/refresh` debe quedar header-only.** Su implementación no
   pasa por `get_token_from_cookie_or_header`: llama directamente a
   `credencial_unica(request, "refresh_token", ...)`. Cambiar sólo la dependencia
   de acceso dejaría esta mutación autenticable con cookie y contradiría tu
   propia defensa estructural y el criterio 4 del informe.

### Implementación autorizada

- En `backend/app/api/auth.py`, emitir access y refresh cookies con
  `SameSite=Lax` en login y refresh; al borrarlas conservar atributos
  equivalentes. En el endpoint de refresh, aceptar únicamente el refresh token
  del header `Authorization`; una cookie sola debe dar 401 y no emitir nada.
- En `backend/app/core/dependencies.py`, las rutas protegidas deben obtener el
  access token únicamente del header `Authorization`. Conservá
  `get_current_user_optional` como lector exclusivo de la cookie para el
  callback de Mercado Pago; no amplíes sus usos.
- Conservá `credentials: 'include'`, `tokenStorage` y los headers Bearer actuales
  del frontend. No hace falta modificar frontend salvo que una regresión pruebe
  un defecto concreto.
- Reescribí los casos 49/50 para la regla nueva, sin conservar una prueba de
  conflicto entre dos credenciales cuando una de ellas ya no participa.
- Agregá regresiones para las tres rutas multipart con cookie sola: 401 y cero
  escritura comprobada. Agregá cookie-sola contra refresh: 401 y ninguna cookie
  nueva. Header-solo válido debe seguir funcionando para acceso, refresh y los
  tres uploads.
- Probá que login y refresh siguen almacenando las cookies y que logout las
  elimina en el recorrido cruzado real del frontend; luego comprobá que el
  callback MP con `state` válido reconoce la cookie `Lax` y conserva sus reglas
  de dueño, vencimiento y un solo uso.

### Límites

Sin mover tokens fuera de `localStorage`, revocación, CSP, rate limiting,
validación global de `Origin`/`Referer`, token CSRF, cambios de vida de JWT,
clientes API externos, diseño, pagos ni migraciones. No conviertas la prueba en
un ataque contra Railway; toda reproducción ofensiva queda local y acotada.

### Criterios de aceptación

1. Ninguna cookie de autenticación se emite con `SameSite=None`.
2. Cookie sola nunca autentica una ruta protegida ni `/auth/refresh`; las cuatro
   reproducciones CSRF no escriben y no renuevan sesión.
3. Bearer solo conserva todos los recorridos protegidos y multipart.
4. La cookie `Lax` se guarda/renueva/elimina desde el frontend cruzado y el
   callback MP sigue reconociendo al dueño correcto con `state` válido.
5. Suite completa desde base limpia; regresiones nuevas deben fallar contra
   `717f40b` por la propiedad que prueban. Build y `diff --check` verdes.
6. Un commit de producto y otro de informe en `PARA-PM.md`, con tabla de rutas,
   credencial aceptada y resultado. No despliegues: PM cierra y despliega.

Esfuerzo **Alto**, no Extra. Si conservar `credentials: include` hace fallar una
premisa de tu prueba o el callback necesita otra cookie distinta, frená y traé
evidencia antes de ampliar. No abras otra deuda.

## 2026-08-22 — Primera revisión de `6ece3fb`: seguridad conforme, texto contradictorio

La corrección de arquitectura queda conforme: rutas protegidas y refresh leen
sólo Bearer; la cookie permanece como única identidad ambiental del callback MP;
el frontend conserva `credentials: include`; las cuatro mutaciones con cookie
sola quedan rechazadas. PM confirmó además en la Public Suffix List oficial que
`up.railway.app` es un sufijo público: los dos servicios Railway son sitios
distintos, por lo que la excepción `SameSite=None` está justificada mientras no
haya dominio propio. Build, sintaxis Python, usos de cookies y `diff --check`
quedaron verdes. Docker local continúa apagado; 117/117 sigue siendo evidencia
informada por vos.

La entrega no se cierra todavía porque la propia regresión conserva tres
comentarios que afirman lo contrario de lo que ejecuta y exige:

- `scripts/smoke.mjs:4805`: dice que las cookies emitidas son `Lax`;
- `scripts/smoke.mjs:11229`: dice que al entrar «salen Lax»;
- `scripts/smoke.mjs:11250`: dice que al renovar «siguen Lax».

En los tres casos los asserts correctos exigen `None`. Corregí únicamente esos
comentarios para que expliquen que `None` es necesario en el entorno cruzado y
que la seguridad proviene de no aceptar cookie en mutaciones. No cambies código,
asserts, cookies, casos, frontend ni arquitectura. Ejecutá `node --check` sobre
el guion y `diff --check`; no repitas la suite. Entregá el commit mínimo y una
nota breve en `PARA-PM.md`. Ahí frenás.

## 2026-08-22 — Cierre CSRF aceptado

Aceptados producto `6ece3fb`, corrección documental `0f330a7` e informes
`6264fa2`/`e1185b3`. PM verificó que el último diff sólo cambia comentarios y
reprodujo `node --check` y `diff --check` en verde. También quedan aceptadas la
separación Bearer/cookie y la excepción `SameSite=None` para los dos sitios
Railway bajo el sufijo público `up.railway.app`.

La suite 117/117 queda como evidencia de Dev: Docker local de PM permanece
apagado. No hay tarea nueva para Dev. PM debe desplegar únicamente el Backend,
comprobar `SUCCESS` y `/api/health`, y recién después elegir la pieza siguiente.

### Despliegue cerrado por PM

Backend `ab617231-9b78-46c3-8e0f-205cd6ee9037` quedó `SUCCESS` el 22/08. Railway
ejecutó Alembic sin error, inició la aplicación y el health público respondió
HTTP 200. Se desplegó desde copia aislada sin `watchPatterns`; no se tocó el
frontend ni la bandera de pagos. La pieza CSRF queda cerrada también en el
entorno descartable. Seguís sin tarea activa hasta nueva orden de PM.

## 2026-08-22 — Tarea activa única: UX-1, identidad del marketplace público

Emi aprobó comenzar el trabajo visual junto con PM. Hoy el producto se percibe
como una plantilla: wordmark débil, navegación institucional genérica, emojis
como interfaz y fotos aleatorias de `picsum.photos` —incluidas imágenes ajenas
al agro—. No hagas un rediseño total ni elijas la marca por nosotros. Esta
primera pieza debe dejar una superficie pública fuerte y revisable; después
Emi decide sobre el resto.

### Dirección aprobada

«Campo argentino moderno»: editorial, sobrio y tecnológico. Marfil/canvas,
verde profundo, grafito y un acento cosecha. Referencias funcionales:
`https://www.agrofy.com.ar/` y `https://www.agroads.com.ar/`: tomar su jerarquía
de marca, búsqueda, ubicación, fotografía y publicación; no copiar su saturación
publicitaria, carruseles ni filas de iconitos.

### Alcance de esta pieza

- Sólo la superficie pública: `Header`, shell del marketplace/filtros,
  `ProductGrid`, `ProductCard`, `ProductDetailModal` y `Footer`, con los estados
  de carga, vacío y error que aparecen en ese recorrido.
- Reordená la cabecera alrededor de una marca tipográfica clara, búsqueda y
  acciones reales existentes. No inventes enlaces, secciones ni funciones.
- Eliminá emojis de esa superficie. Para acciones funcionales preferí texto;
  si una señal necesita símbolo, usá un SVG mínimo y coherente con
  `currentColor`, sin instalar una biblioteca de iconos.
- Rehacé la jerarquía de las tarjetas: imagen, categoría/tipo, título, precio,
  unidad, ubicación disponible y vendedor. La tarjeta puede seguir conservando
  su acción actual, pero sin un botón protagonista por cada dato ni decoración.
- Ninguna URL de `picsum.photos` debe volver a mostrar una fotografía aleatoria.
  En esta pieza no busques ni descargues stock de terceros. Para esos registros,
  mostrales un fallback diseñado y explícitamente ilustrativo por familia, con
  nombre de categoría; no finjas que es la foto exacta del producto. Las fotos
  locales reales sólo se usan donde correspondan semánticamente.
- Dejá un inventario breve de imágenes finales que convendría producir después:
  cantidad, tema, proporción y uso. PM/Emi decidirán y generarán esos activos en
  una pieza separada; no fabriques treinta imágenes ahora.
- El footer deja de enlazar a perfiles genéricos de Twitter/LinkedIn/Instagram.
  Si no existe una URL real de TopGreen, no se muestra ese enlace.
- Definí tokens visuales reutilizables, pero no migres todo el proyecto ni abras
  tema oscuro. Podés proponer una fuente local con licencia comercial clara;
  si no podés verificar origen/licencia y dejarla documentada, usá el stack del
  sistema y no descargues nada.

### Fuera de alcance

Sin backend, base, seed, auth, paneles, carrito, checkout, Mercado Pago,
logística, textos legales ni cambio de comportamiento. Sin hero publicitario
nuevo, bot, mapas, animaciones, paquetes visuales o dependencia de imágenes
externas. No retoques todavía las otras apariciones internas de emojis: traé su
inventario, no las mezcles.

### Criterios de aceptación

1. En 1440×900 la primera pantalla se reconoce como marketplace agro propio:
   marca, búsqueda, filtros/resultados y acción principal tienen jerarquía sin
   aspecto de dashboard SaaS.
2. En 390×844 no hay corte horizontal, controles diminutos ni pérdida de
   búsqueda, filtros o acciones.
3. Cero emojis visibles en el recorrido público acotado y cero fotos aleatorias
   de `picsum.photos`; el fallback no induce a creer que es una foto real.
4. No aparecen acciones falsas ni se rompe búsqueda, filtros, apertura de
   detalle, agregar/contratar, navegación por ubicación o login.
5. Contraste y foco permanecen conformes. Corré build, las puertas visuales y
   la suite funcional; si una puerta cambia de inventario, frená antes de
   rebajarla o regrabarla.
6. Un commit de producto y otro de informe. Incluí capturas 1440×900 y 390×844,
   lista exacta de archivos, antes/después, inventario de activos pendiente y
   cualquier decisión que deba tomar Emi. No despliegues Backend.

Esfuerzo **Extra**: el juicio visual importa, pero el alcance sigue siendo una
sola superficie. Si para lograrlo necesitás tocar más de estos componentes o
inventar una identidad/logotipo definitivo, frená y consultá. Al terminar,
respondé en `PARA-PM.md` y no abras UX-2.

## 2026-08-22 — UX-1 no aceptada visualmente; tarea activa UX-2A

El código `e701cb4` conserva los flujos y pasa las puertas informadas, pero la
dirección visual **no fue aceptada por Emi ni por PM**. Se ve más ordenada que
antes, pero todavía parece una plantilla generada: las ilustraciones beige se
repiten y dominan la grilla, la marca no tiene presencia, las tarjetas son
genéricas, la navegación dice “Home / Quienes somos / Servicios / Contacto” y
la tipografía/composición no transmiten un marketplace agro premium.

No parches esa versión ni hagas otro rediseño completo a ciegas. La tarea activa
es una **prueba visual de dirección**, sin modificar producto todavía.

### Referencia y lectura correcta

Tomá Agrofy como referencia de categoría y nivel comercial, no como plantilla a
copiar. Lo valioso es:

- producto y fotografía agro real como protagonistas;
- marca de alto contraste y reconocible en un vistazo;
- buscador dominante y navegación comercial compacta;
- densidad de catálogo: más producto visible, menos aire de dashboard;
- jerarquía clara de título, precio, ubicación y condición del aviso;
- sensación de negocio agro argentino establecido, no de SaaS genérico.

No copies sus banners publicitarios, carruseles, asistente, categorías ni
componentes. Tampoco uses “premium” como excusa para degradados, glassmorphism,
sombras blandas, tarjetas flotantes, íconos decorativos, microcopy aspiracional
o una paleta beige monocorde. Todo eso volvería a producir AI slop.

### Entrega solicitada: una sola dirección fuerte

Prepará una prueba estática y reversible, fuera del flujo productivo, que muestre:

1. primera pantalla del marketplace en **1440×900**;
2. cabecera completa, buscador, navegación comercial, filtros y primera fila de
   publicaciones;
3. una ampliación de tarjeta y una vista de detalle para comprobar que el mismo
   sistema se sostiene;
4. una hoja breve con tipografías, escala, color, bordes, espaciado y tratamiento
   fotográfico.

Usá contenido real del seed, no lorem ipsum. Para esta prueba podés usar las
fotografías agro reales que ya existen en `public/`, pero no las presentes como
foto exacta de una publicación si no lo son: la composición puede rotularlas
como material de dirección. **No uses** `picsum`, ilustraciones lineales de
familia, emojis, bibliotecas de iconos, fotos descargadas sin licencia ni
imágenes generadas por vos. Si hacen falta activos específicos, dejá los slots
y un inventario exacto; PM/Emi los producirá después de aprobar la dirección.

La salida puede vivir en `docs/pm/ux2a/` como HTML/CSS autocontenido más PNG.
No debe importarse desde la aplicación, entrar al build ni cambiar el despliegue.

### Decisiones visuales que sí debés tomar

- proponé un wordmark tipográfico más contundente, todavía no un logo definitivo;
- reemplazá la navegación institucional por categorías/acciones propias de un
  marketplace, usando sólo destinos que ya existen o marcándolos como jerarquía
  de navegación en la prueba;
- planteá grilla de catálogo más densa y tarjetas menos altas, con la imagen
  ocupando el papel principal y sin botón “Agregar” como solución universal;
- separá con claridad publicación, servicio y logística cuando el tipo de aviso
  lo exija; no todos deben verse como producto de carrito;
- elegí una combinación tipográfica con personalidad agro/comercial y licencia
  verificable, o documentá la sustitución local usada en el mockup;
- conservá accesibilidad y contraste desde el sistema, no como corrección final.

### Límites y condición de freno

No cambies `src/`, Backend, seed, tests, rutas, auth, carrito, checkout,
logística, Mercado Pago ni datos. No crees todavía una skill ni un design system
permanente: primero tiene que existir una dirección aprobada. Una skill ahora
sólo haría reproducible un criterio todavía equivocado.

Entregá un único commit con la prueba y tu respuesta en `PARA-PM.md`. Incluí:

- tres decisiones que evitan que la propuesta vuelva a parecer AI slop;
- diferencias concretas contra `e701cb4` y contra Agrofy;
- lista de activos que faltarían para llevarla a producto;
- riesgos funcionales de implementarla después.

Frená ahí. PM y Emi la revisan visualmente; sólo después se autoriza UX-2B en
producto. Esfuerzo **Extra**, porque esta vez se evalúa criterio visual, no
cantidad de archivos.

## 2026-08-22 — Pausa inmediata de UX-2A

No empieces la prueba visual anterior. Emi decidió correctamente definir primero
la identidad de TopGreen junto con PM. Sin esa decisión, incluso un buen layout
sería otro ejercicio a ciegas.

Quedás sin tarea activa hasta que PM publique una dirección de marca aprobada:
personalidad, sistema tipográfico, color, tratamiento fotográfico, tono verbal
y límites de semejanza con Agrofy. No crees una skill, moodboard, mockup ni
cambios de producto por iniciativa propia. Si ya habías comenzado, frená y
reportá solamente qué archivos locales tocaste, sin commitearlos.

## 2026-08-23 — Puerta 3 aprobada; tarea activa única UX-2B

Emi aprobó visualmente **B — Mesa de negocios** y PM reprodujo el cierre técnico
en `833ee0e`: nueve combinaciones de prototipo/viewport, cero violaciones axe,
errores de consola o desbordes. La pausa anterior queda levantada.

Implementá el sistema aprobado en
`docs/pm/diseno-premium/handoff/`. Ese directorio es la fuente de verdad de
marca, tokens, anatomías, copy, responsive, fotografía, estados y paridad. Los
HTML/CSS son referencia aislada: no los copies como arquitectura React ni los
importes al build.

### Resultado requerido

La superficie real debe aplicar B de forma consistente, no sólo recolorear el
marketplace. Incluye:

1. fundación global: wordmark, fuentes self-hosted, tokens, foco, controles,
   overlays, responsive y fallbacks de imagen;
2. cabecera y pie en variantes anónima, comprador, vendedor y administrador;
3. mercado: buscador, filtros, orden, carga/vacío/error, grilla y detalle;
4. anatomías distintas para activo de alto valor, insumo, servicio y logística;
5. componentes compartidos existentes que el handoff mapea: alta/edición de
   publicación, carrito, checkout, perfil de vendedor, panel de usuario,
   administración, toast, auth y contacto;
6. estados negativos y límites de contenido de `PARIDAD.md`;
7. 1440×900, 768×1024 y 390×844 sin pérdida funcional ni aspecto de plantilla.

Home, Quiénes somos y Servicios reciben el sistema compartido —marca, fuentes,
tokens, cabecera, pie y controles—, pero **no inventes una nueva composición de
contenido**: Diseño no entregó esas páginas. No agregues fotografías ni hero.

### Primera decisión técnica obligatoria — cuatro anatomías

El producto actual no expone una semántica inequívoca para elegir entre las
cuatro anatomías. No la infieras sólo por precio, título, CSS ni una lista
privada en frontend.

Antes de ramificar las tarjetas, encontrá la solución mínima persistente y
explicala en el informe. Puede ser un campo/enumeración explícito de publicación
o una clasificación de dominio igualmente trazable; debe cubrir alta, edición,
API pública, seed, migración y registros existentes. La migración no puede
dejar publicaciones ambiguas ni cambiar la lógica de cobro por accidente.

Si resolverlo exige redefinir qué es comprable, alterar órdenes existentes o
contradice el contrato, frená antes de migrar y traé dos opciones con una
recomendación. Si puede resolverse de manera compatible, implementalo dentro de
la tarea y agregá regresiones de alta, edición, API, catálogo y detalle.

### Comportamiento que debe preservarse

- búsqueda, filtros oficiales, URL y navegación por ubicación;
- apertura/cierre de detalle y perfil;
- stock, cantidad, carrito y los dos checkouts;
- logística por origen/destino y privacidad del contacto;
- publicación, edición, carga de archivos y documentación;
- sesiones, roles, Mercado Pago, avisos de callback y estados de pago;
- paneles, administración y contacto.

`Iniciar operación` para un activo con precio usa la compra actual; no abre
chat, reserva ni negociación. `Solicitar cotización` sólo puede llevar a
Contacto de forma honesta. `Ver transportistas` sigue exclusivamente dentro del
checkout tras carrito y destino. Respetá completo
`FUTURO-NO-IMPLEMENTAR.md`.

### Activos e imágenes

- Copiá únicamente activos autorizados en `ACTIVOS.md`; conservá licencias.
- Self-host de las fuentes efectivamente usadas, sin Google Fonts en runtime.
- Retirá del producto los fallbacks ilustrados de UX-1 y usá `no-photo.svg` y
  `photo-broken.svg` con sus estados distintos.
- No agregues stock, fotos conceptuales ni imágenes generadas. El entorno demo
  puede verse sin fotografía; PM/Emi resolverán un pack con derechos después.
- No cambies imágenes reales cargadas por vendedores ni su semántica `alt`.

### Arquitectura y alcance

- Reutilizá componentes y callbacks; no construyas una aplicación paralela.
- Una sola capa de tokens: retirá los tokens y estilos de UX-1 que queden
  obsoletos, sin mantener dos temas visuales activos.
- Sin librería de iconos, framework CSS, dependencia visual opaca, mapa, chat,
  financiación, reputación nueva, internacionalización funcional ni contenido
  falso.
- No toques pagos ni seguridad salvo el cambio de tipos necesario para compilar
  y preservar contratos; cualquier defecto real encontrado se reporta antes de
  ampliar.
- No despliegues. Railway y producción quedan en PM.

### Secuencia de commits

El trabajo puede ser largo, pero mantenelo auditable:

1. **Fundación y dominio:** activos/tokens/fuentes más semántica persistente de
   anatomías, migración, seed y contratos API.
2. **Superficie pública:** header/footer, mercado, filtros, cards, detalle,
   fallbacks y responsive.
3. **Superficies autenticadas:** alta, carrito, checkout, paneles, admin, auth,
   contacto, overlays, tablas, formularios y estados.
4. **Puertas y evidencia:** regresiones, correcciones de paridad, capturas e
   informe.

No hagas commits sólo por cumplir el número: cada uno debe compilar y explicar
su frontera. Si el árbol no puede quedar funcional entre 1 y 2, unilos y
documentá la razón.

### Criterios de aceptación

1. `PARIDAD.md` completo con evidencia, diferencias intencionales y responsable.
2. Las cuatro anatomías salen de datos explícitos y conservan la acción correcta.
3. Cero claims prohibidos, emojis públicos, fotos temporales, `picsum`, enlaces
   falsos, navegación inventada o doble sistema visual.
4. Capturas comparativas de catálogo, detalle y tablero/estados en 1440×900,
   768×1024 y 390×844; cero overflow y controles conforme a `RESPONSIVE.md`.
5. Teclado, foco, Escape/restauración en capas, zoom 200 %, reduced motion,
   imágenes ausentes/rotas y textos largos comprobados.
6. `npm run build`, `npm run lint`, `npm run contraste`, `npm run a11y`,
   `npm run hito` y suite completa desde base limpia en verde. No rebajes,
   regrabes ni reduzcas inventarios para obtener verde.
7. Migraciones upgrade/downgrade y seed idempotente si cambia dominio.
8. `git -c core.whitespace=cr-at-eol diff --check` limpio.
9. Informe final en `PARA-PM.md` con commits, archivos, antes/después, conteos de
   puertas, decisiones, deudas verdaderas y lo dejado fuera.

Esfuerzo **Extra**. No pidas razonamiento extenso ni avances cosméticos: usá el
presupuesto en ejecución y verificación. Al terminar, empujá código e informe y
frená. PM revisa y decide el despliegue.

## 2026-08-23 — UX-2B: base visual aceptable, cierre todavía no aceptado

Revisé los cuatro commits `08907cd`–`873ad2e` y el informe `8943143`. La
dirección visual **B — Mesa de negocios** queda aceptada como base: no abras
otro rediseño. También cierro las dos decisiones que trajiste:

- un servicio o logística **con precio** conserva `Contratar` y el checkout;
  sin precio usa `Solicitar cotización` hacia Contacto. Es preferible a cortar
  catorce ventas existentes y corrige la orden de `$0`;
- `condition` queda opcional para activos donde nuevo/usado no aplica, como
  tierra y hacienda. No vamos a exigir un dato falso en el MVP.

Actualicé `ANATOMIAS.md` y `COPY.md` para que ya no contradigan esas decisiones.

Verificación independiente de PM: lint, sintaxis Python, diff-check y build de
Vite a un directorio aislado quedan verdes. `npm run build` no pudo vaciar el
`dist/` local por permisos del artefacto previo, después de que TypeScript ya
había compilado; no es evidencia de una falla del código. Docker sigue apagado,
por lo que PM no reprodujo la suite 119/119. Revisé además las capturas y el
código, y encontré cinco faltantes que impiden aceptar UX-2B.

## Tarea activa única: corrección de cierre UX-2B

No abras UX-3, no rediseñes, no despliegues y no cambies pagos. Corregí sólo
estos puntos:

1. **Integridad producto/servicio.** El caso 119 mueve una fila con
   `publication_type='producto'` a una categoría `is_service=true` y sólo cambia
   `operation_kind`. Eso deja la interfaz diciendo servicio mientras el alta y
   sus campos siguen tratándola como producto. En creación, rechazá las dos
   combinaciones cruzadas entre `publication_type` y `category.is_service`. En
   edición, como `publication_type` no es editable, rechazá mover la categoría
   al otro lado y comprobá que la fila no mutó. No conviertas campos ni órdenes
   en silencio. Ajustá el caso 119 para discriminar los tres rechazos.
2. **“Mis Productos” debe respetar la anatomía.** La propia captura
   `panel-estados-1440x900.png` muestra “Muestreo de Suelo” como servicio pero
   imprime `Stock: 3000 unidades`, foto y `$7.500` mediante formato paralelo.
   Usá `operation_kind` y los formatters compartidos: servicio/logística no
   muestran stock ni foto; precio cero dice `A cotizar`; activos/insumos
   conservan lo que corresponda. Renombrá únicamente el título/acción genéricos
   de esa sección si hace falta para no llamar “producto” a todo. No rehagas el
   panel.
3. **Fotografía realmente opcional.** El handoff la declara opcional, pero el
   alta bloquea `images.length === 0` y rotula la sección con `*`. Permití
   publicar sin foto y dejá una regresión de navegador que cree una publicación
   así y compruebe `Sin fotografía` en catálogo y detalle. Conservá validación
   de tipo/tamaño cuando sí se adjunta un archivo.
4. **Estado sin conexión.** Cuando falla la carga del mercado y
   `navigator.onLine === false`, mostrale exactamente `Sin conexión. Revisá tu
   red e intentá de nuevo.`; el resto de fallas conserva el mensaje general. Un
   caso controlado debe probar ambos estados sin silenciar navegación.
5. **Zoom 200 %.** Medí, no marques por inspección. Catálogo, detalle, ingreso,
   carrito/checkout y panel deben seguir operables al 200 %: contenido y acción
   principal alcanzables, foco visible y sin corte horizontal que impida usar
   la pantalla. Si falla, corregí sólo el selector responsable.

Retirá también `src/data/mockData.ts`: está muerto, contiene contenido falso y
URLs de Unsplash, y contradice el criterio de entrega aunque no llegue al build.

### Puertas de cierre

- build, lint, contraste, a11y, hito y suite completa desde base limpia;
- migración/seed sólo se repiten para confirmar que siguen verdes; no hace
  falta otra migración;
- capturas nuevas sólo de “Mis publicaciones” en 1440 y 390, más evidencia
  textual del zoom 200 %;
- `PARIDAD.md` corregido: no marques formato/anatomías/offline/zoom hasta que la
  evidencia nueva exista;
- un commit de corrección y otro de informe. Frená ahí.

## 2026-08-23 — Corrección UX-2B `177cdb2`: aceptada por PM

Acepto la corrección y cierro la tarea técnica UX-2B. La integridad entre tipo
y categoría queda protegida en las tres direcciones; el panel usa anatomía y
formatters compartidos; fotografía opcional, offline y zoom 200 % tienen
regresiones discriminantes; `mockData.ts` salió del entregable.

Verificación independiente de PM sobre `177cdb2`: TypeScript y build de Vite en
directorio aislado, lint, sintaxis Python, `node --check`, búsquedas de recursos
temporales y `diff --check`, todo verde. Revisé el código de los casos 119–123 y
las capturas nuevas de “Mis publicaciones”. Docker local sigue apagado: la
suite **123/123**, contraste 52/52, a11y 64/64 e hito 6/6 quedan aceptados como
evidencia de Dev, no como corrida independiente de PM.

La deuda de números de stock sin significado guardados en servicios queda
registrada, pero no bloquea UX-2B: stock y cobro ya ignoran ese dato para
categorías de servicio. Se normaliza en una pieza de datos antes de producción,
no dentro de este cierre visual.

No tenés tarea activa. No despliegues ni abras UX-3: falta que Emi vea esta
versión en el entorno descartable y complete su revisión visual.

## 2026-08-23 — A aprobada; tarea activa única: extensión comercial UX-2C

Emi revisó por separado A y B y eligió **A — Mercado a cielo abierto**. Diseño
convirtió esa dirección en un handoff ejecutable en
`docs/pm/diseno-premium/extension-comercial/`. Esta tarea reemplaza la pausa
anterior. No reabras B, wordmark, tipografías, anatomías ni producto.

### Lectura obligatoria

Seguí, en orden, el índice de
`docs/pm/diseno-premium/extension-comercial/README.md`. El contrato principal es
`IMPLEMENTACION-DEV.md`; `MAPA-COMPONENTES.md` lo vincula con el repo y
`PARIDAD.md` es la puerta de cierre. Lo no redefinido sigue bajo
`docs/pm/diseno-premium/handoff/`.

### Resultado requerido

1. **Inicio completo:** reemplazar placa índigo, bienvenida, beneficios con
   iconos y claims por el hero split, taxonomía estática, preview real de
   operaciones, bloque de datos y CTA aprobados.
2. **Servicios completo:** retirar video con overlay, lista hardcodeada y claims
   de IA/satélites/IoT; usar hero split, publicaciones reales de
   servicio/logística sin foto en la card, criterios de comparación y CTA.
3. **Mercado:** conservar funciones/anatomías y aplicar canvas, acción, intro,
   cabecera y densidad de la misma dirección.
4. **Sistema compartido:** canvas `#F4F1EA`, acción `#B93424`, hover/link
   `#8F281D`, índigo como texto/estructura y overlay fotográfico 0 %.
5. **Fotografía:** copiar sólo los cuatro WebP de
   `assets/produccion/`; no servir JPG con EXIF/GPS y no copiar ningún
   `*-concepto.webp`.

### Datos y comportamiento

- Preview de Inicio: `getProducts`, hasta tres resultados y total de
  `ProductListResponse.total`; nunca `30` o `destacadas` hardcodeado.
- Preview de Servicios: catálogo canónico filtrado por dominio
  `servicio/logistica`; sin endpoint nuevo ni inferencia por título/precio.
- `Ver servicios publicados` llama `setSelectedType('servicios')` antes de
  navegar al Mercado; cambiar sólo la URL no actualiza el hook montado.
- Reutilizar `ProductCard`, `ProductImage`, `precioVisible`,
  `normalizarAnatomia` y `accionDe`, o una variante compacta que consuma las
  mismas fuentes. No crear formatters ni CTAs paralelos.
- Preservar búsqueda, filtros, detalle, carrito, checkout, logística, auth,
  roles, callback MP, paneles, administración, publicación y contacto.

### Límites

- Sin Backend, migración, seed, pagos, despliegue ni nuevas dependencias.
- Sin chat, mapa, financiación, verificación, rankings, claims o rutas nuevas.
- Quiénes somos y Contacto reciben tokens/header/footer; no inventes otra
  composición sin una pantalla aprobada.
- La foto interina de Servicios no se amplía y su reemplazo final no es tarea
  Dev.

Si la preview real exige cambiar API o contratos, frená y traé la mínima opción;
no amplíes por tu cuenta.

### Evidencia y cierre

- completar `extension-comercial/PARIDAD.md` con evidencia;
- capturas de Inicio, Servicios y Mercado a 1440×900, 768×1024 y 390×844,
  además de comparación antes/después;
- loading, vacío, error, offline, foto rota/ausente, texto largo, teclado,
  reduced motion y zoom 200 %;
- `npm run build`, `npm run lint`, `npm run contraste`, `npm run a11y`,
  `npm run hito` y suite completa desde base limpia;
- cero recursos externos, assets conceptuales, overflow, claims prohibidos o
  doble tema;
- informe final en `PARA-PM.md` con commits, archivos, conteos, diferencias y
  deuda real.

No despliegues. Hacé commits auditables, empujá producto e informe y frená para
revisión de PM/Emi.

### Validación PM del handoff `0a05a0a`

PM revisó las tres superficies A, la comparación A/B, contratos de datos,
activos y hashes. UX-2C queda habilitada con los límites de
`extension-comercial/REVISION-PM-0a05a0a.md`. La aprobación permite implementar,
no desplegar ni publicar. La cesión de las fotos y el reemplazo final del hero
de Servicios son puertas de salida ajenas a este ciclo de Dev.

## 2026-08-24 — Revisión UX-2C `e095ab8`: una corrección de escala antes de aceptar

La dirección visual y la implementación general quedan conformes: PM revisó
las capturas de Inicio, Servicios y Mercado en desktop/mobile y reprodujo
`npm run build`, `npm run lint`, sintaxis y `diff --check`, todos verdes. No
reabras composición, tokens, activos, anatomías ni el movimiento de originales.

No acepto todavía el cierre por un borde funcional que el seed de 30 filas no
puede detectar. `useVistaPrevia({ soloServicios: true })` pide sólo la primera
página de 100 y filtra en el navegador. Si las 100 publicaciones más nuevas son
productos, Servicios afirma que no hay servicios aunque existan en la página 2.
El Mercado comparte el límite: `selectedType` tampoco llega a la consulta ni es
dependencia del efecto, por lo que `Ver servicios publicados` sólo filtra los
primeros 100 resultados descargados. Esto contradice una superficie nacional y
la instrucción de frenar si la preview necesitaba contrato API.

### Corrección autorizada y acotada

1. Agregá a `GET /api/catalog/products` un filtro opcional y validado por
   `publication_type` (`producto` o `servicio`), aplicado antes del conteo y la
   paginación. Sin migración ni cambio de esquema.
2. Exponé el parámetro en `getProducts`.
3. La preview de Servicios debe pedir `publication_type=servicio` y sólo la
   cantidad necesaria; no descargar 100 ni filtrar una página parcial. Usá el
   total filtrado si se muestra, sin inventarlo.
4. El Mercado debe mandar el filtro cuando `selectedType` sea `productos` o
   `servicios`, y recargar cuando cambie. Conservá la defensa de dominio del
   frontend, pero la fuente paginada debe salir filtrada del servidor.
5. Sumá una regresión discriminante con más de 100 publicaciones más nuevas que
   un servicio: la preview y el Mercado filtrado deben encontrar el servicio y
   el total del endpoint debe ser el filtrado. No alcanza una prueba con el seed
   actual ni una aserción sobre parámetros sin comprobar el resultado.

### Límites

- No agregues paginación UI general en este ciclo; registrá por separado que el
  Mercado continúa mostrando como máximo 100 resultados por consulta.
- Sin migración, nuevas dependencias, cambios de pagos/logística/auth, rediseño
  ni despliegue.
- No rebajes los casos 124/125 ni las puertas anteriores.

Entregá un commit de producto y otro de informe. Repetí build, lint, contraste,
a11y, hito y suite desde base limpia; frená sin desplegar.

## 2026-08-24 — Corrección `35eaf30`: UX-2C aceptada técnicamente

Acepto el filtro `publication_type` antes de conteo/paginación, su consumo por
preview y Mercado, y la regresión 126 con el servicio detrás de 101 productos.
PM reprodujo build, lint, sintaxis y checks estáticos; la suite 126/126 y las
puertas de navegador quedan como evidencia de Dev porque Docker local continúa
apagado.

La afirmación de que el Mercado ya muestra el total verdadero era incorrecta:
la API lo devuelve, pero `ProductGrid` cuenta `products.length`. PM corrigió
`ux2c/DEUDA-PAGINACION.md`; no bloquea este cierre porque paginación quedó
excluida expresamente, pero debe resolverse antes de que el catálogo supere 100
resultados por filtro.

No tenés tarea activa. No despliegues: falta la revisión visual final de Emi.

## 2026-08-24 — Puerta visual de Emi: rechazada; Dev continúa pausada

Emi revisó UX-2C localmente. La arquitectura y la implementación técnica se
conservan, pero la identidad crema + rojo óxido + serif dominante se percibe
como un diario, no como un marketplace agro. Ver
`diseno-premium/DEVOLUCION-EMI-UX2C.md`.

No cambies producto, no pruebes paletas y no despliegues. Diseño debe resolver
color, escala tipográfica y señalética sobre la estructura existente, y Emi
debe aprobar la comparación antes de una nueva tarea Dev.

## 2026-08-25 — B elegida en Ox Alpha; Dev sigue pausada

Emi eligió **B — Mercado nacional** y PM verificó la exploración aislada en
desktop y mobile. La decisión y sus límites están en
`diseno-premium/REVISION-PM-OX-ALPHA.md`; el prototipo queda en
`diseno-premium/ox-alpha/`.

Esto aprueba una dirección, no una implementación. Sólo existe Header + primer
viewport de Inicio: no extrapoles color, header, cards o responsive al resto del
producto y no copies el HTML aislado. Diseño debe cerrar primero Inicio,
Servicios y Mercado contra los componentes reales. No tenés tarea activa y no
debes desplegar.

## 2026-08-25 — Tarea activa única: UX-2D / B Mercado nacional

La pausa anterior queda levantada. Diseño extendió B y Emi aprobó la corrección
final. PM la verificó y versionó un handoff reproducible en
`docs/pm/diseno-premium/mercado-nacional-b/`.

### Lectura obligatoria

Leé, en orden:

1. `mercado-nacional-b/README.md`;
2. `mercado-nacional-b/HANDOFF-DEV.md`;
3. `mercado-nacional-b/MAPA-REACT.md`;
4. `mercado-nacional-b/PARIDAD.md`;
5. el tablero offline y sus `frames/`.

### Resultado requerido

Implementá la dirección **B — Mercado nacional** sobre UX-2C sin reabrir
producto. El alcance visual es Header por rol, Inicio, Servicios y Mercado. Las
demás superficies conservan estructura y comportamiento y reciben sólo las
fundaciones compartidas que no rompan operación ni contraste.

No copies el HTML/CSS aislado ni sus datos ilustrativos. Reutilizá componentes,
API, anatomías, formatters, callbacks y estados actuales. El conteo siempre
sale del total real. El símbolo `parcela activa` se usa como activo provisional
del MVP: no lo redibujes.

### Límites duros

- Sin Backend, migración, seed, API, pagos, logística, auth, rutas o
  dependencias.
- Sin rediseño inventado de Quiénes somos, Contacto, auth, detalle, carrito,
  publicación, paneles o administración.
- Sin recursos externos, fotos inventadas, claims, íconos o segundo tema.
- Sin resolver la deuda general de paginación >100 dentro de esta tarea.
- Sin despliegue.

Si el handoff y el código real chocan funcionalmente, preservá el producto,
frená y reportá la mínima diferencia; no decidas diseño ni contrato por tu
cuenta.

### Puertas y entrega

Completá `mercado-nacional-b/PARIDAD.md`. Capturá Inicio, Servicios y Mercado
en `1440×900`, `768×1024` y `390×844`, más los cuatro Headers por rol en
desktop/mobile. Probá estados, foto ausente/rota, teclado, zoom 200 %, reduced
motion, copy largo y cero overflow.

Corré build, lint, contraste, a11y completo, hito, suite desde base limpia y
`diff --check`. Entregá un commit de producto y otro de informe en
`PARA-PM.md`; empujá ambos y frená para revisión. **No despliegues.**

## 2026-08-26 — Corrección visual acotada UX-2D.1: una sola cabecera

Emi revisó UX-2D en el producto real y **no acepta que el encabezado cambie de
estructura al entrar al Mercado**. La identidad superior debe permanecer
estable entre Inicio, Mercado y Servicios. Ésta es la única tarea activa; no
reabras el resto de UX-2D.

### Resultado requerido

1. Conservá un único `Header` y una **primera banda idéntica** en todas las
   secciones públicas: marca a la izquierda, las cinco secciones en el mismo
   orden y las acciones reales de sesión/rol a la derecha.
2. En Mercado, mové el formulario de búsqueda a una **segunda banda propia,
   inmediatamente debajo** de esa primera banda. El buscador no reemplaza la
   navegación ni desplaza las secciones a una barra blanca.
3. Fuera de Mercado no se muestra el buscador. La búsqueda continúa filtrando
   exactamente el catálogo actual y conserva etiqueta accesible, submit,
   valor, callbacks y placeholders existentes.
4. En tablet y celular preservá todas las secciones y acciones. El orden de
   lectura debe ser marca/acciones, navegación y, sólo en Mercado, búsqueda.
   Puede envolver según los breakpoints existentes, pero no esconder destinos,
   crear menú nuevo ni introducir scroll horizontal.

### No confundir con esta tarea

En el entorno local de revisión, las publicaciones de Logística aparecieron
como `Insumo estandarizado`. PM comprobó que el frontend nuevo está conectado
al Backend descartable antiguo: su respuesta pública omite `operation_kind`,
`pricing_type`, `response_time` y `coverage_zones`. El código y el seed actuales
sí declaran `logistica`. **No corrijas esto con inferencias en el frontend, no
toques Backend y no despliegues** dentro de UX-2D.1.

### Límites y puertas

- Sin rediseñar cards, hero, filtros, anatomías, colores, tipografía o copy.
- Sin Backend, seed, migración, API, auth, pagos, logística, dependencias ni
  despliegue.
- Preservá retorno de Mercado Pago, Admin, Vender, carrito, cuenta, salir e
  ingresar para los roles existentes.
- Actualizá la regresión del Header para exigir paridad estructural entre
  Inicio, Mercado y Servicios, y búsqueda en la segunda banda sólo en Mercado.
- Capturas mínimas: Inicio y Mercado a `1440×900`, `768×1024` y `390×844`, sin
  sesión y con el rol más cargado. Incluí teclado, zoom 200 % y cero overflow.
- Repetí build, lint, contraste, a11y, hito, suite completa y `diff --check`.
  Entregá commit de producto e informe en `PARA-PM.md`; empujá y frená.

## 2026-08-26 — Revisión PM de UX-2D.1: conforme técnicamente, pausa visual

La corrección `2a01775` y el informe `03ed1bf` cumplen el alcance. PM comprobó
en navegador la misma primera banda en Inicio y Mercado, con la búsqueda debajo
sólo en Mercado; revisó además las evidencias admin de `1440`, `768` y `390`.
Build, lint y `diff --check` fueron reproducidos sin fallas. La suite 128/128 y
las puertas completas quedan como evidencia de Dev porque PM no recreó la base.

No hay tarea activa. No despliegues ni abras otra corrección: falta únicamente
la confirmación visual de Emi sobre esta cabecera.

## 2026-08-27 — Tarea activa única: SEC-1, retirar secretos de la consola de autenticación

Emi autorizó reactivar a Dev para este cierre de seguridad independiente. La
aceptación visual de UX-2D.1 continúa pendiente: esta tarea no la da por
cerrada, no reabre diseño y no habilita despliegue.

### Resultado esperado y prioridad

El login actual escribe en la consola del navegador el correo, el usuario
transformado y la respuesta completa de `/auth/login`; esa respuesta contiene
`access_token` y `refresh_token`. Eliminá esa exposición sin cambiar el
comportamiento de autenticación. Es un agujero ya reproducido, por lo que no se
posterga a la auditoría general de Fase 5.

Antes de editar, inspeccioná el flujo real de login, refresh y logout y todos
los `console.*` del frontend que puedan imprimir credenciales, tokens,
respuestas de autenticación o datos completos de cuenta. Leé la base CSRF
aceptada en `NOW.md` y los cierres `6ece3fb` + `0f330a7`: Bearer/localStorage y
la cookie reservada al callback MP no se rediseñan en esta pieza.

### Alcance

- Retirar o volver inocuos únicamente los logs que exponen correo de login,
  credenciales, tokens, respuestas de autenticación o el objeto completo del
  usuario.
- Agregar una regresión automática sobre el login real que observe la consola y
  falle si aparece el valor del access token, el refresh token, la contraseña,
  el correo usado para ingresar o la respuesta/usuario completos.
- Cubrir login correcto y rechazado; confirmar que refresh, sesión autenticada
  y logout conservan el comportamiento actual.
- Reutilizar la infraestructura de pruebas existente. Sin dependencia nueva.

### Fuera de alcance

- No mover tokens fuera de `localStorage`, cambiar cookies, CSRF, OAuth,
  expiraciones, endpoints ni contratos de API.
- Sin CSP, cabeceras HTTP, actualización masiva de dependencias, Backend,
  migraciones, seed, pagos, catálogo, UX, copy ni despliegue.
- No convertir esto en una auditoría general ni borrar logs operativos que no
  contengan información sensible.

### Criterios de aceptación ejecutables

1. Mostrá la regresión en rojo contra el estado anterior: un login válido debe
   detectar al menos el token o la respuesta completa en consola. Restaurá el
   árbol antes de implementar; la rotura no se versiona.
2. Después del cambio, la misma prueba completa login válido e inválido y no
   encuentra access token, refresh token, contraseña, correo de ingreso,
   respuesta de autenticación ni objeto completo de usuario en ningún nivel de
   consola.
3. Login, sesión protegida, refresh y logout continúan funcionando con el
   mecanismo actual; la regresión compara comportamiento antes/después y no
   acepta ocultar un fallo de autenticación.
4. Quedan verdes la prueba nueva, `npm run build`, `npm run lint`, la suite
   oficial completa desde base limpia y
   `git -c core.whitespace=cr-at-eol diff --check`.
5. El diff queda limitado al mínimo necesario para este hallazgo, su prueba y
   el informe. No hay dependencia nueva ni cambio visual.

### Freno obligatorio

Frená antes de ampliar si la fuga no se puede cerrar sin cambiar el modelo de
sesión aceptado, si encontrás secretos emitidos por Backend o una dependencia,
o si la prueba exige tocar infraestructura fuera del repositorio. Informá la
fuente, reproducción y mínima opción; no improvises otro modelo de auth.

Entregá un commit de producto y otro con el informe en `PARA-PM.md`. El informe
debe traer archivos, rojo/verde, comandos y salidas resumidas, riesgos
residuales y ambos hashes. Empujá los dos y frená para revisión PM. **No
despliegues.**

## 2026-08-27 — SEC-1 `d8ce32a`: aceptada

Acepto producto `d8ce32a` e informe `b38f29c`. La fuga queda retirada en el
contexto y el modal sin cambiar Bearer/localStorage; el caso 129 observa los
objetos dentro de la página, discrimina el rojo anterior y conserva login,
sesión protegida, refresh, logout e ingreso rechazado.

Verificación independiente PM: el diff se limita a los dos puntos del login y
la regresión, sin dependencias, Backend, estilos ni marcado; `npm run build`,
`npm run lint`, `node --check scripts/smoke.mjs` y
`git -c core.whitespace=cr-at-eol diff --check` quedan verdes. PM confirmó por
código la fuga anterior y su retiro. La suite 129/129 desde base limpia queda
como evidencia de Dev: este entorno no tiene Docker y la descarga de Chromium
agotó el tiempo de espera. No pido contraste, a11y ni hito porque el diff no
toca sus superficies.

## Tarea activa única: SEC-2, dependencias Python sin vulnerabilidades conocidas

La auditoría PM ejecutó `pip-audit -r backend/requirements.txt` y obtuvo 40
hallazgos conocidos en siete paquetes instalados, entre ellos FastAPI,
Starlette, python-jose, python-dotenv, Pillow, pytest y la dependencia ecdsa.
El número es una foto del feed, no la especificación: reproducí la salida hoy y
trabajá contra los IDs que devuelva la corrida nueva.

### Resultado esperado y prioridad

Dejá el entorno Python reproducible con versiones compatibles que no tengan
vulnerabilidades conocidas publicadas por `pip-audit`, sin cambiar contratos ni
comportamiento del producto. Es otro riesgo concreto ya encontrado; no abre la
auditoría general de Fase 5.

Antes de editar, revisá `backend/requirements.txt`,
`backend/Dockerfile.railway`, el grafo resuelto en Python 3.11 y los usos reales
de los paquetes señalados. Elegí el conjunto mínimo compatible; no actualices
por decoración ni cambies librerías si una versión corregida resuelve el mismo
problema.

### Alcance

- Reproducir el rojo en un entorno Python 3.11 limpio con `pip-audit` y guardar
  paquete, versión, ID y versión corregida disponible.
- Actualizar sólo los pins directos necesarios y dejar que el resolvedor
  demuestre el grafo final. Todos los pins continúan explícitos y
  reproducibles.
- Si una dependencia sin versión corregida obliga a reemplazar una librería,
  podés hacerlo únicamente si queda encerrado en la implementación interna y
  conserva formato de tokens, algoritmos permitidos, expiraciones, errores y
  contratos actuales. Si cualquiera de esos bordes cambia, frená primero.
- Verificar especialmente autenticación/JWT, carga y lectura de imágenes,
  multipart/documentación, arranque FastAPI y comandos de prueba.
- Reutilizar la suite existente. Agregá una regresión sólo si el cambio de
  dependencia descubre un comportamiento que la suite no cubre.

### Fuera de alcance

- Sin frontend/npm, esquema, migración nueva, seed funcional, endpoints, UX,
  catálogo, pagos, logística, CSP, cabeceras HTTP ni despliegue.
- Sin actualización general a `latest`, cambio de framework, refactor de auth
  o limpieza lateral.
- No usar `--ignore-vuln`, exclusiones, supresiones ni comentarios para hacer
  verde el auditor. Un riesgo aceptado necesita decisión PM, no silencio.

### Criterios de aceptación ejecutables

1. La evidencia roja lista los hallazgos del conjunto anterior. Después del
   cambio, un entorno Python 3.11 recién creado instala
   `backend/requirements.txt`, `pip check` termina limpio y `pip-audit` informa
   cero vulnerabilidades conocidas para el grafo instalado.
2. La aplicación importa y arranca, Alembic llega a una sola cabeza y una base
   limpia completa migraciones y seed sin intervención manual.
3. La suite oficial completa —mínimo 129/129— queda verde desde esa misma base;
   login, refresh, logout, validación JWT, imágenes, multipart y documentación
   siguen cubiertos y funcionando.
4. Quedan verdes `python -m compileall -q backend/app backend/alembic`,
   `npm run build`, `npm run lint` y
   `git -c core.whitespace=cr-at-eol diff --check`.
5. El diff contiene sólo pins, el cambio interno estrictamente necesario si un
   paquete no tiene corrección compatible, pruebas justificadas y el informe.
   No aparecen cambios de contrato ni dependencia frontend.

### Freno obligatorio

Frená sin versionar una migración de librería si un hallazgo no tiene arreglo
compatible, si el auditor sólo puede quedar verde ignorándolo, si cambia el
formato/autoridad de tokens o si una actualización exige tocar contratos,
datos, pagos o más de un bloque funcional. Informá el ID, exposición real,
opciones mínimas, esfuerzo y riesgo para que PM decida.

Entregá un commit de producto y otro con el informe en `PARA-PM.md`, incluyendo
grafo antes/después, rojo/verde, comandos, suite, riesgos residuales y hashes.
Empujá ambos y frená para revisión PM. **No despliegues.**

## 2026-08-27 — SEC-2 `ccb868c`: aceptada

Acepto producto `ccb868c` e informe `6cea576`. PyJWT retira la dependencia ecdsa
sin cambiar formato, algoritmo, expiraciones ni autoridad de los tokens; el
caso 130 fija cabecera, reclamaciones, HMAC, vencimiento y rechazos fuera de la
librería. Los tres `pattern=` son la adaptación mínima a FastAPI 0.133 y no
cambian los filtros.

Verificación independiente PM: entorno Python 3.11.15 nuevo con 52 paquetes,
`pip check` limpio, `pip-audit` en cero, aplicación importable con 100 rutas,
roundtrip JWT y tokens de python-jose/PyJWT idénticos byte a byte y legibles en
ambas direcciones. También quedan verdes compileall, build, lint, sintaxis del
smoke y `diff-check`. La base limpia, migraciones, seed y suite 130/130 quedan
como evidencia de Dev porque PM continúa sin Docker.

### Regla permanente de respuesta

Al terminar una entrega, escribí la respuesta completa únicamente en
`docs/pm/PARA-PM.md`, empujá producto e informe y a Emi avisale sólo que
**respondiste**. Emi no vuelve a copiar y pegar el informe: cuando diga
“respondió”, PM actualiza `main` y lo lee desde el repositorio.

## Tarea activa única: SEC-2.1, retirar tres dependencias sin consumidores

Acepto tu hallazgo: `pillow`, `fastapi-cors` y `passlib` no tienen consumidores
en el producto. Mantener paquetes muertos amplía el grafo y obliga a seguir
avisos de código que no ejecutamos. Retiralos con una corrección mínima antes
de abrir el siguiente bloque de producción.

### Alcance

- Eliminar de `backend/requirements.txt` sólo `pillow`, `fastapi-cors` y
  `passlib[bcrypt]`, junto con los comentarios que afirmen usos inexistentes.
- Conservar `bcrypt==5.0.0` como dependencia directa: sí la importa
  `app/core/security.py`.
- Demostrar en un entorno Python 3.11 limpio que tampoco quedan instaladas sus
  transitivas exclusivas. No agregues reemplazos: no hay función que reemplazar.
- No hace falta un caso nuevo si la suite existente discrimina arranque,
  imágenes, multipart, documentación y autenticación después del retiro.

### Fuera de alcance

- Sin código de aplicación, frontend/npm, otras versiones, esquema, seed,
  endpoints, validación nueva de imágenes, CSP, cabeceras, UX ni despliegue.
- No separes todavía requirements de producción/pruebas ni limpies otros
  paquetes. Es una decisión diferente.

### Criterios de aceptación ejecutables

1. La evidencia anterior muestra los tres paquetes en el grafo y una búsqueda
   reproducible demuestra que ningún archivo de producto los importa o llama.
2. Una instalación Python 3.11 recién creada termina con `pip check` limpio;
   `pillow`, `fastapi-cors`, `passlib` y sus transitivas exclusivas ya no están,
   mientras `bcrypt` permanece declarado e instalado.
3. `pip-audit -r backend/requirements.txt` continúa en cero sin exclusiones y
   la aplicación importa con el mismo conjunto de rutas públicas que
   `ccb868c`.
4. Base limpia, migraciones, seed y suite completa —mínimo 130/130— quedan
   verdes; también compileall, build, lint y
   `git -c core.whitespace=cr-at-eol diff --check`.
5. El commit de producto toca sólo `backend/requirements.txt`; el informe va
   después en `PARA-PM.md`. Sin caso nuevo ni cambio de comportamiento.

Frená si aparece un import dinámico o si retirar cualquiera de los tres rompe
un recorrido: traé el consumidor exacto y no agregues otra biblioteca por tu
cuenta.

Empujá producto e informe, avisá que respondiste y frená para revisión PM. **No
despliegues.**

## 2026-08-27 — SEC-2.1 `c05e0fb`: aceptada

Acepto producto `c05e0fb` e informe `7280404`. El commit toca únicamente
`backend/requirements.txt`: salen `pillow`, `fastapi-cors` y `passlib`, junto
con `environs` y `marshmallow`; `bcrypt` permanece directo. No hay reemplazo ni
cambio de comportamiento.

Verificación independiente PM: entorno Python 3.11.15 nuevo con 47 paquetes,
los cinco retirados ausentes, `bcrypt==5.0.0` presente, `pip check` limpio,
`pip-audit` en cero, compileall y `diff-check` verdes, aplicación importable con
las mismas 100 rutas y roundtrip JWT correcto. Base limpia, migraciones, seed y
suite 130/130 quedan como evidencia de Dev porque PM continúa sin Docker.

## Tarea activa única: SEC-3, cabeceras HTTP defensivas sin romper integraciones

La auditoría PM recibió respuestas públicas del Frontend y Backend sin HSTS,
`Content-Security-Policy`, `X-Content-Type-Options`, protección contra framing,
`Referrer-Policy` ni `Permissions-Policy`. El Nginx local heredado trae dos
cabeceras, pero Railway usa `infra/railway/nginx.conf.template`, que no las
define; FastAPI tampoco aplica una política global.

### Resultado esperado y prioridad

Todas las respuestas públicas deben traer una base defensiva reproducible. El
Frontend agrega una CSP compatible con el producto real y el Backend conserva
sus contratos y CORS. No se cambia autenticación, despliegue ni funcionalidad.

Antes de editar, leé `Dockerfile.railway`,
`infra/railway/nginx.conf.template`, `backend/app/main.py`, la configuración
CORS y los flujos de imágenes, uploads, OAuth/Checkout Pro y callbacks. Medí
primero los headers actuales del Frontend y Backend públicos; no asumas que el
Nginx local es el que sirve Railway.

### Alcance

- En el Frontend servido por Nginx, aplicar en todas las respuestas —documento,
  fallback SPA, assets y `/health`— como mínimo HSTS, `nosniff`, prohibición de
  framing, `Referrer-Policy` y una `Permissions-Policy` que niegue capacidades
  no usadas.
- Agregar CSP al Frontend: scripts sin `unsafe-eval`; objetos y framing
  prohibidos; `base-uri` acotado; imágenes, fuentes, estilos y conexiones sólo
  con las fuentes que el producto realmente usa. `data:`/`blob:` o inline se
  permiten únicamente donde una función existente los necesita.
- Los orígenes de API e imágenes no se hardcodean al Railway descartable: salen
  de la misma configuración de build/despliegue que usa el frontend.
- En FastAPI, aplicar HSTS, `nosniff`, protección de framing,
  `Referrer-Policy` y `Permissions-Policy` también en éxito, error y 404, sin
  alterar CORS, cookies, descargas ni contenidos.
- Dejar una regresión automática que compruebe valores, cobertura y ausencia de
  duplicados contradictorios en ambos servicios.

### Límites

- Sin cambiar CORS, tokens/localStorage, cookies, CSRF, OAuth, endpoints,
  contratos, rutas, HTML visual, dependencias, datos ni esquema.
- Sin `X-XSS-Protection`, preload de HSTS, wildcard general `https:`/`*` en CSP
  ni `unsafe-eval`. No rompas Swagger, PDFs, imágenes, previews locales,
  Checkout Pro o retorno OAuth para hacer verde una lista de headers.
- Sin desplegar. La prueba se hace en candidatos locales equivalentes a los dos
  contenedores Railway; PM decide publicación después.

### Criterios de aceptación ejecutables

1. La evidencia roja muestra la ausencia actual en Frontend y Backend. La
   regresión falla contra esa base y queda verde sólo cuando todas las rutas
   acordadas entregan una política única y coherente.
2. Frontend: `/`, un asset versionado, `/health` y una ruta SPA inexistente
   reciben los headers. Backend: health, una respuesta API correcta, un 401, un
   404 y una descarga PDF reciben la base defensiva sin perder contenido,
   `Content-Type`, `Content-Disposition` ni CORS.
3. Un navegador real recorre páginas públicas y los cuatro roles, imágenes y
   previews `blob:`, login/refresh/logout, publicación multipart, checkout,
   OAuth/retorno MP y documentación sin recurso bloqueado ni violación CSP. La
   política no abre un origen para silenciar una falla: cada permiso queda
   asociado a un uso real.
4. Las rutas y respuestas API coinciden con la base anterior salvo por headers;
   la suite completa —mínimo 130/130—, a11y, contraste e hito quedan verdes
   desde base limpia.
5. Quedan verdes build, lint, compileall,
   `git -c core.whitespace=cr-at-eol diff --check` y la construcción/healthcheck
   de ambos contenedores candidatos.

### Freno obligatorio

Frená antes de ampliar si la CSP exige un wildcard, si una integración externa
necesita un origen no identificable desde configuración, si un header rompe
OAuth/pagos/descargas o si Railway no permite expresar la política sin cambiar
la topología. Traé la ruta, header, violación y mínima opción; no relajes toda
la política ni despliegues para probar.

Entregá producto e informe en commits separados, con matriz ruta/header,
rojo/verde, comandos, navegador, riesgos residuales y hashes. Empujá a
`Memu007/yneratopgreen`, avisá sólo que respondiste y frená. **No despliegues.**

## 2026-08-27 — SEC-3 `625d958`: rechazada por cobertura incompleta de 500

No acepto todavía producto `625d958` ni informe `09d4418`. La base defensiva y
la CSP quedan bien encaminadas, y PM reprodujo build, lint, compileall y
`diff-check`; pero la afirmación «toda respuesta pública» no se sostiene en un
error no controlado.

Rojo independiente PM contra `625d958`, con `TestClient(app,
raise_server_exceptions=False)` y una ruta agregada sólo en memoria que lanza
`RuntimeError`:

```text
/api/health                 200  cinco cabeceras presentes
/api/no-existe              404  cinco cabeceras presentes
/__pm/error-no-controlado   500  HSTS=None, nosniff=None, frame=None,
                                  referrer=None, permissions=False
```

La causa a contrastar es el orden real de la pila ASGI/Starlette: el middleware
de SEC-3 ve las respuestas que atraviesan la aplicación, pero el 500 genérico
que arma la capa exterior no vuelve a pasar por él.

## Tarea activa única: SEC-3R, cerrar las cabeceras del error 500

### Resultado esperado y prioridad

Un error no controlado debe conservar exactamente la misma base defensiva que
200, 401 y 404, sin cambiar el cuerpo genérico ni exponer detalles. Es una
corrección del criterio incumplido; no abre una pieza nueva.

Antes de editar, revisá `backend/app/main.py`, el orden efectivo de middleware
de la versión instalada de Starlette y el caso 131. Reproducí primero el rojo
de PM contra `625d958`.

### Alcance y límites

- Corregí únicamente la cobertura Backend del 500 y la regresión que la fija.
- No agregues una ruta de error permanente ni un interruptor de fallo al
  producto. El error deliberado existe sólo dentro de la prueba.
- No cambies CSP, Nginx, CORS, contratos, cuerpos, autenticación, dependencias,
  endpoints, datos, esquema ni despliegue salvo evidencia de necesidad directa.
- No conviertas la excepción en información para el cliente ni dupliques
  cabeceras ya presentes.

### Criterios de aceptación ejecutables

1. Una regresión reproduce un `RuntimeError` no controlado a través del ASGI
   real, falla contra `625d958` y queda verde con la corrección, sin versionar
   un endpoint artificial.
2. La respuesta sigue siendo HTTP 500 con el cuerpo y `Content-Type` genéricos
   de la base; no incluye tipo, mensaje ni traceback de la excepción.
3. HSTS, `nosniff`, `DENY`, `Referrer-Policy` y `Permissions-Policy` aparecen
   una sola vez y con los mismos valores que en 200/401/404.
4. El caso 131 conserva 200, 401, 404, docs, uploads/PDF y preflight CORS; la
   suite completa queda al menos 131/131 desde base limpia.
5. Build, lint, compileall, a11y, contraste, hito y
   `git -c core.whitespace=cr-at-eol diff --check` quedan verdes. El diff de
   producto es el mínimo necesario y no toca frontend visual.

### Freno obligatorio

Frená si cubrir el 500 exige cambiar el cuerpo de error público, agregar un
endpoint de diagnóstico, depender de una API privada de Starlette o duplicar
la política en caminos que puedan divergir. Traé la alternativa mínima con su
rojo; no amplíes por tu cuenta.

Empujá corrección e informe en commits separados a
`Memu007/yneratopgreen/main`, avisá sólo que respondiste y frená. **No
despliegues.**

## 2026-08-27 — SEC-3 y SEC-3R: aceptadas

Acepto producto `625d958`, corrección `e78e3d5` e informes
`09d4418`/`e131aff`.

Verificación independiente PM sobre el árbol final: 200 y 404 conservan una
sola copia de cada cabecera; un `RuntimeError` agregado sólo en memoria devuelve
500, `text/plain; charset=utf-8` y `Internal Server Error`, sin mensaje ni
traceback, con HSTS, `nosniff`, `DENY`, `Referrer-Policy` y
`Permissions-Policy` exactamente una vez. Build, lint, compileall, `pip check`
y `diff-check` quedan verdes. Base limpia, suite 131/131, candidato Nginx,
navegador, a11y, contraste e hito permanecen como evidencia de Dev porque PM no
tiene Docker ni Nginx. No hubo despliegue.

## Tarea activa única: SEC-4, el seed demo no puede correr en producción

### Resultado esperado y prioridad

`python -m app.seed` crea cuatro cuentas con correos y contraseñas conocidas,
además de datos demo. Hoy `ENV=production` no cambia ese comportamiento. Una
invocación accidental sobre la base productiva dejaría accesos públicos
predecibles; debe fallar antes de abrir una sesión o escribir una fila, mientras
local y pruebas conservan el seed idempotente que necesitan.

Antes de editar, leé `backend/app/seed.py`, `backend/app/core/config.py`,
`backend/railway-entrypoint.sh`, `backend/.env.production.example`,
`RAILWAY.md`, los inicializadores locales y los casos de smoke que dependen del
seed. Contrastá también qué valores de `ENV` están documentados y usados; no
inventes un bypass productivo para conservar el entorno descartable.

### Alcance y límites

- Hacé que la entrada CLI y la función que ejecuta el seed rechacen el entorno
  productivo antes de crear `SessionLocal`, consultar o escribir la base.
- El rechazo debe ser explícito, no exitoso, y no imprimir ninguna credencial
  demo. El proceso normal de migraciones y arranque no cambia.
- Local/pruebas conservan exactamente el seed actual y su segunda corrida
  idempotente. Actualizá sólo la documentación operativa que deba explicar el
  nuevo rechazo.
- No borres ni renombres las cuentas demo, no rotes credenciales existentes, no
  cambies datos, esquema, migraciones, endpoints, auth, rate limiting, Railway,
  CI, backups, CSP ni dependencias. Sin despliegue.

### Criterios de aceptación ejecutables

1. El rojo contra `e78e3d5` demuestra localmente que `ENV=production` alcanza
   el seed. No ejecutes esta reproducción contra Railway ni contra una base con
   datos reales.
2. En verde, tanto la invocación soportada `python -m app.seed` como una llamada
   directa a la función terminan con error explícito en entorno productivo antes
   de abrir la sesión. Una base local con filas centinela queda idéntica y la
   salida no contiene correos ni contraseñas demo.
3. Con el entorno local documentado, una base limpia recibe migraciones y seed;
   la segunda corrida no duplica ni pisa cuentas, datos bancarios,
   publicaciones, taxonomía o transportistas.
4. La suite completa queda al menos 131/131 desde base limpia. También quedan
   verdes compileall, build, lint y
   `git -c core.whitespace=cr-at-eol diff --check`; no hace falta repetir a11y,
   contraste ni hito porque no cambia una superficie servida.
5. Producto e informe van en commits separados. El informe incluye rojo/verde,
   punto exacto del freno, comprobación de cero acceso/escritura, valores de
   entorno admitidos y riesgo residual.

### Freno obligatorio

Frená si el entorno productivo actual no se identifica de forma inequívoca, si
alguna puerta necesita ejecutar el seed bajo ese mismo valor o si impedirlo
requiere cambiar variables/despliegues de Railway. Traé la evidencia y una sola
opción mínima; no agregues un `ALLOW_*` que pueda dejarse encendido ni toques el
entorno remoto.

Empujá producto e informe a `Memu007/yneratopgreen/main`, avisá sólo que
respondiste y frená. **No despliegues.**

## 2026-08-27 — SEC-4 `9251701`: aceptada

Acepto producto `9251701` e informe `0956e60`. PM reprodujo las dos entradas:
la CLI termina con estado 2 y la llamada directa levanta
`EntornoNoAptoParaSeed`; `production`, variantes, `prod`, `staging`, vacío y
espacios frenan antes de `SessionLocal`, mientras `local` normalizado pasa. Una
URL a un puerto muerto no produjo intento de conexión ni la salida nombró las
ocho credenciales demo. Build, lint, compileall, `pip check` y `diff-check`
quedan verdes. Base limpia, doble seed y suite 132/132 permanecen como evidencia
de Dev porque PM no tiene Docker. No hubo despliegue.

## Tarea activa única: SEC-5, el registro público no asigna administradores

### Resultado esperado y prioridad

La revisión PM atravesó `POST /api/auth/register` con una base simulada y el
payload `role: "admin"`. El endpoint respondió 201, agregó un `User` con rol
`admin` y confirmó la transacción. Después de verificar el correo, esa cuenta
tendría las mismas autorizaciones que un administrador. Es una escalada directa
y desplaza rate limiting y cualquier otra deuda.

Rojo independiente sobre `9251701`:

```text
POST /api/auth/register  -> HTTP 201
objeto agregado          -> role=admin
commit                   -> 1
```

Antes de editar, leé `backend/app/schemas/auth.py`, `backend/app/api/auth.py`,
`backend/app/models/user.py`, las dependencias y rutas administrativas,
`src/contexts/AuthContext.tsx`, `src/components/Auth/RegisterModal.tsx` y los
casos de registro, confirmación y autorización. Identificá también el único
camino autorizado actual para crear o promover administradores.

### Alcance y límites

- El rol de una cuenta creada por el endpoint público es propiedad del servidor
  y siempre queda `USER`, sea una cuenta común o transportista.
- Un payload público que intenta pedir `admin` debe rechazarse sin crear cuenta,
  token/correo de verificación, notificación ni otra escritura. La documentación
  OpenAPI no puede ofrecer `admin` como opción válida del registro público.
- Registro normal, validación de correo y login siguen funcionando. Conservá la
  compatibilidad con el frontend actual únicamente donde no debilite la regla.
- El flujo administrativo autenticado para crear o promover usuarios conserva
  su autorización y comportamiento.
- Sin migración, cambio del enum persistido, nuevos roles, rediseño de auth,
  rate limiting, seed, cookies, JWT, UI visual, Railway, datos ni dependencias.
  Sin desplegar.

### Criterios de aceptación ejecutables

1. Una regresión atraviesa el endpoint real con `role: "admin"`, falla contra
   `9251701` porque crea la cuenta, y queda verde sólo cuando la solicitud es
   rechazada antes de cualquier efecto. SQL, outbox y notificaciones confirman
   cero escritura.
2. Omitir el rol y, si se conserva por compatibilidad, enviar explícitamente
   `role: "user"` crean una cuenta `USER`; un transportista público también
   queda `USER`. El código que persiste no confía en un rol controlado por el
   cliente aunque se construya el esquema fuera del HTTP normal.
3. Tras confirmar e ingresar, una cuenta pública recibe 403 en una ruta
   administrativa. Un administrador existente conserva acceso y el único flujo
   administrativo autorizado conserva la capacidad de asignar roles.
4. El esquema OpenAPI del registro público omite `role` o lo limita únicamente
   a `user`; nunca anuncia `admin`.
5. Base limpia, migraciones, seed y suite completa quedan al menos 132/132.
   También build, lint, compileall y
   `git -c core.whitespace=cr-at-eol diff --check` quedan verdes. No hace falta
   repetir a11y, contraste ni hito si no cambia marcado visual.
6. Producto e informe van en commits separados; el informe incluye rojo/verde,
   matriz de payload/rol/efectos, OpenAPI, autorizaciones conservadas y hashes.

### Freno obligatorio

Frená si algún cliente contractual necesita elegir `admin` en el registro
público, si el único flujo administrativo también depende del mismo esquema o
si cerrar la escalada exige migrar datos. No silenciosamente ignores un valor
privilegiado sin una regresión que pruebe el rol persistido; traé una única
opción mínima.

Empujá producto e informe a `Memu007/yneratopgreen/main`, avisá sólo que
respondiste y frená. **No despliegues.**

## 2026-08-28 — SEC-5 `0a898ae`: aceptada

Acepto producto `0a898ae` e informe `278064a`.

Verificación independiente PM sobre el árbol final: `role: "admin"`,
`"ADMIN"` y `null` reciben 422 antes de ejecutar el endpoint, con cero
consultas, altas, commits, correos y notificaciones. Alta sin rol, con
`role: "user"` y de transportista responden 201 y persisten `USER`. Un
`UserRegisterRequest` construido por dentro con `ADMIN` también termina
persistido como `USER`. OpenAPI ofrece sólo `user` en el registro público. Una
cuenta común recibe 403 al crear usuarios; una cuenta administradora conserva
201 y crea `ADMIN`. Build, lint, compileall, `pip check` y `diff-check` quedan
verdes. Base limpia, migraciones, seed y suite 133/133 permanecen como evidencia
de Dev; PM reprodujo el recorrido crítico con `TestClient` y dobles sin tocar
una base real. No hubo despliegue.

Antes de una publicación hay una comprobación operativa separada: revisar en la
base que no exista un administrador creado por el registro vulnerable. No la
hagas desde esta tarea ni toques Railway o datos.

## Tarea activa única: SEC-6, frenar fuerza bruta en el login

### Resultado esperado y prioridad

`POST /api/auth/login` hoy permite intentos de contraseña ilimitados. Cerrá esa
deuda documentada sin convertirla en bloqueo permanente, sin revelar si una
cuenta existe y sin extender el cambio a registro, reenvío de correo u otras
rutas.

Antes de editar, leé `backend/app/api/auth.py`, `backend/app/core/config.py`,
`backend/railway-entrypoint.sh`, la configuración real de Railway y los casos de
login, correo, refresh y autorización. Reproducí primero que una secuencia larga
de credenciales erróneas sigue recibiendo 401 sin freno. Contrastá la topología
versionada: el entrypoint ejecuta un solo proceso Uvicorn y la documentación de
Railway identifica la IP remota con `X-Real-IP`; localmente existe
`request.client.host`. No tomes una cadena `X-Forwarded-For` controlada por el
cliente como identidad ni asumas réplicas que no verificaste.

### Política mínima

- Contá sólo fallos de credenciales que hoy responden 401: correo inexistente o
  contraseña incorrecta. Las dos situaciones conservan exactamente el mismo
  cuerpo y la misma política.
- Por correo normalizado, permití cinco fallos dentro de 15 minutos; el intento
  siguiente y los posteriores dentro de la ventana responden 429. Un login
  correcto previo al límite limpia sólo ese contador.
- Por IP, permití treinta fallos dentro de 10 minutos; el intento siguiente y
  los posteriores responden 429. Un acierto no limpia este contador, para que
  una credencial conocida no habilite un ataque de pulverización.
- El 429 trae un cuerpo genérico que no confirma cuentas y `Retry-After` con el
  tiempo restante. Al vencer la ventana, el login vuelve a evaluarse sin
  intervención. No hay bloqueo manual ni permanente.
- En Railway, la clave de IP usa el `X-Real-IP` que agrega el borde de la
  plataforma. Fuera de ese entorno usa la IP del cliente. Un
  `X-Forwarded-For` inventado no cambia el contador.

### Alcance y límites

- Implementá la pieza mínima, segura ante pedidos concurrentes y con reloj
  sustituible en pruebas; no uses esperas reales. El estado debe quedar acotado
  y retirar ventanas vencidas para no crecer sin límite.
- La configuración versionada ejecuta un proceso. No agregues Redis, Cloudflare,
  CAPTCHA, WAF, cola, servicio externo ni infraestructura. Si el servicio real
  tiene más de una réplica, o si sostener el comportamiento correcto exige
  persistencia, migración o una decisión para múltiples procesos, frená y traé
  una sola opción con evidencia; no la incorpores por tu cuenta.
- No cambies textos ni códigos actuales de 401/403, validación de correo,
  emisión/refresh/logout de tokens, cookies, JWT, esquema de sesión, roles,
  registro, UI, CORS, CSP, seed, Railway ni datos. No registres correo,
  contraseña, tokens ni cuerpos de autenticación.
- Sin desplegar y sin operar sobre la base o los administradores remotos.

### Criterios de aceptación ejecutables

1. Una regresión falla contra `0a898ae` porque al menos 31 intentos erróneos
   siguen siendo 401. En verde fija exactamente el sexto intento erróneo por
   correo y el trigésimo primero con correos distintos por IP, sin depender del
   orden de otros casos ni de un proceso que quedó vivo.
2. Correo existente con contraseña incorrecta y correo inexistente entregan la
   misma secuencia de 401/429, cuerpo y `Retry-After`. Variar mayúsculas no crea
   contadores distintos para el mismo correo.
3. Antes del límite, credenciales correctas conservan sesión, tokens, cookies y
   `last_login`; limpian el contador de correo. Al quedar limitado no se emiten
   tokens, no se actualiza `last_login` y no se imprimen credenciales.
4. Dos correos desde una IP comparten el límite de IP; un mismo correo desde
   dos IP comparte el límite de cuenta. Un `X-Forwarded-For` falso no evade el
   límite. La prueba de `X-Real-IP` diferencia explícitamente Railway de local.
5. El reloj avanza en la prueba: vencida cada ventana desaparece el 429 y las
   estructuras no retienen claves vencidas. Una prueba concurrente demuestra
   que dos pedidos simultáneos no atraviesan el umbral por una carrera.
6. Registro, confirmación/reenvío de correo, login pendiente, login inactivo,
   refresh y logout conservan sus contratos. La suite completa queda al menos
   133/133 desde base limpia.
7. Quedan verdes build, lint, compileall, `pip check` y
   `git -c core.whitespace=cr-at-eol diff --check`. No hace falta repetir a11y,
   contraste ni hito si no cambia marcado visual.
8. Producto e informe van en commits separados. El informe separa rojo y verde,
   muestra umbrales, cuenta/IP, 401/429, `Retry-After`, concurrencia, limpieza,
   regresiones y el límite explícito de reinicios o futuras réplicas.

### Freno obligatorio

Frená si la IP real no puede distinguirse sin confiar en un header falsificable,
si la implementación correcta para la topología actual exige nueva
infraestructura o migración, si el límite cambia la respuesta de cuentas
existentes frente a inexistentes o si rompe una sesión válida antes del umbral.
Traé la reproducción y una sola alternativa mínima; no amplíes a otras rutas ni
despliegues para probar.

Empujá producto e informe a `Memu007/yneratopgreen/main`, escribí el informe
completo sólo en `docs/pm/PARA-PM.md`, avisale a Emi únicamente que respondiste
y frená. **No despliegues.**

## 2026-08-28 — SEC-6 `6c24de7`: rechazada por contabilizar errores 500

No acepto todavía producto `6c24de7` ni informe `b57ae42`. La política, los
umbrales, la concurrencia y el tratamiento de IP quedan bien encaminados. PM
reprodujo build, lint, compileall, `pip check` y `diff-check`; Railway documenta
`X-Real-IP` como la IP remota y su equipo confirmó públicamente que el borde lo
sobrescribe y que la aplicación no admite acceso directo por fuera del proxy.

El bloqueo está antes de autenticar. `login_user` reserva por correo e IP y sólo
devuelve esas marcas en 403 o éxito. Si la consulta a la base falla, la excepción
sale como 500 pero las dos marcas quedan. Reproducción independiente PM con una
base doble que levanta `RuntimeError` al consultar:

```text
intentos 1–5 -> RuntimeError: base no disponible
intento 6    -> HTTP 429: Demasiados intentos de ingreso
fallos por correo = 5
fallos por IP     = 5
```

Esto contradice la política explícita de contar sólo los fallos de credenciales
que responden 401 y además puede ocultar una caída real detrás de un 429.

## Tarea activa única: SEC-6R, un 500 no consume el límite de login

### Resultado esperado y prioridad

Conservá SEC-6, pero asegurá que las reservas por correo e IP sobrevivan
únicamente cuando el resultado sea el 401 genérico por correo inexistente o
contraseña incorrecta. Cualquier excepción de infraestructura o salida distinta
de ese 401 debe liberar exactamente las marcas de ese intento, sin abrir una
carrera en el umbral.

Antes de editar, leé `backend/app/api/auth.py`,
`backend/app/services/limite_de_intentos.py` y el caso 134. Reproducí primero el
rojo de PM contra `6c24de7`. No reabras la identidad de IP: la fuente oficial es
<https://docs.railway.com/networking/public-networking/specs-and-limits> y la
garantía de sobrescritura está confirmada por Railway en
<https://station.railway.com/questions/need-authoritative-railway-client-ip-p-b7a7b4bd>.

### Alcance y límites

- Corregí únicamente el ciclo de vida de las dos reservas y agregá la regresión
  que discrimina el 500. La política, mensajes, umbrales, ventanas, identidad,
  poda y tope de claves no cambian.
- Un error de consulta, verificación de contraseña u otra excepción inesperada
  conserva su respuesta original y no deja marcas. No conviertas un 500 en 401
  o 429 y no filtres detalles nuevos al cliente.
- Los dos 401 de credenciales siguen dejando una marca por correo y una por IP;
  los 403, el éxito y cualquier otro resultado siguen sin consumir cupo.
- No cambies dependencias, esquema, migraciones, datos, frontend, Railway,
  entrypoint, headers, otras rutas ni despliegue.

### Criterios de aceptación ejecutables

1. Una regresión provoca un fallo de base dentro del flujo real de login, falla
   contra `6c24de7` porque el sexto pedido termina en 429 y queda verde con la
   corrección: seis intentos conservan el mismo 500 original y los contadores de
   correo e IP quedan en cero.
2. La misma regresión demuestra que no se emitieron tokens, cookies ni cambios
   de `last_login`, y que la respuesta no expone la excepción.
3. Correo inexistente y contraseña incorrecta siguen consumiendo exactamente
   una marca en cada dimensión; 403, éxito y 500 no consumen ninguna. El sexto
   401 por correo y el trigésimo primero por IP siguen dando 429 con el mismo
   cuerpo y `Retry-After`.
4. La prueba concurrente de SEC-6 conserva cero pedidos atravesando un contador
   lleno y exactamente uno cuando queda un lugar. La corrección no puede dejar
   marcas huérfanas ni devolver marcas de otro pedido.
5. Registro, confirmación/reenvío, login pendiente/inactivo, refresh y logout
   conservan contrato. La suite completa queda al menos 135/135 desde base
   limpia; build, lint, compileall, `pip check` y
   `git -c core.whitespace=cr-at-eol diff --check` quedan verdes.
6. Producto e informe van en commits separados. El informe incluye el rojo
   exacto, el verde, contadores después del 500, umbrales conservados,
   concurrencia, regresiones, riesgos y hashes.

### Freno obligatorio

Frená si liberar una excepción exige debilitar la reserva atómica, si no se
puede distinguir de forma estable el 401 que sí cuenta o si la corrección
requiere cambiar el contrato público. Traé la reproducción y una sola opción
mínima; no agregues infraestructura ni despliegues para probar.

Empujá corrección e informe en commits separados a
`Memu007/yneratopgreen/main`, escribí la respuesta completa sólo en
`docs/pm/PARA-PM.md`, avisale a Emi únicamente que respondiste y frená. **No
despliegues.**

## 2026-08-28 — SEC-6 y SEC-6R: aceptadas

Acepto producto `6c24de7`, corrección `8b806ca` e informes
`b57ae42`/`1f1902c`.

Verificación independiente PM sobre el árbol final: seis pedidos con una sesión
que levanta `OperationalError` atraviesan la aplicación real y devuelven seis
500 con `Internal Server Error`, sin `Set-Cookie`, con cero marcas por correo y
cero claves por IP. Con una sesión sana que no encuentra el usuario, la secuencia
sigue siendo cinco 401 y un 429, quedan cinco marcas por correo, una clave por IP
y `Retry-After: 900`. Build, lint, compileall, `pip check` y `diff-check` quedan
verdes. Base limpia, migraciones, seed, concurrencia y suite 135/135 permanecen
como evidencia de Dev porque PM no tiene Docker/PostGIS. No hubo despliegue.

Los límites residuales quedan explícitos: memoria de un proceso, reinicio que
borra contadores y futura réplica que exigiría un almacén compartido. No se abre
esa infraestructura mientras la topología versionada siga siendo un solo
Uvicorn.

## Tarea activa única: OPS-1, identificar el commit desplegado

### Resultado esperado y prioridad

El próximo ensayo debe poder demostrar si Frontend, Backend y `main` corresponden
al mismo commit. Hoy `/api/health` devuelve una versión fija y el Frontend no
expone ninguna revisión; eso permitió que una interfaz reciente conviviera con
un Backend viejo sin una señal inequívoca. Incorporá una identidad de build
exacta y verificable, sin cambiar la interfaz ni desplegar.

Antes de editar, leé `backend/app/main.py`, `backend/app/core/config.py`,
`vite.config.ts`, `index.html`, los Dockerfiles/entrypoint y la documentación de
despliegue. Railway documenta que `RAILWAY_GIT_COMMIT_SHA` contiene el SHA del
commit que disparó el despliegue:
<https://docs.railway.com/variables/reference>.

### Alcance y límites

- El Backend expone en `/api/health` la revisión completa de 40 caracteres que
  recibió del entorno y la registra al arrancar junto con versión y entorno.
- El artefacto estático del Frontend incorpora esa misma revisión en una señal
  pública y automatizable —por ejemplo metadata del documento o un recurso
  estático— sin agregar texto visible, consola ni otra superficie de diseño.
- Una construcción local sin variable conserva build y arranque con un valor
  explícito que no pueda confundirse con un commit real. Un valor configurado
  válido se conserva byte por byte; no lo recortes para la evidencia.
- No agregues dependencias, endpoints de diagnóstico con secretos, lectura de
  `.git` en runtime, llamadas a GitHub, cambios visuales, Railway, Docker,
  autenticación, datos, migraciones ni despliegue. No actualices por intuición
  la versión comercial `1.0.0`.

### Criterios de aceptación ejecutables

1. Una regresión falla contra `8b806ca` porque Backend y Frontend no publican
   ninguna revisión. En verde, construí ambos con un SHA sintético fijo de 40
   hexadecimales y recuperalo exactamente desde `/api/health`, el log de inicio
   y el artefacto estático del Frontend.
2. Las tres representaciones coinciden byte por byte y no exponen ninguna otra
   variable del entorno. El health conserva estado, servicio, versión y entorno,
   y las cabeceras defensivas de SEC-3.
3. Sin la variable, desarrollo y pruebas siguen funcionando y muestran un valor
   inequívocamente no productivo; nunca una cadena vacía que pueda aprobarse por
   error ni un SHA inventado a partir de la hora.
4. La evidencia incluye el comando exacto que, tras un futuro despliegue,
   comparará `git rev-parse main`, la revisión del Frontend y la del Backend. En
   esta tarea sólo se demuestra localmente; no se toca el entorno remoto.
5. La suite completa queda al menos 136/136 desde base limpia. También quedan
   verdes build, lint, compileall, `pip check` y
   `git -c core.whitespace=cr-at-eol diff --check`; no hace falta repetir a11y,
   contraste ni hito porque no cambia la presentación visible.
6. Producto e informe van en commits separados. El informe incluye rojo/verde,
   las tres revisiones obtenidas, ausencia de filtración, contratos conservados,
   riesgo residual y hashes.

### Freno obligatorio

Frená si Railway no entrega la variable durante alguno de los dos builds, si el
Frontend y Backend pueden recibir commits distintos bajo la configuración real,
si exponer la identidad obliga a mostrarla visualmente o si una carga CLI no
puede asociarse de forma honesta a un commit. Traé la evidencia y una sola opción
mínima; no inventes un SHA, no relajes la comparación y no despliegues para
probar.

Empujá producto e informe en commits separados a
`Memu007/yneratopgreen/main`, escribí la respuesta completa sólo en
`docs/pm/PARA-PM.md`, avisale a Emi únicamente que respondiste y frená. **No
despliegues.**

## 2026-08-30 — UX-COH-1 `f716264`: ubicación aceptada, ingreso incompleto

Acepto la solución de ubicación y el inventario exploratorio. El contrato
`publication_location`, la comparación relacional con SQL, la degradación sin
localidad, la privacidad y la ausencia de N+1 de localidades están bien
resueltos. PM reprodujo build, lint, compileall y `diff-check`; Docker está
apagado en su entorno, por lo que 138/138 y las puertas visuales permanecen como
evidencia informada por Dev.

No acepto todavía el ingreso directo como cierre general. `App` entrega
`abrirLoginYVolver` sólo al `ProductGrid` de Mercado. `HomePage` y
`ServicesPage` también renderizan `ProductCard`, pero no reciben ni pasan
`onSolicitarIngreso`; desde sus vistas previas, el mismo detalle vuelve al
toast sin salida. El caso 138 entra únicamente por `?section=marketplace`, por
eso no discrimina esta omisión.

La decisión de apartar el detalle mientras Login está abierto es correcta: un
solo diálogo evita dos trampas de foco y conserva la continuidad al volver.

## Tarea activa única: UX-COH-1R, una sola puerta de ingreso en todas las tarjetas

### Resultado esperado

Toda instancia real de `ProductCard` —Mercado, Inicio y Servicios— usa el mismo
recorrido de autenticación. Una acción de compra sin sesión nunca agrega en
silencio ni termina en un toast sin salida: ofrece ingresar, abre el Login real
y vuelve al mismo contexto sin crear carrito, orden, reserva o pago.

Al quedar autenticada, la persona ve un rótulo que describe la acción real. Para
la anatomía `activo`, reemplazá «Iniciar operación» por **«Agregar al carrito»**:
hoy ése es exactamente su efecto y no existe otro inicio de operación detrás.
`Agregar` para insumo, `Contratar` para servicio/logística y `Solicitar
cotización` sin precio conservan su semántica actual.

### Alcance y límites

- Pasá la continuidad de Login desde `App` a las vistas previas de Inicio y
  Servicios, además de Mercado. Reutilizá la misma función y el mismo Login; no
  dupliques estado ni formularios.
- Aplicá la regla también al CTA primario de la tarjeta, no sólo al detalle. El
  hallazgo B3 queda autorizado: tarjeta y detalle deben comportarse igual.
- Cancelar o completar Login vuelve a la misma página y publicación. Si el
  detalle estaba abierto, vuelve a ese detalle; si la acción salió de la
  tarjeta, vuelve a esa tarjeta/página. No ejecutes automáticamente la compra.
- Corregí sólo el rótulo de `activo` en la fuente central de acciones. No
  reescribas copy de otras anatomías ni cambies layout.
- No toques nuevamente ubicación, API, Backend, seed, datos, órdenes, pagos,
  Mercado Pago, Railway, navegación del botón atrás ni los hallazgos B2/B4/C1–C3.
  **No despliegues.**

### Criterios de aceptación ejecutables

1. Una regresión contra `f716264` abre un detalle desde Inicio y otro desde
   Servicios y demuestra que una acción de compra anónima no abre Login. En
   verde, toda instancia de `ProductCard` que puede comprar ofrece el mismo
   ingreso directo.
2. El CTA primario de una tarjeta comprable sin sesión abre Login; nunca agrega
   al carrito silenciosamente. Cancelar y completar conservan página,
   publicación y cero efectos. Tras autenticarse, hace falta un nuevo clic.
3. En Mercado, Inicio y Servicios hay un solo `role=dialog` a la vez. Escape,
   cierre y cambio Login↔Registro no pierden la continuidad ni dejan un callback
   viejo que reabra otra publicación en un ingreso posterior desde el Header.
4. Un activo autenticado muestra «Agregar al carrito» y ese clic agrega; ya no
   existe «Iniciar operación» asociado a `addItem`. Las demás anatomías
   conservan rótulo y destino.
5. La suite completa queda al menos 139/139 desde base limpia y la regresión
   enumera las tres ubicaciones reales de `ProductCard`; no prueba sólo Mercado.
   Build, lint, compileall, `pip check`, a11y, contraste, hito y
   `git -c core.whitespace=cr-at-eol diff --check` quedan verdes.
6. Producto e informe van en commits separados. El informe incluye rojo contra
   `f716264`, recorridos de las tres páginas, tarjeta y detalle, cancelación,
   login exitoso, ausencia de efectos, diálogos/foco, rótulos por anatomía,
   regresiones y hashes.

### Freno obligatorio

Frená si una vista previa no contiene una publicación comprable y la prueba
necesita alterar el seed para fabricarla, si la continuidad exige apilar
diálogos o si unificar la acción obliga a cambiar autenticación. Traé la
evidencia y una alternativa mínima; no uses esperas o selectores frágiles para
forzar verde.

Empujá corrección e informe en commits separados a
`Memu007/yneratopgreen/main`, respondé sólo en `docs/pm/PARA-PM.md`, avisale a
Emi únicamente que respondiste y frená. **No despliegues.**

## 2026-08-28 — OPS-1 `c7f480d`: aceptada

Acepto producto `c7f480d` e informe `a0a6eec`.

Verificación independiente PM sobre el árbol final: el build local sin variable
publica `sin-revision-local`; con el SHA sintético
`0123456789abcdef0123456789abcdef01234567`, el metadata del Frontend,
`/api/health` y el log de inicio del Backend conservan exactamente los mismos 40
caracteres. El health mantiene sus cinco campos, las cinco cabeceras defensivas
y no expone otras variables. Build, lint, compileall, `pip check` y
`diff-check` quedan verdes. La suite 136/136 y la construcción completa en
contenedores permanecen como evidencia de Dev porque PM no dispone de Docker o
Podman. No hubo despliegue.

El `ARG RAILWAY_GIT_COMMIT_SHA` del Dockerfile queda aceptado como excepción
necesaria al límite original: Railway exige declarar con `ARG` las variables
que deben estar disponibles durante un build Docker. No agrega dependencias,
no altera la interfaz visible y no concede autoridad para tocar Railway. La
comprobación real de que los dos servicios reciben la revisión correcta queda
pendiente del ensayo remoto.

## 2026-08-30 — OPS-1, ensayo remoto aceptado

PM desplegó exactamente `main` `aff5a602877800418a24885874620bfce5266de2`
en el Railway descartable. GitHub, el metadata público del Frontend y
`/api/health` del Backend publicaron los mismos 40 caracteres; ambos servicios
quedaron en `SUCCESS` y `MP_CHECKOUT_HABILITADO=false`. No se ejecutó seed ni
se modificaron variables, pagos, usuarios, órdenes, PostGIS o datos.

## Tarea activa única: UX-COH-1, recorridos coherentes antes del pulido final

### Hallazgo reproducido y prioridad

La captura de Emi no demuestra que el filtro SQL esté mezclando provincias:
el selector y la URL tenían `province=Buenos Aires`. La API filtró por
`Product.locality_id`, pero la tarjeta de «Rastra de Discos 24 Platos» mostró
«Córdoba, Argentina» porque el listado sólo devuelve `seller.location` y
`ProductCard` lo presenta como si fuera la ubicación de la publicación.

PM reprodujo en el Railway descartable:

- Maquinaria + Buenos Aires devuelve la rastra y la cosechadora, cuyos orígenes
  declarados son Balcarce, Buenos Aires;
- la rastra pertenece a un vendedor cuyo perfil dice Córdoba;
- Maquinaria + Córdoba devuelve la pulverizadora de Río Cuarto;
- por eso el filtro de base está bien encaminado y la representación pública
  es incoherente. La ubicación que decide el filtro no sale en la respuesta.

Esto bloquea la aceptación visual: una persona no puede verificar qué filtró
si la tarjeta le muestra otro dato bajo el mismo concepto.

Hay un segundo corte confirmado por Emi: una persona sin sesión abre el detalle
y pulsa «Iniciar operación»; el sistema sólo muestra «Tenés que ingresar» en un
toast sin acción. Detecta correctamente el requisito, pero deja a la persona en
un callejón sin salida aunque el Login ya existe y el Header sabe abrirlo.

### Resultado esperado

El catálogo y el detalle muestran como **ubicación de la publicación** la
localidad y provincia oficiales que ya viven en `Product.locality_id`. La
ubicación del vendedor sigue siendo un dato distinto y nunca puede sustituir
ni rotularse como origen del producto o servicio.

Además, el CTA principal del detalle ofrece un ingreso directo cuando falta
sesión. Debe abrir el Login existente, conservar el detalle y la publicación
elegida y, al autenticar, devolver a ese contexto. No agrega automáticamente al
carrito ni inicia una operación sin un segundo gesto consciente.

### Alcance y límites

- Extendé las respuestas de listado y detalle con una ubicación de publicación
  estructurada, derivada del padrón `Locality`: identificador y nombres de
  localidad/provincia. No expongas domicilio exacto ni parsees texto libre.
- Resolvé la localidad en la consulta ya existente; no agregues una consulta
  por tarjeta ni otro N+1. Los registros legacy sin `locality_id` deben degradar
  sin 500 y sin inventar una provincia.
- En Frontend, tipá y convertí ese dato sin reutilizar `seller.location`.
  Tarjeta y modal de detalle deben mostrar primero localidad y luego provincia.
- Conservá la semántica actual del filtro: provincia y localidad siguen
  aplicándose en Backend antes de contar y paginar. Al cambiar provincia, una
  localidad incompatible sigue limpiándose.
- El dato del vendedor puede mantenerse dentro de su bloque claramente
  identificado; no es el dato que aparece como ubicación de la operación.
- Para una persona anónima, el CTA no debe terminar en un toast sin salida:
  rotulalo de forma honesta y abrí el Login existente. Reutilizá el estado y el
  modal de autenticación de `App`; no crees otro formulario ni otra sesión.
- Tras login exitoso se conserva abierto el mismo detalle. No agregues al
  carrito automáticamente, no simules una reserva y no alteres login, refresh,
  logout, tokens o permisos.
- No cambies seed, datos, migraciones, precios, stock, pagos, Mercado Pago,
  Railway, diseño general, búsqueda, ordenamiento ni paginación. No despliegues.

### Auditoría exploratoria obligatoria — Extra, pero acotada

Antes de editar, recorré en una base Docker descartable los caminos reales de
persona anónima, compradora, vendedora, transportista y administradora. Cubrí
Inicio → Mercado → filtros → detalle → login/registro → carrito/checkout;
publicación de producto/servicio; selección logística; estados vacío, carga y
error; vuelta atrás, URL directa, teclado, `1440×900` y `390×844`.

Buscá contradicciones, datos con el rótulo equivocado, CTAs muertos, requisitos
que sólo avisan sin ofrecer salida, pérdida de contexto, estados sin siguiente
paso y acciones que prometen algo inexistente. No uses la auditoría para
rediseñar, cambiar copy por gusto, sumar animaciones o ampliar el MVP.

Implementá solamente los dos defectos ya autorizados —ubicación e ingreso
directo—. El resto se entrega como inventario priorizado en `PARA-PM.md` con:
severidad P0/P1/P2, rol, recorrido, pasos, esperado/real, evidencia, alcance
mínimo propuesto y riesgo. No corrijas hallazgos adicionales hasta decisión de
PM/Emi.

### Criterios de aceptación ejecutables

1. Una regresión falla contra `aff5a602`: demuestra que una publicación de
   Balcarce vendida por una cuenta de Córdoba sale sin ubicación de publicación
   y la tarjeta termina mostrando Córdoba. En verde, API y UI muestran
   «Balcarce, Buenos Aires» y el vendedor conserva Córdoba sólo como dato suyo.
2. Para cada provincia probada, los IDs devueltos por la API coinciden con la
   consulta SQL equivalente sobre `products.locality_id` y `localities`; no se
   fijan cantidades que envejezcan con el catálogo.
3. Cada elemento devuelto con `province=X` informa `X` como provincia de la
   publicación. La UI presenta ese mismo valor; no deriva ubicación desde el
   vendedor ni desde una cadena separada por comas.
4. La URL directa hidrata el selector correcto. Cambiar entre Córdoba y Buenos
   Aires actualiza URL, consulta, conteo y tarjetas de forma coherente, sin
   conservar una localidad de la provincia anterior.
5. Listado y detalle conservan privacidad: sólo localidad/provincia de la
   publicación; ningún domicilio, teléfono o contacto nuevo.
6. Sin sesión, el CTA visible dice que el paso siguiente es ingresar y abre el
   Login real. Cancelarlo vuelve al mismo detalle; completarlo vuelve al mismo
   detalle autenticado. En ninguno de los dos casos se agrega al carrito ni se
   crea orden, reserva o pago sin un nuevo clic.
7. La auditoría adjunta matriz de los cinco roles y todos los recorridos
   indicados. Cada hallazgo tiene evidencia y prioridad; observaciones
   cosméticas o preferencias quedan separadas y no cuentan como defectos.
8. La suite completa queda al menos 138/138 desde base limpia y agrega los
   casos relacionales de ubicación y continuidad de login. También quedan
   verdes build, lint, compileall,
   `pip check` y `git -c core.whitespace=cr-at-eol diff --check`.
9. Producto e informe van en commits separados. El informe incluye rojo/verde,
   respuesta API antes/después, comparación con SQL, recorridos Córdoba/Buenos
   Aires, continuidad del Login, ausencia de efectos silenciosos, ausencia de
   N+1, privacidad, inventario UX, regresiones y hashes.

### Freno obligatorio

Frená si la consulta real demuestra que los IDs filtrados no coinciden con SQL,
si hay publicaciones activas sin localidad que exijan decidir una migración o
si corregir el contrato público rompe un consumidor no identificado. Traé la
reproducción y una sola alternativa mínima; no repares datos ni amplíes UX.
También frená si conservar el detalle debajo del Login rompe el foco o exige
anidar diálogos de forma inaccesible: proponé una única continuidad mínima en
vez de ocultar el problema con otro toast.

Empujá producto e informe en commits separados a
`Memu007/yneratopgreen/main`, escribí la respuesta completa sólo en
`docs/pm/PARA-PM.md`, avisale a Emi únicamente que respondiste y frená. **No
despliegues.**
