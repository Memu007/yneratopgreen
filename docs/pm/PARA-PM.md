# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## PROD-LISTS-1: entregada en rama

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `e2e3733`, más tu `4c483e1` integrado en `61cb354` |
| código | `2b2a0c3`: la migración `01ff14043124`, más una nota en la siembra y en `RAILWAY.md` |
| arnés | `2cac546`: caso 197 y tres negativos |
| filtro de marca (tu agregado 4) | `996ffb2`: código; `7f045a6`: caso 198 y su negativo |
| no integrado, no desplegado | `main` sigue en `792d709` |
| parte 2 | sin empezar |

**Resultado.**

- **Qué trae la migración:** las 44 marcas y las 4028 localidades de Georef.
  Inserta sólo lo que falta y no pisa lo que se editó desde el panel.
- **Filtro de marca:** con Maquinaria agrícola elegida, ofrece las 44 marcas
  activas con su cantidad, también las que están en cero.
- **Casos 197 y 198:** en verde. Los cuatro negativos dan rojo, cada uno por
  su motivo.
- **Suite completa desde una base nueva:** «197/198 pasaron; 1 fallaron»: el 131, de entorno.
- **`alembic check`:** limpio en la base y en la copia del 197.

**Para decidir vos (no bloqueante).**

**Las categorías y los subrubros no entran en la migración,** aunque hacen
falta para publicar. Discrepo con «lo que el producto necesita para publicar
entra en la misma migración», por esto:

- **Producción ya los tiene.** Emi vio Maquinaria agrícola, y
  `c8e41f2a7d90` encontró por nombre corto a Preparación del suelo y a Riego
  por aspersión.
- **El panel cambia el nombre corto al renombrar** (`api/admin.py:687` para
  las categorías, `:851` para los subrubros). Si la clienta renombró una, una
  migración que inserte «las que faltan» la duplicaría en el Mercado.
- **El único caso sin categorías es una base de producción nueva.**
  Recomiendo cargarlas en ese momento con una carga explícita y no
  automática, cuando se decida el lanzamiento real. Lo dejé escrito en
  `RAILWAY.md`.

## La migración `01ff14043124`

Viene después de `c8e41f2a7d90`. No cambia el esquema: sólo carga datos.

- **Marcas:** inserta cada una que falte, por tipo de opción y valor. Salen
  de una copia congelada de la lista de la siembra, con el mismo orden, el
  mismo rótulo y activas. Si una ya existe, no la toca: una desactivada o
  renombrada desde el panel queda como estaba. Una borrada desde el panel
  vuelve, porque falta.
- **Localidades:** inserta cada una que falte, por su id de Georef. Salen de la
  copia versionada que usa `app.seed_localities`, con la misma comprobación
  de integridad (sha256). Las sumé porque la localidad es obligatoria para
  publicar (la API rechaza una que no existe). No pude confirmar si
  producción las tiene: si ya están, la migración no hace nada.
- **Bajada:** no hace nada, y es a propósito.
  - No se puede distinguir una fila que puso esta migración de una igual que
    puso la siembra o el panel.
  - Borrar una marca deja a las publicaciones que la declararon con un valor
    que la edición ya no acepta.
  - Una localidad en uso no se puede borrar.
  - La revisión anterior funciona igual con estas filas adentro.

## El filtro de marca (agregado 4)

- **Con una categoría que usa marca elegida** (hoy, Maquinaria agrícola), la
  API devuelve todas las marcas activas en el orden del alta, cada una con
  su cantidad, aunque sea cero. El Mercado ya dibujaba lo que llegaba, así
  que en el frontend sólo cambió el comentario.
- **Los conteos** siguen saliendo del servidor, con los demás filtros puestos
  y sin la marca, como la faceta de antes.
- **Sin categoría, o con una que no usa marca,** sigue la regla del 175:
  sólo las marcas que el conjunto tiene. Tu decisión habla de la categoría
  elegida, así que no la extendí. El 175 queda igual; sólo le anoté en el
  encabezado que su regla vale sin esa categoría.
- **Ninguna guía** menciona el filtro, así que no hubo que ajustar ninguna.

## Inventario: lo que trae la siembra y cómo llega a producción

| lo que carga la siembra | ¿lo trae una migración? | si falta en producción | cómo llega allá |
|---|---|---|---|
| 4028 localidades de Georef | **sí, desde ahora** (`01ff14043124`) | nadie puede publicar, y no hay provincias ni localidades para filtrar | la migración, o `python -m app.seed_localities` |
| 44 marcas | **sí, desde ahora** (`01ff14043124`) | la marca ofrece sólo «Sin declarar», y el filtro y la faceta quedan vacíos (lo que vio Emi) | la migración |
| 122 tipos en 33 subrubros | sí (`c8e41f2a7d90`) | no hay filtro de tipo | la migración; Emi lo vio llegar |
| qué categoría ofrece marca (`usa_marca`) | sí (`e4a72c9b1f35`) | Maquinaria no pide marca | la migración |
| la anatomía por omisión de cada categoría | sí (`a91c47e2b6d8`) | el alta no sabe qué datos pedir por omisión | la migración |
| 12 categorías y 44 subrubros | **no** | nadie puede publicar y el Mercado no tiene rubros | producción ya los tiene; una base nueva, ver arriba |
| unidades (7), tipo de cobro (4), disponibilidad (3) y tiempo de respuesta (4) | no | no se rompe nada: el alta trae su propia lista con los mismos valores y la API no los valida. Se ve «kg» en lugar de «Kilogramo», y en Configuración del panel esas listas salen vacías | no hace falta. Si se quieren los nombres completos, es otra migración |
| usuarios, cuenta de prueba, datos bancarios y publicaciones demo | no, y no tiene que haberla | nada | nunca: tienen contraseñas escritas en el repositorio |

**No pude mirar producción.** Intenté leer el catálogo público del backend
publicado (tres `GET` sin credenciales), pero la red de este entorno rechaza
`railway.app` por política de la organización. No la esquivé. Por eso las
localidades van en la migración igual: si ya están, no cambia nada.

## Caso 197

En una copia de la base que queda como producción: con categorías, sin marcas
y sólo con las localidades que alguna fila usa.

1. **Primera vez:** la migración deja las 44 marcas iguales a las de la
   siembra (valor, rótulo, orden y activa), y las 4028 localidades iguales,
   fila por fila, coordenadas incluidas.
2. **Segunda vez:** no duplica ni cambia nada.
3. **Con cambios del panel:** «pauny» desactivada, «case» renombrada y
   «kubota» borrada. La migración deja «pauny» desactivada y el rótulo de
   «case» sin tocar, y vuelve a traer «kubota».
4. **`alembic check`:** limpio.

```
[PASS] 197 Las marcas y las localidades llegan a producción con la migración, sin la siembra — sobre una copia con categorías, sin marcas y con 21 localidades en uso —como producción—, la migración deja las 44 marcas iguales a las de la siembra (valor, rótulo, orden y activa) y las 4028 localidades de Georef iguales, fila por fila; correrla otra vez no duplica ni cambia nada; una marca desactivada sigue desactivada, un rótulo cambiado no se pisa, y la que falta vuelve; `alembic check` no encuentra diferencias entre el modelo y el esquema. Todo en una copia de la base (7312 ms)
```

## Caso 198

- **En la API:**
  - las 44 marcas activas, en el orden del alta;
  - cada cantidad es el total que da el servidor al elegirla, también con
    «usado» puesto;
  - una marca dada de baja no se ofrece;
  - elegir una en cero da total 0, y la lista sigue entera;
  - sin categoría, o con una que no usa marca, no se ofrece ninguna en cero.
- **En la pantalla** (1440 y 390 px):
  - el filtro muestra «Todas las marcas» y las mismas 44 con su conteo;
  - elegir una en cero la escribe en la barra y muestra «No hay operaciones
    con estos filtros.», sin error.

```
[PASS] 198 Con una categoría que usa marca, el filtro ofrece todas las marcas activas, también las que están en cero — en «Maquinaria agrícola» la API ofrece las 44 marcas activas en el orden del alta, 42 en cero, y cada conteo es el total que da el servidor al elegirla, también con otro filtro puesto (2 con publicaciones usadas); una marca dada de baja no se ofrece; elegir una en cero da total 0 con la lista entera; sin categoría, o con una que no usa marca, no se ofrece ninguna en cero; en escritorio y en celular el filtro muestra «Todas las marcas» y las mismas marcas con su conteo, las en cero incluidas; elegir una en cero la escribe en la barra y muestra «No hay operaciones con estos filtros.», sin error (3095 ms)
```

## Negativos

`python3 scripts/sabotajes_prod_lists_1.py` rompe cada pieza y comprueba que
su caso falle por el motivo que corresponde.

- **Los tres de la migración** no reinician la API.
- **El del filtro** la reinicia. El comando se cambia con la variable
  `REINICIAR_API`, que es lo que pediste en tu P3.

| negativo | qué rompe | el caso dice |
|---|---|---|
| `sin-marcas` | la migración no carga las marcas | `[FAIL] 197 … tras subir: faltan 44 marcas […], sobran 0 [], 0 repetidas` |
| `sin-localidades` | la migración no carga las localidades | `[FAIL] 197 … las localidades no quedaron como las de la siembra: 4028 51a97e47… → 13 0e605765…` |
| `pisa-el-panel` | la migración reescribe las marcas que ya existen | `[FAIL] 197 … la migración reactivó «pauny», que el panel había desactivado (true)` |
| `oculta-las-cero` | el servidor ofrece sólo las marcas con publicaciones | `[FAIL] 198 … 6 problema(s)`: en la API «ofrece 2 marcas y hay 44 activas», y en las dos pantallas «el filtro ofrece 2 marcas y tenía que ofrecer 44» |

Los cuatro dieron `[ROJO ESPERADO]`, y el script cierra con «la migración y
el catálogo después: como estaban».

## Puertas

| puerta | resultado |
|---|---|
| suite completa desde base nueva, sobre `7f045a6` | «197/198 pasaron; 1 fallaron»: el 131, de entorno |
| `alembic check` en la base | `No new upgrade operations detected.` |
| `compileall` backend y alembic, `node --check`, `py_compile` | verdes |
| diff-check con `cr-at-eol` | limpio |
| tipos, lint, build | verdes (`built in 1.76s`) |
| a11y `--todas` | 78 de 78, sin violaciones bloqueantes |
| contraste | 86 de 86 |
| auditoría móvil | 12 de 12 recorridos, 39 pantallas: 0 desbordes, 0 recortes, 0 errores de consola, 0 respuestas 4xx/5xx |
| `guia-admin.mjs` | «LA GUÍA Y EL PANEL COINCIDEN: 26 pasos en escritorio y celular» |

## Para verificar, lo mínimo

```
./scripts/entorno_nativo.sh --recrear
SMOKE_CASOS=175,197,198 node scripts/smoke.mjs → 3/3 pasaron; 0 fallaron
python3 scripts/sabotajes_prod_lists_1.py      → cuatro [ROJO ESPERADO], «la migración y el catálogo después: como estaban» y «todos dieron el rojo esperado»
docker exec topgreen-api alembic check         → No new upgrade operations detected.
```

Advertencia del entorno: el 131 falla siempre acá, porque el puente de
Docker no traduce `docker run`.

Estos comandos los corrí tal cual y dieron eso.

No toqué `main`, Railway ni datos reales, y no desplegué.
