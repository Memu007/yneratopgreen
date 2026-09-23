# Reproducción PM — ADMIN-MOBILE-ACCESS-1

Fecha: 2026-09-23. `main` permanece en `0bd7fbc`. Producto, caso 182 y
sabotajes: `b2a3ba4`; informe Dev: `a11b52a`. Aceptada **en rama**;
sin integración ni despliegue.

## Alcance observado

En 360 × 800 y 390 × 844, la barra del panel admin muestra las siete
secciones completas, sin desplazamiento horizontal; cada blanco de sección y
Cerrar mide al menos 44 × 44 px. En 768 × 1024 sigue utilizable. La selección
táctil y por teclado, el foco y el estado al volver del detalle de una orden
quedan cubiertos por el caso 182.

El delta de producto es sólo
`src/components/AdminPanel/AdminPanel.module.css` (+14/−4), dentro de los
estilos móviles. El caso 182 mide geometría del navegador. Se revisó el diff
y el diff-check compatible con CRLF quedó limpio.

## Revisión independiente

PM levantó una copia aislada de la candidata con su propia base/API y Vite.
Corrió los casos `1,2,3,4,5,6,21,108,144,145,146,148,160,182`: **14/14**
verdes. El caso 182 cubrió 360, 390 y 768 px y terminó **1/1**.

PM activó el sabotaje `desplazamiento`, que devuelve la barra al comportamiento
anterior: el caso 182 dio **rojo esperado**, con 273 px de desborde y
Categorías, Documentación y Configuración fuera de vista. Restaurada la
candidata, el caso 182 volvió a pasar **1/1**. Esto demuestra que el caso
distingue el defecto que corrige la pieza.

Dev informó además los cuatro sabotajes
`desplazamiento/altura/cerrar/apretado` rojos, a11y **74/74**, contraste
**82/82**, build, lint, tipos y sintaxis verdes. PM no repitió la suite
completa: el cambio de producto es acotado al CSS del panel y no apareció
ningún rojo inesperado.

La base/API de PM usó un proyecto Docker aislado. Al terminar se retiraron
sólo sus contenedores y volúmenes; otros proyectos locales quedaron intactos.

## Decisión y límite

**Aceptada en rama.** El blanco de Cerrar del detalle de orden también queda
en 44 × 44 px aun con título largo, dentro del mismo panel. No se afirma que
todos los controles de Configuración u otros paneles midan 44 px: los botones
de tipo de opción de 26 px observados por Dev y el QA responsive general
siguen pendientes.

El primer push de Dev partió de `d4ce965` y omitió la decisión PM previa
`44d5d5d` sobre la página de producto. Dev incorporó ese commit por el merge
`aab4e62`; el cherry-pick local PM `7b45ea1` tenía el mismo contenido y
**no** quedó en la historia remota. El cierre PM siguió sobre `aab4e62`.
