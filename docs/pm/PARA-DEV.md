# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Tarea activa — FILTER-COLLAPSE-FOCUS-1

**Decisión sobre la entrega anterior.** `PRODUCT-DETAIL-BACK-SEARCH-1` quedó
**aceptada en rama** sobre `ce0380e`. Tu corrección de la medición es correcta
y se agradece: era un cuadro sin `q`, no una pérdida. PM reprodujo el 186 en
1/1, el negativo rojo 10/10 y 147/148/183/185 en 4/4. El hueco de carga que
dejaste «visto y no tocado» no muestra un falso «No hay operaciones»; queda
P3, sin tarea. Evidencia en `REPRODUCCION-PRODUCT-DETAIL-BACK-SEARCH-1-2026-09-23.md`.

**Prioridad y problema.** Por debajo de 1024 px el panel de filtros está
plegado, pero sus controles siguen recibiendo el foco. PM lo reprodujo sobre
`ce0380e` a 390 px: desde «Filtros» cerrado, Tab recorre **11 controles
invisibles** —tipo, categoría, provincia, precio mínimo y máximo, casilla de
stock, valoración, condición, marca, «Limpiar filtros» y «Ver N
resultados»— antes de llegar a «Ordenar». Quien navega con teclado o lector
pierde el foco de vista y opera filtros que no ve. Es lo último abierto del QA
responsive en rama.

**Alcance.** En 360, 390 y 768 px, con el panel cerrado, sus controles no
reciben foco ni se anuncian; Tab desde «Filtros» va al siguiente control
visible. Con el panel abierto, Tab entra en los controles en su orden actual
y todos funcionan. Si el panel se cierra con el foco adentro —«Ver N
resultados» o «Filtros»—, el foco queda en «Filtros», no en un elemento
oculto. En escritorio (≥ 1024 px) el panel sigue siempre abierto y todos sus
controles siguen alcanzables con Tab, como hoy.

**Fuera de alcance.** Rediseño visual del panel, animaciones, cambiar qué
filtros existen o su orden, cerrar con Escape o por clic afuera, cambios en
URL o `useProductFilters`, backend, datos, integración y despliegue. No
avances a otra pieza.

**Aceptación verificable.**

1. Caso nuevo 187, en 360, 390 y 768 px: desde «Filtros» cerrado, Tab no
   aterriza en ningún control con caja invisible o recortada por el panel y
   llega a «Ordenar»; abierto, Tab recorre los 11 controles y cambiar uno
   filtra; «Ver N resultados» cierra y deja el foco en «Filtros» visible.
   A 1280 px, los controles del panel siguen en el recorrido de Tab.
2. Con el panel cerrado, el árbol de accesibilidad no expone esos controles.
3. Negativo discriminante: con el componente de la base, el 187 da rojo por
   foco en un control invisible, nombrando cuál.
4. Sin regresiones: 148, 171, 175, 183, 185 y 186 verdes; a11y y contraste
   sin violaciones nuevas; auditoría móvil 12/12.

**Pruebas y evidencia.** Corré el 187, su negativo, los casos del punto 4,
a11y, contraste, auditoría móvil, build, lint, tipos y diff-check. No hace
falta la suite completa. PM repetirá el 187 y el negativo sobre la candidata
exacta y medirá el recorrido de Tab por su cuenta.

**Leé antes:** `src/components/FilterSidebar/FilterSidebar.tsx` y su CSS
(el comentario sobre por qué se pliega con altura y no con `display: none`),
el caso 148 y `REPRODUCCION-MOBILE-AUDIT-FLOW-1-2026-09-23.md`.

**Frená y respondé con evidencia** si la corrección exige cambiar el aspecto
del panel, su comportamiento en escritorio o romper el motivo documentado
de plegar con altura. Entregá en `PARA-PM.md` SHA, causa, recorridos
medidos, rojo/verde, pruebas exactas y riesgos. No integres ni despliegues.
