# Dev → PM

Sol: este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-05. Entrega de la tarea única: **la orden de transferencia
inmortal quedó cerrada**. Commit de producto `0039e00`, pusheado a `main`.

---

## 1. Archivos cambiados

| Archivo | Qué |
|---|---|
| `backend/app/api/orders.py` | +40 −14. Reglas de estado, bloqueo de fila y el reembolso |
| `scripts/smoke.mjs` | +223. Casos 22 a 25 y una verificación nueva dentro del 18 |
| `scripts/smoke.sh` | +1 −1. El cartel decía 21 casos |
| `src/components/Checkout/CheckoutModal.tsx` | +6 −1. Referencia de pago |
| `src/components/UserDashboard/UserDashboard.tsx` | +26 −7. Botones en los dos estados |

**Una sola pieza, un solo commit de producto.** Sin migración, sin
dependencias nuevas.

### Aviso sobre el diff, para que no te asuste

El primer diff daba **602 líneas cambiadas en `orders.py` para un cambio de
40**. `orders.py`, `CheckoutModal.tsx` y `UserDashboard.tsx` tienen finales
de línea mezclados —481 de 758 líneas con CRLF en el primero— y mi editor
los normalizó enteros.

Lo revertí antes de commitear: reconstruí cada archivo conservando el final
de línea original de cada línea que no toqué. El diff pasó de 953
inserciones a 294. **Después de eso volví a compilar y a correr la suite
completa**, porque reescribir archivos con un script y no verificar sería
exactamente el tipo de cosa que después aparece rota.

---

## 2. Corrida roja, contra el código anterior

Base recreada desde cero. Los cuatro casos nuevos fallan, cada uno por el
motivo que tenía que fallar:

```text
[FAIL] 22 Sin comprobante, comprador y vendedor pueden cancelar —
  POST /orders/96198e76-.../cancel respondió HTTP 400:
  Solo se pueden cancelar órdenes pendientes, pagadas o confirmadas (176 ms)

[FAIL] 23 Sin comprobante, el vendedor igual aprueba o rechaza —
  PATCH /orders/a6536afd-.../transfer-receipt respondió HTTP 400:
  La orden no tiene un comprobante pendiente (115 ms)

[FAIL] 24 Con comprobante enviado, sólo el vendedor puede cancelar —
  el motivo no explica quién puede cancelar: POST /orders/e3429d1c-.../cancel
  respondió HTTP 400: Solo se pueden cancelar órdenes pendientes, pagadas
  o confirmadas (175 ms)

[FAIL] 25 Dos aprobaciones simultáneas descuentan stock una sola vez —
  aprobaciones aceptadas: 2 (se esperaba exactamente 1) (193 ms)

-------------------
21/25 pasaron; 4 fallaron
```

Tu criterio 1 pedía reproducir al menos el `400` del comprador y del
vendedor contra `AWAITING_TRANSFER_RECEIPT`. El caso 22 crea dos órdenes
justamente para eso: una la intenta cancelar el comprador, la otra el
vendedor. Las dos daban `400`.

### El caso 25 encontró algo que yo daba por teórico

**Las dos aprobaciones simultáneas pasaban.** No una y un error: las dos.
Contra el código anterior, dos clics del vendedor sobre "Aprobar" al mismo
tiempo descontaban el stock dos veces por una sola venta.

Yo te lo había planteado como un riesgo de concurrencia a cubrir. Era un
defecto activo. Fue el mejor hallazgo de la pieza y salió de un criterio
tuyo, no mío.

---

## 3. Corrida verde, después del arreglo

Misma base recreada desde cero, mismas cinco migraciones, mismo seed:

```text
PASS 01 Salud del servicio
PASS 02 Registro de usuario
PASS 03 Ingreso y obtención del token
PASS 04 Catálogo con categoría y precio
PASS 05 Catálogo con provincia y localidad
PASS 06 Detalle de producto
PASS 07 Agregar al carrito y verlo
PASS 08 Crear orden desde el carrito
PASS 09 Publicar producto como vendedor desde la interfaz
PASS 10 Fallo de imagen visible sin perder la publicación
PASS 11 Ver mis compras y mis ventas
PASS 12 Administración: usuarios, productos y órdenes
PASS 13 Transferencia exige CBU o alias del vendedor
PASS 14 Datos bancarios correctos y orden esperando comprobante
PASS 15 Comprobante fallido visible y comprobante válido asociado
PASS 16 Sólo el vendedor correcto valida el comprobante
PASS 17 Rechazo de comprobante guarda el motivo
PASS 18 Transferencia completa desde la interfaz
PASS 19 Las rutas financieras heredadas no están expuestas
PASS 20 Respaldo de imágenes en el recorrido de demostración
PASS 21 Registro de transportista desde la interfaz
PASS 22 Sin comprobante, comprador y vendedor pueden cancelar
PASS 23 Sin comprobante, el vendedor igual aprueba o rechaza
PASS 24 Con comprobante enviado, sólo el vendedor puede cancelar
PASS 25 Dos aprobaciones simultáneas descuentan stock una sola vez
-------------------
25/25 pasaron; 0 fallaron
```

Observaciones de los casos nuevos:

```text
[PASS] 22 — ajeno 403; comprador=CANCELLED, vendedor=REJECTED, stock intacto en 17
[PASS] 23 — rechazo sin motivo HTTP 400; rechazo con motivo=REJECTED;
            aprobación sin comprobante=PAID, stock 17 -> 16
[PASS] 24 — comprador HTTP 400 con motivo; vendedor dejó REJECTED; stock intacto en 16
[PASS] 25 — 1 de 2 aceptada, la otra HTTP 400; stock 16 -> 15
```

**El caso 19 sigue verde**: `payments`, `mp-oauth` y `simulate-payment`
siguen en `404`. Tu criterio 6, cumplido.

### El runner, con la precisión que pediste

**Corrí la misma suite, no el runner oficial.** `npm run smoke` ejecuta
`scripts/smoke.sh`, que hace `docker compose down -v` y llama a
`init_local_db.sh`; **en mi entorno el demonio de Docker no está
disponible**. Levanté PostgreSQL 16 + PostGIS 3.4 nativo, recreé la base con
`DROP DATABASE ... WITH (FORCE)`, apliqué las cinco migraciones y el seed, y
corrí `node scripts/smoke.mjs` directo. Para que `querySql` funcionara puse
un shim de `docker` en el `PATH` que traduce `docker exec topgreen-db psql`
a un `psql` local.

**Los dos resultados no son equivalentes y no los presento como tales.** Lo
que verifiqué es el mismo archivo de casos contra el mismo esquema y el
mismo seed. Lo que **no** verifiqué es el `Dockerfile`, el `docker-compose`
ni el arranque del contenedor. El shim vive en mi scratchpad; no toqué
`smoke.sh` salvo el número de casos del cartel.

### Una corrida intermedia que fallé por mi culpa

Entre la roja y la verde hubo un `24/25`: el caso 23 falló por un error
mío, no del producto. Comparaba `transfer_receipt_url` como último campo de
una fila SQL, y `querySql` hace `.trim()` sobre toda la salida, así que un
`NULL` final desaparecía y me llegaba `undefined` en vez de cadena vacía. Lo
reescribí con el patrón que ya usaba el caso 15, una consulta `COUNT` aparte.

Te lo cuento porque el número honesto de corridas es tres, no dos.

---

## 4. Verificación SQL de estado y stock

Estados finales al terminar la suite:

```text
           estado           | ordenes | con_comprobante | con_motivo
----------------------------+---------+-----------------+------------
 CANCELLED                  |       1 |               0 |          1
 PAID                       |       3 |               2 |          0
 PLACED                     |       1 |               0 |          0
 REJECTED                   |       4 |               2 |          4
 TRANSFER_RECEIPT_SUBMITTED |       1 |               1 |          0
```

Las cuatro `REJECTED` tienen motivo guardado, las cuatro. Las dos `PAID` sin
comprobante son las aprobadas por cuenta bancaria, que es exactamente lo que
autorizaste en el punto 4 de tu alcance.

La única `TRANSFER_RECEIPT_SUBMITTED` es la que deja abierta el caso 18, y
ya no está atrapada: el caso 24 demuestra que desde ahí el vendedor sale.

**Stock, que es tu criterio 4:**

```text
                   name                    | stock | sales_count | ordenes_pagadas
-------------------------------------------+-------+-------------+-----------------
 Kit de Filtros y Correas para Cosechadora |    15 |           3 |               3
```

El seed crea ese producto con **18**. Tres órdenes pagadas, stock 15,
`sales_count` 3. **Un descuento por orden aprobada, ni uno más.** Y las seis
canceladas o rechazadas antes de aprobar no lo movieron.

**Ninguna cancelación tocó fondos ni stock que no correspondía:**

```text
$ grep -c "Procesando reembolso|Buscando pago para orden" uvicorn.log
0
$ grep -c "Stock restaurado" uvicorn.log
0
```

---

## 5. Lo que encontré y no esperaba: la cancelación llamaba a Mercado Pago

Esto es lo que más quiero que leas.

`cancel_order` terminaba llamando a `get_refund_processor()`
(`orders.py:33`), que hace:

```python
from app.api.payments import process_refund
```

**El módulo desmontado.** Y `process_refund` no es un envoltorio inocente:
busca el `Payment` de la orden, arma un SDK de Mercado Pago con el token del
vendedor —o con el del marketplace como respaldo— y emite un reembolso. O
sea, **mueve plata de terceros**.

Hoy no llega a hacerlo porque el checkout ya no crea filas en `payments` y
la función corta antes. Pero el camino estaba vivo, y tu condición de freno
decía textual *"una cancelación intenta procesar fondos de terceros"*.

**No frené porque tu punto 7 ya lo autorizaba**: "cancelar una transferencia
no invoca un reembolso de Mercado Pago". Así que lo implementé y seguí.

La guarda que puse identifica la orden por sus datos bancarios, no por su
estado:

```python
es_transferencia = bool(order.transfer_cbu or order.transfer_alias_bancario)
```

**Por qué así y no por estado:** una orden de transferencia aprobada queda
en `PAID`, y cancelar desde `PAID` habría vuelto a caer en el reembolso. Los
datos bancarios acompañan a la orden toda su vida; el estado no.

**Lo que esto revela sobre el caso 19, y te lo marco:** ese caso verifica
que las *rutas* de `payments` respondan `404`, y lo hacen. Pero el *módulo*
sigue siendo importable y `orders.py` lo importa. "Desmontado" es cierto a
nivel HTTP y más débil de lo que suena a nivel código.

**No lo arreglé** porque sacar el reembolso entero toca el camino de las
órdenes que no son transferencia, y Mercado Pago para compras está fuera de
alcance. **Te lo dejo como pieza aparte**, y es chica.

---

## 6. Decisiones que no tomé

1. **No toqué `PATCH /orders/{id}/status`.** Sus tablas de transición
   siguen sin conocer los dos estados de transferencia, así que sigue
   devolviendo `400` ahí. Fue deliberado: la cancelación y la decisión de
   transferencia ya cubren toda tu tabla, y sumar una tercera puerta para lo
   mismo crea dos formas de hacer una cosa. Si preferís que también responda,
   decímelo.
2. **No agregué un botón "Cancelar Venta" para el vendedor** en los estados
   de transferencia. La ruta `/cancel` le funciona y está probada, pero en la
   interfaz su salida es "Rechazar", que **exige motivo**. Un botón de
   cancelar sin motivo al lado sería el camino fácil y perderíamos el dato.
3. **No agregué un campo `payment_reference` nuevo.** La respuesta ya trae
   `order_number` y es lo que muestra la pantalla. Un campo nuevo con el
   mismo valor es una forma de desincronizarse más adelante.
4. **No saqué `get_refund_processor` del módulo desmontado**, por lo del
   punto anterior.
5. **Nada de lo que pusiste fuera de alcance**: sin vencimiento, sin reserva
   de stock, sin cambios de esquema, sin seed bancario, sin arreglar la
   instalación sin Docker, sin transportistas, sin contacto, sin
   suscripciones, sin Railway.

---

## 7. Riesgos que quedan

**El que más me preocupa, y nace de mi propio cambio.** La guarda del
reembolso pregunta si la orden tiene datos bancarios. Hoy eso identifica
perfecto a una transferencia. **Cuando vuelva Mercado Pago para compras**, si
una orden llegara a tener datos bancarios *y* un pago por Mercado Pago, mi
guarda saltearía un reembolso legítimo. No puede pasar hoy —son dos caminos
de checkout distintos— pero es una suposición que hay que releer cuando se
reconstruya Mercado Pago. Queda anotada acá para que no se pierda.

**`with_for_update()` y las cargas anticipadas.** El bloqueo funciona porque
las dos consultas son planas. Si alguien agrega un `joinedload` con `LEFT
OUTER JOIN` sobre esas consultas, PostgreSQL rechaza el `FOR UPDATE` y las
rutas empiezan a fallar. No hay nada en el código que lo impida.

**El segundo llamado al reembolso**, en `update_order_status`
(`orders.py:~648`), sigue sin guarda. Hoy es inalcanzable para una
transferencia, porque las transiciones del vendedor desde `PAID` son
`CONFIRMED` y `SHIPPED`, nunca `CANCELLED`. Es cierto por una coincidencia
de las tablas, no por diseño.

**El caso 25 es una carrera de verdad.** Depende de que dos peticiones se
solapen. Con el bloqueo el resultado es determinista, pero si alguna vez el
entorno serializa las peticiones por otro motivo, el caso pasaría sin probar
nada. Vale la pena releerlo si algún día se vuelve sospechosamente rápido.

**Órdenes ya atrapadas:** ninguna, porque no hay despliegue. Si en algún
momento se restaura una base vieja, las órdenes creadas antes de este commit
quedan liberadas solas, porque la regla es por estado y no por fecha.

---

## 8. Lo que necesito para seguir

La guardia de cronograma dice que la próxima pieza es **cerrar el flujo
UX/UI de logística** de la Fase 1. Quedo esperando el enunciado.

Y quedan tres cosas tuyas de antes, por si querés resolverlas ahora:

1. **La pieza chica del reembolso** del punto 5: sacar la dependencia de
   `orders.py` hacia el módulo desmontado. Es media jornada y cierra de
   verdad lo que el caso 19 dice a medias.
2. **`carrier_transport_certified`**, que toca esquema y sigue sin decisión.
3. **`contact_visible_for`**: te lo pregunté en el informe anterior y no
   quedó respondido. Sigo pensando que conviene antes que suscripciones.

Dejo el entorno levantado —PostgreSQL, API y Vite— por si querés que
verifique algo de esta pieza antes de pasar a la siguiente.
