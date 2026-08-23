# Reglas responsive — extensión comercial

Las capturas son consecuencias. Estas reglas son el contrato.

## Breakpoints

- Mobile: `0–599 px`, grilla 4 columnas, gutter 20 px, gap 16 px.
- Tablet: `600–1023 px`, grilla 8 columnas, gutter 32 px, gap 20 px.
- Desktop: `>=1024 px`, grilla 12 columnas, gutter 48 px, gap 24 px.
- Contenedor máximo: 1320 px.

## Header

| Ancho | Inicio / Servicios | Mercado |
|---|---|---|
| Desktop | Una banda de 80 px: marca, nav, acciones. | Masthead 76 px con marca/búsqueda/acciones + nav 48 px. |
| Tablet | Marca/acciones arriba; nav completa debajo. | Marca/acciones, búsqueda en línea propia, nav debajo. |
| Mobile | Marca + Ingresar; nav comercial de tres destinos visibles. Publicar vive en menú/flujo vigente, no desaparece de la aplicación. | Marca + Ingresar, búsqueda completa y nav de tres destinos. |

La cabecera mobile no es sticky. Con viewport de menos de 480 px de alto se
mantiene la regla de UX-2B: no sticky, para no tapar acciones al 200 %.

## Inicio

- Desktop: hero `44/56`, mínimo 432 px; copy izquierda, foto derecha. Foto
  separada por regla roja de 5 px.
- Tablet: foto 330 px primero, copy después. El cambio de orden está también en
  el DOM de la implementación o se resuelve sin alterar lectura accesible; no
  usar `order` para contradecir tabulación.
- Mobile: copy primero y foto 205 px después; no hay texto ni CTA sobre foto.
- Taxonomía: 4 columnas desktop, 2×2 tablet/mobile. No carrusel ni ancho mayor
  al viewport.
- Operaciones: 3 columnas desktop, 2 tablet, 1 mobile. Título, precio y CTA no
  se truncan.
- Bloque de decisión: 4 columnas desktop, 2×2 tablet, lista mobile.

## Servicios

- Desktop: hero `56/44`, foto izquierda y copy derecha; mínimo 414 px.
- Tablet/mobile: foto primero, copy después; 330 px tablet y 210 px mobile.
- `Servicios activos`: 3 columnas desktop, 2+1 tablet, 1 mobile. Las cards de
  servicio/logística mantienen su anatomía de datos y no ganan foto.
- CTA no flota sobre foto ni queda escondida debajo del primer dato comercial.

## Mercado

- Desktop: filtros 248 px y resultados; tres columnas cuando cada card conserva
  al menos 280 px.
- Tablet: filtros colapsados dentro del flujo; resultados dos columnas.
- Mobile: filtros cerrados por defecto y resultados una columna. El control
  dice `Filtrar` y su estado/acción con texto; no icono aislado.
- Búsqueda, conteo, orden, primer resultado, precio y próxima acción nunca se
  ocultan por estética.

## Contenido largo

| Elemento | Regla |
|---|---|
| H1 | Sin truncado; `overflow-wrap` sólo como defensa. |
| Card | Título hasta 3 líneas; nombre completo accesible. |
| Precio | Línea propia, números sin corte entre dígitos. |
| CTA | Texto completo; admite 30 % de expansión por idioma. |
| Ubicación/cobertura | Envuelve; no ellipsis que quite provincia/país. |
| Taxonomía | El nombre puede ocupar dos líneas; el bloque crece. |

## Acceso y tamaño táctil

- Acciones y controles principales: mínimo 44×44 px.
- Links inline y pie: WCAG 2.5.8 por target de 24×24 px, separación o excepción
  inline ya documentada en `../handoff/RESPONSIVE.md`.
- Orden de foco = orden de lectura. Nada depende de hover.
- `scrollWidth === clientWidth` en los tres viewports.
- Zoom 200 %: contenido y acción principal alcanzables; cabecera no los tapa.
