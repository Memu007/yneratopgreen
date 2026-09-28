# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## COBRO-CONCURRENTE-1: entrega

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `704c70e` (tu último commit al asignar; la asignación es `a7e2237`) |
| producto | `5893d19` |
| casos y negativos | `a6dbdb7` y `599dded` |
| tus commits de `docs/pm` | `08d8ef2`, traídos con un merge (`15d37b9`); no tocan código |
| no integrado, no desplegado | `main` sigue en `a7e2237` |

**Resultado.**

- **Ningún camino de la API espera una fila tomada frenando el proceso.**
  Ocho lo hacían. Los ocho esperan ahora con `candado.tomar`: `NOWAIT` en un
  savepoint, reintento con `await asyncio.sleep` y un tope de 10 s. Es la
  dirección que aceptaste.
- **El 213 entra a la suite y corre siempre.** Si una carrera vuelve a colgar
  la API, el caso la destraba antes de irse y el resto sigue.
- **Las reglas se mantienen**, y ahora las mira un caso:
  - el link se apaga con la fila tomada (el 214 la ve tomada mientras el
    cierre está retenido);
  - el stock se consolida una vez;
  - sale un solo par de avisos, y el link se apaga una sola vez.
- **Al tope, nadie queda colgado:**
  - el aviso recibe 503 `orden_ocupada`, y Mercado Pago lo reintenta;
  - la vuelta recibe «en proceso», con `verificado: false`;
  - «Cancelar» y «Rechazar» reciben un 409: «Esta orden se está actualizando
    en este momento. Probá de nuevo en unos segundos.»;
  - el reconciliador anota `ocupada` y sigue con la próxima orden.
- **Suite completa desde base nueva, sobre `599dded`: 218/219.** Sólo cae
  el 131, de entorno.

**Dos cosas que cambian más allá de «esperar sin frenar». Las cuento para que
las revises; ninguna suelta la fila.**

1. **El link se apaga antes de aplicar, no después.** Sigue con la fila de la
   orden tomada y en la misma transacción. Aplicar consolida el stock, y eso
   toma la fila de la publicación hasta el `commit`. Con el orden de antes,
   esa fila quedaba tomada mientras se esperaba a Mercado Pago. Medido: otra
   compra de la misma publicación que se confirmaba en ese momento colgaba la
   API (218, primera parte). La condición para apagar es la misma: con
   intentos guardados, `hay_cobro` es verdadero si y sólo si aplicar iba a
   devolver un estado con cobro.
2. **Después de conseguir la fila se relee lo que se leyó antes.** Mientras se
   esperaba, otra confirmación pudo terminar. Sin releer, la ráfaga dejaba
   cuatro pares de avisos (negativo `orden-vieja`) o apagaba el link cuatro
   veces (negativo `intencion-vieja`).

**Fuera del cobro, el mismo arreglo, chico.** El inventario encontró cuatro
lugares más con el mismo patrón: editar una publicación, subirle fotos,
borrarle una foto y presentar la documentación. Usan el mismo
`candado.tomar`, y al tope responden un 409 que pide probar de nuevo. Cada
uno tiene su negativo.

**Lo que decidís vos:** nada bloqueante. Hay dos propuestas en «Riesgos»: el
toast genérico de «Cancelar» y el reintento del reconciliador.

## El inventario

**Comando.** Recorre `backend/app` con el AST de Python, y es el 219:

```bash
SMOKE_CASOS=219 node scripts/smoke.mjs
```

Busca todo `with_for_update()` y toda llamada a `candado.tomar`. Anota en
qué función está, si es `async` y qué `async def` la llaman. Da rojo si alguno
espera con el bloqueo de siempre desde un camino `async`, salvo que tenga su
porqué escrito en el caso. El negativo `inventario-ve-el-bloqueo` lo prueba.

**Sobre la base** (el mismo guion del 219 contra `git archive 704c70e backend/app`):

| lugar | función | qué hice |
|---|---|---|
| `services/cobro.py:506` | `async procesar_pago` (el aviso) | `candado.tomar`, y relee la intención |
| `services/cobro.py:553` | `async sincronizar` (la vuelta y el reconciliador) | lo mismo |
| `api/orders.py:710` | `async update_order_status` («Rechazar» por estado) | `candado.tomar`; 409 al tope |
| `api/orders.py:849` | `async cancel_order` («Cancelar», y el «Rechazar» de la pantalla) | lo mismo |
| `api/products.py:445` | `async upload_product_images` | `candado.tomar`; 409 al tope |
| `api/products.py:506` | `async update_product` | lo mismo |
| `api/products.py:764` | `async delete_product_image` | lo mismo |
| `api/documentacion.py:256` | `async presentar_documentacion` | lo mismo |
| `services/cobro.py:244` | `_guardar_intento` (síncrona, la llaman las tres de arriba y `cerrar_cobro`) | nada: se llama con la fila de la orden ya tomada, y el intento de un pago es de esa orden |
| `reconciliar.py:139` | `async _una` | nada: corre en otro proceso, una orden a la vez; su espera no frena a la API |
| `api/orders.py:371` | `decide_transfer_receipt` | nada: endpoint síncrono, FastAPI lo corre en un hilo aparte |
| `api/documentacion.py:446` | `decidir` | lo mismo |

**Hoy el 219 dice:** «9 lugares toman una fila: 5 esperan sin frenar, 2 son
endpoints síncronos que FastAPI corre en un hilo, y 2 tienen su porqué escrito
(reconciliar.py:146 _una, services/cobro.py:244 _guardar_intento)». Los 5 son
las cuatro llamadas a `candado.tomar` y el `NOWAIT` de adentro.

## Casos

Todos retienen en el doble la espera a Mercado Pago que se hace con la fila
tomada: el cierre del link o la búsqueda del reconciliador. Recién entonces
mandan lo demás, así la carrera no depende de que dos pedidos caigan en el
mismo instante. Mientras está retenida, la salud tiene que contestar en menos
de 2 s, una consulta tras otra.

| caso | qué mira | contra el backend de la base |
|---|---|---|
| 213 | Tu P1: dos avisos y una vuelta del mismo pago a la vez | rojo: «la API dejó de responder: 21 de 23 consultas de salud tardaron 2 s o más» |
| 214 | Ráfaga: tres avisos y tres vueltas a la vez. Terminan todas con 200; una transición, el stock y lo reservado bajan uno, las ventas suben una, un «Pago aprobado» y un «Venta pagada», el link apagado **una** vez y con la fila tomada, un solo intento guardado | rojo: la API se cuelga y nada queda escrito (11 problemas) |
| 215 | «Cancelar» y «Rechazar» contra una confirmación, en los dos órdenes de llegada (cuatro órdenes). La orden cobrada queda pagada, con su reserva consolidada y un par de avisos. Quien cancela o rechaza recibe el 409 de orden cobrada, o el 400 de «paid → rejected» si llega por estado después del pago | rojo en la primera escena: «Cancelar» con el aviso esperando cuelga la API |
| 216 | El reconciliador sostiene la fila (búsqueda retenida) y llega un aviso. La salud y el catálogo responden. Al soltarlo, el aviso da 200 y la orden queda pagada | rojo: «4 de 20 consultas de salud tardaron 2 s o más» y el catálogo no respondió en 2 s |
| 217 | El tope: con la fila tomada más de 10 s, lo que recibe cada camino (arriba). Reintentar el aviso da «repetido», y la vuelta dice «aprobado» | rojo: la API se cuelga |
| 218 | Otra compra de la misma publicación se confirma entera mientras la primera espera a Mercado Pago. Con la publicación y la documentación tomadas por otro proceso, editar, subir y borrar una foto, y presentar la documentación esperan sin frenar y terminan con 200 o 201 | rojo: la segunda compra cuelga la API y la fila de la publicación está tomada |
| 219 | El inventario, por código | rojo: 8 lugares frenan |

El 212 dejó de decir que las simultáneas cuelgan la API: ahora remite al 213.

## Negativos

`python3 scripts/sabotajes_cobro_concurrente_1.py` rompe un solo lugar,
reinicia la API con `REINICIAR_API`, corre el caso y restaura. Los 15 dan su
rojo, y «src y backend después: como estaban».

- **13 en la corrida completa**, sobre `a6dbdb7`.
- **Los otros 2 fallaban por mis expectativas, no por el producto.** En el
  216, el catálogo sin respuesta es el mismo cuelgue. Sin tope, quienes
  esperan no quedan colgados: pasan el tope. Corregí lo que esperaba el
  script, y el 217 ahora dice cuándo se esperó más que el tope (`599dded`).
  Corridos de nuevo esos dos: «todos dieron el rojo esperado».

| sabotaje | rojo |
|---|---|
| `aviso-sin-espera` | 213: «la API dejó de responder: 21 de 23 consultas de salud tardaron 2 s o más» |
| `aviso-contra-el-reconciliador` | 216: la API sin responder (5 de 9 consultas) y el catálogo sin respuesta en 2 s |
| `vuelta-sin-espera` | 214: «la API dejó de responder durante la ráfaga: 20 de 24…», y nada queda escrito |
| `cancelar-sin-espera` | 215: «el aviso, y llega «Rechazar» (la cancelación de quien vende): la API dejó de responder». Las escenas anteriores pasan |
| `rechazar-sin-espera` | 215: «la vuelta, y llega «Rechazar» por estado: la API dejó de responder». Las anteriores pasan |
| `link-con-la-fila-suelta` | 214: «mientras se apagaba el link, la fila de la orden estaba suelta», y el link se apagó 4 veces |
| `stock-tomado-en-la-espera` (el orden de antes: aplicar y después apagar) | 218: la segunda compra no se confirma en 10 s, la fila de la publicación está tomada y la API se cuelga |
| `intencion-vieja` (sin releer la intención) | 214: «el link se apagó 4 veces» |
| `orden-vieja` (sin releer la orden) | 214: cuatro «Pago aprobado» y cuatro «Venta pagada» |
| `sin-tope` (tope de una hora) | 217: los que esperaban pasan el tope («esperaron 15577 ms») y reciben «repetido», «aprobado», el 409 de orden cobrada y el 400 en vez de lo que se puede reintentar |
| `editar-sin-espera` | 218: «con la publicación tomada por otro proceso, editar la publicación congeló la API» |
| `subir-foto-sin-espera` | 218: «…subirle una foto congeló la API» |
| `borrar-foto-sin-espera` | 218: «…borrarle una foto congeló la API» |
| `documentacion-sin-espera` | 218: «con la documentación tomada por otro proceso, presentarla de nuevo congeló la API» |
| `inventario-ve-el-bloqueo` | 219: «1 lugar(es) esperan la fila con el bloqueo que frena la API: api/products.py:527 async update_product» |

`sin-tope` muestra algo que conviene saber: **sin tope, nadie queda colgado
para siempre.** Esperan hasta que al que tenía la fila se le vence la llamada
a Mercado Pago (15 s), y entonces siguen. El tope es para que cada camino
conteste antes, y con algo que se pueda reintentar.

**Avisos de entorno, antes de que los encuentres:**

- los sabotajes que cuelgan la API tardan unos 50 s cada uno, y todo el
  script tardó 8 minutos acá;
- `REINICIAR_API` también lo usa el caso, como último recurso, si no puede
  destrabar la API cortando las esperas en la base. En tu entorno:
  `REINICIAR_API="docker restart topgreen-api"`;
- el 218 sostiene filas desde otro proceso con
  `docker exec -i topgreen-api python`, como ya hace el reconciliador;
- la línea `ERROR: could not obtain lock on row in relation …` en la salida
  es de `ordenBloqueada` y `filaTomada`, que preguntan con `NOWAIT`, igual
  que el 99. No es un rojo.

## Cómo verificarlo

Con el entorno arriba y la siembra demo:

```bash
SMOKE_CASOS=213,214,215,216,217,218,219 node scripts/smoke.mjs
# → 7/7 pasaron; 0 fallaron   (40 s acá; el 217 espera el tope a propósito)

REINICIAR_API="docker restart topgreen-api" python3 scripts/sabotajes_cobro_concurrente_1.py
# → todos dieron el rojo esperado
# → src y backend después: como estaban
```

## Puertas

| puerta | resultado |
|---|---|
| suite completa desde base nueva, sobre `599dded` | **218/219**. Sólo cae el **131**, de entorno: «puente docker: sólo se traduce 'docker exec'». Pasan del 213 al 219, y el 96, el 98, el 99, el 100 y el 212 |
| lint, `tsc --noEmit`, build | verdes (lint sin avisos) |
| `compileall`, `pip check`, `node --check` | verdes; «No broken requirements found.» |
| `alembic check` | «No new upgrade operations detected.» Sin migraciones |
| diff-check con `cr-at-eol` | limpio sobre `704c70e..599dded`. Se respetaron los CRLF de `orders.py` y `products.py` |
| a11y, contraste, auditoría móvil, guías | **no corridas**: no cambia nada visible. `src/` no se tocó, y los textos nuevos son de la API |

## Riesgos

- **Esperas implícitas.** El inventario mira `with_for_update()`. Un `UPDATE`
  también espera una fila tomada, y hay dos que corren en el proceso de la API
  sobre la fila de la publicación: la reserva del checkout y la consolidación
  del cobro. No cuelgan porque ningún camino de la API tiene esa fila tomada
  mientras espera algo: eso es lo que arregló el cambio de orden, y el 218 lo
  mira.
  - **Queda un borde, sin reproducir.** El reconciliador (otro proceso), si no
    pudo apagar el link, lo reintenta en `_una` después de consolidar, y lo
    hace con la fila de la publicación tomada. Si Mercado Pago falla dos
    veces seguidas en ese barrido, una compra de esa publicación podría frenar
    la API hasta 15 s.
  - **Propuesta:** en `_una`, no reintentar si `sincronizar` ya lo intentó en
    ese barrido; queda para el próximo. No lo hice: cambia el reconciliador.
- **Conexiones.** Quien espera la fila conserva su conexión a la base (pool
  de 10 + 20). Más de 30 esperando la misma fila a la vez agotaría el pool, y
  la petición siguiente esperaría hasta 30 s por una conexión. Mercado Pago
  no manda tantos avisos del mismo pago. Sin reproducir.
- **La pantalla no muestra el 409 nuevo.** «Cancelar» y «Rechazar» en Mis
  Compras y Mis Ventas muestran «Error al cancelar el pedido» o «Error al
  rechazar el pedido» ante cualquier error. Pasa lo mismo hoy con el 409 de
  orden cobrada. **Propuesta (P3):** mostrar el mensaje de la API.
- **La vuelta al tope** dice «Mercado Pago está procesando el pago» y deja de
  preguntar, como con cualquier estado que no sea «pendiente». Debajo sale
  «No pudimos confirmarlo con Mercado Pago recién», porque no está verificado.
  Es lo que pediste.
- **El tope (10 s) es menor que lo que puede tardar quien tiene la fila:**
  hasta 15 s por llamada a Mercado Pago, y «Cancelar» hace dos. Con Mercado
  Pago lento, quien espera recibe la respuesta de tope y reintenta. Es a
  propósito.

---

## AVISOS-DE-PAGO-1

Aceptada en rama sobre `c6792ff` y publicada en `a7e2237`. Sin cambios.
