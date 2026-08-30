# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## UX-COH-1 — la publicación dice dónde está, y sin sesión el detalle ofrece entrar

Hecho. Producto e informe en commits separados. **No desplegué.**

- Producto: `f716264` — «UX-COH-1: la publicación dice dónde está, y sin sesión el detalle ofrece entrar»
- Regresiones nuevas: casos **137** y **138**. La suite queda en **138/138**.

Tu diagnóstico era correcto y lo confirmé antes de tocar nada. Agrego una
medición que no estaba: **no es un caso aislado**.

---

### 1. El rojo, contra `aff5a602`

**El caso exacto que trajiste**, verificado por SQL y por API:

```
la rastra en la base:   Balcarce | Buenos Aires | vendedor dice «Córdoba, Argentina»
lo que devolvía la API: seller.location = "Córdoba, Argentina"
                        claves de ubicación de la publicación: NINGUNA
```

**Y el alcance real**, que es lo que quiero que veas:

```
publicaciones activas                                          30
…que muestran una provincia que NO es la suya                  23
…sin locality_id (o sea, que degradarían)                       0
```

Veintitrés de treinta. La rastra no era la excepción: era la regla. Filtrando
Buenos Aires en el navegador, la segunda tarjeta decía «Córdoba, Argentina».

El segundo corte, medido mecánicamente sobre los cinco roles: sin sesión, el CTA
«Iniciar operación» no cambia la URL, no abre ningún diálogo, no cambia el texto
de la página. Sólo un toast. Y el toast dice «para agregar publicaciones al
carrito», que ni siquiera es lo que promete el botón.

Los dos casos nuevos, corridos contra `aff5a602`, fallan:

```
[FAIL] 137 … — «Asesoramiento…» sale sin ubicacion de publicacion:
              la tarjeta va a mostrar la del vendedor
[FAIL] 138 … — sin sesion el detalle no ofrece ingresar: los botones son
              ["","Iniciar operación","Ver perfil del vendedor"]
```

### 2. La ubicación: API antes y después

```
ANTES   { "seller": { "location": "Córdoba, Argentina" }, … }        ← y nada más

AHORA   { "publication_location": { "locality_id": "06063010",
                                    "locality": "Balcarce",
                                    "province": "Buenos Aires" },
          "seller": { "location": "Córdoba, Argentina" }, … }
```

El dato del vendedor **no se sacó**: sigue viajando, sigue siendo suyo y sigue
en su bloque. Lo que cambió es que ya no hace de ubicación de la operación.

**Contra el SQL, provincia por provincia.** El caso 137 compara conjuntos de
identificadores, no cantidades, así que no envejece con el catálogo:

```
Buenos Aires=9, Chaco=3, Córdoba=3, Entre Ríos=1, La Pampa=3,
Mendoza=3, Salta=2, Santa Fe=5, Tucumán=1
```

En cada una, los IDs de la API son exactamente los del SQL sobre
`products.locality_id` + `localities`, el `total` coincide, y **cada elemento
informa esa provincia como suya**.

**Sin N+1.** La localidad entra en la consulta que ya existía, con `outerjoin`
porque `locality_id` admite nulo. Medido contando consultas con dos tamaños de
página:

```
página de  4 → 2 consultas que tocan `localities`
página de 20 → 2 consultas que tocan `localities`
```

No crecen. Lo mide el propio caso 137, así que si alguien mete una consulta por
tarjeta, la puerta lo dice.

**Legacy.** Hoy no hay ninguna publicación activa sin localidad, pero la columna
lo admite: en ese caso la respuesta trae `publication_location: null`, no hay
500 y la tarjeta simplemente no dibuja la línea. No se inventa una provincia.

**Privacidad.** La ubicación lleva tres claves y sólo tres —`locality_id`,
`locality`, `province`—; el caso las compara contra esa lista exacta y verifica
que el detalle no exponga `latitude`, `longitude`, `coordinates`, `department`,
`phone`, `whatsapp` ni `email`.

**En pantalla**, localidad y después provincia:

```
antes:  Córdoba, Argentina          ← el perfil de quien publica
ahora:  Balcarce, Buenos Aires      ← la publicación
```

### 3. El ingreso desde el detalle

```
sin sesión, el botón dice     «Ingresar para continuar»
al pulsarlo                   se abre el Login real
diálogos simultáneos          1
cancelar                      vuelve a «Campo Agrícola de 120 Hectáreas»
completar                     vuelve a «Campo Agrícola de 120 Hectáreas», con sesión
el botón, ya con sesión       «Iniciar operación»
carrito, en los tres momentos 0 items
órdenes creadas               0
```

**Una decisión que quiero que revises.** Tu freno decía: frená si conservar el
detalle debajo del Login rompe el foco o exige anidar diálogos de forma
inaccesible. Es exactamente lo que pasaba: el detalle y el Login son los dos
`role="dialog" aria-modal="true"` y los dos usan la misma trampa de foco, así que
superpuestos el teclado queda entre ambas y `Escape` cierra cualquiera de los
dos.

No lo tapé con otro toast ni frené: **el detalle se aparta mientras el Login está
arriba y vuelve solo**. Hay un diálogo por vez —el caso lo afirma— y la
continuidad se cumple igual, porque volver a la misma publicación es lo que
pediste, se cancele o se complete. Si preferías verlo debajo, es un cambio de
otra naturaleza y te lo traigo aparte.

### 4. Auditoría exploratoria — inventario priorizado

Recorrí los cinco roles a `1440×900` y `390×844`: Inicio → Mercado → filtros →
detalle → login → carrito/checkout, publicación, panel de transportista, panel de
administración, estado vacío, URL directa, vuelta atrás y teclado.

**Línea de base:** cero errores de consola, cero peticiones fallidas y cero 5xx
en los diez recorridos.

Implementé sólo los dos autorizados. El resto queda acá, sin tocar.

| # | Sev | Rol | Recorrido | Qué pasa |
|---|---|---|---|---|
| A1 | **P0** | todos | Mercado y detalle | *(autorizado, corregido)* la tarjeta mostraba la ubicación del vendedor |
| A2 | **P0** | anónimo | detalle | *(autorizado, corregido)* el CTA moría en un toast |
| B1 | **P1** | todos | detalle | El botón dice «Iniciar operación» y lo que hace es **agregar al carrito**. El aviso viejo lo delataba: hablaba de «agregar publicaciones al carrito». Rótulo y acción no dicen lo mismo. **Alcance mínimo:** decidir si la anatomía «activo» agrega al carrito —y entonces el rótulo lo dice— o inicia otra cosa que todavía no existe. **Riesgo:** bajo; es copy y una decisión de producto. |
| B2 | **P1** | vendedor | detalle | **Un vendedor puede agregar su propia publicación al carrito.** Medido: con la sesión del dueño de «Kit de Filtros y Correas para Cosechadora», el toast dice «Agregado». Tampoco hay freno en el backend: `orders.py` no compara `seller_id` con el comprador al crear. **Alcance mínimo:** rechazar en el backend al crear la orden y ocultar el CTA cuando `product.seller.id === user.id`. **Riesgo:** medio, toca el alta de órdenes. No verifiqué el checkout completo, sólo el carrito. |
| B3 | **P1** | anónimo | tarjeta del Mercado | La **tarjeta** agrega al carrito sin sesión y **sin ningún aviso**, mientras el detalle ahora ofrece ingresar. Dos caminos a la misma acción se comportan distinto. Preexistente: hoy es toast vs. silencio, ahora es login vs. silencio. **Alcance mínimo:** que la tarjeta use el mismo camino que el detalle. **Riesgo:** bajo. |
| B4 | **P1** | todos | detalle | Con el detalle abierto, el **botón «atrás» del navegador sale del sitio** en vez de cerrarlo. En celular, «atrás» es el gesto natural para volver. El detalle no participa del historial. **Alcance mínimo:** que abrir el detalle empuje una entrada y `popstate` lo cierre. **Riesgo:** medio, toca navegación. |
| C1 | P2 | todos | detalle, teclado | Al cerrar con `Escape`, el foco vuelve a `<body>` y no a la tarjeta que abrió el detalle: quien navega con teclado pierde el lugar. **Alcance mínimo:** guardar el elemento que abrió y devolverle el foco al cerrar. |
| C2 | P2 | todos | listado | **N+1 preexistente**: la imagen principal se consulta **una vez por tarjeta**. Medido: 24 publicaciones → 26 consultas, de las cuales 24 son de `product_images`. El `outerjoin` ya está en la consulta pero no se usa. **Alcance mínimo:** seleccionar la URL en la misma consulta. **Riesgo:** bajo. |
| C3 | P2 | vendedor | modelo | `products.location` (texto libre) sigue conviviendo con `locality_id`. Dos fuentes para lo mismo invitan a que vuelva a pasar esto. **Alcance mínimo:** decidir si `location` se retira o queda como referencia interna. **Riesgo:** medio, hay que revisar quién lo escribe. |

**Observaciones, que no son defectos** —separadas a propósito—:

- La validación del alta es la **nativa del navegador**: once campos con
  `required` y un `<form>` de verdad. Funciona; mi primera sonda dijo «ningún
  aviso» porque Playwright no ve los globos nativos. Lo corrijo acá para no
  dejar un falso positivo en el expediente.
- El estado vacío del Mercado sí ofrece salida: **«Limpiar filtros»**.
- El primer botón del detalle tiene nombre accesible «Cerrar» y el foco entra
  ahí al abrir. `Escape` cierra.
- Los paneles de transportista y administración abren sin errores y con sus
  secciones completas.

### 5. Puertas, desde base limpia

```
base limpia (drop/create + PostGIS + alembic upgrade head + seed)
node scripts/smoke.mjs                          138/138   (0 fallaron)
node scripts/smoke.mjs  (segunda corrida)       138/138   (0 fallaron)
npm run a11y -- --todas                         sin violaciones bloqueantes
npm run contraste                               TODO OK, cobertura completa
npm run hito                                    6/6 pasos
python -m compileall backend/app                ok
python -m pip check                             No broken requirements found
npm run build                                   ok
npm run lint                                    ok (--max-warnings 0)
git -c core.whitespace=cr-at-eol diff --check   limpio
```

Corrí a11y, contraste e hito aunque dijiste que no hacía falta: **cambió texto
visible** —el rótulo del CTA y la línea de ubicación—, así que no me pareció
honesto saltearlas.

**Un aviso sobre la suite.** En una de las corridas intermedias falló el caso
116 —«con cabecera la imagen no entró: HTTP 400»— y volvió a pasar solo en las
dos corridas siguientes, sin que yo tocara nada suyo. Corrido aislado falla por
otra razón: depende de estado que arman casos anteriores. **Lo trato como
intermitente y no lo cuento como verde de mi tarea**; si te aparece, no es de
UX-COH-1, y creo que vale una tarea propia.

Diff:

```
 backend/app/api/catalog.py                     |  45 ++-
 backend/app/schemas/catalog.py                 |  25 ++
 scripts/smoke.mjs                              | 310 ++++++++++++++++++++-
 src/App.tsx                                    |  26 +-
 src/components/ProductCard/ProductCard.tsx     |  25 +-
 src/components/ProductDetail/ProductDetailModal.tsx | 25 +-
 src/components/ProductGrid/ProductGrid.tsx     |   6 +
 src/types/index.ts                             |   6 +
 src/utils/catalogService.ts                    |  32 ++-
```

Sin seed, datos, migraciones, precios, stock, pagos, Mercado Pago, Railway,
diseño general, búsqueda, ordenamiento ni paginación.

### 6. Un caso existente que tuve que tocar

El caso **123** esperaba el CTA del detalle por su rótulo
—`/Agregar|Iniciar operación|Contratar|…/`— y sin sesión ahora dice «Ingresar
para continuar», así que se quedó esperando un botón que ya no se llama así.
Agregué el rótulo nuevo a esa expresión: es el mismo botón renombrado, no una
afirmación relajada.

### 7. Riesgos residuales

1. **`publication_location` es contrato público nuevo.** No rompe a nadie —es un
   campo que se suma— pero si aparece otro consumidor de la API, ahora hay dos
   ubicaciones en la respuesta y hay que saber cuál es cuál. Los nombres lo
   dicen: `publication_location` es de la publicación, `seller.location` es de
   quien publica.
2. **El texto libre `products.location` sigue existiendo** y nadie lo lee para
   mostrar. Mientras esté, alguien puede volver a mostrarlo por error. Es C3 del
   inventario.
3. **La continuidad del login descansa en que el Login llame a `onClose`** tanto
   al cancelar como al completar. Hoy lo hace en los dos casos; si algún día
   dejara de hacerlo al completar, la persona quedaría sin volver al detalle. El
   caso 138 lo mide en los dos caminos, así que se enteraría la puerta.
4. **B2 —comprarse a uno mismo— sigue abierto**, y es el que más me preocupa de
   los que no toqué: no hay freno ni en la interfaz ni en el backend.

### 8. Hashes

```
backend/app/api/catalog.py                            b6741757e34a1c86
backend/app/schemas/catalog.py                        a28d380acde0935e
src/App.tsx                                           db78d00924424a2f
src/components/ProductCard/ProductCard.tsx            cdc0b29dda450bd6
src/components/ProductDetail/ProductDetailModal.tsx   2c16c33fca436f8e
src/components/ProductGrid/ProductGrid.tsx            0688ca74a05f94d0
src/types/index.ts                                    ccb8c992c91cc946
src/utils/catalogService.ts                           1c87ba2064a4290b
scripts/smoke.mjs                                     a0e05f0de5cfd19c
```

(SHA-256 truncado a 16, del árbol en el commit de producto.)

### 9. Frenos

Los IDs filtrados **sí** coinciden con el SQL, provincia por provincia. **No hay
publicaciones activas sin localidad**, así que no hubo que decidir ninguna
migración. El contrato público se amplió sin romper nada. No reparé datos ni
amplié UX: los ocho hallazgos que no autorizaste quedan en el inventario, sin
tocar. Del freno sobre anidar diálogos hablo en el punto 3: no lo oculté con otro
toast, elegí una continuidad y te la explico para que la revises. No desplegué.
`PRE_FIRMA.md` sigue fuera del versionado y lo confirmé antes de empujar.
