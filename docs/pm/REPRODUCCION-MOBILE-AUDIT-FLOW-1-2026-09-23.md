# Reproducción PM — MOBILE-AUDIT-FLOW-1

Fecha: 2026-09-23. Base PM `624fac2`; arnés y negativos `8e4f7c6`;
informe Dev `eee9d6b`, precisión `8f5225d` y objeciones `69779b0`. `main` sigue en
`0bd7fbc`. Aceptada **en rama**, sin integración ni despliegue.

PM revisó el diff: sólo cambia `scripts/mobile-audit.mjs`, agrega el
script de negativos y reemplaza el informe Dev. No cambia producto.
`node --check`, sintaxis Python y diff-check compatible con CRLF verdes.

Sobre base/API Docker demo aisladas y Vite, PM ejecutó la auditoría completa:
**9/12 recorridos**, 33 pantallas. El recorrido público llegó a la ficha
cargada con URL propia en 360 × 800, 390 × 844 y 768 × 1024. No hubo controles
visibles tapados, errores de consola ni respuestas 4xx/5xx. Las tres compras
se cortaron en `05-checkout-payment`: el script espera «Medio de pago»
sin seleccionar antes cómo trasladar cada pedido. El resultado 9/12 no se
declara verde total.

PM ejecutó el negativo `recorrido-anterior`: **rojo esperado**, salida 1
por clic interceptado en «Limpiar filtros», sin captura de la ficha. El
arnés nuevo conserva las 25 capturas históricas y escribió la evidencia de
esta corrida fuera del repo. Dev informó los cuatro negativos rojos.

La corrida PM observó **un desborde** que no apareció en la corrida Dev:
en ficha de «Campo Agrícola de 120 Hectáreas» a 360 px, el documento mide
368 px. La captura muestra imagen y contenido fuera del borde derecho.
El caso 183 anterior había medido otra publicación a 390 px; por eso no
contradice ese verde. Se abre `FICHA-MOBILE-WIDTH-1` en cola.

PM confirmó en navegador que, con «Filtros» cerrado a 390 px, cuatro Tab
sucesivos desde el botón enfocan `catalog-type`, `catalog-category`,
`catalog-province` y `catalog-price-min`, controles invisibles. Se abre
`FILTER-COLLAPSE-FOCUS-1` en cola. Dev reportó contenido recortado en
checkout a 360/390 px; PM lo deja para reproducción focal en la tarea
activa `MOBILE-CHECKOUT-1`, junto al recorrido de compra incompleto. Dev
señaló que medir sólo el ancho del documento no detecta recortes dentro de
la capa de checkout; la siguiente tarea exige medir esa capa localmente.

La aceptación corresponde al arnés y a su capacidad de completar el
recorrido público y distinguir cortes. El QA responsive del MVP continúa
abierto. Los contenedores y volúmenes de la copia PM aislada se retiraron.
