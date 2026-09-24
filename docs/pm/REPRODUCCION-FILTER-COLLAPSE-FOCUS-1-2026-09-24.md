# Reproducción PM — FILTER-COLLAPSE-FOCUS-1

Fecha: 2026-09-24. Base de la tarea `d468a8b`; producto, caso 187, negativos y
marcador de a11y/contraste `4fa8809`; informe Dev `0fd3217` (sólo
`docs/pm/PARA-PM.md`). `main` permanece en `0bd7fbc`.
**Aceptada en rama**, sin integración ni despliegue.

## Qué se revisó

Producto: `FilterSidebar.module.css` agrega `visibility: hidden` al panel
plegado, dentro de `@media (max-width: 1023px)`, y `visible` al abierto; el
plegado sigue siendo por altura y sobre el mismo nodo. `FilterSidebar.tsx`:
«Ver N resultados» pliega, corta el desplazamiento suave en curso, pasa el
foco a «Filtros» y lo centra. Escritorio sin cambios. Diff-check CRLF verde;
el componente conserva sus finales de línea mixtos.

Puertas: `a11y.mjs` y `contraste.mjs` cambian el marcador del catálogo de
`#catalog-category` a «Ordenar» y suman la superficie «catálogo: filtros
abiertos», que abre el panel en celular para medir sus controles donde se
ven. No debilita la cobertura: antes esos controles se medían recortados y
ahora se miden visibles. Pasan de 74 a 76 superficies y de 82 a 84
mediciones.

## Entorno PM

El mismo de `REPRODUCCION-PRODUCT-DETAIL-BACK-SEARCH-1-2026-09-23.md`:
copia aislada en `4fa8809`, base `postgis/postgis:16-3.4` recién creada en
Docker real con siembra demo, API nativa y frontend de desarrollo, y `.env`
inventados. Chromium 141 del entorno, distinto del fijado por Playwright
1.62; declarado.

## Resultados

| Verificación | Resultado |
|---|---|
| Caso 187 | **1/1**: a 360, 390 y 768 px, cerrado, «Filtros» → «Ordenar» en 1 Tab y 12 controles fuera del árbol; abierto, 11 en orden; precio mínimo 30 → 10; «Ver 10 resultados» deja el foco en «Filtros». A 1280 px, los 10 controles siguen en el recorrido de Tab |
| Negativo `componente-de-la-base` | **rojo esperado**: Tab cae en los 11 controles invisibles, nombrados |
| Negativo `foco-sin-volver` | **rojo esperado**: el foco vuelve al documento |
| Negativo `desplazamiento-sin-cortar` | **rojo esperado** en 360 px: «Filtros» con el foco en −475 px |
| Árbol después de los negativos | `src` como estaba |
| Casos 148, 155, 171, 175, 183, 185, 186 | **7/7** |
| a11y `--todas` | **76/76** superficies, 0 violaciones |
| Contraste | **84/84** mediciones |
| Auditoría móvil | **12/12** recorridos, 39 pantallas, 0 hallazgos, salida 0 |
| Build, lint, `tsc --noEmit`, `node --check` de los scripts, sintaxis del negativo, diff-check CRLF | verdes |

## Sonda independiente PM y decisión de experiencia

PM midió sola, con teclado y con toque, en 360×640, 360×844, 390×844 y
768×1024. En todos los casos, Tab desde «Filtros» cerrado fue a «Ordenar». Al
cerrar con «Ver N resultados», el foco quedó en «Filtros» a la vista y la
página volvió arriba (`scrollY = 0`), la misma vista con la que se entra al
Mercado. La primera tarjeta empieza a 451 px, a 362 px en 768; en un celular
chico de 640 px se ven 189 px de ella.

**Decisión PM:** se acepta la recomendación de Dev. «Ver N resultados» deja
«Filtros» visible con el foco y el principio de los resultados a la vista. La
alternativa de pegar «Filtros» al borde de arriba no está medida y exige
márgenes distintos según el ancho. Si una prueba con personas muestra que la
lista queda baja, se abre como mejora propia.

## Registrado sin tarea

- P3: al pasar de escritorio a menos de 1024 px con el foco dentro del panel,
  por ejemplo al girar una tablet, el foco vuelve al documento.
- El negativo `desplazamiento-sin-cortar` depende del cuadro en que llega
  Enter. En esta corrida PM dio rojo en 360 px.

No se tocó `main`, Railway, backend ni datos reales. Contenedor, copia y
procesos temporales se retiran al cerrar la revisión.
