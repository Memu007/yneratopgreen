# Diferencias justificadas contra el handoff B

Lo que no coincide con `docs/pm/diseno-premium/mercado-nacional-b/` y por qué.
El orden de precedencia que fija `HANDOFF-DEV.md` es el criterio: comportamiento
y accesibilidad primero, después las cuatro anatomías y la lógica de acciones,
y recién después la composición de este paquete.

## 1. El activo de alto valor sigue ocupando la fila entera

`frames/mercado-desktop.html` lo dibuja como una tarjeta más en la grilla de
tres columnas. En el producto ocupa el ancho completo de los resultados.

No lo decidí yo y no es densidad: es la forma de esa anatomía, fijada en
`docs/pm/diseno-premium/handoff/RESPONSIVE.md` —«Activo de alto valor ocupa
ancho completo de resultados»— e implementada en `handoff/marketplace.css`. En
la precedencia de UX-2D las anatomías son el punto 2 y la composición de este
paquete el punto 3, así que la anatomía manda.

Lo que sí cambia con B es su color: la regla superior del activo pasa a verde.
Y en las vistas previas de Inicio y Servicios sigue usando la variante compacta
—tres columnas iguales—, porque ahí no hay fila entera que ocupar.

Si PM prefiere que el activo entre en la grilla como una tarjeta más, es un
cambio de anatomía y no de revestimiento: hay que reabrirlo en `handoff/`.

## 2. No existe un rol «comprador» que no pueda vender

`frames/header-estados.html` distingue comprador —carrito + cuenta— de vendedor
—`Vender` + carrito + cuenta—. En el producto esa distinción no existe:
`users.role` es `USER` o `ADMIN`, y cualquier cuenta con sesión puede publicar.
La celda `Vender` aparece para las dos, y por eso
`capturas/cabecera-comprador-1440.png` y `capturas/cabecera-vendedor-1440.png`
se ven iguales.

Preservé el producto y no inventé la distinción: esconderle `Vender` a una
cuenta que todavía no publicó le sacaría una capacidad que hoy tiene. Si el
negocio quiere separar los dos roles, es una decisión de producto con su
migración, no un ajuste visual.

## 3. La cabecera conserva `Salir` y el Mercado conserva su `h1`

Dos cosas que las láminas no muestran y que no se pueden perder:

- **`Salir`** entra como una celda neutra más. `MAPA-REACT.md` ya lo advertía.
- **El título del Mercado.** `frames/mercado-desktop.html` va de la cabecera a
  los resultados sin banda de presentación, y así quedó: el Mercado abre con
  resultados. Pero el `<h1>Operaciones disponibles</h1>` sigue en el DOM con
  `tg-sr-only`. Sacarlo dejaba la pantalla sin encabezado de nivel 1 y sin
  nombre en el árbol del documento, y eso es accesibilidad, que es el punto 1
  de la precedencia. La bajada comercial que acompañaba al título sí se fue.

## 4. El anillo de foco no es cereal sobre fondo claro

`assets/css/b.css` pone `:focus-visible { outline: 3px solid var(--gold) }` en
todas partes. El cereal mide **2,41:1 contra el canvas** y un indicador de foco
necesita 3:1 contra lo que lo rodea.

Quedó así:

- sobre claro, el anillo va en el verde de marca: **9,32:1** contra el canvas;
- sobre la banda verde de la cabecera —donde el verde desaparecería— va en
  cereal: **3,86:1** contra el verde.

Es el mismo anillo de 3 px; lo único que cambia es el único color que en cada
fondo se ve. Las dos mediciones están en `TOKENS-Y-CONTRASTE.md`.

## 5. El bloque de logística del detalle cambió de color

En UX-2C ese bloque usaba el tinte de «información». Bajo B eso dejaba el
rótulo de la anatomía —cereal profundo— en **4,45:1**, por debajo del mínimo,
y además pintaba de celeste lo que el resto del producto dice en grafito.

Pasó a superficie neutra con filete grafito, que es el color que el handoff le
asigna a la anatomía de logística. Fue el único incumplimiento de contraste que
encontró la medición.

## 6. Los controles miden 44 px y no 42

Las láminas usan 42 px de alto en los botones de tarjeta y en el buscador del
Mercado. El repositorio tiene `--tg-control-min: 44px` como piso contractual y
la propia `PARIDAD.md` exige `>=44×44` en las acciones principales. Quedaron en
44.

## 7. El carrito dice «Carrito (2)» también en escritorio

La lámina de escritorio dice «Mi carrito (2)» y la de celular «Carrito (2)».
Quedó «Carrito (n)» en los dos anchos: el nombre accesible del botón es lo que
buscan veinte localizadores de las puertas de navegador, y hacerlo depender del
ancho es exactamente el problema que acabo de sacar del buscador. La cantidad pasó de un disco rojo
flotante a un número entre paréntesis en la misma línea: el rojo es el color
del error en este sistema y «tenés dos cosas» no es un error.

## 8. La placa de «sin registro fotográfico» no lleva rótulo escrito encima

`assets/estados/no-photo-b.svg` trae la leyenda dibujada en contornos, y a la
altura que ocupa en una tarjeta se lee entera. Poner al lado un rótulo con las
mismas tres palabras era decir dos veces lo mismo en el mismo renglón, así que
la placa habla sola y el nombre accesible del respaldo dice «Sin registro
fotográfico. <título de la publicación>».

La placa de **imagen rota** es otra cosa: su dibujo no lleva palabras, así que
ahí el rótulo escrito se queda. Son dos estados distintos y se siguen diciendo
distinto.

Las pruebas se ajustaron a eso: además del nombre accesible, ahora exigen que
la placa esté efectivamente pintada, así que un activo que no cargue falla.

## 9. El filtro de tipo sigue siendo un `select`

`frames/mercado-desktop.html` dibuja «Tipo» como tres radios. En el producto es
un `select` con las mismas tres opciones, con su etiqueta y su estado. Es un
control existente y probado; cambiarlo era tocar comportamiento en una tarea de
revestimiento. Recibió el color, el borde y el rótulo en versalitas de B.

## 10. Dos de los cuatro SVG quedan versionados sin consumir

`topgreen-compact.svg` y `topgreen-horizontal.svg` son las versiones para fondo
claro. Hoy la marca aparece en dos lugares —la banda de la cabecera y el pie— y
los dos son fondo oscuro, así que ambos usan `topgreen-mono-light.svg`. Los
cuatro archivos están reemplazados como pide el handoff; dos todavía no tienen
dónde usarse.

## 11. Lo que encontré y no toqué

- **Administración no muestra «Vendedores» ni «Clientes».** Los dos contadores
  quedan en blanco porque la respuesta del servidor no trae `total_sellers` ni
  `total_customers`. Es un campo que falta en el backend y UX-2D tiene prohibido
  tocar backend, así que lo dejo anotado y sin resolver.
- **La paginación mayor a 100 sigue abierta**, como pide la orden. Lo único que
  cambió es que ahora el Mercado dice la verdad sobre ella: «100 de 155
  operaciones» en vez de «100 operaciones». Sigue registrada en
  `docs/pm/ux2c/DEUDA-PAGINACION.md`.

## 12. Lo que encontré y sí arreglé

- **`rgba(30, 58, 95, .85)` en Quiénes somos**: un índigo escrito a mano encima
  del color de marca, el único hex suelto que quedaba en una superficie
  pública. Se sacó la capa; la sección ya tenía su fondo.
- **«Sin calificaciones aún» cortado en el panel del vendedor**: a 24 px la
  palabra «calificaciones» no entra en la columna de un contador y, sin punto
  de corte, se salía de la tarjeta y la de al lado la tapaba. Se leía «Sin
  calificacione aún». Es anterior a UX-2D —el ancho y el cuerpo no los cambié—
  y ahora corta como texto.
