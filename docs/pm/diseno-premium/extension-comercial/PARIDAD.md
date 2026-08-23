# Checklist de paridad — A / Mercado a cielo abierto

Dev completa cada ítem con evidencia. Una captura parecida no reemplaza este
contrato.

## Sistema

- [ ] Existe una sola capa de tokens; canvas `#F4F1EA`, acción `#B93424`, hover
  y link comercial `#8F281D` llegan por roles, no por hex dispersos.
- [ ] Newsreader, Work Sans y wordmarks mantienen archivos/licencias/hashes ya
  aceptados.
- [ ] Índigo funciona como texto/estructura; ninguna placa oscura pública
  supera 64 px de alto ni 8 % del primer viewport.
- [ ] No hay gradientes, glass, sombra de card, pills decorativas, iconos de
  relleno, hojas, espigas ni tractor como símbolo.
- [ ] Acción, éxito, error, warning e info conservan semánticas distintas.

## Header y navegación

- [ ] Inicio/Servicios usan cabecera compacta desktop y Mercado usa buscador
  dominante + nav.
- [ ] Anónimo, comprador, vendedor y admin conservan acciones, carrito, cuenta,
  salida y callback MP.
- [ ] Inicio, Mercado, Servicios, Quiénes somos y Contacto siguen accesibles;
  nada se pierde sólo para igualar una captura mobile.
- [ ] Header no tapa contenido al 200 % ni depende de sticky en baja altura.

## Inicio

- [ ] No quedan `Bienvenido`, hero índigo, beneficios con iconos ni claims de
  IA/mecanización/confianza.
- [ ] Copy y fotografía están en columnas separadas; overlay real 0 %.
- [ ] `<picture>` usa los dos derivados Home permitidos y no los JPG fuente.
- [ ] Taxonomía 4/2×2/2×2 es contenido estático; no finge links.
- [ ] Preview muestra hasta tres operaciones reales y reutiliza anatomía,
  formato y acción existentes.
- [ ] Conteo usa `response.total`; no `30` ni el largo de la preview.
- [ ] Título dice `Operaciones disponibles`, no `destacadas`.
- [ ] Loading, éxito, vacío, error y offline coinciden con
  `ESTADOS-Y-DATOS.md`.
- [ ] Publicar conserva login, toast y modal actuales.

## Servicios

- [ ] No quedan video con overlay, lista hardcodeada ni claims de IA, satélites,
  IoT, eficiencia o sustentabilidad.
- [ ] Hero usa los dos derivados permitidos; no se amplía el archivo 960 px ni
  se presenta como foto de una publicación.
- [ ] Preview usa publicaciones reales de servicio/logística y mantiene cards
  sin foto, según anatomía aceptada.
- [ ] Cobertura, modalidad, responsable y precio/modalidad salen de datos.
- [ ] `Ver servicios publicados` fija `selectedType='servicios'` antes de
  navegar; el filtro queda visible y limpiable.
- [ ] Loading, vacío, error y offline están diferenciados.
- [ ] Publicar servicio conserva autenticación y alta actuales.

## Mercado

- [ ] Búsqueda, filtros, URL, orden, grilla, detalle, carrito y cotización no
  pierden comportamiento.
- [ ] Intro, canvas y acción coinciden con `mercado.html` sin sumar hero.
- [ ] ProductCard mantiene cuatro anatomías; el prototipo no sustituyó el
  componente real.
- [ ] Foto real/fallback, stock, precio, ubicación, vendedor y CTA mantienen la
  semántica aceptada de UX-2B.

## Activos y verdad

- [ ] Sólo los cuatro archivos de `assets/produccion/` se copiaron; sus hashes
  coinciden con `ACTIVOS.md`.
- [ ] Ningún `*-concepto.webp`, screenshot o lámina entra a `public/`, `src/`,
  seed, fixture o build.
- [ ] Los JPG originales con EXIF/GPS no se sirven.
- [ ] No aparece `destacada`, `verificado`, `garantizado`, `protegido`,
  `inspeccionado` ni promesa equivalente sin dato.
- [ ] No hay recursos externos automáticos, Unsplash, Picsum ni Google Fonts.

## Responsive y acceso

- [ ] 1440×900, 768×1024 y 390×844 cumplen `RESPONSIVE.md` sin overflow.
- [ ] Acciones principales >=44×44; enlaces textuales cumplen WCAG 2.5.8.
- [ ] Orden DOM/teclado es lógico; foco visible, Escape/restauración en capas
  existentes y nada depende de hover.
- [ ] Zoom 200 % conserva contenido y acción alcanzables.
- [ ] Reduced motion no reproduce movimiento no esencial; hero sin autoplay.
- [ ] Título largo, precio largo, cobertura larga y expansión de copy 30 % no
  rompen composición.
- [ ] axe: 0 serious/critical en las superficies afectadas y tres viewports.
- [ ] `scrollWidth === clientWidth`, cero error de consola/página y cero recurso
  fallido en nueve combinaciones.

## Puertas del repo

- [ ] `npm run build`
- [ ] `npm run lint`
- [ ] `npm run contraste`
- [ ] `npm run a11y`
- [ ] `npm run hito`
- [ ] suite completa desde base limpia
- [ ] `git -c core.whitespace=cr-at-eol diff --check`

No rebajar, regrabar ni quitar inventarios para obtener verde. `smoke` sólo en
el entorno aislado previsto por el repositorio y sin arriesgar datos.

## Evidencia de cierre

- [ ] Capturas nuevas de Inicio, Servicios y Mercado en tres viewports.
- [ ] Comparativa antes/después del índigo masivo y overlays.
- [ ] Lista exacta de archivos de producto.
- [ ] Diferencias intencionales contra el handoff con responsable/fecha.
- [ ] Informe en `docs/pm/PARA-PM.md` y commits auditables.
- [ ] Revisión PM.
- [ ] Revisión visual final de Emi.
