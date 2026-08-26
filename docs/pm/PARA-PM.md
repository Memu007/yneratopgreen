# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-26. Vigésimo quinto informe: **UX-2D, la dirección B «Mercado
nacional» sobre el producto real**.

Un commit de producto y este informe.

| Commit | Qué trae |
|---|---|
| `465a5c2` | Tokens, fuentes, marca y placa de estado; cabecera por celdas; Inicio, Servicios y Mercado; el conteo real; casos 127 y 128; capturas y evidencia |
| este | Este informe |

---

## 1. Lo que hice, en una línea por frontera

1. **Fundación.** Una sola capa `--tg-*` con la paleta B —canvas `#f7f6f2`,
   verde `#1e4a34`, cereal `#c49a43`, acero `#5a6b60`, borde `#d8dad2`—, Inter
   Tight e Inter servidas desde el sitio, los cuatro SVG del paquete y la placa
   `no-photo-b.svg` integrada en `ProductImage`.
2. **Cabecera.** Un solo `Header.tsx`, banda verde dividida en celdas, dos
   bandas en el Mercado, navegación 3+2 en celular y las acciones de cada rol
   —`Salir` incluido— en los tres anchos.
3. **Inicio y Servicios.** La geometría de las láminas sobre el copy, los datos
   y los callbacks de UX-2C. Nada de negocio se movió.
4. **Mercado.** Panel de 256 px, barra de resultados, grilla 3/2/1, regla
   superior por anatomía y **el conteo desde el total de la API**, que es la
   corrección que devolviste.
5. **Estados, puertas y evidencia.** Las siete puertas, las diecisiete capturas
   y `PARIDAD.md` completo casilla por casilla.

## 2. Tu corrección: el conteo

Dijiste que la afirmación de que el Mercado ya mostraba el total verdadero era
incorrecta, que la API lo devuelve pero `ProductGrid` contaba
`products.length`. Es exactamente así y lo comprobé antes de tocarlo.

Ahora `App.tsx` guarda `response.total` y la barra dice **«100 de 155
operaciones»**: el total es el de la base y la primera cifra confiesa cuántas
bajaron. No abrí paginación —está fuera de la orden— pero dejé de esconder que
la lista está cortada.

Hay un matiz que quiero decir yo antes de que lo encuentres vos. Dos filtros no
viajan a la consulta: **subcategoría** y **calificación mínima del vendedor**,
que los aplica el navegador sobre la página descargada. Mientras no descartan
ninguna fila, el total de la API sigue describiendo lo que se está mirando; en
cuanto descartan alguna, deja de describirlo y la barra pasa a contar lo que
quedó en pantalla. La condición es medible —`filteredProducts.length !==
products.length`— y no una adivinanza, y está comentada donde se decide.

El **caso 127** es nuevo y prueba justo eso: fabrica un catálogo de más de cien
publicaciones, exige que la barra diga «100 de 155 operaciones» y que al
filtrar por servicios el número pase al del conjunto pedido. Contra el código
anterior falla con «el conteo dice «100 operaciones» y en la base hay 155
publicaciones activas».

El **caso 128** cubre la cabecera: 12 combinaciones de rol × ancho, los cinco
destinos visibles, cada acción del rol con 44 px de alto, el nombre real en
escritorio y «Cuenta» en celular, el texto del buscador por ancho y cero
desborde. Prueba en rojo: quitando el botón `Salir` falla con
«comprador/escritorio: falta la acción «Salir»».

## 3. Las diferencias contra el handoff

Están todas en `docs/pm/ux2d/DIFERENCIAS.md`, con su razón y su medición. Las
tres que te van a importar:

**El activo de alto valor sigue ocupando la fila entera.** La lámina del
Mercado lo dibuja como una tarjeta más de la grilla de tres. No lo cambié: el
ancho completo está fijado en `handoff/RESPONSIVE.md` y en la precedencia que
vos misma escribiste las anatomías son el punto 2 y la composición de este
paquete el punto 3. Lo que sí cambió es su color: la regla superior pasa a
verde. Si preferís que entre en la grilla, es un cambio de anatomía y hay que
reabrirlo en `handoff/`, no resolverlo en un revestimiento.

**No existe un rol «comprador» que no pueda vender.** `users.role` es `USER` o
`ADMIN` y cualquier cuenta con sesión puede publicar, así que la celda `Vender`
aparece para comprador y para vendedor y las dos capturas se ven iguales.
Preservé el producto: esconderle `Vender` a una cuenta que todavía no publicó
le saca una capacidad que hoy tiene. Separar los dos roles es una decisión de
producto con migración.

**El anillo de foco no es cereal sobre fondo claro.** La lámina lo pone cereal
en todas partes; el cereal mide **2,41:1 contra el canvas** y un indicador de
foco necesita 3:1. Quedó verde de marca sobre claro (**9,32:1**) y cereal sobre
la banda verde (**3,86:1**), que es donde el verde desaparecería. Mismo anillo,
mismo grosor, el único color que en cada fondo se ve.

## 4. La placa de «sin registro fotográfico»

El activo que entregó diseño trae la leyenda dibujada en contornos y a la
altura que ocupa en una tarjeta se lee entera. Poner al lado un rótulo con las
mismas tres palabras era decir dos veces lo mismo en el mismo renglón, así que
la placa habla sola y el nombre accesible del respaldo dice «Sin registro
fotográfico. <título de la publicación>».

La placa de **imagen rota** es otra cosa y no lleva palabras dibujadas, así que
ahí el rótulo escrito se queda. Siguen siendo dos estados que se dicen
distinto, que es la propiedad que importaba.

Las pruebas se ajustaron a eso y quedaron más exigentes, no menos: además del
nombre accesible ahora comprueban que la placa esté **efectivamente pintada**,
así que si el archivo no cargara, el caso falla en vez de aprobar un rectángulo
vacío que dice la verdad en el árbol de accesibilidad.

Y en el detalle, el marco de la foto se achica a la altura de la placa cuando
no hay fotografía: era la única superficie donde el respaldo quedaba como un
bloque vacío de media pantalla, que es justo lo que el override pedía sacar.

## 5. Los dos incumplimientos de contraste que encontró la medición

Los dos salieron del mismo lugar: el cereal profundo a 12 px, que es el color
del ojo de buey y el más justo de la paleta.

**El primero, en el detalle.** El rótulo «Logística» sobre el tinte de
información `#e7eef8`: **4,45:1** contra 4,5 exigido. No lo resolví moviendo el
color del rótulo. Ese bloque no es un aviso del sistema: es la anatomía de
logística, y bajo B su color es el grafito. Pasó a superficie neutra con filete
grafito y el problema desapareció por donde correspondía. De paso dejó de
pintar de celeste lo que el resto del producto dice en grafito.

**El segundo lo causé yo**, y aparece en el informe porque me lo encontró la
medición y no el ojo. La columna de copy de Inicio lleva dos filetes verticales
—el pautado de la hoja, que está en la lámina— y le pasaban por detrás al ojo
de buey: cereal profundo sobre el gris del filete da **3,69:1**. Le puse fondo
propio al ojo de buey, así que el filete se interrumpe en ese renglón, que es
exactamente donde su propia regla horizontal ya lo cruza. No se nota, y ahora
mide 4,81:1.

Probé bajar el filete a un gris más claro y no alcanza: ni al 6 % de tinta el
cereal profundo llega a 4,5 sobre él. Por eso la solución es que no se
superpongan, no que el filete se desvanezca.

La matriz completa está en `docs/pm/ux2d/TOKENS-Y-CONTRASTE.md`, con el detalle
de dónde **no** llega el cereal profundo: contra los cuatro tintes semánticos
queda entre 4,15 y 4,45. Para lo que venga, `.alert .tg-eyebrow` toma el color
del aviso, que ahí sí está medido.

## 6. Dos cosas que encontré y arreglé

- **`rgba(30, 58, 95, .85)` en Quiénes somos.** Un índigo escrito a mano encima
  del color de marca: el único hex suelto que quedaba en una superficie
  pública, y justo el tono que B saca de las pantallas. Se fue la capa; la
  sección ya tenía su fondo.
- **«Sin calificaciones aún» cortado en el panel del vendedor.** A 24 px la
  palabra «calificaciones» no entra en la columna de un contador y sin punto de
  corte se salía de la tarjeta: se leía «Sin calificacione aún». Es anterior a
  UX-2D —ni el ancho ni el cuerpo los toqué— y ahora corta como texto.

## 7. Una cosa que encontré y no toqué

**Administración no muestra «Vendedores» ni «Clientes».** Los dos contadores
quedan en blanco porque la respuesta del servidor no trae `total_sellers` ni
`total_customers`. Falta un campo en el backend y UX-2D tiene prohibido tocar
backend, así que lo dejo anotado y sin resolver. Decidilo vos.

## 8. Puertas, desde base limpia

Base recreada —migraciones y seed— antes de medir.

| Puerta | Resultado |
|---|---|
| `npm run build` | limpio |
| `npm run lint` | 0 errores, 0 advertencias (`--max-warnings 0`) |
| `npm run contraste` | 52/52 mediciones, 6.664 textos, **0 incumplimientos** |
| `npm run a11y -- --todas` | 64/64 pantallas, **0 violaciones de cualquier severidad** |
| `npm run hito` | 6/6 pasos |
| suite completa | **128/128**, 0 fallos |
| `git -c core.whitespace=cr-at-eol diff --check` | limpio |

Fuera de las puertas del repositorio medí además, sobre las cinco secciones
públicas:

- **zoom 200 %**: 720×450 y 384×512 —el 200 % de los dos anchos contractuales—
  y 320×256, que es el piso de reflujo de WCAG. 15 mediciones, cero desborde.
- **texto al 130 %**: otras 15 mediciones a 1440, 768 y 390. Cero desborde.
- **movimiento reducido**: cero elementos con transición o animación mayor a
  1 ms y cero videos.
- **tipografía**: las dos únicas peticiones de fuente son `/fuentes/Inter.woff2`
  y `/fuentes/InterTight.woff2`, ambas `loaded`, cero dominios externos y cero
  rastro de Newsreader o Work Sans en el árbol.
- **ocho superficies con sesión** —detalle, carrito, panel, administración,
  Quiénes somos, Contacto, ingreso y publicación—: 0 errores de consola, 0
  pedidos fallidos, 0 desborde.

## 9. Una línea de repositorio

Agregué un `.gitattributes` con dos reglas y nada más: los textos de licencia
SIL OFL quedan fuera del control de espaciado. Uno de sus renglones trae un
espacio al final y a un texto de licencia no se le corrige el espaciado; sin la
regla, `diff --check` fallaba por una licencia de terceros copiada tal cual. No
cambia el manejo de finales de línea de ningún archivo.

## 10. Qué hay para mirar

- `docs/pm/diseno-premium/mercado-nacional-b/PARIDAD.md`: completo, casilla por
  casilla, con la evidencia de cada una.
- `docs/pm/ux2d/capturas/`: Inicio, Servicios y Mercado en 1440×900, 768×1024 y
  390×844; la cabecera de los cuatro roles en escritorio y celular; y los
  cuatro SVG a 40, 30, 24 y 16 px.
- `docs/pm/ux2d/DIFERENCIAS.md`: las doce diferencias contra el handoff.
- `docs/pm/ux2d/TOKENS-Y-CONTRASTE.md`: la paleta y sus mediciones.

## 11. Lo que no hice

No toqué backend, migraciones, seed, API, pagos, logística, autenticación,
rutas ni dependencias. No abrí la paginación mayor a 100: sigue registrada en
`docs/pm/ux2c/DEUDA-PAGINACION.md` y lo único que cambió es que ahora el
Mercado la dice en vez de taparla. No rediseñé Quiénes somos, Contacto,
autenticación, detalle, carrito, publicación, paneles ni administración: esas
pantallas recibieron sólo la fundación compartida.

No desplegué. Freno acá para tu revisión y para la puerta visual de Emi.
