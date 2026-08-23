# Sistema fotográfico

## Función

La fotografía no ambienta “el agro”: prueba que existe una máquina, un insumo,
un territorio o un trabajo. Toda foto debe responder al menos una pregunta de
compra: qué es, en qué estado está, cómo trabaja, quién lo presta o dónde
opera.

## Temas y encuadre

| Familia | Encuadre obligatorio | Evidencia que debe quedar visible |
|---|---|---|
| Activo de alto valor | Tres cuartos, máquina completa, cámara a altura humana. | Rodados, implemento, cabina, desgaste y escala. No cortar ruedas ni ocultar defectos. |
| Campo/inmueble rural | Horizonte en tercio superior; acceso e infraestructura antes que cielo. | Uso productivo, caminos, instalaciones y relación con el territorio. |
| Insumo | Producto completo y escala reconocible; frente y lote/embalaje legibles en la foto real. | Unidad de venta, estado del envase, cantidad y almacenamiento. |
| Servicio | Acción concreta entre persona, herramienta y máquina/suelo. | Qué trabajo se realiza. No handshake ni persona mirando cámara. |
| Logística | Vehículo y carga completos, tres cuartos lateral. | Tipo de equipo, amarre, escala y condición de traslado. |

## Luz y tratamiento

- Luz diurna neutra, aproximadamente 4.800–6.200 K; nublado brillante o mañana
  media. Atardecer sólo si documenta un hecho, nunca como identidad.
- Exposición que preserve detalle en chapa, neumático, suelo y piel. Sombras sin
  negros cerrados; altas luces sin cielo quemado.
- Saturación realista; corrección de color común a la serie, no preset
  cinematográfico.
- Se admite enderezado, recorte, balance de blancos, reducción de ruido y
  enfoque moderado. No se borran daños, personas, matrículas o contexto para
  mejorar artificialmente el activo.
- **Overlay sobre fotografía: 0 %.** Texto, precio y CTA viven fuera de la
  imagen.

## Proporciones y presencia mínima

| Uso | Proporción | Regla |
|---|---:|---|
| Hero desktop | 16:9 | Foto ocupa 52–58 % del ancho del módulo. |
| Hero mobile | 3:2 o 4:3 | Usar recorte alternativo; no forzar el crop desktop. |
| Card de activo | 4:3 | Primera imagen documental, sin texto incrustado. |
| Detalle de activo | 3:2 | Galería con mínimo: 3/4 frontal, lateral, trasera, cabina/horómetro, serie y defectos. |
| Insumo | 1:1 o 4:3 | Mantener envase y unidad completos. |
| Servicio/logística | 3:2 o 16:9 | La acción o el equipo deben leerse aun en miniatura. |

En la primera pantalla, la fotografía debe ocupar entre **22 % y 40 %** de los
píxeles del viewport. No se compensa falta de foto agrandando un bloque de color.

## Licencias y trazabilidad

Las cuatro imágenes `*-concepto.webp` fueron generadas para la comparación y
sólo pueden usarse como concepto interno. No constituyen pack de producción ni
pueden representar publicaciones reales.

Los cuatro WebP de `assets/produccion/` derivan de `public/DJI_0079.JPG` y
`public/relevamiento-inundacion.jpg`, material que la entrega UX-2B registra
como propio de la clienta. Se eliminaron EXIF/GPS, se fijaron crops y se
comprimieron para web. `ACTIVOS.md` documenta hashes, peso y límite de uso.

Un activo final necesita una ficha con: archivo fuente, autor/proveedor, fecha,
licencia o cesión, factura, territorio, duración, permiso de derivados,
model-release, property-release y responsable de aprobación. Está prohibido
descargar fotos de Agrofy, Mercado Libre, Agriaffaires, Ritchie Bros. o de una
publicación de terceros.

Orden de preferencia para producción:

1. fotografía propia con cesión comercial y releases;
2. encargo fotográfico con licencia mundial, comercial y sin vencimiento;
3. stock comercial con comprobante y límites documentados;
4. imagen generada sólo para datos demo, aprobada explícitamente y nunca usada
   para representar un activo real.

## Activos entregados para implementación

| ID | Archivo | Estado |
|---|---|---|
| `home/hero-cosecha` desktop | `assets/produccion/home-cosecha-hero-1920.webp` | Apto: 1920×1080, 328 KB. |
| `home/hero-cosecha` mobile | `assets/produccion/home-cosecha-hero-1200.webp` | Apto: 1200×900, 114 KB. |
| `servicios/hero-relevamiento` desktop | `assets/produccion/servicios-relevamiento-hero-960.webp` | Interino: 960×540, 28 KB; no escalar por encima de resolución natural. |
| `servicios/hero-relevamiento` mobile | `assets/produccion/servicios-relevamiento-hero-960-4x3.webp` | Interino: 960×720, 33 KB. |

El hero de Servicios muestra el resultado/contexto de un relevamiento, no un
técnico en acción. Es honesto y utilizable para el MVP, pero no alcanza el
estándar final de dirección de arte. No se disimula esa diferencia.

## Activos de producción faltantes

| ID | Cantidad | Especificación mínima |
|---|---:|---|
| `servicios/hero-asistencia-final` | 2 | 16:9 desktop + toma/crop mobile 4:3, operador y técnico en acción, releases. Reemplaza el activo interino. |
| `demo/tractor-2019/*` | 8 | 3/4 frontal, ambos laterales, trasera, cabina, horómetro, serie y defectos. |
| `demo/urea-46/*` | 3 | Pallet completo, unidad individual y lote/rotulado real. |
| `demo/muestreo-suelo/*` | 4 | Toma general, herramienta, muestra y entrega/registro del trabajo. |
| `demo/flete-carreton/*` | 4 | Vehículo vacío, carga completa, amarre y tres cuartos en ruta/predio. |

Total mínimo faltante para una demo pública completa con derechos aprobados:
**21 fotos**. No bloquea implementar estructura y fallbacks; sí bloquea presentar
las imágenes conceptuales como inventario real.
