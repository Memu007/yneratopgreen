# Reproducción PM — COBRO-CONCURRENTE-1

Fecha: 2026-09-28. Base `704c70e` (la asignación es `a7e2237`).

- Código: `5893d19`.
- Casos 213 a 219 y negativos: `a6dbdb7` y `599dded`.
- Informe: `94e333d`. Difiere de `599dded` sólo en `docs/pm`. El merge
  `15d37b9` trae sólo `docs/pm` de PM.

`main` está en `a7e2237`. **Aceptada en rama**, sin integración ni
despliegue.

## Qué cambia

Es el P1 que PM confirmó el 27/09: tres confirmaciones a la vez del mismo pago
de Mercado Pago colgaban la API hasta reiniciarla.

- **Ningún camino de la API espera una fila tomada frenando el proceso.**
  Pide la fila con `NOWAIT` adentro de un savepoint. Si está tomada, reintenta
  después de un `await asyncio.sleep` que empieza en 50 ms y llega a 500 ms,
  con un tope de 10 s (`services/candado.py`).
- **Son ocho lugares:**
  - el aviso de Mercado Pago, la vuelta de quien compra, «Rechazar» y
    «Cancelar»;
  - fuera del cobro, con el mismo arreglo: editar una publicación, subirle
    fotos, borrarle una foto y presentar la documentación.
- **Al tope, cada camino contesta algo que se puede reintentar:**
  - el aviso, 503 `orden_ocupada`, y Mercado Pago lo reintenta;
  - la vuelta, «en proceso» sin verificar;
  - «Cancelar» y «Rechazar», 409 «Esta orden se está actualizando en este
    momento. Probá de nuevo en unos segundos.»;
  - la publicación y la documentación, un 409 del mismo tipo;
  - el reconciliador anota `ocupada` y sigue con la próxima orden.
- **El link se apaga antes de aplicar, no después**, siempre con la fila de la
  orden tomada. Aplicar consolida el stock y toma la fila de la publicación.
  Con el orden de antes, esa fila quedaba tomada mientras se esperaba a
  Mercado Pago.
- **Después de conseguir la fila se relee la orden y la intención de pago**:
  mientras se esperaba, otra confirmación pudo terminar.

## Revisión del código

- **El candado.** Un «fila tomada» (`55P03`) deshace sólo el savepoint, y la
  transacción sigue sana. Cualquier otro error se propaga. La fila queda
  tomada hasta el `commit` o el `rollback`, como con el bloqueo de antes.
- **Apagar antes de aplicar no cambia cuándo se apaga.** PM comprobó la
  equivalencia en el código:
  - `aplicar` devolvía un estado con cobro (aprobado, devuelto, contracargo o
    en revisión) si y sólo si algún intento está aprobado, devuelto o con
    contracargo;
  - eso mismo pregunta `hay_cobro`;
  - sin intentos, o con la intención anulada y un intento pendiente, no
    contestan que hay cobro ni `aplicar` ni `hay_cobro`.
- **`hay_cobro` ve lo que se guardó en la misma transacción**, aunque la
  sesión no escriba sola antes de consultar:
  - el intento nuevo se escribe con `flush`;
  - el que cambia de estado es la misma instancia que vuelve la consulta.
- **Ninguna petición espera algo con la fila de una publicación o de la
  documentación tomada.**
  - Editar, borrar una foto y presentar la documentación no tienen ningún
    `await` entre tomar la fila y el `commit`.
  - Subir fotos guarda los archivos antes de tomarla.
- **«Cancelar» y «Rechazar».** La única espera con la orden tomada es
  `cerrar_cobro`, que llama a Mercado Pago antes de tocar el stock.
- **Diff-check con `cr-at-eol`** limpio sobre `704c70e..599dded`. En
  `orders.py` y `products.py`, las líneas nuevas de zonas CRLF conservan su
  terminador.

## Resultados PM

Base PostGIS recién creada, API nativa reiniciada en el código entregado (un
solo proceso), frontend de desarrollo y configuración local inventada.

| Verificación | Resultado |
|---|---|
| Casos 213 a 219 | **7/7** en 39 s. Ver abajo |
| Negativos de la Dev (15) | **15 rojos esperados**, cada uno por su motivo; «src y backend después: como estaban». Detalle abajo |
| Negativo PM 1, `pm-espera-que-frena`: la espera entre intentos vuelve a ser `time.sleep` | **rojo** en el 213: «con una confirmación esperando a Mercado Pago, la API dejó de responder: 8 de 12 consultas de salud tardaron 2 s o más» |
| Negativo PM 2, `pm-sin-savepoint`: el `NOWAIT` sin savepoint | **rojo** en el 214: «los avisos respondieron 200 aplicado, 500, 500» y «las vueltas respondieron 500, 500, 500». La API siguió respondiendo |
| Suite completa desde base recién creada | **218/219** en 23 minutos. Sólo cae el **131**, de entorno: «puente docker: sólo se traduce 'docker exec'». Pasan del 213 al 219, el 96 al 100, el 169 y el 212 |
| `guia-admin.mjs` y `guia-usuario.mjs` después de la suite | «LA GUÍA Y EL PANEL COINCIDEN: 26 pasos» y «LA GUÍA Y EL SITIO COINCIDEN: 22 pasos», en escritorio y celular |
| Build, tipos, lint, `compileall`, `pip check`, `node --check`, `alembic check` | verdes; «No broken requirements found.» y «No new upgrade operations detected.» Sin migraciones |
| Diff-check `704c70e..599dded` con `cr-at-eol` | limpio |
| `PRE_FIRMA.md`, `.env` o secretos en el delta | ninguno |

Lo que dijo cada caso:

- **213:** «las tres confirmaciones terminaron con 200 y la salud contestó 11
  veces, la peor en 97 ms, mientras una esperaba a Mercado Pago».
- **214:** tres avisos y tres vueltas con 200; la salud contestó 11 veces, la
  peor en 149 ms. La orden quedó pagada una vez; el stock y lo reservado
  bajaron uno y las ventas subieron una. Hay un «Pago aprobado» y un «Venta
  pagada», y el link se apagó una sola vez.
- **215:** las cuatro órdenes cobradas quedaron pagadas. «Cancelar» y
  «Rechazar» recibieron 409, o 400 si llegaron por estado después del pago,
  con la salud entre 7 y 23 ms.
- **216:** con el reconciliador sosteniendo la fila, la salud contestó 9
  veces, la peor en 117 ms, y el catálogo respondió. Al soltarlo, el aviso
  terminó con 200, la orden quedó pagada y el stock bajó uno.
- **217:** a los 10.188 ms:
  - el aviso recibió 503 `orden_ocupada`;
  - la vuelta, «en proceso» sin verificar;
  - «Cancelar» y «Rechazar», el 409 que pide probar de nuevo.

  La salud contestó 99 veces, la peor en 58 ms. Reintentar el aviso dio
  «repetido», y la vuelta, «aprobado».
- **218:**
  - la segunda compra se confirmó mientras la primera esperaba, con la salud
    en 52 ms como peor;
  - editar, subir y borrar una foto esperaron la publicación y terminaron con
    200;
  - presentar la documentación terminó con 201.
- **219:** «9 lugares toman una fila: 5 esperan sin frenar, 2 son endpoints
  síncronos que FastAPI corre en un hilo, y 2 tienen su porqué escrito».

Los negativos de la Dev, con el reinicio por omisión
(`./scripts/entorno_nativo.sh --reiniciar-api`):

| Sabotaje | Rojo |
|---|---|
| `aviso-sin-espera` | 213: «la API dejó de responder: 21 de 23 consultas de salud tardaron 2 s o más» |
| `aviso-contra-el-reconciliador` | 216: la API sin responder (4 de 7 consultas) y «el catálogo respondió nada en 2 s» |
| `vuelta-sin-espera` | 214: la API sin responder (20 de 23), las seis confirmaciones sin terminar en 30 s, la orden «placed» |
| `cancelar-sin-espera` | 215, en «el aviso, y llega «Rechazar»»: la API sin responder (19 de 20) |
| `rechazar-sin-espera` | 215, en «la vuelta, y llega «Rechazar» por estado»: la API sin responder (19 de 20) |
| `link-con-la-fila-suelta` | 214: «mientras se apagaba el link, la fila de la orden estaba suelta», y el link se apagó 4 veces |
| `stock-tomado-en-la-espera` | 218: la API sin responder (22 de 23), la segunda compra sin confirmar en 10 s y la fila de la publicación tomada |
| `intencion-vieja` | 214: «el link se apagó 4 veces» |
| `orden-vieja` | 214: cuatro «Pago aprobado» y cuatro «Venta pagada» |
| `sin-tope` | 217: el aviso respondió «200 repetido», la vuelta «aprobado», «Cancelar» el 409 de orden cobrada y «Rechazar» el 400, en vez de lo que se puede reintentar |
| `editar-sin-espera` | 218: «editar la publicación congeló la API» |
| `subir-foto-sin-espera` | 218: «subirle una foto congeló la API» |
| `borrar-foto-sin-espera` | 218: «borrarle una foto congeló la API» |
| `documentacion-sin-espera` | 218: «presentarla de nuevo congeló la API» |
| `inventario-ve-el-bloqueo` | 219: «api/products.py:527 async update_product» |

**Después de cada rojo la API volvió sola.** En los cinco que la colgaban, el
caso la destrabó cortando las esperas en la base, sin reiniciarla. Es el punto
4 de la aceptación: si una carrera vuelve a colgar la API, el rojo queda en su
caso y el resto de la suite sigue.

Los dos negativos de PM atacan el candado mismo, que ningún negativo de la Dev
toca: los de ella devuelven el bloqueo de antes a cada camino. El primero
comprueba que la salud mide que el bucle no se frene, y no sólo que la base no
espere. El segundo comprueba que los casos miran qué contesta cada
confirmación, y no sólo que la API siga viva.

## Decisiones PM sobre el informe

- **Se acepta apagar el link antes de aplicar.** No suelta la fila de la
  orden, así que no era un «frená y consultá». La condición para apagar es la
  misma (ver «Revisión del código»). El 214 y el 218 lo miran, cada uno con su
  negativo.
- **Se aceptan los cuatro lugares fuera del cobro.** Son el mismo arreglo y
  chico, cada uno con su negativo. La tarea lo permitía sin consultar.
- **Se aceptan el tope de 10 s y lo que contesta cada camino al cumplirlo.**
- **P2, antes de habilitar Mercado Pago, en la pieza del pago a una orden
  cerrada.** Es el borde del reconciliador que declaró la Dev:
  - si Mercado Pago falla dos veces seguidas en el mismo barrido, `_una`
    reintenta apagar el link con la fila de la publicación tomada;
  - una compra de esa publicación puede frenar la API hasta 15 s.

  PM lo confirmó leyendo el código, sin reproducirlo. Se acepta la propuesta
  de la Dev: `_una` no reintenta si `sincronizar` ya lo intentó en ese
  barrido.
- **P3, a la lista:**
  - ante el 409 nuevo, «Cancelar» y «Rechazar» muestran «Error al cancelar el
    pedido» o «Error al rechazar el pedido». Pasa lo mismo hoy con el 409 de
    orden cobrada. Propuesta de la Dev: mostrar el mensaje de la API;
  - **(PM)** al subir fotos, si se cumple el tope, los archivos ya quedaron
    guardados sin su fila. Pasa lo mismo hoy cuando falla la validación de un
    segundo archivo;
  - **(PM)** ningún caso mira el camino «ocupada» del reconciliador. El 217
    cubre el aviso, la vuelta, «Cancelar» y «Rechazar». El código es un
    `rollback` y un `return`.
- **Riesgo aceptado:** más de 30 esperas de la misma fila a la vez agotarían
  el pool de conexiones. Mercado Pago no manda tantos avisos del mismo pago.
  Sin reproducir.
- **No se corrieron a11y, contraste ni la auditoría móvil.** `src/` no
  cambió, y los textos nuevos son de la API y la pantalla no los muestra (ver
  el P3). Las dos guías sí se corrieron, después de la suite.

## Límites del entorno PM

- El reinicio que sugiere el informe (`docker restart topgreen-api`) no
  aplica: la API de PM es nativa. Se usó el de omisión,
  `./scripts/entorno_nativo.sh --reiniciar-api`.
- La red de PM no llega a `railway.app`.

No se tocó `main`, Railway ni datos reales.
