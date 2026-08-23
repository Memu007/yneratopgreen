# Contrato de handoff Diseño → Dev

Dirección elegida: **B — Mesa de negocios**  
Objetivo: que Opus pueda implementar el sistema sin inventar decisiones visuales
ni copiar a ojo una lámina. **Puerta 3 no se acepta si falta un bloque.**

## 1. Identidad final utilizable

- Wordmark TopGreen final en SVG limpio, con versión horizontal, compacta,
  monocroma clara y monocroma oscura.
- Área de seguridad, tamaño mínimo, fondos permitidos y usos prohibidos.
- Favicon/app icon sólo si puede derivarse honestamente del sistema; no inventar
  un isotipo genérico para completar el paquete.
- Descriptor aprobado y reglas para usar o no usar `Mercado agro: productos,
  servicios y logística`.
- Ningún activo debe depender de una captura, imagen generada o fuente sin
  licencia de uso comercial comprobada.

## 2. Tipografía lista para producción

- Familias, pesos y estilos exactos; URL o archivos oficiales y licencia.
- Stack de fallback y comportamiento si la fuente no carga.
- Escala completa: display, H1–H6, cuerpo, cuerpo pequeño, etiqueta y dato.
- Para cada estilo: tamaño, peso, line-height, tracking y uso permitido.
- Reglas de números, moneda, unidades, títulos largos y mayúsculas.

## 3. Tokens sin ambigüedad

Entregar una tabla humana y una fuente reutilizable (`tokens.css` o JSON) con:

- colores por rol semántico, no sólo muestras: canvas, superficies, texto,
  texto secundario, marca, acción, selección, éxito, advertencia, error, bordes;
- ratios de contraste en sus combinaciones reales;
- espaciado, anchos máximos, grilla y gutters;
- radios, bordes, elevación y overlays;
- breakpoints y reglas de cambio de composición;
- foco visible, estados disabled y opacidad permitida;
- duración/easing sólo si existe movimiento necesario.

## 4. Anatomías completas por tipo de operación

Para catálogo y detalle, especificar por separado:

1. activo de alto valor: precio/consulta, condición y datos técnicos;
2. insumo estandarizado: precio, unidad, stock, cantidad y `Agregar`;
3. servicio: cobertura, modalidad y `Solicitar cotización`;
4. logística: equipo/carga, radio/cobertura y `Ver transportistas`.

Cada anatomía debe marcar qué dato es obligatorio, opcional, ausente y largo.
No convertir una ausencia en una promesa ni mostrar `$0` cuando corresponde
`Consultar` o `A cotizar`.

## 5. Componentes y estados

Documentar visual y verbalmente, como mínimo:

- header anónimo y autenticado por rol;
- wordmark, buscador, navegación y acción de publicar;
- filtros, selects, ordenamiento, chips si realmente se usan y limpieza;
- grilla/lista y las cuatro tarjetas anteriores;
- detalle, galería, datos, vendedor, logística y acciones;
- botones primario/secundario/terciario y enlaces;
- campos, textarea, select, checkbox, radio y carga de archivo;
- modal, drawer, pestañas, tabla y toast existentes;
- footer;
- loading/skeleton, vacío, error, sin conexión, disabled, sin stock, publicación
  pausada, foto ausente, foto rota, texto largo y precio no publicado;
- hover, focus, active, selected y validación.

No diseñar funciones que el producto no tenga. Si una pieza futura aparece como
concepto, debe quedar separada y no formar parte del handoff implementable.

## 6. Responsive como reglas, no sólo dos capturas

- Láminas de referencia exactas en **1440×900**, **768×1024** y **390×844**.
- Qué columnas cambian, qué se apila, qué queda sticky y qué nunca se oculta.
- Orden de lectura y teclado en cada composición.
- Tratamiento de filtros en móvil sin impedir ver resultados.
- Límites para títulos, precios, ubicaciones, vendedores y datos largos.
- Controles táctiles de al menos 44×44 px cuando corresponda.
- Ningún desborde horizontal ni dependencia de hover.

## 7. Fotografía y activos finales

- Manual de encuadre, luz, color, fondo, escala, personas y maquinaria.
- Reglas de crop para 4:3, 16:9 y miniaturas.
- Umbral mínimo de calidad y tratamiento de fotos verticales/horizontales.
- Solución final para `sin foto` y `foto rota` que no finja el producto ni use
  ilustraciones repetidas de categoría.
- Inventario de cada activo necesario con nombre, medida, formato, peso máximo,
  origen y licencia.
- Pack demo sólo si sus imágenes son originales, licenciadas o generadas con
  aprobación explícita para ese uso. Las imágenes conceptuales actuales no son
  activos de producción.

## 8. Voz y contenido

- Diccionario de acciones por operación y estados de confianza permitidos.
- Microcopy exacta para búsquedas, filtros, resultados, vacíos y errores.
- Formato argentino inicial de moneda, unidad, ubicación, fecha y distancia;
  regla para futura internacionalización sin rediseñar.
- Lista de promesas prohibidas: `verificado`, `garantizado`, `protegido`,
  `inspeccionado` o equivalentes salvo evidencia real del sistema.
- No inventar rutas como `Mesa de negocios`, financiación, mapas o mensajería.

## 9. Prototipos de referencia

Entregar en `docs/pm/diseno-premium/handoff/`:

- `marketplace.html`: referencia responsive autocontenida del catálogo;
- `detalle.html`: referencia responsive del detalle;
- `estados.html`: tablero de componentes y estados;
- capturas de los tres viewports requeridos;
- SVG, fuentes/licencias o enlaces oficiales y activos finales;
- `TOKENS.md` más `tokens.css` o `tokens.json`;
- `COPY.md`, `FOTOGRAFIA.md` y `MAPA-COMPONENTES.md`.

Estos HTML/CSS son especificación visual aislada, no código de producto. No se
importan en `src/`, no entran al build ni modifican datos o flujos.

## 10. Mapa hacia el producto real

`MAPA-COMPONENTES.md` debe vincular cada decisión con el componente/ruta real
que Opus tendrá que modificar y marcar:

- comportamiento que se conserva intacto;
- diferencia puramente visual;
- cambio de copy;
- activo requerido;
- deuda o función futura que no se implementa;
- riesgo de regresión y puerta existente que la detecta.

La diseñadora debe revisar el producto real antes de cerrar el mapa. No debe
suponer que una función de la lámina ya existe.

## 11. Criterio de paridad para aceptar a Opus

El handoff debe permitir una comparación objetiva. Incluir checklist de:

- geometría: contenedor, columnas, espaciado y proporciones;
- tipografía y color por token;
- contenido y orden de información;
- estados e interacciones;
- responsive en los tres viewports;
- accesibilidad, foco, contraste y navegación por teclado;
- funciones existentes sin regresión;
- cero activos temporales, enlaces falsos, emojis o claims sin respaldo.

No exigir `pixel perfect` ciego entre navegadores: la aceptación es paridad de
sistema, jerarquía y comportamiento. Toda diferencia intencional debe quedar
explicada por Opus y aprobada por PM/Emi.

## Puerta de salida

Antes de entregar a Opus, la diseñadora presenta a Emi/PM:

1. wordmark final;
2. catálogo y detalle en los tres viewports;
3. las cuatro anatomías;
4. tablero de estados;
5. activos/licencias;
6. prototipos y mapa de implementación.

Emi y PM pueden aprobar, devolver o recortar. **La Dev continúa pausada hasta
que los seis puntos estén aceptados y el commit de handoff esté en `main`.**
