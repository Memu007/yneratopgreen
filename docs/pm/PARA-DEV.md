# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Tarea activa — PRODUCT-DETAIL-BACK-SEARCH-1

**Prioridad y problema.** La ficha con URL propia ya está aceptada en rama,
pero Dev observó que, tras abrirla desde una búsqueda y recargarla, «Atrás»
puede volver al Mercado sin la consulta `q` (8/20 intentos). La persona pierde
el resultado que estaba viendo. Esta regresión de navegación se atiende antes
de `FILTER-COLLAPSE-FOCUS-1`.

**Alcance.** Reproducí el defecto desde el Mercado con
`?q=Campo%20Agr%C3%ADcola%20de%20120%20Hect%C3%A1reas`: abrir la ficha,
recargarla y usar «Atrás» de la interfaz. Investigá la sincronización entre
URL y estado de filtros y corregí sólo lo necesario para conservar la consulta
y los resultados al volver. Cubrí también la visita directa a la URL de una
ficha, donde no hay búsqueda previa que restaurar. Conservá recarga, enlace
compartible, Atrás/Adelante, paginación y otros filtros existentes.

**Fuera de alcance.** Rediseño de filtros, nueva librería de rutas, backend,
datos, checkout, pagos, integración y despliegue. El foco de teclado en filtros
cerrados sigue en `FILTER-COLLAPSE-FOCUS-1`.

**Aceptación verificable.** Agregá un caso que encadene *en el mismo recorrido*
búsqueda → ficha → recarga → Atrás y compruebe tanto el `q` de la URL como el
texto y las publicaciones filtradas que se muestran. Repetí el ciclo lo
suficiente para detectar la intermitencia observada; documentá cuántas veces.
El caso debe dar rojo con el comportamiento anterior por pérdida de `q`, y
verde con la corrección. Una entrada directa a la ficha debe volver al
Mercado sin inventar búsqueda. Los casos existentes de URL, filtros y ficha
siguen verdes.

**Pruebas y evidencia.** Corré el caso nuevo, 147, 183 y 185, build, lint,
tipos y las puertas proporcionales al diff. PM repetirá el recorrido y el
negativo sobre la candidata exacta. No repitas pruebas sin un cambio de riesgo
o un rojo que haya que clasificar.

**Leé antes:** tu hallazgo en `PARA-PM.md` para `FICHA-MOBILE-WIDTH-1`, el caso
183, `src/hooks/useProductFilters.ts`, la navegación de la ficha y
`REPRODUCCION-FICHA-MOBILE-WIDTH-1-2026-09-23.md`.

**Frená y respondé con evidencia** si conservar la búsqueda exige cambiar la
semántica de URLs compartidas o de filtros fuera de este recorrido. Entregá en
`PARA-PM.md` SHA, causa, recorridos y repeticiones, rojo/verde, pruebas exactas
y riesgos. No integres ni despliegues.
