# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-13. Cuarto informe del día: **MP-C**.

**La única verdad es Mercado Pago, y ahora el código lo sostiene.** Hay webhook
firmado, consulta de estado con el token del vendedor, una máquina de estados
que no retrocede, reserva de stock atómica con vencimiento y un reconciliador
idempotente. La bandera productiva sigue apagada, no toqué Railway y no hay
una sola credencial real.

Y una cosa que te debo de entrada, porque cambia cómo leer el resto: **encontré
la carrera que pedías que frenara y documentara, y no la tapé con un reembolso:
la resolví invirtiendo el orden**. Está en la sección 5.

## 1. Dónde entra la verdad, y por dónde no

Tres puertas hacia Mercado Pago y ninguna más:

| Puerta | Qué hace | Qué NO hace |
|---|---|---|
| `POST /api/mp/webhook` | recibe el aviso y **enruta** | no cree una palabra del cuerpo |
| `GET /v1/payments/{id}` | dice el estado real | — |
| `PUT /checkout/preferences/{id}` | apaga un link ya emitido | no cobra ni devuelve |

El webhook está escrito al revés de como se escribe un endpoint normal: lo
primero no es qué hacer con lo que llegó, sino cuánto de lo que llegó merece
mirarse.

1. **Firma.** `x-signature` (`ts` + `v1`), `x-request-id` y el `data.id` de la
   URL, HMAC SHA-256 sobre `id:…;request-id:…;ts:…;`, comparación de tiempo
   constante y tolerancia de reloj configurable. Sin firma válida no se lee el
   cuerpo, no se consulta la cuenta de nadie y no se toca una fila.
2. **El cuerpo sólo enruta.** De él salen dos cosas: qué pago y de qué cuenta.
   Que el cuerpo diga `approved` no aprueba nada; el cuerpo no está firmado.
3. **La verdad se consulta**, con el token OAuth descifrado del vendedor.

Antes de asociar un pago a una orden se comprueba, todo: cobrador vinculado,
referencia externa, que la orden sea de ese vendedor, que el medio sea Mercado
Pago, la preferencia —por su identificador cuando viene y por el `orden_id` que
mandamos en la metadata—, la moneda, y el importe **exacto en `Decimal`**.
Cualquiera que no cierre: no se mueve nada.

## 2. Los códigos que devuelve, que también son una decisión

| Situación | HTTP | Por qué |
|---|---|---|
| aplicado, repetido, viejo, retroceso | 200 | quedó resuelto; MP no tiene que volver |
| pago ajeno, referencia cruzada, importe o moneda distintos | 200 | no va a cambiar reintentando, y no hubo efecto |
| firma ausente, mal formada, vencida o incorrecta | 401 | es lo único que se responde sin haber mirado nada |
| falta el secreto, MP no contesta, token rechazado | 503 | **no pudimos saber**: el aviso se reintenta |

El 503 es el que más me importa. Un 200 ahí se traga el aviso —Mercado Pago no
vuelve— y el pago queda cobrado sin que la plataforma lo sepa. No saber no es
lo mismo que saber que no.

## 3. La máquina de estados

Cada intento de pago tiene su fila, con `mp_payment_id` **único**. Por un mismo
link se puede intentar pagar varias veces, y con un solo estado por orden el
rechazo del primer intento tapaba la aprobación del segundo.

| Lo que dice Mercado Pago | Intención local | Orden | Stock |
|---|---|---|---|
| `pending`, `in_process`, `authorized`, `in_mediation` | `IN_PROCESS` | sigue pagable | reservado |
| `approved` | `APPROVED` | `PAID` | **consolidado, una vez** |
| `rejected` | sigue `PENDING` | sigue pagable | reservado |
| `cancelled`, `expired` (todos) | `CANCELLED` | la cierra el reconciliador | se libera |
| `refunded` | `REFUNDED` | queda como estaba | **no se toca** |
| `charged_back` | `CHARGED_BACK` | queda como estaba | **no se toca** |

Las reglas de precedencia: contracargo y devolución tapan a la aprobación;
la aprobación tapa a todo lo demás; un rechazo no cierra nada porque el link se
puede volver a usar.

Y dos guardas explícitas:

- **una noticia vieja no se aplica**: se compara `date_last_updated` con la
  última aplicada;
- **una aprobación no se deshace por un aviso**: desde `approved` sólo se sale
  a `refunded`, `charged_back` o `in_mediation`. Cualquier otra cosa se
  descarta y queda registrada como retroceso.

Devolución y contracargo **no ejecutan ningún reembolso y no devuelven stock
solos**. Dejan un estado local explícito que ven el comprador y el vendedor con
las mismas palabras, y el texto dice qué conviene hacer.

## 4. La reserva de stock

Tres números, y cada uno dice una cosa distinta:

- `stock`: lo que hay. Sólo baja cuando el pago se acreditó.
- `stock_reservado`: lo comprometido por compras en curso.
- `stock - stock_reservado`: lo que se puede vender hoy. Es lo que mira el
  carrito, el catálogo, el checkout y la aceptación de una transferencia.

Al confirmar un grupo de Mercado Pago se reserva **en la misma transacción que
escribe la orden**, antes de que exista una preferencia. Dos compradores llegan
ahí con la validación aprobada —los dos leyeron el mismo número— y decide un
`UPDATE ... WHERE stock - stock_reservado >= cantidad`: uno la toma y el otro
se lleva un 409 con todo lo suyo deshecho, sin orden, sin preferencia y con el
carrito vivo. Los servicios no reservan unidades.

Cada efecto ocurre **exactamente una vez**, y no porque el código se llame una
vez: la orden lleva escrito en qué anda su reserva —reservada, consolidada,
liberada, cierre pendiente— y moverla es un `UPDATE` condicional que la base
serializa. El que gana la fila aplica el efecto; el que la pierde no hace nada.

## 5. La carrera que pediste que frenara

Pediste que si aparecía una carrera en la que se puede cobrar después de
liberar stock, frenara y la documentara con evidencia. Apareció, y es la del
camino normal: **cancelar**.

La preferencia que ya viajó sigue viva del lado de Mercado Pago. Si al cancelar
una orden se libera la mercadería, alguien que guardó el link puede pagarla
después: cobro sin stock.

No la tapé con un reembolso automático. Lo que hay es la operación oficial para
cerrarla —`PUT /checkout/preferences/{id}` con la vigencia terminada— y una
regla de orden que vale para los tres caminos que terminan una orden:

> **Primero se apaga el link. Después se suelta la mercadería.** Y antes de
> soltarla se le pregunta a Mercado Pago si alguien pagó.

De ahí salen dos consecuencias que quiero que veas escritas:

- Si aparece un pago acreditado mientras se cancela, **la cancelación no
  ocurre**: sale un 409, la orden queda al día y pagada. Cancelar una orden
  cobrada sería soltar mercadería con dueño y dejar la plata sin explicación.
- Si Mercado Pago no contesta, la orden termina igual —la persona ya decidió—
  pero la reserva queda en **cierre pendiente** y no se libera. La mercadería
  vuelve cuando el reconciliador pueda confirmar que nadie pagó.

Lo que **sigue abierto** y no puedo cerrar de este lado está en la sección 11.

## 6. El vencimiento, que no lo decide el reloj

La preferencia lleva vigencia oficial (`expires`, `expiration_date_from`,
`expiration_date_to`) y ese instante es **el mismo** que el de la reserva: si
el link viviera más que la reserva, se podría cobrar mercadería ya entregada a
otro. El plazo es configurable y sale en 30 minutos. Efectivo y cajero quedan
excluidos: se acreditan en días, y una reserva de días bloquearía esa venta
para todos los demás. No toqué cuotas: no es una decisión nuestra.

El reconciliador (`python -m app.reconciliar`) es la entrada idempotente:

1. le pregunta a Mercado Pago con el token del vendedor correcto;
2. si hay pago aprobado, lo procesa —esa venta existe aunque el aviso se haya
   perdido—;
3. si hay uno en proceso, no toca nada;
4. y sólo si no hay ninguno **y** el link quedó cerrado, cierra la orden con su
   motivo y libera.

**No está programado en Railway y no abrí despliegue.**

## 7. Lo que se persiste, y lo que no

| Dónde | Qué |
|---|---|
| `products.stock_reservado` | unidades comprometidas |
| `orders.stock_reserva` | reservada / consolidada / liberada / cierre_pendiente |
| `payments.expires_at` | hasta cuándo vale el link |
| `payments.status` | el resumen de los intentos |
| `mp_intentos_de_pago` | id de MP (único), estado, monto, moneda, dos fechas |

No se guarda el cuerpo de Mercado Pago, ni datos del pagador, ni tokens, ni el
`status_detail`. `payments.refund_id` se fue con el módulo que devolvía dinero;
`refunded_at` y `refund_amount` quedan, y **registran lo que MP informa**, no
una acción nuestra.

## 8. Inventario de efectos

Qué mueve cada cosa, y qué no:

| Evento | Orden | Intención | Stock | Ventas |
|---|---|---|---|---|
| checkout de un grupo MP | `PLACED` | `PENDING` con link | **reserva** | — |
| `payment-link` reintentado | — | la misma | — | — |
| aviso: pendiente / en proceso | — | `IN_PROCESS` | sigue reservado | — |
| aviso: rechazado | — | sigue `PENDING` | sigue reservado | — |
| aviso: aprobado | `PAID` | `APPROVED` | **consolida** | +cantidad |
| aviso repetido, viejo o de retroceso | — | — | — | — |
| aviso: devuelto / contracargo | — | `REFUNDED` / `CHARGED_BACK` | — | — |
| pago ajeno, importe o moneda distintos | — | — | — | — |
| cancelar o rechazar sin cobro | `CANCELLED` / `REJECTED` | `CANCELLED` | **libera** | — |
| cancelar y aparece cobro | `PAID`, con 409 al que canceló | `APPROVED` | consolida | +cantidad |
| cancelar con MP caído | `CANCELLED` / `REJECTED` | — | **cierre pendiente** | — |
| reconciliar una vencida sin pago | `CANCELLED` con motivo | `CANCELLED` | **libera** | — |
| reconciliar y aparece cobro | `PAID` | `APPROVED` | consolida | +cantidad |
| reconciliar con pago en proceso | — | `IN_PROCESS` | sigue reservado | — |

## 9. La regresión, y el rojo contra MP-B

Ocho casos nuevos, uno por cada punto que pediste. Ninguno usa cantidades del
seed: el que necesita una unidad la publica.

| Caso | Qué mira |
|---|---|
| 86 | firma ausente, de otro secreto, alterada, mal formada, vencida, del futuro y con el `data.id` cambiado; y la URL de aviso con parámetros no arranca |
| 87 | cobrador ajeno, referencia inexistente, referencia de otro vendedor, preferencia cruzada, metadata de otra orden, importe alterado y moneda alterada |
| 88 | entrar a `/payment/success` sin ningún pago, en el navegador; y después el webhook |
| 89 | rechazo → aprobación; 5 avisos del mismo pago (3 seguidos y 2 a la vez); noticia vieja; retroceso; devolución y contracargo |
| 90 | dos compradores simultáneos por la última unidad |
| 91 | vencida sin pago, vencida con pago aprobado, vencida con pago en proceso, y cancelar con Mercado Pago caído |
| 92 | permiso revocado, MP caído, vínculo cortado, y la convergencia al reintentar |
| 93 | comprador y vendedor ven lo mismo; el vendedor no confirma ni despacha sin cobro |

Con el producto vuelto a `abebedb` y su esquema, y esta suite en su lugar:

```
86/87/89/92  POST /api/mp/webhook → 404. No hay firma que validar, no hay
             consulta a Mercado Pago y no hay forma de que una orden se pague.
91           python -m app.reconciliar → ModuleNotFoundError.
90           dos checkouts simultáneos por 1 unidad → 2 ÓRDENES CREADAS,
             2 preferencias pedidas y el stock quedó en 1.
93           «Mis compras» trae payment_state = undefined;
             el vendedor confirmó una orden de Mercado Pago sin cobrar
             (HTTP 200 → "confirmed") y después la despachó (200 → "shipped").
```

El de 90 es el que más me importa que veas escrito: **una bolsa, dos dueños, y
dos links de pago emitidos**. No era un riesgo teórico.

## 10. Puertas

Corridas al final, sobre la base reseteada, migrada y sembrada de cero, con la
API levantada sobre el código que entrego.

| Puerta | Resultado |
|---|---|
| Suite completa | **93 de 93**, 0 fallas |
| Hito intermedio | **6 de 6** pasos encadenados en un solo viaje |
| Accesibilidad (axe, wcag2a/2aa/21a/21aa) | **58 de 58** pantallas, 0 serious ni critical |
| Contraste | **42 de 42** mediciones, 0 textos por debajo del mínimo, 0 desbordes |
| `npm run build` | `tsc` sin errores; 82 módulos, 384,89 kB (113,23 kB gzip) |
| Migración ida y vuelta con datos | **44 productos, 61 órdenes, 26 pagos** intactos bajando y subiendo |
| `alembic check` | «No new upgrade operations detected» |
| `git diff --check` (con `cr-at-eol`) | limpio |

La ida y vuelta la corrí sobre la base que quedó después de la suite, no sobre
una vacía. Bajando a `e4c72a9b1f83` desaparecen `stock_reservado`,
`stock_reserva`, `expires_at` y la tabla de intentos, y vuelve `refund_id`;
subiendo pasa lo contrario. Los datos de siempre no se movieron.

Una cosa que vas a ver en los números y prefiero decir yo: **los 8 intentos de
pago quedaron en 0**. La tabla es nueva, bajar la borra y volver a subir la crea
vacía. No es reversible en el sentido de conservar su contenido, y no puede
serlo: no hay dónde guardarlo en el esquema de MP-B. Lo que sí se conserva es
todo lo anterior, y `payments.status` —el resumen— sobrevive intacto, así que
ninguna orden pierde su estado de cobro por bajar y subir.

Dos que no te pedí y miro igual, porque son las que me harías notar:
`MP_CHECKOUT_HABILITADO` está en `false` en el default del código y en los dos
`.env.example`, y no hay una sola puerta de prueba en los seis módulos nuevos
—ni `SMOKE`, ni `TEST_MODE`, ni un `if` que afloje la firma.

## 11. Riesgos que impiden encender producción

Ninguno de estos es un pendiente de código. Son las razones por las que la
bandera sigue apagada, y las digo yo antes de que las preguntes:

1. **Nada se probó contra Mercado Pago de verdad.** Todo esto corre contra un
   doble local que habla el protocolo en la parte que nos importa. Lo que la
   API real devuelve y el doble no —o al revés— no está cubierto. Un punto
   concreto: `preference_id` no es un campo documentado de
   `/v1/payments/{id}`, así que la atadura fuerte a la preferencia es el
   `orden_id` que mandamos en la metadata, y el `preference_id` se compara
   **sólo si viene**. Hay que confirmarlo con una cuenta de prueba real.
2. **La URL de aviso no existe todavía.** `MP_NOTIFICACION_URL` está vacía, así
   que ninguna preferencia declara a dónde avisar. Publicarla, con su secreto,
   es parte del encendido.
3. **El reconciliador no está programado.** Sin él, un aviso perdido deja una
   reserva viva hasta que alguien lo corra a mano. Programarlo es despliegue.
4. **Cancelar le habla a Mercado Pago con la fila bloqueada.** Es el precio de
   no soltar stock antes de apagar el link: en el peor caso la orden queda
   bloqueada mientras corren dos llamadas con corte a 15 s. Con este volumen no
   molesta; con volumen alto hay que sacar el cierre a un trabajo aparte.
5. **Una orden ya cancelada puede recibir un pago.** Si Mercado Pago no
   contestó al cancelar, el link sigue vivo hasta que el reconciliador lo
   apague, y en esa ventana alguien puede pagar. No se pierde ni se inventa
   plata: el pago queda registrado, la orden aparece cobrada para los dos y el
   stock se consolida. Pero es un estado que necesita una persona, y **no lo
   resolví con un reembolso automático a propósito**.
6. **Devolución y contracargo no devuelven stock.** La mercadería puede estar
   despachada. Queda el estado accionable y decide una persona.
7. **El vendedor no recibe aviso cuando se acredita el pago.** Lo ve en su
   panel. Un correo no estaba pedido y no lo agregué; lo dejo señalado.
8. **Apagar la bandera no cierra el webhook.** Es a propósito: si se apaga
   después de que un link viajó, el pago igual ocurrió y hay que registrarlo.

## 12. Inventario

| Archivo | Qué cambió |
|---|---|
| `backend/app/api/mp_webhook.py` | **nuevo**: la puerta por la que avisa Mercado Pago |
| `backend/app/services/mp_firma.py` | **nuevo**: la firma, y nada más que la firma |
| `backend/app/services/mp_pagos.py` | **nuevo**: consultar, buscar y vencer una preferencia |
| `backend/app/services/cobro.py` | **nuevo**: la máquina de estados y el cierre del cobro |
| `backend/app/services/stock.py` | **nuevo**: reservar, consolidar, liberar; una vez cada uno |
| `backend/app/models/mp_intento.py` | **nuevo**: un intento de pago por fila |
| `backend/app/reconciliar.py` | **nuevo**: la entrada idempotente, ejecutable a mano |
| `backend/alembic/versions/…f1a63d0e7b45…` | **nueva**: reserva, vigencia, intentos; ida y vuelta |
| `backend/app/services/checkout.py` | reserva el grupo de Mercado Pago en la misma transacción |
| `backend/app/services/mp_preferencia.py` | vigencia, metadata, retornos y tipos de pago excluidos |
| `backend/app/api/orders.py` | cierre del cobro al terminar, estado visible, `payment-state`, el vendedor no despacha sin cobro |
| `backend/app/api/cart.py`, `catalog.py` | disponible = lo que hay menos lo reservado |
| `backend/app/models/{order,payment,product}.py` | reserva, vigencia, contracargo, `stock_reservado` |
| `backend/app/core/config.py` | secreto, tolerancia, vigencia, gracia; y la URL de aviso sin parámetros |
| `src/components/Pages/PaymentResultPage.tsx` | dejó de declarar un pago exitoso por la URL |
| `src/components/UserDashboard/UserDashboard.tsx` | el estado del pago, igual para comprador y vendedor |
| `scripts/lib/mp-doble.mjs` | firma avisos, responde consultas y búsquedas, y vence preferencias |
| `scripts/smoke.mjs` | casos 86 a 93, y el 79 mira la vigencia y los tipos excluidos |
| `scripts/{a11y,contraste}.mjs` | la pantalla de vuelta, en las dos medidas |
| `scripts/smoke.sh` | levanta el doble con el secreto de firma |
| `backend/app/main.py` | monta el webhook |
| `backend/app/models/__init__.py` | exporta el intento de pago |
| `backend/app/schemas/orders.py` | `payment_state` en las dos lecturas |
| `backend/.env.example` | las cuatro claves nuevas, el secreto vacío |
| `…/UserDashboard.module.css` | el párrafo de estado, normal y con problema |
