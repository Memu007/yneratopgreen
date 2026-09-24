# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Tarea activa — LOCALITY-DEDUP-1

**Corrección de la PM.** En el mensaje anterior te dejé sin tarea. Fue un
error: el MVP tiene huecos que no dependen de Emi. La aceptación de
`FILTER-COLLAPSE-FOCUS-1` sigue en pie (`REPRODUCCION-FILTER-COLLAPSE-FOCUS-1-2026-09-24.md`).

**Prioridad y problema.** El contrato exige buscar y publicar **por
ubicación** (3.1). La clienta vio localidades repetidas en los selectores
(#8 de `DEVOLUCION-CLIENTA-REVISION-01-2026-09-20.md`). Está medido en
`ESTADO-DATOS-Y-FILTROS-2026-09-20.md` §2, sobre 154 pares repetidos por
provincia:

- **105 sobran.** Son entidades anidadas dentro de su propia localidad, con
  el mismo nombre. Ejemplo: `06357110` y `0635711003`, las dos «Mar del
  Plata».
- **49 son homónimas legítimas.** Son lugares distintos en departamentos
  distintos y hoy no se pueden distinguir.

No depende de datos ni de decisiones de la clienta, y es barato.

**Alcance.**

- En todos los selectores de localidad dejan de aparecer las 105 entidades
  anidadas. Son los de filtros del Mercado, alta y edición de publicación,
  registro, perfil y transportista, destino del checkout y panel admin.
- Cuando un nombre se repite dentro de la provincia, el rótulo muestra el
  departamento para poder elegir.
- No se borra ninguna fila del padrón ni cambia ningún `locality_id`
  guardado.
- Lo ya guardado sobre una entidad anidada sigue funcionando:
  - la publicación muestra su localidad;
  - editarla sin tocar la ubicación no la cambia ni la pierde;
  - al filtrar por la localidad que la contiene, **aparece**.

**Fuera de alcance.** Atributos por rubro (#9), cambios de copy, Inicio,
Servicios, la búsqueda por radio del transportista, reimportar el padrón,
integración y despliegue. No avances a otra pieza.

**Aceptación verificable.**

1. Caso nuevo 188, por API, en todas las provincias:
   - ningún par (nombre, provincia) repetido sin algo visible que lo
     distinga;
   - el total baja exactamente en las 105 entidades medidas;
   - las 49 homónimas quedan distinguibles por departamento.
2. En navegador, en al menos el filtro del Mercado y el alta de publicación:
   - Buenos Aires ofrece una sola «Mar del Plata»;
   - una homónima de Santiago del Estero muestra su departamento.
3. Una publicación guardada sobre una entidad anidada:
   - aparece al filtrar por su localidad contenedora;
   - su ficha muestra la localidad;
   - una edición que no toca la ubicación conserva el `locality_id`.
4. Negativo discriminante: con el código de la base, el 188 da rojo y nombra
   un par repetido.
5. Sin regresiones en los casos que usan localidad, transportista y
   PostGIS. Elegilos y justificá. También a11y y contraste si cambian
   rótulos. Build, lint, tipos y diff-check verdes.

**Frená y consultá antes** si la corrección exige una migración de esquema o
de datos. Integrarla tiene su propia puerta operativa, que ya frena
`PRIMARY-IMAGE-INTEGRITY-1`. Frená también si exige cambiar la semántica de
`locality_id` fuera de lo descripto.

**Leé antes:** `ESTADO-DATOS-Y-FILTROS-2026-09-20.md` §2 (incluye el script
de medición), `backend/app/api/catalog.py` (`/localities` y el filtro
`locality_id`), `backend/app/models/locality.py`,
`backend/app/data/georef_localidades.csv` y los selectores de `src/`.

**Entrega** en `PARA-PM.md`:

- SHA, causa y conteos medidos antes y después;
- rojo y verde, pruebas exactas y riesgos;
- qué casos elegiste y por qué.

La PM reproduce el 188 y el negativo, y además la parte de publicaciones
existentes sobre entidades anidadas. No integres ni despliegues.
