# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## CART-IMG-QUERY-1 — entregada, para tu revisión

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `c4f1a42` |
| candidato (producto + caso 180 + negativo) | `112eee0` |
| no integrado, no desplegado | `main` sigue en `0bd7fbc` |
| regla nueva en `CLAUDE.md`, pedida por Emi | `a050be3`: dejarte lo mínimo para verificar |

**Resultado.** `GET /cart` y `POST /cart/sync` leían `product_images` una vez
por ítem —1, 3 y 6 lecturas con 1, 3 y 6 ítems—. Ahora leen **una** por
petición, con cualquier cantidad. La respuesta no cambia. Nada tuyo que
decidir para aceptarla.

## Para verificar, lo mínimo

```
SMOKE_CASOS=180 node scripts/smoke.mjs
  → 1/1, y en la línea del PASS: «GET /cart lee product_images 1 con 1,
    1 con 3, 1 con 6 ítem(s); POST /cart/sync lee product_images 1 con 1,
    1 con 3, 1 con 6 ítem(s)»

python3 scripts/sabotajes_cart_img_query_1.py lectura
  → [FAIL] «GET /cart leyó product_images 1 con 1, 3 con 3, 6 con 6
    ítem(s): las lecturas crecen con el carrito…» y deja el árbol como estaba
```

El segundo es el negativo que pediste. El script es del mismo tipo que los
de las piezas anteriores: rompe, reinicia la API, corre el caso y restaura.

Lo demás ya lo corrí yo sobre `112eee0` exacto; las salidas están abajo por si
querés contrastar sin repetir. Qué reproducís lo decidís vos.

## Una decisión técnica que conviene que sepas

El 180 **no** usa el contador del 172. `pg_stat_user_tables` suma búsquedas en
índice, no sentencias: lo medí, **una** sentencia que pide ocho portadas por
índice suma **ocho**. Con ese contador la consulta agrupada podría pasar o
fallar según el plan de PostgreSQL. El 180 cuenta sentencias en el proceso de
la aplicación con un oyente de SQLAlchemy —el mismo instrumento del caso
137—, sin tocar el producto. Se controla a sí mismo antes de medir: vaciar el
carrito tiene que dar cero lecturas de imágenes y más de cero sentencias.

## Antes y después

```
lecturas de product_images    1 ítem   3 ítems   6 ítems
GET /cart          antes         1        3         6
                   después       1        1         1
POST /cart/sync    antes         1        3         6
                   después       1        1         1
```

El «antes» es el mismo caso 180 corrido sobre la base sin cambios: da rojo con
el texto del sabotaje `lectura`. Sentencias totales por petición, con la
misma sonda sobre la base y sobre la candidata:

```
sentencias totales            1 ítem   3 ítems   6 ítems
GET /cart          antes         5        9        15
                   después       5        7        10
POST /cart/sync    antes         8       14        23
                   después       8       12        18
```

Lo que sigue creciendo es `products`, que no es de esta pieza (abajo).

## Qué cambió

`backend/app/api/cart.py` (+37 −32): una función, `portadas_de`, trae las
portadas de toda la petición en una sentencia; las cinco copias de la
consulta —lectura, sync, alta y las dos actualizaciones— la usan. La regla es
la misma: la principal o `null`; una secundaria nunca es portada. Carrito
vacío: cero lecturas. Sin migración, sin contrato nuevo, sin UI. La migración
y la regla de `PRIMARY-IMAGE-INTEGRITY-1` quedaron intactas.

El caso 180 fabrica seis publicaciones —entre ellas una con la principal
**detrás** de una secundaria y una con sólo secundaria—, mide 1, 3 y 6 ítems,
compara el carrito medido con el que sirve la API por HTTP (idéntico) y cada
ítem contra la base: portada, cantidad, precio, subtotal y total en centavos.
También los tres caminos de un solo ítem.

## Lo que corrí, sobre `112eee0`

```
suite completa desde base limpia                179/180; único rojo el 131 (sin Docker aquí)
caso 180                                        1/1
caso 180 sobre la base sin cambios              0/1 (el «antes»)
sabotajes lectura / sync / secundaria           3/3 rojos; árbol intacto después
build · lint · tsc --noEmit · node --check      verdes
compileall · pip check                          verdes
alembic check                                   No new upgrade operations detected
diff-check compatible con CRLF                  sin avisos
```

`secundaria` quita el filtro por principal: las lecturas no cambian y lo caza
sólo el contraste con la base («sync con 3: «sólo secundaria» salió con
portada "…-2-s.png" y la base dice null»). A11y y contraste no corridos: no
cambia UI. Si corrés sueltos el 7, 45 o 59–61, necesitan 1–6 delante por
estado compartido; no es de esta pieza.

## Visto y no tocado

- `products` también se lee una vez por ítem en `GET /cart` y en el sync
  (medido: 1, 3 y 6). Mismo N+1, otra tabla. Cerrarlo es chico y no toca
  contrato; si lo querés, es otra tarea.
- Alta y actualizaciones cargan todas las publicaciones del carrito para
  validar el tope del vendedor. Leído en el código, no medido.
- Que el 172 llegue a dar un rojo falso con más datos es **hipótesis**: sólo
  medí que el contador suma una búsqueda por clave.

No toqué `main`, Railway ni datos remotos, y no desplegué. Freno acá.
