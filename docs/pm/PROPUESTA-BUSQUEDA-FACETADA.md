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
