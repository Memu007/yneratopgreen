# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Tarea activa — MOBILE-CHECKOUT-1

**Prioridad y problema.** La auditoría móvil del MVP completa 9/12
recorridos: las tres compras se cortan porque el script espera «Medio de
pago» sin elegir antes cómo se traslada cada pedido. Dev observó además
que en «Datos de envío» el contenido del checkout mide 400 px, queda
recortado a 360 y 390 px y corta rótulos y campos. PM aún debe reproducir
ese segundo hallazgo de forma focal. La compra móvil es prioritaria.

**Alcance.** Primero reproducí y medí el recorte del checkout a 360 y
390 px con un producto demo y el flujo real. Si se confirma, corregí la
geometría local del checkout para que campos, rótulos y opciones de traslado
sean legibles y operables sin recorte; verificá también 768 px. Después
actualizá sólo el recorrido de compra de `scripts/mobile-audit.mjs` para
elegir explícitamente «Coordino el traslado por mi cuenta», como haría la
persona, y llegar a «Medio de pago». Medí la pantalla de envío y la de
pago antes de seguir. La auditoría debe detectar recorte **dentro** de la
capa de checkout aunque el documento completo no desborde. Limitá esa
medición al checkout para no marcar como defecto la tabla de administración,
que se desplaza horizontalmente dentro de su marco a propósito. Conservá
la distinción del arnés entre corte del script y defecto de UI, y la carpeta
nueva de evidencia.

**Fuera de alcance.** Cambios de pagos, backend, datos, permisos, migraciones,
otros modales, rediseño global, integración y despliegue. Los defectos de
ancho de la ficha a 360 px y foco en filtros cerrados están registrados
en cola; no los mezcles con esta pieza.

**Aceptación verificable.** A 360 × 800, 390 × 844 y 768 × 1024, el
checkout permite completar «Datos de envío», elegir traslado por cuenta
propia y llegar al paso de medio de pago. En 360/390, ningún rótulo, campo
ni opción queda fuera del marco visible o recortado; no alcanza que la
página no tenga barra horizontal. La auditoría debe completar los tres
recorridos de compra y medir envío y pago. Añadí un negativo que falle
con el recorte original, si se reproduce; y otro que demuestre que el
recorrido anterior se corta por no decidir el traslado. Conservá las
pruebas existentes de checkout.

**Pruebas y evidencia.** Corré build, lint, tipos, el focal y las pruebas
que tu entorno permita. PM levantará Docker y repetirá la auditoría y los
focales sobre la candidata exacta. No repitas la suite smoke completa sin
un cambio fuera de este alcance o un rojo inesperado. Si el recorte no se
reproduce, o corregirlo exige rediseño transversal o reglas de pago,
frená y respondé con medidas antes de editar producto.

**Leé antes:** `REPRODUCCION-MOBILE-AUDIT-FLOW-1-2026-09-23.md`,
`scripts/mobile-audit.mjs`, el paso de envío del checkout y los casos
de compra móvil ya existentes.

**Entrega.** Respondé en `PARA-PM.md` con SHA, medidas y capturas
antes/después, recorrido y negativos, pruebas exactas y riesgos. No
integres ni despliegues.
