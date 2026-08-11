# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-11.

## 1. Resultado

**Corregido.** El commit es **`fe73073`**, sobre `fd08502`; este informe va
aparte y encima. La suite sigue en **46 casos** —el 45 se reescribió, no se
agregó uno nuevo— y el barrido sigue en 52 pantallas: no toqué interfaz.

Tenías razón en las dos cosas. El caso 45 anterior medía la deduplicación del
mismo retrato, no la serialización de dos retratos distintos; y el recorrido
del desmontaje era una carrera real que la cola de la instancia no podía
cubrir.

## 2. Dónde vive ahora la coordinación

**En `CartContext`.** Es el dueño mínimo que cumple las dos condiciones que
pediste: sobrevive al desmontaje del modal y es el único lugar por el que pasa
cualquier sincronización de este carrito.

Se movieron tal cual, sin segunda solución ni dependencia nueva: la cola
encadenada, el retrato de lo **encolado** y la instantánea tomada al encolar.
El checkout dejó de tener cola propia: sus tres puntos de sincronización
—búsqueda de fletes, opciones de transferencia y creación de la orden— llaman a
la misma función del contexto.

Un detalle que no estaba en tu descripción y que hacía falta para no ensuciar
nada: la función se expone **estable**. Lee la lista de una referencia que se
mantiene al día en vez de del cierre, así no cambia de identidad en cada render
y el efecto de fletes puede declararla como dependencia sin volver a
ejecutarse de más. Sin eso, el efecto quedaba con una dependencia faltante
—`react-hooks/exhaustive-deps`— y yo estaría agregando ruido nuevo al lint.

## 3. La regresión

El caso 45 se reescribió sobre tus cinco pasos, sin recargar la página en
ningún momento —recargar rearmaría cualquier cola por sí solo y la prueba
dejaría de medir lo que dice medir— y con los tiempos decididos por la prueba,
no por la red:

1. producto A agregado **sólo desde el catálogo**, carrito, checkout, destino:
   sale su `/cart/sync` y queda retenida;
2. con esa escritura en vuelo se cierra el checkout, se elimina A desde el
   carrito, se agrega B desde el catálogo y se reabre el checkout;
3. destino de nuevo, espera, y **recién ahí** se libera la escritura de A;
4. se comprueba que el carrito del servidor, el listado de fletes y los datos
   bancarios del paso de pago hablen sólo de B.

```text
[PASS] 45 La escritura de un carrito abandonado no puede quedar última —
  carrito cambiado de A a B con la escritura de A retenida y liberada última:
  el servidor, el listado y los datos bancarios hablan sólo de Juan Vendedor
  (2 escrituras, 2 respuestas)
```

**Rojo forzado**, con la cola de vuelta adentro del `CheckoutModal` y nada más
cambiado:

```text
[FAIL] 45 La escritura de un carrito abandonado no puede quedar última —
  la escritura del carrito abandonado quedó última: el servidor tiene
  ["0d4335cd-…"] y en pantalla está 0505d866-…
```

## 4. Una diferencia con tu paso 3, y por qué la prueba igual discrimina

Tu paso 3 dice «dejar terminar la sincronización B y recién después liberar A».
**Con la corrección puesta eso no puede pasar, y es justamente la corrección**:
B queda encolada detrás de A, así que no sale hasta que A termina.

Si la prueba exigiera literalmente que B termine primero, sería roja con el
arreglo y verde sin él. Así que lo que hace es lo equivalente observable: le da
a B todo el tiempo que necesitaría para terminar antes —tres segundos, con la
red local respondiendo en decenas de milisegundos—, libera A, espera a que
**las dos** escrituras contesten, y recién entonces mide.

Eso separa los dos mundos sin ambigüedad:

- con la cola por instancia, B sale sola y termina primero; A se libera después
  y queda última: el servidor termina con **A**;
- con la coordinación en el contexto, A termina primero y B después: el
  servidor termina con **B**.

La afirmación que la prueba sostiene no es «B terminó antes», es la que
importa: **la escritura del carrito abandonado no puede quedar como estado
final**.

## 5. Lo que no toqué

No agregué otra prueba para el caso 46 ni toqué su corrección. No reabrí
PostGIS, migraciones, declaración, persistencia de órdenes, Railway ni la
Pieza C. No reescribí el caso A/B. No amplié el módulo, no agregué dependencias
y no cambié una sola línea de interfaz: el inventario de accesibilidad sigue en
las mismas 52 pantallas y no repetí contraste porque no toqué colores.

## 6. Estado final

| Comprobación | Resultado |
|---|---|
| Suite completa, base recreada desde cero | **46/46** |
| Caso 45 con la cola dentro del `CheckoutModal` | rojo, nombrando la causa |
| `npm run a11y -- --todas` | **52/52**, 0 violaciones de cualquier impacto |
| `npm run build` (incluye `tsc`) | verde |
| `eslint` sobre los archivos tocados | 0 errores, 0 avisos nuevos |
| `git -c core.whitespace=cr-at-eol diff --cached --check` | sin avisos |

Sobre el lint: `npm run lint` sigue rojo a nivel proyecto, como venía. En los
archivos que toqué queda un solo aviso y es anterior a este cambio
—`react-refresh/only-export-components` por el `useCart` que `CartContext` ya
exportaba—. No agregué ninguno.

## 7. Riesgos y deudas

**Uno nuevo, chico.** La sincronización dejó de ser cosa del checkout y pasó a
ser una capacidad del carrito. Cualquier pantalla que mañana la use hereda la
cola —que es lo que queremos— pero también hereda la deduplicación por retrato:
si dos pantallas piden sincronizar el mismo carrito, la segunda no escribe y
espera a la primera. Es correcto hoy y hay que mirarlo el día que exista una
segunda pantalla que escriba el carrito.

**Sigue abierto el `float` del checkout**, obligatorio antes de Fase 4.

**Nota de reproducibilidad, la misma de siempre.** El demonio de Docker no está
disponible en mi entorno y el registry devuelve 403, así que la suite corre
nativa: PostgreSQL 16 con PostGIS 3.4 local, la API y Vite como procesos, y un
puente que traduce únicamente las dos invocaciones que la suite hace por
`docker exec` y rechaza cualquier otra. Las cifras de arriba salen de ahí. Si
querés reproducirlas con contenedores, `./scripts/init_local_db.sh` sigue
siendo el camino y no lo cambié.

El entorno local quedó levantado: API en `:8000`, Vite en `:5173`, base
recreada y con seed.
