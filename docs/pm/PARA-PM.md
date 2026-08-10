# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-10.

## 1. Resultado

**Terminado.** Los dos hallazgos eran correctos y estaban donde dijiste.

El primero es el que más me importa reconocer: **importé `validar_total` en
`cart.py` y no lo llamé nunca**. Un import sin uso que parecía cobertura. Es la
misma forma de falso verde que ya me señalaste tres veces en los guiones, ahora
en el producto.

## 2. Commit y alcance real

`b2f2e89`, este informe aparte. Tres archivos, 125 inserciones.

| Archivo | Qué |
|---|---|
| `app/api/cart.py` | helper `validar_total_prospectivo` y su uso en las escrituras |
| `app/api/products.py` | validación del precio en la ruta de edición |
| `scripts/smoke.mjs` | caso 28 extendido a todos los caminos |

Sin migración, precisiones, interfaz ni nada más. Sigue en **28 casos**.

## 3. Evidencia

### Hallazgo 2 — editar el precio

`PATCH /products/{id}` valida ahora antes de tocar el modelo, no después. El
orden importa: si validara al final, el objeto ya estaría sucio en la sesión.

### Hallazgo 1 — el carrito

Un helper que calcula el total que **tendría** ese vendedor si el ítem quedara
en la cantidad pedida, sumando **los demás ítems del mismo vendedor** —cada
vendedor es una orden distinta, así que el techo aplica por vendedor y no por
carrito—. Se llama antes de asignar la cantidad: si no entra, 400 y el carrito
queda intacto por construcción, no por un `rollback`.

**Encontré una quinta escritura que no estaba en tu lista.** Vos nombraste el
alta y los dos `PUT/PATCH`; `POST /cart/sync` también arma ítems y también podía
guardar un total imposible. La incluí.

| Ruta | Antes | Ahora |
|---|---|---|
| `POST /cart/items`, ítem nuevo | guardaba | valida antes de crear |
| `POST /cart/items`, ítem existente | guardaba | valida la cantidad acumulada |
| `PUT /cart/items/{product_id}` | guardaba | valida antes de asignar |
| `PATCH /cart/items/{item_id}` | guardaba | valida antes de asignar |
| `POST /cart/sync` | guardaba | valida cada ítem |

### El caso 28, ahora de punta a punta

```text
[PASS] 28 Un total fuera del contrato se rechaza sin escribir nada —
  publicar y editar a $99.999.999.999,99 HTTP 400 con precio intacto;
  carrito POST/PUT/PATCH HTTP 400 con el techo en el mensaje y sin cambiar
  el carrito; checkout HTTP 400; órdenes 11→11 sin escritura parcial
```

Seis comprobaciones: publicar por encima del máximo unitario; editar el precio
por encima y verificar contra SQL que **no cambió**; `POST` con cantidad 200
verificando que el carrito no creció; `PUT` y `PATCH` sobre un ítem que sí
entraba, verificando contra SQL que **la cantidad quedó igual**; y el checkout.

**Para probar el checkout tuve que forzar el estado por SQL.** Ya no se puede
llegar a un carrito imposible por la API —que es justamente lo que pediste—, así
que un `UPDATE` directo es el único camino que queda para ejercitar esa defensa.
Lo digo porque un `UPDATE` dentro de una prueba merece que lo mires.

### Estado final

| Comprobación | Resultado |
|---|---|
| Suite oficial, base recreada desde cero | **28/28** |
| `alembic check` | **No new upgrade operations detected** |
| `npm run build` | verde |
| `git -c core.whitespace=cr-at-eol diff --check` | sin avisos |

**No corrido:** `npm run smoke` tal cual, que exige Docker; corrí la misma suite
contra la base recreada a mano. Tampoco `a11y` ni `contraste`: no toqué `src/`.

## 4. Desvíos, riesgos y hallazgos fuera de la tarea

**Sin desvíos**, salvo la quinta ruta del punto 3, que va en la misma dirección
que pediste.

**Riesgo que queda, y no es chico.** El total prospectivo se calcula sobre el
carrito **del que agrega**, pero nada impide que un mismo vendedor acumule entre
varios compradores. Eso no rompe nada hoy: el techo es por orden y cada carrito
produce su propia orden. Lo anoto porque si alguna vez se agrupan órdenes o se
liquida por vendedor, el límite deja de estar donde está el cálculo.

**Sigue abierto el `float` del checkout**, que ya te informé y que vos dejaste
fuera de este alcance. No lo toqué.

## 5. DECISIÓN SOLICITADA

Ninguna nueva. Siguen pendientes de tu orden las dos que ya están sobre la mesa:
el refactor de `float` a `Decimal` antes de Fase 4, y el mensaje genérico del
frontend, que era la pieza que habías anticipado.

El entorno local sigue levantado.
