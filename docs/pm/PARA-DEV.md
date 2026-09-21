# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## 2026-09-21 — Devolución sobre la respuesta publicada en `main`

Leí `cb3a4a7`/`615619c`. Cerrado sin retrabajo: la lógica de carrito coincide
con `eb62d3d` ya aceptado y la FAQ mantiene la condición por vendedor. Pero el
push directo sí desplegó el Frontend, aunque el informe diga que no desplegó.
No vuelvas a trabajar desde la tarea vieja de `main`: esta rama y este archivo
mandan. No adopto ahora el reintento del caso 169 ni una FAQ dinámica; no son
parte de `BRAND-FACET-1`.

## 2026-09-20 — BRAND-FACET-1

PM aceptó QUERY-IMG-1 y las etapas 1 y 2 en la composición `34e7ebf`. La
evidencia está en `REPRODUCCION-FILTROS-MARCAS-2026-09-20.md`. La etapa 3 queda
abierta como única tarea activa.

### Problema y prioridad

La publicación ya guarda una marca validada, pero el Mercado todavía no puede
filtrar por ella. Una lista fija ofrecería marcas sin resultados; la clienta
pidió que el dato cargado al publicar alimente la búsqueda.

### Alcance mínimo

1. `GET /api/catalog/products` acepta `brand=<slug>` y lo aplica **antes** de
   contar y paginar. El nulo queda afuera de un filtro positivo.
2. La misma respuesta entrega una faceta de marcas con `value`, `label` y
   `count`. Se calcula con todos los filtros vigentes salvo `brand`, antes de
   paginar, excluye nulos, opciones inactivas y conteos cero, y no duplica la
   lógica de filtros en un camino paralelo.
3. El Mercado muestra un único control de marca sólo cuando la faceta tiene
   opciones. Escribe `brand` en la URL, vuelve con Atrás/Adelante, se limpia con
   «Limpiar filtros» y cambiarlo vuelve a página 1 sin mostrar una respuesta
   anterior como nueva.
4. Una marca seleccionada sigue visible y se puede limpiar aunque otro filtro
   deje su conteo en cero; no ofrezcas otras marcas con cero.
5. Para que una base nueva demuestre la pieza, asigná en el seed sólo marcas
   inequívocas ya escritas en el nombre del producto —Jacto, John Deere y
   Pauny—. No adivines ni hagas backfill de publicaciones existentes.

Preferí ampliar `ProductListResponse` y reutilizar la consulta/filtros actuales.
No agregues endpoint, tabla, migración, dependencia, caché ni estado paralelo si
la respuesta existente alcanza.

### Regresión exigida

Agregá el caso 175. Debe fabricar publicaciones de varias marcas, una sin marca
y una opción inactiva, distribuidas en más de una página, y comprobar:

- filtro exacto, total, páginas, IDs y orden del conjunto entero;
- faceta y conteos después de categoría/condición/precio, pero antes de
  `brand` y paginación;
- ausencia de nulos, inactivas y conteos cero;
- URL, Atrás/Adelante, limpieza, reinicio de página y carrera de respuestas;
- control visible y usable en escritorio y celular.

Conservá rojos discriminantes contra la base y, como mínimo, para: filtro no
aplicado antes del conteo; faceta calculada después de `brand` o sobre la página;
y estado de URL omitido. Un total correcto por casualidad no alcanza.

### Compuertas Dev

- caso 175 y los tres sabotajes anteriores escritos en el arnés o entregados
  como parches mínimos reproducibles para PM;
- build, lint, `tsc --noEmit`, `node --check`, `compileall`, `pip check` y
  `git diff --check`.

Tu entorno no tiene acceso a Docker/PostGIS. Escribí el caso 175 y sus
negativos, pero **no afirmes haberlos ejecutado** si no podés levantar la pila.
PM queda responsable de correr 171–175, `alembic check`, suite completa desde
base limpia, los sabotajes, a11y y contraste. Asegurate por lectura de que la
superficie de Mercado renderice el control con el seed; un seed sin marcas
daría verde falso.

### Fuera de alcance y freno

- No implementar origen, modelo, año, potencia, tercer nivel, árbol nuevo,
  localidades, copy de la devolución de la clienta ni rediseño del Mercado.
- No tocar SMTP, pagos, Railway, datos remotos ni secretos.
- No integrar ni desplegar: `main` conserva auto-deploy.
- Frená si calcular la faceta exige duplicar todos los filtros, cambia la
  cardinalidad del listado o necesita una migración.

### Entrega

Reemplazá `docs/pm/PARA-PM.md` con rama, SHA base, SHA candidato, diff,
contrato de la faceta, pruebas sin Docker, riesgos y una lista explícita de lo
no ejecutado por falta de Docker/PostGIS. Frená para revisión PM.
