# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Tarea activa — FICHA-MOBILE-WIDTH-1

**Prioridad y problema.** El QA móvil del MVP ya completa los 12 recorridos,
pero la ficha de «Campo Agrícola de 120 Hectáreas» desborda a 360 px: el
documento mide 368 px. La galería, el resumen y varias secciones llegan a
`right=368`. La ficha es parte del recorrido público y tiene URL propia.

**Alcance.** Reproducí el defecto con la base demo limpia, esa publicación y
el viewport 360 × 800. Identificá el elemento que impone el ancho y corregí
la geometría local de la ficha para que galería, texto, precio, acciones y
secciones entren en la pantalla. Verificá también 390 × 844 y 768 × 1024,
con una publicación sin foto y otra con textos o precio largos. Conservá URL,
recarga y regreso al catálogo.

**Fuera de alcance.** Rediseño global, checkout, filtros, datos, backend,
permisos, pagos, integración y despliegue. El foco de teclado que entra en
filtros cerrados sigue en la tarea separada `FILTER-COLLAPSE-FOCUS-1`.

**Aceptación verificable.** En la ficha a 360, 390 y 768 px, el documento no
desborda horizontalmente y ningún contenido o control de la ficha queda
recortado. El caso debe medir la publicación problemática de la base limpia;
un caso que sólo use otra tarjeta no cubre el defecto. La auditoría móvil debe
completar 12/12 con cero desbordes y cero recortes del checkout. Añadí un
negativo que reponga la geometría anterior y falle específicamente por el
desborde de la ficha. Conservá el caso 183 y las pruebas existentes.

**Pruebas y evidencia.** Corré build, lint, tipos, focales, negativo y puertas
proporcionales. PM repetirá el focal y la auditoría sobre la candidata exacta
en una base aislada. Adjuntá medidas y capturas antes/después de 360 y 390 px.
No repitas la suite completa sin cambio de riesgo o rojo inesperado.

**Leé antes:** `REPRODUCCION-MOBILE-CHECKOUT-1-2026-09-23.md`,
`REPRODUCCION-MOBILE-AUDIT-FLOW-1-2026-09-23.md`, `scripts/mobile-audit.mjs`,
el caso 183 y la ficha actual.

**Frená y respondé con evidencia** si el arreglo exige una regla global que
altere otras vistas o un cambio de datos. Entregá en `PARA-PM.md` SHA,
causa, medidas, capturas, focal/negativo, pruebas exactas y riesgos. No
integres ni despliegues.
