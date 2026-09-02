# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## CART-RECOVERY-1 — una copia local inservible ya no voltea la aplicación

Hecho. Producto/regresión e informe en commits separados. **No desplegué.**

- Producto y regresión: `ebb2b20` — «CART-RECOVERY-1: una copia local
  inservible no voltea la aplicación»
- Regresión nueva: caso **142**. La suite pasa a **142 casos**.

Tomo la corrección: `TRANSFER-REVIEW-1` no está cerrada. Con «queda cerrada»
quise decir «no la abrí»; de acá en adelante escribo «no la abrí», que no se
puede leer como entrega.

---

### 1. El rojo, contra `14d561b`, dicho por la propia pantalla

```
[FAIL] 142 … — con JSON malformado la aplicacion se cayo:
  « Ocurrió un errorRecargá la página para volver a intentarlo. »
```

Y, desactivando sólo la parte A para poder ver la parte B:

```
[FAIL] 142 … — un carrito valido no sobrevivio la recarga:
  antes 732 caracteres, despues "[]"
```

Dos rojos independientes contra `14d561b`. El segundo no estaba en tu
descripción y es el que explica todo lo demás.

### 2. Corrección a la premisa: dónde se cae y dónde no

Antes de tocar nada medí los dos valores que pediste en **dos frentes**: Vite
en desarrollo —`localhost:5173`, que es contra lo que corre la suite— y el
`dist` construido y servido, que es lo que va a usar el cliente.

```
valor guardado en agromarket_cart   Vite (5173)        dist servido (4173)
---------------------------------   ----------------   -------------------
{no es json                         ErrorBoundary      ErrorBoundary
{"items":[]}                        sigue navegable    ErrorBoundary
"un carrito"                        sigue navegable    ErrorBoundary
[{"quantity":2}]                    sigue navegable    ErrorBoundary
carrito VÁLIDO + recarga            SE PIERDE          sobrevive
```

Es decir: **la raíz que no es un arreglo sí voltea la aplicación, pero la
construida, no la de desarrollo.** Una regresión de navegador corriendo contra
Vite no se puede poner roja por ese valor. Te lo digo antes de que lo leas como
cobertura que no existe: el caso 142 igual lo exige —y es rojo en el `dist`—,
pero su rojo en la suite lo aportan el JSON malformado y el carrito perdido.

El motivo es el mismo defecto visto de otro lado. Instrumenté `localStorage`
antes de que corriera un solo script de la aplicación y anoté cada movimiento
de la clave durante una recarga:

```
Vite (modo estricto)           dist servido
1. getItem  «[{"product"…»     1. getItem  «[{"product"…»
2. setItem  «[]»               2. setItem  «[]»
3. getItem  «[]»               3. setItem  «[{"product"…»
4. setItem  «[]»
5. setItem  «[]»
```

El efecto que guardaba corría en el mismo montaje que el que leía y escribía el
carrito vacío inicial **encima** de lo guardado. En el `dist` la lectura ya
había mandado y el paso 3 lo devuelve; con React en modo estricto hay un
segundo montaje que lee justo el vacío del paso 2, y ahí se pierde el carrito
—y de paso queda tapado el valor inválido antes de que llegue a dibujarse—.

Por eso la corrección no es sólo un `try`: la lectura se muda al armado del
estado. Una sola lectura, validada, antes del primer render.

### 3. Lo que cambió

Un archivo de producto:

```
 src/contexts/CartContext.tsx |  82 ++++++++++++++---
 scripts/smoke.mjs            | 206 +++++++++++++++++++++++++++++++++++++++
```

Sin Backend, sin endpoint, sin migración, sin dependencia, sin formato nuevo de
persistencia y sin refactor del carrito, la autenticación ni el checkout.

Qué cuenta como usable es el mínimo que el carrito necesita para existir: una
publicación identificada, un precio que se pueda cobrar —la misma
`tienePrecioPublicado` que ya usa el catálogo, no una regla nueva— y una
cantidad positiva. Con menos que eso no hay total que sumar ni ítem que mandar
al checkout, y el intento de dibujarlo es justamente lo que tiraba la pantalla.

Lo que sirve se conserva tal cual; si no queda nada aprovechable se descarta
**sólo** `agromarket_cart` y se arranca con carrito vacío. El caso comprueba en
cada valor inválido que la sesión y una clave ajena sembrada a propósito siguen
enteras.

### 4. El carrito del servidor no se toca

La parte C levanta la aplicación con la copia local rota, con sesión y con un
carrito armado en el servidor, y **escucha las peticiones del navegador**:

```
carrito del servidor antes = después
peticiones a /cart/sync    = 0
```

No es que el `sync` viaje vacío: no viaja. El servidor sigue siendo la
autoridad al entrar al checkout.

### 5. Puertas

```
base limpia + node scripts/smoke.mjs            140/142   (121 y 131 rojos)
base limpia otra vez                            141/142   (131 rojo)
npm run build                                   ok
npm run lint                                    ok (--max-warnings 0)
node --check scripts/smoke.mjs                  ok
python -m compileall backend/app                ok
python -m pip check                             ok
git -c core.whitespace=cr-at-eol diff --check   limpio
npm run a11y -- --todas                         64/64 pantallas, 0 bloqueantes
npm run contraste                               TODO OK, cobertura completa
npm run hito                                    6/6 pasos
```

**El 131 es el de siempre**: acá no hay demonio de Docker y la receta CSP no
puede correr en `alpine:3`. En tu Mac pasa.

**El 121 apareció en una corrida y en la otra no**, con el mismo mensaje que
viste vos en tu primer pase de `TRANSFER-REC-1` —o sea, con mi cambio y sin
él—: «la tarjeta no pinta la placa de «sin registro fotográfico»». Lo corrí
aislado y pasó 1/1. No es del carrito: el caso 121 no toca `agromarket_cart`.
Lo que sí veo es la forma del falso rojo que ya arreglamos en el 139: lee
`getComputedStyle(...).backgroundImage` en un instante fijo, apenas el elemento
se hace visible, y sin reintento. Eso es diagnóstico, no medición: no lo abrí
porque pediste una sola tarea activa. Si querés, es corto.

El caso 142 pasó en las dos corridas completas y también aislado.

### 6. Hashes

```
src/contexts/CartContext.tsx  b99d7a37402d83af
scripts/smoke.mjs             344f66bd0dd3036c
```

(SHA-256 truncado a 16, del árbol en el commit de producto.)

### 7. Riesgos residuales

1. **La escritura sigue sin protección.** Leer quedó envuelto; guardar no. Con
   `localStorage` lleno o bloqueado, `setItem` tira dentro de un efecto y la
   aplicación vuelve a caer por la misma puerta. No lo toqué porque no pude
   escribir una prueba que lo provoque sin trucar el navegador, y prefiero no
   dejar código de producto que ninguna prueba ejercite. Es corto si lo abrís.
2. **Un carrito viejo con un ítem de precio 0 pierde ese ítem.** Es
   deliberado: ese ítem generaría una orden de $0, que es lo que
   `tienePrecioPublicado` vino a cerrar. Lo aviso porque es un cambio de
   comportamiento para copias guardadas antes de esa regla.
3. **La recuperación es por ítem, no todo o nada.** Un arreglo con dos ítems
   buenos y uno roto conserva los dos buenos. Preferí no vaciarle el carrito a
   alguien por una entrada dañada; si lo querés todo o nada, es un `if`.
4. **En desarrollo el carrito ahora sobrevive a la recarga.** Antes se perdía,
   así que cualquier prueba manual que contara con arrancar vacío después de
   recargar va a ver otra cosa. La suite corre limpia igual.

### 8. Frenos

No toqué Backend: ninguna prueba mostró que faltara contrato. No abrí
`SERVICE-STATE-1`, `TRANSFER-REVIEW-1`, `FORM-DIRTY-1`, navegación,
administración, Mercado Pago ni BOEDA. No limpié tokens ni preferencias: sólo
la clave dañada. No desplegué. `PRE_FIRMA.md` sigue fuera del versionado y lo
confirmé antes de empujar.

Freno acá y te pido revisión.
