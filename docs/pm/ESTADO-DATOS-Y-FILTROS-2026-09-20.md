# Estado de los datos y de los filtros — 2026-09-20

Escrito por Dev para PM, **fuera del ciclo de tareas**. No reemplaza ningún
informe: es el estado de dos cosas que la devolución de la clienta toca de
lleno y sobre las que conviene no volver a discutir de memoria.

Método: todo lo que sigue está medido sobre **fuentes versionadas del
repositorio** —el padrón CSV, el seed, los modelos, las migraciones y el
código de la API y de la interfaz—, no sobre una base local levantada para la
ocasión. Cualquiera puede repetir las cuentas con los comandos que van al pie.

---

## 1. La base de datos existe y está poblada desde el repositorio

- **19 modelos** en `backend/app/models/` y **17 migraciones** de Alembic.
  El esquema no se arma a mano: se migra.
- **PostGIS** está en uso de verdad, no de adorno: la columna `coordinates` de
  `localities` es `geography(Point, 4326)` y es lo que resuelve el radio de
  cobertura de los fletes.
- El **padrón de localidades** no lo inventamos: es una copia versionada de
  **Georef v2** en `backend/app/data/georef_localidades.csv`, con su SHA-256
  declarado en `backend/app/seed_localities.py` y verificado antes de sembrar.

```
padrón Georef v2 versionado      4.028 filas, 24 provincias
                                 3.098 «Localidad simple»
                                   678 «Entidad»
                                   252 «Componente de localidad compuesta»
catálogo del seed                12 categorías — 8 de bienes, 4 de servicios
                                 44 subcategorías (las 4 de servicios no tienen)
```

## 2. Las localidades repetidas: lo que vio la clienta, medido

Medido sobre el padrón: **154 pares `(nombre, provincia)` aparecen más de una
vez**, y suman **316 filas**. Pero no son todos el mismo problema.

| Caso | Pares | Qué es | Qué corresponde |
|---|---:|---|---|
| Homónimas en **departamentos distintos** | 49 | Lugares **distintos** que se llaman igual: «San Pedro» en cuatro departamentos de Santiago del Estero, «Malvinas Argentinas» en tres de Buenos Aires | **No se borran.** Falta mostrar el departamento para poder elegir |
| **Entidad anidada** dentro de su propia localidad | 105 | Georef lista la localidad **y** una entidad adentro con el mismo nombre: `06357110` «Mar del Plata» y `0635711003` «Mar del Plata». 96 de 105 están a menos de 1 km | **Estas sí sobran** en un selector |

Las 105 son exactamente las filas de categoría `Entidad` cuyo identificador
cuelga de una localidad ya presente **y** repiten su nombre. Filtrarlas es una
condición, no un trabajo de limpieza manual.

**Corrección 2026-09-24 (medida por Dev y PM en SQL):** después de sacar las
105 anidadas quedan **51** pares homónimos (108 localidades), no 49: dos de los
pares con anidada tienen además una homónima en otro departamento. Resuelto en
rama por `LOCALITY-DEDUP-1`.

**Traducción para la tarea futura**: sacar 105 filas del selector y agregar el
departamento al rótulo resuelve lo que la clienta vio. Los identificadores del
padrón se conservan: las publicaciones ya creadas apuntan a ellos.

## 3. Los filtros existen, del lado del servidor y del lado de la pantalla

**La API** (`GET /api/catalog/products`) filtra por:

```
search          texto en nombre y descripción
category        categoría
publication_type  producto / servicio
province        nombre canónico del padrón
locality_id     identificador del padrón
min_price / max_price
in_stock
seller_id
sort_by         created_at | price | sales | views      sort_order  asc | desc
page / page_size
```

**La barra lateral del Mercado** ofrece: Tipo, Categoría, Subcategoría,
Provincia, Localidad, Precio (mínimo y máximo), «sólo con stock» y calificación
mínima.

Y **los filtros viven en la URL**: se escriben en la barra de direcciones, así
que un resultado filtrado se puede compartir y volver atrás devuelve los
controles, no sólo la dirección. Eso lo sostienen casos de la suite —138, 139,
147, 167— y quedó revisado en `FILTER-INTENT-1`
(`REPRODUCCION-FILTER-INTENT-1-2026-09-11.md`).

## 4. Lo que los filtros todavía NO tienen, que es justo lo que pide la clienta

Hoy no existe ningún atributo por rubro. No hay **marca**, ni **modelo**, ni
**año**, ni **rango de potencia**, ni **condición** (nuevo/usado), ni **origen**
(agencia o dueño directo). La publicación se describe con categoría,
subcategoría, precio, stock, unidad y ubicación, y eso es todo lo que el filtro
puede cruzar.

Dos de esos campos —condición y origen— ya estaban anotados como **alcance
nuevo** en `TAXONOMIA-CLIENTE.md` desde julio, junto con las 48 marcas que la
clienta mandó. Lo que agrega ahora la devolución es el mecanismo: que esos
campos se carguen **en el alta** y que **alimenten el filtro**, de modo que
cuantos más datos declare quien publica, más probable sea que aparezca.

Es la pieza más grande que tiene por delante el módulo y no es sólo interfaz:
toca modelo, migración, alta, edición, API, barra lateral y suite. Va a PM
para dimensionarla, no la empieza Dev por su cuenta.

---

## Cómo repetir las cuentas

```bash
# padrón: filas, provincias y categorías
python3 - <<'PY'
import csv, collections
from pathlib import Path
f = list(csv.DictReader(Path('backend/app/data/georef_localidades.csv').open(encoding='utf-8')))
print(len(f), 'filas;', len({x['provincia_nombre'] for x in f}), 'provincias')
print(collections.Counter(x['categoria'] for x in f))
PY

# filtros que acepta la API
grep -n 'Query(' backend/app/api/catalog.py

# filtros que ofrece la pantalla
grep -n 'filterLabel' src/components/FilterSidebar/FilterSidebar.tsx
```
