# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-12.

## 1. Resultado

**El `float` del checkout está cerrado.** El commit es **`2220e94`**, sobre
`354f725`; este informe va aparte y encima. La suite pasa de 58 a **61 casos**.

Ninguna cuenta que decide o guarda una orden pasa ya por aritmética binaria. El
precio sale `NUMERIC` de la base y llega `NUMERIC` a la orden; el único lugar
donde deja de ser exacto es el borde JSON, y sólo después de calcular y validar.

## 2. Qué se pasó a Decimal, y qué no

| Pasó a `Decimal` | Por qué |
|---|---|
| Carrito: GET, alta, cambio de cantidad y `sync` | alimentan los dos checkouts |
| `transfer-options` | es el monto que la persona va a transferir |
| Checkout común y por transferencia | subtotal, envío, total, snapshot unitario e importe del ítem |

**No toqué `payments.py`**: sus routers siguen desmontados y los reconstruís en
la pieza siguiente. **Tampoco `admin.py`**, y esto lo miré antes de dejarlo: ahí
`float` es la conversión de salida de un valor que ya viene sumado por
PostgreSQL, sin una sola operación aritmética en Python. Es borde, no cuenta.

En `montos.py` agregué **dos cosas y nada más**: `importe_de_linea`, para que la
multiplicación monetaria se escriba una sola vez, y `SIN_CARGO`, para que nadie
arrastre un `0.0` dentro de una suma. **No hay política de redondeo nueva y no
hace falta**: un `NUMERIC(12,2)` por un entero da como mucho dos decimales, y
sumar dos decimales sigue dando dos. Si algún día hiciera falta redondear, el
comentario dice dónde se decide.

Los esquemas de respuesta siguen declarando `float`, así que el JSON que consume
el frontend no cambia de forma. Lo que cambia es el número.

## 3. Dónde se ve el error, que no es donde parecía

Esto lo descubrí midiendo y cambia la forma de la prueba, así que va antes que
los resultados.

**Con montos dentro del contrato, la desviación binaria nunca llega a medio
centavo.** 99 × 9.999.999.999,97 da `989999999997.0299` en binario: el error es
de una diezmilésima. Al guardarlo, `NUMERIC(14,2)` lo redondea a
`989999999997.03` y **lo esconde**. O sea: la columna sola no discrimina, y una
prueba que mirara únicamente SQL habría pasado con el código viejo.

Donde el error sí se ve es **en lo que devuelve la API**, que es lo que lee el
comprador y lo que consume el frontend. Por eso las regresiones miran las dos
cosas: la API discrimina, el SQL confirma. Te lo digo explícito porque tu
enunciado pedía «API y SQL» y yo no quiero que quede la impresión de que las
dos puntas discriminan por igual.

## 4. Las regresiones

Las tres corren por **los dos checkouts** con el mismo recorrido parametrizado,
y miran cinco lugares: la línea del carrito, el total del carrito, la opción de
transferencia, la respuesta del checkout y el SQL de snapshot, subtotal y total.

```text
[PASS] 59 … 3 × $0,10 = $0,30 exacto en carrito, opción, respuesta y SQL, por
  los dos checkouts; en binario esa cuenta da 0.30000000000000004
[PASS] 60 … 99 × $9.999.999.999,97 = $989.999.999.997,03 exacto en carrito,
  opción, respuesta, snapshot, subtotal y total, por los dos checkouts
[PASS] 61 … dos vendedores con totales independientes ($0,30 y $19.999.999,98);
  con uno fuera de contrato, 0 órdenes nuevas por los dos checkouts y el
  carrito sigue activo
```

**Rojo forzado**, con `montos.py`, `cart.py` y `orders.py` devueltos a su estado
anterior y nada más cambiado:

```text
[FAIL] 59 — transferencia: la línea del carrito devolvió 0.30000000000000004
  en vez de 0.3
[FAIL] 60 — transferencia: la línea del carrito devolvió 989999999997.0299
  en vez de 989999999997.03
[FAIL] 61 — el total del vendedor barato es 0.30000000000000004, no 0.3
```

### Un rodeo que tuve que dar en el caso 61

Tu tercera regresión pide un vendedor que exceda el máximo. **No se puede armar
por la API**: el carrito ya rechaza el exceso al agregar, al cambiar cantidad y
al sincronizar —es lo que exige el caso 28—, así que un carrito imposible no
existe. Un `sync` con esa cantidad devuelve 400 antes de llegar al checkout.

Así que el caso arma el carrito **dentro** del contrato y lo saca después por
donde puede salirse de verdad: **el vendedor sube el precio con el producto ya
en el carrito**. Ahí sí el checkout tiene que rechazar antes de escribir, y eso
es lo que se comprueba, por los dos caminos, contando órdenes e ítems y
verificando que el carrito siga `ACTIVE`.

Eso deja a la vista algo que no es de esta pieza y no toqué: **el carrito
re-cotiza desde la publicación**, no desde el precio que tenía cuando se
agregó. `cart_items.unit_price_snapshot` existe y se guarda, pero los totales
no lo usan. Hoy significa que pagás el precio del momento de comprar, que es
defendible; pero es una decisión que nadie tomó por escrito y conviene que
quede tomada antes de Fase 4.

## 5. Estado final

| Comprobación | Resultado |
|---|---|
| Suite completa, base recreada desde cero | **61/61** |
| Casos 59, 60 y 61 con el cálculo anterior | rojos, mostrando el artefacto binario |
| `npm run hito`, base recreada desde cero | **6/6 pasos** |
| `npm run build` (incluye `tsc`) | verde |
| `git -c core.whitespace=cr-at-eol diff --cached --check` | sin avisos |

No hay cambios visuales ni migración —las columnas ya eran `Numeric` con la
precisión correcta—, así que no corrí accesibilidad ni contraste; sus últimos
verdes siguen valiendo, 56/56 y 40/40. No abrí Mercado Pago.

## 6. Comandos

```bash
npm run smoke                 # suite completa, 61 casos
npm run hito                  # la puerta del hito, 6 pasos
npm run build                 # tsc + vite
```

## 7. Riesgos y deudas

**Uno nuevo, y es el del punto 4**: la re-cotización del carrito desde la
publicación. No es un defecto —el comportamiento es coherente— pero es una
decisión de producto sin decidir.

Siguen abiertos, sin cambios: la dependencia de las puertas visuales y del hito
respecto de datos concretos del seed, y que el tramo del hito tiene origen y
destino en la misma localidad, así que la discriminación geográfica la prueban
los casos 43 y 53, no esa puerta.

**Se cierra la deuda del `float` del checkout**, que venía anotada desde Fase 2.

Nota de reproducibilidad, la de siempre: Docker no está disponible en mi entorno
—demonio caído y registry 403—, así que todo corre nativo con un puente que
traduce sólo lo que las puertas piden por `docker exec`: `psql`, `python` y
`alembic`. `./scripts/init_local_db.sh` sigue siendo el camino con contenedores
y no lo cambié.

El entorno local quedó levantado: API en `:8000`, Vite en `:5173`, base recreada
y con seed.
