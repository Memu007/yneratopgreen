# Revisión independiente de PM — Handoff Puerta 3 `8bd91d7`

Fecha: 2026-08-23  
Resultado: **dirección conforme; Puerta 3 todavía no aceptada**.  
Opus continúa pausada.

## Lo que queda conforme

- El commit se limita a `docs/pm/diseno-premium/handoff/`; `src/` y Backend no
  cambiaron.
- Están presentes identidad, SVG, fuentes con OFL, tokens, cuatro anatomías,
  copy, fotografía, estados, reglas responsive, mapa de componentes, paridad,
  tres prototipos y 14 capturas en las dimensiones declaradas.
- Los hashes de las dos fuentes, cuatro wordmarks y dos fallbacks coinciden con
  `ACTIVOS.md`.
- Los tres prototipos cargan sus estilos y activos locales sin errores de
  consola; a 390 px no presentan desborde horizontal.
- B — Mesa de negocios se mantiene sin contaminarse con A. No inventa ruta
  Mesa de negocios, directorio de transportistas, financiación ni mensajería.
- La separación entre activo de alto valor, insumo, servicio y logística está
  bien especificada y el mapa reconoce correctamente la semántica de dominio
  que el producto todavía no expone.

## Bloqueo 1 — la auditoría de contraste declara un verde falso

PM ejecutó `@axe-core/playwright` sobre `marketplace.html`, `detalle.html` y
`estados.html` en 1440×900 y 390×844. Resultado:

| Prototipo | 1440 | 390 |
|---|---:|---:|
| Marketplace | 1 serious | 1 serious |
| Detalle | 0 | 0 |
| Estados | 1 serious | 1 serious |

Casos exactos:

1. `marketplace.html`: los índices visibles `02` y `03` usan `#CFD3DC` sobre
   blanco, ratio **1,49:1**. `aria-hidden` evita anunciarlos, pero no vuelve
   conforme al texto visible. Si son puramente decorativos, eliminarlos es más
   honesto que conservar números casi invisibles; si se mantienen, deben llegar
   a 3:1 por su tamaño.
2. `estados.html`: el texto descriptivo de publicación pausada usa
   `#777D8B` sobre `#E5E7EC`, ratio **3,33:1**, cuando necesita 4,5:1. No es un
   control disabled: comunica información y debe usar un color de texto válido.

Corregir sólo estos usos, actualizar capturas afectadas y volver a medir las
tres páginas en **1440×900, 768×1024 y 390×844**. La nueva auditoría debe
informar cero violaciones serious/critical y no repetir ratios teóricos como si
probaran todo el DOM.

## Bloqueo 2 — regla táctil escrita de forma absoluta pero no ejecutada

`RESPONSIVE.md` afirma: “Todos los controles táctiles son de al menos 44×44”.
La medición real en 390 px encuentra breadcrumbs y enlaces de pie/tablero con
alturas de 19–24 px. La regla `target-size` de axe no reporta violación porque
WCAG 2.5.8 admite tamaño de 24 px y excepciones por espaciado; por eso no es un
incumplimiento AA automático, pero sí contradice el contrato escrito.

Elegir una salida y documentarla sin ambigüedad:

- ampliar a 44×44 los targets que el sistema realmente considere táctiles; o
- reservar 44×44 para acciones/controles principales y declarar que enlaces
  inline, breadcrumb y pie cumplen WCAG 2.5.8 por tamaño/espaciado.

Actualizar `RESPONSIVE.md`, `PARIDAD.md` y las capturas si cambia geometría.

## Pendientes operativos que no son defecto de Diseño

1. El producto todavía no posee una clasificación inequívoca para asignar las
   cuatro anatomías. Antes de ramificar UI, Opus deberá proponer a PM el cambio
   de dominio/API y migración mínima; no se autoriza inferir por precio o CSS.
2. No hay pack fotográfico demo con derechos aprobados. El handoff hizo bien en
   no inventarlo. La implementación puede empezar con los fallbacks finales,
   pero antes de una demostración pública Emi/PM deberán decidir si usan fotos
   propias, material licenciado o un set generado aprobado sólo para datos demo.
3. El wordmark queda sujeto a aprobación visual explícita de Emi. Técnicamente
   está entregado y trazable; PM no debe asumir preferencia de marca por él.

## Corrección solicitada

La diseñadora corrige únicamente los dos bloqueos, regenera evidencia y agrega
una nota de cierre. No reabre dirección, wordmark, paleta, anatomías ni producto.
Un solo commit de corrección en `docs/pm/diseno-premium/handoff/` y frena.
