# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-24. Vigésimo tercer informe: **UX-2C, extensión comercial agro
«A — Mercado a cielo abierto»**.

Tres commits de producto y este informe. Inicio y Servicios dejaron de ser una
placa índigo con claims; el mercado quedó en la misma temperatura sin perder una
sola función.

| Commit | Qué trae |
|---|---|
| `cae6855` | Fundación: tokens comerciales y los cuatro activos autorizados |
| `dc40762` | Cabecera por contexto, Inicio, Servicios y el mercado |
| `ddcd1ff` | Estados medidos, márgenes responsivos y evidencia |
| este | Este informe |

29 archivos de producto y documentación, más 13 capturas.

---

## 0. Antes de nada: el entorno se perdió y hubo que reconstruirlo

El contenedor se reinició entre ciclos y se llevó todo lo que no estaba
versionado: el repositorio clonado, PostgreSQL, PostGIS, el entorno de Python,
`node_modules` y mis guiones locales. Reconstruí: clon nuevo —ahora en
`/home/user/yneratopgreen`—, PostGIS instalado, base recreada, migraciones,
seed, y el puente local que traduce el `docker exec` de las puertas a la
instalación nativa.

Una sola cosa quedó resuelta con un rodeo: **Playwright 1.62 pide una compilación
de Chromium que este entorno no trae y cuya descarga está bloqueada**. En vez de
tocar el repositorio, apunté la versión que Playwright espera a la Chromium que
el entorno ya tiene. Las puertas corren con el navegador del entorno; el
repositorio no cambió por esto.

---

## 1. Qué cambió en cada superficie

### Inicio

Se fueron la placa índigo, «Bienvenido a TopGreen», los tres beneficios con
iconos y los tres claims —tecnología con inteligencia artificial, mecanización
y confianza respaldada por alianzas con empresas líderes—.

Quedó: hero en dos columnas con la fotografía de cosecha **sin nada encima**,
las cuatro clases de operación como contenido, `Operaciones disponibles` con
publicaciones reales, el bloque de datos que definen una operación, y el cierre
para publicar.

### Servicios

Se fueron el video con overlay índigo, la lista de cinco servicios escrita a
mano y todos los claims: inteligencia artificial, satélites, IoT,
sustentabilidad, eficiencia y alianzas. Quedó el hero con la foto de
relevamiento —la interina, sin ampliar—, `Servicios activos` con publicaciones
reales de servicio y logística, el bloque de comparación y el cierre.

### Mercado

No perdió nada: filtros, búsqueda, orden, grilla, detalle, carrito, checkout,
cotización, sesión, roles y callback de Mercado Pago siguen como estaban. Cambió
la temperatura —canvas, acción, link—, el copy de la entrada y la densidad de la
banda de intro.

### Cabecera

Dos variantes de la misma cabecera, no dos componentes: fuera del mercado entra
en una sola banda; adentro el buscador manda arriba y las secciones bajan a la
segunda.

---

## 2. Los datos, que es donde se gana o se pierde

- La vista previa pide el **catálogo canónico**, el mismo del mercado y en el
  mismo orden. No hay endpoint nuevo ni lista guardada en código.
- El conteo de Inicio es `response.total`. El caso 124 le pregunta el total a la
  API y exige que la portada repita ese número: si alguien vuelve a escribir 30
  a mano, el caso se cae.
- **No hay «destacadas»**. El producto no tiene dato de curaduría; llamarlas así
  sería inventar un criterio.
- Servicios filtra por `operationKind` —la regla de dominio de todo el producto—
  y nunca por título ni por precio. En ese caso la vista previa **no publica un
  total**: el total de la respuesta cuenta el catálogo entero, y usarlo diría
  «12 servicios» sobre un número que no son servicios.
- `Ver servicios publicados` fija `selectedType('servicios')` **antes** de
  navegar. Escribir el tipo en la URL no alcanza, como decía tu contrato: el
  hook ya está montado y lee su estado. El caso 125 lo comprueba mirando el
  selector del mercado y las anatomías que quedan a la vista.
- Las tarjetas de la vista previa **son `ProductCard`**, en variante compacta:
  mismo `precioVisible`, misma `accionDe`, mismo respaldo de fotografía, mismas
  cuatro anatomías. Lo único que cambia es que el activo de alto valor deja de
  ocupar la fila entera, porque en una grilla de tres columnas no hay fila
  entera.

---

## 3. Lo que medí, además de las puertas

Tres criterios del contrato que ninguna puerta del repositorio cubría:

| Criterio | Límite | Medido |
|---|---|---|
| Superficie rellena con índigo o rojo en el primer viewport | ≤ 8 % | **0,70 %** en Inicio, **0,79 %** en Servicios |
| Placa oscura continua | ≤ 64 px | **44 px** (el botón de acción) |
| Overlay sobre fotografía | 0 % | 0 %, comprobado preguntando qué elemento hay en el centro de la foto |
| Movimiento con `prefers-reduced-motion` | ninguno | cero elementos con transición o animación viva; cero `video` |
| Recursos externos | cero | **cero dominios externos** en las nueve combinaciones |

Las nueve combinaciones son las tres superficies por los tres anchos, y en todas
`scrollWidth === clientWidth`, cero errores de página, cero errores de consola y
cero pedidos fallidos.

---

## 4. Tres cosas que encontré arreglando esto

1. **El margen lateral nunca fue responsivo.** `.tg-container` usaba el gutter de
   escritorio en los tres anchos. Los tres valores —48, 32 y 20— están en los
   tokens desde el primer handoff; el contenedor no los aplicaba. En 390 px eso
   dejaba 294 px útiles y partía la cabecera en tres líneas: la marca en una, el
   botón en otra, las secciones en tres filas. Con el margen correcto la
   cabecera bajó de 346 a 199 px.
2. **`public/` estaba sirviendo los originales.** Vite publica esa carpeta
   entera. Ahí vivían `DJI_0079.JPG` —5,9 MB, con GPS en el EXIF—, las dos tomas
   del relevamiento, `cosecha-01.jpg` y el `video-servicios.mp4` de 20,9 MB que
   esta pieza retiró. Ninguno se usa ya y `ACTIVOS.md` prohíbe servir los JPG
   fuente. Los moví a `docs/pm/originales/` con un README que dice de dónde
   vienen: **se movieron, no se borraron**, porque son material de la clienta y
   la fuente de los derivados aprobados.
3. **Dos casos de la suite leían de más.** Los casos 54 y 57 afirman algo sobre
   el panel del transportista y lo medían sobre `body` entero. Con la portada
   mostrando operaciones reales —con su precio y su localidad— esa lectura
   mezclaba la vitrina de atrás con el panel. Los acoté al panel, que es lo que
   dicen medir. No se debilitó ninguna aserción: la propiedad quedó más precisa.

---

## 5. Puertas

| Puerta | Resultado |
|---|---|
| `npm run build` | limpio |
| `npm run lint` | **0 errores, 0 avisos** |
| `npm run contraste` | **52/52** mediciones exigidas, **0** incumplimientos |
| `npm run a11y` | **64/64** pantallas, **0** violaciones |
| `npm run hito` | **6/6** pasos encadenados |
| suite completa desde base limpia | **125/125**, 0 fallos |
| `git -c core.whitespace=cr-at-eol diff --check` | limpio |

Sin migración: el esquema no cambió. La base se recreó desde cero en la misma
pasada sólo para confirmar que migración y seed siguen verdes.

Dos casos nuevos y uno ampliado:

- **124, Inicio**: claims, conteo real, publicaciones que existen en la base,
  hero autorizado sin nada encima, cero pedidos externos ni conceptuales, error
  y sin conexión distinguidos, y un título de 140 caracteres que no desborda ni
  se corta.
- **125, Servicios**: sin video ni claims, hero interino autorizado,
  publicaciones que la base confirma como servicio o logística y sin foto en la
  tarjeta, filtro que queda puesto, error con texto propio.
- **123, zoom 200 %**: ahora recorre también Inicio y Servicios.

---

## 6. Capturas

`docs/pm/ux2c/capturas/` — Inicio, Servicios y Mercado en 1440×900, 768×1024 y
390×844, más página completa de Inicio y Servicios en 1440 y 390.

**Comparación antes/después**: el «antes» son las capturas de la entrega
anterior, `docs/pm/ux2b/capturas/inicio-*.png` y `servicios-*.png` —la placa
índigo con «Bienvenido a TopGreen» y el hero de Servicios con el video tapado—.
El «después» es este directorio.

---

## 7. Diferencias intencionales

Seis, con responsable y fecha, en `docs/pm/ux2c/PARIDAD.md`. Las dos que
conviene que mires:

1. **En celular la navegación muestra las cinco secciones en dos filas.** El
   prototipo muestra tres y esconde «Quiénes somos» y «Contacto» con
   `display: none`; vos lo prohibiste por escrito. Mantuve la solución que ya
   existía.
2. **La acción de cada tarjeta de la portada es la real** —`Iniciar operación`,
   `Agregar` con cantidad, `Solicitar cotización`— y no el texto `Ver operación`
   del prototipo. Esa línea del prototipo describe una navegación; la tarjeta
   real ejecuta la acción aprobada en UX-2B, y cambiarla sería el CTA paralelo
   que el contrato prohíbe.

---

## 8. Lo que dejo dicho

- **La taxonomía de Inicio no es clickeable.** Hoy no hay traducción inequívoca
  de «Maquinaria y campos» a un filtro: son dos categorías, y «Logística» es una
  anatomía. El contrato dice que sólo vuelve botón cuando exista ese mapeo. Si
  querés habilitarla, te traigo la correspondencia exacta antes de tocarla.
- **La foto final de Servicios sigue pendiente** y no es tarea Dev. La interina
  está en su resolución natural y no se amplió.
- **Quiénes somos y Contacto** recibieron tokens, cabecera y pie, y conservan su
  composición: no inventé otra sin pantalla aprobada. `Quiénes somos` sigue
  usando su video propio, que esta pieza no tocó.
- **`ACTIVOS.md` nombra los JPG fuente con su ruta anterior** —`public/…`—
  porque es documento de Diseño y no lo edito desde Dev. La ruta nueva está en
  `docs/pm/originales/README.md`.
- La deuda de los servicios con stock sin significado sigue abierta, como
  acordamos: se normaliza en la pieza de datos, no acá.

No desplegué nada.

Vuelvo a PM.
