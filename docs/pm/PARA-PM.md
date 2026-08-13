# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-13. Segundo informe del día.

**Los tres defectos de MP-B, cerrados.** La carrera de dos confirmaciones se
cierra en la base y no en el navegador; una orden terminal ya no ofrece ni crea
link de pago, y su intención local queda anulada; y el pago que quedó a medias
se retoma desde «Mis compras», en escritorio y en celular. No abrí webhook, no
toqué stock y la bandera de cobro sigue apagada.

Tenías razón en los tres, y el tercero especialmente: «reanudable» era criterio
de MP-B y yo lo había entregado sólo como ruta.

## 1. La carrera de las dos confirmaciones

Era como decís: `carrito_activo()` leía sin bloquear y `crear_ordenes()` recién
convertía el carrito al final. Dos confirmaciones superpuestas leían el mismo
carrito activo y las dos se lo creían.

Ahora **lo primero que hace `crear_ordenes` es tomar el carrito**:

```sql
UPDATE carts SET status = 'CONVERTED' WHERE id = :id AND status = 'ACTIVE'
```

Quien se lleva la fila sigue; quien encuentra cero filas hace `rollback` y
recibe **409** con un motivo que se puede leer: «Esta compra ya se confirmó.
Mirá "Mis compras": no se creó una segunda». Decide la base, en la misma
transacción que las órdenes, y es el mismo idioma que ya usaba el `state` de
OAuth para el único uso.

El caso 82 la fuerza donde existe de verdad: retiene la primera confirmación
justo antes de escribir, deja que la segunda pase entera, y recién entonces la
suelta. No la simula con dos `fetch` que igual se serializan.

## 2. La orden terminal

`payment-link` comprobaba dueño y medio, y no estado. Ahora comprueba los tres:
la única situación en la que una orden admite pago es **colocada**; cancelada,
rechazada, entregada o pagada devuelven **409** con el estado adentro del
motivo, no crean preferencia y no vuelven a entregar la que hubiera.

Y al cancelar o rechazar, la intención local se anula: la fila de `payments`
pasa a `CANCELLED` en vez de quedar diciendo «pendiente» sobre algo que ya no
se va a cobrar. No llamo a Mercado Pago ni invento un reembolso.

La puerta mordió enseguida y en un lugar que no esperaba: el caso 80 —el de la
bandera apagada— fabricaba su orden de Mercado Pago sobre una que estaba
esperando comprobante, y ahora eso no es pagable. La ajusté para que nazca
colocada, que es el peor caso de verdad: una orden que sí se podría pagar, y a
la que sólo la frena la bandera.

**El riesgo residual, dicho como es:** la preferencia que ya viajó sigue viva
del lado de Mercado Pago, así que alguien que guardó el link podría pagarla
igual. De este lado lo que se puede hacer es no ofrecerla más y no mentir sobre
el estado, y es lo que hace. Cerrar ese borde necesita consulta de estado y
webhook —MP-C—, y ahí también hay que decidir qué se hace con un pago que
entra sobre una orden cancelada.

## 3. La reanudación, ahora en la pantalla

`/orders/my` y `/orders/{id}` devuelven `payment_method` para los dos lados —el
vendedor también necesita saber si esperar un comprobante o un aviso— y
`payment_url` con `can_pay` **sólo al comprador de esa orden**. Al vendedor le
llegan en `null` y `false`; probado en el caso 84.

En «Mis compras», la orden por Mercado Pago que todavía se puede pagar muestra
**Continuar pago** —o **Preparar pago** si la preferencia no se había podido
crear—, y usa la ruta idempotente: no crea otra orden ni otro pago. No aparece
en transferencia, no aparece en «Mis ventas», no aparece en una orden terminal,
y recargar la conserva porque no depende de nada que viva sólo en esa pantalla.

## 4. El rojo contra `c671a4c`

Volví el producto a `c671a4c` y medí los tres puntos con la suite nueva:

```
82  dos confirmaciones superpuestas → HTTP 200 y 200;
    órdenes 22→24, pagos 15→17, preferencias 2
83  orden CANCELLED: el link se vuelve a entregar con HTTP 200 y URL adentro;
    la intención local quedó en PENDING
84  «Mis compras» devuelve payment_method=undefined, can_pay=undefined,
    payment_url=undefined
```

Con la corrección: una sola compra y un 409 accionable; 409 y cero preferencias
sobre la orden terminal, con la intención en `CANCELLED`; y la acción visible
en la pantalla, que además desaparece cuando la orden termina.

## 5. Puertas

| Puerta | Comando | Resultado |
|---|---|---|
| Suite | `node scripts/smoke.mjs` | **84 de 84**, sobre base recién migrada y sembrada |
| Hito | `npm run hito` | 6 de 6 pasos encadenados |
| Accesibilidad | `npm run a11y` | 56 de 56 pantallas, 0 violaciones bloqueantes |
| Contraste | `npm run contraste` | 40 de 40 mediciones, 0 incumplimientos |
| Build | `npm run build` | `tsc` y `vite build` limpios |
| Migración | `alembic downgrade -1`, `upgrade head`, `alembic check` | Va y vuelve con datos adentro; «No new upgrade operations detected» |
| Espacios | `git diff --check` | 0 espacios reales al final de línea y 0 marcadores de conflicto (lo que marca es el CR de los archivos CRLF) |

La suite pasó de 81 a **84 casos**: tres nuevos y dos ajustados —el 80, por lo
de arriba, y ninguno más—. Los 75 a 81 quedaron intactos.

No hay migración nueva: los tres cierres son de código. La de ida y vuelta se
corrió igual, para que el `check` siga hablando del esquema entregado.

Los tres colores del bloque nuevo de «Mis compras» son tokens que las puertas
ya miden en otras pantallas: 12,97:1 el texto, 9,25:1 el botón y 5,18:1 el
aviso de error. La auditoría entra a «Mis compras», pero con el comprador del
seed sin una orden de Mercado Pago pendiente, así que el bloque no llega a
renderizarse ahí: quien lo mira de punta a punta es el caso 84, en las dos
pantallas.

## 6. Lo que no hice

Webhook, consulta de estado a Mercado Pago, transiciones de orden por pago,
reserva o descuento de stock, reembolsos y encender la bandera. Tampoco toqué
los bloques que ya habías dado por conformes: la regla común de checkout, la
respuesta plural, el medio por vendedor, la preferencia sin comisión ni el pago
único por orden. Los casos 75 a 81 quedaron como estaban.

## 7. Inventario

| Archivo | Qué cambió |
|---|---|
| `backend/app/services/checkout.py` | El carrito se toma con un `UPDATE` condicional; `es_pagable()` y los estados que admiten pago |
| `backend/app/services/mp_preferencia.py` | `anular_intencion()`: la intención local muere con la orden |
| `backend/app/api/orders.py` | `payment-link` mira el estado; cancelar y rechazar anulan la intención; el listado y el detalle traen el pago del comprador |
| `backend/app/schemas/orders.py` | `payment_method`, `payment_url` y `can_pay` en `OrderResponse` |
| `src/components/UserDashboard/UserDashboard.tsx` y su CSS | «Continuar pago» en «Mis compras», con su estado y su error |
| `scripts/smoke.mjs` | Casos 82, 83 y 84 |
| `scripts/smoke.sh` | El conteo, al día |

Ninguna pantalla nueva: la acción vive dentro de «Mis compras», que ya estaba
en los inventarios de accesibilidad y contraste.
