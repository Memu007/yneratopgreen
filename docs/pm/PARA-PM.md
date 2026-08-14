# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-14. Quinto informe: **los seis bordes de MP-C**.

Los seis eran reales. Ninguno era una interpretación distinta de la consigna ni
un caso que la suite no cubría por descuido: eran seis agujeros, y cuatro de
ellos podían perder plata o mercadería. Los arreglé y les puse una regresión
discriminante a cada uno.

Empiezo por lo que más te va a interesar: **no discutí ninguno**. El único
lugar donde te voy a decir que la corrección no puede ser la que pediste
textualmente es el punto 6, y no porque esté en desacuerdo con el diagnóstico
—que es correcto— sino porque el intercalado que proponías para probarlo mide,
si se lo fuerza tal cual, una carrera distinta de la que el candado arregla.
Está explicado en la sección 6, con lo que hice en su lugar.

## 1. La primera preferencia fallida ya no deja una reserva inmortal

Tenías razón en el diagnóstico completo, incluido el detalle del `JOIN`.

`crear_ordenes()` confirmaba orden y reserva, y la fila de `payments` nacía
después, con la respuesta de Mercado Pago. Si la preferencia fallaba —timeout,
rechazo permanente— quedaba una orden `RESERVADA` sin ninguna fila de pago, y
`_candidatas()` la excluía por su `JOIN payments`. Esa mercadería no volvía
nunca.

Ahora la intención de pago **y su plazo** se escriben en la misma transacción
que la reserva, antes de cualquier efecto externo:

```python
stock.reservar(db, orden, pedido.items)
db.add(Payment(
    order_id=orden.id,
    total_amount=orden.total_amount,
    status=PaymentStatus.PENDING,
    expires_at=mp_preferencia.vencimiento_de(),
))
```

Y `preparar_pago()` dejó de fabricar un plazo nuevo: usa el que ya está
escrito. Si calculara otro, el link podría vivir más que la reserva, que es
exactamente lo que la vigencia oficial vino a evitar.

El `JOIN` además pasó a ser `outerjoin`: una reserva sin fila de pago tiene que
aparecer en el barrido, no desaparecer. Hoy no debería existir ninguna; queda
como red para una fila vieja o una escritura a medias, porque el costo de
mirarla es cero y el de no mirarla es mercadería comprometida para siempre.

## 2. El aviso se autentica antes de leer el cuerpo, y la URL pide Webhooks

Dos cosas separadas, y en las dos tenías razón.

**La URL.** Tenía escrito que Mercado Pago degrada a IPN cuando la
`notification_url` lleva parámetros, y por eso el validador prohibía toda query
y el caso 86 consagraba esa regla. La documentación vigente dice lo contrario:
hay que agregar `source_news=webhooks` para recibir **exclusivamente** Webhooks.
Mi regla no sólo estaba mal fundada: dejaba la integración recibiendo lo que
Mercado Pago quisiera mandar.

Quedó así: la base se declara sin query —el validador la sigue rechazando, pero
ahora por el motivo correcto, que es que ese parámetro lo decide el código y no
el entorno— y `url_de_aviso()` le agrega el oficial y nada más. Una variable de
entorno no puede pisarlo ni sumarle ruido a una URL pública.

**El orden.** El endpoint leía el cuerpo entero antes de validar y `_dato()`
aceptaba el `data.id` del cuerpo como respaldo. Eso contradecía el contrato que
yo mismo había escrito arriba del archivo: si el cuerpo puede elegir qué pago
se consulta, la firma no está protegiendo lo que dice proteger.

Ahora el identificador sale **sólo** de la URL, la firma se valida contra eso y
los headers, y `await pedido.json()` ocurre recién después de autenticar. Sin
`data.id` en la URL el aviso no se puede autenticar y devuelve 401 sin haber
mirado el cuerpo ni consultado la cuenta de nadie.

## 3. Una orden de Mercado Pago cobrada ya no se cancela

`venia_pagada=True` salteaba el 409. Era al revés de lo que corresponde: que el
pago se hubiera acreditado antes no vuelve la orden más cancelable, la vuelve
intocable. Con esa excepción, comprador o vendedor la dejaban terminal y el
inventario volvía al catálogo mientras la plata seguía en la cuenta del
vendedor.

Ahora hay dos cortes:

1. antes de hablar con Mercado Pago, si ya sabemos que hay cobro acreditado,
   409 sin tocar nada;
2. y si el cobro aparece recién al apagar el link, 409 también.

Además saqué la restauración de stock del camino de Mercado Pago. Por
transferencia sigue igual —ahí el descuento es real y se devuelve—; por Mercado
Pago una orden cobrada no llega hasta ahí, y una sin cobrar tiene su mercadería
reservada, no descontada, así que ya la soltó el cierre del cobro.

## 4. El vendedor no puede quitar stock ya reservado

`PATCH /products/{id}` no miraba `stock_reservado` y no bloqueaba la fila.
Después `consolidar()` recortaba con `greatest(..., 0)` y la falta quedaba
escondida: el comprador que ya había pagado se quedaba sin la mercadería y en
la base no había ni rastro de que faltara.

Ahora la fila se toma con `FOR UPDATE` al entrar —así la edición y la reserva
se serializan sobre el mismo número, en vez de leer las dos lo mismo y pisarse—
y todo `stock` explícito por debajo de lo reservado se rechaza con 400 y con el
número a la vista, para que el vendedor sepa cuál es el piso y por qué.

## 5. La preferencia se apaga al primer cobro

Tenías razón: un link de Checkout Pro no se muere cuando se cobra. Lo apago
apenas entra el primer pago acreditado, con la misma operación oficial que ya
usaba la cancelación.

Como apagarlo es una llamada que puede fallar, hacía falta saber si quedó
hecho: `payments.link_cerrado`. Si falla, el pago se registra igual —perder el
aviso por no haber podido apagar un link sería cambiar un problema chico por
uno grande— y el reconciliador lo reintenta. Por eso ahora entran al barrido
también órdenes ya cobradas: su reserva está consolidada y por reserva no
entrarían nunca, y sin embargo son las más urgentes.

Y para dos aprobados distintos: estado `EN_REVISION`. No consolida stock dos
veces —lo que decide eso es el `UPDATE` condicional de la reserva, no la
cantidad de pagos—, no devuelve plata sola, conserva los dos identificadores en
`mp_intentos_de_pago` y lo dice con las mismas palabras al comprador y al
vendedor.

## 6. El candado del reconciliador

El diagnóstico es correcto y lo arreglé: `sincronizar()` hacía `commit` y con
eso soltaba el candado, y `_una()` decidía y cerraba sin haberlo recuperado.
Ahora `sincronizar(confirmar=False)` deja la transacción abierta con el candado
puesto, `_una()` lo vuelve a tomar explícitamente —porque `sincronizar` puede
salir antes de tomarlo— y hay un solo dueño transaccional con un solo `commit`
por camino.

Acá va lo que te debo, porque preferís enterarte por mí:

> «Forzá un webhook aprobado entre la búsqueda vacía y el cierre.»

Lo intenté tal cual y **no mide el candado**. Si se congela la respuesta de la
búsqueda que decide, el resultado es que el código *con* candado queda peor que
el de antes: el webhook queda bloqueado, no llega a escribir, el reconciliador
ve la respuesta congelada, no ve cobro, libera, y recién después el webhook
aplica. El código sin candado «pasa» ese escenario por accidente, porque el
webhook alcanza a escribir antes de que el reconciliador mire la base.

Congelar esa respuesta es simular que Mercado Pago contestó «no hay pagos»
después de que el pago existía, que es la carrera irreducible que ya está
documentada como riesgo abierto, no la que el candado arregla.

Lo que sí mide el candado, y es lo que hace el caso 99: retener la **segunda**
búsqueda —la que decide si se suelta la mercadería—, comprobar con
`FOR UPDATE NOWAIT` desde afuera que la fila está bloqueada en ese instante, y
recién ahí meter el pago y el aviso. Sin la corrección la fila está libre y el
caso se pone rojo en esa línea. Con la corrección el aviso espera, la búsqueda
que decide ya encuentra el pago, y la orden termina pagada y consolidada en vez
de vencida.

Si querés el otro escenario igual —el congelado— decímelo y lo agrego, pero lo
agrego sabiendo que lo que documenta es el riesgo 5, no el candado.

## 7. Las regresiones

Seis casos nuevos, uno por punto, más los 86–93 intactos.

| Caso | Qué retiene o fuerza |
|---|---|
| 94 | preferencia inservible → orden reservada sin link; vence y el barrido libera una vez |
| 95 | `data.id` sólo en el cuerpo → 401 sin consultar; cuerpo cruzado → se consulta el de la URL; `source_news=webhooks` puesto por el código |
| 96 | orden cobrada: cancelar como comprador y como vendedor, los dos 409, inventario quieto |
| 97 | stock por debajo de lo reservado → 400; edición normal y borde exacto; y la edición con un checkout retenido a mitad |
| 98 | link apagado al primer cobro; cierre caído + reintento del barrido; dos aprobados distintos → «en revisión» |
| 99 | fila bloqueada durante la búsqueda que decide, con el pago entrando en esa ventana |

Las dos de concurrencia retienen el intercalado con pausas soltables del doble
—`pausarLaPreferencia`, `pausarLaBusqueda({ desde, referencia })`— y no con dos
llamadas sueltas esperando que caigan en orden. La de la búsqueda se pide **por
referencia de orden**: el barrido pasa por todas las candidatas, así que contar
búsquedas a secas retenía la de cualquier otra, y el caso pasaba en verde sin
haber medido nada. Me lo comí en la primera corrida.

Con el producto vuelto a `9fa0eaf` y esta suite en su lugar —el esquema **no**
se baja: las dos cosas que agrega esta entrega, `link_cerrado` y el valor
`EN_REVISION`, no le molestan al código viejo, que sencillamente no las usa—:

```
94  la orden quedó reservada y sin ninguna fila de pago
95  un aviso con el id sólo en el cuerpo devolvió 200
96  la API no respondió HTTP 409   (una orden cobrada se cancelaba)
97  la API no respondió HTTP 400   (se podía quitar stock ya reservado)
98  la preferencia siguió viva después de cobrar
99  el reconciliador soltó el candado entre preguntar y decidir
0/6 pasaron; 6 fallaron
```

Cada mensaje nombra el defecto, no un síntoma lateral: eso es lo que quería
poder mostrarte.

## 8. Puertas

Corridas al final, sobre la base reseteada, migrada y sembrada de cero.

| Puerta | Resultado |
|---|---|
| Suite completa | **99 de 99**, 0 fallas |
| Hito intermedio | **6 de 6** pasos encadenados |
| `npm run build` | `tsc` sin errores; 82 módulos, 385,34 kB (113,38 kB gzip) |
| Accesibilidad | **58 de 58** pantallas, 0 serious ni critical |
| Contraste | **42 de 42** mediciones, 0 textos por debajo del mínimo |
| Migración ida y vuelta con datos | **44 productos, 69 órdenes, 35 pagos** intactos en los dos sentidos |
| `alembic check` | «No new upgrade operations detected» |
| `git diff --check` (con `cr-at-eol`) | limpio |

Accesibilidad y contraste dijiste que sólo si cambia DOM visible. Lo que cambié
son dos textos nuevos dentro de elementos que ya existían, sin marcado ni estilo
nuevo, así que estrictamente no cambia; los corrí igual para traerte el número
en vez de traerte el argumento.

Y la ida y vuelta, otra vez con lo que se pierde dicho por mí: **los 19
`link_cerrado` en verdadero vuelven a falso**, porque bajar borra la columna y
subir la recrea con su default. No es reversible en el sentido de conservar ese
dato, y la consecuencia es benigna y conocida: el reconciliador va a reintentar
apagar links que ya estaban apagados, que es idempotente. Lo que no se pierde
es ningún cobro, ningún intento y ningún estado de orden.

Las cuatro fallas que tuvo la corrida anterior, porque la corrida limpia sola no
cuenta la historia:

- **91 era una regresión mía de verdad.** `SessionLocal` tiene
  `autoflush=False`, así que el `db.refresh()` que agregué en `_una` descartaba
  el `status = PAID` que `sincronizar` había dejado en memoria: el barrido
  informaba «cobrada» y la orden se quedaba en `placed`. Exactamente el estado
  falso que el punto 6 pedía evitar, metido por el arreglo del punto 6. Se
  corrige con un `flush()` antes de releer.
- **76 y 77** afirmaban que una preferencia fallida no deja fila de pago, que es
  lo que el punto 1 mandó cambiar. No borré las aserciones: ahora comprueban que
  la fila existe, es una sola, está en `PENDING` y **vacía de Mercado Pago**
  —sin preferencia y sin link—. Que exista es lo que hace que la reserva pueda
  vencer; que esté vacía es lo que prueba que nada quedó a medias.
- **94 era mía**, por comparar valores absolutos de stock reservado en una base
  con compras vivas de otros casos. Me pasó tres veces en este ciclo antes de
  aprender a medir siempre en diferencias.

## 9. Lo que sigue impidiendo encender producción

Los ocho riesgos del informe anterior siguen en pie, con dos correcciones:

- el riesgo 5 —una orden cancelada puede recibir un pago— ahora tiene nombre y
  estado: si el cobro llega sobre una reserva ya liberada, no se tapa;
- se suma uno nuevo: apagar el link es una llamada más adentro del candado de
  la orden. Con este volumen no molesta; con volumen alto hay que sacar el
  cierre a un trabajo aparte, igual que la cancelación.

Y una cosa que hice sin que la pidieras, porque era un hueco de lo que entregué
la vez pasada: `backend/.env.production.example` no tenía ninguna de las cuatro
claves de MP-C —ni el secreto del webhook— y su comentario decía que todavía no
existía el webhook firmado. Están agregadas, todas vacías, con la bandera en
`false`. Si te parece alcance de más, se saca en un commit.

## 10. Dos que encontré yo, revisando lo que ya te había entregado

Mientras esperaba tu respuesta me puse a revisar el diff como si fuera tuyo.
Aparecieron dos, las dos mías, y las dos ya subidas con su rojo medido.

**`_resumen` contaba los cobros vivos, no los que ocurrieron.** Con dos pagos
aprobados sobre la misma orden y una devolución posterior de uno, el conteo
bajaba a uno, ganaba la precedencia de devolución, y la orden quedaba diciendo
«devuelto»: limpio, cerrado, y con un cobro todavía en pie. El vendedor habría
leído que le devolvieron todo. Es el mismo error que me marcaste en tu punto 5,
una capa más abajo: resumir dos cobros como uno.

Ahora se cuentan por identificador los que estuvieron aprobados, devueltos o con
contracargo, y ese conteo se mira **antes** que cualquier otra precedencia. La
plata que ya se movió no deja de haberse movido porque una parte volvió. El caso
98 lo fija: sin el arreglo se pone rojo con «devolver uno de los dos cobros dejó
la orden en devuelto».

**Y le pisé los finales de línea a `UserDashboard.tsx`.** El archivo es mixto
—2891 líneas con CRLF y 218 con LF— y al agregarle el texto del estado nuevo
quedó normalizado entero. El agregado son siete líneas; el diff mostraba 443.
Doscientas dieciocho de esas no las escribí yo, y un diff que toca lo que nadie
tocó no se puede revisar. Cada línea que ya existía recuperó su terminador.

Ninguna de las dos cambia lo que te conté arriba. Las digo porque el trabajo no
termina cuando el push sale verde, y porque prefiero que las leas acá y no que
las encuentres.

Puertas después de las dos: suite **99 de 99**, hito **6 de 6**, build limpio,
`alembic check` sin operaciones nuevas y `diff --check` limpio.
