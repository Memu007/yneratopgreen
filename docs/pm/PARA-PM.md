# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## ORD-SELF-1 — nadie compra su propia publicación

Hecho. Producto e informe en commits separados. **No desplegué.**

- Producto: `ecbb375` — «ORD-SELF-1: nadie compra su propia publicación»
- Regresión nueva: caso **140**. La suite queda en **140/140**, verde en dos
  corridas completas desde base limpia.

---

### 1. El rojo contra `aadecb5`, y era peor de lo que decía el hallazgo

No es que «se puede agregar al carrito». Se puede **llegar a la orden**. Con el
vendedor del seed, por la API real:

```
POST /cart/items            -> 200, fila creada en su carrito
POST /cart/sync             -> 200
GET  /orders/payment-options-> 200 [{seller_name:"Juan Vendedor", methods:["transfer"],
                                     cbu:"0000009000000000000024", ...}]
POST /orders/checkout/transfer -> 200 {"orders":[{"order_number":"ORD-20260830-E401B841",
                                     "status":"awaiting_transfer_receipt","amount":540000}]}

ordenes del vendedor: 0 -> 1
SELECT COUNT(*) FROM orders WHERE buyer_id = seller_id;  ->  1
ORD-20260830-E401B841 | AWAITING_TRANSFER_RECEIPT | 540000.00
```

O sea: una orden de **$540.000** esperando que Juan Vendedor le transfiera a
Juan Vendedor, al CBU que la propia pantalla le ofreció como contraparte.

El caso 140 lo agarra en el primer paso, y el rojo dice qué respondió y no sólo
que no fue lo esperado:

```
[FAIL] 140 … — POST /cart/items con «Kit de Filtros y Correas para Cosechadora»:
              se esperaba 409 y respondio HTTP 200
              {"id":"ce491bdd-…","product_id":"17d4912b-…","product_name":"Kit de Filtros…"}
```

### 2. Dónde vive la regla

En `backend/app/services/propiedad.py`, **una sola vez**, y compara
**identidades, no roles**. La aplican los cuatro caminos que pueden escribir:

| camino | dónde corta | antes de |
|---|---|---|
| `POST /cart/items` | apenas resuelve el producto | del stock, del precio y del carrito |
| `POST /cart/sync` | en la primera pasada | de borrar y reemplazar nada |
| `GET /orders/payment-options` | apenas toma el carrito | de armar los grupos |
| `checkout.preparar()` | primera línea después del carrito | del destino, del traslado, del medio y de la primera orden |

Los dos checkouts —transferencia y Mercado Pago— pasan por el mismo `preparar()`,
así que no hay dos reglas que se puedan separar. El caso 140 lo afirma leyendo
los archivos: el módulo existe y los tres que escriben lo llaman.

Que el freno del checkout vaya **antes** que el destino y que el medio de pago no
es cosmético: si fuera después, un carrito heredado podía rebotar con «la
localidad no pertenece al padrón» y esconder el motivo verdadero.

### 3. Los cuatro mensajes, medidos

```
POST /cart/items      409  «Kit de Filtros…» es tu propia publicación: no podés comprarla.
POST /cart/sync       409  … no podés comprarla. Quitala del carrito para continuar.
GET  payment-options  409  … no podés comprarla. Quitala del carrito para continuar.
POST checkout/transfer 409 … no podés comprarla. Quitala del carrito para continuar.
POST checkout          409 … no podés comprarla. Quitala del carrito para continuar.
```

La diferencia es a propósito y el caso la exige en las dos direcciones. Cuando
la persona **recién la agrega** no hay nada que sacar, y mandarla a «quitala del
carrito» sería mandarla a buscar algo que no está. Cuando **ya la tiene
guardada**, el paso siguiente sí es sacarla y hay que decírselo, porque el ítem
**no se borra solo**: borrarlo en silencio sería decidir por ella sobre algo que
ella eligió.

### 4. El rechazo no escribe nada

Medido sobre la base, con un carrito heredado contaminado a propósito:

| | antes | después del 409 |
|---|---|---|
| filas del carrito | 1 propia + 1 ajena | iguales, mismas cantidades |
| estado del carrito | `ACTIVE` | `ACTIVE` |
| órdenes del comprador | n | n |
| `orders WHERE buyer_id = seller_id` | 0 | **0** |
| filas en `payments` | n | n |
| `stock_reservado` de la propia | n | n |
| notificaciones | n | n |
| carritos del admin (no tenía ninguno) | 0 | **0** |

Esa última fila es la que prueba que el rechazo **tampoco crea** un carrito: el
freno va antes de `get_or_create_cart`, y se mide con una cuenta que no tiene
ninguno.

### 5. Entero, y después normal

- Un sync con **[ajena, propia]** se rechaza **entero**: no se compra la ajena
  por su cuenta. El carrito anterior queda intacto, no vaciado.
- Quitada la propia, el mismo sync pasa y `payment-options` vuelve a 200 con el
  vendedor ajeno —y **sin** la propia cuenta como contraparte—.
- La propia **sin precio publicado** sigue diciendo «Solicitar cotización»: pedir
  presupuesto no crea compra, orden ni carrito, así que ese camino queda como
  estaba, tal como pediste. El caso lo afirma para que la excepción sea
  deliberada y no un olvido.

### 6. No depende del rol

- **admin**, con una publicación suya del seed → 409.
- **transportista**, publicando por la API real —tiene rol `user`, así que puede
  publicar— y agregándola → 409. La publicación se retira al terminar.

La regla no mira `role`; mira `product.seller_id == user.id`.

### 7. La pantalla

En Inicio, Mercado y Servicios, con la sesión del vendedor:

```
Inicio      3 propias / 0 ajenas
Mercado   100 propias / 0 ajenas
Servicios   1 propia  / 1 ajena  / 1 propia a cotizar
detalle propio abierto en: Inicio, Mercado, Servicios, Mercado buscado
carrito al terminar: 0
```

El caso hace dos cosas distintas a propósito:

1. **Exhaustiva**: recorre **toda** tarjeta dibujada en las tres pantallas y
   exige que el rótulo diga la verdad sobre de quién es. Es más fuerte que «hay
   al menos una»: no hay tarjeta que se escape.
2. **Dirigida**: además busca en el Mercado, por nombre, una propia y una ajena.
   Eso no depende de qué quedó arriba en la grilla —en la suite completa los
   casos anteriores publican cien productos y tapan el seed—, así que la prueba
   no se vuelve vacía ni se pone roja porque el catálogo cambió de composición.

La propia dice **«Tu publicación»**, el botón está deshabilitado en tarjeta y en
detalle, y el carrito queda en cero. La ajena conserva «Agregar al carrito»,
«Agregar» y «Contratar», exactamente como quedaron en UX-COH-1R.

No construí edición, mensajería ni navegación nueva. El pie del detalle dice
«Esta publicación es tuya y nadie se compra a sí mismo. Podés seguir viéndola
como la ve cualquiera» y nada más.

### 8. Por qué 409 y no 403

No es un permiso que falte: la misma persona, con la misma sesión, compra sin
problema cualquier otra publicación. Lo que no existe es **esa combinación** de
comprador y publicación. Es un conflicto con el estado de las cosas, que es lo
que 409 nombra, y es el código que pediste para el carrito; lo usé también en el
checkout y en las formas de pago para que la misma regla no hable con dos voces.

### 9. Puertas, desde base limpia

```
base limpia (drop/create + PostGIS + alembic upgrade head + seed)
node scripts/smoke.mjs                          140/140   (0 fallaron)
base limpia otra vez
node scripts/smoke.mjs                          140/140   (0 fallaron)
npm run build                                   ok
npm run lint                                    ok (--max-warnings 0)
python -m compileall backend/app                ok
python -m pip check                             No broken requirements found
git -c core.whitespace=cr-at-eol diff --check   limpio
npm run a11y -- --todas                         sin violaciones bloqueantes
npm run contraste                               TODO OK, cobertura completa
npm run hito                                    6/6 pasos
```

Diff:

```
 backend/app/services/propiedad.py                  |  78 +++ (nuevo)
 backend/app/api/cart.py                            |  17 +-
 backend/app/api/orders.py                          |   8 +-
 backend/app/services/checkout.py                   |   9 +-
 src/utils/anatomia.ts                              |  22 +-
 src/components/ProductCard/ProductCard.tsx         |  11 +-
 src/components/ProductDetail/ProductDetailModal.tsx|  17 +-
 scripts/smoke.mjs                                  | 540 +++++++++++++++++
```

Sin migración, sin seed, sin limpiar carritos históricos, sin rediseño, sin tocar
precio, stock, pagos, Mercado Pago, logística, ratings, navegación Atrás ni
Railway. **No agregué dependencias.** El único archivo nuevo es un módulo de 78
líneas del propio proyecto.

### 10. Un hallazgo que me encontré y NO arreglé: el caso 116

Durante estas corridas el **caso 116** se puso rojo dos veces, con
`con cabecera la imagen no entró: HTTP 400`. **No es mío** —el diff no toca ni
`products.py`, ni imágenes, ni una sola línea del caso 116— y ya te lo había
informado como intermitente en UX-COH-1R. Ahora lo tengo medido:

- El caso elige su publicación así: `SELECT id FROM products WHERE seller_id = …
  ORDER BY id LIMIT 1`. Los ids son UUID que el seed genera **al azar**, así que
  cuál sale primera es un sorteo distinto en cada base.
- `POST /products/{id}/images` tiene un tope de **3 imágenes** por publicación.
- El seed le deja al vendedor **16 publicaciones**, y **exactamente una** ya
  tiene 3 imágenes. El caso 126 —el que publica cien productos más— corre
  después, así que el sorteo es entre esas 16.
- Cuando sale sorteada esa, la subida que el caso da por buena rebota. Lo
  reproduje contra la API real, llenando esa publicación por el camino normal:

```
publicacion elegida por el caso 116: «Smoke tapa …-077»
imagenes despues de llenarla: 3
la subida que el caso 116 da por buena -> 400
  {"detail":"El producto ya tiene el máximo de 3 imágenes permitidas"}
```

Es **1 de cada 16 bases**, o sea ~6 % de las corridas, y coincide con las dos que
vi. El arreglo es una línea en la consulta del caso —pedir una publicación con
lugar— y de paso que el `assert` imprima el cuerpo, que hoy no lo hace y por eso
el rojo no dice por qué. **No lo toqué: no está en tu alcance.** Si querés, lo
cierro en el bloque siguiente.

### 11. Riesgos residuales

1. **La pantalla no puede saber de quién es una publicación sin sesión.** Sin
   ingresar, la tarjeta sigue diciendo «Ingresar para continuar», y recién con
   la sesión abierta pasa a «Tu publicación». Es correcto —no hay identidad que
   comparar— pero significa que el rótulo cambia después de ingresar.
2. **El carrito heredado bloquea el checkout entero hasta que se saque el ítem.**
   Es deliberado y es lo que pediste, pero si alguien tiene la publicación propia
   guardada de antes, no puede comprar **nada** hasta quitarla. El mensaje dice
   cuál es y qué hacer.
3. **`GET /cart` sigue devolviendo el carrito heredado con la publicación propia
   adentro**, sin marcarla. Es lo que permite verla y sacarla; no la esconde ni
   la borra. Si querés que la señale en la lista, es otra tarea.
4. **Si mañana aparece un quinto camino que escriba carrito u órdenes**, esta
   regla no lo alcanza sola. El caso 140 afirma que los cuatro de hoy la
   comparten, pero no puede afirmar nada de uno que todavía no existe.
5. Siguen abiertos **B4** (el botón atrás con el detalle abierto sale del sitio),
   **C1** (el foco vuelve a `<body>` al cerrar el detalle) y **C2/C3**. No los
   toqué.

### 12. Hashes

```
backend/app/services/propiedad.py                    dc4e62c909535250
backend/app/api/cart.py                              170fab0748dd53d9
backend/app/api/orders.py                            32b33d9527cd4e2c
backend/app/services/checkout.py                     ea82e42301e5a650
src/utils/anatomia.ts                                3d4d9f435b04b4f5
src/components/ProductCard/ProductCard.tsx           a14bdd5d93447a03
src/components/ProductDetail/ProductDetailModal.tsx  af6fd747a80aead3
scripts/smoke.mjs                                    9b36831489ae020f
```

(SHA-256 truncado a 16, del árbol en el commit de producto.)

### 13. Frenos

No hizo falta ninguno de los tres que marcaste: no borré datos, no toqué el
contrato de pagos y no hay órdenes históricas con comprador igual a vendedor
—`SELECT COUNT(*) FROM orders WHERE buyer_id = seller_id` da **0** en base
limpia y sigue dando 0 después de todo el recorrido—. La única que existió la
creé yo reproduciendo el defecto, y desapareció al recrear la base.

El carrito heredado del caso lo escribí donde vive la aplicación, con sus
modelos, y sólo en la base descartable: por la API ya no se puede meter una
publicación propia, que es justamente lo que hay que poder reproducir. **No
agregué ningún interruptor al producto.** No desplegué. No abrí ningún otro
hallazgo. `PRE_FIRMA.md` sigue fuera del versionado y lo confirmé antes de
empujar.
