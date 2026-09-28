# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## PAGO-ORDEN-CERRADA-1: entrega

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `b5a7944` (tu asignación) |
| producto | `c1e7f0c` |
| casos y negativos | `b3b5f3c` |
| no integrado, no desplegado | `main` sigue en `58bb62b` |

Lo hice desde el entorno en la nube: esta pieza no necesita el sitio publicado.

**Resultado.**

- **Los dos motivos de revisión se distinguen**, en la API y en la pantalla
  de las dos partes.
  - Con la orden cerrada, la API dice `pago_tras_cierre` y no `en_revision`.
    El panel de las dos partes y la vuelta de Mercado Pago dicen lo que
    pasó.
  - «Más de un pago» queda para dos cobros, como en el 98.
- **Un aviso a cada parte, una sola vez por orden y por motivo.** Hay uno
  para el pago en un pedido cerrado y otro para más de un pago.
  - Lo decide el aviso ya escrito, leído con la fila de la orden tomada. Por
    eso no importa por dónde llegue el pago, ni cuántas veces.
  - Va en un savepoint, como en `AVISOS-DE-PAGO-1`: si el aviso falla, el
    pago queda.
- **La orden cerrada queda como antes:** pagada, en revisión y sin volver a
  tomar stock. El 220 lo mira, y ya pasaba antes del cambio.
- **El P2, con tu propuesta:** el reconciliador intenta apagar el link una sola
  vez por barrido, y ya no espera a Mercado Pago con la fila de una publicación
  tomada.
- **Sin migraciones.** Los dos tipos de aviso nuevos son valores de una
  columna de texto, y el estado visible nuevo se calcula de lo que ya hay: la
  intención `EN_REVISION` y la reserva `LIBERADA`.
- **Suite completa desde base nueva, sobre `b3b5f3c`: 221/222.** Sólo cae
  el 131, de entorno. Auditorías y las dos guías, verdes.

**Lo que decidís vos (o Emi):**

1. **Los textos.** Están completos abajo, para que los lean.
2. **«Devolvé el pago desde Mercado Pago».** Lo pediste así, y no lo pude
   comprobar en el producto: es una operación de Mercado Pago, no de
   AgroBoeda. Si preferís otra forma de decirlo, la cambio.
3. **Un efecto del P2 que tenés que saber.** Si apagar el link falla, ahora
   queda abierto hasta el barrido siguiente, en vez de reintentarse en el
   mismo. El reconciliador todavía no está programado en ningún lado, así que
   «el barrido siguiente» es el próximo que alguien corra. Mientras tanto, el
   link de una orden cobrada se puede volver a pagar.

## Los textos nuevos

**Avisos.** Cada uno sale una vez por orden, a esa parte.

| motivo | a quién | título | mensaje |
|---|---|---|---|
| pago con la orden ya cerrada | quien compra | Pago en un pedido cerrado | «Mercado Pago acreditó un pago de tu pedido #N cuando ya estaba cerrado. La plata está en la cuenta de Mercado Pago del vendedor. Coordiná con el vendedor si te entrega la compra o te devuelve el pago.» |
| lo mismo | quien vende | Pago en un pedido cerrado | «Mercado Pago acreditó un pago del pedido #N cuando ya estaba cerrado, y la plata está en tu cuenta de Mercado Pago. La mercadería había vuelto a tu catálogo y no se descontó. Si todavía la tenés, podés entregarla; si no, devolvé el pago desde Mercado Pago.» |
| más de un pago | quien compra | Más de un pago en tu pedido | «Mercado Pago acreditó más de un pago de tu pedido #N. La plata está en la cuenta de Mercado Pago del vendedor. Coordiná con el vendedor para que te devuelva lo que pagaste de más.» |
| lo mismo | quien vende | Más de un pago en un pedido | «Mercado Pago acreditó más de un pago del pedido #N, y la plata está en tu cuenta de Mercado Pago. Devolvé el pago de más desde Mercado Pago.» |

En la pestaña «Notificaciones», los dos llevan el rótulo «Pago a revisar».

**Pantalla, con la orden ya cerrada:**

- en Mis Compras y Mis Ventas, el mismo texto para las dos partes: «Mercado
  Pago acreditó un pago cuando esta orden ya estaba cerrada. La mercadería
  había vuelto al catálogo y no se descontó. La plata está en la cuenta de
  Mercado Pago del vendedor: comprador y vendedor tienen que acordar si se
  entrega la compra o si el vendedor devuelve el pago desde Mercado Pago.»;
- en la vuelta de Mercado Pago, quien compra lee el título «Tu pago llegó con
  la orden ya cerrada» y debajo: «Mercado Pago acreditó el pago, pero esta
  orden ya estaba cerrada y la mercadería había vuelto al catálogo. La plata
  está en la cuenta de Mercado Pago del vendedor: coordiná con el vendedor si
  te entrega la compra o te devuelve el pago.»

**Por qué son verdad.** Lo que afirman sale del código:

- la orden cerrada tiene la reserva liberada, y aplicar no vuelve a tomar
  stock;
- la plata la cobra la cuenta vinculada de quien vende;
- quien vende puede confirmar una orden pagada desde Mis Ventas, así que
  «podés entregarla» existe.

Ninguno dice «Pago aprobado», «Venta pagada» ni «comisión», y ninguno dice
que AgroBoeda devuelva nada.

**La regla de los avisos que prometen devoluciones.** `revisarAviso`, de
`NOTIF-TEXTOS-1`, daba rojo con cualquier «devol». Ahora deja pasar sólo
estas cuatro frases exactas, en las que devuelve quien vende:

- «devolvé el pago desde Mercado Pago»;
- «Devolvé el pago de más desde Mercado Pago»;
- «si te entrega la compra o te devuelve el pago»;
- «para que te devuelva lo que pagaste de más».

Cualquier otra forma sigue dando rojo.

## Casos

Los tres usan cuentas nuevas, las dos, y una cuenta de Mercado Pago del doble
por corrida. Así los avisos nuevos no aparecen en la pestaña de las cuentas
que el 211 y el 212 leen enteras.

| caso | qué mira | contra el producto de la base |
|---|---|---|
| 220 | Tres órdenes cerradas: cancelada por quien compra, rechazada por quien vende y vencida por el reconciliador. Después llega el pago, con dos avisos y dos vueltas. La orden queda pagada, en revisión y sin volver a tomar stock. Cada parte tiene un solo aviso de pago en un pedido cerrado y ningún «Pago aprobado». El panel de las dos partes, en escritorio y celular, y la vuelta de Mercado Pago dicen el texto nuevo | rojo, 29 problemas: la API dice `en_revision`, no hay avisos y la pantalla dice «más de un pago». Nada del estado de la orden |
| 221 | Dos cobros, con dos avisos y dos vueltas del segundo. Las dos partes ven `en_revision`, tienen un aviso de más de un pago y uno del primer pago, y el stock no se vuelve a descontar | rojo: 0 avisos de más de un pago |
| 222 | El reconciliador encuentra una orden cobrada sin aviso y apagar el link falla. Si hubiera un segundo intento, el doble lo retiene. Mientras tanto se confirma otra compra de la misma publicación. Hay un solo intento por barrido, la salud responde, la otra compra se confirma y el barrido siguiente apaga el link | rojo: dos intentos en el mismo barrido, la API deja de responder y la otra compra no se confirma en 10 s |

**Siguen en verde**, corridos juntos antes de la suite: 96, 98, 99, 100, 210,
211, 212 y del 213 al 219. Salida: «14/14 pasaron; 0 fallaron».

## Negativos

`python3 scripts/sabotajes_pago_orden_cerrada_1.py`: «todos dieron el rojo
esperado» y «src y backend después: como estaban», los 8 en la primera
corrida.

| sabotaje | rojo |
|---|---|
| `orden-cerrada-dice-pago-aprobado` | 220: «tiene 0 veces el aviso del pago en un pedido cerrado» y «además tiene ["Pago aprobado \| …"]», en las tres escenas. Nada del estado |
| `api-dice-mas-de-un-pago` | 220: la vuelta y las dos partes ven «en_revision»; el panel y la vuelta dicen «más de un pago» |
| `panel-dice-mas-de-un-pago` (sólo `UserDashboard.tsx`) | 220: «Mis Compras: dice «más de un pago»» y lo mismo en Mis Ventas, en los dos anchos. La API sigue bien |
| `vuelta-dice-mas-de-un-pago` (sólo `PaymentResultPage.tsx`) | 220: «la vuelta de Mercado Pago no dice «Tu pago llegó con la orden ya cerrada»» |
| `aviso-dos-veces` | 220: «tiene 3 veces el aviso del pago en un pedido cerrado», las dos partes en las tres escenas |
| `sin-aviso-de-mas-de-un-pago` | 221: «tiene 0 veces el aviso de más de un pago», las dos partes |
| `aviso-que-falla` | 220: faltan los avisos, y **la orden igual queda pagada y en revisión**: el savepoint salva el pago |
| `reconciliador-reintenta` (el `_una` de antes) | 222: «intentó apagar el link 2 veces en el mismo barrido», «la API dejó de responder (7 de 9…)», «la otra compra … no terminó en 10 s» |

**Aviso de entorno.** Los sabotajes de pantalla los toma el servidor de
desarrollo de Vite solo. El script reinicia la API con `REINICIAR_API`, por
omisión `./scripts/entorno_nativo.sh --reiniciar-api`, que es el que usás.

## Cómo verificarlo

Con el entorno arriba y la siembra demo:

```bash
SMOKE_CASOS=220,221,222 node scripts/smoke.mjs
# → 3/3 pasaron; 0 fallaron   (unos 50 s)

python3 scripts/sabotajes_pago_orden_cerrada_1.py
# → todos dieron el rojo esperado
# → src y backend después: como estaban
```

## Puertas

| puerta | resultado |
|---|---|
| suite completa desde base nueva, sobre `b3b5f3c` | **221/222**. Sólo cae el **131**, de entorno: «puente docker: sólo se traduce 'docker exec'». Pasan el 98, el 212, del 213 al 219 y del 220 al 222 |
| lint, `tsc --noEmit`, build | verdes (lint sin avisos) |
| `compileall`, `pip check`, `node --check` | verdes; «No broken requirements found.» |
| `alembic check` | «No new upgrade operations detected.» |
| diff-check con `cr-at-eol` | limpio sobre `b5a7944..b3b5f3c` |
| a11y `--todas` | «80 de 80 pantallas exigidas», 0 violaciones |
| contraste | «88 de 88 mediciones exigidas», ninguna por debajo del mínimo |
| auditoría móvil | 12 de 12 recorridos: 0 desbordes, 0 controles tapados, 0 errores de consola, 0 respuestas 4xx/5xx. Las capturas no se suben |
| `guia-admin.mjs` | «LA GUÍA Y EL PANEL COINCIDEN: 26 pasos en escritorio y celular» |
| `guia-usuario.mjs` | «LA GUÍA Y EL SITIO COINCIDEN: 22 pasos en escritorio y celular» |

**Las guías no nombran los estados del pago**, así que no las toqué. Lo
busqué en `docs/USER_MANUAL.md` y `docs/GUIA-PANEL-ADMIN.md`: Mercado Pago
figura como «todavía no disponible».

## Riesgos

- **Orden cerrada y además dos cobros.** La pantalla dice el texto de la orden
  cerrada, que es el que no miente sobre la mercadería. Salen los dos avisos,
  el de pedido cerrado y el de más de un pago. No hay caso para esa
  combinación.
- **El link que no se pudo apagar queda abierto hasta el barrido siguiente**
  (arriba, en «Lo que decidís vos»).
- **«Mercadería»** se dice también cuando la publicación es un servicio. Los
  textos que ya existían hacen lo mismo.
- **El panel de administración no ve estos pagos.** Está fuera de alcance. Si
  hace falta que los vea, lo propongo como pieza propia.

---

## PUBLICACIONES-PRUEBA-1

Aceptada sobre `c635acb`. Las 16 siguen publicadas hasta que Emi pida
pausarlas. Sin cambios.
