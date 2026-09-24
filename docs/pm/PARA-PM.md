# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## ADMIN-PANEL-DEFECTS-1 — entregada, con una consulta

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `ad5f07d` |
| candidato | `8f2c543`, más `1ff7b87` (arreglo del caso 116 del smoke) |
| migración o datos | ninguno |
| no integrado, no desplegado | `main` sigue en `0bd7fbc` |

**Resultado.** Los cinco defectos están corregidos con tus decisiones.

- **P1.** Quien vende no puede modificar una publicación eliminada por ningún
  camino suyo: responde 409 y la fila no cambia. El caso 190 da 1/1, y su
  negativo, con el endpoint de la base, da rojo y nombra los caminos abiertos.
- **Guía.** Da 26/26 en escritorio y en celular, sin advertencias. Cada
  defecto tiene un negativo que vuelve su archivo a la base y la hace fallar
  en su paso.
- **Sin regresiones de producto:**
  - suite completa sobre base recreada, 188/190: sólo el 131, que es del
    entorno, y el 74, que causó una sonda mía (sin ella, 1/1);
  - a11y 76/76, contraste 84/84 y auditoría móvil 12/12.

  La suite encontró un caso propio, el 116, que ya corregí (abajo).

**Frené y te consulto (bloquea cerrar el P1 del todo; lo demás no).**
Encontré otra vía, fuera del panel, que deshace la moderación: **quien tenía
la publicación en el carrito la puede comprar después de que el
administrador la elimina.**

- El checkout no mira el estado de la publicación. El carrito sí lo mira, al
  agregar y al sincronizar (`cart.py:157` y `:421`), pero después no vuelve a
  mirarlo. El checkout (`services/checkout.py`, `preparar`) sólo mira el
  stock.
- Lo reproduje en local: agregar al carrito, el administrador cambia el
  estado, `POST /orders/checkout/transfer` responde 200 y crea la orden.
  Pasa igual con eliminada, pausada y agotada.
- Así se vende una publicación moderada y se le reservan unidades.

Opciones:

1. **(Recomendada)** El checkout rechaza cualquier publicación que no esté
   activa, antes de crear la primera orden, con un mensaje que la nombra.
   Quien compra la saca del carrito y sigue. Cubre los tres estados, porque
   el Mercado tampoco muestra ninguno de los tres.
2. Rechazar sólo las eliminadas. Una pausada o agotada se seguiría pudiendo
   comprar desde un carrito viejo.

No lo toqué: tu tarea dice frenar ante otra vía. Es un cambio chico, con su
caso y su negativo, y lo puedo sumar a esta pieza o hacer aparte.

## El inventario del P1 y cómo quedó cada camino

Busqué en todo `backend/app` las rutas que escriben, los lugares que cambian
`status` o `stock` de una publicación y las tareas.

| camino | quién | antes, sobre una eliminada | ahora |
|---|---|---|---|
| `PATCH /products/{id}` con `status` | quien vende | la volvía a activar o pausar | **409**, la fila no cambia |
| `PATCH /products/{id}` con datos | quien vende | editaba nombre, precio, stock y demás | **409**, la fila no cambia |
| `DELETE /products/{id}` | quien vende | 200 | **409** |
| `POST /products/{id}/images` | quien vende | subía la foto | **409**, no sube nada |
| `DELETE /products/{id}/images/{imagen}` | quien vende | borraba la foto | **409**, no borra nada |
| `POST /cart/items` y `/cart/sync` | cualquiera | ya exigían activa | igual; el caso lo prueba con quien vende |
| checkout, con la publicación ya en el carrito | quien compra | la vendía | **abierto: es la consulta de arriba** |
| órdenes que ya existían: aceptar la transferencia, pago acreditado, cancelar o rechazar | quien vende, quien compra, el aviso de pago | mueven `stock`, `stock_reservado` y ventas | sin cambio (abajo) |
| `/admin/products/{id}/status`, `DELETE /admin/products/{id}` | administrador | todo | igual: sólo el administrador la saca de «Eliminada» |
| calificaciones, notificaciones | — | no escriben publicaciones | — |
| tareas programadas | — | no hay: `main.py` sólo registra el arranque, y los vencimientos de pago se resuelven al consultarlos | — |

**Cómo se cerró.** Hay una sola regla, `exigir_que_se_pueda_modificar`
(`backend/app/api/products.py:39`), en las cuatro rutas:

- el administrador puede todo;
- quien no es dueño recibe 403, como antes;
- quien es dueño, sobre una eliminada, recibe 409 «La publicación fue
  eliminada y ya no se puede modificar.».

Vale también para la que eliminó quien vende: tu decisión dice que para quien
vende es definitiva.

**Lo que no cerré, y por qué:** las órdenes que ya existían. Cambian
contadores de stock, no el estado ni lo que se edita, y la publicación sigue
fuera del Mercado. Bloquearlas dejaría varada una orden ya pagada por
transferencia. Si querés que eliminar también congele las órdenes en curso,
es otra decisión.

**Pausadas y agotadas:** quien vende las sigue pausando y activando como
antes. El caso 190 lo comprueba, incluida una agotada por el administrador.

## Los defectos 2 a 5

- **2. «Agotada».** El aviso del panel dice «Deja de aparecer en el catálogo
  y su enlace no abre, igual que una pausada. No se borra y se puede volver a
  activar.». El de «Eliminada» ahora agrega «Quien vende ya no la ve ni la
  puede volver a activar.».
- **3. Lo que ve quien vende.** Una agotada por el administrador se ve
  «Agotado». Si le quedan unidades, tiene «Activar», que es lo que antes
  lograba pausando y activando. Sin unidades no tiene botón, como antes.
- **4. El detalle de la orden.** `GET /api/admin/orders` agrega los
  artículos, con el precio al que se compraron, y además correo, dirección,
  subtotal y envío.

  Al aparecer la tabla de artículos apareció otro problema: en el celular se
  salía 55 px de su sección a 360 px, y 28 px a 390. El detalle se
  desplazaba de costado. Lo corregí sólo para 768 px o menos: menos relleno,
  columnas fijas, y ninguna palabra partida a 360 ni a 390.
- **5. La cuenta propia.** El panel muestra el motivo que manda el servidor:
  «No puedes desactivar tu propia cuenta».

**Guía y script.**

- La guía saca las cuatro advertencias.
- Ata las frases nuevas a su comprobación, por ejemplo:
  - la agotada se ve «Agotado» y se activa;
  - para quien vende, la eliminada es definitiva (409 y fuera del Mercado);
  - el detalle trae correo, dirección y montos iguales a los de la base;
  - el precio del artículo es el de la compra, aunque la publicación cambie
    de precio después;
  - en el celular el detalle no se desplaza de costado.
- Rehíce sólo `ordenes-escritorio.png` y `ordenes-celular.png`.

**Dos arreglos del script:**

- **El outbox.** Ya no hace falta que `backend/outbox` exista de antes. El
  script mira el transporte: el del entorno, o el de `backend/.env` (sólo esa
  línea), o el de omisión. Si es `outbox` y la carpeta no existe, nadie
  recibió correo. Si es otro, falla y lo dice.
- **Una comprobación que podía pasar sin mirar.** El formulario de publicar
  arranca con unidades propias y después dibuja las del servidor. El script
  leía las primeras, así que «inactiva, no se ofrece» (paso 24) podía pasar
  sin mirar la lista real. En una corrida hizo fallar el paso 25. Ahora
  espera la respuesta del servidor y que el selector la muestre.

## Para verificar, lo mínimo

```
./scripts/entorno_nativo.sh --reiniciar-api       si la API ya corría con el código anterior
SMOKE_CASOS=190 node scripts/smoke.mjs
  → [PASS] 190 Una publicación eliminada no vuelve por la mano de quien vende — 7 caminos …
python3 scripts/sabotajes_admin_panel_defects_1.py p1-endpoint-de-la-base panel-de-la-base
  → [ROJO ESPERADO] … PATCH {"status":"active"} respondió 200 y cambió la fila; …
    [ROJO ESPERADO] … Paso 8 … Paso 12 … Paso 13 …
    src y backend despues: como estaban
node scripts/guia-admin.mjs
  → LA GUÍA Y EL PANEL COINCIDEN: 26 pasos en escritorio y celular
```

**Antes de correrlos:**

- Hace falta lo mismo de siempre: la API en 8000, el frontend de desarrollo
  en 5173 y la siembra demo. `backend/outbox` ya no tiene que existir.
- Los negativos del backend reinician la API antes y después.
- Tiempos:
  - el caso 190, unos 3 s;
  - el negativo del P1, alrededor de 1 min;
  - los demás negativos y la guía, entre 2 y 5 min cada uno.

## Salidas

```
SMOKE_CASOS=190 node scripts/smoke.mjs
  [PASS] 190 Una publicación eliminada no vuelve por la mano de quien vende — 7 caminos de
  quien vende rechazados sin tocar la fila. el administrador la vuelve a «Activa» y quien vende
  la pausa y la activa. una agotada la sigue activando quien vende. la que elimina quien vende
  tampoco vuelve (409)

python3 scripts/sabotajes_admin_panel_defects_1.py        salida 0, los cinco en rojo esperado
  p1-endpoint-de-la-base   [FAIL] 190 … quien vende todavía modifica una publicación eliminada:
                           PATCH {"status":"active"} respondió 200 y cambió la fila; PATCH
                           {"status":"paused"} respondió 200 y cambió la fila; PATCH de datos …
                           respondió 200 y cambió la fila; DELETE /products/{id} respondió 200;
                           POST /products/{id}/images respondió 200 y cambió la fila; …
  detalle-de-la-base       [FALLA] Paso 14 …: la guía dice “el nombre, el correo y la dirección de
                           entrega de quien compra” y no pasa: el detalle no dice el correo de quien compra
  panel-de-la-base         [FALLA] Paso 8 …: … “el panel responde «No puedes desactivar tu propia
                           cuenta»” y no pasa: el panel no dice el motivo
                           [FALLA] Paso 12 …: la guía nombra «Deja de aparecer en el catálogo y su
                           enlace no abre, …» y el panel no lo mostró en este paso
                           [FALLA] Paso 13 …: la guía nombra «… Quien vende ya no la ve ni la puede
                           volver a activar.» y el panel no lo mostró en este paso
  mis-publicaciones-de-la-base  [FALLA] Paso 12 …: la guía dice “Quien vende la ve en «Mis
                           publicaciones» como «Agotado».” y no pasa: quien vende no la ve «Agotado»: Activo
  tabla-de-la-base (celular)  [FALLA] Paso 14 …: la guía dice “En el celular el detalle se lee de
                           arriba abajo, sin desplazarse de costado.” y no pasa: con 390 px el detalle
                           mide 375 px de ancho y se ven 371
  src y backend despues: como estaban

node scripts/guia-admin.mjs                                  salida 0, 26/26 y 26/26
python3 scripts/sabotajes_admin_guide_1.py                   los siete de ADMIN-GUIDE-1 siguen en rojo esperado
npm run a11y -- --todas     76 de 76 pantallas, 0 violaciones serious o critical
npm run contraste           84 de 84 mediciones, ningún texto por debajo del mínimo
node scripts/mobile-audit.mjs   12 de 12 recorridos, 0 desbordes, 0 recortes, 0 errores de consola
tsc --noEmit · lint · build · compileall · node --check · py_compile · diff-check con cr-at-eol   verdes
```

## Regresión: la suite completa, y por qué

Corrí la suite entera y no una lista. El cambio toca `PATCH` y `DELETE` de
publicaciones, y muchos casos los usan para limpiar lo que crean. Fueron tres
corridas, cada una sobre una base recreada con `entorno_nativo.sh
--recrear`.

| corrida | código | resultado | fallas |
|---|---|---|---|
| 1 | `8f2c543` | 187/190 | 116, 131, 187 |
| 2 | con el 116 corregido y una sonda en la base | 186/190 | 55, 58 y 74 (la sonda), 131 |
| 3 | `1ff7b87`, con la sonda en un esquema aparte | **188/190** | 74 (la sonda), 131 |

- **116, mío, corregido en `1ff7b87`.** El caso elegía una publicación del
  vendedor demo para subirle una foto, y le tocó una eliminada por un caso
  anterior: ahora da 409, por la regla nueva. Ahora elige entre las que no
  están eliminadas. Pasa en las corridas 2 y 3.
- **131: entorno.** El puente de docker de mi entorno no traduce `docker
  run`. Es el mismo rojo de siempre.
- **74, 55 y 58: mi sonda.** Usé disparadores en la base para investigar el
  187. El 74 baja migraciones y el disparador sobre `brand` se lo impide.
  Borrada la sonda, el 74 dio 1/1. En la corrida 2 las tablas de la sonda
  estaban en el esquema de la aplicación, y por eso `alembic check` también
  hizo caer el 55 y el 58.
- **187: no se repitió.** En la corrida 1, las dos publicaciones de la
  siembra con marca (John Deere y Pauny) la perdieron en el medio de la
  suite. El Mercado se quedó sin marcas y el caso no encontró sus once
  controles.

  En las corridas 2 y 3 puse una sonda que registra toda publicación que
  pierde la marca. Sólo registró la esperada del caso 174, que cambia de
  categoría una publicación propia, y el 187 pasó las dos veces.

  No encontré qué la borró en la corrida 1. La edición del backend conserva
  la marca salvo que cambie la categoría, y mi cambio no toca ni la marca ni
  las publicaciones activas. Lo dejo anotado como riesgo, no como causa
  conocida.

## Riesgos

- **Una carrera chica.** El `PATCH` bloquea la fila, así que un cambio del
  administrador espera o se ve. Las rutas de fotos y el `DELETE` no la
  bloquean, igual que antes: si el administrador elimina en el mismo instante
  en que quien vende sube una foto, la foto puede quedar. La publicación
  igual queda eliminada.
- **El checkout sigue abierto** hasta que decidas la consulta.
- **El 187 pasó dos de tres veces.** Sin causa encontrada; la sonda de
  arriba sirve para buscarla si se repite.
- La reproducción del checkout la hice sólo en mi base local, que después
  recreé.

No toqué `main`, Railway ni datos reales, y no desplegué.
