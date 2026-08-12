# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-12.

## 1. Resultado

**Corregido.** El commit es **`93ea92c`**, sobre `147f1d1`; este informe va
aparte y encima. La suite pasa de 46 a **48 casos**; el barrido sigue en 52
pantallas porque no toqué interfaz.

Los tres puntos que pediste están hechos y probados. Además hay **dos cosas
que encontré en el camino**: una la arreglé porque era una fixture rota mía, y
la otra **no la toqué y te la traigo con la reproducción**, porque arreglarla
es cambiar autenticación general.

## 2. El límite de sesión

Todo pasa a ser **por identidad**, en el mismo lugar donde ya vive la cola:

1. **La deduplicación incluye la cuenta.** Al cambiar de sesión se estrena cola
   y el retrato queda en blanco. Un login nuevo no puede heredar el «esto ya
   está sincronizado» de otro.
2. **Cada turno comprueba, al arrancar, que la sesión sigue siendo la que lo
   encoló.** Si cambió, no sale. Es la única defensa posible: `apiFetch` firma
   con las credenciales del momento, así que un turno viejo que arrancara
   ahora saldría autenticado como la cuenta nueva.
3. **La cola anterior no se espera.** La cuenta que entra no queda colgada
   detrás de una escritura que no es suya.

## 3. Las regresiones

**Caso 47** — la cuenta nueva no hereda el «ya está»:

```text
[PASS] 47 Un login nuevo no hereda el "ya sincronizado" del anterior —
  mismo carrito en dos sesiones: 2 escrituras, una por cuenta; el listado de
  la segunda sale de su propio carrito, no del heredado
```

**Caso 48** — turno encolado, cambio de cuenta, y la nueva sin esperar:

```text
[PASS] 48 Un turno encolado no sale con las credenciales de la sesión nueva —
  con una escritura retenida y otra encolada, el cambio de cuenta descarta la
  encolada, la nueva no espera detrás de la ajena y cada carrito queda con lo
  suyo
```

**Rojo forzado**, con el `CartContext` anterior y nada más cambiado:

```text
[FAIL] 47 — la segunda cuenta no volvió a sincronizar: heredó el "ya está" de
  la anterior y quedó en 1 escritura(s) en total
[FAIL] 48 — la cuenta nueva quedó esperando detrás de la escritura de la
  sesión anterior
```

Ninguno de los dos recarga la página: recargar rearmaría cola y sesión por su
cuenta y la prueba dejaría de medir lo que dice medir. El cambio de cuenta se
hace por «Salir» y el formulario de ingreso, como lo haría una persona.

Un detalle de método del caso 48, porque cambia lo que la prueba afirma: la
primera escritura **sale de verdad** —se retiene su respuesta, no su envío—.
Retener el envío la convertiría en otra cosa: una petición que todavía no
viajó, que es justamente el caso del turno encolado. Son dos situaciones
distintas y el caso cubre las dos.

## 4. Lo que arreglé sin que lo pidieras (y por qué)

El **caso 43** elegía su publicación de prueba con `ORDER BY p.seller_id,
p.id` sin excluir servicios. El id es un UUID: el orden cambia con cada seed y
a veces le tocaba una publicación de servicio, cuya tarjeta ofrece
«Consultar» y no «Agregar». Ahí el tramo de interfaz se caía por la fixture, no
por el producto.

Lo vi porque me pasó: en una corrida completa el 43 quedó rojo con
`waiting for getByRole('button', { name: /Agregar/ })`. Agregué el filtro de
servicios a esa consulta —una línea— y no toqué nada más del caso. Te lo
marco porque el 43 es tuyo y porque **era intermitente**: si alguna vez lo
viste verde y otra rojo sin cambiar nada, era esto.

## 5. Lo que NO arreglé, y creo que hay que mirar

Buscando el punto 2 me encontré con algo que **no es de la cola**: el servidor
prefiere la cookie por encima del header.

`get_token_from_cookie_or_header` lee primero `request.cookies["access_token"]`
y sólo si no hay cookie mira el `Authorization`. El login setea las dos cosas:
cookie `HttpOnly` y token en `localStorage`. Reproducción en dos líneas:

```text
GET /api/auth/me  con  Authorization: Bearer <token de cliente>
                       Cookie: access_token=<token de vendedor>
→ el servidor responde como vendedor@ejemplo.com

GET /api/auth/me  con  Authorization: Bearer <token de cliente>
→ el servidor responde como cliente@ejemplo.com
```

Por qué me importa acá: el navegador adjunta la cookie **cuando despacha**, no
cuando el código arma la petición. Si una petición queda esperando para salir
—hay un tope de conexiones por origen— y en el medio la persona cambia de
cuenta, esa petición viaja con el header de una y la cookie de la otra, y el
servidor la ejecuta como la segunda. Lo vi de verdad: mi primera versión del
caso 48 retenía el **envío**, y la escritura de la cuenta vieja terminó escrita
en el carrito de la nueva.

Mi corrección cierra la parte que es mía —el turno que todavía no arrancó no
sale—, pero **no puede cubrir esto**: cuando la petición ya viajó, quién es el
autor lo decide el servidor.

**No lo toqué.** Dijiste explícitamente que no cambie autenticación general, y
esto es exactamente eso: el orden de precedencia lo usan todos los endpoints
protegidos. Lo dejo planteado con la reproducción para que decidas si entra
como pieza propia. Mi opinión, en una línea: si el frontend siempre manda el
header, la cookie debería ser el respaldo y no al revés.

## 6. Estado final

| Comprobación | Resultado |
|---|---|
| Suite completa, base recreada desde cero | **48/48** |
| Casos 47 y 48 con el `CartContext` anterior | rojos, nombrando cada causa |
| `npm run a11y -- --todas` | **52/52**, 0 violaciones de cualquier impacto |
| `npm run build` (incluye `tsc`) | verde |
| `eslint` sobre los archivos tocados | 0 errores, 0 avisos nuevos |
| `git -c core.whitespace=cr-at-eol diff --cached --check` | sin avisos |

Conservé los casos 43, 45 y 46 —del 43 sólo la fixture, ver punto 4—. No
agregué dependencias, no cambié autenticación, no toqué interfaz y no abrí
alcance. El aviso de lint que queda en `CartContext` es el de siempre, por el
`useCart` que ese archivo ya exportaba.

## 7. Riesgos y deudas

**Uno nuevo, chico.** El carrito ahora depende de la sesión: `CartProvider`
tiene que seguir estando adentro de `AuthProvider`. Hoy lo está, en
`main.tsx`. Si alguien invierte ese orden, el proveedor del carrito revienta al
montar en vez de fallar callado, así que al menos se nota enseguida.

**Lo del punto 5**, que no es mío y no me lo llevo por delante.

**Sigue abierto el `float` del checkout**, obligatorio antes de Fase 4.

Nota de reproducibilidad, la de siempre: Docker no está disponible en mi
entorno —demonio caído y registry 403—, así que la suite corre nativa con un
puente que traduce sólo las dos invocaciones que la suite hace por
`docker exec`. `./scripts/init_local_db.sh` sigue siendo el camino con
contenedores y no lo cambié.

El entorno local quedó levantado: API en `:8000`, Vite en `:5173`, base
recreada y con seed.
