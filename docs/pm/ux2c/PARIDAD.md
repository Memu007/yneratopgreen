# Checklist de paridad — A / Mercado a cielo abierto

Copia del checklist de `docs/pm/diseno-premium/extension-comercial/PARIDAD.md`
con la columna de **desarrollo** completada. El original queda intacto: es el
entregable de Diseño, y las dos revisiones finales —PM y Emi— son de ustedes.

- Completó: dev, 2026-08-24.
- Cada ítem marcado dice **con qué se comprobó**. Lo que no pude comprobar
  queda sin marcar y explicado; nada se marca «por inspección visual».
- Comandos del repositorio: `npm run build`, `npm run lint`,
  `npm run contraste`, `npm run a11y`, `npm run hito`, `npm run smoke`.
- Casos nuevos de la suite: **124** (Inicio) y **125** (Servicios); el **123**
  (zoom 200 %) ahora recorre también las dos superficies comerciales.

## Sistema

- [x] Existe una sola capa de tokens; canvas `#F4F1EA`, acción `#B93424`, hover
  y link comercial `#8F281D` llegan por roles, no por hex dispersos.
  Nueve valores cambiaron en `src/tokens.css` y ningún nombre cambió de rol; no
  hay prefijo `commercial-*` ni segunda capa: los alias viejos de `index.css`
  siguen apuntando a `--tg-*`. `grep -rn "#f8f7f3\|#1d4e89" src` no devuelve
  nada fuera del token de info.
- [x] Newsreader, Work Sans y wordmarks mantienen archivos/licencias/hashes ya
  aceptados. No se tocó `public/fuentes/` ni `public/marca/`.
- [x] Índigo funciona como texto/estructura; ninguna placa oscura pública
  supera 64 px de alto ni 8 % del primer viewport. **Medido**: superficie
  rellena con índigo o rojo = **0,70 %** del primer viewport en Inicio y
  **0,79 %** en Servicios; placa continua más alta = **44 px** (el botón de
  acción). El pie sigue siendo la única masa índigo y vive fuera del primer
  pliegue.
- [x] No hay gradientes, glass, sombra de card, pills decorativas, iconos de
  relleno, hojas, espigas ni tractor como símbolo. Los tres beneficios con
  iconos de la portada se retiraron; `--tg-shadow-none` sigue siendo la sombra
  de tarjetas.
- [x] Acción, éxito, error, warning e info conservan semánticas distintas. El
  rojo de acción `#b93424` no reemplazó `--tg-color-error` `#a22f2f` ni el
  verde de éxito; `contraste` mide las cinco por separado.

## Header y navegación

- [x] Inicio/Servicios usan cabecera compacta desktop y Mercado usa buscador
  dominante + nav. Una sola cabecera con dos variantes; capturas de los tres
  anchos en `capturas/`.
- [x] Anónimo, comprador, vendedor y admin conservan acciones, carrito, cuenta,
  salida y callback MP. No se tocó esa lógica y la suite completa —125/125—
  recorre las cuatro sesiones, el carrito, el checkout y la vuelta de Mercado
  Pago.
- [x] Inicio, Mercado, Servicios, Quiénes somos y Contacto siguen accesibles;
  nada se pierde sólo para igualar una captura mobile. En celular las cinco se
  ven en tres columnas y dos filas. **Diferencia intencional 1**: el prototipo
  mostraba tres y escondía las otras dos con `display: none`.
- [x] Header no tapa contenido al 200 % ni depende de sticky en baja altura.
  Caso 123: con menos de 480 px de alto la cabecera deja de ser pegajosa, y a
  640×360 la acción principal de Inicio y de Servicios queda visible, dentro
  del ancho y alcanzable con el teclado.

## Inicio

- [x] No quedan `Bienvenido`, hero índigo, beneficios con iconos ni claims de
  IA/mecanización/confianza. El caso 124 falla si alguno vuelve: busca
  `Bienvenido a TopGreen`, `inteligencia artificial`, `MECANIZACIÓN`,
  `CONFIANZA`, `alianzas` y `destacad`.
- [x] Copy y fotografía están en columnas separadas; overlay real 0 %. El caso
  124 pregunta qué elemento hay en el centro de la fotografía y exige que sea
  la propia `IMG`: si hubiera una capa encima, el que responde es la capa.
- [x] `<picture>` usa los dos derivados Home permitidos y no los JPG fuente.
  Caso 124. Los JPG originales salieron de `public/`: ver «Activos y verdad».
- [x] Taxonomía 4/2×2/2×2 es contenido estático; no finge links. No hay
  `button` ni `a` en ese bloque: hoy no existe traducción inequívoca de
  «Maquinaria y campos» a un filtro real.
- [x] Preview muestra hasta tres operaciones reales y reutiliza anatomía,
  formato y acción existentes. Es `ProductCard` con una variante compacta:
  mismo `precioVisible`, misma `accionDe`, mismo `ProductImage`. El caso 124
  comprueba contra la base que cada título mostrado es una publicación activa.
- [x] Conteo usa `response.total`; no `30` ni el largo de la preview. El caso
  124 pide el total a la API y exige que el texto de la portada lo repita.
- [x] Título dice `Operaciones disponibles`, no `destacadas`.
- [x] Loading, éxito, vacío, error y offline coinciden con
  `ESTADOS-Y-DATOS.md`. Los cinco están implementados; el caso 124 prueba
  error (`No pudimos cargar las operaciones.`), sin conexión (`Sin conexión.
  Revisá tu red e intentá de nuevo.`) y la recuperación con `Reintentar`.
- [x] Publicar conserva login, toast y modal actuales. Sin sesión avisa y abre
  el ingreso; con sesión abre el alta de siempre.

## Servicios

- [x] No quedan video con overlay, lista hardcodeada ni claims de IA, satélites,
  IoT, eficiencia o sustentabilidad. El caso 125 falla si vuelve cualquiera de
  los seis textos o si aparece un `video` en la página.
- [x] Hero usa los dos derivados permitidos; no se amplía el archivo 960 px ni
  se presenta como foto de una publicación. Caso 125; el `alt` describe el
  relevamiento y no afirma que sea una publicación.
- [x] Preview usa publicaciones reales de servicio/logística y mantiene cards
  sin foto, según anatomía aceptada. El caso 125 consulta la base por cada
  título mostrado y exige `operation_kind` de servicio o logística, y que la
  tarjeta no dibuje ninguna imagen.
- [x] Cobertura, modalidad, responsable y precio/modalidad salen de datos. Son
  los campos que ya mostraba `ProductCard`: `coverageZones`, `pricingType`,
  vendedor y `precioVisible`. Ninguno se completa desde el título.
- [x] `Ver servicios publicados` fija `selectedType='servicios'` antes de
  navegar; el filtro queda visible y limpiable. Caso 125: el selector del
  mercado queda en `servicios` y todas las tarjetas son servicio o logística.
- [x] Loading, vacío, error y offline están diferenciados. El esqueleto de
  Servicios no reserva hueco de foto —un servicio no la tiene— y el error dice
  `No pudimos cargar los servicios.`, distinto del de Inicio (caso 125).
- [x] Publicar servicio conserva autenticación y alta actuales.

## Mercado

- [x] Búsqueda, filtros, URL, orden, grilla, detalle, carrito y cotización no
  pierden comportamiento. La suite completa pasa 125/125 desde base limpia y el
  hito 6/6.
- [x] Intro, canvas y acción coinciden con `mercado.html` sin sumar hero. La
  banda de entrada quedó en 144 px con título y bajada en la misma línea, con
  el copy exacto de `COPY.md`. No hay fotografía en el intro.
- [x] ProductCard mantiene cuatro anatomías; el prototipo no sustituyó el
  componente real. Lo único que se agregó es la variante compacta para las dos
  vistas previas.
- [x] Foto real/fallback, stock, precio, ubicación, vendedor y CTA mantienen la
  semántica aceptada de UX-2B. Casos 21 y 118-123 sin cambios.

## Activos y verdad

- [x] Sólo los cuatro archivos de `assets/produccion/` se copiaron; sus hashes
  coinciden con `ACTIVOS.md`. Verificado con `sha256sum` sobre
  `public/media/comercial/`: los cuatro coinciden.
- [x] Ningún `*-concepto.webp`, screenshot o lámina entra a `public/`, `src/`,
  seed, fixture o build. Los casos 124 y 125 registran cada pedido de la página
  y fallan si alguno termina en `-concepto.webp`.
- [x] Los JPG originales con EXIF/GPS no se sirven. **Estaban en `public/`**,
  que Vite publica entero: `DJI_0079.JPG` (5,9 MB con GPS), las dos tomas del
  relevamiento, `cosecha-01.jpg` y `video-servicios.mp4` (20,9 MB). Ninguno se
  usa ya: se movieron a `docs/pm/originales/`, con un README que explica de
  dónde vienen. Se movieron, no se borraron.
- [x] No aparece `destacada`, `verificado`, `garantizado`, `protegido`,
  `inspeccionado` ni promesa equivalente sin dato. El caso 124 vigila
  `destacad`; el resto no existe en las superficies nuevas.
- [x] No hay recursos externos automáticos, Unsplash, Picsum ni Google Fonts.
  Las nueve capturas registran **cero dominios externos** y cero pedidos
  fallidos; los casos 124 y 125 fallan ante cualquier host que no sea el propio.

## Responsive y acceso

- [x] 1440×900, 768×1024 y 390×844 cumplen `RESPONSIVE.md` sin overflow. Nueve
  combinaciones medidas: `scrollWidth === clientWidth` en todas. Se corrigió de
  paso `.tg-container`, que usaba el margen de escritorio en los tres anchos.
- [x] Acciones principales >=44×44; enlaces textuales cumplen WCAG 2.5.8.
  `--tg-control-min` sigue en 44 px y los botones nuevos usan `tg-button`.
- [x] Orden DOM/teclado es lógico; foco visible, Escape/restauración en capas
  existentes y nada depende de hover. En tablet y celular el hero cambia de
  orden con `flex-direction`, no con `order`, así que la lectura accesible
  sigue al DOM. El caso 123 exige anillo de foco en cada parada del tabulador.
- [x] Zoom 200 % conserva contenido y acción alcanzables. Caso 123, ahora con
  Inicio y Servicios además de catálogo, detalle, ingreso, carrito, checkout y
  panel: sin corte horizontal en ninguna.
- [x] Reduced motion no reproduce movimiento no esencial; hero sin autoplay.
  **Medido** con `prefers-reduced-motion: reduce`: cero elementos con
  transición o animación viva en cabecera y contenido, y cero `video` en la
  página. El video con overlay de Servicios se retiró.
- [x] Título largo, precio largo, cobertura larga y expansión de copy 30 % no
  rompen composición. El caso 124 publica un título de 140 caracteres, lo
  busca en la portada y exige que no desborde y que no se corte con puntos
  suspensivos.
- [x] axe: 0 serious/critical en las superficies afectadas y tres viewports.
  `npm run a11y`: 64 de 64 pantallas, cero violaciones de cualquier severidad.
- [x] `scrollWidth === clientWidth`, cero error de consola/página y cero recurso
  fallido en nueve combinaciones. Las tres superficies por los tres anchos,
  registrando errores de página, de consola y pedidos fallidos.

## Puertas del repo

- [x] `npm run build` — limpio.
- [x] `npm run lint` — 0 errores, 0 avisos.
- [x] `npm run contraste` — 52/52 mediciones, 0 incumplimientos.
- [x] `npm run a11y` — 64/64 pantallas, 0 violaciones.
- [x] `npm run hito` — 6/6 pasos encadenados.
- [x] suite completa desde base limpia — **126/126**, 0 fallos, según evidencia
  de Dev. PM no pudo repetirla porque Docker local permanece apagado.
- [x] `git -c core.whitespace=cr-at-eol diff --check` — limpio.

No rebajar, regrabar ni quitar inventarios para obtener verde. `smoke` sólo en
el entorno aislado previsto por el repositorio y sin arriesgar datos.

## Evidencia de cierre

- [x] Capturas nuevas de Inicio, Servicios y Mercado en tres viewports, en
  `docs/pm/ux2c/capturas/`, más página completa de Inicio y Servicios en 1440
  y 390.
- [x] Comparativa antes/después del índigo masivo y overlays: el «antes» son
  `docs/pm/ux2b/capturas/inicio-*.png` y `servicios-*.png`, tomadas en la
  entrega anterior; el «después» está en `docs/pm/ux2c/capturas/`.
- [x] Lista exacta de archivos de producto: en el informe.
- [x] Diferencias intencionales contra el handoff con responsable/fecha: abajo.
- [x] Informe en `docs/pm/PARA-PM.md` y commits auditables.
- [x] Revisión PM: código `cae6855`–`35eaf30`, aceptado técnicamente el
  2026-08-24; build, lint, sintaxis y checks estáticos reproducidos.
- [ ] Revisión visual final de Emi: **rechazada el 2026-08-24**; ver
  `../diseno-premium/DEVOLUCION-EMI-UX2C.md`.

## Diferencias intencionales

| # | Diferencia | Motivo | Responsable |
|---|---|---|---|
| 1 | En celular la navegación muestra las cinco secciones en dos filas, no tres con las otras dos ocultas. | El prototipo las esconde con `display: none`; PM lo prohibió por escrito —«no pueden perderse del DOM ni quedar sólo en hover»—. Se conserva la solución que ya existía: todas visibles, sin scroll horizontal. | dev, 2026-08-24 |
| 2 | Las tarjetas de la vista previa son `ProductCard` en variante compacta y no las `listing` del prototipo. | El contrato pide reutilizar anatomía, formato y acción, y prohíbe formatters o CTA paralelos. La variante sólo cambia que el activo de alto valor deja de ocupar la fila entera. | dev, 2026-08-24 |
| 3 | La acción de cada tarjeta de la portada es la real —`Iniciar operación`, `Agregar` con cantidad, `Solicitar cotización`— y no el texto `Ver operación` del prototipo. | Esa línea del prototipo describe una navegación; la tarjeta real ejecuta la acción aprobada en UX-2B. Cambiarla sería inventar un CTA paralelo. | dev, 2026-08-24 |
| 4 | Los originales sin uso salieron de `public/`. | «Los JPG originales con EXIF/GPS no se sirven» es criterio de aceptación, y todo lo que vive en `public/` se publica. Se movieron a `docs/pm/originales/`, no se borraron. | dev, 2026-08-24 |
| 5 | `.tg-container` pasa a usar los tres gutters —48, 32 y 20— en vez del de escritorio siempre. | Estaba en los tokens desde el primer handoff y el contenedor no lo aplicaba: en 390 px dejaba 294 px útiles y la cabecera se partía en tres líneas. | dev, 2026-08-24 |
| 6 | El hero de Inicio en celular muestra el copy primero y la foto después; en tablet, la foto primero. | Es lo que pide `RESPONSIVE.md` para cada ancho, resuelto con `flex-direction` y no con `order`, para que la lectura accesible siga al DOM. | dev, 2026-08-24 |

## Corrección del borde de escala (2026-08-24)

PM no aceptó el cierre por un borde que el seed de 30 filas no puede detectar:
la vista previa de Servicios pedía cien publicaciones y filtraba en el
navegador, y el mercado hacía lo mismo con `selectedType`. Con más de cien
publicaciones nuevas encima, los dos afirmaban que no había servicios.

- [x] `GET /api/catalog/products` acepta `publication_type` (`producto` o
  `servicio`), validado por patrón y aplicado **antes** del conteo y de la
  paginación. Sin migración ni cambio de esquema.
- [x] `getProducts` expone el parámetro.
- [x] La vista previa de Servicios pide `publication_type=servicio` y sólo tres
  publicaciones; ya no descarga cien. La defensa de dominio del frontend se
  conserva.
- [x] El mercado manda el filtro cuando el tipo es `productos` o `servicios`, y
  `selectedType` pasó a ser dependencia del efecto: antes cambiar de tipo no
  volvía a pedir nada.
- [x] **Caso 126**: publica un servicio, lo tapa con 101 publicaciones más
  nuevas y exige que el endpoint filtrado devuelva sólo servicios, que su total
  sea el filtrado y no el del catálogo, que un tipo inválido dé 422, y que
  tanto la vista previa como el mercado filtrado encuentren el servicio
  tapado. Sin el filtro en la base, el caso se cae.
- [x] La deuda de paginación queda registrada aparte, en
  `DEUDA-PAGINACION.md`.
