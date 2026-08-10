# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-10.

## 1. Resultado

**Terminado.** Tu diagnóstico era exacto, incluido el mecanismo.

Yo declaré `sync` como quinta ruta cubierta y **no la cubrí**: le puse la
llamada al helper adentro del bucle equivocado y no la probé. Declararla sin
probarla es lo que hizo que el 28/28 anterior no significara lo que decía.

## 2. Commit y alcance real

`5616aec`, este informe aparte. Dos archivos, 149 inserciones.

| Archivo | Qué |
|---|---|
| `app/api/cart.py` | `sync` en dos pasadas; helper que omite por identidad |
| `scripts/smoke.mjs` | paso de `sync` en el caso 28; corrección del `UPDATE` |

Sin migración, precisiones, interfaz ni nada más. Sigue en **28 casos**.

## 3. Evidencia

### `sync`, en dos pasadas

**Primera pasada, sin escribir:** resuelve productos, normaliza un mismo
`product_id` repetido a una sola línea sumando cantidades, aplica la regla de
stock **sobre esa cantidad acumulada**, agrupa por vendedor, y valida cada línea
y el total agregado. **Segunda pasada:** recién ahí borra el carrito anterior y
persiste el reemplazo.

Sobre los duplicados elegí **normalizar y no rechazar**. `sync` existe para
volcar un carrito de `localStorage`, y que el frontend mande el mismo producto
dos veces es un accidente previsible; sumarlo hace lo que el usuario quiso.
Rechazar sería igual de defendible: **si preferís el rechazo explícito, es una
línea.**

### El helper

Antes omitía **todas** las filas con el mismo `product_id`. Ahora omite por
identidad **sólo la fila que se está reemplazando**, y las tres llamadas le
pasan esa fila. Un carrito heredado con duplicados ya no queda subestimado.

### El caso 28, con el paso nuevo

```text
[PASS] 28 Un total fuera del contrato se rechaza sin escribir nada —
  publicar y editar a $99.999.999.999,99 HTTP 400 con precio intacto;
  carrito POST/PUT/PATCH HTTP 400 con el techo en el mensaje y sin cambiar
  el carrito; sync con dos lineas del mismo vendedor HTTP 400 sin tocar el
  carrito previo; checkout HTTP 400; órdenes 11→11 sin escritura parcial
```

Dos publicaciones del mismo vendedor a $9.999.999.999,99, 60 unidades cada una:
**$599.999.999.999,40 por línea** —dentro del techo— y **$1.199.999.999.998,80
juntas** —fuera—. Respuesta comprobada:

```text
El total del carrito para este vendedor de $1.199.999.999.998,80 supera el
máximo admitido de $999.999.999.999,99. Reducí la cantidad o dividí la compra.
```

El caso compara las filas del carrito previo **producto por producto y cantidad
por cantidad** antes y después del rechazo, no sólo el conteo. Y después
sincroniza **una sola** de las dos líneas y verifica que entra: sin eso, el 400
podría estar viniendo de la línea y no del agregado.

### Un error mío en la prueba, que apareció en el camino

La primera corrida dio **27/28**. No era el código: el paso del checkout forzaba
el estado con `UPDATE … WHERE id = <fila>`, y el paso de `sync` que acababa de
agregar **reemplaza el carrito entero**, así que ese id ya no existía. El
`UPDATE` afectaba cero filas y el checkout devolvía 200.

Lo apunté por producto y comprador. Lo cuento porque el síntoma —"la API no
respondió 400"— parecía un fallo del backend y no lo era.

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

**Sin desvíos.**

**Riesgo que queda.** `sync` descarta en silencio los productos que no encuentra
o que quedaron sin stock: eso ya era así y no lo cambié, porque cambiarlo altera
el comportamiento del volcado desde `localStorage`. Pero significa que el
usuario puede sincronizar y recibir 200 con **menos** ítems de los que mandó,
sin enterarse. No es del contrato monetario; lo dejo anotado.

**Sigue abierto el `float` del checkout**, que ya te informé y vos dejaste fuera
de alcance.

## 5. DECISIÓN SOLICITADA

**a) Duplicados en `sync`** (punto 3): dejé sumar. **Recomiendo mantenerlo.**
Alternativa: rechazo explícito con 400, una línea.

**b) El descarte silencioso de `sync`** (punto 4). Beneficio: el usuario se
entera de qué no entró. Esfuerzo: chico, es devolver la lista de descartados.
Riesgo: cambia el contrato de respuesta y el frontend lo tiene que mostrar.
Fase: la misma pieza del mensaje genérico, que ya tenías anticipada.

Nada bloqueado. El entorno local sigue levantado.
