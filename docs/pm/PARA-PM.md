# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-23. Vigésimo segundo informe: **UX-2B, corrección de cierre**.

Los cinco puntos corregidos, `src/data/mockData.ts` retirado, y cuatro casos de
navegador nuevos que dejan la evidencia adentro de la suite en vez de en una
captura. No abrí UX-3, no rediseñé nada, no toqué pagos y no desplegué.

| Commit | Qué trae |
|---|---|
| `177cdb2` | Los cinco puntos, `mockData.ts` afuera y los casos 120–123 |
| este | Este informe |

---

## 1. Integridad producto/servicio

Tenías razón y era peor de lo que decía tu revisión.

**Lo que faltaba.** `publication_type` decide qué guarda la fila —stock, o los
campos de servicio— y `category.is_service` decide cómo se cobra. Nadie los
obligaba a decir lo mismo. Se podía crear una publicación «producto» dentro de
una categoría de servicios: la fila guardaba stock y ningún campo de servicio,
la interfaz la leía como servicio y el cobro la trataba como servicio. Una fila
que dice dos cosas a la vez.

**Lo que hice.**

- **En el alta**, las dos combinaciones cruzadas se rechazan con **mensajes
  distintos**, uno por cada dirección: «la categoría es de servicios y esta
  publicación es de tipo producto» y su simétrico. No se convierte nada: la
  conversión cambiaría en silencio lo que el vendedor publicó.
- **En la edición**, como `publication_type` no es editable, se rechaza mover la
  categoría al otro lado, con un tercer mensaje propio. La validación corre
  **antes** de tocar el modelo, así que la fila no muta: el caso lo comprueba
  leyendo `category_id`, `operation_kind`, `publication_type` y `stock` antes y
  después del rechazo y exigiendo que sean idénticos.
- El chequeo sólo mira cuando la categoría **cambia de verdad**: una publicación
  vieja que ya venía cruzada tiene que poder seguir editándose para corregir el
  resto.
- En la interfaz no hace falta nada: el campo de categoría de la edición ya está
  deshabilitado y dice «La categoría no se puede cambiar».

**Lo que apareció al medirlo.** El caso ahora exige además que **ninguna fila de
la base** esté cruzada, y esa aserción se puso roja: había **seis**. Cinco las
creaba la propia suite. Un ayudante de los casos monetarios elegía categoría con
`SELECT id FROM categories ORDER BY name LIMIT 1`, que devuelve «Acopio», que es
de servicios, y publicaba ahí un «producto» con stock. Nuestras propias pruebas
venían fabricando el defecto que vos encontraste. El ayudante ahora filtra por
`is_service = false`.

El caso 119 quedó reescrito para **discriminar los tres rechazos**: comprueba que
los tres mensajes existan, que digan cosas distintas y que no se confundan entre
sí. Y una corrección a lo que te dije la vez pasada: mover una publicación de
categoría **dentro del mismo lado** ya no adopta la anatomía de la categoría
nueva, conserva la declarada. La categoría sólo decide la omisión de quien no
declaró nada; pisar la declaración del vendedor sería otra forma de cambiarle la
publicación sin avisar.

---

## 2. «Mis publicaciones» respeta la anatomía

**Lo que mostraba.** La tarjeta del panel imprimía siempre foto, precio con su
propio `toLocaleString` y `Stock: N unidades`. Sobre «Muestreo de Suelo» eso era
triple mentira: el stock de un servicio es `NULL` en la base —ese «3000» salía
del formato, no de un dato—, la foto no existe, y el precio no pasaba por el
formateador que dice `A cotizar`.

**Lo que hace ahora.** La anatomía manda, igual que en el catálogo:

| | Activo / Insumo | Servicio / Logística |
|---|---|---|
| Fotografía | sí, con respaldo si falta | no |
| Stock | `Stock: 3.000 kg`, con su unidad | no |
| Precio | por `precioVisible()` | por `precioVisible()`; sin precio, `A cotizar` |
| Modalidad | — | `Por hectárea`, `A convenir`… por `etiquetaDeCatalogo()` |

Cada tarjeta lleva además la anatomía escrita —ACTIVO DE ALTO VALOR, INSUMO
ESTANDARIZADO, SERVICIO, LOGÍSTICA—, que es lo que decide qué se muestra y el
vendedor tenía que poder verlo sin abrir la edición.

`precioVisible()` pasó a aceptar cualquier cosa que tenga precio, no sólo un
`Product` completo, para que la regla viva en un solo lugar. De paso, los cuatro
importes de las órdenes del panel dejaron su formato propio y usan `formatPrice`.

**Los rótulos.** «Mis Productos» → «Mis publicaciones»; «+ Publicar Producto» →
«+ Publicar»; el vacío dice «Todavía no publicaste nada. Acá vas a ver tus
productos y tus servicios publicados.». Nada más: el panel no se rehízo.

Lo prueba el **caso 120**, y lo probé al revés antes de darlo por bueno: forzando
`deServicio = false` la tarjeta vuelve a decir «Sin fotografía» y `Stock: 10.000
tonelada` sobre una publicación de logística. Ese es el defecto que viste.

**Y saqué la captura antes de darla por terminada, que es lo que faltó la vez
pasada.** Encontró tres cosas más, todas en esa misma pantalla:

1. **El distintivo de estado se había ido a la esquina del panel.** Al sacarle la
   caja de la foto, el distintivo —que es `position: absolute`— se quedó sin
   ancestro posicionado y aterrizó arriba a la derecha del modal, encima del
   botón de cerrar. Mi regla nueva perdía por orden de aparición contra la
   vieja, con la misma especificidad. Ahora es un descendiente y el caso 120
   exige que el distintivo esté **dentro** de la tarjeta.
2. **Una tercera copia del respaldo verde en data-URI.** La del catálogo la
   retiré en la entrega anterior; el panel tenía la suya —«Sin Imagen» en Arial
   sobre verde claro— y la administración una más, de 50×50. Las dos se fueron:
   manda `ProductImage`, que dice «Sin fotografía». El caso 120 exige además que
   ninguna imagen del panel venga en `data:`.
3. **Todos los servicios se mostraban «Agotado».** La columna `stock` tiene 0
   por omisión, el alta le pasa `NULL` para un servicio y la base guarda 0; el
   panel derivaba «agotado» de ese cero. Un servicio no reserva unidades, así
   que no se agota: ahora el estado sólo mira el stock donde hay stock.
4. **Y una cuarta, que encontró `a11y` y no la captura**: los tres distintivos
   de estado tenían todavía sus colores literales en `rgba` —la pasada de color
   mapeó hexadecimales—, y el verde oliva con texto blanco da **2,3:1**.
   Mientras el distintivo vivía sobre la fotografía nadie podía medirlo; al
   salir a fondo claro la puerta lo vio de inmediato. Ahora usan los tokens de
   estado. Es el mismo patrón que ya me pasó con el mapeo: **mover algo de
   lugar no lo arregla, lo hace medible**.

---

## 3. La fotografía es opcional de verdad

El alta bloqueaba con «Por favor agrega al menos una imagen» y rotulaba la
sección con asterisco. `ANATOMIAS.md` la declara opcional con respaldo neutro, y
exigirla empuja al vendedor a subir cualquier cosa para poder vender.

Ahora la sección dice «Fotografías del producto (opcional)» y explica qué pasa si
no subís ninguna. **La validación de tipo y de tamaño no se tocó**: el frontend
sigue filtrando lo que no es imagen y el backend sigue rechazando extensiones
fuera de `.jpg/.jpeg/.png/.webp` y archivos de más de 5 MB.

El **caso 121** publica desde el navegador sin adjuntar un solo archivo,
comprueba que la publicación quede con **0 imágenes** en la base, y que el
catálogo y la ficha digan «Sin fotografía» —y no «No pudimos cargar la imagen»,
que es la otra cosa—.

---

## 4. Estado sin conexión

El mercado **no tenía estado de error**. Cualquier falla —servidor caído, red
cortada— terminaba en la lista vacía con «No hay operaciones con estos filtros»,
que afirma algo que nadie comprobó.

- Sin red (`navigator.onLine === false`): **`Sin conexión. Revisá tu red e
  intentá de nuevo.`**, textual.
- Cualquier otra falla: «No pudimos cargar el mercado. Volvé a intentarlo en un
  momento.». No se disfraza de problema de red: mandar a revisar el módem cuando
  el módem anda es hacerle perder el tiempo a la persona.
- Los dos avisos son `role="alert"` y traen **Reintentar**, que vuelve a
  preguntar sin recargar la página.

El **caso 122** prueba los dos estados en la misma corrida: primero interviene
sólo el pedido del catálogo con un 500 —con red presente—, después usa el modo
sin conexión del navegador. Comprueba que ninguno de los dos se confunda con el
catálogo vacío, que **la navegación siga viva con el error a la vista** —sale a
Quiénes somos y vuelve— y que reintentar recupere el catálogo de verdad.

---

## 5. Zoom 200 %: medido, y encontró dos defectos

**Cómo se mide.** El zoom del navegador al 200 % deja la mitad de píxeles CSS:
una pantalla de 1280×720 queda en 640×360. El **caso 123** recorre catálogo,
detalle, ingreso, carrito, checkout y panel a ese tamaño y exige tres cosas por
pantalla: sin corte horizontal (`scrollWidth === clientWidth`), acción principal
visible, habilitada y dentro del ancho, y **anillo de foco visible en cada parada
del tabulador**.

Encontró dos defectos reales:

1. **La cabecera pegajosa tapaba el catálogo.** 194 px de los 360 disponibles, y
   pegada arriba: la primera tarjeta quedaba debajo y **no se podía tocar** —el
   navegador la traía a la vista y la cabecera se la comía—. Con menos de 480 px
   de alto la cabecera deja de ser pegajosa. Es la misma decisión que ya estaba
   tomada para el celular; lo que cambia es el disparador, porque al 200 % el
   ancho sigue siendo de escritorio.
2. **Nueve reglas apagaban el anillo de foco.** `outline: none` en los campos del
   checkout, del alta, de la administración, del ingreso, de contacto y del
   panel: cambiaban el color del borde y listo. Quien navega con teclado perdía
   la referencia. Se quitaron las nueve; el borde de marca se conserva **además**
   del anillo.

Una tercera cosa era mía y no del producto: el anillo entra con una transición de
0,2 s y mi primera medición lo leía en el mismo instante del Tab, así que veía
0 px de ancho en todas partes. El instrumento espera a que el anillo termine de
dibujarse.

---

## 6. `mockData.ts`

Retirado. Eran diez publicaciones inventadas con fotos de Unsplash; no lo
importaba nadie y no llegaba al build, pero estaba versionado en un repositorio
que se entrega. `npm run build` y `npm run lint` siguen limpios sin él.

---

## 7. Puertas

| Puerta | Resultado |
|---|---|
| `npm run build` | limpio |
| `npm run lint` | **0 errores, 0 avisos** |
| `npm run contraste` | **52/52** mediciones, **0** incumplimientos |
| `npm run a11y` | **64/64** pantallas, **0** violaciones |
| `npm run hito` | **6/6** pasos encadenados |
| suite completa desde base limpia | **123/123**, 0 fallos |
| `git -c core.whitespace=cr-at-eol diff --check` | limpio |

Migración y seed corrieron de nuevo en la misma pasada —base borrada y creada
desde cero— sólo para confirmar que siguen verdes: **no hay migración nueva**,
el esquema no cambió en esta corrección.

Los cuatro casos nuevos (120–123) se escribieron en rojo primero. Dejo el rojo de
cada uno porque es lo que dice qué se está midiendo:

- **119**: «la API no respondió HTTP 400» con el backend anterior.
- **120**: `Stock: 10.000 tonelada` y «Sin fotografía» sobre una publicación de
  logística.
- **121**: el rótulo de las fotos no decía «opcional» y el formulario no dejaba
  publicar.
- **122**: no existía ningún `role="alert"` que esperar.
- **123**: la cabecera pegajosa interceptaba el clic en la primera tarjeta.

---

## 8. Capturas

`docs/pm/ux2b/capturas/mis-publicaciones-1440x900.png` y
`mis-publicaciones-390x844.png`, con el seed limpio: se ven las cuatro anatomías
en el panel y los servicios sin stock ni foto. Las demás capturas de la entrega
anterior quedan como estaban.

---

## 9. Lo que dejo dicho

- **Los servicios guardan un stock que no significa nada.** El seed les escribe
  un número —16 publicaciones— y el alta por API les deja 0, porque la columna
  tiene ese valor por omisión y `NULL` no lo desactiva. No cambia el cobro, que
  lo decide `is_service`, y ya no se muestra en ninguna pantalla; pero es un dato
  que miente y ya produjo un defecto visible («Agotado» en todos los servicios).
  Sacarlo pide tocar el modelo y el seed, que no estaban en la orden: queda
  anotado para decidirlo.
- **`PARIDAD.md` quedó con todas las casillas marcadas menos las dos revisiones,
  que son tuyas y de Emi.** Las cuatro que estaban sin marcar —anatomía de
  servicio, formato del panel, offline y zoom— ahora tienen evidencia: los casos
  120, 121, 122 y 123.
- Sumé dos diferencias intencionales: la cabecera que se suelta con la ventana
  baja, y el renombre de la sección del panel, que fue tu pedido.

Vuelvo a PM.
