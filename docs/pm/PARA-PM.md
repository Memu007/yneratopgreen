# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## CART-PRODUCT-QUERY-1 — entregada, para tu revisión

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `6e64c19` |
| candidato (producto + caso 181 + negativos) | `1e4a63c` |
| no integrado, no desplegado | `main` sigue en `0bd7fbc` |

**Resultado.** `GET /cart` y `POST /cart/sync` leen `products` **una** vez por
petición, con 1, 3 o 6 ítems. Antes, 1/3/6. Encontré y cerré además un tercer
camino que el 180 no medía: el sync de alguien que todavía no tiene carrito
leía el **doble**, 2/6/12. Mismas respuestas, mismos errores, mismo orden.

**Una sola cosa para que decidas, y no bloquea:** en ese tercer camino, el
nombre y el precio que se guardan ahora son los que se validaron, no una
relectura posterior (detalle abajo). Si preferís la relectura, se hace en una
consulta más: ese camino quedaría en dos lecturas, constantes, en vez de una.

## Para verificar, lo mínimo

```
SMOKE_CASOS=181 node scripts/smoke.mjs
  → 1/1, y en la línea del PASS: «GET /cart lee products 1 con 1, 1 con 3,
    1 con 6 ítem(s); POST /cart/sync con carrito lee products 1 con 1, 1 con
    3, 1 con 6 ítem(s); POST /cart/sync que crea el carrito lee products 1
    con 1, 1 con 3, 1 con 6 ítem(s)»

python3 scripts/sabotajes_cart_product_query_1.py lectura sync
  → dos [FAIL]: «GET /cart leyó products 1 con 1, 3 con 3, 6 con 6 ítem(s)…»
    y «POST /cart/sync con carrito leyó products 1 con 1, 3 con 3, 6 con 6
    ítem(s)…»; deja el árbol como estaba
```

Son los dos negativos que pediste, cada uno reponiendo la lectura por ítem.
El script trae un tercero, `creacion`, para el camino nuevo. Lo demás ya lo
corrí sobre `1e4a63c`; las salidas van abajo.

## Antes y después

```
lecturas de products                  1 ítem   3 ítems   6 ítems
GET /cart                  antes         1        3         6
                           después       1        1         1
sync con carrito           antes         1        3         6
                           después       1        1         1
sync que crea el carrito   antes         2        6        12
                           después       1        1         1
```

Sentencias totales, después: GET 5/5/5; sync con carrito 8/10/13; sync que
crea el carrito 10/12/15. Lo que sigue creciendo en el sync son las
escrituras de ítems, de a una. `product_images` sigue en 1 por petición y en 0
con el carrito vacío.

El «antes» de GET es el propio 181 sobre la base: rojo «GET /cart leyó
products 1 con 1, 3 con 3, 6 con 6 ítem(s)». Los otros dos «antes» son de la
sonda con el mismo oyente.

## Qué cambió

`backend/app/api/cart.py` (+38 −16), nada fuera de ese archivo:

- **GET** pide los ítems con la misma consulta que hacía `cart.items` y carga
  sus publicaciones con `selectinload`, el cargador del ORM. Sin abstracción
  nueva.
- **Sync, primera pasada:** lee las publicaciones pedidas en una consulta y
  valida recorriendo el pedido en su orden, así que el primer error que se
  informa es el de siempre.
- **Sync, segunda pasada:** si el carrito no existía, `get_or_create_cart` lo
  crea con un commit, y el commit vence todo lo leído; tocar después cada
  publicación la releía, una por una. Ahora nombre y precio se toman **antes**
  de crear el carrito.

Eso último es lo que te marco arriba. Antes, en ese camino, lo guardado era una
relectura posterior a la validación: si el precio cambiaba justo en medio del
pedido, se guardaba un precio que no se había validado contra el tope. Ahora
se guarda lo validado, igual que ya pasaba cuando el carrito existía. Sólo
difiere si alguien edita el precio durante esa misma petición.

## Lo que corrí, sobre `1e4a63c`

```
suite completa desde base limpia                180/181; único rojo el 131 (sin Docker aquí)
caso 181                                        1/1
caso 181 sobre la base sin cambios              0/1 (el «antes» de GET)
sabotajes lectura / sync / creacion             3/3 rojos: 1/3/6, 1/3/6, 2/4/7
1–7, 29, 45, 59–61, 75, 140, 170, 176, 179–181  19/19, desde base limpia
build · lint · tsc --noEmit · node --check      verdes
compileall · pip check                          verdes
alembic check                                   No new upgrade operations detected
diff-check compatible con CRLF                  sin avisos
```

`creacion` da 2/4/7 y no 2/6/12 porque la primera pasada ya lee de a una sola
consulta; lo que repone es la relectura por ítem después del commit.

Qué más mide el 181, además del conteo: orden de sync igual al del pedido y
de GET igual al de la tabla, con los identificadores de línea; un producto
repetido sigue siendo una línea con la suma; siete rechazos —inexistente,
inactiva, propia, sin stock, cantidad de más— con su código y su texto
exactos, **el primero en el orden del pedido** (van en pares invertidos) y sin
tocar el carrito; y un rechazo no le crea carrito a quien no tenía.

Un aviso para que no te cueste una corrida: el caso 2 registra un correo fijo,
así que correr 1–7 sobre una base ya usada da rojos en cadena que no son de
esta pieza. Desde base limpia pasan.

## Visto y no tocado

- La primera pasada del sync lee `categories` una vez por categoría distinta
  (para saber si es servicio). Con la categoría única del caso, 1; con
  varias, crece por categoría, no por ítem. Leído en el código.
- Alta y actualizaciones siguen cargando las publicaciones del carrito para
  validar el tope del vendedor. Leído en el código, no medido.

No toqué `main`, Railway, datos remotos, modelos ni migraciones, y no
desplegué. Freno acá.
