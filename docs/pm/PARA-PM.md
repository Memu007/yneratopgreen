# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-13.

**Pieza MP-B entregada.** El carrito se resuelve por grupos de vendedor: cada
grupo elige con qué paga, cada grupo es una orden, y cada orden por Mercado
Pago tiene su preferencia de Checkout Pro y su fila de pago. **No se cobra
nada**: la bandera sale apagada, y con ella apagada Mercado Pago no existe para
el comprador. No se reserva ni se descuenta stock, ninguna vuelta del navegador
marca nada como pagado, y no hay webhook.

Tres cosas antes del detalle, por si salteás el resto:

- **Saqué `backend/app/api/payments.py`.** No estaba montado, pero `orders.py`
  lo llamaba por import perezoso desde dos lugares, y uno de ellos —cancelar—
  corre para cualquier orden que no sea por transferencia. Con MP-B esas
  órdenes empiezan a existir. Punto 6.
- **El checkout singular creaba varias órdenes y devolvía una sola.** Lo medí
  contra `4d90a8b` antes de tocarlo. Punto 9.
- **Queda un agujero de uso que no cerré**: si el comprador cierra el checkout,
  ninguna pantalla le vuelve a ofrecer el link de pago de su orden de Mercado
  Pago. El dato está y la ruta es idempotente; falta la pantalla. Punto 10.

## 1. El contrato, punto por punto

| Lo que pediste | Cómo quedó |
|---|---|
| Un medio por grupo, y que un grupo pueda ir por MP y otro por transferencia | `payment_decisions`, una por vendedor; los grupos los deriva el servidor del carrito |
| Decisión faltante, extra, ajena o no disponible rechaza todo | Cuatro rechazos con motivo propio, antes de la primera fila; el quinto —medio inventado— lo frena el esquema con 422 |
| Respuesta plural y estable | `{"orders": [...]}`: una entrada por orden, con vendedor, medio, total congelado y estado de preparación |
| Una preferencia y un pago por grupo MP | Una fila de `payments` por orden, sostenida por índice único |
| Sin `marketplace_fee` | No viaja: ni el 5 % ni un cero |
| `external_reference` inequívoca e idempotencia estable por orden | `topgreen-{order_number}` y `X-Idempotency-Key: topgreen-orden-{order_id}` |
| Importe desde la orden, sin `float` recalculado | `Decimal` hasta el borde JSON, con ida y vuelta exacta comprobada |
| Persistir lo mínimo | Identificadores, `init_point`, importe y estado nuestro; el cuerpo de MP no se guarda |
| Campos de comisión y respuesta cruda que mienten | Se van los cuatro por migración, y `MP_COMMISSION_PERCENT` del código y de los dos ejemplos |
| Interruptor apagado por defecto y en producción | `MP_CHECKOUT_HABILITADO=false` en `config.py`, `.env.example` y el ejemplo de producción |
| La pantalla lo explica antes de confirmar | Aviso de N órdenes separadas y N pagos separados, arriba de los grupos |
| El navegador no declara pagado | La orden queda «pendiente de confirmación»; volver a la URL de retorno no cambia orden ni pago |

## 2. Una sola regla de checkout

Había dos: `/orders/checkout` y `/orders/checkout/transfer`, cada uno con su
copia de los totales, el stock, los snapshots y la logística. Dos copias de la
misma regla son dos reglas que se van a separar, y la que se olvide va a ser la
que toque plata.

Ahora la regla vive en `backend/app/services/checkout.py` y los dos endpoints
traducen a HTTP y nada más:

- `preparar(...)` valida el carrito **entero** y no escribe nada: destino,
  traslado, medio de pago, vínculo del vendedor, precios, cantidades, totales y
  stock. Devuelve el plan.
- `crear_ordenes(...)` escribe una orden por vendedor en **un solo commit**.
- El checkout por transferencia llama a lo mismo con el medio puesto.

`/orders/transfer-options` se fue y en su lugar está `/orders/payment-options`,
que contesta lo que la pantalla necesita: por grupo, cuánto y con qué se le
puede pagar. La diferencia no es de nombre. El viejo devolvía **HTTP 400 para
todo el carrito** si un vendedor no tenía CBU; con Mercado Pago en el medio eso
además es falso, porque no tener CBU dejó de significar no poder cobrar. Ahora
ese grupo viene con `methods: []` y su motivo, y el comprador ve cuál de sus
pedidos tiene que sacar.

## 3. La preferencia: qué viaja y qué no

Uso la superficie estable de **preferencias** (`POST /checkout/preferences`), no
Orders. Y saqué el SDK oficial de `requirements.txt`: no lo usa nadie —son dos
llamadas HTTP con `httpx`— y su rama 3.x mueve el cobro justamente a Orders,
que Mercado Pago publica como beta. Tener una dependencia para no usarla es
decoración; fijarla en una versión que empuja a una API beta es peor.

Lo que viaja, medido sobre el cuerpo que capturó el doble (caso 79):

- Los ítems y el importe salen de la **orden ya escrita** y sus snapshots. Si
  el vendedor cambia el precio después de confirmar, la orden y el pago siguen
  diciendo lo mismo.
- Moneda `ARS` en cada ítem.
- `external_reference: topgreen-{order_number}`, sin datos de nadie.
- `back_urls` armadas con la configuración y el número de orden.
- **No viaja `notification_url`** porque no está configurada: mandar una que no
  atiende nadie es pedirle a Mercado Pago que reintente contra el vacío.
- **No viaja `marketplace_fee`.** Ni en cero: lo que no se manda no se discute.
- Autoriza el access token **del vendedor**, descifrado en el momento, usado y
  olvidado. No lo devuelve ninguna ruta y no aparece en ningún log.

Lo que se guarda: el id de preferencia, el `init_point`, la referencia, el
importe exacto y nuestro estado. El cuerpo de la respuesta de Mercado Pago no
se guarda —lo que no se guarda no se filtra— y las columnas `commission_amount`,
`commission_percent`, `seller_amount` y `mp_response` se fueron por migración.

**Reintentar no duplica**, y lo sostienen tres cosas juntas: la clave de
idempotencia derivada de la orden, el índice único de `payments.order_id`, y el
manejo explícito del choque —si dos pedidos simultáneos llegan los dos hasta el
`INSERT`, el que pierde se queda con el que ganó en vez de devolver un 500—. El
caso 77 dispara cinco pedidos a la vez sobre la misma orden: un solo link, una
sola preferencia, una sola fila.

## 4. El interruptor

`MP_CHECKOUT_HABILITADO` arranca en `false` en el código, en `.env.example` y en
el ejemplo de producción. Con la bandera apagada:

- `payment-options` no ofrece el medio;
- pedirlo a mano da 400 con motivo;
- el reintento del link responde «deshabilitado»;
- el doble no recibe ninguna preferencia y no queda ninguna fila de pago;
- la venta por transferencia funciona igual, con sus datos bancarios.

La suite lo enciende **sólo contra el doble local** (`scripts/smoke.sh`), y el
caso 80 lo prueba apagándolo dentro de la propia aplicación, con su grafo de
dependencias: levantar otra API en otro puerto probaría otra cosa.

## 5. La pantalla

El paso de pago dejó de ser un radio único de adorno. Ahora, por cada grupo:
quién cobra, cuánto, y los medios que ese vendedor puede recibir hoy. Si un
grupo tiene un solo medio posible viene marcado —elegir la única opción que
existe no es una decisión—; si tiene dos, no se presupone ninguna.

Arriba de todo, cuando el carrito tiene más de un vendedor, dice **antes de
confirmar** que se van a crear N órdenes separadas, que cada una se paga por
separado y que cada vendedor entrega lo suyo.

El tercer paso ya no se llama «Comprobante» sino «Órdenes», porque ahora es una
cola: cada orden con su referencia, su monto y su medio. Las de transferencia,
con CBU, alias, titular y el comprobante para adjuntar. Las de Mercado Pago,
con el link que abre en otra pestaña y esta frase, que es la que importa:

> Cobra {vendedor} en su cuenta de Mercado Pago. La orden queda **pendiente de
> confirmación**: volver de esa pantalla no confirma el pago, lo confirma
> Mercado Pago.

Si la preferencia no se pudo preparar, la orden aparece igual, con su motivo y
un botón de reintento que no crea otra orden ni otro pago.

## 6. Lo que saqué, y por qué

**`backend/app/api/payments.py`** (857 líneas). No estaba montado desde antes de
MP-A, pero seguía siendo alcanzable: `orders.py` lo importaba en caliente desde
`get_refund_processor()` y lo llamaba en dos lugares. Uno es el cambio de
estado; el otro es **cancelar**, y esa rama corre para cualquier orden que no
sea por transferencia. Hasta ayer no existía ninguna. Con MP-B empiezan a
existir.

Qué hacía ese código si lo hubieran llamado: buscaba el pago, leía
`seller.mp_access_token` —columna que MP-A borró, o sea `AttributeError`— y, si
el vendedor no tenía token, **reembolsaba con el token del marketplace**. Eso es
exactamente administrar plata de terceros. Además escribía en las cuatro
columnas que esta pieza elimina, así que después de la migración era código que
no podía funcionar.

Cancelar ya no devuelve dinero, y ahora lo dice en vez de aparentarlo: por
transferencia el dinero fue de cuenta a cuenta y nosotros no lo administramos;
por Mercado Pago todavía no hay ningún pago confirmado. La respuesta de cancelar
ya no trae el campo `refund`, que era siempre nulo y no lo leía nadie.

También se fueron `MP_COMMISSION_PERCENT` (código y los dos ejemplos),
`mercadopago==2.2.1` de `requirements.txt`, el esquema
`BankTransferCheckoutResponse` y el helper `_get_transfer_groups`.

## 7. Migración

`e4c72a9b1f83`. Agrega `orders.payment_method` —las órdenes anteriores quedan en
NULL, que es «no informado» y no «transferencia»; la única excepción son las que
guardaron snapshot bancario, que es dato duro y no conjetura—, borra las cuatro
columnas de `payments` y convierte su índice de `order_id` en único. Va y vuelve
con datos adentro, y `alembic check` no encuentra diferencias.

## 8. Puertas

Todo contra la base local y el doble; ninguna credencial real.

| Puerta | Comando | Resultado |
|---|---|---|
| Suite | `node scripts/smoke.mjs` | **81 de 81**, sobre base recién migrada y sembrada |
| Hito | `npm run hito` | 6 de 6 pasos encadenados |
| Accesibilidad | `npm run a11y` | 56 de 56 pantallas, 0 violaciones bloqueantes |
| Contraste | `npm run contraste` | 40 de 40 mediciones, 6120 textos, 0 incumplimientos |
| Build | `npm run build` | `tsc` y `vite build` limpios |
| Migración | `alembic downgrade -1`, `upgrade head`, `alembic check` | Va y vuelve con datos adentro; «No new upgrade operations detected» |
| Espacios | `git diff --check` | 0 espacios reales al final de línea y 0 marcadores de conflicto |

`git diff --check` marca 992 líneas, y todas son el CR de fin de línea de los
archivos CRLF del repositorio: el mismo ruido que te reporté la vez pasada. Lo
que la puerta busca de verdad —un espacio o un tabulador al final del texto, y
los marcadores de conflicto— da **cero** en las dos cuentas.

Los siete colores nuevos de la pantalla de pago están todos arriba de 4,5:1
—el más bajo es el aviso de «este vendedor no puede recibir pagos», 5,18:1, que
es el mismo par que ya usaban los errores—. El paso de pago lo miden las dos
puertas; la cola de órdenes no, porque medirla exigiría que una puerta de
auditoría confirmara una compra, y esas puertas no escriben. Sus colores son
los mismos tokens ya medidos más el botón de pago (blanco sobre `#2d5016`,
9,25:1) y el de reintento (`#2d5016` sobre blanco, 9,25:1).

## 9. El rojo contra la versión anterior

Volví el producto a `4d90a8b` —la suite nueva quedó en su lugar— y bajé la base
un paso, para correr las propiedades de esta pieza contra el código anterior.
Siete observaciones; dos me importan de verdad:

```
GET  /orders/payment-options            → HTTP 404
POST /orders/checkout                   → HTTP 200, devolvió 1 orden y escribió 2
     medio de la orden en la respuesta  → null
     preferencias que recibió el doble  → 0
POST /orders/{id}/payment-link          → HTTP 404
checkout con una decisión de pago de un vendedor ajeno
     y ninguna de los dos del carrito   → HTTP 200; órdenes escritas: 2
columna orders.payment_method           → no existe
```

La segunda línea es el defecto que abriste: **el carrito de dos vendedores
escribía dos órdenes y devolvía una**. La anteúltima es el que encontré
armando el caso 78: el checkout viejo **ignoraba `payment_decisions` por
completo**, así que una decisión inyectada no fallaba, simplemente no existía.

Cada una de esas líneas es hoy una aserción de un caso: 75 y 81 miran la
respuesta plural y los medios por grupo, 76 y 77 el link y su reintento, 78 los
rechazos antes de escribir, 79 el cuerpo que viaja, 80 la bandera apagada.

## 10. Riesgos y lo que no hice

Los seis primeros son consecuencia de haber frenado donde pediste. El último
no es mío pero te lo señalo.

1. **La orden por Mercado Pago no tiene quién la mueva.** Nace colocada y ahí
   se queda: sin webhook y sin consulta de estado, el pago local queda
   `PENDING` para siempre. El comprador ve «pendiente de confirmación», que es
   verdad; el vendedor ve una orden colocada y nada que le diga si le pagaron.
   Es la razón principal por la que la bandera va apagada.

2. **El aviso al vendedor sale al crear la orden, no al cobrarla.** Es lo mismo
   que ya pasaba con transferencia, pero con Mercado Pago la distancia entre
   «orden colocada» y «plata en la cuenta» la controla un tercero. MP-C tiene
   que agregar el aviso de pago confirmado; hasta entonces, un vendedor no
   debería despachar por una notificación de MP-B.

3. **El link de pago no se recupera desde «Mis compras».** Si el comprador
   cierra el checkout, la cola de órdenes desaparece de la pantalla. El dato no
   se pierde —`POST /orders/{id}/payment-link` devuelve el mismo link y es
   idempotente— pero ninguna pantalla lo ofrece. Es chico y no lo metí acá para
   no mezclarlo con la pieza, pero **antes de encender la bandera hay que
   cerrarlo**: si no, una compra interrumpida no se puede terminar de pagar.

4. **No se reserva ni se descuenta stock.** Freno respetado. Consecuencia
   honesta: dos compradores pueden crear dos órdenes por la misma unidad y los
   dos podrían pagar. Con la bandera apagada no hay pagos y hoy no hay daño; la
   política de stock es condición para encenderla.

5. **El importe viaja como número JSON.** Es el único lugar donde el dinero
   deja de ser `Decimal`, y es inevitable: el cuerpo es JSON. Está acotado a la
   serialización —ahí no se suma ni se multiplica nada— y se comprueba que la
   ida y vuelta sea exacta; si alguna vez no coincidiera, la preferencia no se
   crea.

6. **`orders.payment_method` queda NULL en las órdenes viejas.** Elegí no
   rellenar salvo donde hay evidencia (snapshot bancario). Si más adelante
   agrupás por medio, esas órdenes van a caer en «no informado», que es lo
   correcto.

7. **`docs/pm/PROJECT.md` sigue diciendo «split payment 5 % para la plataforma,
   95 % para el vendedor», configurable por `MP_COMMISSION_PERCENT`.** Esa
   variable ya no existe y el modelo contradice tu propio
   `ALCANCE-Y-LIMITES.md`, que dice comisión de marketplace cero y que TopGreen
   no administra fondos de terceros. No lo toqué porque el modelo de negocio es
   tuyo, pero alguien lo va a leer y va a creerle.

**Lo que no hice, a propósito:** webhook, consulta de estado a Mercado Pago,
transiciones de orden por pago, reserva o descuento de stock, credenciales
reales, y encender la bandera en ningún lado. Tampoco abrí un pull request.

## 11. Inventario

**Nuevos**

| Archivo | Qué es |
|---|---|
| `backend/app/services/checkout.py` | La regla del checkout, una sola vez: grupos, medios, validación completa y creación en un commit |
| `backend/app/services/mp_preferencia.py` | La preferencia de Checkout Pro de una orden: qué viaja, qué se guarda, por qué reintentar no duplica |
| `backend/alembic/versions/20260813_0100_e4c72a9b1f83_...py` | Medio por orden y la fila de pago sin comisión que mienta |

**Modificados**

| Archivo | Qué cambió |
|---|---|
| `backend/app/api/orders.py` | Contrato plural, `/payment-options`, `/{id}/payment-link`, sin el reembolso heredado |
| `backend/app/schemas/orders.py` | `PaymentDecision`, `OpcionDePago`, `OrdenCreada`, `CheckoutResponse` |
| `backend/app/models/order.py` | `payment_method` |
| `backend/app/models/payment.py` | Cuatro columnas menos, `order_id` único |
| `backend/app/core/config.py` | Interruptor, URL de aviso, sin comisión |
| `backend/app/services/mp_vinculo.py` | `access_token_de`: descifra, se usa y se olvida |
| `backend/app/services/logistica.py` | `origen_de`, que estaba en el endpoint y ahora es de la logística |
| `src/components/Checkout/CheckoutModal.tsx` y su CSS | Medio por grupo, aviso multivendedor, cola de órdenes |
| `backend/requirements.txt` | Sin el SDK de Mercado Pago |
| `backend/.env.example`, `backend/.env.production.example` | Interruptor apagado, URL de aviso vacía, sin comisión |
| `scripts/smoke.mjs` | 81 casos: 7 nuevos y 8 al día |
| `scripts/lib/mp-doble.mjs` | El doble sirve preferencias, con idempotencia real y cuentas con guion |
| `scripts/smoke.sh`, `scripts/hito.mjs` | El interruptor para la suite; el hito elige medio por grupo |
| `docs/API_ENDPOINTS.md`, `docs/SETUP_PAYMENTS.md` | Puestos al día con lo que hay |

**Borrado**

| Archivo | Por qué |
|---|---|
| `backend/app/api/payments.py` | 857 líneas alcanzables desde cancelar, que reembolsaban con el token del marketplace y escribían en columnas que ya no existen |
