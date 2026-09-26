# Reproducción PM — PROD-LISTS-1

Fecha: 2026-09-26. Base `e2e3733`, más el commit PM `4c483e1` integrado en
`61cb354`.

- Migración `01ff14043124`: `2b2a0c3`.
- Caso 197 y negativos: `2cac546`.
- Filtro de marca completo: `996ffb2`.
- Caso 198 y su negativo: `7f045a6`.
- Informe Dev: `cdda2d9`.

`main` está en `792d709`. **Aceptada en rama**, sin integración ni
despliegue.

## El defecto

Emi lo vio en el sitio publicado el 25/09: en Maquinaria agrícola, «Marca»
ofrecía sólo «Sin declarar».

- Las 44 marcas las cargaba sólo la siembra, y la siembra no corre en
  producción.
- La migración de la marca (`e4a72c9b1f35`) creaba la columna, pero no
  cargaba la lista.
- Las aceptaciones de PM de la marca no preguntaron cómo llegaba la lista a
  producción. La corrección de método está en `NOW.md`.

## Qué cambia

- **Migración `01ff14043124`.** Sólo carga datos, sin tocar el esquema, y
  es idempotente.
  - Inserta las 44 marcas que falten, por `(option_type, value)`.
  - Inserta las 4028 localidades de Georef que falten, por su id.
  - No toca lo que ya existe.
  - La vuelta atrás no hace nada, a propósito.
- **Filtro de marca** (decisión de Emi, 25/09). Con una categoría que usa
  marca elegida, ofrece las 44 marcas activas, cada una con su cantidad,
  también las que están en cero. Sin esa categoría sigue la regla del caso
  175.
- **Inventario** de lo que trae la siembra y cómo llega a producción: en el
  informe de la Dev (`PARA-PM.md`, `cdda2d9`).

## Resultados PM

Base PostGIS Docker recién creada, API nativa, frontend de desarrollo y
configuración local inventada.

| Verificación | Resultado |
|---|---|
| Casos 175, 197 y 198 | **3/3** |
| Negativos de la Dev: sin marcas, sin localidades, pisa el panel, oculta las cero | **cuatro rojos esperados**; «la migración y el catálogo después: como estaban» |
| Negativo PM 1: lista completa aunque no haya categoría elegida | **rojo** en el 198: «API: sin categoría la lista ofrece marcas en cero» |
| Negativo PM 2: la migración carga las marcas inactivas | **rojo** en el 197: «faltan 44 marcas […#0:true], sobran 44 […#0:false]» |
| 197 y 198 después de restaurar | **2/2** |
| **Prueba PM de producción.** Mismos archivos que copia `Dockerfile.railway`, con `ENV=production`, sobre una copia de base como la publicada: categorías, 0 marcas, 13 localidades y 30 publicaciones, en `c8e41f2a7d90` | la migración corre; queda en 44 marcas, iguales a las de la siembra, y 4028 localidades de 24 provincias; la huella de las publicaciones no cambia (`ef0d4074…`) |
| La misma migración corrida dos veces | la segunda no cambia nada: 44 marcas, 4028 localidades, la misma huella |
| Suite completa desde base recién creada | **197/198**; sólo cae el **169**, de entorno; el 131 y el 191 pasan |
| a11y `--todas` / contraste / auditoría móvil | **78/78**, **86/86**, **12/12** sin desbordes |
| `guia-admin.mjs` | los 26 pasos coinciden en escritorio y en celular |
| Build, tipos, lint, `compileall`, `alembic check`, diff-check con `cr-at-eol` | verdes |

**Límite de la prueba de producción.** La imagen de `Dockerfile.railway` no
se pudo construir en el entorno de PM, porque `pip` no llega a PyPI desde la
construcción. PM no forzó la red. En su lugar reprodujo el contenido de la
imagen:

- copió `alembic.ini`, `alembic/` y `app/`, sin `.env*`, `__pycache__` ni
  `uploads`, como pide su `.dockerignore`;
- `app/data/georef_localidades.csv` está adentro;
- corrió con las dependencias del entorno local.

**Método.** El reinicio de la API de PM dejaba abierta la salida de quien
lo llamaba, y eso colgó una vez el script de negativos. PM lo corrigió en su
propio script. Los cuatro negativos terminaron y dejaron el árbol limpio.

## Decisiones PM

- **Las categorías y los subrubros no entran en la migración.** Se acepta la
  discrepancia de la Dev: producción ya los tiene, y el panel cambia el
  nombre corto al renombrar. Una carga de «las que faltan» duplicaría una
  categoría renombrada. Para una base de producción nueva, la carga es
  explícita y está documentada en `RAILWAY.md`.
- **Localidades en la migración:** se aceptan. El archivo de Georef no
  cambia desde el 22/08, así que si producción ya las tiene, los ids
  coinciden y no se duplica nada.
- **P3 sin tarea:** en producción, las listas del panel (unidades, tipo de
  cobro, disponibilidad y tiempo de respuesta) salen vacías en
  Configuración. El alta usa sus propios valores y no se rompe nada.

No se tocó `main`, Railway ni datos reales.
