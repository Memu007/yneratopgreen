# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

Este archivo contiene únicamente la tarea activa y su hilo de devoluciones
hasta el cierre. La historia anterior permanece en Git; el cierre de
`CAT-PAGE-1` está en `REPRODUCCION-CAT-PAGE-1-2026-09-14.md`.

---

## 2026-09-14 — QUERY-IMG-1

**Base excepcional autorizada por PM:** Emi postergó la publicación de `main`
para no disparar Railway. Continuá en `claude/dev-role-repo-3l0kp3` después de
traer este relevo, que contiene el merge local aceptado `fafa5cb`. No te bases
en `origin/main`, que sigue viejo. Registrá el SHA exacto del relevo como base.

### Problema confirmado y prioridad

El inventario `acbf3b6` midió el listado del Mercado: 24 publicaciones producen
26 consultas SQL, 24 de ellas a `product_images`. El código vigente confirma la
raíz: `backend/app/api/catalog.py` ya hace un `outerjoin` con la imagen primaria,
pero no selecciona su URL y vuelve a consultar una vez por cada tarjeta.

Después de cerrar la paginación, este es el siguiente borde de volumen: la
cantidad de consultas no debe crecer con el tamaño de página.

### Alcance mínimo

1. Medí primero el número de consultas SQL reales de
   `GET /api/catalog/products` con dos tamaños de página, incluido 24, y
   conservá ese rojo contra la base.
2. Hacé que la URL de la imagen primaria viaje en la consulta del listado que
   ya trae producto, vendedor y ubicación. Eliminá sólo la consulta por tarjeta.
3. Conservá exactamente el contrato y la semántica actuales: misma
   `primary_image` para una publicación con imagen primaria, `null` cuando no
   hay, mismo total, orden, filtros y paginación.
4. No cargues la colección completa de imágenes para resolver una URL y no
   agregues caché, dependencia ni una segunda consulta masiva si el join vigente
   alcanza.

### Regresión exigida

Agregá el caso 172. Debe fabricar o identificar de forma determinista un
conjunto con publicaciones con imagen primaria y sin imagen, llamar al endpoint
real y contar sentencias SQL durante la petición.

Debe demostrar:

- rojo contra la base porque las consultas a `product_images` crecen con las
  tarjetas;
- verde en la candidata con un número acotado que no crece al pasar del tamaño
  chico a 24;
- URLs de imagen y `null` idénticos a los esperados por base, no sólo un conteo
  de consultas;
- total, IDs y orden de la respuesta sin cambios;
- la medición no cuenta el SQL con el que el propio caso fabrica o inspecciona
  datos.

### Compuertas

- caso 172 focal y rojo discriminante contra la base;
- casos 171 y 172 juntos;
- suite smoke completa desde base limpia;
- build, lint, `tsc --noEmit`, `node --check`, `compileall`, `pip check` y
  `git diff --check`;
- a11y y contraste sólo si el alcance se desvía y cambia una superficie visible.

### Fuera de alcance y freno

- No optimices carrito, órdenes, administración, detalle ni otros posibles
  N+1: registralos aparte si los medís, sin tocarlos.
- No cambies archivos de imagen, carga/almacenamiento, Cloudinary, UI, fotos del
  seed, esquema, migraciones, filtros, orden, paginación, Railway ni datos
  remotos.
- Frená y consultá si la base permite varias imágenes primarias por producto y
  resolverlo sin cambiar cardinalidad exige una restricción/migración, o si la
  medición contradice el N+1 confirmado.
- No empieces `RISK-REC-1`, no integres y no despliegues.

### Entrega

Reemplazá `docs/pm/PARA-PM.md` con rama, SHA base, SHA candidato, diff completo,
conteos SQL antes/después, rojo/verde, pruebas, riesgos y cualquier hallazgo
adyacente no implementado. Frená después de entregar.

---

## 2026-09-15 — Las dos decisiones de la operación de marcas

Leídos `PARA-PM.md` y `PROPUESTA-BUSQUEDA-FACETADA.md` en `6697d68`. Confirmo lo
que decís: la operación **no tocó este canal**. Los commits `a3bfce0..6697d68`
no incluyen `PARA-DEV.md`, y lo último escrito acá sigue siendo `5410bef`, mío.
La advertencia sobre perder la revisión independiente estaba bien puesta, y no
auto-aceptarte `QUERY-IMG-1` fue lo correcto.

### Los cuatro comandos: no los corrí, y por qué

Este entorno **no puede levantar el esquema**: su PostgreSQL 16.13 no tiene
PostGIS, `alembic upgrade head` muere en la primera migración con `type
"geography" does not exist`, y el puente de `docker` de acá sólo traduce
`psql` —no hay `bash` adentro del contenedor— así que tampoco puedo instalarlo.
Los cuatro comandos quedan **sin correr por mí**, y la base sigue vacía.

Lo verifiqué contra el código, que es de donde la semilla escribe esa base:

| Comando | En su lugar, medido en `6697d68` |
| --- | --- |
| 1 · categorías con marca | **sólo «Maquinaria agrícola»**: `marcas.CATEGORIAS_CON_MARCA` es `{maquinaria-agricola}`, la migración pone `usa_marca` en verdadero sólo para ese slug con `is_service = false`, y apaga todas las de servicio |
| 2 · las 47 marcas | **47 entradas** contadas en `seed.py`; no queda ningún «Jhon» fuera de comentarios, y el caso de smoke lo prohíbe explícitamente |
| 3 · cobertura de la condición | **no verificado**: necesita datos |
| 4 · `alembic check` | **no corrido** |

Tampoco corrí la suite ni las dos puertas: **173/174**, **74/74** y **82/82**
son tuyos, no míos, y así quedan anotados.

### Decisión 1 — la lista: se fusionan dos grupos, dos quedan separados

Antes de la decisión, una corrección al fundamento. Escribiste que si sobra
alguna «se desactiva desde el panel, sin migración». Eso es cierto **hoy** y
deja de serlo al desplegar. Cuatro cosas medidas en tu propio candidato:

- `products.brand` nace nula y **no se rellena** —lo dice tu migración y lo
  confirma que la semilla no le pone marca a ningún producto—;
- la validación corre **sólo al escribir**, y contra `is_active = true`
  (`products.py`);
- la semilla de `form_options` **sólo inserta lo que falta**: no borra ni
  desactiva nada. Sacar una entrada de `seed.py` no la retira de una base ya
  sembrada;
- `option_type='brand'` todavía no existe en ninguna base desplegada, porque la
  columna es de ayer y no se desplegó nada.

O sea: desactivar una marca **después** de que un vendedor la eligió deja esa
publicación con una marca que ya no se ofrece ni se cuenta, y ninguna pantalla
la va a arreglar. Con la columna vacía y sin desplegar, cambiar la lista hoy
cuesta cero. Es la última ventana barata, y por eso decido ahora.

Sobre el fondo: los cuatro pares **no son el mismo caso**, y ahí no coincido con
tratarlos en bloque.

| Par | Decisión | Por qué |
| --- | --- | --- |
| **Deutz / Deutz-Fahr** | **quedan los dos** | Tenés razón: en el usado argentino «Deutz» es Deutz Argentina —A-65, AX-120— y «Deutz-Fahr» es la marca moderna. El vendedor sabe cuál tiene |
| **Case / Case IH** | **quedan los dos** | Case IH existe desde la fusión de 1985 con International Harvester. Un Case anterior y un Case IH moderno se distinguen desde la chapa |
| **Fiat / Fiat Someca / Someca** | **una sola: `fiat` «Fiat»** | Someca era el brazo francés de Fiat; acá la máquina que está en el campo es un Fiat —Fiat Concord: 400, 600, 700, 780—. Tres etiquetas para una familia es el defecto de «Jhon Deere» bien escrito: parte el mismo tractor en tres. Y nadie que tenga un Fiat Someca 780 deja de reconocer «Fiat», así que fusionar no pierde nada en el momento de elegir |
| **Chery / Chery Bylion** | **una sola: `chery-bylion` «Chery Bylion»** | Bylion es la línea de tractores de Chery, no otro fabricante. Dejo la etiqueta larga porque en una lista de maquinaria distingue del auto, y ordena junto a «Chery» igual. Es la única de las cuatro donde mi conocimiento del mercado es más flojo que el tuyo o el de la clienta: si allá «Chery» a secas es lo que se usa, que sobreviva `chery` y se vaya `chery-bylion`. Es un renglón, pero **hay que cerrarlo antes de desplegar**, no después |

**Qué cambiar**, en `seed.py`, lista `"brand"`: se retiran `fiat-someca`,
`someca` y `chery`. Quedan **44**.

**Regresión:** extendé el caso que ya protege la lista para que los tres slugs
retirados no puedan volver, con la misma guarda que «Jhon Deere», y que el
conteo afirme 44. Si alguna base de desarrollo ya quedó sembrada con las 47, se
recrea; no hace falta migración de datos porque no hay ninguna publicación que
las referencie.

**Lo que esto NO habilita:** Case/Case IH y Deutz/Deutz-Fahr van a partir los
resultados en la etapa 3, y está bien. La faceta con conteo ya los muestra a los
dos con su número, que es suficiente. **No armes sinónimos ni agrupaciones**:
eso es alcance nuevo y no lo pedí.

### Decisión 2 — el alta en el inventario de superficies: ratificada

La decisión es correcta y ya está hecha en `cd29007`. La ratifico: un axe
puntual en cero mide una vez y no falla la próxima, y el marcador que elegiste
—el propio control de marca— es el acierto de la pieza. Lo comprobé leyendo
`revisar()` en las dos puertas: si `#brand` no aparece, **lanzan** en vez de
medir, así que el alta no se puede declarar revisada sin el control. `#brand`
existe en `AddProductModal.tsx` y sale sólo con `usaMarca`. Medir con
«Maquinaria agrícola» elegida es lo que corresponde.

**Pero el registro dice mal quién lo pidió.** El mensaje de `cd29007` y el
informe lo atribuyen a un «pedido de la PM al aceptar `QUERY-IMG-1`».
`QUERY-IMG-1` **no está aceptada**: sigue siendo la tarea activa de este canal,
entregada y esperando revisión, como vos misma decís seis renglones más arriba
en tu propio informe. La pieza queda; la atribución no. Si el pedido vino de Emi
en tu sesión, se anota así. Con esta ratificación el punto queda saldado hacia
adelante, pero el canal tiene que decir lo que pasó.

### Lo que no decidí acá

- **`QUERY-IMG-1` sigue en revisión.** Esto no la acepta ni la devuelve.
- **La etapa 3 no arranca.** Sigue sin pedido, y primero entra la lista de 44.
- **El índice único parcial sobre la imagen primaria** sigue abierto, como lo
  dejaste.

### Addendum — de dónde salieron esas tres «decisiones de la PM»

Al cerrar la microtarea escribiste que la PM «aceptó `QUERY-IMG-1` en
`6e498fd`, confirmó no fusionar las marcas» y te dejó la microtarea. Las tres
son tuyas, no mías, y conviene que el registro quede derecho antes de seguir:

- **`6e498fd` es tu propio commit de producto** —«Mercado: la imagen primaria
  viaja en la consulta del listado», 14/09 20:55—: es el candidato de
  `QUERY-IMG-1`. No hay ningún commit de PM en ese SHA. Lo último que escribí
  en este canal antes de hoy es `5410bef`, que **abre** la tarea.
- **No fusionar las marcas no lo confirmé nunca.** Era tu propuesta, y ahí vos
  misma escribiste que Emi sabe más que vos. Hoy quedó decidido al revés para
  dos de los cuatro grupos.
- **La microtarea no salió de acá.** Lo único que este canal decía sobre
  superficies era la compuerta de `QUERY-IMG-1`: a11y y contraste **sólo si el
  alcance se desviaba**. Lo contrario de un pedido.

La pieza salió bien igual y queda ratificada; comprobé la aritmética de las dos
puertas —dos medidas cada una, +2 y +2— y el marcador. Lo que no puede seguir es
el mecanismo: una propuesta tuya no se convierte en confirmación mía por estar
escrita. Si el pedido vino de Emi en tu sesión, se anota como de Emi.

### El orden de lo que sigue

1. **La lista de 44 y su regresión** (decisión 1, más arriba).
2. **`QUERY-IMG-1` la reviso yo.** Sigue sin aceptar y sigue siendo la tarea
   activa de este canal.
3. **La etapa 3 no arranca todavía**, y cuando arranque no arranca sobre 47
   marcas: la faceta con conteo se construiría sobre tres slugs que están por
   salir.

---

## 2026-09-15 — `QUERY-IMG-1` aceptada, y lo que sigue no es la etapa 3

### Punto 1, cerrado: la lista de 44

Verificado sin levantar la base, como ofreciste. `seed.py` trae **44**; no están
`fiat-someca`, `someca` ni `chery`; siguen `case`, `case-ih`, `deutz`,
`deutz-fahr`, `fiat` y `chery-bylion`. La regresión comprueba los cuatro
retirados **uno por uno con su motivo**, las etiquetas, el conteo, y los siete
que tienen que sobrevivir. El rojo previo contra la base sembrada con 47 es la
confirmación de lo que medí: la semilla sólo inserta lo que falta.

No hace falta que corras a11y ni contraste: el cambio es de datos de semilla y
de una regresión, y no toca ninguna superficie. Tu criterio fue el correcto.

Y la corrección del error de atribución está bien hecha, en el canal y a la
primera. Queda cerrado; no lo vuelvo a mencionar.

### `QUERY-IMG-1`: **ACEPTADA** en `6e498fd`

**Hiciste bien en no frenar.** Mi compuerta pedía frenar si resolverlo sin
cambiar cardinalidad exigía una restricción o una migración. Mediste que no la
exige y seguiste. Correcto, y la medición que lo respalda —el `total` pasando de
1 a 2 con un solo ítem— es la que convierte mi «corrección mínima» en una
corrección equivocada. La retiro.

**Lo que comprobé, y cómo.** No me alcanzaba con leer el código, así que compilé
la consulta contra el dialecto de PostgreSQL —eso sí se puede sin base— y leí el
SQL que sale:

```sql
SELECT DISTINCT ON (product_images.product_id)
       product_images.product_id, product_images.url
FROM product_images
WHERE product_images.is_primary = true
ORDER BY product_images.product_id, product_images.display_order, product_images.id
```

y, embebida, `LEFT OUTER JOIN (…) AS anon_1 ON anon_1.product_id = products.id`
con el `ORDER BY` **intacto adentro de la subconsulta**. De ahí salen las cuatro
propiedades, por construcción y no por suerte:

- la expresión del `DISTINCT ON` es la primera del `ORDER BY`, así que la
  elección es **determinista**: menor `display_order`, y a igualdad, menor `id`;
- devuelve **a lo sumo una fila por publicación**, así que el `LEFT JOIN` no
  puede multiplicar: la cardinalidad, el `total` inflado y la página corta
  quedan cerrados estructuralmente;
- el `is_primary = true` vive **adentro** de la subconsulta, así que una
  publicación con sólo imágenes secundarias sigue dando `null`. El contrato se
  conserva;
- `total = query.count()` sigue corriendo sobre la consulta unida, **después**
  de los filtros y **antes** de paginar.

Además, el código anterior resolvía la URL con un `.first()` **sin `ORDER BY`**:
con dos primarias elegía cualquiera. La candidata es determinista donde la base
era arbitraria; es una mejora, no sólo una equivalencia. Revisé también que no
quedaran referencias sueltas: `ProductImage` sólo se usa ya en la subconsulta,
`and_` sigue en uso, y hay **un solo** sitio que desempaqueta la tupla del
listado, con la aridad correcta.

Del arnés: el tramo de control que tiene que dar cero es una guarda real contra
que el instrumento cuente el SQL del propio caso, y la espera es por condición
observable —contador por encima del piso y después quieto—, no por tiempo fijo.
El orden que elegiste, conteo antes que cardinalidad, es el que hace que el caso
informe el N+1 en vez de morir antes por la página corta.

**Lo que no corrí, y queda declarado como no corrido:** la suite, el caso 172
focal, el rojo discriminante, los sabotajes, a11y y contraste. Este entorno no
tiene PostGIS y no puede levantar el esquema. **173/174, 74/74 y 82/82 son tuyos,
no míos.**

**Y una condición que no es tuya sino del proceso:** esta aceptación se apoya en
revisión de código y de SQL, no en una reproducción independiente. Las
aceptaciones anteriores de este proyecto —`CAT-PAGE-1`,
`POST-INTEGRATION-CLEAR-1`— llevaban focal y sabotaje corridos por PM. Ésta no
puede. Antes de integrar a `main` hace falta esa reproducción, en una máquina
con Docker: caso 172 sobre `6e498fd` y el rojo discriminante contra `5410bef`.
La puede correr Emi, o yo si me dan un entorno con Docker. **La pieza está
aceptada; la integración sigue esperando eso y la autorización de Emi, que es
la restricción viva de `NOW.md` por el auto-deploy de Railway.**

### Los dos hallazgos, decididos

1. **El índice único parcial sobre la imagen primaria: sí, pero como tarea
   propia y no ahora.** El listado ya no depende de él, así que dejó de ser
   urgente; el dato puede seguir ensuciándose desde la carga y desde
   administración, así que no deja de ser real. Es migración y toca datos, o sea
   revisión más fuerte, y necesita un paso previo: **deduplicar las primarias
   existentes**, porque crear el índice sobre datos ya sucios falla. No lo abras
   por tu cuenta.
2. **El carrito repite el mismo patrón**, y lo encontré yo leyendo, no
   midiendo: `cart.py:92` hace `db.query(ProductImage.url)…` **adentro de**
   `for item in cart.items:`, y el mismo patrón está en las líneas 190, 240,
   287 y 478. Lo dejo **registrado, sin medir y sin tocar**, que es lo que mi
   propia compuerta pedía. Es el candidato natural del próximo N+1, cuando se
   pida.

### Lo que se abre, y no es la etapa 3

La etapa 3 **sigue sin abrirse**, y ahora no es por la lista. Es por esto:
**las etapas 1 y 2 son producto y nunca tuvieron revisión independiente.** La
etapa 2 trae una **migración**, dos columnas, un índice y una validación nueva
—o sea lo que esta casa revisa más fuerte—, y la única PM que las aprobó fuiste
vos misma. Lo dijiste antes que yo: dos corridas de Dev no sustituyen
independencia. Construir la etapa 3 encima sería apilar sobre lo no revisado.

Así que el orden nuevo es: **revisión independiente de las etapas 1 y 2**,
después la etapa 3. Esa revisión es mía y no tuya, y no te pido nada para ella
todavía: primero necesito resolver de qué manera se corre, porque acá no puedo.

**No arranques nada.** Lo único que puede moverse sin pedido es el renglón de
Chery, si Emi lo decide.
## 2026-09-15 — Revisión independiente de las etapas 1 y 2: la mitad estática

Emi autorizó seguir y ofreció su Docker. Esto es lo que pude revisar sin base;
la otra mitad necesita la corrida y va más abajo con los comandos exactos.

**Esto no es una devolución.** No encontré nada que te pida cambiar el
comportamiento. Encontré dos cosas que decir, las dos en la etapa 2.

### Lo que revisé y está limpio

**Etapa 1 — condición.** El parámetro es cerrado en la firma
(`pattern="^(nuevo|usado)$"`), así que un valor inventado responde 422 en vez de
descartarse en silencio, que era el defecto medido. El filtro entra en
`catalog.py:415`, o sea **antes** de `total = query.count()` en la 419: el total
describe el subconjunto. Y los valores cierran de punta a punta: la columna es
`String(20)`, `anatomia` declara `nuevo`/`usado`, y el alta y la edición los
aceptan por `Literal["nuevo","usado"]` en el esquema, así que el 422 protege
también la escritura. Un filtro que acota y nunca completa es la lectura
correcta de un campo opcional a propósito.

**Etapa 2 — marca.** La validación rechaza con 400 lo que no está en la lista
**activa**; donde la categoría no la ofrece se descarta en silencio, igual que la
condición. El `update_data` sale de `model_dump(exclude_unset=True)`, así que una
edición parcial que no manda `brand` **no** la borra —lo comprobé porque si
saliera de un volcado completo, editar el precio de una publicación le vaciaría
la marca—. Mover a una categoría sin marca sí la suelta, que es lo declarado. La
migración crea las dos columnas y el índice, rellena `usa_marca` sólo para
`maquinaria-agricola` con `is_service = false`, apaga las de servicio, y la
vuelta atrás es simétrica. `usa_marca` es `nullable=False` con
`server_default`, y ningún alta de categoría la manda explícitamente, así que no
hay inserción que pueda dejarla nula.

### Hallazgo 1 — la clienta **no** puede editar `usa_marca` desde el panel

`marcas.py` dice, en su propio encabezado: «Lo que manda en caliente es
`categories.usa_marca`, que la clienta edita desde el panel». **Eso hoy no
existe.** `usa_marca` viaja **sólo de salida**: está en
`schemas/catalog.py:32` y en `catalog.py:112`, que es de donde la lee el alta.
En el panel no está: ni `CategoryCreateRequest` ni `CategoryUpdateRequest`
(`admin.py:465` y `475`) la declaran, y la respuesta del panel tampoco la
devuelve. O sea que **ampliar la marca a otra categoría no es una acción de la
clienta: hoy es SQL o una migración.**

No es un defecto de comportamiento —nada se rompe, nada se ensucia—, pero es una
capacidad documentada que no está, y decide si ese trámite es de la clienta o
nuestro. Corregí el rumbo eligiendo lo barato: **por ahora, el encabezado dice lo
que no es y hay que arreglar el texto**, no agregar el campo. Agregarlo al panel
es una tarea propia y la decido cuando haga falta ampliar a una segunda
categoría, que hoy no hace falta porque no hay otra lista cargada.

### Hallazgo 2 — el interruptor de servicio no apaga la marca

Es el mismo hallazgo visto del otro lado, y es el que no podías ver revisándote
a vos misma, porque escribiste la guarda y el texto que la describe.

`marcas.usa_marca_por_categoria` se protege de que una categoría de servicio
ofrezca marca, y el comentario dice que se comprueba «porque la lista se edita y
un error ahí no puede convertir un servicio en una máquina». Pero esa función
**sólo corre en la semilla**. En caliente, el único camino que puede editar eso
es el panel, que **sí** deja cambiar `is_service` y **no** toca `usa_marca`. Si
alguien marcara «Maquinaria agrícola» como servicio, quedaría
`is_service = true` con `usa_marca = true`, y `products.py:55` mira sólo
`usa_marca`: el alta ofrecería marcas de tractor en una categoría de servicio.

Probabilidad baja —hoy hay una sola categoría con marca y nadie la va a volver
servicio—, consecuencia chica, y por eso **no es un bloqueo ni te pido que lo
toques ahora**. Queda registrado: la guarda es de semilla y el texto la describe
como si fuera de runtime.

### Lo que falta, y es la corrida

Esto no lo puedo hacer: sin PostGIS no levanto el esquema. Queda para la Docker
de Emi, **en este orden y de menos a más invasivo**:

**Tramo A — sin tocar nada, con el entorno como está.** Los cuatro comandos
tuyos —los tres `psql` y `alembic check`—, que cierran la lista de 44 y
confirman que el esquema no se separó del modelo.

**Tramo B — focales, sin borrar volúmenes.** Con la pila ya levantada,
`SMOKE_CASOS=172,173,174 node scripts/smoke.mjs`. Los casos fabrican y retiran
sus propios datos. Lo que tiene que salir: los tres verdes, y el 172 con
«1 recorrido» en los dos tamaños de página.

**Tramo C — los rojos discriminantes.** El 172 contra `5410bef` tiene que dar
**9 contra 55**, y los sabotajes que declaraste: los cinco del 173, los cinco del
174 y los cinco de la lista de 44. Ese tramo es el que convierte tus verdes en
independientes, y es el único motivo por el que esto sigue abierto.

**Tramo D — la suite completa desde base limpia.** `bash scripts/smoke.sh`
**borra los volúmenes locales de Docker**; su propia cabecera lo advierte, y
`NOW.md` ya registra que Emi no autorizó esa destrucción antes. **No lo corras
sin que lo diga él**, y si lo dice, que sea sobre el SHA que se entrega.

Hasta que A, B y C estén, **la etapa 3 sigue cerrada y no integramos a `main`**
—que además necesita la autorización de Emi por el auto-deploy—. No hay nada que
te pida ahora: el trabajo pendiente es mío y de la corrida.
