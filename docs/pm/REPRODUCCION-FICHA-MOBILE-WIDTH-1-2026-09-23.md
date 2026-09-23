# Reproducción PM — FICHA-MOBILE-WIDTH-1

Fecha: 2026-09-23. Base aceptada `95f3d8d`; producto, caso 185 y negativos
`78b682b`; informe Dev `4a0dca2`. `main` permanece en `0bd7fbc`.
**Aceptada en rama**, sin integración ni despliegue.

PM revisó el diff y las capturas antes/después. El arreglo queda en la ficha:
columna que puede contraerse, precio que cabe según su longitud, descripción
que parte cadenas largas y marco sin foto que muestra su leyenda completa.
No hay cambio de backend, datos, checkout ni CSS global.

Sobre una base demo Docker aislada y la candidata exacta, PM corrió el caso
185: **1/1**. La ficha de «Campo Agrícola de 120 Hectáreas», una publicación
larga sin foto y una de precio corto midieron **360/360**, **390/390** y
**768/768** px, sin contenido fuera de la ficha. PM verificó además URL,
recarga y navegación según el caso. La auditoría móvil terminó **12/12**
recorridos, 39 pantallas, cero desbordes, cero recortes del checkout, cero
controles visibles tapados, cero errores de consola/red y cero cortes del
arnés; salida 0.

El negativo `geometria-anterior` repuso la geometría previa y dio el **rojo
esperado** en el caso 185: la ficha de Campo desbordó la pantalla de 360 px y
varias secciones quedaron fuera. El script restauró el árbol. PM verificó
también build, lint, tipos y diff-check verdes. Dev informó 22/22 casos
relacionados, a11y 74/74 y contraste 82/82; PM no repitió esas puertas sin
riesgo adicional. Los contenedores y volúmenes temporales se retiraron.

Queda abierto, separado de esta aceptación, el defecto informado por Dev:
tras recargar una ficha abierta desde una búsqueda, «Atrás» pierde `q` de
forma intermitente (8/20 intentos de Dev). PM no lo reprodujo en esta
revisión; se asigna `PRODUCT-DETAIL-BACK-SEARCH-1` para medirlo y corregirlo.
El foco en filtros cerrados sigue en `FILTER-COLLAPSE-FOCUS-1`.
