# Propuesta Dev → PM — Marcas y filtros en la búsqueda

Documento **de la Dev**, propuesta de alcance. No es una tarea activa: nace de un
mockup que trajo Emi (`Index.html`, buscador con árbol categoría → subcategoría
→ ítem → marca, más «Condición» y «Origen»).

Regla de la casa: funcionalidad fuera de la tarea **se propone**, no se
implementa. Acá está la propuesta, con lo que medí antes de escribirla.

---

## 1. Lo que medí contra el repositorio

| Lo que el mockup asume | Lo que hay de verdad |
| --- | --- |
| `GET /api/search/?q=…` | **No existe.** No hay router de búsqueda registrado en `main.py` |
| Respuesta con `codigo_lote`, `productor_nombre`, `certificaciones` | Ese no es el dominio de este producto. El listado devuelve `ProductCardResponse` |
| 48 marcas seleccionables | **No hay marcas en el modelo de datos**: ni columna en `products`, ni tabla, ni `option_type` en `form_options` |
| Tercer nivel («compacto (<60 HP)», «arados», «herbicidas»…) | **No existe.** La taxonomía tiene dos niveles: `categories` → `subcategories` |
| Filtro «Origen»: Agencia / Dueño directo | **No existe.** `users.role` sólo tiene `ADMIN` y `USER`; no hay campo de tipo de vendedor |
| Filtro «Condición»: Nuevo / Usado | **Existe**: `products.condition`, valores `nuevo`/`usado` |
| Árbol de 7 categorías y sus subcategorías | **Coincide** con la base, salvo que falta «Bienes y Ganado» y sobra el servicio «Inversores» |

Cobertura del único campo que ya existe:

```
activo    / nuevo   ->   3      insumo    / (null) -> 160
activo    / usado   ->   6      logistica / (null) ->   3
activo    / (null)  ->  29      servicio  / (null) ->  21
```

`condition` sólo está poblado en publicaciones de tipo **activo** —maquinaria—,
y ahí en 9 de 38. En el resto es nulo por diseño: un herbicida no es «usado».

## 2. Objeciones al mockup, en orden de gravedad

**2.1. Arma la consulta concatenando rótulos en `q`.** El mockup hace
`query = potencia + marca + categoría + subcategoría` y lo manda como texto
libre. Eso es exactamente lo que `CAT-PAGE-1` y su R1 sacaron del producto: un
filtro que viaja como texto se aplica como `ILIKE` sobre nombre y descripción, no
filtra el conjunto, y el total deja de describir lo que se está mirando. Cada
filtro nuevo tiene que viajar **como parámetro propio** y aplicarse **antes** de
contar y paginar, como los diez que ya están.

**2.2. La marca no es un filtro: es un modelo de datos que falta.** Poner el
control antes de tener el dato da una faceta sobre una columna vacía. El orden
tiene que ser: dato → alta que lo pide → filtro. Y el alta es la parte que nadie
ve y que decide si el filtro sirve: sin un lugar donde el vendedor elija la
marca, la columna queda nula y el filtro no devuelve nada.

**2.3. La lista de 48 marcas viene con defectos que fragmentan el filtro.**
Medido sobre la lista del mockup:

```
«Jhon Deere» vs «John Deere»   difieren en 2 letras — el typo y la marca real,
                               las dos seleccionables, partiendo los resultados
«Case»  vs «Case IH»           una contiene a la otra
«Chery» vs «Chery Bylion»      idem
«Fiat»  vs «Fiat Someca»       idem, y además «Someca» está suelta
```

Con una lista cerrada escrita a mano esto se arrastra a los datos. Y hay marcas
que no son de agro —«Husqvarna», «Yard Machines»—, lo que sugiere que la lista
se armó para tractores y se va a ofrecer para todo.

**2.4. Ofrece las 48 marcas debajo de cada ítem de cada subcategoría.**
Incluido «herbicidas», «Campo agrícola (secano/riego)» y «Leasing de tierra».
Ofrecer un filtro que devuelve cero es peor que no ofrecerlo. Las marcas tienen
que ser una **faceta derivada del conjunto filtrado**, con su conteo, no una
lista fija.

**2.5. El tercer nivel mezcla tres cosas distintas.** «compacto (<60 HP)» es un
**rango de un atributo numérico**; «arados» es un **tipo de producto**; «Campo
agrícola (secano/riego)» es un **tipo de tierra**; «Otros» es una salida de
emergencia. Si los tres son «el nivel 3», ese nivel significa algo distinto en
cada rama y no se puede consultar de manera uniforme. La potencia en particular
no debería ser un nodo del árbol: si HP es un número, «compacto/estándar/alta»
son tres presets sobre un filtro de rango, y eso sí generaliza.

**2.6. La marca está detrás de elegir potencia.** En el mockup no se puede
filtrar por marca sin elegir primero un ítem del tercer nivel. La búsqueda más
común —«mostrame John Deere»— es la que queda bloqueada.

**2.7. «Origen» no está definido, no sólo ausente.** Agencia vs dueño directo es
una propiedad del **vendedor**, y hay que decidir si se auto-declara o se deriva
de algo verificado. Ya existe `documentacion_de_vendedores` con estado
`APROBADA`, que hoy alimenta el distintivo de la tarjeta: puede ser la base, o
puede ser otra cosa. Es una decisión de producto, no de implementación.

**2.8. El árbol reemplaza la barra lateral: eso es un rediseño, no un filtro.**
El Mercado ya tiene diez controles (`catalog-type`, `category`, `subcategory`,
`province`, `locality`, `price-min`, `price-max`, `availability`, `rating`,
`sort`). El mockup propone un acordeón que los sustituye. Se puede hacer, pero es
otra tarea y otra discusión.

## 3. Decisiones que no son mías

Antes de escribir una línea hacen falta cinco respuestas:

1. **La marca, ¿qué es?** ¿Texto libre del vendedor, lista cerrada que administra
   el admin, o lista cerrada **por categoría**? De esto depende si hay tabla
   nueva, si alcanza `form_options`, y si hay pantalla de administración.
2. **¿Qué significa el nulo al filtrar?** Alguien filtra «Nuevo»: las 29
   publicaciones de activo sin condición, ¿se excluyen o se muestran como
   desconocidas? Lo mismo para marca.
3. **«Origen», ¿de dónde sale?** ¿Auto-declarado, o derivado de la documentación
   aprobada que ya existe?
4. **El tercer nivel, ¿taxonomía o atributos?** Mi recomendación es atributos:
   HP como número con presets, y el resto de los «ítems» como subcategorías de
   verdad donde correspondan.
5. **El árbol, ¿reemplaza la barra o convive?**

## 4. Plan por etapas

Cada etapa se entrega sola, tiene su regresión y deja el producto usable. El
orden es deliberado: **el dato antes que el filtro**, y lo más barato primero.

**Etapa 1 — Condición.** Es la única que ya tiene el dato. Parámetro en la API
aplicado antes de contar, control en la barra, en la URL y restaurado con la
entrada, y que el alta lo pida cuando `operation_kind = 'activo'`. Regresión: un
caso que fabrica nuevos, usados y sin condición, y comprueba total y páginas del
subconjunto, no de la página.
*Depende de la decisión 2.*

**Etapa 2 — La marca como dato, sin filtro todavía.** Tabla o `option_type`,
`products.brand_id` nulable, migración, y el alta que la pide para activos. El
listado no cambia. Regresión: alta y detalle conservan la marca; el listado da
idéntico a antes.
*Depende de la decisión 1. Incluye normalizar la lista: «Jhon Deere» no entra.*

**Etapa 3 — La marca como filtro y como faceta derivada.** `?brand=` aplicado
antes de contar, y las marcas **presentes en el conjunto filtrado** con su
conteo, para no ofrecer filtros vacíos. Regresión: la faceta no ofrece una marca
sin resultados, y el filtro cuenta el conjunto entero.

**Etapa 4 — Origen.** Sólo después de la decisión 3.

**Etapa 5 — Atributos (HP y los que salgan).** Campo numérico y filtro de rango
con presets. Absorbe «compacto/estándar/alta» sin meterlos en la taxonomía.

**Etapa 6 — El árbol de navegación**, si se decide que reemplaza la barra.

## 5. Riesgos

- **Migración y datos.** Las etapas 2 y 5 tocan esquema. Entran en «migraciones y
  datos», que por regla de la casa piden revisión más fuerte.
- **Un filtro sobre una columna casi vacía es peor que no tenerlo.** Si la etapa
  3 sale antes de que las publicaciones tengan marca, el Mercado se va a ver
  vacío para cualquier marca elegida. Por eso la etapa 2 va antes y por eso
  incluye el alta.
- **Cada filtro nuevo multiplica las combinaciones que la paginación tiene que
  sostener.** Lo bueno es que el contrato ya está probado: los diez controles
  actuales viajan, se aplican antes de contar y vuelven con la entrada del
  historial. Lo nuevo tiene que entrar por ahí y no por un camino paralelo.
- **`docs/pm/NOW.md` tiene otras prioridades.** Esto no desplaza nada por sí
  solo; lo decide la PM.

---

# Decisiones tomadas — 2026-09-15

Emi delegó esta operación: «sos vos la pm por esta operación». Las decisiones
de abajo las tomé yo en ese rol, y quedan firmadas acá y no en `PARA-DEV.md`,
que es el canal de la PM y no lo toco.

**Una advertencia que corresponde dejar dicha.** Siendo PM y Dev a la vez se
pierde la revisión independiente, y `CLAUDE.md` es explícito: «Dos corridas de
Dev no sustituyen independencia». Lo compenso saboteando cada regresión pieza
por pieza, e informando todo lo que quede rojo. Y no me auto-acepto
`QUERY-IMG-1`: sigue entregado esperando revisión de la PM real.

## Las cinco

**1. La marca es una lista cerrada en `form_options` con `option_type='brand'`,
y el valor elegido se guarda como varchar en `products`.** No inventa un
patrón: los cuatro `option_type` que existen —`availability`, `pricing_type`,
`response_time`, `unit`— son exactamente cuatro columnas varchar en `products`,
y el ABM de admin ya está escrito (`GET/POST/PUT /admin/form-options`, con
unicidad de `(option_type, value)`, que sola impide que «Jhon Deere» conviva
con «John Deere»). **No** se modela marca-por-categoría: el problema de «48
marcas debajo de herbicidas» lo resuelve la faceta derivada del conjunto
filtrado, no una tabla puente.

**2. El nulo no entra en un filtro positivo.** Pedir «Nuevo» devuelve los
declarados nuevos. Incluir los que nadie declaró sería afirmar un dato que no
existe.

**3. «Origen» (Agencia / Dueño directo) no se hace.** Derivarlo de la
documentación aprobada etiquetaría «Agencia» a cualquier monotributista con
CUIT. Auto-declarado es peor: quedaría al lado del distintivo de «documentación
revisada» prestándole una credibilidad que nadie verificó, y un comprador que
elige «Dueño directo» para evitar intermediarios tiene un perjuicio real si lo
recibe al revés. Vuelve cuando exista un campo de forma jurídica.

**4. El tercer nivel son atributos, no taxonomía.** HP como número con presets.

**5. El árbol no reemplaza la barra lateral.**

## Una decisión mía que corregí midiendo

Había decidido que el alta pidiera la condición **obligatoria** para activos.
Está mal por dos motivos, los dos comprobados en el repositorio:

- el alta **ya la pide** (`AddProductModal.tsx`, y `products.py` la guarda);
- `anatomia.usa_condicion` documenta que es **opcional a propósito**: «el
  catálogo aprobado tiene dos categorías de activo donde "nuevo o usado" no
  significa nada: "Bienes y Ganado" —un ternero no es ninguna de las dos— y
  "Tierras y parcelas". Forzarla ahí obligaría al vendedor a elegir una
  respuesta falsa para poder publicar».

Medido, de 19 activos sin condición sólo 3 están en esas dos categorías; los
otros 16 son filas anteriores al campo. Así que la etapa 1 se achicó a una sola
cosa: **el filtro**.

## Etapa 1 — entregada

| | |
| --- | --- |
| **Rama** | `claude/dev-role-repo-3l0kp3` |
| **SHA base** | `a3bfce0` |
| **SHA candidato** | `e798c85` (producto y regresión en `da69fe4`, corrección del arnés en `e798c85`) |
| **Diff** | `backend/app/api/catalog.py`, `src/App.tsx`, `src/hooks/useProductFilters.ts`, `src/utils/catalogService.ts`, `src/components/FilterSidebar/FilterSidebar.tsx`, `scripts/smoke.mjs` |

**La premisa, medida antes:** `?condition=nuevo` devolvía 195 —el catálogo
entero— igual que `?condition=inventado`, porque FastAPI descarta lo que no
declara. Ahora: 3 nuevos, 5 usados, y 422 para un valor que no existe.

**Los cinco sabotajes.** Cada uno quita una pieza y el caso 173 se pone rojo:

| Pieza quitada | Resultado |
| --- | --- |
| el filtro no se aplica en la API | rojo: «filtrando "nuevo" la API dice 39 y son 30» |
| el filtro se aplica después de contar | rojo: mismo mensaje |
| la condición fuera de la firma de `consultaVigente` | rojo, 5/5 corridas |
| la condición no se escribe en la barra | rojo: «la barra dice condition=null» |
| cambiar la condición no vuelve a la página 1 | rojo, 3/3 corridas |
| nada quitado | **verde, 4/4 corridas** |

**Dos negativos míos nacieron dando falso verde**, y los corregí midiendo:

1. *El de la firma* perdía la ventana de un cuadro una corrida de cada varias.
   Se frena la CPU seis veces durante la transición. No es un truco para forzar
   el rojo: es el dispositivo donde el defecto se ve, porque en un teléfono
   lento esos treinta milisegundos son trescientos.
2. *El del reinicio de página* medía una transición hacia un subconjunto de
   **una** página, donde el acote de página inexistente corrige a la primera
   igual y tapaba la falta del reinicio. Ahora va entre dos subconjuntos de dos
   páginas, donde volver a la primera sólo puede ser el reinicio.

**Compuertas**, todas sobre `e798c85`:

| Puerta | Resultado |
| --- | --- |
| caso 173 focal | verde, 4/4 |
| rojo discriminante | los cinco de arriba |
| casos 171, 172 y 173 juntos | 3/3 |
| suite completa desde base limpia | **172/173**; único rojo el **131** ambiental |
| build · lint · `tsc --noEmit` · `node --check` · `compileall` · `diff --check` | verdes |
| `npm run a11y -- --todas` | **72/72**, 0 bloqueantes |
| `npm run contraste` | **80/80**, 0 incumplimientos |

a11y y contraste se corrieron porque el cambio agrega un control visible.
Comprobado que lo miden de verdad y no por casualidad: `#catalog-condition`
está visible en 1440×900 y en 390×844, igual que sus vecinos de la barra. La
cuenta de textos medidos bajó de 17 684 a 17 663 entre corridas porque cambia
el catálogo, así que ese número no prueba cobertura y no lo uso como prueba.

## Hallazgos adyacentes, no implementados

1. **`scripts/lib/sql.mjs` tiene una trampa.** `querySql` hace `.trim()` sobre
   toda la salida de psql, así que si la última fila termina en una columna
   vacía se le come el tabulador y esa fila vuelve con un campo menos. Medido:
   `SELECT 'sin-url', ''` vuelve como `["sin-url"]`. Es lo que hacía
   intermitente al caso 172 —su consulta no tenía `ORDER BY`, así que dependía
   de qué fila pusiera última Postgres—. Corregí el caso; **no toqué el
   helper**, porque lo usan unos 170 casos y cambiarlo es su propia tarea.
2. **`POST /products` no devuelve `condition` en su respuesta.** La guarda
   —comprobado en la base—, pero no la echa, así que el caso 173 verifica la
   fabricación contra la base y no contra esa respuesta.

## Lo que sigue

Etapa 2: la marca como dato, con su alta. Recién después la marca como filtro
y faceta. No arranca sin que Emi lo pida.

---

# Etapa 2 — entregada (2026-09-15)

| | |
| --- | --- |
| **SHA base** | `339a45e` |
| **SHA candidato** | `4bdfc71` (producto y regresión en `ed3e39f`, índice de la migración en `4bdfc71`) |
| **Diff** | migración nueva, `marcas.py` nuevo, `catalog.py`, `products.py`, los dos modelos, los dos esquemas, `seed.py`, `AddProductModal.tsx`, `catalogService.ts`, `smoke.mjs` |

## La decisión de diseño cambió, y la cambió una medición

Tenía decidido espejar la condición: ofrecer marca donde la anatomía es
`activo`. **Está mal.** `anatomia.DEFAULT_POR_CATEGORIA` pone en `activo` a
«Tierras y parcelas» y a «Bienes y Ganado». Decidirlo por anatomía habría puesto
una lista de marcas de tractor sobre un campo y sobre un ternero: exactamente el
defecto que este documento le señaló al buscador de la clienta en el punto 2.4.

Lo decide la **categoría**: `categories.usa_marca`. Arranca en verdadero sólo
para «Maquinaria agrícola», que es la única con lista cargada. Ofrecer marcas de
tractor dentro de «Insumos agrícolas» sería el mismo defecto al revés —un
herbicida tiene marca, pero no es ninguna de éstas—, así que ampliarla es cargar
la lista de esa categoría, y es otra decisión.

Esto **matiza la decisión 1**: sigue habiendo una sola lista y ninguna tabla
puente, pero la lista se **ofrece por categoría**. Es más débil que
«marca-por-categoría» y más fuerte que «una lista para todos».

## La lista

47 marcas. Se retiró **«Jhon Deere»**, que es «John Deere» mal escrito y estaba
junto a él: con las dos, el mismo tractor se publica de dos formas y el día que
esto filtre parte los resultados.

**No fusioné** los pares que son marcas distintas de verdad —Case/Case IH,
Fiat/Fiat Someca/Someca, Chery/Chery Bylion, Deutz/Deutz-Fahr—. Si sobra alguna
se desactiva desde el panel, sin migración. Es la decisión que más se beneficia
de conocer el mercado, y ahí Emi sabe más que yo.

El valor es un slug y la etiqueta el nombre: el slug es lo que va a viajar.

## Qué se hizo

- `products.brand` y `categories.usa_marca`, con índice sobre `brand`.
- `app/services/marcas.py`: qué categorías la declaran, por omisión.
- La marca se **valida contra las opciones activas**; una que no está se rechaza
  con 400. Aceptar texto libre haría que «John Deere», «john deere» y «Jhon
  Deere» fueran tres marcas y no habría nada que contar.
- Donde la categoría no la declara, se descarta en silencio, igual que la
  condición. Y **mudar una publicación a una categoría sin marca la suelta**.
- Sale en la tarjeta y en el detalle. **No hay filtro todavía**: eso es la
  etapa 3.
- El alta ofrece el control sólo donde corresponde, con las opciones de
  `/catalog/form-options`, que ya existía.

## Compuertas

| Puerta | Resultado |
| --- | --- |
| caso 174 focal | verde |
| rojo discriminante | **cinco sabotajes**, uno por pieza (ver abajo) |
| suite completa desde base limpia sobre `4bdfc71` | **173/174**; único rojo el **131** ambiental |
| migración, ida y vuelta desde cero | baja: 0 columnas, 0 índices · sube: 2 columnas, 1 índice, «Maquinaria agrícola» en verdadero |
| `alembic check` | «No new upgrade operations detected» |
| build · lint · `tsc` · `node --check` · `compileall` · `diff --check` | verdes |

Los cinco sabotajes: sin validar contra la lista, decidiendo por anatomía en vez
de por categoría, con «Jhon Deere» de vuelta, con «Tierras y parcelas»
declarando marca, y sin soltar la marca al mudar de categoría.

## Lo que la suite me encontró a mí

Declaré `index=True` en `Product.brand` y **la migración no creaba el índice**.
Los casos 55 y 58 corren `alembic check`, que compara el modelo contra el
esquema, y lo marcaron. No lo vi yo: lo vio la puerta que ya estaba. Corregido
en `4bdfc71`.

De paso: intentar la vuelta atrás con la migración aplicada **sin** el índice
falla, porque el downgrade borra algo que no existe. Se resolvió recreando la
base, que además prueba el camino que recorren una instalación nueva y CI.

## Cobertura que NO tengo, dicha en voz alta

**El modal del alta no es superficie de a11y ni de contraste.** No está en
`scripts/lib/superficies.mjs`, así que esas puertas no miden el control de marca
—ni el de condición, que ya estaba—. No lo agregué: sería convertir esta etapa
en «medir y arreglar toda la accesibilidad del alta».

Lo que sí hice es medirlo puntualmente: axe sobre el modal con el control
puesto da **0 violaciones**, ninguna de ningún impacto. O sea que agregarlo al
inventario hoy sería barato, y lo recomiendo como tarea propia.

## Lo que sigue

Etapa 3: la marca como filtro y como faceta derivada del conjunto —con conteo,
para no ofrecer una marca que devuelve cero—. No arranca sin pedido.
