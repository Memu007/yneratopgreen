# Cierre de revisión PM — Handoff Puerta 3 `8bd91d7`

Fecha: 2026-08-23  
Alcance: sólo los dos bloqueos documentados en
`REVISION-PM-8bd91d7.md`.  
Estado: corrección lista para nueva revisión de Emi y PM. Puerta 3 no se
autoacepta y Opus continúa pausada.

## Bloqueo 1 — contraste del DOM

- Se eliminaron del DOM los índices decorativos visibles `02` y `03` de
  `marketplace.html` y la regla `.operation-index` de `marketplace.css`.
- La tarjeta de publicación pausada dejó de aplicar el token de texto disabled.
  El texto informativo ahora hereda `#17213D` sobre `#E5E7EC`, con contraste
  **12,85:1**.
- Se actualizó la única captura donde aparecía uno de los índices:
  `capturas/marketplace-1440x900-resultados.png`. Las demás capturas no
  mostraban `02`/`03`; el texto pausado tampoco aparece en las vistas
  contractuales actuales.
- `AUDITORIA-CONTRATO.md` ya distingue el precheck de pares de tokens de una
  prueba sobre el DOM completo.

## Nueva auditoría axe

Ejecución aislada por HTTP, sin cambios de producto:

- motor: `axe-core 4.12.1`;
- navegador: Chromium headless `92.0.4512.0`;
- páginas: `marketplace.html`, `detalle.html`, `estados.html`;
- viewports: `1440×900`, `768×1024`, `390×844`;
- `innerWidth`/`innerHeight` coincidieron con los nueve viewports solicitados;
- `scrollWidth === clientWidth` en las nueve combinaciones;
- cero errores de consola y cero errores de página.

| Prototipo | Viewport | Violaciones | Serious / critical | Checks aprobados |
|---|---:|---:|---:|---:|
| Marketplace | 1440×900 | 0 | 0 | 46 |
| Marketplace | 768×1024 | 0 | 0 | 47 |
| Marketplace | 390×844 | 0 | 0 | 47 |
| Detalle | 1440×900 | 0 | 0 | 50 |
| Detalle | 768×1024 | 0 | 0 | 50 |
| Detalle | 390×844 | 0 | 0 | 50 |
| Estados | 1440×900 | 0 | 0 | 48 |
| Estados | 768×1024 | 0 | 0 | 48 |
| Estados | 390×844 | 0 | 0 | 49 |

Resultado agregado: **9/9 ejecuciones con cero violaciones; cero serious y
cero critical**.

### Checks que axe dejó para revisión manual

No se contabilizan como violaciones, pero se registran para no ocultar la
salida del motor:

- `color-contrast` no resuelve automáticamente el fondo de los rótulos “Sin
  fotografía” porque el contenedor incluye un SVG de fondo. El rótulo usa texto
  `#17213D` sobre `rgba(248,247,243,.94)`; aun compuesto sobre negro, el caso
  más desfavorable, conserva aproximadamente **12,98:1**.
- `aria-prohibited-attr` deja inconclusa la compatibilidad del `aria-label` ya
  existente en `.toast-row`. No es una violación reportada y no pertenece a los
  dos bloqueos que esta corrección autoriza reabrir.

## Bloqueo 2 — contrato táctil

- `RESPONSIVE.md` reserva `44×44 px` para acciones y controles principales.
- Breadcrumbs y enlaces inline, de tablero o pie se rigen por WCAG 2.5.8:
  target de al menos `24×24 px`, separación suficiente o excepción inline.
- `PARIDAD.md` replica el mismo criterio verificable.
- Esta salida no cambia geometría; por eso no requiere capturas adicionales.

## Control de alcance

- Sin cambios en identidad, wordmark, paleta ni anatomías.
- Sin cambios en `src/`, Backend o producto.
- Sin entrega a Opus.
