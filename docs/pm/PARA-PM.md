# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-12.

## 1. Resultado

**Los dos defectos, corregidos.** El commit es **`a960eef`**, sobre `44ac030`;
este informe va aparte y encima. La suite pasa de 55 a **58 casos**. Los
inventarios visuales no se movieron —56 pantallas y 40 mediciones— porque no
agregué ninguna ruta: las tres regresiones caen dentro de rutas que ya existen,
como pediste.

Tenías razón en los dos, y los dos tenían la misma forma: un dato que se leía
tarde y ya no representaba lo que había pasado.

## 2. La selección tardía

`elegirTransportista` sólo miraba la generación de destino y carrito. Cambiar
ese pedido a «coordino por mi cuenta» **no mueve esa generación**, así que la
respuesta en vuelo llegaba y reinstalaba el transportista con su contacto
encima de una decisión ya tomada.

**Cada cambio de decisión de un pedido lleva ahora su propio número**, de una
secuencia que sólo sube y nunca se reinicia. Eso último importa: si el
contador se reiniciara al invalidar todo, un turno viejo podría volver a
coincidir con uno nuevo y la carrera reaparecería por otro lado.

Dos cosas que respeté de tu enunciado:

- **La respuesta tardía puede terminar en red.** No se cancela nada: se
  descarta al llegar. Cancelar del lado del cliente no evita que el servidor ya
  la haya procesado, y acá tampoco hace falta.
- **No se bloquea la pantalla.** Se invalida el pedido tocado y nada más; los
  otros grupos siguen su curso.

## 3. El origen mutable

`_operacion` leía `item.product.locality`, la localidad **de hoy** de la
publicación. El nombre y el precio del producto ya eran snapshot desde siempre;
el origen de la carga no, y era el único de los tres que el vendedor podía
mover después de la compra.

`order_items` guarda ahora el origen usado al confirmar: **el id del padrón y
también el texto**. El id conserva la relación; el texto deja la operación
legible aunque el padrón renombre la localidad. Los dos checkouts lo escriben y
la operación lo lee de ahí, nunca de la publicación.

Los ítems anteriores quedan sin snapshot, y eso significa «origen no
informado». **No los rellené con la localidad actual**: sería inventar un dato
del pasado con información del presente, que es exactamente el problema que el
snapshot cierra.

## 4. Las regresiones

**Caso 56** — la respuesta de `/logistics/select-carrier` se retiene, se cambia
la decisión a cuenta propia y recién después se libera:

```text
[PASS] 56 — selección retenida, decisión cambiada a cuenta propia y liberada
  después: no reaparece transportista ni contacto, y la orden queda por cuenta
  propia
```

No mira sólo la pantalla: comprueba también que el cuerpo del checkout lleve
exactamente `[{seller_id, mode: 'self'}]` y que la orden quede en `self` sin
transportista.

**Caso 57** — la publicación se muda después de la compra:

```text
[PASS] 57 — la publicación se mudó de Rosario a Córdoba después de la compra y
  la operación sigue diciendo la primera, en API y en pantalla
```

**Caso 58** — el ítem sin snapshot, con un origen «de hoy» disponible para que
la trampa exista:

```text
[PASS] 58 — ítem sin origen guardado: la operación se lee, no muestra origen y
  no adopta el de la publicación; downgrade, upgrade y `alembic check` limpios
```

**Rojos forzados**, con el producto de `ecfaa4c` y nada más cambiado:

```text
[FAIL] 56 — la respuesta tardía reinstaló el transportista
[FAIL] 57 — la operación perdió el origen de la compra: ["Córdoba, Córdoba"]
[FAIL] 58 — sin snapshot se inventó un origen: [{"name":"Córdoba", …}]
```

## 5. Estado final

| Comprobación | Resultado |
|---|---|
| Suite completa, base recreada desde cero | **58/58** |
| Casos 56, 57 y 58 con el producto anterior | rojos, nombrando cada causa |
| `npm run a11y -- --todas` | **56/56**, 0 violaciones |
| `npm run contraste` | **40/40**, 0 incumplimientos |
| `npm run build` (incluye `tsc`) | verde |
| `downgrade -1` + `upgrade head` + `check` | verde, con datos adentro |
| `eslint` sobre los archivos tocados | 0 errores, 0 avisos nuevos |
| `git -c core.whitespace=cr-at-eol diff --cached --check` | sin avisos |

Corrí las dos puertas visuales aunque no cambié una línea de marcado ni un
color: el arreglo de la carrera es puro comportamiento y el del origen cambia
de dónde sale un texto. Las corrí igual porque me pareció más barato correrlas
que argumentar por qué no.

No toqué la arquitectura, la revalidación compartida, la atomicidad ni los
límites de las tres vistas. No agregué restricciones, snapshots de contacto,
estados logísticos ni dependencias. Conservé los casos 51 a 55 sin cambios.

## 6. Riesgo

**Uno, chico y nuevo.** El snapshot de origen se escribe al confirmar; si una
publicación no tiene localidad oficial en ese momento, el ítem nace sin origen
y la operación dirá «origen no informado» para siempre, aunque el vendedor
cargue la localidad al día siguiente. Es correcto —al momento de la compra no
había origen oficial y no se puede inventar hacia atrás— pero conviene saberlo:
lo arregla el vendedor completando su publicación **antes** de vender, no
después.

Siguen abiertos, de antes: el **`float` del checkout** —obligatorio antes de
Fase 4— y la dependencia de las dos pantallas nuevas de las puertas visuales
respecto de una publicación del seed, comentada en los dos scripts.

Nota de reproducibilidad, la de siempre: Docker no está disponible en mi entorno
—demonio caído y registry 403—, así que todo corre nativo con un puente que
traduce sólo lo que la suite pide por `docker exec`: `psql`, `python` y
`alembic`. `./scripts/init_local_db.sh` sigue siendo el camino con contenedores
y no lo cambié.

El entorno local quedó levantado: API en `:8000`, Vite en `:5173`, base recreada
y con seed.
