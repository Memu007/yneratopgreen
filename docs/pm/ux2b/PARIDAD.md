# Paridad diseño ↔ implementación — UX-2B

Copia de `docs/pm/diseno-premium/handoff/PARIDAD.md` con la columna de
**desarrollo** completada. El original queda intacto: es el entregable de
Diseño y las dos filas de revisión —Emi y PM— son de ustedes, no mías.

- Completó: dev, 2026-08-23.
- Cada ítem marcado dice **con qué se comprobó**. Los que no pude comprobar
  quedan sin marcar y explicados; ninguno se marca «por inspección visual».
- Los comandos son los del repositorio: `npm run build`, `npm run lint`,
  `npm run contraste`, `npm run a11y`, `npm run hito`, `npm run smoke`.

## Identidad y fundamentos

- [x] **Wordmark correcto por fondo, sin deformación y con área de seguridad.**
  Compacto en la cabecera sobre porcelana (`/marca/topgreen-compact.svg`, 254 px
  en escritorio y 196 px en celular, dentro del rango recomendado de 196–254);
  monocromo claro en el pie sobre índigo (`topgreen-mono-light.svg`, 360 px).
  Se sirven con `width`/`height` del `viewBox` y `height: auto`, así que no hay
  deformación posible. Los cuatro SVG conservan el SHA-256 de `ACTIVOS.md`.
- [x] **Newsreader y Work Sans self-hosted, pesos reales y fallbacks activos.**
  `public/fuentes/*.woff2`, subseteadas desde los TTF del paquete con los hashes
  verificados; ejes `wght 400–600` y `400–700` comprobados leyendo la tabla
  `fvar` del archivo resultante. Sin pedido a Google Fonts: la captura de
  catálogo, detalle y panel a los tres anchos registra cero pedidos fallidos y
  cero externos. Respaldos declarados en `--tg-font-display` y `--tg-font-ui`,
  con `font-display: swap`. Fuera de esas pantallas quedaban cinco fotos de
  Unsplash —portada, «Misión y visión» y tres tarjetas de Servicios— que se
  retiraron: hoy `grep -rEn "https?://" src index.html` no devuelve ninguna URL
  de recurso que la página pida sola. Lo que queda son tres enlaces de WhatsApp
  que abre la persona, dos comprobaciones de protocolo en código, los espacios
  de nombres de los SVG y `src/data/mockData.ts` —que no lo importa nadie, no
  llega a la pantalla y queda declarado como deuda en el informe—.
- [x] **Colores, espacios, radios, bordes, foco y motion consumen tokens.**
  `src/tokens.css` es la única fuente de valores; los nombres viejos quedaron
  como alias sin valor propio. Comprobable: `grep -rn "var(--marca-" src` no
  devuelve nada, y ningún módulo define un color literal nuevo.
- [x] **No aparecen verde/beige/hoja, degradado, glass, sombra de tarjetas o
  iconografía genérica fuera del sistema aprobado.** Los degradados quedaron
  como alias planos del color de acción; las tarjetas y paneles llevan
  `box-shadow: none` y la sombra sobrevive sólo en capas. Los 218 pictogramas
  de la superficie se retiraron.
- [x] **Contrastes mantienen AA; foco y borde de control alcanzan 3:1.**
  `npm run contraste`: 52 de 52 mediciones exigidas, **cero** textos por debajo
  del mínimo, en escritorio, tablet y celular. Y una medición aparte, porque esa
  puerta mide texto y no cajas: en diez pantallas —las cuatro públicas, mercado,
  detalle, ingreso, panel, carrito y checkout— ningún botón queda del mismo
  color que el fondo que tiene detrás. Los dos que sí lo estaban —«Ver el
  mercado» y «Contactar Ahora», índigo sobre índigo— quedaron corregidos.

## Contenido y confianza

- [x] **Precio, moneda, unidades, fecha y ubicación pasan por formatters de
  locale.** `src/utils/formatters.ts` usa `Intl.NumberFormat` e
  `Intl.DateTimeFormat` con el locale como constante única, espacio duro entre
  símbolo y cifra y entre cantidad y unidad, y fecha corta `22 ago 2026`.
  **También el panel del vendedor**, que hasta la corrección imprimía precios
  con su propio `toLocaleString` y «Stock: N unidades» a mano: caso 120.
- [x] **`A cotizar` reemplaza precio inexistente/0 cuando corresponda.**
  `precioVisible()` es el único camino a pantalla. Las tres publicaciones del
  seed con `a_convenir` muestran `A cotizar` y no `$ 0`.
- [x] **Calificaciones, ventas y documentación reflejan datos reales, incluido
  0.** Cero calificaciones dice «Sin calificaciones aún»; las ventas sólo
  aparecen con `salesCount > 0`; «Documentación revisada» sigue atado al
  booleano real.
- [x] **Ningún claim prohibido de `COPY.md` aparece en UI, fixtures o
  metadata.** Se retiraron «El marketplace líder del agro argentino», «una
  plataforma segura y confiable» y el `<meta description>` que prometía comprar
  «de forma segura».
- [x] **Título largo, ubicación larga y botones traducidos no se truncan de
  forma engañosa ni generan overflow.** Los títulos usan
  `overflow-wrap: anywhere` sin `text-overflow`, el precio lleva
  `word-break: keep-all` para no partirse entre dígitos, y las tres capturas
  miden `scrollWidth === clientWidth`.

## Cuatro anatomías

- [x] **Activo de alto valor prioriza condición y usa `Iniciar operación`.**
- [x] **Insumo permite cantidad/stock y usa `Agregar` sólo cuando procede.**
- [x] **Servicio muestra alcance/modalidad y cotización sin simular compra
  cerrada.** Muestra cobertura, modalidad y respuesta —datos que estaban en la
  base y no salían—; con precio publicado usa `Contratar` con el carrito y el
  checkout de siempre, y sin precio dice `A cotizar` y ofrece `Solicitar
  cotización` hacia Contacto. **PM lo decidió así el 2026-08-23** y actualizó
  `ANATOMIAS.md` y `COPY.md`; no hay compra simulada ni mensajería prometida.
  El panel del vendedor muestra lo mismo: caso 120.
- [x] **Logística muestra equipo/capacidad/cobertura; transportistas
  compatibles sólo aparecen en checkout después del destino.** La publicación
  de logística muestra lo que declara —cobertura, modalidad, respuesta—; no hay
  directorio público y `Ver transportistas` sigue viviendo sólo en el checkout.
  Lo comprueban los casos 111 y 112 de la suite y el paso 3 del hito.
- [x] **La regla que asigna anatomía está en dominio/datos, no sólo en
  CSS/precio.** `products.operation_kind`, declarada en el alta y validada
  contra `category.is_service`. Casos 118 y 119.

## Componentes y estados

- [x] **Header anónimo, comprador, vendedor y admin preserva acciones y
  sesión.** Las cuatro variantes las recorren `a11y` y `contraste` en los tres
  anchos, y la suite entra por cada una.
- [x] **Filtros dependen de API; provincia/localidad y limpiar funcionan.**
  Paso 1 del hito: catálogo filtrado por categoría y localidad oficial, con
  pantalla, API y SQL diciendo lo mismo.
- [x] **Inputs, selects, checkboxes, radios, textarea y upload tienen label,
  ayuda, validación y estados disabled/error.** Se asociaron catorce etiquetas
  del formulario de edición que no tenían `htmlFor`.
- [x] **Modal/drawer atrapa y restaura foco; cierra por Escape cuando
  corresponde.** `useCapaModal`, aplicado a las nueve capas. Antes ninguna lo
  hacía.
- [x] **Tabs y tablas tienen semántica; tablas no rompen mobile.** La tabla
  técnica del detalle pasa a pares rótulo/valor por debajo de 600 px.
- [x] **Toasts se anuncian y no dependen del color.** Región viva `role=status`
  más un rótulo en palabras.
- [x] **Loading, vacío, error, offline, disabled, sin stock, pausado, sin foto,
  sin datos.** El mercado no tenía estado de error: cualquier falla terminaba
  en la lista vacía con «No hay operaciones con estos filtros», que afirma algo
  que nadie comprobó. Ahora una caída del servidor dice que no pudimos cargar y
  ofrece reintentar, y sin red dice exactamente `Sin conexión. Revisá tu red e
  intentá de nuevo.`. Los dos estados y la navegación viva durante el error los
  comprueba el caso 122.

## Responsive y acceso

- [x] **1440×900 coincide en jerarquía y densidad con la referencia.**
- [x] **768×1024 cambia filtros y grilla según `RESPONSIVE.md`.**
- [x] **390×844 conserva contenido/acción y no tiene overflow horizontal.**
  Medido: `scrollWidth === clientWidth` en los tres.
- [x] **Orden DOM y tabulación es lógico; no se usa CSS para alterar lectura.**
  El panel de filtros es un solo DOM en los tres anchos; lo que cambia es si
  está plegado, no el orden.
- [x] **Acciones y controles principales tienen targets ≥44×44 px.**
  `--tg-control-min` en botones, campos y casillas; la casilla incluye su texto.
- [x] **Enlaces textuales, breadcrumbs, tablero y pie cumplen WCAG 2.5.8.**
- [x] **Ningún flujo depende de hover.** El hover sólo cambia color o borde.
- [x] **Zoom 200 % y texto aumentado siguen operables.** Medido, no
  inspeccionado: el caso 123 recorre catálogo, detalle, ingreso, carrito,
  checkout y panel a 640×360 —lo que queda de 1280×720 al 200 %— y exige que no
  haya corte horizontal, que la acción principal siga visible, habilitada y
  dentro del ancho, y que cada parada del tabulador muestre el anillo de foco.
  Encontró dos defectos reales, ya corregidos: la cabecera pegajosa tapaba la
  primera tarjeta del catálogo, y nueve reglas de formulario apagaban el anillo
  de foco con `outline: none`.

## Imágenes y activos

- [x] **Foto real conserva relación, alt y evidencia.** Y no queda ninguna foto
  que no sea de la clienta o del vendedor: las cinco de stock que se pedían a
  Unsplash se retiraron (diferencia 7).
- [x] **La fotografía es opcional de verdad.** El alta la exigía —bloqueaba
  publicar sin una imagen y rotulaba la sección con `*`—, y el handoff la
  declara opcional con respaldo neutro. Ahora se publica sin foto y el catálogo
  y la ficha dicen «Sin fotografía»: caso 121. La validación de tipo y tamaño
  sigue donde estaba para lo que sí se adjunta.
- [x] **Ausencia de URL usa `no-photo.svg`; error usa `photo-broken.svg`.**
  Con textos distintos —«Sin fotografía» y «No pudimos cargar la imagen»— que
  el caso 21 de la suite exige por separado.
- [x] **Todo asset nuevo tiene fuente, licencia y aprobación en `ACTIVOS.md`.**
  Los ocho hashes verificados antes de copiar; las fuentes con su OFL y el
  procedimiento de subset en `public/fuentes/README.md`.
- [x] **Las capturas y referencias conceptuales no se empaquetan como
  producción.** Nada de `docs/pm/diseno-premium/` entra al build.

## Función preservada

- [x] **Rutas/secciones, búsqueda, filtros, detalle, carrito, checkout y sesión
  mantienen comportamiento.**
- [x] **Publicar, editar, upload, perfil, operaciones, traslado, documentación,
  administración, contacto y pagos no pierden estados ni validaciones.**
- [x] **No se agregó chat, escrow, tasación, directorio público, verificación
  ni solicitud por publicación sin alcance aprobado.**
- [x] **`build`, `lint`, `contraste`, `a11y` y `hito` pasan.** `lint` estaba en
  rojo en `main` antes de esta pieza.
- [x] **`smoke` pasa en entorno aislado y sin arriesgar datos.**

## Diferencias intencionales

| # | Diferencia | Motivo | Responsable |
|---|---|---|---|
| 1 | Un servicio **con precio publicado** se contrata por carrito y checkout en vez de derivar a `Solicitar cotización`. | `COPY.md` manda cotización para todo servicio, pero eso saca del circuito a 14 de 17 servicios activos que hoy tienen precio real, y el camino de compra de un servicio funciona de punta a punta —lo recorre la suite; los ítems de orden con servicios que llegué a contar salían de mi base local de pruebas, no de uso de clientes—. La orden decía frenar antes de redefinir qué es comprable. Sólo se cerró el caso `A cotizar`, que hoy dejaba pasar una orden de $0. | dev, 2026-08-23 — **PM lo aprobó el 2026-08-23** y actualizó `COPY.md` y `ANATOMIAS.md` |
| 2 | La **condición** del activo es opcional, no obligatoria. | El catálogo aprobado tiene dos categorías de activo donde «nuevo o usado» no significa nada: «Bienes y Ganado» y «Tierras y parcelas». Obligarla haría que el vendedor conteste cualquier cosa para poder publicar. | dev, 2026-08-23 — **PM lo aprobó el 2026-08-23**: no se exige un dato falso en el MVP |
| 3 | La tarjeta de **activo** no muestra año, horas ni potencia. | El backend entrega `features: {}`: no hay características estructuradas. `ANATOMIAS.md` las declara opcionales y manda omitir la fila en vez de inventarla. | dev, 2026-08-23 |
| 4 | No hay **ID de operación** en el detalle. | `ANATOMIAS.md` lo lista como opcional y el modelo no tiene un identificador de operación para mostrar. | dev, 2026-08-23 |
| 5 | La **navegación** suma `Mercado` y usa `Quiénes somos` acentuado. | `Mercado` no es un destino nuevo: hasta ahora la única forma de volver al catálogo era hacer clic en la marca. | dev, 2026-08-23 |
| 6 | `Inicio`, `Quiénes somos` y `Servicios` reciben marca, fuentes, tokens, cabecera, pie y controles, pero **conservan su composición**. | La orden lo pide así: Diseño no entregó esas páginas. | dev, 2026-08-23 |
| 7 | En `Inicio` y `Quiénes somos` el fondo fotográfico pasa a ser el índigo del sistema, y tres de las cinco tarjetas de `Servicios` quedan con «Sin fotografía». | Eran cinco fotos de stock pedidas a `images.unsplash.com` **en cada visita**: fotos temporales y una dependencia externa, las dos prohibidas por la orden. Los dos fondos ya iban tapados por una banda al 85–88 %. Las dos fotos propias de la clienta se conservan. | dev, 2026-08-23 |
| 8 | `Contacto` ya no muestra el bloque «Seguinos en Redes». | Los tres enlaces iban a `twitter.com`, `linkedin.com` e `instagram.com`: dominios pelados, no perfiles de TopGreen. Enlaces falsos. Vuelven el día que existan perfiles reales. | dev, 2026-08-23 |
| 9 | Con la ventana de menos de 480 px de alto, la cabecera deja de ser pegajosa. | Al 200 % de zoom ocupa 194 px de los 360 disponibles y tapaba la primera tarjeta del catálogo, que quedaba imposible de tocar. Es la misma decisión que ya estaba tomada para el celular, con el alto como disparador. | dev, 2026-08-23 |
| 10 | La sección del panel se llama «Mis publicaciones» y el botón dice «+ Publicar». | Lo pidió PM el 2026-08-23: la sección lista productos y servicios, y llamarla «Mis Productos» dejaba a los servicios afuera del nombre. | PM, 2026-08-23 |

## Evidencia de aceptación

- [x] **Comparativa visual de catálogo, detalle y estados en los tres
  viewports.** En `docs/pm/ux2b/capturas/`.
- [x] **Registro de diferencias intencionales con responsable y fecha.** Arriba.
- [ ] **Revisión de Emi**: nombre, fecha y resultado.
- [x] **Revisión de PM**: GPT-5.6 Sol, 2026-08-23 — aceptada técnicamente tras
  revisar `177cdb2`, los casos 119–123 y las capturas nuevas; build aislado,
  lint, sintaxis y checks estáticos reproducidos en verde. Suite y puertas de
  navegador quedan como evidencia de Dev porque Docker local está apagado.
