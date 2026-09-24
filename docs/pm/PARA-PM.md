# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## LOCALITY-DEDUP-1 — entregada, para tu revisión

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `c6e0f4a` |
| candidato (padrón + selectores + caso 188 + negativos) | `34bab15` |
| no integrado, no desplegado | `main` sigue en `0bd7fbc` |

**Resultado.**

- Ningún selector de localidad ofrece dos veces lo mismo. Las 24 provincias
  ofrecen 3923 localidades de las 4028 del padrón: exactamente sin las 105
  entidades anidadas.
- Las homónimas llevan el departamento en el rótulo: «San Pedro (Capital)»,
  «San Pedro (Choya)», etc.
- Buenos Aires ofrece una sola «Mar del Plata», medido en el filtro del
  Mercado y en el alta.
- Una publicación guardada en la «Mar del Plata» anidada (`0635711003`):
  - aparece al filtrar por Mar del Plata (`06357110`);
  - su ficha dice «Mar del Plata, Buenos Aires»;
  - el editor la muestra en Mar del Plata, y editarle el precio conserva
    `0635711003`.
- **Sin migración ni datos tocados.** La regla sale del identificador y del
  nombre.

**Una corrección a tu premisa: son 51 pares homónimos, no 49.** Tu medición
de 154 pares y 105 anidadas es correcta. La cuenta del resto:

- 105 de los 154 pares tienen una entidad anidada, y 49 no.
- Pero 2 de esos 105 tienen además una homónima en otro departamento:
  «Malvinas Argentinas» en Buenos Aires y «San José» en Catamarca.
- Al sacar las anidadas quedan **51 pares repetidos (108 localidades)**,
  todos distinguibles por departamento. Ninguno comparte departamento.

El caso exige 51. Si en tus documentos queda 49, conviene corregirlo.

**Lo que decidís vos (no bloquea).** Filtrar por el identificador de una
anidada, que sólo puede llegar por un enlace viejo porque ningún selector lo
ofrece, ahora cuenta como su localidad y trae todo Mar del Plata. Antes traía
sólo lo guardado en ese identificador. **Recomiendo dejarlo así:** es el
mismo lugar, y es lo que el selector va a mostrar elegido. La alternativa es
filtrarlo tal cual; es una línea en `app/services/padron.py`.

## Para verificar, lo mínimo

```
SMOKE_CASOS=188 node scripts/smoke.mjs
  → [PASS] 188 … 24 provincias: 3923 localidades ofrecidas de las 4028 del
    padrón, sin las 105 anidadas; 51 nombres homónimos (108 localidades), cada
    una con su departamento; ningún rótulo repetido. en el filtro del Mercado
    y en el alta, Buenos Aires ofrece una «Mar del Plata» y Santiago del
    Estero San Pedro (Capital), San Pedro (Choya), San Pedro (Guasayán), San
    Pedro (Jiménez). la publicación guardada en 0635711003 aparece al filtrar
    por Mar del Plata (06357110), su ficha dice «Mar del Plata, Buenos Aires»,
    el editor la muestra en Mar del Plata y editar el precio conserva 0635711003

python3 scripts/sabotajes_locality_dedup_1.py codigo-de-la-base
  → [ROJO ESPERADO] [FAIL] 188 … 154 localidades se ofrecen repetidas sin nada
    que las distinga: «Mar del Plata» (Buenos Aires) aparece 2 veces;
    «Avellaneda» (Buenos Aires) aparece 2 veces; «Bahía Blanca» …
    src y backend despues: como estaban
```

**Antes de correrlos:**

- Los dos necesitan la API en 8000, el frontend de desarrollo en 5173 y la
  siembra demo, con la cuenta `vendedor@ejemplo.com`.
- La parte de lo ya guardado la cubre el propio 188: crea la publicación
  sobre `0635711003` por la API, que acepta cualquier id del padrón, y la
  retira al final.
- **El negativo toca el backend.** Reinicia la API con
  `./scripts/entorno_nativo.sh --reiniciar-api` antes y después. Si tu API
  no la levanta ese script, reiniciala vos después de cada negativo que
  toque `catalog.py`: `codigo-de-la-base` y `filtro-sin-anidadas`.
- El caso tarda unos 5 s.

## Causa y corrección

Georef lista algunas localidades dos veces: la localidad y, adentro, una
entidad con el mismo nombre. `/catalog/localities` devolvía las dos, y los
seis selectores las mostraban tal cual.

- **La regla.** Está en `backend/app/services/padron.py`, sin columna
  nueva. Una entidad anidada:
  - tiene diez dígitos;
  - sus ocho primeros son una localidad presente;
  - repite su nombre.

  Da exactamente las 105. Todas están a 2,3 km o menos de su localidad (96 a
  menos de 1 km), medido con PostGIS.
- **`/localities`.**
  - No las ofrece.
  - Agrega `label`: el nombre, con el departamento sólo si el nombre se
    repite en la provincia.
  - Agrega `nested_ids`: las anidadas que absorbe cada localidad.
  - Los campos anteriores no cambian.
- **El filtro `locality_id`** cubre la localidad y sus anidadas. La faceta
  de marcas sale de la misma consulta.
- **Los selectores:** filtro del Mercado, alta y edición de publicación,
  registro, perfil de transportista y destino del checkout.
  - Muestran `label`.
  - Los tres que abren con un valor guardado (edición, perfil de
    transportista y filtro del Mercado) muestran la localidad que lo absorbe
    sin cambiar lo guardado; lo guardado cambia sólo si se elige otra.
- **El panel admin** no tiene selector de localidad, sólo de provincia. No
  había nada que cambiar.
- No cambió ningún `locality_id` guardado ni ninguna fila del padrón.

En la base demo no hay publicaciones ni transportistas sobre una anidada:
por eso el 188 crea la suya. En Railway no lo pude medir.

## Los negativos

`python3 scripts/sabotajes_locality_dedup_1.py` corre los cuatro:

| negativo | qué rompe | rojo |
|---|---|---|
| `codigo-de-la-base` | catálogo y los seis archivos de `src` de `c6e0f4a` | «Mar del Plata» (Buenos Aires) aparece 2 veces; 154 repetidas |
| `filtro-sin-anidadas` | el filtro vuelve a `==` | filtrar por Mar del Plata no trae lo guardado en `0635711003` |
| `editor-sin-absorber` | el editor busca lo guardado sólo entre las opciones | el editor muestra «Seleccionar...» para una publicación que tiene localidad |
| `rotulo-sin-departamento` | el filtro del Mercado muestra `name` | las cuatro «San Pedro» sin departamento |

El tercero muestra lo que habría pasado sin absorber: el editor decía
«Seleccionar...» aunque guardar conservaba la localidad.

## Lo que corrí

```
sobre 34bab15
  caso 188                                          1/1
  negativos, los cuatro                             rojo esperado, src y backend como estaban
sobre el mismo producto, antes del commit, base limpia
  61 casos (lista abajo)                            61/61
  a11y --todas                                      76/76, 0 violaciones
  contraste                                         84/84
build · lint · tsc --noEmit · py_compile · node --check · diff-check   verdes
```

**Los 61 casos y por qué:**

- 1–22: los prerequisitos de estado. Además, 9 y 10 publican eligiendo
  localidad y 22 registra un transportista.
- Localidad en la pantalla o en el filtro: 39, 43, 46, 52, 57, 58, 110, 121,
  133, 137, 151, 152, 154, 157, 164, 167, 176, 178.
- Transportista y fletes: 41, 42, 50, 51, 53, 54, 55, 56, 111–115, 132,
  140, 149, 156.
- PostGIS: 43 y 50.
- Filtros y paginación del Mercado sobre la misma consulta: 171, 175 y 186.
- El 188.

Los elegí buscando en el arnés las rutas de localidades, los selectores de
localidad, transportista y `ST_Distance`.

Los finales de línea de los ocho archivos quedaron como estaban: el diff con
y sin `--ignore-cr-at-eol` da lo mismo.

## Visto y no tocado

- **La ficha y la tarjeta** muestran «San Pedro, Santiago del Estero» sin
  departamento. Quien compra no distingue cuál de las cuatro es. Está fuera
  de alcance, porque la tarea es sobre los selectores.
- **La cuenta de 51 homónimas** está arriba; corrige la premisa.

No toqué `main`, Railway, datos ni el padrón, y no desplegué. Freno acá.
