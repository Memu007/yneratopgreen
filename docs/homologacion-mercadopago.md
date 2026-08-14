# Homologación de Mercado Pago

Este documento deja lista una homologación **reproducible** del cobro por
Mercado Pago sobre un Railway descartable. No la ejecuta y no la habilita: la
bandera `MP_CHECKOUT_HABILITADO` sigue en `false` hasta que exista una orden
explícita.

Está escrito para que lo siga una persona, en orden, sin tener que leer el
código.

> **Lo que este documento no puede afirmar todavía.** El entorno de desarrollo
> tiene la salida a `mercadopago.com` bloqueada por política de red —todos los
> dominios: `.com.ar`, `.com.br`, `.com.mx`, `.cl`—, así que no fue posible
> contrastar contra la documentación oficial vigente. Cada punto que depende de
> esa documentación está marcado con **[VERIFICAR]** y dice exactamente qué hay
> que mirar. Lo que **no** está marcado sale del código de este repositorio o de
> una prueba local, y es verificable acá mismo.

---

## 1. Qué tiene que crear o autorizar Emi

Nada de esto se guarda en el repositorio. Ningún valor de esta lista viaja a
Git, y quien escribe el código no necesita —ni debe— recibir las contraseñas.

| # | Qué | Para qué | Dónde termina el valor |
|---|---|---|---|
| 1 | Cuenta de Mercado Pago de TopGreen | Es la dueña de la aplicación | No produce variable |
| 2 | Una **aplicación** en el panel de desarrolladores, con Checkout Pro | Da las credenciales de la integración | `MP_APP_ID`, `MP_CLIENT_SECRET` |
| 3 | **URL de redirección OAuth** declarada en esa aplicación | Sin declararla, el vínculo del vendedor falla | `MP_REDIRECT_URI` |
| 4 | **Secreto de firma de notificaciones** de esa aplicación | Autentica cada Webhook | `MP_WEBHOOK_SECRET` |
| 5 | **Cuenta de prueba vendedora** | Es quien cobra en la homologación | Ninguna: se vincula por OAuth |
| 6 | **Cuenta de prueba compradora** | Es quien paga | Ninguna: se usa en el navegador |
| 7 | Una **clave Fernet** nueva para el Railway descartable | Cifra los tokens de los vendedores | `MP_TOKEN_KEY` |

La clave del punto 7 se genera así, y el valor **no se pega en ningún archivo
del repositorio**:

```
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**[VERIFICAR]** Los puntos 2, 3, 4, 5 y 6 dependen de la navegación real del
panel de Mercado Pago, que cambia. Antes de ejecutar hay que confirmar contra la
documentación oficial vigente: cómo se crean las cuentas de prueba, si la
aplicación necesita algún permiso o *scope* adicional para OAuth de terceros,
dónde aparece el secreto de firma, y si la URL de notificación se declara en el
panel además de mandarse en cada preferencia.

**Lo que yo no hago, y conviene que quede escrito:** no pido, no recibo y no
guardo contraseñas, tokens ni claves. Si algún paso las necesita, se detiene
ahí y lo hace Emi.

---

## 2. Variables y URLs exactas

Con `{API}` = dominio público del backend en el Railway descartable y
`{FRONT}` = dominio público del frontend.

### URLs que hay que declarar

| Qué | Valor exacto | De dónde sale |
|---|---|---|
| Redirección OAuth | `{API}/api/mp-oauth/callback` | `mp_oauth.py`, prefijo `/mp-oauth` + `API_PREFIX` |
| Notificación (Webhook) | `{API}/api/mp/webhook` | `mp_webhook.py`, prefijo `/mp` + `API_PREFIX` |
| Retorno del comprador | `{FRONT}/payment/success`, `/payment/pending`, `/payment/failure` | `mp_preferencia.py`, `back_urls` |

La URL de notificación **se declara sin query string**. El único parámetro que
viaja es `source_news=webhooks`, y lo agrega el código
(`mp_preferencia.url_de_aviso()`); la variable de entorno lo rechaza si viene
escrito a mano, y falla al arrancar en vez de fallar en la primera notificación.

### Variables mínimas

| Variable | Valor | Secreto |
|---|---|---|
| `MP_APP_ID` | del panel | no |
| `MP_CLIENT_SECRET` | del panel | **sí** |
| `MP_REDIRECT_URI` | `{API}/api/mp-oauth/callback` | no |
| `MP_TOKEN_KEY` | clave Fernet generada | **sí** |
| `MP_WEBHOOK_SECRET` | del panel | **sí** |
| `MP_NOTIFICACION_URL` | `{API}/api/mp/webhook` | no |
| `MP_TOLERANCIA_FIRMA_SEGUNDOS` | `300` | no |
| `MP_MINUTOS_DE_VIGENCIA` | `30` | no |
| `MP_MINUTOS_DE_GRACIA` | `10` | no |
| `MP_CHECKOUT_HABILITADO` | **`false`** | no |
| `FRONTEND_URL` | `{FRONT}` | no |

Las tres marcadas como secretas van al gestor de variables del entorno. No van a
Git, no van a un archivo de ejemplo con valor, y no se pegan en un chat.

`MP_CHECKOUT_HABILITADO` arranca en `false` **incluso durante la homologación**:
se enciende como primer paso del guion de la sección 4 y se vuelve a apagar al
terminar.

**[VERIFICAR]** Que no falte ninguna variable del lado de Mercado Pago: si la
aplicación exige declarar la URL de notificación en el panel —y no sólo por
preferencia—, hay que declararla ahí también.

---

## 3. El reconciliador

### Comando

```
python -m app.reconciliar
```

Un solo comando, sin argumentos, sin cola y sin framework. Imprime una línea
`RECONCILIACION {json}` con el conteo por resultado.

### Frecuencia propuesta

**Cada 5 minutos.**

El razonamiento, para que se pueda discutir con números: un link vive 30 minutos
(`MP_MINUTOS_DE_VIGENCIA`) y la reserva no se suelta hasta 10 minutos después de
vencido (`MP_MINUTOS_DE_GRACIA`). Una orden abandonada queda entonces con su
mercadería comprometida entre 40 y 45 minutos. Bajar el intervalo por debajo de
5 minutos no mejora eso de forma perceptible; subirlo por encima de 10 empieza a
sumar al peor caso. Cinco es el punto donde el barrido no es el cuello de
botella y tampoco corre al pedo.

### Prueba de que dos ejecuciones solapadas no duplican efectos

Está en la suite, caso **100**, y es una prueba de verdad: **dos procesos en
paralelo**, no dos llamadas seguidas.

El escenario tiene una orden abandonada y vencida —que hay que cancelar y
devolverle la unidad— y una cobrada sin aviso —que hay que procesar—, cada una
sobre una publicación distinta para poder atribuir cada efecto. Se lanzan los
dos barridos con `Promise.all` y se mide después.

Resultado, y acá está lo que importa:

```
corrida A   {"cobrada":1, "liberada":1, ...}
corrida B   {"cobrada":1, "vencida":1,  ...}
```

**Las dos corridas informan haber actuado sobre las mismas dos órdenes**, y sin
embargo hubo exactamente una cancelación, una unidad devuelta, un descuento de
stock, una venta contada y una sola fila de intento de pago.

Eso no es una contradicción: es el diseño. Lo que garantiza «una sola vez» no es
que el barrido se ejecute una sola vez —no se puede garantizar eso— sino el
`UPDATE ... WHERE` condicional sobre la marca de reserva, que la base serializa.
El que gana la fila aplica el efecto; el que la pierde no hace nada y lo dice
igual. **El resumen es un registro de lo que cada corrida miró, no un libro
mayor de efectos**, y conviene saberlo antes de leer esos números en producción.

Una tercera corrida posterior no mueve nada, que es la otra mitad de la
propiedad.

---

## 4. Guion de punta a punta

Con cuentas de prueba, en el Railway descartable. Cada paso dice qué mirar; si
lo observado no coincide, se frena ahí.

**Preparación**

0. Variables de la sección 2 cargadas, `MP_CHECKOUT_HABILITADO=false`,
   migraciones aplicadas (`alembic upgrade head`).

**Vínculo del vendedor**

1. Entrar como el vendedor de prueba en TopGreen y pedir el vínculo de Mercado
   Pago. → Redirige al consentimiento de Mercado Pago.
2. Autorizar con la **cuenta de prueba vendedora**. → Vuelve a TopGreen con el
   vínculo conectado.
3. Contrastar en la base: hay credenciales cifradas para ese vendedor y el
   `mp_user_id` es el de la cuenta de prueba. **Ningún token en claro.**

**Encendido acotado**

4. Recién ahora poner `MP_CHECKOUT_HABILITADO=true`. → Mercado Pago aparece como
   medio de pago para ese vendedor.

**Compra y cobro**

5. Como comprador de prueba: agregar al carrito una publicación de ese vendedor
   y confirmar eligiendo Mercado Pago. → Se crea la orden en `placed`, con
   `stock_reservado` en +1 y una fila de pago con `expires_at`.
6. Abrir el link. → La preferencia es de la cuenta del vendedor, el importe es
   exacto y **no viaja `marketplace_fee`**.
7. Pagar con un medio de prueba **aprobado**. → El navegador vuelve a
   `/payment/success`, que dice **«verificando»** y no «pagado».
8. Esperar el Webhook. → La orden pasa a `paid`, el stock se descuenta una vez,
   `sales_count` sube una vez, y comprador y vendedor ven **el mismo** estado.
9. Contrastar que la preferencia quedó **apagada** y `payments.link_cerrado` en
   verdadero.

**Rechazo**

10. Repetir 5–7 con un medio de prueba **rechazado**. → La orden sigue `placed`,
    la mercadería sigue reservada y el estado visible dice «rechazado», con el
    link todavía usable.

**Cancelación segura**

11. Cancelar una orden **sin cobrar**. → Se apaga el link primero, después vuelve
    la unidad, y la orden queda cancelada.
12. Intentar cancelar una orden **ya cobrada**. → HTTP 409, la orden sigue
    pagada y el inventario no se mueve.

**Aviso perdido**

13. Crear otra orden y pagarla, pero con la URL de notificación
    temporalmente apuntada a otro lado, para que el aviso no llegue. → La orden
    queda `placed` con la mercadería reservada.
14. Restaurar la URL y correr `python -m app.reconciliar`. → La orden pasa a
    `paid` por la consulta, sin haber recibido nunca el aviso.
15. Dejar vencer una orden sin pagar y correr el barrido. → Se cancela con su
    motivo y devuelve la unidad, **una sola vez**.

**Cierre**

16. `MP_CHECKOUT_HABILITADO=false`.
17. Contrastar en la base que no quedó ninguna reserva viva sin orden viva y que
    todo pago tiene su `link_cerrado`.

**[VERIFICAR]** Los medios de prueba aprobado y rechazado del paso 7 y 10 salen
de la documentación oficial y cambian por país; hay que tomarlos de ahí y no de
memoria.

---

## 5. Rollback

Qué se apaga, qué se sigue aceptando y cómo no se pierde un cobro.

### Se apaga

`MP_CHECKOUT_HABILITADO=false`. Efecto inmediato: **no se emite ninguna
preferencia nueva**. El medio deja de ofrecerse, pedirlo a mano da 400 y el
reintento del link responde «deshabilitado». La transferencia no se toca.

### Se sigue aceptando

**El Webhook sigue montado y sigue procesando.** Es a propósito y es la parte
que más importa del rollback: si se apaga la bandera después de que un link
viajó, ese pago **igual puede ocurrir**, y no registrarlo sería perder plata que
ya se movió. El endpoint no mira la bandera.

Lo mismo el reconciliador: se sigue corriendo hasta que no queden órdenes con
reserva viva ni links abiertos.

### Se preserva

- Ningún pago acreditado se borra ni se revierte. TopGreen **no ejecuta
  reembolsos**: una devolución se registra cuando Mercado Pago la informa.
- Las órdenes ya pagadas siguen pagadas y despachables.
- Las reservas vivas se sueltan por el camino de siempre —link apagado primero,
  después la mercadería—, nunca por reloj.

### Qué NO hacer en un rollback

- No bajar la migración. Las columnas nuevas no molestan con la bandera
  apagada, y bajarla borraría `mp_intentos_de_pago` y `link_cerrado`, que son
  el registro de lo que pasó.
- No desvincular a los vendedores: sin su token no se puede consultar el estado
  de un pago que quedó en vuelo.
- No borrar `MP_WEBHOOK_SECRET`. Sin el secreto, el webhook devuelve 503 y
  Mercado Pago reintenta contra el vacío hasta rendirse.
