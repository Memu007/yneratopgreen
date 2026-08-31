# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## ORD-SELF-1R — rechazar un sync no puede crear un carrito

Hecho. Producto e informe en commits separados. **No desplegué.**

- Producto: `40b589b` — «ORD-SELF-1R: rechazar un sync no puede crear un carrito»
- La suite queda en **140/140**, verde en dos corridas completas desde base limpia.

---

### 0. Primero, la corrección del informe

Tenías razón y la afirmación era falsa. En el informe de ORD-SELF-1 escribí, en
la tabla de la sección 4:

> «Esa última fila es la que prueba que el rechazo **tampoco crea** un carrito:
> el freno va antes de `get_or_create_cart`.»

Eso era cierto de **`/cart/items`** y lo di por cierto de los dos endpoints. En
`/cart/sync` era falso: `get_or_create_cart()` era la primera línea de la
función y hace `commit` cuando no hay carrito activo.

El error de método es el que importa: medí una propiedad en un camino y la
afirmé de otro que no comparte ese código. Los dos endpoints deciden por
separado cuándo nace el carrito, así que medir uno no dice nada del otro.

### 1. El rojo contra `ecbb375`

Con el transportista, que llega sin ningún carrito, por la API real:

```
carritos del transportista antes: 0
POST /cart/sync -> 409 «… es tu propia publicación: no podés comprarla.
                         Quitala del carrito para continuar.»
carritos del transportista despues: 1
items del transportista despues:    0

122eae3a-ab39-46b3-bf95-2a4a339b06de | ACTIVE | 2026-08-31 10:56:37
```

El 409 correcto, y una fila `ACTIVE` vacía que la persona nunca pidió.

En el caso 140, con el `cart.py` de `ecbb375`:

```
[FAIL] 140 … — /cart/sync rechazado le dejo 1 carritos y 0 items a una cuenta
              que no tenia ninguno: el freno tiene que ir ANTES de obtener o
              crear el carrito, no despues
```

Y con la corrección, `[PASS]`.

### 2. La corrección

Una línea que se mueve. `get_or_create_cart()` sale del principio de
`sync_cart()` y pasa a la segunda pasada, cuando ya pasaron publicación propia,
existencia, estado, stock y contrato monetario: o sea cuando ya está decidido
que se va a escribir.

No cambié la regla, ni el mensaje, ni el orden de las validaciones, ni
`/cart/items`, ni el checkout, ni la interfaz.

### 3. Qué prueba cada endpoint ahora, por separado

El caso usa las **dos** cuentas que llegan sin carrito, y ya no mezcla lo que
mide en cada una:

| | admin | transportista |
|---|---|---|
| carritos al empezar | 0 | 0 |
| `POST /cart/items` con lo suyo | 409, **0 carritos** | 409, **0 carritos, 0 ítems** |
| `POST /cart/sync` con lo suyo | — | 409, **0 carritos, 0 ítems** |
| `POST /cart/sync` con un id inexistente | — | 400, **0 carritos** |
| `POST /cart/sync` vacío y válido | — | 200, **1 carrito, 0 ítems** |

Las dos filas del medio son las nuevas. La tercera muestra que la corrección
vale para **cualquier** rechazo de sync y no sólo para el de publicación propia:
antes, cualquiera de esos 400 también dejaba su carrito.

### 4. El sync vacío, que era tu freno

Lo miré antes de mover nada, porque era la condición que pediste para frenar.
**No quedó ambiguo:** un sync válido y vacío sigue naciendo con su carrito
vacío, porque llega a la segunda pasada como cualquier sync válido. Medido:

```
1. sync vacío válido       -> HTTP 200, carritos=1, items=0
2. sync con id inexistente -> HTTP 400, carritos=0
3. sync válido ajeno       -> HTTP 200, carritos=1, items=1
```

El contrato de hoy queda igual. Lo agregué como aserción del caso para que la
excepción sea deliberada y no dependa de que alguien se acuerde.

### 5. Lo que ya estaba y sigue estando

Sin cambios y verde: el 409 con el mismo mensaje en los cinco caminos, el sync
mixto que se rechaza entero conservando el carrito anterior, el sync ajeno
válido, las dos defensas del checkout, `payment-options`, «Tu publicación» en
tarjeta y detalle, la excepción de cotización y `orders WHERE buyer_id =
seller_id` en **0**.

### 6. La comprobación estática, y por qué no alcanzaba

Tenías razón también acá: leer que `propiedad.exigir_` aparece en el archivo no
dice **dónde** aparece. No la reemplacé por una comprobación estática más fina
—«que la línea esté antes que la otra» sigue mirando el archivo y no el
producto—: lo que ahora sostiene la afirmación es la medición de arriba, que
falla si el orden se rompe, no importa cómo esté escrito. La lectura estática
quedó donde estaba, al final, como lo que es: un recordatorio de que la regla
vive en un solo módulo.

### 7. Que el caso se pueda repetir

El sync vacío deja un carrito, así que el caso vacía los carritos del
transportista al terminar y la cuenta queda como la encontró. Corrí el caso
**dos veces seguidas sobre la misma base** y pasa las dos. Sin eso, la segunda
corrida fallaba por su propio rastro, que es la clase de prueba que después
nadie entiende.

La limpieza va por los modelos de la aplicación, igual que la inyección del
carrito heredado. El acceso SQL de las puertas sigue siendo de lectura.

### 8. Puertas, desde base limpia

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

Diff del producto:

```
 backend/app/api/cart.py | 15 ++++++--
 scripts/smoke.mjs       | 89 ++++++++++++++++++++++++++++++++++++++++++++
```

Sin tocar otros hallazgos, navegación, transferencias, administración, Mercado
Pago, Railway, seed, datos, carritos históricos, mensajes, interfaz ni la
excepción de cotización. **El caso 116 no se tocó**, como pediste.

### 9. Hashes

```
backend/app/api/cart.py   579f7187c24e112b
scripts/smoke.mjs         93021a564d0444fa
```

(SHA-256 truncado a 16, del árbol en el commit de producto.)

### 10. Un commit más, que no es de esta tarea

En `747cd2c` corregí el guion de arranque del entorno que había subido antes:
`setsid`, cuando el proceso no es líder de grupo, no forka —hace `exec` en el
mismo proceso—, así que el servidor seguía colgando del guion y el arranque no
terminaba. Con `--fork` queda afuera de verdad. Lo separé del producto porque no
tiene nada que ver con ORD-SELF-1R; lo menciono para que no aparezca sin
explicación en el historial.

### 11. Riesgos residuales

1. **`get_or_create_cart` sigue haciendo `commit` por su cuenta.** Lo dejé como
   está: cambiarlo toca también `/cart/items`, `PUT`, `PATCH`, `DELETE` y el
   `GET`, y eso excede el alcance. Lo que hice fue no llamarlo antes de tiempo.
   Si mañana aparece un quinto camino que escriba carrito, va a tener que
   acordarse de lo mismo.
2. **`GET /cart` también lo llama**, así que una consulta de lectura le crea el
   carrito a quien no lo tenía. No es el defecto que reportaste y no lo toqué,
   pero es la misma raíz y conviene decidirlo junto con el punto anterior.
3. Sigue abierto el **caso 116**, que anoté con su mecanismo y su frecuencia en
   el informe anterior y que dejaste para TEST-IMG-1.

### 12. Frenos

No frené: el sync vacío no quedó ambiguo, así que la condición que marcaste no
se cumplió. No borré datos, no cambié el contrato de pagos, no toqué el caso
116, no desplegué y no abrí ninguna otra pieza de la cola. `PRE_FIRMA.md` sigue
fuera del versionado y lo confirmé antes de empujar.
