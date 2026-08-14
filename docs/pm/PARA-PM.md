# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-14. Octavo informe: **el rótulo «API de Orders» y nuestra
integración**.

Al día desde `2fa4f3e`. Investigación solamente: no toqué código, ni Railway, ni
credenciales, ni webhooks.

## 1. No pude verificar contra la documentación oficial

Lo mismo que en MP-D, y lo compruebo de nuevo antes de decirlo:

```
https://www.mercadopago.com.ar/developers/es/docs        sin respuesta
https://www.mercadopago.com.ar/developers/es/reference   sin respuesta
https://api.mercadopago.com/                             sin respuesta
WebFetch → EGRESS_BLOCKED: "blocked by the network egress proxy"
```

La política de red del entorno sigue bloqueando `mercadopago.com`. No la rodeo y
no contesto de memoria: **esta pregunta decide si la integración entera sirve**,
y una respuesta mía sin fuente sería exactamente el tipo de afirmación que no se
puede usar para tomar esa decisión.

Lo único con fecha y fuente oficial que tenemos internamente es tu propia
verificación del 14/08, que abrió
`…/reference/online-payments/checkout-pro/preferences/update-preference/put`.
Que esa referencia exista **bajo Checkout Pro** es evidencia de que la API de
preferencias estaba documentada y vigente ese día — pero no responde por sí sola
qué habilita una aplicación rotulada «API de Orders», que es otra cosa.

## 2. La pregunta, precisada

«¿El rótulo permite nuestra integración?» es ambiguo y por eso es difícil de
responder. Lo que hay que resolver es esto, que es verificable:

> **¿Una aplicación dada de alta con ese producto autoriza estos cinco llamados,
> con el token OAuth de un vendedor tercero?**

Si la respuesta es sí para los cinco, el rótulo es cosmético y no cambia nada. Si
falla alguno, sabemos exactamente cuál y qué hay que rehacer.

## 3. El contrato exacto que hay que contrastar

Todo lo que el producto le pide a Mercado Pago, sacado del código y no de mi
memoria. Nada más que esto: no hay un sexto llamado escondido.

| # | Llamado | Para qué | Dónde está |
|---|---|---|---|
| 1 | `POST /checkout/preferences` | crear el link de pago | `mp_preferencia.py:171` |
| 2 | `PUT /checkout/preferences/{id}` | apagar un link ya emitido | `mp_pagos.py:166` |
| 3 | `GET /v1/payments/{id}` | la única fuente de verdad del estado | `mp_pagos.py:112` |
| 4 | `GET /v1/payments/search` | recuperar un aviso perdido | `mp_pagos.py:128` |
| 5 | `POST /oauth/token` | vincular y renovar al vendedor | `mp_vinculo.py:243` |

Más la pantalla de autorización (`/authorization`, `response_type=code`,
`mp_vinculo.py:218`) y los dos `grant_type` que usamos: `authorization_code` y
`refresh_token` (`mp_vinculo.py:285` y `:297`).

El cuerpo de la preferencia lleva exactamente: `items`, `external_reference`,
`back_urls`, `expires` con `expiration_date_from`/`expiration_date_to`,
`metadata`, `payment_methods.excluded_payment_types` y `notification_url`.
**No lleva `marketplace_fee`** —ni en cero— y no lleva `auto_return`.

El primero de los cinco es el que decide: **si una aplicación «API de Orders» no
autoriza `POST /checkout/preferences`, no hay integración**, porque el resto
cuelga de la preferencia que ese llamado crea.

## 4. Cómo se responde esto, de más barato a más caro

1. **Documentación oficial.** Vos tenés acceso y yo no. Dos preguntas concretas:
   ¿qué habilita el tipo de aplicación que el panel rotuló «API de Orders»?
   ¿`/checkout/preferences` sigue siendo el camino vigente de Checkout Pro, o
   quedó reemplazado por otro endpoint para altas nuevas?
2. **El panel de la aplicación.** La ficha de credenciales de
   `TopGreen Agro Argentina` (`2410255372643376`) lista qué productos quedaron
   habilitados. Es una mirada de Emi, sin tocar nada.
3. **Una sola llamada real, que es la prueba definitiva.** Crear **una**
   preferencia con el token de prueba y mirar el código de respuesta. Si
   devuelve 201, la pregunta está contestada de la única forma que no admite
   interpretación.

   Vale decir algo sobre esa tercera: **crear una preferencia no mueve dinero**
   —es pedir un link— así que es segura en ese sentido. Pero necesita
   credenciales, y hoy me dijiste que no las toque, así que **no la hice**. Queda
   propuesta, no ejecutada.

## 5. Qué pasaría si el rótulo sí importara

Para que la decisión no dependa de esperar: si resultara que esa aplicación no
sirve para preferencias, lo que hay que cambiar es **acotado y conocido**, y no
toca nada de lo que costó los últimos ciclos.

Lo que **no** se toca en ningún escenario: la firma del webhook, la máquina de
estados de cobro, la reserva de stock, el reconciliador, el candado, la
idempotencia. Todo eso opera sobre nuestras propias tablas y sobre
`GET /v1/payments/{id}`, no sobre la forma de crear el link.

Lo que se tocaría: el módulo que arma y apaga el link
—`mp_preferencia.py` y las dos rutas de preferencia en `mp_pagos.py`— y el
doble. Es la pieza más chica de todo el cobro, y está aislada justamente porque
es la que depende de una decisión de producto de Mercado Pago.

No lo estoy proponiendo ni empezando: lo digo para que sepas el tamaño del
riesgo mientras se consigue la evidencia.

## 6. Lo que no hice

No toqué código, Railway, credenciales ni webhooks. No creé ninguna preferencia.
No busqué la documentación en un dominio que el proxy no bloquee. No respondí de
memoria. La bandera sigue en `false`.
