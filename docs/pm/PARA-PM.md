# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## FILTROS-DE-PUBLICACIONES-1: entrega

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `263198d`; después integré tus commits hasta `d6fa79b`, sólo `docs/pm` |
| código | `11c6069` · `353cf94` (corrige un congelamiento de la API que encontré en mi propio código, ver abajo) |
| casos, negativos y guías | `aa77846` · `896a418` (el 174) |
| rama publicada | `59d55c4` |
| no integrado, no desplegado | `main` sigue en `c21fb9d` |

**Resultado.**

- **Cada filtro del Mercado ofrece sólo lo que tiene publicaciones** en la
  búsqueda de ese momento, con su cantidad: la marca, el tipo, la potencia,
  la condición y el origen. Ninguna opción en cero. Con Tractores elegido, la
  marca ofrece sólo las marcas con tractores publicados.
- **La opción elegida se sigue viendo aunque quede en cero**, con «(0)», para
  poder sacarla.
- **«Otra marca», al publicar y en «Editar»,** en las categorías que usan
  marca. Se escribe el nombre, de 2 a 40 caracteres.
  - Si coincide con una que existe, sin importar mayúsculas, acentos,
    espacios, guiones ni puntos, se usa esa: «AGROMEC » es Agromec y
    «john deere» es John Deere.
  - Si es nueva, aparece sola en el filtro con su cantidad y en la ficha con
    el nombre como se escribió. La lista del alta la ofrece desde ahí, en su
    lugar alfabético.
- **«Tecnologizar» pasa a «Tecnificar»** en «Cómo funciona» de Inicio.

**Nada para decidir.** Ninguna de las dos consultas del «Frená y consultá» se
dio:

- el 175 sigue verde, y ningún filtro que depende de otro se rompe;
- las marcas que ya existían no cambian.

## Un defecto que encontré en mi código y corregí

Lo destapó un negativo. En `11c6069`, la API entera se congelaba con dos
altas a la vez:

1. una alta con «Otra marca» falla por otro dato, por ejemplo un tipo que no
   existe;
2. al mismo tiempo llega otra alta con «Otra marca».

Desde ahí no respondía nada, ni `/health`, hasta reiniciarla. Lo reproduje
sólo en local.

**La causa.** El candado que evita marcas repetidas vivía en la transacción
de la publicación. La alta rechazada lo dejaba tomado hasta cerrar su sesión.
La segunda lo esperaba sin soltar el proceso, así que esa sesión nunca se
cerraba. Las rutas son `async` y la base se llama sin `await`.

**La corrección, en `353cf94`:**

- la marca escrita se busca o se crea en una transacción propia y corta, que
  espera el candado a lo sumo 5 s;
- se resuelve después de validar todo lo demás, así que una alta rechazada no
  deja su marca.

El 238 lo mide al final, con cuatro altas a la vez, dos que fallan por el
tipo. Contra `11c6069` da rojo: «respondieron ["TimeoutError en 15003
ms","TimeoutError en 15002 ms","TimeoutError en 15004 ms","TimeoutError en
15005 ms"] y después /health respondió TimeoutError». Ahora responden 400,
400, 200 y 200, y `/health`, 200.

## Cómo quedó

**Las cantidades.** Cada lista se cuenta en el servidor con todos los filtros
puestos menos el suyo. Por eso elegir una marca no borra a las demás marcas.
Llegan en la misma respuesta que el listado, así que describen siempre la
búsqueda que se ve.

**Cuándo una elegida queda en cero.** Con los filtros de lista solos no puede
pasar: cada opción ofrecida tiene publicaciones de la marca elegida. Pasa con
lo que se escribe (la búsqueda, el año, el precio, el lugar) o con un enlace.
El 237 lo prueba con la búsqueda.

**El tipo se mide en Preparación del suelo.** Tractores no tiene tipos, sólo
potencia.

**«Otra marca» no necesita migración.** La marca nueva se guarda como una más
de la misma lista de las 44, con el nombre como se escribió. El filtro, la
ficha y el alta la tratan igual que a las cargadas. Las que ya existían no se
tocan.

**Una marca dada de baja** no vuelve desde un alta: escribirla da 400 «La
marca «X» no está disponible. Elegí otra.», igual que elegirla de la lista.

## Casos y negativos

**Caso 237, en escritorio y celular.** Lo esperado sale de la base contado
con SQL, no de la API, y se compara la lista entera, en orden y con los
números.

- **Con Tractores:** la marca, la potencia, la condición y el origen ofrecen
  exactamente lo que cuenta la base; ninguna opción en cero.
- **Eligiendo una marca** con un solo tractor, las demás listas cuentan sólo
  el suyo. La lista de marcas no cambia.
- **Con una búsqueda que deja afuera a su tractor,** la marca sigue elegida y
  a la vista con «(0)», con el vacío de siempre. Al sacarla, se va.
- **En Preparación del suelo,** el tipo hace lo mismo, y «Rastras (0)»
  elegida sigue a la vista.

**Caso 238, «Otra marca»:**

- **por el alta real:** «Agromec» crea una marca activa; el filtro de
  Tractores dice «Agromec (1)» en la API y en la pantalla, y la ficha «Marca:
  Agromec». Vacía, el alta no se manda y dice «Escribí el nombre de la marca,
  o elegí una de la lista.»;
- **«AGROMEC »** usa la misma y el filtro dice «Agromec (2)»; **«john
  deere»** guarda John Deere sin crear otra;
- **por «Editar»:** «Agrómec», con acento, pasa a Agromec y el filtro dice 3;
- **el alta siguiente** ofrece «Agromec», entre «Agrinar» y «Antonio
  Carraro»;
- **la API rechaza con 422 y su motivo:** 1 carácter y sólo espacios («al
  menos 2 caracteres»), 41 («hasta 40 caracteres»), «--» («letras o
  números»). Acepta 40. La lista y «Otra marca» a la vez dan 400;
- **un insumo** con «Otra marca» no crea marca ni la guarda;
- **ocho hilos a la vez** con la misma marca nueva dejan una fila;
- **el congelamiento** de la sección anterior.

Al terminar, borra las marcas que no existían al empezar y quedaron sin
publicaciones.

**Lo que cambió de otros casos,** porque la regla cambió a propósito:

- **173 y 195:** las opciones llevan su cantidad; el 195 compara el tipo con
  la base;
- **198:** decía «todas las marcas activas, también en cero», la regla del
  25/09. Ahora dice lo contrario, y mide además que una marca dada de baja no
  se ofrece aunque tenga publicaciones;
- **174 y 207:** la lista del alta y la de «Editar» terminan en «Otra marca»;
- **232:** «Tecnificar».

`python3 scripts/sabotajes_filtros_de_publicaciones_1.py` → los 14 dan
«[ROJO ESPERADO]» y «src y backend» quedan como estaban:

| sabotaje | rojo |
|---|---|
| `marca-con-ceros` (pedido): el filtro de marca vuelve a ofrecer todas, como el 25/09 | 237, 10 problemas: «escritorio, con Tractores: «marca» ofrece ["Todas las marcas","Agrinar (0)",…]», lo mismo en cada paso y en celular. Nada de la potencia, la condición, el origen ni el tipo |
| `marca-nueva-fuera` (pedido): la marca escrita entra dada de baja | 238, 12 problemas: «API: el filtro de Tractores ofrece «Agromec» como undefined y tenía que ser 1», «pantalla: el filtro no ofrece «Agromec (1)»» |
| `agromec-segunda` (pedido): se compara el nombre tal cual | 238, 11 problemas: ««AGROMEC » creó otra marca: [["agromec","Agromec","true"],["agromec-2","AGROMEC","true"]]», y el filtro dice 1 donde tenía que decir 2 |
| `listas-con-ceros`: la pantalla deja de quitar los ceros | 237, 28 problemas: «con «Zoomlion»: «potencia» ofrece [… "Estándar (60 a 120 HP) (0)","Alta (más de 120 HP) (0)"]», lo mismo con la condición y el origen. Nada de la marca |
| `elegida-se-cae`: la API no devuelve la marca elegida en cero | 237, 6 problemas: ««Zoomlion (0)» no está a la vista en marca», «marca no muestra elegida «zoomlion»» |
| `elegida-se-cae-pantalla`: la pantalla no muestra la elegida en cero | 237, 6 problemas: ««Rastras (0)» no está a la vista en tipo». Nada de la marca |
| `contar-con-su-filtro`: cada lista se cuenta con su propio filtro | 237, 6 problemas: con Zoomlion elegida, ««marca» ofrece ["Todas las marcas","Zoomlion (1)"]» y la base tiene cinco |
| `sin-candado` | 238, 1 problema: «ocho hilos a la vez con la misma marca nueva … dejaron 7 filas» |
| `marca-antes-de-validar`: la marca se guarda antes de validar el tipo | 238, 1 problema: «una alta rechazada por el tipo dejó creada su marca» |
| `detalle-sin-rotulo` | 238, 1 problema: «API: el detalle dice brand_label «null»» |
| `sin-minimo`: la API acepta 1 carácter | 238, 2 problemas: ««A» respondió 200 con [] y tenía que ser 422 con «La marca tiene que tener al menos 2 caracteres.»» |
| `alta-sin-otra-marca`: el alta no manda la marca escrita | 238, 13 problemas: «la publicación guardó la marca «(sin marca)»» |
| `alta-manda-vacia` | 238, 2 problemas: «con «Otra marca» vacía, el alta mandó la publicación igual» |
| `editar-sin-otra-marca` | 238, 2 problemas: ««Editar» con «Agrómec» guardó «john-deere»» |

**Dos cosas de la corrida:**

- **Los del 238 los corrí dos veces.** En la primera, cinco «no
  discriminaron» por marcas que dejaban corridas anteriores: la limpieza del
  caso comparaba en SQL, que no saca acentos, y no borraba «Agrómec» ni una
  «A» creada bajo sabotaje. La corregí para que borre toda marca nueva sin
  publicaciones, y en la segunda dieron rojo. `sin-minimo` esperaba un 201 y
  la API responde 200; corregí el texto esperado y lo repetí.
- **El candado sólo se mide con hilos.** La API corre en un proceso, y
  mientras resuelve una marca no atiende otra alta. Por eso cuatro altas por
  HTTP a la vez dan una sola marca aunque no haya candado; ocho hilos dan
  siete. El candado cuida el día en que haya dos procesos o dos réplicas.

**Las frases nuevas de la guía de uso caen con el comportamiento roto**, en
escritorio:

- `marca-con-ceros`: cae el paso 6, «#catalog-brand ofrece opciones sin
  publicaciones»;
- `alta-sin-otra-marca`: cae el paso 15;
- `editar-sin-otra-marca`: cae el paso 16, «con «Otra marca» la marca quedó
  «case»».

## Las guías

- **Guía de uso, paso 6:** los filtros ofrecen sólo lo que tiene
  publicaciones, con cuántas, y lo elegido en cero sigue a la vista. El
  programa lo prueba con «Máximo» 1.
- **Paso 15:** «Otra marca» y «Nombre de la marca», de 2 a 40, y «john deere»
  usa John Deere. El programa publica así el tractor de la guía.
- **Paso 16:** «Otra marca» en «Editar»; el programa escribe «case ih».
- **«Si es nueva, se suma a la lista y al filtro «Marca».»** queda en «Lo que
  el programa no comprueba»: una marca nueva no se puede sacar desde el sitio
  y quedaría en la lista para siempre. La comprueba el 238.
- **Guía del panel:** «Quien publica puede sumar una que no está en la lista,
  y desde el panel no se puede corregir, unir ni dar de baja.»

## Cómo verificarlo

Con el entorno arriba:

```bash
SMOKE_CASOS=237,238 node scripts/smoke.mjs
# → 2/2 pasaron; 0 fallaron

REINICIAR_API="<tu reinicio>" python3 scripts/sabotajes_filtros_de_publicaciones_1.py marca-con-ceros marca-nueva-fuera agromec-segunda
# → tres [ROJO ESPERADO] y «todos dieron el rojo esperado»
```

## Puertas

| puerta | resultado |
|---|---|
| suite completa desde base nueva, sobre `896a418` | **237/238**. Sólo cae el **131**, de entorno: «puente docker: sólo se traduce 'docker exec'» |
| la corrida anterior, sobre `aa77846` | 236/238: el 131 y el **174**, «el control ofrece 46 opciones y tienen que ser 45»: no contaba «Otra marca». Lo corregí en `896a418` y repetí la suite entera |
| tipos, lint, build | verdes: `npm run lint` sin avisos y `npm run build` con `tsc` |
| `compileall`, `node --check`, parseo de Python | verdes |
| `alembic check` | `No new upgrade operations detected.` (esta pieza no tiene migración) |
| diff-check con `cr-at-eol` sobre `263198d..59d55c4` | limpio; ninguna línea cambia sólo por el final |
| a11y `--todas` | 78 de 78 pantallas, «SIN VIOLACIONES BLOQUEANTES, COBERTURA COMPLETA» |
| contraste | «las 82 mediciones exigidas se hicieron», «TODO OK, COBERTURA COMPLETA» |
| auditoría móvil | 12 de 12 recorridos y 39 pantallas: 0 desbordes, 0 controles tapados, 0 errores de consola y 0 respuestas 4xx/5xx |
| `guia-admin.mjs` | «LA GUÍA Y EL PANEL COINCIDEN: 26 pasos en escritorio y celular» |
| `guia-usuario.mjs` | «LA GUÍA Y EL SITIO COINCIDEN: 23 pasos en escritorio y celular» |

**Líneas con CR por archivo, contra la base.** En los archivos mezclados,
cada línea agregada tiene el mismo final que su vecina:

| archivo | base | ahora |
|---|---|---|
| `catalog.py`, `schemas/products.py`, `api.ts` | todo CRLF | todo CRLF |
| `backend/app/api/products.py` | 910 de 912 | 931 de 933 |
| `backend/app/schemas/catalog.py` | 235 de 237 | 253 de 255 |
| `src/App.tsx` | 525 de 997 | 526 de 1009 |
| `AddProductModal.tsx` | 1266 de 1302 | 1295 de 1333 |
| `FilterSidebar.tsx` | 294 de 580 | 314 de 598 |
| `UserDashboard.tsx` | 4182 de 4511 | 4209 de 4538 |
| `catalogService.ts` | 352 de 429 | 381 de 463 |
| `scripts/smoke.mjs` | 4 | 4 (las mismas) |
| `marcas.py`, `HomePage.tsx`, `ProductDetailPage.tsx`, las dos guías, sus scripts y el script de negativos | 0 | 0 |

## Riesgos

- **Cualquiera que publica maquinaria puede crear una marca visible para
  todos**, con el nombre que quiera, de 2 a 40 caracteres. Desde el panel no
  se puede corregir ni dar de baja: es la pieza «Unir o corregir marcas»,
  fuera de alcance. Recomiendo hacerla antes del lanzamiento.
- **Una marca puede quedar en la lista del alta sin publicaciones**: si se
  crea desde «Editar» y después se cambia, o si la publicación falla al
  guardarse, después de validar todo. El filtro no la muestra, porque está en
  cero.
- **Un nombre escrito sólo con letras no latinas**, como 东风, se rechaza con
  «La marca tiene que tener letras o números.».
- **El listado hace cinco conteos más por pedido**, uno por lista. Medido en
  local con 229 publicaciones, 25 pedidos cada uno, mediana antes y después:
  - Mercado sin filtros: 30 → 42 ms;
  - Tractores: 21 → 28 ms;
  - Tractores con marca y potencia: 20 → 24 ms.
