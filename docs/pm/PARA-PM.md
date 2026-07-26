# Dev → PM

## Debate: hoy no podemos afirmar que la plataforma nunca toca fondos

La afirmación es correcta como decisión de producto, pero **no describe una
propiedad actual del código**.

Hoy no se mueve dinero porque las credenciales están vacías. Eso es un apagado
por configuración, no una desactivación por diseño. El frontend llega a
Mercado Pago y al OAuth; los routers están montados; y la propia interfaz
explica qué variables completar para reactivarlos.

Si alguien configura esas variables:

- con vendedor vinculado, se crea una preferencia con el token del vendedor y
  `marketplace_fee` para TopGreen;
- sin vendedor vinculado, el código crea la preferencia con el token de
  TopGreen y documenta que el 100% del pago va a TopGreen para liquidación
  manual.

Por lo tanto, **la frase contractual sería falsa apenas se habilite la
integración heredada**. No hago una conclusión jurídica sobre PSP; mi
conclusión es técnica sobre el flujo real de fondos que implementa el código.

No modifiqué ni desactivé nada en esta vuelta.

## 1. Caminos alcanzables desde la interfaz

### Checkout de Mercado Pago: sí

`CheckoutModal.tsx`:

1. ofrece Mercado Pago y lo deja seleccionado por defecto;
2. crea una orden por `/orders/checkout`;
3. llama a `/payments/create-preference`;
4. redirige al `init_point` devuelto.

Sin credenciales, el último llamado termina en `503`, pero la orden ya quedó
creada. Con credenciales, el camino continúa.

### OAuth de vendedores: sí

`UserDashboard.tsx`:

- consulta `/mp-oauth/status` al montar;
- muestra `Vincular MercadoPago`;
- el botón llama `/mp-oauth/auth-url`;
- el callback procesa `mp_linked=success`;
- también hay botón para desvincular.

Hay además un detalle: `/mp-oauth/status` devuelve `200` aunque la aplicación
no esté configurada. Entonces el frontend interpreta que Mercado Pago está
disponible pero la cuenta no está vinculada, y muestra el botón activo. Recién
al pulsarlo, `/auth-url` responde `503`.

### Sincronización posterior: sí

`PaymentResultPage.tsx` llama a
`/payments/sync-status/{order_id}` cuando se abre la pantalla de pago exitoso.

## 2. Endpoints montados

El OpenAPI local muestra **13 rutas activas**:

```text
/api/payments/create-preference [POST]
/api/payments/webhook [POST]
/api/payments/order/{order_id}/status [GET]
/api/payments/simulate-payment/{order_id} [POST]
/api/payments/public-key [GET]
/api/payments/sync-status/{order_id} [POST]
/api/payments/refund/{order_id} [POST]
/api/mp-oauth/manual-link [POST]
/api/mp-oauth/auth-url [GET]
/api/mp-oauth/callback [GET]
/api/mp-oauth/status [GET]
/api/mp-oauth/unlink [POST]
/api/mp-oauth/refresh-token [POST]
```

Verificación HTTP de sólo lectura contra el backend local:

```text
GET /mp-oauth/status   -> 200, is_linked=false
GET /mp-oauth/auth-url -> 503, integración no configurada
GET /payments/public-key -> 200, configured=false
```

No ejecuté `create-preference`, `manual-link`, reembolsos ni ningún endpoint
que pudiera contactar Mercado Pago o mutar una orden.

## Hallazgo crítico adicional: el simulador está activo

`POST /payments/simulate-payment/{order_id}` no comprueba entorno ni
credenciales de Mercado Pago.

Un comprador autenticado puede llamar el endpoint sobre una orden propia en
estado `PLACED` y pasarla a `PAID` sin pagar. También crea un registro de pago
simulado e incrementa contadores. No descuenta stock en el camino aprobado, de
modo que además deja datos inconsistentes.

No hay llamada desde el frontend, pero esconderlo no lo protege: está montado
y figura en OpenAPI.

`manual-link` también está montado y permite guardar un access token de un
usuario de Mercado Pago sin requerir que la aplicación marketplace esté
configurada. `refund` puede contactar Mercado Pago usando el token del
vendedor. Ambos son argumentos adicionales para no tratar el problema como
sólo visual.

## 3. ¿Alcanza con ocultarlos?

**No.** Ocultar botones sólo cambia la interfaz; cualquier cliente HTTP puede
llamar las rutas.

Mi recomendación, si la definición contractual es permanente, es:

1. quitar Mercado Pago como opción del checkout y quitar la sección OAuth del
   panel;
2. dejar de montar en el backend los routers `payments` y `mp_oauth`;
3. conservar el código en Git mientras se decide si se elimina, pero hacerlo
   inalcanzable en runtime;
4. agregar un smoke que confirme que las rutas financieras ya no están
   expuestas.

Un feature flag apagado por defecto sería mejor que las credenciales vacías,
pero sigue permitiendo convertir en falsa la afirmación contractual con una
configuración. Si “TopGreen nunca toca fondos” es una condición del producto,
prefiero routers no montados.

## CBU y alias en nuestra base

Me parece razonable guardarlos para este contrato: son las instrucciones que
el comprador necesita para transferir y no son una credencial con la que pueda
debitar la cuenta. Igual los trataría como dato personal financiero:

- acceso sólo del titular y de compradores con una operación;
- nunca en logs;
- backups y base cifrados por infraestructura;
- sin copiarlos a analítica ni notificaciones;
- borrado cuando el vendedor cierre su cuenta, sujeto a la política legal que
  defina la clienta.

No agregaría cifrado casero a nivel aplicación ahora: sin una política de
claves sería seguridad aparente y complicaría búsquedas, backups y rotación.

Sí encontré una inconsistencia: la orden **no guarda una foto de los datos
bancarios usados al crearla**. `/orders/my` lee el CBU y alias actuales del
perfil. Si el vendedor los cambia con una orden pendiente, el comprador pasa a
ver otros datos y no queda registro de cuáles se mostraron en checkout.

La solución limpia sería guardar CBU, alias y titular como snapshot de la
orden. Eso requiere ampliar el esquema y no lo hago sin aprobación.

## El comprobante

Coincido: el archivo no prueba el pago.

Podemos validar extensión, tamaño y que el almacenamiento haya funcionado.
OCR, QR, importe escrito, nombre del banco o metadatos pueden ayudar a leerlo,
pero todo eso también se falsifica. Sin consultar al banco o a un proveedor de
pago no existe validación confiable de acreditación.

La decisión correcta es la actual: el vendedor verifica su cuenta bancaria.
El texto de la Tarea 5 bis es necesario.

## Transferencia insuficiente

No rompe una restricción de base ni descuenta stock antes de tiempo. Pero hay
dos estados de negocio que el modelo actual no puede representar:

1. Si el vendedor aprueba un pago parcial, la orden queda `PAID` por el total.
   No guardamos importe recibido, saldo ni aprobación parcial.
2. Si lo rechaza, la orden queda terminalmente `REJECTED`. El comprador no
   puede adjuntar un segundo comprobante ni completar el saldo sobre la misma
   orden; además, su carrito ya fue convertido.

No inventaría una solución. La clienta tiene que elegir entre:

- rechazo y creación de una orden nueva;
- permitir reintento/comprobante adicional;
- registrar pago parcial y saldo pendiente.

Hasta esa definición, el vendedor no debería aprobar si el importe acreditado
no coincide con el total mostrado.

## Estado de las tareas

No empecé Tarea 5 bis ni Tarea 5. La discusión figura antes de las tareas y
preferí devolver primero el estado real, especialmente por el simulador de
pago alcanzable.
