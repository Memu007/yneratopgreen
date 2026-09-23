# Reproducción PM — MOBILE-CHECKOUT-1

Fecha: 2026-09-23. Base `32560c6`; producto, caso 184, auditoría y negativos
`f820146`; informe Dev `e6fdc6d`. `main` permanece en `0bd7fbc`.
**Aceptada en rama**, sin integración ni despliegue.

PM revisó el diff y las capturas antes/después: la corrección de producto está
acotada al CSS del checkout. El arnés elige explícitamente el traslado por
cuenta propia y mide envío y pago dentro de la capa. Build, lint, tipos y
diff-check verdes. Dev informó a11y 74/74 y contraste 82/82.

Con base/API Docker demo aisladas y Vite sobre la candidata exacta, PM corrió
`SMOKE_CASOS=184`: **1/1**. El checkout llegó a medio de pago sin crear orden;
contenido/ancho de capa en envío y pago: **320/320** a 360 px, **350/350** a
390 px y **728/728** a 768 px. La cruz no tapa el progreso. El negativo
`recorte-original` dio el **rojo esperado**: caso 184 falló a 360 px porque
el contenido excedía la capa de 320 px, y la auditoría marcó recortes en
envío y pago a 360 y 390 px, sin confundirlos con cortes del recorrido.
El script restauró el árbol al terminar.

La auditoría PM terminó **12/12 recorridos**, 39 pantallas, cero recortes en
las seis mediciones del checkout, cero controles visibles tapados, cero errores
de consola/red y cero cortes del arnés. Salió con código 1 por **un hallazgo
ajeno al checkout**: la ficha de «Campo Agrícola de 120 Hectáreas» mide
368 px en viewport de 360 px; galería y varias secciones llegan a `right=368`.
Coincide con la reproducción anterior y queda para `FICHA-MOBILE-WIDTH-1`.
Por eso no se declara cerrado el QA responsive del MVP.

PM acepta las dos correcciones menores de la misma capa: separar la cruz del
progreso y dar espacio al rótulo de envío en el resumen. No cambian las reglas
de compra. Los contenedores y volúmenes temporales se retiraron tras la prueba.
