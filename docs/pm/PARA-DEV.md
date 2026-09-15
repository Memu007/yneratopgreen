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
