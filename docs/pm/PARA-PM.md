# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-14. Séptimo informe: **la corrección corta de MP-D**.

Gracias por abrir la documentación y traer las seis respuestas. Corregí las seis
cosas y no toqué nada más: sin ejecutar la homologación, sin infraestructura y
sin cambiar la validación.

## 1. Los seis puntos

**1. Webhooks en el panel: dejó de ser un `[VERIFICAR]` y pasó a ser paso
obligatorio.** El runbook ahora dice los tres pasos —cargar la URL de prueba,
seleccionar el evento **Pagos**, guardar— y dice lo que faltaba y explica por
qué importa: **ahí es donde se genera el secreto de firma**. Sin ese paso no hay
`MP_WEBHOOK_SECRET`, y sin secreto el webhook responde 503 a todo.

Y quedó escrito que panel y payload cumplen funciones distintas y hacen falta
los dos: el panel declara la integración y crea el secreto; la
`notification_url` de cada preferencia es la que rige para ese pago y **tiene
prioridad**. Antes el documento dejaba entender que con mandarla en el payload
alcanzaba.

**2. Los tres perfiles.** Agregué una tabla que resuelve quién es quién antes de
tocar el panel: **integrador** es la cuenta dueña de la aplicación —TopGreen—, y
no cobra ni paga; **vendedor** y **comprador** son las dos cuentas de prueba.
Tres roles, no cuatro cuentas, y lo digo con esas palabras para que nadie fabrique
una cuenta de más.

La única comprobación humana que dejé abierta es la que corresponde: si el panel
exigiera que la aplicación la cree una cuenta de prueba integradora en vez de la
cuenta real, se hace lo que diga el panel y se anota. No inventé una cuarta
cuenta para taparla.

**3. Firma: confirmada, y la inconsistencia registrada.** El manifiesto, la
omisión entera del campo ausente y la minúscula del `data.id` alfanumérico
coinciden. Quedó anotado que la página oficial llama milisegundos al `ts` pero
muestra un ejemplo de diez dígitos, que son segundos; el código tolera las dos
formas y **no cambia el valor que firma**, así que la ambigüedad no lo afecta.
No abrí ningún cambio funcional por esto.

**4. Respuesta de pago: dicho como corresponde.** El runbook ahora afirma que la
referencia oficial documenta `collector_id` arriba, la metadata, el
`external_reference`, la moneda y el importe, y que **no documenta
`preference_id`**. Por lo tanto la política actual queda como está y es la
correcta: comparar el `preference_id` **sólo si viene**, y atar fuerte por el
`orden_id` de la metadata.

**5. Cierre de preferencia: compatible, y lo que falta observar.** Queda dicho
que la API oficial de actualización acepta `expires`, `expiration_date_from` y
`expiration_date_to` —que es lo que manda el código—, y quedan marcadas como
**[CONFIRMAR EN LA EJECUCIÓN]** las dos cosas que la documentación no responde:
que una fecha pasada deje el link inutilizable de verdad, y qué devuelve al
repetir el cierre. Los pasos 9 y 11 del guion son los que lo miran.

Anotado también que no se confunda con `date_of_expiration`, que es para pagos
offline.

**6. `atm` dejó de presentarse como universal.** `ticket` está documentado como
excluible. Para `atm` el runbook ahora pide mirarlo en `GET /v1/payment_methods`
con el token argentino de prueba durante la ejecución, y dice explícitamente que
si no apareciera **no es un problema** —excluir un tipo que no existe no rompe
nada— y que no bloquea la preparación ni justifica tocar el código antes de
verlo.

## 2. El comentario falso de `config.py`

Corregido, y **sólo el comentario**: el validador quedó intacto, y lo verifiqué
mirando el diff línea por línea —ninguna línea del `field_validator` ni del
`raise` cambió—.

Decía que toda query degrada el aviso a IPN. Ahora dice el motivo verdadero por
el que la base se declara sin query: **el parámetro que decide qué clase de
aviso llega lo tiene que poner el código y no el entorno**, y aceptar query
arbitraria dejaría que una variable mal puesta lo pise. Y aclara que «vacía» no
es lo mismo que «sin webhook», porque el panel y el payload son cosas distintas.

## 3. El aviso perdido, sin dominio ajeno

Cambié el paso 13 del guion. Antes decía «apuntar la URL a otro lado», que es
justamente lo que no hay que hacer: mandarle a un tercero avisos con datos de un
pago es filtrarlos, y además deja el resultado a merced de lo que ese tercero
conteste.

Ahora es un fallo controlado y reversible **sobre nuestro propio dominio**: se
apunta `MP_NOTIFICACION_URL` a una ruta que no existe en la misma API
—`{API}/api/mp/webhook-fuera-de-servicio`—, con **una sola orden en vuelo**, se
paga, se restaura la variable y se corre el reconciliador. El motivo de cada
decisión está escrito al lado del paso.

## 4. Comprobación focal

Como pediste, sin repetir la suite.

| | |
|---|---|
| Caso 95 —firma antes del cuerpo y `source_news=webhooks`— | **PASS** |
| `git diff --check` (con `cr-at-eol`) | limpio |
| Diff de `config.py` | 11 líneas, todas de comentario; validador sin tocar |

Una cosa que no puedo darte y prefiero decir por qué: **el caso 79 no se puede
correr aislado**. Depende de `state.location`, que arma un caso temprano, así que
filtrado explota con `localityId` indefinido antes de llegar a lo suyo. No es una
regresión: el 79 pasó en la corrida completa 100/100 de `b8d69cd`, y desde
entonces lo único que cambió en el producto es un comentario. Si querés el 79
verde de nuevo hay que correr la suite entera, y dijiste que no hacía falta.

## 5. Lo que sigue igual

Sin ejecutar la homologación, sin infraestructura nueva, sin tocar Railway, la
bandera en `false` y ninguna credencial en el repositorio.

Sigue haciendo falta, en este orden: que Emi cree la aplicación y las dos cuentas
de prueba, configure Webhooks en el panel —que es lo que genera el secreto— y
cargue las variables; y una orden explícita para ejecutar, que no tengo.
