# Dev → PM

## Estado

**Tarea 4 terminada, verificada y subida.**

Commits:

- `409e8b7` — implementación del pago por transferencia bancaria.
- `4e9b4fc` — recorrido Playwright completo desde el checkout.

No cambié `/orders/checkout`, el flujo ni la integración de Mercado Pago.
La transferencia usa una ruta separada y reutiliza el almacenamiento que ya
existía.

## Recorrido implementado

1. El vendedor puede guardar CBU y alias bancario en su perfil. Ambos son
   opcionales; sin los dos, la API rechaza ofrecer transferencia.
2. El comprador elige `Transferencia bancaria` en el checkout y ve los datos
   del vendedor, titular y monto.
3. Se crea una orden por vendedor con estado
   `awaiting_transfer_receipt`. Esto conserva correctamente los datos si el
   carrito tiene publicaciones de más de un vendedor.
4. El comprador adjunta JPG, PNG, WEBP o PDF, hasta 5 MB. El fallo devuelve un
   motivo visible y deja la orden esperando comprobante.
5. El vendedor ve el comprobante en `Mis ventas` y puede aprobarlo o
   rechazarlo. El rechazo exige motivo.
6. La aprobación pasa la orden a `paid`; el rechazo, a `rejected`, conservando
   el motivo y el comprobante.
7. La API compara siempre `order.seller_id` con el usuario autenticado antes
   de permitir la decisión.

## Esquema y migración

Migración: `20260726_0024_cfff8c361c11_agregar_transferencias_bancarias.py`.

Cambios dentro de lo autorizado:

- `users.cbu`
- `users.alias_bancario`
- `orders.transfer_receipt_url`
- estados agregados al enum: `AWAITING_TRANSFER_RECEIPT` y
  `TRANSFER_RECEIPT_SUBMITTED`

No renombré ni eliminé estados existentes.

La migración se generó desde los modelos. Se aplicó desde una base vacía
dentro del smoke y después ejecuté:

```text
$ alembic check
No new upgrade operations detected.
```

## Evidencia de aceptación

Los casos nuevos son:

```text
PASS 13 Transferencia exige CBU o alias del vendedor
  HTTP 400 con motivo visible; no se creó ninguna orden

PASS 14 Datos bancarios correctos y orden esperando comprobante
  HTTP 200; CBU devuelto por API igual al consultado en SQL

PASS 15 Comprobante fallido visible y comprobante válido asociado
  archivo inválido HTTP 400 sin cambiar estado ni referencia;
  archivo válido HTTP 200 y URL de API igual a SQL

PASS 16 Sólo el vendedor correcto valida el comprobante
  vendedor ajeno HTTP 403; vendedor correcto dejó API=paid y SQL=PAID

PASS 17 Rechazo de comprobante guarda el motivo
  API=rejected, SQL=REJECTED y motivo persistido

PASS 18 Transferencia completa desde la interfaz
  Chromium real: catálogo → carrito → checkout → transferencia → comprobante;
  CBU y alias de SQL visibles; orden y archivo verificados en base
```

El caso 18 no simula la UI con llamadas directas: abre Chromium headless,
hace clic, completa envío, selecciona transferencia y sube el archivo desde
el formulario.

## Smoke final

Ejecutado desde cero después del último cambio:

```text
Resumen smoke tests
-------------------
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
-------------------
18/18 pasaron; 0 fallaron
```

El smoke también compiló el frontend con `tsc && vite build` y aplicó todas
las migraciones desde cero.

Hubo una corrida previa `17/18`: el caso 18 usó inicialmente `form`, que era
ambiguo entre la búsqueda y el checkout. Corregí el selector a
`form:has(h2)` y repetí la suite completa; la salida final de arriba es la
segunda corrida.

## Decisiones no inventadas

- No implementé conciliación bancaria.
- No definí qué ocurre con una transferencia insuficiente.
- No agregué avisos por correo.
- No agregué dependencias.
- No toqué Mercado Pago.
- No usé ni levanté infraestructura externa: todo se verificó con Docker,
  PostgreSQL, Vite y Playwright locales.
