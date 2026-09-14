# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## CAT-PAGE-1

| | |
| --- | --- |
| **Rama** | `claude/dev-role-repo-3l0kp3` |
| **SHA base** | `b2826d1` — el relevo PM que trajiste a la rama, con `c973c6f` adentro. No me basé en el `origin/main` viejo |
| **SHA candidato** | `a521631` |
| **SHA probado** | `a521631` — el informe es el commit siguiente y no toca producto ni pruebas |
| **Diff desde `b2826d1`** | `backend/app/api/catalog.py`, `src/App.tsx`, `src/hooks/useProductFilters.ts`, `src/utils/catalogService.ts`, `src/components/ProductGrid/ProductGrid.tsx` y su hoja, `scripts/smoke.mjs`, `scripts/a11y.mjs`, `scripts/contraste.mjs`, `scripts/lib/superficies.mjs` y este canal |
| **Estado** | en mi rama. No integré, no desplegué, no toqué Railway, datos remotos, pagos, imágenes, taxonomía ni seed. No empecé `QUERY-IMG-1` |

---

### La premisa, medida antes de tocar nada

Las tres que describís se sostienen, y la cuarta la encontré midiendo.

- `GET /api/catalog/products` ya devolvía `total`, `page`, `pages`, `has_next` y
  `has_prev`, y el Mercado pedía `page: 1, page_size: 100`.
- **`subcategory` y `min_rating` no existían en la API.** Medido: con
  `?subcategory=algo` inventado y con `?min_rating=5`, el total seguía siendo
  195 —el del catálogo entero—, porque FastAPI descarta lo que no declara. Los
  aplicaba el navegador sobre la página descargada.
- **`sort_by=rating` no existía**: daba 422. «Mejor calificados» ordenaba el
  arreglo que la grilla tenía en la mano.
- **Y el orden no tenía desempate.** Esto no estaba en la tarea y se mide solo:
  con `sort_by=price&sort_order=asc&page_size=24` sobre la base de entonces, la
  publicación `7044791a` era **el último ítem de la página 1 y el primero de la
  página 2**. Sin desempate determinista el corte de página cae adentro de un
  empate, y la misma fila sale dos veces mientras otra desaparece. Paginar sin
  eso es paginar mal.

### El caso 171, y los dos rojos

Fabrica **115 publicaciones** —más de cien, y no múltiplo de 24, así que la
última página queda corta— y las retira al terminar. Treinta comparten precio a
propósito: sin empate, el desempate no tiene qué desempatar. Treinta llevan
subcategoría y cuarenta y cinco son de un vendedor sin calificación. Las
reputaciones que necesita las fija en la base descartable y las devuelve como
estaban, así que mide lo mismo corrido solo que dentro de la suite.

Contra la base (`b2826d1`) da **dos rojos distintos**, cada uno con su defecto:

```
con toda la base:
   ordenando por precio, 1 publicación(es) aparecen en dos páginas:
   ["f901be0f-…"]. Sin desempate determinista el corte de página cae
   adentro del empate y la misma fila sale dos veces
con la API ya corregida y la pantalla vieja:
   la página dibujó 100 tarjetas y tiene que dibujar 24
```

Y si se arregla el tamaño de página pero no se agrega el control, el siguiente
rojo es «no hay paginador en el Mercado: con más de una página, la 101 no se
alcanza».

Lo que mide, en API y en pantalla:

- total 115 y páginas 5 exactas, con la última de 19 y `has_next`/`has_prev`
  correctos;
- recorriendo **todas** las páginas por precio ascendente no se repite ni se
  pierde ninguna de las 115;
- las cinco páginas recorridas con «Siguiente» muestran las 115 sin repetir, y
  **la número 101 está entre ellas**, en la posición 101;
- «Anterior» deshabilitado en la primera, «Siguiente» en la última, y el
  recorrido se hace **con el teclado** —foco y Enter—;
- la vista Lista, elegida antes de moverse, **sobrevive** el cambio de página;
- «Más relevantes» ya no está y las otras cuatro sí;
- cambiar el orden vuelve a la página 1 y ordena el **conjunto**: por «Menor
  precio» la primera página trae veinticuatro de las treinta más baratas, que
  con el orden por omisión estaban en la última página; por «Mejor calificados»
  sólo trae las del vendedor calificado;
- subcategoría y calificación mínima dan total y páginas del subconjunto —30 y
  2, 70 y 3— y al sacarlos vuelve el conjunto entero;
- `page` y `sort` están en la barra, y Atrás los restaura con sus filtros y sus
  mismas publicaciones;
- cambiar la búsqueda desde la página 4 vuelve a la 1;
- pedir `page=99` cae en la última página y la barra se corrige, sin afirmar un
  mercado vacío.

### Qué cambié

**En la API** (`backend/app/api/catalog.py`), cuatro cosas y ninguna más:

1. `subcategory` y `min_rating` como filtros, aplicados **antes** del conteo;
2. `sort_by=rating`, sobre `coalesce(rating_average, 0)` —sin el `coalesce`, un
   NULL se va al principio en `desc` y «mejor calificados» empezaría por quien
   no tiene ninguna—;
3. el desempate determinista: la columna pedida, después `created_at` y al final
   `products.id`, que es única por definición;
4. nada más. El contrato de la respuesta no cambió.

**En la pantalla**: el orden y la página dejan de vivir en la grilla y pasan a
`useProductFilters`, con los filtros, porque son parte de lo que se le pide al
servidor: viajan a la consulta, se escriben en la barra y vuelven cuando la
barra manda. La grilla dibuja lo que le dan y conserva **sólo** la vista
Cuadrícula/Lista, que no cambia qué se pide sino cómo se ve.

El filtrado del navegador se retiró entero: ya no descarta ninguna fila, así que
el total de la API describe siempre lo que se está mirando.

Volver a la página 1 se hace **envolviendo los setters** y no con un efecto que
vigile los filtros: ese efecto también correría cuando la barra manda —volver a
una entrada repone todos los filtros de golpe— y ahí la página que hay que
respetar es la de la entrada. Con un efecto, Atrás volvería siempre a la
primera página.

Sin routing nuevo, sin dependencias, sin caché paralela y sin una segunda fuente
de filtros.

### Una decisión que conviene que mires

`page` y `sort` se escriben con `replaceState`, igual que el resto de los
filtros del Mercado: la navegación tiene un solo dueño —`navegacion.ts`— y no le
agregué un segundo escritor del historial. Eso significa que **Atrás no
retrocede de página en página**: restaura la página, el orden y los filtros de
la entrada a la que vuelve, que es lo que mide el caso. Si querés que cada
página sea una entrada propia del historial, es otra decisión de producto y te
la dejo a vos: se hace, pero cambia cómo se sale del Mercado.

### Dos cosas que agregué y no me pediste

1. **Una superficie en las dos puertas de accesibilidad**, `catálogo:
   paginador`, cuyo marcador es el propio control. Si el catálogo dejara de
   tener más de una página, la puerta falla en vez de medir un catálogo sin
   paginador y declararlo revisado. Es como pediste el paginador en a11y y
   contraste, pero durable.
2. **El acote de una página que no existe** (`page=99`). Los filtros vuelven a
   la 1 solos, así que a una página de más se llega por la barra: un enlace
   compartido, o una entrada del historial cuyo conjunto encogió. Sin el acote
   la pantalla decía «No hay operaciones con estos filtros» habiendo
   publicaciones.

### Compuertas

| Puerta | Resultado |
| --- | --- |
| caso 171 contra base limpia | **verde** |
| rojo discriminante contra `b2826d1` | los dos de arriba |
| suite completa desde base limpia | **170/171**; el único rojo es el 131 |
| `npm run build` | verde |
| `npm run lint` · `npx tsc --noEmit` · `node --check` | verdes, 0 avisos |
| `git -c core.whitespace=cr-at-eol diff --check` | sin avisos |
| `npm run a11y -- --todas` | **72/72** pantallas, 0 bloqueantes, 0 menores |
| `npm run contraste` | **80/80** mediciones, 10 312 textos, **0 incumplimientos** |
| revisión visual 1440×900 y 390×844 | abajo |

### La revisión visual

En los dos anchos, con el seed (30 publicaciones, 2 páginas):

```
escritorio  «Anterior  Página 1 de 2  Siguiente» — Anterior apagado
            «Anterior  Página 2 de 2  Siguiente» — Siguiente apagado
celular     idéntico, centrado, sin desborde horizontal (0 px)
```

El paginador va centrado al pie de la grilla, con los mismos tokens que el del
panel de administración: botones de 44 px de alto, apagados —no invisibles— en
los extremos. La banda de arriba quedó con las cuatro opciones de orden y sin
«Más relevantes».

### Lo que no corrí

Nada de lo exigido quedó sin correr. El **131** es el rojo de entorno que vengo
informando en cada entrega: acá no hay demonio de Docker, el puente sólo traduce
`docker exec`, y el caso necesita `docker run --rm` con `alpine:3`. En tu Mac
corre. Es el mismo y único rojo de las corridas limpias anteriores.

**Un rojo que sí era mío y ya está arreglado**: el caso 155 elegía «relevance»
a mano, la opción que esta tarea manda retirar, y se cayó pidiendo algo que el
producto ya no ofrece. Ahora recorre los órdenes que el control realmente tiene,
así que mide lo mismo —que ordenar no cambia la vista elegida— y no envejece
cuando los órdenes cambien. Que sean los correctos lo mide el caso 171.

### Lo que queda anotado

`docs/pm/ux2c/DEUDA-PAGINACION.md` describe esta deuda como abierta. No lo toqué
—es un documento tuyo y la tarea no lo pedía—, pero con esta entrega queda
saldado lo que ese archivo pedía: la forma la decidiste vos, el backend ya no
hizo falta tocarlo salvo por los filtros y el orden que faltaban, la página es
dependencia del efecto, y la regresión que pedía existe.
