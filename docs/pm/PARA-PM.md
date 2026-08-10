# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-10.

## 1. Resultado

**Terminado.** Los seis criterios se cumplen. La suite pasa de 26 a **28 casos**.

El campo de $950.000.000 se compra. Un total fuera de rango devuelve 400 y no
escribe ni una fila.

## 2. Commit y alcance real

`61624ce`, este informe aparte. Once archivos.

| Archivo | Qué |
|---|---|
| `alembic/…_a1c4f7e9b2d3_ampliar_columnas_monetarias.py` | migración nueva desde la cabeza actual |
| `app/models/{cart,order,payment}.py` | tipos alineados con la migración |
| `app/core/montos.py` | contrato monetario y validación, archivo nuevo |
| `app/api/{products,cart,orders}.py` | validación antes de escribir |
| `scripts/smoke.mjs` | caso 13 modificado, casos 27 y 28 nuevos |
| `scripts/smoke.sh`, `README.md` | el total decía 26 |

## 3. Evidencia

### Tipos, antes y después

Auditadas **todas** las columnas monetarias del esquema, no las cinco que te
informé. Aparecieron dos grupos más: `orders.shipping_cost` y los cuatro montos
de `payments`.

| Tabla | Columna | Antes | Después |
|---|---|---|---|
| `products` | `price` | `NUMERIC(12,2)` | sin cambio |
| `cart_items` | `unit_price_snapshot` | `NUMERIC(10,2)` | **`(12,2)`** |
| `order_items` | `unit_price_snapshot` | `NUMERIC(10,2)` | **`(12,2)`** |
| `order_items` | `total_price` | `NUMERIC(10,2)` | **`(14,2)`** |
| `orders` | `subtotal` | `NUMERIC(10,2)` | **`(14,2)`** |
| `orders` | `shipping_cost` | `NUMERIC(10,2)` | **`(14,2)`** |
| `orders` | `total_amount` | `NUMERIC(10,2)` | **`(14,2)`** |
| `payments` | `total_amount` | `NUMERIC(12,2)` | **`(14,2)`** |
| `payments` | `commission_amount` | `NUMERIC(12,2)` | **`(14,2)`** |
| `payments` | `seller_amount` | `NUMERIC(12,2)` | **`(14,2)`** |
| `payments` | `refund_amount` | `NUMERIC(12,2)` | **`(14,2)`** |

**`payments.commission_percent` queda en `NUMERIC(5,2)` a propósito**: es un
porcentaje, no un monto. Es la única columna del flujo que no toqué, y quiero
que conste por si la buscás en la lista.

Fuera del flujo y sin tocar: `localities.latitude/longitude`,
`users.carrier_coverage_radius_km` y `users.rating_average`.

El contrato queda escrito en un solo lugar, `app/core/montos.py`, con la nota de
que sus límites y los de la migración se mueven juntos:

```text
precio unitario y snapshots   NUMERIC(12,2)       9.999.999.999,99
totales, subtotales y envío   NUMERIC(14,2)     999.999.999.999,99
```

### Las dos aplicaciones de la migración

| Sobre qué | Resultado |
|---|---|
| **Base existente con datos** — 6 usuarios y 11 órdenes ya cargadas | `23ff06b57d6d -> a1c4f7e9b2d3` aplicada; los once tipos quedaron como la tabla de arriba |
| **Base limpia** — recreada desde cero, todas las migraciones en orden | la suite completa corre 28/28 sobre ella |
| `alembic check` | **No new upgrade operations detected**: el esquema coincide con los modelos |

### Los tres casos

```text
[PASS] 13 Desde el seed, los dos vendedores ya cobran por transferencia —
  la mas cara del admin es "Campo Agrícola de 120 Hectáreas" a $950000000
  y entra al carrito; vendedor y admin con CBU y alias API=SQL

[PASS] 27 Una orden por transferencia de más de cien millones —
  HTTP 200, "Campo Agrícola de 120 Hectáreas" a $950000000.00,
  API=SQL en subtotal, total y snapshots

[PASS] 28 Un total fuera del contrato se rechaza sin escribir nada —
  publicar $99.999.999.999,99 HTTP 400;
  total de $1.999.999.999.998,00 HTTP 400 con el techo en el mensaje;
  órdenes 11→11 sin escritura parcial
```

El **13** deja de elegir la publicación más barata y usa la **más cara** de cada
vendedor, y además exige que la del admin supere los cien millones. Si alguien
volviera a angostar los tipos, ese caso avisa solo.

El **28** prueba las dos puntas del contrato. Publicar a $99.999.999.999,99
—por encima de `NUMERIC(12,2)`— devuelve 400. Después publica al máximo unitario
admitido con stock 200, arma un total de $1.999.999.999.998,00 y comprueba tres
cosas: el 400, que el mensaje **diga el techo** en vez de un texto genérico, y
que el conteo de órdenes e ítems no se movió. Borra su publicación al terminar,
en un `finally`.

### Estado final

| Comprobación | Resultado |
|---|---|
| Suite oficial, base recreada desde cero | **28/28** |
| `alembic check` | sin diferencias |
| `npm run build` | verde |
| `git -c core.whitespace=cr-at-eol diff --check` | sin avisos |

**No corrido:** `npm run smoke` tal cual, que exige Docker; corrí la misma suite
contra la base recreada a mano. No volví a correr `a11y` ni `contraste`: no toqué
`src/` ni esos guiones.

## 4. Desvíos, riesgos y hallazgos fuera de la tarea

**Sin desvíos.** No bajé ningún precio ni borré publicaciones.

**Dónde puse la validación, y por qué ahí.** Tres puntos, todos antes de
cualquier `INSERT`:

- al publicar, sobre `products.price`;
- al agregar al carrito, sobre el precio unitario del producto;
- en los **dos** checkouts —el común y el de transferencia—, recorriendo los
  grupos y validando ítem por ítem y el total del vendedor, en un bucle propio
  que corre **antes** de crear la primera orden.

Lo hice con un bucle previo y no dentro del bucle que escribe, justamente para
que "no deja escrituras parciales" sea cierto por construcción y no por un
`rollback` bien puesto.

**Riesgo que queda y no cierra esta pieza.** El cálculo del checkout sigue
haciéndose en `float` y recién la validación usa `Decimal`. Para los importes de
este catálogo no cambia el resultado, pero `float` empieza a perder centavos
alrededor de los nueve mil millones, que ahora es un precio publicable. Vos
excluiste el refactor de `float` a `Decimal` de este alcance y no lo toqué.
**Merece una pieza propia antes de Fase 4**, cuando los montos pasen a un cobro.

**Segundo riesgo, menor:** el techo de total es global, no por moneda ni por
categoría. Si alguna vez se publica en otra unidad, hay que revisarlo.

## 5. DECISIÓN SOLICITADA

**a) El `float` del checkout** (punto 4). Beneficio: los importes dejan de
depender de un tipo que pierde precisión dentro del rango ahora publicable.
Esfuerzo: medio; toca los dos checkouts y los sitios que formatean importes.
Riesgo: es un refactor y toca dinero. Fase: **antes de Fase 4**.
**Recomiendo abrirla como pieza propia**, no ahora.

**b) La próxima pieza.** Anticipaste el mensaje genérico del frontend cuando la
API rechaza el pago. Ahora hay más para mostrar: el 400 del caso 28 trae un
mensaje que se entiende, y hoy la interfaz igual lo taparía. Quedo a la espera.

El entorno local sigue levantado.
