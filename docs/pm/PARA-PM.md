# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## NAV-URL-1 — una sola política de navegación, y la barra dice qué se mira

Hecho. Producto/regresión e informe en commits separados. **No desplegué.**

- Producto/regresión: `bcdd448` — «NAV-URL-1: una sola politica de navegacion,
  y la barra dice que se mira»
- La suite pasa a **147 casos**.

---

### 1. El rojo primero: los cinco bordes contra `49445fc`

Antes de tocar nada medí el estado con una sonda de cinco bloques
independientes —cada uno con su propio `try/catch`, porque el caso 147 se
detiene en el primer rojo y vos pediste los cinco—. Son las mismas
comprobaciones que después quedaron en el caso. Contra el producto de
`49445fc`:

```
[ROJO] 1. las cinco secciones y el historial
       recorrido a services: la pantalla es services y la barra dice «/» en vez
       de «/?section=services»
[ROJO] 2. las cinco URL canonicas, abiertas y recargadas
       enlace directo a /?section=services: se esperaba services y hay «Equipos,
       insumos y servicios para seguir produciendo.» con la barra en
       «/?section=services»
[ROJO] 3. los filtros del Mercado vuelven con su entrada
       salir del Mercado filtrado: la pantalla es services y la barra dice
       «/?q=trigo&type=productos» en vez de «/?section=services»
[ROJO] 4. las pantallas de llegada no reviven
       salir de /payment/success por la cabecera: la pantalla es home y la barra
       dice «/payment/success» en vez de «/»
[ROJO] 5. el detalle es una capa y no una ubicacion
       home despues de cerrar con Atras: la barra dice «/?section=contact» en
       vez de «/»
```

El borde 1 se entiende mejor con el recorrido crudo, medido antes de corregir:

```
click «Mercado»          url=/?section=marketplace   pantalla=marketplace
click «Servicios»        url=/                       pantalla=services
click «Quiénes somos»    url=/                       pantalla=about
click «Contacto»         url=/                       pantalla=contact
goBack 1                 url=about:blank             (fuera del sitio)
goBack 2                 url=about:blank
```

Cuatro clics y **una sola entrada**: como todo se escribía con `replaceState`,
el primer Atrás no volvía a la sección anterior, se iba del sitio.

Y el 5, en palabras: el detalle no tenía entrada propia, así que el primer Atrás
no lo cerraba —se iba a la entrada anterior, que en la sonda es
`/?section=contact`— y se llevaba puestos sección, filtros y listado. Que el
detalle «se cerrara» era un efecto de que la página entera se desmontaba.

### 2. La política, en tres reglas

Dos archivos nuevos y ningún router:

```
src/navegacion/politica.ts     funciones puras: qué dice la barra y cómo se escribe
src/navegacion/navegacion.ts   el ÚNICO que escribe historial y el ÚNICO `popstate`
```

1. **Ir a otra ubicación es una entrada de verdad** (`pushState`). Elegir la que
   ya está no agrega nada.
2. **Salir de una pantalla de llegada reemplaza su entrada.** `/payment/*` y
   `/verificar-correo` son resultados de un trámite: se llega, se leen y se
   sale. Como la URL canónica siempre cuelga de `/`, el `pathname` se normaliza
   solo, sin que ninguna pantalla tenga que acordarse.
3. **Una capa visible no es una ubicación.** El detalle abre una entrada más
   sobre la misma URL, marcada en el estado de la entrada. Por eso el primer
   Atrás lo cierra sin llevarse nada, y cerrarlo con la interfaz **consume** esa
   entrada —`history.back()`— en vez de dejarla colgada.

La gramática de la barra: `/` para Inicio y
`?section=marketplace|services|about|contact` para las otras cuatro. Los filtros
viajan **sólo** con el Mercado y en orden fijo, así la misma búsqueda da siempre
la misma URL.

Lo que cambió alrededor:

- `useProductFilters` **relee la barra** cuando la mueve el historial —antes la
  leía una sola vez, al montar— y **escribe sólo desde el Mercado**: `q=trigo`
  ya no se cuela en la URL de Contacto.
- `ProductCard` dejó de guardar su propio `showDetail`: pide abrir y cerrar la
  capa. No escucha nada; el oyente sigue siendo uno solo.
- `VerifyEmailPage` dejó de escribir el historial al salir: eran dos escrituras
  para el mismo paso. Su otra escritura —sacar el token de la barra apenas se
  lee— se queda, porque eso no es navegación: es no dejar un secreto a la vista.

### 3. Tres decisiones que tomé yo, para que las revises

1. **El detalle no va en la URL.** Pediste representación estable para las cinco
   secciones; el detalle es una capa sobre una de ellas. Ponerle
   `?publicacion=<id>` prometería un enlace profundo que hoy no se puede
   cumplir: Inicio y Servicios sólo tienen cargadas las publicaciones de su
   vista previa, así que buena parte de esos enlaces abriría la sección sin el
   detalle. Si querés enlaces al detalle es otra tarea, y necesita traer la
   publicación por id.
2. **Salir de una pantalla de llegada la saca del historial.** Pediste que
   recargar no la reviva; elegí además que Atrás tampoco vuelva a ella, porque
   es un resultado ya leído y volver a anunciarlo confunde. Si lo querés al
   revés, es una línea.
3. **Los filtros siguen escribiéndose con `replaceState`.** Una entrada por
   tecla haría inusable el Atrás. La entrada del Mercado guarda los filtros que
   había al irse, que es exactamente lo que hay que restaurar al volver.

### 4. El verde

La misma sonda, con la corrección puesta:

```
[VERDE] 1. las cinco secciones y el historial
[VERDE] 2. las cinco URL canonicas, abiertas y recargadas
[VERDE] 3. los filtros del Mercado vuelven con su entrada
[VERDE] 4. las pantallas de llegada no reviven
[VERDE] 5. el detalle es una capa y no una ubicacion
```

Y el caso 147, que es lo que queda versionado. Contrasta **al mismo tiempo** las
tres cosas que pueden discrepar —lo dibujado, la celda que marca la cabecera y
la barra—, porque mirar una sola dejaba pasar justo lo que fallaba: con el
producto viejo, la pantalla decía Servicios y la barra decía `/`.

```
[PASS] 147 — las cinco secciones publicas se dicen en la barra —«/» y
  «?section=…»—, el recorrido por la cabecera deja cuatro entradas de verdad que
  Atras y Adelante recorren con la pantalla y la celda marcada, elegir la
  seccion activa no agrega ninguna, las cinco URL canonicas abren y recargan en
  su seccion, el Mercado filtrado vuelve con Atras a
  «/?section=marketplace&q=Nav147+publicacion+…&type=productos» con el buscador,
  el tipo y su unico resultado, las cuatro pantallas de llegada normalizan el
  pathname al salir y no reviven al recargar, y el detalle abierto desde Inicio,
  Servicios y el Mercado se cierra con el primer Atras sin perder seccion ni
  filtros, sin dejar entrada fantasma cuando se cierra con Escape
```

Dos detalles del caso que conviene que sepas: se publica un producto y un
servicio propios, así el detalle se abre sobre publicaciones conocidas en las
tres pantallas y el filtro del Mercado deja un único resultado que se puede
nombrar; y de las cuatro pantallas de llegada, dos se abandonan por la cabecera
y dos por el CTA, que son los dos caminos que pediste.

```
 scripts/smoke.mjs                          | 272 +++++++++++++++++++++++++
 src/App.tsx                                | 169 ++++++++----------
 src/components/Pages/VerifyEmailPage.tsx   |  13 +-
 src/components/ProductCard/ProductCard.tsx |  24 ++-
 src/hooks/useProductFilters.ts             |  54 +++++-
 src/navegacion/navegacion.ts               | 136 +++++++++++++
 src/navegacion/politica.ts                 | 116 ++++++++++++
```

### 5. Puertas

```
base limpia + SMOKE_CASOS=147                   1/1
base limpia + suite completa                    146/147   (131 rojo)
npm run build                                   ok
npm run lint                                    ok (--max-warnings 0)
node --check scripts/smoke.mjs                  ok
python -m compileall backend/app                ok
python -m pip check                             ok
git -c core.whitespace=cr-at-eol diff --check   limpio
npm run a11y -- --todas                         64/64 pantallas, 0 bloqueantes
npm run contraste                               52 mediciones, ninguna por debajo
npm run hito                                    6/6 pasos encadenados
```

Las tres últimas no las pediste; las corrí igual porque esto toca el armazón de
la aplicación y las tres pantallas que dibujan tarjetas.

El **131** volvió a fallar acá por lo de siempre: el puente de mi entorno sólo
traduce `docker exec` y esa receta necesita `docker run` sobre `alpine:3`. Es la
limitación de mi máquina y no lo toqué. En la tuya pasó, así que esto tiene que
dar **147/147**.

Una nota de método: la primera corrida completa la descarté a mitad de camino
porque toqué dos detalles de formato mientras corría —el servidor de desarrollo
recarga en caliente y la corrida habría medido un árbol mezclado—. La que
informo arrancó con el árbol final y base recreada.

### 6. Hashes

```
src/navegacion/politica.ts                  7b86a9226bbb9d28
src/navegacion/navegacion.ts                10ce3dab501ecacf
src/App.tsx                                 0ac7e73138d3b420
src/hooks/useProductFilters.ts              6b06cf21d146b84b
src/components/ProductCard/ProductCard.tsx  82604890eb858a98
src/components/Pages/VerifyEmailPage.tsx    5a0b93fbe93cdc16
scripts/smoke.mjs                           4b8854acb5c513a7
```

(SHA-256 truncado a 16, del árbol en `bcdd448`.)

### 7. Riesgos residuales

1. **Dos listas de nombres de filtro que tienen que coincidir.** La política
   declara cuáles son los parámetros del Mercado —para leerlos y para armar la
   URL canónica—; el hook de filtros los escribe con esos mismos nombres, uno
   por uno. Si alguien agrega un filtro en el hook y no en la lista, se va a
   escribir en la barra pero no va a viajar en la URL canónica. Lo dejo así
   porque unificarlo pide reescribir el hook entero con una tabla, y eso ya no
   es mínimo; si querés cerrarlo, va como tarea propia.
2. **Una URL escrita a mano con los parámetros en otro orden** se ordena sola en
   la primera navegación: no duplica entrada, pero la barra cambia sola.
3. **`?section=` con un valor que no existe** dibuja Inicio, en silencio. Es lo
   mismo que hacía antes con cualquier `pathname` desconocido.
4. **El carrito, el checkout, el alta y el panel de Administración siguen sin
   entrada propia**: se cierran con Escape o con su botón, y Atrás no los cierra.
   Esta tarea era la navegación entre secciones y el detalle.
5. **La capa restaurada al recargar** sólo se vuelve a abrir si esa publicación
   está entre las cargadas; si no, queda la sección sola, que es coherente con
   lo que dice la barra.
6. El caso 147 deja dos publicaciones efímeras en la base, como el 145 y el 146.

### 8. Frenos

No toqué Backend, modelos, migraciones, seed, autenticación, pagos, BOEDA,
Railway ni datos remotos. No cambié foco de modales, formularios, estilos, copy,
estados administrativos ni responsive. No desplegué. `PRE_FIRMA.md` sigue fuera
del versionado y lo confirmé antes de empujar.

Freno acá y te pido revisión.
