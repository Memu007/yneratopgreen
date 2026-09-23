# Reproducción PM — PRODUCT-DETAIL-PAGE-1

Fecha: 2026-09-23. `main` permanece en `0bd7fbc`. Producto y caso 183:
`087fa2c`; informe Dev: `9110bcc`. Aceptada **en rama**, sin integración
ni despliegue.

## Qué se verificó

La ficha se abre en la misma pestaña con `/?section=product&id=ID`, enlace
directo y recarga. Desde Mercado, Inicio y Servicios llega a la publicación
correcta; Atrás/Adelante y «Volver» conservan el origen. En el Mercado vuelve
con búsqueda, orden, página, vista Lista y posición de desplazamiento, con el
foco en el enlace que la abrió. La ficha consulta la API por ID y distingue
carga, inexistente/pausada y fallo de red; no muestra datos viejos de la
tarjeta. Compra, ingreso, cantidad, cotización y perfil del vendedor mantienen
sus recorridos. El caso 183 mide también 390 px y teclado.

## Revisión independiente

PM levantó una copia aislada de `087fa2c` con base/API Docker limpia y
frontend de desarrollo. La suite completa terminó **183/183**. Pasaron entre
otros 123 (zoom y foco), 131 (entorno Docker), 147–148 (historial y capas),
155 (vista Lista), 182 (panel admin) y 183 (ficha nueva).

PM ejecutó el sabotaje `modal`: restauró temporalmente `src/` a la base
`3508d48`, donde el detalle seguía siendo una capa. El caso 183 dio
**rojo esperado**: la ficha se veía, pero la barra permanecía en la URL del
Mercado, sin enlace compartible ni recarga. Restaurada la candidata, el caso
183 pasó **1/1**. El script dejó el árbol de producto intacto. Build, lint,
`tsc --noEmit` y diff-check compatible con CRLF quedaron verdes.

Dev informó los otros tres sabotajes rojos (`sin-url`, `sin-regreso`,
`recarga-del-origen`), a11y **74/74** superficies y contraste **82/82**
mediciones. PM no repitió esas dos auditorías: la suite completa, el focal y
su negativo fueron la comprobación independiente de esta entrega.

La API existente incrementa `views_count` al consultar un detalle. La
página nueva consulta en cada apertura y recarga; PM acepta que ambas cuenten
como vistas. No se cambió backend para esta pieza.

## Hallazgo del QA móvil heredado

`scripts/mobile-audit.mjs` quedó en rojo antes de la ficha, en
«Limpiar filtros». El script selecciona categoría/provincia/localidad dentro
de un panel que sigue plegado en 360 px y después intenta pulsar el botón
oculto: el navegador informa que el resumen del panel y los resultados
interceptan el clic. PM confirmó con clics reales a 360 px que abrir
«Filtros», seleccionar categoría y pulsar «Limpiar filtros» funciona y deja
«Todas las categorías». Se clasifica como recorrido defectuoso del arnés,
no como defecto de producto demostrado. La corrección queda en
`MOBILE-AUDIT-FLOW-1`; la auditoría móvil completa sigue pendiente.

La auditoría escribió dos capturas históricas en la copia temporal; PM las
restauró. Al terminar retiró únicamente los contenedores y tres volúmenes
del proyecto Docker aislado `topgreen-pm-product183`; los demás recursos
locales quedaron intactos.
