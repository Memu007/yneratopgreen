# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-12. Segundo informe del día.

**Sin código otra vez.** No monté `payments.py`, no restauré la comisión, no
toqué esquema ni entorno. Me quedo en **Alto** esperando la confirmación de
Emi, como pediste. Lo que sigue es lo que encontré mientras tanto, y son cinco
cosas: una que cierra la duda que te dejé abierta, y cuatro que hay que meter
en el alcance de Extra **antes** de que se escriba la primera línea.

## 1. La duda que te dejé abierta la pude cerrar yo, y te da la razón

Te pedí que averiguaras si la pieza se escribe contra preferencias o contra
Orders, porque cambiaba el módulo entero y yo no podía abrir la documentación.
Vos confirmaste que Checkout Pro sigue usando `/checkout/preferences` y que la
API Orders pertenece a Checkout API.

Después me di cuenta de que había un lugar donde sí podía verificarlo de
primera mano: **el changelog del SDK oficial está en GitHub, que no está
bloqueado.** Lo abrí. Versión 3.3.0, del 30/06/2026:

> «Orders Checkout Pro: **beta** support helpers, example payload, and
> wire-level tests for creation through `sdk.order().create()`.»

Existe, entonces, un Orders para Checkout Pro —por eso yo había levantado la
mano—, pero **está marcado beta en el propio SDK de Mercado Pago**. Tu
corrección no sólo es correcta: queda mejor fundada de lo que la escribiste.
Preferencias no es lo que queda por inercia, es lo estable. Escribir la pieza
contra Orders hoy sería escribirla contra una superficie beta de una empresa
que en un año nos movió dos majors. **Cerrado: preferencias.**

De paso, el mismo changelog trae algo que sí me preocupa. Versión 3.4.0, del
04/08/2026 —hace ocho días—:

> «Webhook `tolerance_seconds` unit mismatch — `ts` header value compared in
> seconds against a millisecond clock.»

Es la validación de firma de webhooks del SDK oficial, y **estuvo mal hasta la
semana pasada**. Dos consecuencias concretas para el alcance: el pin va en
**≥ 3.4.0** —hoy tenemos `mercadopago==2.2.1`, dos majors atrás— y la
validación de firma la escribimos y la probamos nosotros. No por desconfiar de
oficio: porque hay evidencia primaria de que ese pedazo específico estuvo roto.

## 2. Lo que sigue apoyado en tu lectura, no en la mía

Los tres puntos que marqué **[buscado]** —`marketplace_fee` opcional, el
vendedor como cobrador, el orden de descuento de comisiones— los das por
confirmados en documentación oficial. Los tomo. Vos pudiste abrir esas páginas
y yo no. Queda asentado de quién es la verificación de cada cosa, que era todo
lo que yo pedía.

## 3. Un defecto que hoy duerme y que se despierta el día que se monte MP

Fui a mirar cómo aterriza el modelo 1:1 sobre el código que ya existe, y
encontré esto en `/orders/checkout` (`backend/app/api/orders.py:232`):

```python
    # Retornar la primera orden (o podrías retornar todas)
    return order_responses[0] if order_responses else None
```

El endpoint **crea una orden por vendedor** —eso está bien y encaja con el
modelo 1:1— pero **devuelve una sola**. Con el comentario puesto por quien lo
escribió, que sabía que faltaba.

Hoy no lastima a nadie: el frontend sólo llama a `/orders/checkout/transfer`, y
ese camino sí devuelve `orders[]`. Se arregló ahí y no acá. **Pero es
exactamente el endpoint del que va a colgar Mercado Pago**, y el día que
cuelgue, un carrito de dos vendedores va a crear dos órdenes, convertir el
carrito y devolver una. La segunda queda `PLACED`, sin link de pago y sin
referencia que el comprador pueda ver. Plata comprometida que nadie puede
pagar.

**El contrato plural del endpoint va primero, no junto con la pieza de pagos.**
Es chico y es previo. Si querés te lo hago como tarea aparte en Alto, antes de
que Emi conteste: no toca pagos, no toca esquema, y deja el terreno parejo con
el camino de transferencia.

## 4. El módulo heredado reintroduce justo lo que acabamos de sacar

Escribiste que no se reutiliza sin recortarlo contra el alcance. De acuerdo,
pero recortarlo no alcanza. En sus 857 líneas hay **19 usos de `float(` y
`round(`** en el camino del dinero:

```python
seller_amount: Optional[float] = None
seller_amount = round(total_amount - commission_amount, 2)
refund_amount = float(payment.seller_amount)  # 95% del total
```

Hace dos commits sacamos la aritmética binaria de los dos checkouts y la
metimos en `Decimal` con un helper único. Traer ese módulo tal cual la devuelve
por la ventana, y encima en el punto donde más duele: el importe que viaja a
Mercado Pago. **Ese importe tiene que salir de la orden ya escrita, no
recalcularse**, y toda la aritmética que quede va en `Decimal`. Ponelo
explícito en el alcance de Extra o se va a colar.

El resto del inventario del módulo sigue igual que en `925de4e`: cobra la
comisión dos veces, guarda `seller_amount = 100 %` que no es lo que el vendedor
cobra, y tiene `NGROK_URL` clavado como URL de webhook. Ni `payments` ni
`mp_oauth` están montados en `main.py`; lo verifiqué de nuevo hoy.

## 5. Las consecuencias de producto son tres, no dos

Las dos que nombraste —cada vendedor vincula su cuenta, y un carrito
multivendedor se paga por separado— están bien. Falta la que sale de
combinarlas:

**Un vendedor que no vinculó su cuenta no puede cobrar con tarjeta.**

O sea que «pagar con tarjeta» deja de ser una propiedad de la plataforma y pasa
a ser **un estado por vendedor**. Y el carrito ya está agrupado por vendedor.
Un carrito con uno vinculado y otro no es un checkout con medios de pago
mezclados: tarjeta para un grupo, transferencia para el otro, en la misma
pantalla.

Eso no lo decide la Dev. Hay que elegir, y conviene elegirlo antes de
construir, porque cambia la pantalla:

1. El no vinculado cobra sólo por transferencia, y se dice en su grupo.
2. El no vinculado no puede publicar hasta vincular.
3. Sus publicaciones se ocultan del catálogo.

Mi recomendación es la 1, y no por facilidad: es la única que no rompe nada de
lo que ya funciona. Hoy se vende por transferencia sin que nadie vincule nada,
y las otras dos convierten a Mercado Pago en requisito para publicar, que es
más de lo que la clienta pidió. La 1 también es la que mejor se banca el caso
real: el vendedor que vincula la cuenta y la desvincula tres meses después no
tira su catálogo abajo, se le apaga la tarjeta.

En la estructura del checkout esto ya está resuelto a medias, y de casualidad:
la modal decide el flete **por grupo de vendedor** desde la Pieza C. El medio de
pago por grupo tiene exactamente la misma forma. Reutiliza el andamio.

## 6. El orden en que yo escribiría la pieza, cuando se abra

1. **Contrato plural de `/orders/checkout`.** Previo y separable (punto 3).
2. **OAuth**: URL de autorización, intercambio, refresh. Con **cifrado en reposo
   desde la primera versión** y un camino de renovación que no dependa de que
   el vendedor se entere de que su token venció a los 180 días.
3. **Revocación y desvinculación**, que es lo que hace falta para que el punto 5
   sea reversible.
4. **Una preferencia por orden** (1:1), con el importe leído de la orden.
   `marketplace_fee` omitido, no puesto en cero: lo que no se manda no se
   discute.
5. **Webhook**: validación de firma propia, **consulta posterior a la API para
   confirmar el estado** —el payload nunca es la verdad—, idempotencia propia y
   tolerancia a los reintentos.
6. **`NGROK_URL` afuera**, URL pública por configuración.

Y una que no es código: para probar esto hace falta **un vendedor de prueba con
cuenta de test propia**. No van credenciales reales al repo ni a mi entorno, y
la prueba con credenciales de verdad la hace alguien con acceso legítimo a esa
cuenta, no yo.

## 7. Estado del repositorio

Sin cambios de producto. Lo último entregado sigue siendo el contrato monetario
(`2220e94`, informe `8abaeb2`). No volví a correr la suite porque no cambié una
sola línea de código desde entonces; el último estado verificado sigue siendo
61/61, puerta del hito 6/6, build y `diff --check` verdes, migraciones
reversibles con `alembic check` limpio.

`payments.py` y `mp_oauth.py` siguen desmontados, la comisión sigue sin
restaurarse, y no toqué esquema ni entorno.

## Fuentes

Abierto y leído por mí en este ciclo:

- [SDK oficial de Python — changelog](https://raw.githubusercontent.com/mercadopago/sdk-python/master/CHANGELOG.md)

El bloqueo de salida hacia los dominios de Mercado Pago sigue vigente y no lo
esquivé. Todo lo que en `925de4e` estaba marcado **[buscado]** sigue estándolo,
salvo lo que vos confirmaste y lo que cerré en el punto 1.
