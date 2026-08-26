# Revisión PM — exploración Ox Alpha

Fecha: 2026-08-25  
Estado histórico: **dirección B aceptada y luego extendida a handoff Dev**.

## Resultado

Emi eligió **B — Mercado nacional** y la revisión independiente de PM coincide.
Es la alternativa que mejor traduce TopGreen a un marketplace agroindustrial:
el verde funciona como masa comercial, el cereal como señal de acción, la
tipografía es transaccional y la taxonomía hace visible el mercado sin recurrir
a hojas, iconos decorativos ni estética editorial.

A queda como contraste industrial y C como contraste técnico. No se continúan.

## Evidencia revisada

La entrega offline se conserva en `ox-alpha/`:

- un índice comparativo;
- A/B/C en `1440×900` y `390×844`;
- CSS y JavaScript locales;
- wordmark provisional re-tintado;
- dos derivados Home ya autorizados;
- fuentes self-hosted y sus seis archivos OFL.

PM verificó:

- repo limpio en `758afe1` antes de importar la exploración;
- cero cambios en `src/`, Backend, configuración o dependencias;
- los hashes SHA-256 de las dos fotos coinciden con
  `public/media/comercial/`;
- no existen recursos HTTP externos; el namespace SVG no descarga contenido;
- B desktop no cambió durante el cierre mobile;
- en `390×844`, ancho de documento `390`, cero overflow horizontal, cinco
  destinos de navegación dentro del viewport y fotografía desde `y=641` hasta
  más allá de `y=844`;
- la taxonomía sigue existiendo, reordenada después del hero sólo en mobile;
- la foto extra de Servicios fue retirada del ZIP.

El servidor informado en la primera entrega no estaba activo cuando PM lo
consultó; es una inconsistencia operativa del mensaje, no del artefacto offline.

## Qué se aprueba

- Personalidad **Mercado nacional**.
- Paleta de dirección: canvas `#F7F6F2`, verde `#1E4A34`, grafito `#1E2420`,
  cereal `#C49A43` y borde `#D8DAD2`.
- Inter Tight como voz de títulos/datos e Inter como UI/cuerpo.
- Header verde con celda cereal para la acción de sesión.
- Taxonomía numerada como libro mayor comercial.
- Medidor de operaciones y línea de registro como recurso de marca.
- Hero copy/foto separado, sin overlay.
- Solución mobile 3+2 para los cinco destinos y hero antes de taxonomía.

El conteo `30` es ilustrativo en el prototipo. Producto debe continuar usando
`response.total` y nunca copiarlo como constante.

## Qué no se aprueba todavía

Esta pieza sólo resuelve Header + primer viewport de Inicio. No define aún:

- Servicios y Mercado bajo B;
- cards, filtros, detalle, formularios, estados o paneles bajo la nueva capa;
- variantes de Header para comprador, vendedor y administración;
- mapa final de tokens/componentes hacia el producto;
- paridad de tres viewports, accesibilidad y contraste sobre React real.

Esta limitación quedó cerrada el 2026-08-25. Diseño extendió B a Inicio,
Servicios, Mercado y los cuatro estados del Header; Emi aprobó la corrección
final y PM verificó desktop/mobile, cero overflow, activos y SVG finales. La
fuente vigente ya no es este primer experimento: está en
`mercado-nacional-b/`, con contrato, mapa React y paridad. Dev puede ejecutar
UX-2D con esos límites, sin copiar el HTML ni extrapolar pantallas no diseñadas.
