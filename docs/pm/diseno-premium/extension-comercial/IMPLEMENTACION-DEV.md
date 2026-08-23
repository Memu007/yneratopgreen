# Contrato de implementación para Dev

## Resultado

Implementar **A — Mercado a cielo abierto** sobre UX-2B sin reabrir identidad,
anatomías ni producto. Inicio, Servicios y la primera pantalla del Mercado deben
pertenecer al mismo sistema y conservar todos los flujos actuales.

## Precedencia de fuentes

1. Comportamiento y datos reales: código/producto actual.
2. Identidad, anatomías, detalle, componentes globales y límites:
   `../handoff/`.
3. Composición pública, color, fotografía y copy de Inicio/Servicios/Mercado:
   este directorio.
4. Las capturas prueban la intención; HTML/CSS, tokens y reglas prevalecen sobre
   una medición tomada a ojo.

La variante B y las cuatro imágenes conceptuales de publicaciones no son parte
de producción.

## Overrides obligatorios

| Base UX-2B | Nuevo sistema |
|---|---|
| Canvas `#F8F7F3` | Canvas `#F4F1EA`. |
| Acción primaria índigo | Acción primaria `#B93424`; hover `#8F281D`. |
| Link azul | Link comercial `#8F281D`; info/estados mantienen azul semántico. |
| Hero índigo o foto cubierta | Copy y fotografía en columnas separadas; overlay 0 %. |
| Inicio institucional | Operación, taxonomía, publicaciones reales y CTA existentes. |
| Servicios hardcodeados con claims | Publicaciones de servicio con cobertura, modalidad y responsable reales. |
| Índigo como masa | Índigo como texto/estructura; relleno oscuro máximo 8 % del primer viewport público. |

El rojo no reemplaza error ni el verde de éxito. El índigo sigue siendo marca,
footer, texto, buscador y superficies funcionales justificadas.

## Archivos de producto esperados

El mapa completo está en `MAPA-COMPONENTES.md`. El diff debería concentrarse en:

- `src/tokens.css` e, indirectamente, aliases de `src/index.css`;
- `src/components/Header/Header.tsx` y `.module.css`;
- `src/components/Pages/HomePage.tsx` y `.module.css`;
- `src/components/Pages/ServicesPage.tsx` y `.module.css`;
- `src/App.tsx` y `src/App.module.css` para callbacks/datos/composición del Mercado;
- `public/media/comercial/` para los cuatro derivados permitidos;
- pruebas y puertas existentes necesarias para demostrar la entrega.

No hay cambio autorizado en Backend, esquema, seed, pagos, auth, checkout,
logística, paneles, detalle o las cuatro anatomías salvo una corrección necesaria
para compilar/preservar callbacks; si aparece, frená y reportá.

## 1. Fundación

1. Mapear `tokens.css` a `src/tokens.css` sin dejar dos temas ni variables
   paralelas.
2. Mantener Newsreader/Work Sans y los wordmarks ya self-hosted.
3. Copiar sólo los cuatro WebP de `assets/produccion/` al path público acordado.
4. No copiar `hero-campo-concepto.webp`, `tractor-listing-concepto.webp`,
   `insumo-listing-concepto.webp` ni `servicio-taller-concepto.webp`.
5. No agregar librería visual, iconos, dependencia de red ni animación nueva.

## 2. Header por contexto

- Inicio y Servicios: desktop compacto en una banda; marca, navegación real y
  acciones existentes. En tablet la navegación baja de línea. En mobile se
  muestran Inicio/Mercado/Servicios sin scroll horizontal; Quiénes somos y
  Contacto siguen accesibles según la solución actual, pero no pueden perderse
  del DOM o quedar sólo en hover.
- Mercado: buscador dominante en primera banda y navegación en segunda.
- Preservar variantes anónima, comprador, vendedor y admin, carrito, sesión,
  callback de Mercado Pago y panel.
- El wordmark continúa navegando al destino real definido por producto; no
  inventar ruta.

## 3. Inicio

Eliminar `Bienvenido a TopGreen`, la placa índigo, los tres beneficios con
iconos y los claims de IA/mecanización/confianza. La estructura queda:

1. hero split con copy exacto de `COPY.md` y fotografía Home permitida;
2. taxonomía de cuatro operaciones como contenido estático; sólo vuelve botón
   cuando exista un mapeo real a filtro;
3. `Operaciones disponibles`: hasta tres publicaciones activas provenientes de
   `getProducts`, en el orden canónico recibido; nunca `destacadas`;
4. bloque `Los datos que definen la operación`;
5. CTA de publicación con el login/alta actual;
6. footer existente con el sistema actualizado.

La preview debe reutilizar `ProductCard`, `ProductImage`, `precioVisible`,
`normalizarAnatomia` y acciones existentes, o una variante compacta que consuma
esas mismas fuentes. Prohibido duplicar formato de moneda, semántica o CTA.

Estados de preview: skeleton, éxito, vacío, error y offline según
`ESTADOS-Y-DATOS.md`. El conteo visible es `response.total`, no el largo de las
tres cards ni `30` hardcodeado.

## 4. Servicios

Eliminar el video con overlay, la lista institucional hardcodeada y todos los
claims de IA, satélites, eficiencia o sustentabilidad. La estructura queda:

1. hero split con la foto permitida y copy exacto;
2. `Servicios activos`: hasta tres publicaciones reales cuyo tipo sea servicio
   o logística, usando las anatomías existentes **sin añadir foto a la card**;
3. bloque `Qué mirar antes de cotizar`;
4. CTA de publicación con el flujo actual;
5. footer.

Para el CTA `Ver servicios publicados`, `App.tsx` debe llamar
`setSelectedType('servicios')` y luego navegar al Mercado. No alcanza con
escribir `type=servicios` en la URL si el estado del hook ya está montado.
No crear endpoint nuevo: la preview puede pedir el catálogo canónico y filtrar
por `isService/operationKind` con la misma regla de dominio existente.

## 5. Mercado

Conservar filtros, búsqueda, orden, grilla, apertura de detalle, carrito,
cotización y estados ya aceptados. Aplicar únicamente:

- nuevos tokens de canvas/acción/link;
- intro y espaciado de `mercado.html`;
- cabecera/buscador del mismo sistema;
- cero fotografía editorial dentro del intro;
- producto real y fallbacks existentes en resultados.

No reemplazar `ProductCard` por las cards del HTML ni sumar badges conceptuales.
La fuente de verdad de cards sigue siendo `../handoff/ANATOMIAS.md` y el código
UX-2B aceptado.

## 6. Activos

`ACTIVOS.md` distingue producción de concepto. El Home debe usar `<picture>`:

- desktop/tablet: `home-cosecha-hero-1920.webp`;
- mobile: `home-cosecha-hero-1200.webp`.

Servicios:

- desktop/tablet: `servicios-relevamiento-hero-960.webp`;
- mobile: `servicios-relevamiento-hero-960-4x3.webp`.

No servir los JPG originales de 5,9 MB ni sus metadatos GPS. No agrandar la
foto de Servicios por encima de su resolución natural; reemplazarla cuando se
produzca el activo encargado.

## 7. Secuencia auditable

1. Fundación, tokens y activos.
2. Header + Inicio.
3. Servicios + ajuste visual del Mercado.
4. Estados, responsive, pruebas, capturas e informe.

Cada frontera debe compilar. No desplegar: PM revisa y decide.

## Criterio de cierre

La entrega no se acepta por parecerse a una captura. Debe completar
`PARIDAD.md`, pasar todas las puertas existentes y demostrar 1440×900,
768×1024 y 390×844, zoom 200 %, teclado, reduced motion, carga/vacío/error,
foto ausente/rota y texto largo. Un único sistema de tokens, cero assets
conceptuales y cero claims falsos.
