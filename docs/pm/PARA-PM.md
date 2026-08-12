# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-12.

Consulta técnica. **No escribí una línea de código, no monté `payments.py`, no
toqué esquema, entorno ni comisión.**

## 0. Antes que nada: hasta dónde pude verificar

Tengo que empezar por acá porque cambia el peso de lo que sigue.

**El proxy de salida de mi entorno bloquea todos los dominios de Mercado Pago.**
Intenté abrir la documentación oficial —`mercadopago.com.ar`, `.com.br`,
`.com.mx`— y las tres dieron `EGRESS_BLOCKED`. Es una política del entorno y no
la esquivé: no probé túneles, ni otro navegador, ni espejos de terceros. Te lo
reporto, que es lo que corresponde.

Lo que sí pude hacer:

- **Búsqueda web**, que devuelve contenido de esas mismas páginas resumido por
  el buscador. La mayoría de los puntos 1 a 6 salen de ahí. **No pude citarlos
  textualmente ni ver la tabla de parámetros.**
- **Abrir de primera mano el SDK oficial de Python en GitHub y PyPI.** Eso sí
  lo leí yo, y de ahí salen los hallazgos más duros del punto 8.

Marco cada afirmación con **[buscado]** o **[verificado]**. Los tres puntos que
son carga estructural de la decisión —`marketplace_fee` opcional, quién es el
cobrador, y el orden de descuento de comisiones— están en **[buscado]**, así que
**te pido que los confirmes vos en la documentación antes de comprometer nada
con la clienta**. No quiero que una decisión de cobro se apoye en un resumen de
buscador, ni siquiera coincidente.

## 1. Veredicto sobre tu hipótesis

Tu hipótesis dice tres cosas. **Dos son correctas y una es falsa.**

| Afirmación | Veredicto |
|---|---|
| Checkout Pro con token OAuth de cada vendedor **cumple el checkout vendido** | **Correcto** |
| …y **sin comisión de marketplace TopGreen no recibe ni redistribuye fondos** | **Correcto** |
| …y es **la forma mínima** | **Falso: es la más chica de las aceptables, no la mínima** |

Sobre «más segura»: **correcto, pero por comparación, no en absoluto**. Es más
segura que la única otra manera de tener a cada vendedor como cobrador, que
sería pedirle que pegue su propio access token en el perfil. Eso sería peor:
token sin alcance acotado, sin vencimiento manejado, sin flujo de revocación y
con acceso completo a su cuenta. OAuth existe justamente para no hacer eso.

**Dónde está el error de «mínima».** La forma mínima de no tocar fondos de
terceros ya la tenemos funcionando y se llama transferencia bancaria directa:
cero credenciales de terceros guardadas, cero ciclo de vida de tokens, cero
webhooks. Lo que OAuth agrega no es seguridad frente a la custodia —eso ya está
resuelto— sino **una capacidad comercial nueva**: pagar con tarjeta. Es una
distinción que importa para lo que se le promete a la clienta: no es «lo mínimo
para cumplir», es «lo más chico que además cobra con tarjeta».

Y agrega una carga permanente que no tiene la transferencia: **credenciales de
terceros en nuestra base, que vencen y hay que renovar**. Eso es superficie de
riesgo nueva, no menos.

## 2. ¿Admite Mercado Pago Argentina ese flujo? ¿`marketplace_fee` puede ser cero?

**Sí al flujo.** **[buscado]** La integración de marketplace en Argentina se hace
«necesariamente usando un access token por cada vendedor, obtenido mediante
OAuth», y la solución de Split de pagos «sólo puede integrarse con Checkout Pro,
Checkout API y Checkout Bricks».

**Sí a la comisión en cero.** **[buscado]** `marketplace_fee` es **opcional en
`POST /checkout/preferences` y su valor por defecto es 0**. O sea: se puede
omitir y el efecto es no cobrar nada.

**Pero ojo con una consecuencia que tu hipótesis no menciona:** aunque la
comisión sea cero, **seguís necesitando la aplicación de marketplace y el
vínculo OAuth por vendedor**. La comisión cero te ahorra el dinero, no el
andamiaje. El costo de esta pieza está casi todo en el andamiaje.

## 3. ¿Quién cobra y quién paga la comisión de Mercado Pago?

**Cobra el vendedor.** **[buscado]** El pago se crea con su access token, así que
el `collector` es su cuenta y el dinero entra ahí. TopGreen no aparece en el
circuito del dinero en ningún momento: no lo recibe, no lo retiene y no lo
redistribuye. **Esto es lo que hace que la hipótesis cumpla la regla del
proyecto**, y es su mérito principal.

**La comisión normal de Mercado Pago la paga el vendedor.** **[buscado]** Se
descuenta de lo que él recibe, y el orden es: primero la comisión de Mercado
Pago, después la del marketplace sobre el remanente. Con `marketplace_fee` en
cero, el segundo descuento no existe y el vendedor recibe el total menos la
comisión de Mercado Pago.

**Consecuencia que hay que decirle a la clienta con todas las letras:** el
vendedor **no** recibe el 100 %. Recibe el total menos lo que le cobra Mercado
Pago por procesar. Eso no lo decide TopGreen ni lo puede evitar; es el precio de
aceptar tarjetas. Si la propuesta le dio a entender otra cosa, hay que
corregirlo antes y no después de la primera venta.

**Y una consecuencia operativa:** si el dinero es del vendedor, **TopGreen no
puede devolverlo**. Reembolsos, contracargos y disputas quedan entre comprador y
vendedor, o entre el vendedor y Mercado Pago. El módulo heredado tiene un
`process_refund` que, en este modelo, o no puede existir o pasa a ser «pedirle
al vendedor que devuelva, con su token». No es lo mismo y hay que diseñarlo.

## 4. ¿Cubre crédito, débito y dinero en cuenta?

**Sí, y de sobra.** **[buscado]** Checkout Pro en Argentina ofrece tarjeta de
crédito (Visa, Mastercard, Amex, Naranja, Nativa, Shopping, Cencosud, Cabal),
tarjeta de débito, efectivo y **dinero disponible en Mercado Pago**, además de
pago como invitado sin cuenta.

Dos detalles finos: **[buscado]** el medio «dinero en cuenta» **no se puede
excluir** de la preferencia, y aparece también «cuotas sin tarjeta», que es
crédito de Mercado Pago. Si la propuesta dice «crédito, débito y dinero en
cuenta», Checkout Pro entrega eso y algo más. No hay riesgo por ese lado.

## 5. Onboarding, credenciales, OAuth, refresh, cifrado y revocación

Esto es el verdadero tamaño de la pieza. Por **cada vendedor**:

1. **Vinculación.** El vendedor tiene que tener cuenta de Mercado Pago y pasar
   por el flujo `authorization_code`: sale de TopGreen, autoriza en Mercado Pago,
   vuelve a nuestra `redirect_uri`. **[buscado]** Si el vendedor no tiene cuenta
   MP, este camino no existe para él y necesita el de transferencia. Ya lo
   tenemos, así que la caída es blanda.
2. **Vencimiento.** **[buscado]** El access token dura **180 días** y las
   credenciales del vínculo, **6 meses**. Si no se renueva antes, **hay que
   rehacer la vinculación entera con intervención del vendedor**.
3. **Renovación.** **[buscado]** Con `grant_type=refresh_token`, y sólo si la
   autorización se pidió con `scope=offline_access`. Cada renovación devuelve
   access token **y refresh token nuevos**: hay que guardar los dos y rotar.
4. **Cifrado.** Esto no es de la documentación, es nuestro: **hoy
   `users.mp_access_token` es un `String(500)` en claro**, igual que
   `mp_refresh_token`. Un token de esos es la capacidad de cobrar en nombre de
   una persona real. **Si esta pieza avanza, esas dos columnas tienen que estar
   cifradas en reposo, y eso es migración y manejo de clave.** No está hecho ni
   presupuestado.
5. **Revocación.** El vendedor puede revocar desde su cuenta de Mercado Pago sin
   avisarnos. Nuestro lado tiene que tolerar «el token dejó de servir» como
   estado normal —no como error 500— y tiene que ofrecer desvincular desde
   TopGreen, que además significa borrar los tokens de nuestra base.

Traducido: **no es «guardar un token». Es un ciclo de vida con vencimiento,
rotación, cifrado, revocación y un estado de vendedor «vínculo caído» que la
interfaz tiene que mostrar.** Eso es lo que hay que presupuestar.

## 6. Una orden por vendedor, y el carrito de varios

Acá el modelo encaja bien y a la vez trae la peor noticia de UX.

**Encaja bien:** ya creamos una orden por vendedor. Cada orden tiene un único
cobrador, que es exactamente lo que este flujo necesita. No hay que reagrupar
nada.

**La mala noticia:** un carrito con tres vendedores son **tres preferencias,
tres redirecciones y tres pagos**. No hay forma, en este modelo, de que un solo
pago se reparta entre las cuentas de tres vendedores distintos: el split es 1:1
—un marketplace y un vendedor— y el cobrador es uno solo por pago. **[buscado]**

Eso hay que diseñarlo antes de escribir nada: qué ve la persona cuando pagó dos
de tres, qué pasa si abandona en el segundo, cómo se muestra un carrito
parcialmente pagado. **Y notá que esto ya existe hoy con transferencia** —una
transferencia por vendedor— sólo que ahí la fricción es evidente y esperada,
mientras que en un checkout con tarjeta tres redirecciones se sienten como un
error del sitio.

Es, para mí, el punto que más puede sorprender a la clienta y el que menos tiene
que ver con lo técnico.

## 7. Preferencia, retorno, webhook, idempotencia y estados

Lo que hace falta, separando lo que se puede probar solo de lo que no:

**Se puede probar automático, sin credenciales reales:**

- que la preferencia se arme con los ítems, el `external_reference` y las
  `back_urls` correctas, y que **no** lleve `marketplace_fee` —o lleve cero—;
- que el receptor de webhook **valide la firma**. **[buscado]** Mercado Pago
  manda `x-signature` con `ts` y `v1`, y se valida con HMAC-SHA256 usando un
  secreto por aplicación que se saca del panel. Una notificación con firma
  inválida tiene que rechazarse, y eso se prueba con notificaciones sintéticas;
- que sea **idempotente**: la misma notificación dos veces no puede aprobar dos
  veces ni descontar stock dos veces. **[buscado]** Mercado Pago **reintenta cada
  15 minutos** hasta recibir 200/201, con 22 segundos de ventana para responder,
  así que los reintentos no son hipotéticos: son el funcionamiento normal;
- que la máquina de estados de la orden aguante notificaciones **fuera de
  orden** y **atrasadas**;
- que un webhook nunca confíe en el cuerpo: hay que **volver a consultar el pago
  a la API** con el token del vendedor antes de mover una orden.

**No se puede probar sin credenciales reales:** que Mercado Pago efectivamente
cobre, que el dinero caiga en la cuenta del vendedor y que la comisión sea la
esperada. Eso es una prueba manual, en sandbox primero y con un monto chico real
después, y **necesita una URL pública para el webhook**. Hoy el módulo heredado
resuelve eso con una constante `NGROK_URL` clavada en el código; eso no puede
quedar así.

**Verificado de primera mano:** el SDK oficial de Python **manda
`x-idempotency-key` en cada request y lo autogenera si no se lo damos**. Sirve
para no crear dos preferencias por un doble clic, pero **no** resuelve la
idempotencia de los webhooks, que es nuestra y va en la base.

## 8. El módulo heredado: qué sirve y qué no

Me pediste que no lo tomara como autoridad. Lo miré con eso en la cabeza y está
peor de lo que decía la deuda.

**No está montado.** `payments.py` no aparece en los `include_router` de
`main.py`. No es código que hoy corra: es un borrador.

**Tiene un error de dinero, no de estilo.** Cobra la comisión **dos veces**:
infla cada precio unitario un 5 % —el comprador paga 105 %— **y además** manda
`marketplace_fee` con el mismo importe. Con split activo, el vendedor recibe
105 % menos la comisión de Mercado Pago menos 5 %, o sea alrededor del 100 %
menos la comisión de Mercado Pago; pero el módulo **guarda en la base
`seller_amount = 100 %`** y el comentario dice «el vendedor recibe el 100 %».
**El número que registra no es el que el vendedor cobra.** Si esto hubiera
llegado a producción, la discusión con un vendedor no habría sido técnica.

**Está dos versiones mayores atrás.** **Verificado:** tenemos
`mercadopago==2.2.1` fijado; la última es **3.5.0, publicada ayer**. Y en el
changelog del SDK, también verificado por mí:

- **3.2.0** (27/05/2026): *«Introduced OAuth authorization flow»* — el soporte de
  OAuth del SDK es de hace tres meses; el módulo heredado lo hizo a mano;
- **3.3.0** (30/06/2026): *«Added Orders Checkout Pro support»* — hay una API de
  **Orders** para Checkout Pro además de la de preferencias que usa el módulo
  viejo. **No pude leer la documentación para saber si preferencias queda
  desaconsejada**, y es lo primero que hay que averiguar: define contra qué API
  se escribe la pieza entera;
- **3.4.0** (04/08/2026): *«fixed webhook validation issues»* — hace ocho días;
- **3.5.0** (11/08/2026): renombres de clases de ítem y envío. Actualizar no es
  cambiar un número.

**Qué se puede reutilizar, después de comparar:** la **forma** —tabla `payments`
con `mp_preference_id`, `mp_payment_id`, `external_reference` y estados; el
enganche con `orders`— es razonable y sobrevive. Lo que hay que tirar es la
aritmética de comisión, el `NGROK_URL`, la ausencia de validación de firma y el
supuesto de que el token del vendedor se guarda en claro. Las columnas
`commission_amount`, `commission_percent` y `seller_amount` son `NOT NULL`: con
comisión cero quedan en cero, lo cual funciona, pero **`seller_amount` pasaría a
ser un nombre que miente** salvo que se recalcule descontando la comisión de
Mercado Pago, que nosotros no conocemos hasta que el pago existe.

## 9. Tamaño y riesgos, contra la alternativa de que cobre TopGreen

**Tamaño de la hipótesis (OAuth, comisión cero), a grandes rasgos:**

| Bloque | Peso |
|---|---|
| Aplicación de marketplace, OAuth, callback, refresh, revocación | el más grande |
| Cifrado en reposo de los tokens + migración | mediano, y **no negociable** |
| Preferencia por orden + retorno + carrito multivendedor en la interfaz | mediano |
| Webhook con firma, idempotencia y máquina de estados | mediano |
| Actualizar el SDK dos majors y decidir preferencias vs. Orders | chico, pero **primero** |
| Prueba manual con credenciales reales y URL pública | chico, y fuera de la suite |

**La alternativa de que cobre TopGreen no es una alternativa.** No por tamaño:
por regla. El proyecto tiene escrito que la plataforma no recibe, retiene ni
administra fondos de terceros, con la suscripción como única excepción. Cobrar
TopGreen y girar después es exactamente eso, y además arrastra obligaciones
regulatorias que no vamos a asumir en un MVP. **No la compares por esfuerzo,
descartala por criterio** —y si alguna vez se reabre, que se reabra como
decisión de negocio con asesoramiento, no como opción técnica.

## 10. Lo que yo decidiría

1. **Confirmá vos los tres puntos [buscado] que sostienen la decisión**:
   `marketplace_fee` opcional con default 0, el vendedor como cobrador, y el
   orden de descuento de comisiones. Yo no pude abrir esas páginas.
2. **Averiguá si la pieza se escribe contra preferencias o contra Orders**, antes
   de una sola línea. Cambia todo el módulo.
3. **Decidile a la clienta las dos consecuencias que no son técnicas**: el
   vendedor no recibe el 100 %, y un carrito de tres vendedores son tres pagos.
4. Si sigue adelante, **el cifrado de los tokens entra en la misma pieza**, no
   después.

Y una observación de alcance, porque es la que más plata ahorra: **hoy ya se
puede comprar y pagar por transferencia, sin custodia y sin credenciales de
terceros**. Mercado Pago agrega tarjeta, que es conversión, no capacidad. Si el
calendario aprieta, es una pieza que se puede correr sin romper la promesa
central del producto —siempre que a la clienta se le haya prometido «checkout
básico» y no «tarjeta desde el día uno».

## 11. Estado del repositorio

Sin cambios de producto. Lo último entregado sigue siendo el contrato monetario
(`2220e94`) con su informe (`8abaeb2`): suite 61/61, puerta del hito 6/6, build y
`diff --check` verdes. `payments.py` sigue desmontado, la comisión sigue sin
restaurarse y no toqué esquema ni entorno, como pediste.

## Fuentes

Documentación oficial, **consultada por buscador y no abierta directamente**
—ver punto 0—:

- [Checkout Pro — integrar en marketplace](https://www.mercadopago.com.ar/developers/en/docs/checkout-pro/how-tos/integrate-marketplace)
- [Split de pagos — integrar el checkout](https://www.mercadopago.com.br/developers/en/docs/split-payments/integration-configuration/integrate-marketplace)
- [Split de pagos — configuración de la integración](https://www.mercadopago.com.ar/developers/en/docs/split-payments/integration-configuration)
- [Split de pagos 1:1](https://www.mercadopago.com.ar/developers/en/docs/split-payments/split-1-1/overview)
- [Crear preferencia — referencia de API](https://www.mercadopago.com.mx/developers/es/reference/preferences/_checkout_preferences/post)
- [OAuth — creación del token](https://www.mercadopago.com.ar/developers/en/docs/checkout-api-payments/additional-content/security/oauth/creation)
- [OAuth — renovación](https://www.mercadopago.com.ar/developers/en/docs/subscriptions/additional-content/security/oauth/renewal)
- [OAuth — gestión del token](https://www.mercadopago.com.ar/developers/en/docs/split-payments/additional-content/security/oauth/management)
- [OAuth — buenas prácticas](https://www.mercadopago.com.ar/developers/en/docs/checkout-api-payments/additional-content/security/oauth/best-practices)
- [Checkout Pro — notificaciones de pago](https://www.mercadopago.com.ar/developers/en/docs/checkout-pro/payment-notifications)
- [Validez de las notificaciones](https://www.mercadopago.com.br/developers/en/news/2024/02/27/Ensure-the-validity-of-notifications-sent-by-Mercado-Pago)
- [Checkout Pro — introducción (medios de pago)](https://www.mercadopago.com.ar/developers/es/guides/online-payments/checkout-pro/introduction)
- [Checkout API vía Orders](https://www.mercadopago.com.ar/developers/en/docs/checkout-api-orders/overview)

Abierto y leído por mí:

- [SDK oficial de Python — opciones de request](https://raw.githubusercontent.com/mercadopago/sdk-python/master/mercadopago/config/request_options.py)
- [SDK oficial de Python — changelog](https://raw.githubusercontent.com/mercadopago/sdk-python/master/CHANGELOG.md)
- [`mercadopago` en PyPI](https://pypi.org/pypi/mercadopago/json)
