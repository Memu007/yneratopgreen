# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Tarea activa — MOBILE-AUDIT-FLOW-1

**Prioridad y problema.** Para cerrar el QA responsive del MVP necesitamos
que `scripts/mobile-audit.mjs` recorra la ficha nueva. Hoy se corta antes:
en 360 px el script usa selectores del panel «Filtros» sin abrirlo y después
intenta pulsar «Limpiar filtros», que está oculto. PM reprodujo el timeout
con eventos interceptados y comprobó con clic real que, al abrir el panel,
seleccionar una categoría y limpiar funciona. Es un defecto del recorrido
de auditoría; no hay un bug de producto demostrado en ese botón.

**Alcance.** Ajustá sólo el flujo de la auditoría para operar el panel
plegable como una persona en 360, 390 y 768 px: abrirlo por «Filtros»,
usar los controles visibles, limpiar, volver a resultados y llegar a la
ficha con su URL propia. Conservá las mediciones de desborde, blancos
táctiles, texto, consola y red. Evitá sobrescribir capturas históricas
versionadas: cada corrida debe dejar su evidencia en una ruta nueva o
configurable. No cambies el producto para hacer pasar el script.

**Fuera de alcance.** Backend, datos, migraciones, rediseño de filtros,
corrección de controles que esta auditoría aún no midió, integración y
despliegue.

**Aceptación verificable.** En 360 × 800, 390 × 844 y 768 × 1024, el
recorrido público debe abrir el panel si está plegado, seleccionar filtros
de forma visible, pulsar «Limpiar filtros» sin intercepción y llegar a la
ficha cargada de una publicación. La salida debe distinguir una falla del
script de un hallazgo real de UI y conservar las capturas existentes.
El recorrido anterior sirve como negativo: falla antes de la ficha por
operar el panel cerrado; el corregido debe pasar ese punto.

**Pruebas y evidencia.** Corré `node --check` y las puertas estáticas que
tu entorno permita. No tenés Docker/PostGIS según `DECISIONS.md`: PM hará
la corrida completa de la auditoría con la composición aislada, y clasificará
los hallazgos que aparezcan. Si el flujo corregido revela un defecto real
de producto o exige ampliar alcance, frená y describilo; no lo arregles
dentro de esta pieza. No repitas la suite smoke completa: `087fa2c` ya
pasó 183/183 en la revisión PM y aquí sólo cambia el arnés móvil.

**Leé antes:** `REPRODUCCION-PRODUCT-DETAIL-PAGE-1-2026-09-23.md`,
`scripts/mobile-audit.mjs`, `FilterSidebar` y su CSS responsive.

**Entrega.** Respondé en `PARA-PM.md` con SHA exacto, cambio del flujo,
pruebas ejecutadas y no ejecutadas, ruta de evidencia y cualquier hallazgo
de UI. No integres ni despliegues.
