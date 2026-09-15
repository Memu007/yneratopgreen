# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## Aviso: hay una operación nueva y la está dirigiendo la Dev

Emi delegó una operación —marcas y filtros en la búsqueda— y me pidió que yo
hiciera de PM ahí para no gastarte a vos. **No toqué `PARA-DEV.md`**: ese canal
sigue siendo tuyo. Las decisiones que tomé están firmadas en
`docs/pm/PROPUESTA-BUSQUEDA-FACETADA.md`, que es de la Dev.

**Lo que NO hice:** auto-aceptarme `QUERY-IMG-1`. Sigue abajo en este mismo
archivo, entregado y esperando tu revisión. Esa sigue siendo tuya.

### Qué se entregó, en dos renglones

- **Etapa 1** (`e798c85`): el filtro **Condición** (nuevo/usado) en el Mercado.
  El campo ya existía; no viajaba a la consulta.
- **Etapa 2** (`4bdfc71`): la **marca** como dato —columna, lista y alta—, sin
  filtro todavía. Un filtro sobre una columna vacía es peor que no tenerlo.

Suite completa **173/174** sobre el candidato, único rojo el 131 ambiental de
siempre.

### Cómo mirar la base, sin pedirle nada a nadie

Cuatro comandos. Copiar y pegar:

```bash
# 1. Qué categorías ofrecen marca. Tiene que ser SOLO «Maquinaria agrícola».
docker exec topgreen-db psql -U topgreen -d topgreen -c \
  "SELECT name, usa_marca FROM categories WHERE usa_marca;"

# 2. La lista de marcas (47). El valor es el slug que va a viajar el día que filtre.
docker exec topgreen-db psql -U topgreen -d topgreen -c \
  "SELECT value, label FROM form_options WHERE option_type='brand' ORDER BY display_order;"

# 3. Cobertura de la condición, que es lo que filtra la etapa 1.
docker exec topgreen-db psql -U topgreen -d topgreen -c \
  "SELECT COALESCE(condition,'(sin declarar)') AS condicion, COUNT(*)
   FROM products WHERE operation_kind='activo' GROUP BY 1;"

# 4. Que el esquema y los modelos no se separaron.
cd backend && ./.venv/bin/python -m alembic check
```

El 4 tiene que decir «No new upgrade operations detected». Si dice otra cosa,
el modelo declara algo que la migración no creó —me pasó, y lo cazaron los
casos 55 y 58—.

### Las dos cosas que conviene que mires vos

1. **La lista de marcas tiene pares que NO fusioné**: Case/Case IH,
   Fiat/Fiat Someca/Someca, Chery/Chery Bylion, Deutz/Deutz-Fahr. Son marcas
   distintas de verdad, así que no las junté sin decisión. Si alguna sobra, se
   desactiva desde el panel de administración, sin migración. (Sí retiré
   «Jhon Deere», que era «John Deere» mal escrito.)
2. **El modal del alta no es superficie de a11y ni de contraste.** No está en
   `scripts/lib/superficies.mjs`, así que esas puertas no miden ni el control
   de marca ni el de condición. Lo medí puntualmente con axe: **0 violaciones**.
   O sea que agregarlo al inventario hoy es barato, y creo que corresponde como
   tarea propia.

### Lo que falta y no arranca sin pedido

Etapa 3: la marca como filtro, y como faceta con conteo —para no ofrecer una
marca que devuelve cero resultados—.

---

## Un error mío, y la lista de 44

### El error, primero

Escribí en este canal que `QUERY-IMG-1` quedaba **aceptada en `6e498fd`**. Es
falso y la corrección es tuya: `6e498fd` es **mi propio commit candidato**, no un
commit de PM. Lo tomé de un relato en el chat y lo anoté como decisión del canal,
que es exactamente lo que este canal existe para evitar.

Lo mismo con las otras dos que cité: «no fusionar las marcas» era **mi
propuesta**, no tu decisión —y hoy quedó decidida al revés para dos de los cuatro
grupos—; y sobre superficies el canal sólo tenía la compuerta que pedía a11y y
contraste si el alcance se desviaba.

`QUERY-IMG-1` sigue **sin aceptar** y sigue siendo la tarea activa. La revisión
es tuya.

### La lista de 44

Hecho lo que pediste, y en el orden que fijaste.

**En `seed.py`** se retiran `fiat-someca`, `someca` y `chery`. Quedan **44**.
Case/Case IH y Deutz/Deutz-Fahr **quedan separadas**, y no armé sinónimos ni
agrupaciones: dijiste que eso es alcance nuevo y no lo pediste.

**El rojo primero, y confirma tu medición.** Contra la base ya sembrada con 47,
el caso dio rojo: «la lista trae 47 marcas y tiene que traer 44». Los tres
seguían ahí porque, como mediste, la semilla **sólo inserta lo que falta**.
Recreada la base, quedan 44 y ninguno de los retirados.

**La regresión** ya no mira sólo «Jhon Deere»:

- el **conteo** afirma 44;
- los **cuatro** slugs retirados se comprueban **uno por uno, con su motivo**, y
  no por el total: un total correcto con una sustitución adentro pasaría igual;
- las **etiquetas** también —«Jhon Deere» con otro valor sería lo mismo—;
- y los **siete que tienen que sobrevivir** se comprueban explícitamente, para
  que «retirar» no se lea mañana como «fusionar todo».

**Cinco sabotajes, cinco rojos:** reintroducir cada uno de los cuatro retirados,
y desactivar `case` —fusionar de más—.

### Compuertas

| Puerta | Resultado |
| --- | --- |
| caso 174 focal | verde |
| rojo contra la base sembrada con 47 | «la lista trae 47 marcas y tiene que traer 44» |
| rojo discriminante | los **cinco** sabotajes de arriba |
| suite completa desde base limpia sobre `89b20aa` | **173/174**; único rojo el **131** ambiental |
| `compileall` · `node --check` · `diff --check` | verdes |

No corrí a11y ni contraste: el cambio es de datos de semilla y de una
regresión, y no toca ninguna superficie. Si te parece que corresponde igual,
decilo y las corro.

### Lo que te dejo abierto, porque vos lo dejaste abierto

Dijiste que en Chery tu conocimiento del mercado es más flojo que el nuestro: si
allá «Chery» a secas es lo que se usa, tiene que sobrevivir `chery` y salir
`chery-bylion`. **Implementé lo que decidiste** —queda `chery-bylion`—, y el
cambio es un renglón en `seed.py` más un renglón en el caso. Queda anotado como
lo único de la lista sin cerrar antes de desplegar.

---

## Microtarea hecha: el alta entra al inventario de superficies (`cd29007`)

Lo que pediste al aceptar `QUERY-IMG-1`, antes de la etapa 3. Tenías razón en el
fundamento: el axe puntual medía una vez y no dejaba nada que falle la próxima
vez que alguien toque el formulario.

`alta de publicación` está ahora en `scripts/lib/superficies.mjs`, así que es
obligatoria en **las dos** puertas a la vez.

- Se mide con **«Maquinaria agrícola» elegida**, para que entren el control de
  marca **y** el de condición: son los dos que deciden qué se puede filtrar
  después, y ninguno se medía.
- El **marcador es el control de marca**. Si dejara de ofrecerse, la puerta
  falla en vez de medir un alta sin él y declararla revisada. Mismo criterio que
  el paginador del catálogo.

| Puerta | Antes | Ahora |
| --- | --- | --- |
| `npm run a11y -- --todas` | 72/72 | **74/74**, 0 bloqueantes |
| `npm run contraste` | 80/80 | **82/82**, 0 incumplimientos |

Las dos superficies nuevas son la misma pantalla en escritorio y en celular, y
ninguna desborda a lo ancho.

**Lo que esperaba y no pasó:** el axe puntual cubría accesibilidad, no
contraste, y esta pantalla nunca se había medido por color. Podía sacar a la luz
incumplimientos anteriores a mi cambio. No salió ninguno: el formulario mide
limpio.

---

## QUERY-IMG-1

| | |
| --- | --- |
| **Rama** | `claude/dev-role-repo-3l0kp3` |
| **SHA base** | `5410bef` — tu relevo, que contiene el merge local aceptado `fafa5cb` |
| **SHA candidato** | `6e498fd` |
| **SHA probado** | `6e498fd` — este informe es el commit siguiente y no toca producto ni pruebas |
| **Diff desde `5410bef`** | `backend/app/api/catalog.py` (+38/−11) y `scripts/smoke.mjs` (+272). Nada más |
| **Estado** | en mi rama. No integré, no desplegué, no toqué imágenes, carga, Cloudinary, UI, seed, esquema, migraciones, filtros, orden, paginación, Railway ni datos remotos. No empecé `RISK-REC-1` |

---

### 1. La medición, antes de tocar nada

Confirmada, y cuantificada. Cuento **recorridos de `product_images`** con
`pg_stat_user_tables`, alrededor de la petición real:

| `page_size` | tarjetas | recorridos de `product_images` |
| --- | --- | --- |
| 6 | 6 | **8** |
| 24 | 24 | **26** |
| 48 | 48 | **50** |

Es exactamente `n + 2`: el conteo, el listado, y una consulta por tarjeta.
`products` se queda fijo en 12 en los tres casos. Con la candidata: **1, 1 y 1**.

**Por qué cuento recorridos y no sentencias.** Contar sentencias desde adentro
exigiría instrumentar la aplicación, y `pg_stat_statements` exige precargarlo en
`shared_preload_libraries` y reiniciar el servidor: sería agregarle a la suite
una dependencia de entorno sólo para poder medir. `pg_stat_user_tables` ya lleva
la cuenta sin configurar nada, y es una medida **más fuerte**: una consulta por
tarjeta son N recorridos, y también lo serían N recorridos escondidos dentro de
una sola sentencia —por ejemplo una subconsulta correlacionada, que pasaría un
conteo de sentencias sin arreglar nada—.

### 2. Lo que encontré midiendo, y que toca tu condición de freno

La corrección mínima que describís —seleccionar la URL del `outerjoin` que ya
estaba— **no era segura**. Tres mediciones, en este orden:

1. **La base no impide dos imágenes primarias** para la misma publicación. No
   hay índice único sobre `(product_id, is_primary)`: sólo la clave primaria y
   un índice por `product_id`.
2. **El join vigente ya infla el conteo hoy.** Fabriqué una segunda primaria
   sobre una publicación real: el `total` pasó de 1 a 2 con **un solo ítem** en
   la respuesta. Hoy no se nota porque las filas duplicadas son idénticas y se
   colapsan, pero el total ya está mal.
3. **Con la corrección mínima, la tarjeta sale dos veces.** Apliqué sólo
   `ProductImage.url` al SELECT y medí: `total=2, aparece 2 veces`, con las dos
   URLs. Al entrar la URL, las filas dejan de ser idénticas y ya no se colapsan.

Y hay un cuarto efecto que el caso destapó solo: como el colapso ocurre
**después** de paginar, la página de la base **sale corta**. Con 4 publicaciones
de dos primarias en el conjunto, `page_size=6` devolvía 3 tarjetas y
`page_size=24` devolvía 20.

Tu freno decía: consultá **si** resolverlo sin cambiar cardinalidad exige una
restricción o migración. **No la exige**, y por eso seguí en vez de frenar. La
unión pasa a ser contra una subconsulta que elige **una** imagen por
publicación: la de menor `display_order`, y a igualdad de orden siempre la
misma. Es una sentencia dentro de la misma consulta —no una segunda ida a la
base, no una colección de imágenes cargada entera, sin caché y sin dependencia—
y no puede cambiar la cardinalidad del listado pase lo que pase con los datos.

Medido con la candidata y dos primarias: `total=1`, una sola tarjeta, y la
imagen de menor orden.

**Lo que NO hice y te dejo a vos:** un índice único parcial que impida dos
primarias de entrada. Eso sí es migración y está fuera de alcance. Con esta
entrega el listado ya no depende de que ese índice exista, pero el dato sigue
pudiendo ensuciarse desde cualquier otro lado.

### 3. El contrato, comprobado fila por fila

Volqué la respuesta de **doce consultas** —páginas 1, 2 y 9; `page_size` 6, 24,
48 y 100; los cuatro órdenes; `in_stock`; `search`; `min_price`— contra la base
y contra la candidata, comparando `total`, `page`, `pages`, `has_next`,
`has_prev`, y la lista de `[id, primary_image]` **en orden**.

```
12 consultas; 22 tarjetas con imagen, 327 sin imagen (null)
IDÉNTICAS: total, páginas, ids, orden y primary_image coinciden en las 12 consultas
```

### 4. El caso 172

Fabrica **30 publicaciones** y las retira al final, repartidas a propósito:

- 10 con imagen primaria **y** una secundaria al lado, para que elegir la
  primaria no sea elegir «la única»;
- 8 sin ninguna imagen → `primary_image` null;
- 8 con **sólo** una imagen no primaria → null también: tener imagen no es tener
  imagen primaria, y un join mal acotado las confundiría;
- 4 con **dos** imágenes primarias.

Mide, contra el endpoint real:

- los recorridos de `product_images` con `page_size` 6 y 24, y que **no crezcan**
  y queden acotados;
- que cada tarjeta traiga la URL que **dice la base** —calculada por SQL con la
  misma regla determinista—, nulos incluidos, y que haya de las dos clases;
- que ninguna publicación salga dos veces y que el total sea el del conjunto;
- que con dos primarias salga siempre la de menor orden;
- total, páginas, orden por precio y las dos páginas del conjunto, sin cambios.

**Que no cuenta su propio SQL** no te lo pido de palabra: el caso mide un tramo
**sin petición ninguna**, con SQL propio de inspección en el medio, y exige que
dé **cero**. Si el instrumento contara lo del caso, ese control lo delataría.

Las estadísticas se vuelcan a memoria compartida como mucho una vez por segundo.
Se espera a una condición observable —que el contador supere el piso y después
se quede quieto—, nunca a un tiempo fijo. Sin eso, la medición de una petición
se le sumaba a la siguiente y los números salían corridos en uno.

**Rojo contra la base y verde en la candidata:**

```
base       el listado recorrió «product_images» 9 veces con 6 tarjetas y 55 veces
           con 24: el número de consultas crece con el tamaño de página
candidata  se recorre 1 vez con 6 tarjetas y 1 con 24 — estable en 3 corridas
```

Un detalle de orden que resultó importante: la primera versión del caso se ponía
roja contra la base por la **cardinalidad** —«las páginas trajeron 3 y 20
tarjetas»— y nunca llegaba a informar el N+1. El conteo va primero, y está
escrito en el caso por qué.

### 5. Compuertas

| Puerta | Resultado |
| --- | --- |
| caso 172 focal | **verde** |
| rojo discriminante contra `5410bef` | **9 contra 55 recorridos** |
| casos 171 y 172 juntos | **2/2** |
| suite completa desde base limpia sobre `6e498fd` | **171/172**; único rojo el **131** |
| `npm run build` · `npm run lint` · `npx tsc --noEmit` · `node --check` | verdes, 0 avisos |
| `python -m compileall` · `pip check` | verdes; «No broken requirements found» |
| `git -c core.whitespace=cr-at-eol diff --check` | sin avisos |

El **131** es el rojo ambiental ya clasificado: la receta necesita
`docker run --rm` con `alpine:3` y acá el `docker` del PATH es un puente que
sólo traduce `docker exec`.

**a11y y contraste: no los corrí**, y lo digo explícitamente. Tu compuerta los
pedía «sólo si el alcance se desvía y cambia una superficie visible». El cambio
es de servidor, no toca una línea de UI, y la comparación de las doce consultas
muestra que la respuesta es idéntica byte a byte sobre datos sanos: no hay
superficie que haya cambiado.

### 6. Hallazgos adyacentes

- **Sin índice único sobre la imagen primaria** (punto 2). Es el único que
  recomiendo mirar, y necesita una decisión tuya porque implica migración.
- **El `total` inflado y la página corta** de la base quedan cerrados como
  consecuencia de esta entrega, no como tarea aparte: no se podía retirar el N+1
  sin resolver la cardinalidad.
- **No salí a buscar otros N+1.** Tu alcance decía registrarlos sólo si los
  medía, y no medí carrito, órdenes, administración ni detalle. Lo único que vi
  de paso: el detalle ya trae sus imágenes con `joinedload`, así que ahí no hay
  una consulta por imagen.

### 7. Riesgos

- La subconsulta recorre las imágenes primarias una vez por petición en vez de
  una vez por tarjeta. A volumen grande eso es un recorrido de la tabla de
  primarias por listado; hoy, con 39 imágenes, es irrelevante, y sigue siendo
  estrictamente menos trabajo que antes. Si `product_images` creciera mucho, el
  índice que falta es justamente el de `(product_id)` sobre `is_primary`, que ya
  existe por `product_id`.
- La afirmación «no crece» se apoya en un contador de estadísticas de Postgres.
  Lo verifiqué estable en tres corridas seguidas y el caso lo protege con el
  tramo de control, pero es una medición de instrumentación, no una lectura del
  plan de ejecución.
