# Contrato UX-2D — implementar B / Mercado nacional

## Resultado

Revestir la implementación UX-2C aceptada técnicamente con la dirección visual
**B — Mercado nacional**, sin modificar datos, contratos ni flujos. Inicio,
Servicios, Mercado y sus Headers deben verse como las referencias de `frames/`
y seguir usando el producto real.

## Precedencia de fuentes

1. Comportamiento, datos, accesibilidad y semántica: código actual aceptado.
2. Cuatro anatomías y lógica de acciones: `../handoff/` y componentes actuales.
3. Composición, marca, color, tipografía y densidad pública: este directorio.
4. HTML/CSS explica la intención; no se copia como segunda implementación.
5. Si una referencia visual contradice un flujo real, se preserva el flujo y se
   informa a PM antes de improvisar.

## Overrides cerrados

| UX-2C actual | UX-2D B |
|---|---|
| Newsreader + Work Sans | Inter Tight + Inter self-hosted. |
| Canvas `#F4F1EA` | Canvas `#F7F6F2`. |
| Índigo `#17213D` | Verde `#1E4A34` para marca/acción. |
| Rojo óxido `#B93424` | Cereal `#C49A43` como señal; nunca como error. |
| Serif editorial dominante | Sans condensada, comercial y tabular. |
| Header claro/editorial | Header verde por celdas; Mercado en dos bandas. |
| Ausencia de foto como vacío amplio | Registro bajo y explícito, sin inventar foto. |

Tokens mínimos de fuente visual:

```text
canvas       #F7F6F2
surface      #FFFFFF
ink          #1E2420
text-muted   #4C544B
brand/action #1E4A34
action-hover #143526
cereal       #C49A43
cereal-deep  #8A671C
steel        #5A6B60
border       #D8DAD2
```

Los colores semánticos existentes de éxito, error, warning e información se
conservan si cumplen contraste. El cereal no suplanta warning y el verde de
marca no debe ocultar estados de éxito.

## Activos

- Copiar a `public/fuentes/` Inter, Inter Tight y sus licencias desde
  `assets/fonts/`; cargar sólo esas dos familias en el tema nuevo.
- Reemplazar los cuatro SVG de `public/marca/` por los de `assets/marca/`,
  adaptando únicamente los nombres importados por producto. No redibujar.
- Reutilizar los cuatro WebP que ya existen en `public/media/comercial/`; sus
  hashes coinciden con el paquete. No duplicarlos.
- `assets/estados/no-photo-b.svg` define el lenguaje del fallback. Integrarlo
  en `ProductImage` sin sustituir su `alt`, manejo de URL rota ni tamaño por
  variante.
- Sin URLs externas, Google Fonts, librerías visuales, icon packs o imágenes
  inventadas.

## Header

- Mantener un solo `Header.tsx`: no duplicar componente por página.
- Inicio/Servicios y páginas no Mercado: una banda verde.
- Mercado: marca + buscador + sesión en primera banda; cinco destinos en la
  segunda.
- Mobile usa navegación 3+2, sin scroll horizontal ni menú oculto.
- Anónimo: `Ingresar`. Comprador: carrito + `Cuenta`. Vendedor: `Vender` +
  carrito + `Cuenta`. Admin: `Admin` + `Vender` + carrito + `Cuenta`.
- Desktop puede mostrar el nombre actual; mobile muestra `Cuenta` para no
  truncar datos variables. Preservar `aria-label="Mi cuenta"`, Salir, callback
  MP, apertura de panel y todos los callbacks reales.
- En Mercado mobile, placeholder exacto `Buscar`; desktop conserva el copy
  descriptivo actual.

## Inicio

Conservar copy, datos, callbacks y estructura de negocio de UX-2C. Aplicar la
geometría de `frames/inicio-*`:

1. hero 47/53 desktop con foto sin overlay y banda de registro;
2. copy comercial, acciones y medidor con `response.total` real;
3. libro mayor de cuatro familias; sigue siendo contenido, no filtro falso;
4. preview real con `ProductCard` y las anatomías actuales;
5. bloques de decisión, CTA y Footer actuales adaptados al sistema B.

`30` es sólo el dato ilustrativo del prototipo. Loading no muestra un número
provisorio; 0, 1 y N se expresan con el dato real.

## Servicios

Conservar el filtro API `publication_type=servicio`, callbacks, copy y datos de
UX-2C. Aplicar `frames/servicios-*`:

1. foto/copy 53/47 desktop; foto primero en mobile;
2. CTA para ver/publicar sin cambiar autenticación;
3. cobertura, modalidad y responsable salen de la publicación;
4. cards reales de servicio/logística, sin foto inventada;
5. bloques de comparación y CTA actuales bajo B.

No reintroducir IA, satélites, sostenibilidad ni otro claim sin evidencia.

## Mercado

Preservar búsqueda, filtros, provincia/localidad, tipo, categoría, orden, URL,
carga, grilla, detalle, carrito, checkout, cotización y logística. Aplicar:

- header de dos bandas y buscador dominante;
- sidebar 256 px desktop; mobile usa el control existente de filtros;
- conteo desde el total real del endpoint, no `products.length` cuando exista
  paginación;
- grilla de tres/dos/una columnas según ancho;
- reglas cromáticas por anatomía: activo verde, insumo cereal, servicio acero,
  logística grafito;
- fallback bajo `Sin registro fotográfico`, sin gran bloque vacío.

La deuda general de paginación mayor a 100 sigue fuera de UX-2D; no ocultar el
total verdadero ni abrir paginación como desvío.

## Responsive y estados

- Breakpoints contractuales existentes: `0–599`, `600–1023`, `>=1024`.
- Referencias exactas: `390×844` y `1440×900`; Dev debe resolver además
  `768×1024` sin inventar otra identidad.
- Cero overflow horizontal en los tres tamaños y zoom 200 %.
- Verificar loading, vacío, error, offline, 0/1/N, foto ausente/rota, copy +30
  %, precio largo y todos los roles.
- Controles principales `>=44×44`, foco visible, teclado lógico, reduced
  motion y contraste WCAG según las puertas existentes.

## Secuencia y límites

1. Tokens, fuentes, marca y fallback.
2. Header completo y estados por rol.
3. Inicio y Servicios.
4. Mercado.
5. Estados, tablet, accesibilidad, regresiones y evidencia.

Cada frontera compila. Sin Backend, migración, seed, pagos, logística, auth,
API, dependencias, rutas o despliegue. Si el cambio exige alguno, frenar y
reportar. No rediseñar Quiénes somos/Contacto/paneles sin pantalla aprobada.

## Entrega

- Un commit de producto y uno separado de informe.
- Completar `PARIDAD.md` con evidencia concreta.
- Capturas Inicio/Servicios/Mercado en 1440, 768 y 390, más Headers por rol.
- Ejecutar todas las puertas del repo desde base limpia.
- Informar diferencias justificadas, archivos, conteos y deuda real en
  `docs/pm/PARA-PM.md`.
- Empujar y frenar. **No desplegar.**

