# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## ADMIN-ACTIONS-1 — acciones que se entienden, guardan y no rompen lo publicado

Hecho. Producto/regresión e informe en commits separados. **No desplegué.**

- Producto y regresión: `edf3cb5` — «ADMIN-ACTIONS-1: acciones que se entienden,
  guardan y no rompen lo publicado»
- Regresión nueva: caso **144**. La suite pasa a **144 casos**.

---

### 1. El rojo, contra `a038b56`

En la pantalla, el caso 144:

```
[FAIL] 144 … — en la categoria: 2 de 3 acciones sin nombre que se entienda:
  [{"i":1,"nombre":"","texto":""},{"i":2,"nombre":"","texto":""}]
```

Dos de las tres acciones de una categoría no tenían **ni texto ni nombre
accesible**: para quien usa un lector de pantalla no existían, y para quien ve
la pantalla eran dos rectángulos vacíos.

Y en la API y en la base, medido antes de tocar nada:

```
PATCH /admin/categories/{id}      -> HTTP 405 Method Not Allowed
PUT   /admin/categories/{id}      -> HTTP 200
PATCH /admin/form-options/{id}    -> HTTP 405 Method Not Allowed
PUT   /admin/form-options/{id}    -> HTTP 200

cambiar el valor interno «kg»     -> HTTP 200; en la base quedó «kg_cambiado»
                                     y 4 publicaciones seguían diciendo «kg»
dar vuelta «Maquinaria agrícola»  -> HTTP 200 con 10 publicaciones asociadas;
   (Producto -> Servicio)            en la base is_service = t
borrar la subcategoría «Semillas  -> HTTP 200; la subcategoría desapareció y
   y plántulas» (2 publicaciones)     las dos publicaciones quedaron así:
```

```
antes:  Semillas de Maíz DK Premium | <subcategoría> | ACTIVE
        Semillas de Soja RR Intacta | <subcategoría> | ACTIVE
después: Semillas de Maíz DK Premium | NULL | ACTIVE
         Semillas de Soja RR Intacta | NULL | ACTIVE
```

Ese último es el que más me preocupó: **no falló nada**. La relación deja
`subcategory_id` en NULL y el vendedor pierde, sin enterarse, la clasificación
que había declarado. No hay error, no hay aviso y no hay vuelta atrás.

### 2. Después

```
PATCH  ->  la pantalla ya no lo usa; editar viaja por PUT y persiste
valor interno distinto        -> HTTP 409, la base sigue en «kg»
tipo de categoría con publicaciones -> HTTP 409, is_service intacto
borrar subcategoría referenciada    -> HTTP 409, la subcategoría sigue y las
                                       publicaciones conservan la suya
```

Los tres rechazos dicen cuántas publicaciones lo impiden y qué hacer. Por
ejemplo:

```
No se puede eliminar la subcategoría 'Agroquímicos': 2 publicación(es) la
declaran. Cambialas de subcategoría antes de eliminarla, o desactivá la
subcategoría para que no se ofrezca en el alta.
```

Y las acciones, ahora, dicen qué hacen y sobre qué:

```
antes                      después (texto visible + nombre accesible)
« » (vacío)                Editar        · «Editar la categoría X»
« » (vacío)                Eliminar      · «Eliminar la categoría X»
«Subcategorías»            Mostrar/Ocultar subcategorías · «… las de X»
«✕»                        Eliminar      · «Eliminar la subcategoría X»
«✓» / «✕»                  Agregar / Cancelar · «… en X»
«✓» / «✕» (opción)         Guardar / Cancelar · «… la opción X»
« » (vacío, opción)        Editar / Eliminar  · «… la opción X»
```

### 3. Lo que cambió

```
 backend/app/api/admin.py                        |  62 +++++-
 src/components/AdminPanel/AdminPanel.tsx        |  81 +++++--
 src/components/AdminPanel/AdminPanel.module.css |   8 +
 scripts/smoke.mjs                               | 278 ++++++++++++++++++++++++
```

Sin ruta nueva —se usa el `PUT` que ya existía—, sin migración, sin cascada,
sin dependencia, sin seed y sin reescribir un solo registro. Las ocho líneas de
CSS son la clase del aviso que explica por qué el tipo quedó bloqueado.

El valor interno de una opción se muestra pero no se edita, y el campo lo dice
al pasar el puntero. El selector de tipo de una categoría con publicaciones
queda deshabilitado con el porqué al lado, y el servidor lo rechaza igual: la
pantalla es cortesía, la regla vive en la API.

### 4. Lo que el caso 144 comprueba que SIGUE funcionando

No alcanza con que nada se pueda romper: hay que poder trabajar.

```
crear una categoría                       sigue
editar descripción y guardar              persiste, y se ve al volver a entrar
crear una subcategoría                    sigue
eliminar una subcategoría sin referencias sigue
editar la etiqueta de una opción          persiste, y el valor interno no se toca
```

### 5. Puertas

```
base limpia + node scripts/smoke.mjs            143/144   (131 rojo)
base limpia otra vez                            143/144   (131 rojo)
npm run build                                   ok
npm run lint                                    ok (--max-warnings 0)
node --check scripts/smoke.mjs                  ok
python -m compileall backend/app                ok
python -m pip check                             ok
git -c core.whitespace=cr-at-eol diff --check   limpio
npm run a11y -- --todas                         64/64 pantallas, 0 bloqueantes
npm run contraste                               TODO OK, cobertura completa
npm run hito                                    6/6 pasos
```

El **131** es el de siempre: acá no hay demonio de Docker. En tu Mac pasa. Los
casos 114 y 121 pasaron en las dos corridas.

### 6. Hashes

```
backend/app/api/admin.py                        fb4a0726254b5150
src/components/AdminPanel/AdminPanel.tsx        82c03d9bbb55e048
src/components/AdminPanel/AdminPanel.module.css 2514caf5b1cb8f01
scripts/smoke.mjs                               a4086d0dd9a99fe6
```

(SHA-256 truncado a 16, del árbol en el commit de producto.)

### 7. Decisiones que tomé y conviene que revises

1. **«El resto de la edición debe persistir» lo leí como capacidad, no como
   aplicación parcial.** Si el pedido intenta cambiar el tipo de una categoría
   con publicaciones, respondo 409 y **no aplico nada** de ese pedido. Aplicar
   el resto y descartar en silencio el tipo dejaría a quien administra creyendo
   que lo cambió. Editar todo lo demás —nombre, descripción, icono, orden,
   estado— sigue funcionando en cualquier pedido que no intente ese cambio, y
   el caso lo comprueba. Si querías lo otro, decímelo y lo doy vuelta.
2. **Los tres rechazos son 409 y no 400.** Es el mismo código con el que ya
   respondemos «no se puede en el estado actual» en carrito y checkout. El
   borrado de categoría con productos, que ya existía, sigue en 400: no lo
   toqué para no cambiar algo que no me pediste, así que por ahora conviven.
3. **La subcategoría cuenta TODAS las publicaciones, también las dadas de
   baja.** Una publicación eliminada sigue apuntando a esa fila y la clave
   foránea no declara qué hacer con ella; contarla es lo único que evita que el
   borrado la toque.

### 8. Riesgos residuales

1. **El `window.confirm` sigue ahí.** El caso lo acepta como lo haría una
   persona. Queda para `ADMIN-SAFETY-1`, como pediste.
2. **Los datos ya dañados no se reparan.** Si en alguna base alguien ya borró
   una subcategoría referenciada, esas publicaciones quedaron con
   `subcategory_id` en NULL y esto no las recupera: no reescribo registros.
   Se puede ver con una consulta si querés abrirlo.
3. **La opción de formulario se puede eliminar aunque haya publicaciones que
   usen su valor.** No lo cerré: no estaba en el alcance y el efecto es otro
   —la publicación conserva el texto, lo que se pierde es la etiqueta legible—.
   Lo dejo anotado porque es de la misma familia.
4. **La lista de categorías no pagina**, y la de opciones tampoco. No lo abrí.

### 9. Frenos

No agregué rutas `PATCH` ni sostuve dos métodos para la misma mutación. No
creé confirmaciones nuevas. No abrí paginación, métricas, estados, navegación,
formularios de publicación, BOEDA, Mercado Pago ni la seguridad final. No
desplegué. `PRE_FIRMA.md` sigue fuera del versionado y lo confirmé antes de
empujar.

Freno acá y te pido revisión.
