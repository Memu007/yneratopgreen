# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-23. Vigésimo informe: **UX-1, identidad del marketplace público**.

Commit de producto `e701cb4`. Capturas en `docs/pm/ux1/`, las ocho: portada,
marketplace, detalle y pie, en 1440×900 y en 390×844.

**No inventé una identidad ni un logotipo.** La marca es tipográfica, como
pediste. Cuando Emi quiera un signo propio, es una decisión suya y no mía.

## 1. Qué se veía y qué se ve

| | Antes | Ahora |
|---|---|---|
| Marca | un botón «TopGreen» perdido entre las acciones | marca tipográfica con su bajada, arriba a la izquierda, alineada con el contenido |
| Acciones | cada una con su color: rojo administración, amarillo vender | una sola principal en verde; el resto, contorno |
| Sección activa | píldora llena con degradado | filete de cosecha bajo el texto |
| Tarjeta | imagen, categoría, título, descripción recortada, 3 etiquetas, precio, botón «🛒 Agregar», píldora verde del vendedor | imagen, categoría, título, ubicación, precio, unidad, vendedor y una acción |
| Fotos | `picsum.photos`: una foto **al azar** —gatos, edificios, retratos— | ilustración por familia que dice que es ilustrativa |
| Estados | ⏳ y 🔍 gigantes | bloques del tamaño de las tarjetas que vienen, y un texto que dice qué probar |
| Pie | enlaces a twitter.com, linkedin.com e instagram.com | sin enlaces falsos |

## 2. La dirección, en tokens medidos

Capa nueva en `src/index.css`, encima de la paleta emerald/slate que ya
estaba. **No migré el resto del proyecto**, como indicaste.

| Token | Valor | Papel |
|---|---|---|
| `--marca-lienzo` | `#F7F4EC` | el marfil que le saca el blanco de tablero |
| `--marca-verde` | `#1B4332` | el verde de la marca, no el emerald de interfaz |
| `--marca-grafito` | `#22201D` | la tinta, cálida, para que conviva con el marfil |
| `--marca-cosecha` | `#D9A441` | el acento, como fondo y filete |
| `--marca-cosecha-texto` | `#7A4F0E` | el mismo acento cuando es **texto**: el dorado da 1,9:1 |

Los contrastes van anotados en el archivo, medidos sobre los dos fondos donde
aparecen. Ese último par es el error que ya nos costó una pieza entera de
contraste, así que esta vez son dos tokens distintos desde el principio.

**Tipografía: no descargué nada.** El proyecto ya carga Inter, que es de
licencia abierta. Proponer una fuente nueva sin poder verificar origen y
licencia era justo lo que dijiste que no hiciera.

## 3. Las fotos al azar

El problema no era que las URLs estuvieran rotas. **`picsum.photos` no falla
nunca**: carga perfecto y devuelve una foto cualquiera. Por eso el respaldo por
error jamás se enteraba — esperaba un fallo que no iba a llegar.

Ahora se reconocen **por el origen y no se piden**. En su lugar va una
ilustración de familia: un motivo de trazos que hereda el color, el nombre de
la categoría, y abajo «Imagen ilustrativa». Siete motivos —cultivo, maquinaria,
ganado, agua, tierra, tecnología, logística— más uno genérico, con la misma
línea de horizonte para que una grilla mezclada se lea como un conjunto.

No fingí que fuera la foto exacta. Eso habría sido el mismo engaño con mejor
gusto.

El arreglo está en `ProductImage`, que es el lugar más chico donde entra. Como
ese componente lo usan también pantallas fuera de esta pieza —carrito,
checkout, panel—, ahí también dejan de aparecer fotos al azar, sin tocarles una
línea.

## 4. Inventario de imágenes para producir después

No fabriqué treinta imágenes, como pediste. Esto es lo que convendría producir,
y es de Emi la decisión:

| Cantidad | Tema | Proporción | Uso |
|---|---|---|---|
| 8 | una por familia: cultivo, maquinaria, ganado, riego, tierras, precisión, logística, insumos | 4:3 | fondo de tarjeta cuando la publicación no trae foto propia |
| 8 | las mismas, versión apaisada | 16:9 | encabezado del detalle |
| 1 | campo argentino, hora dorada, sin gente identificable | 21:9 | portada |
| 3 | trabajo real: acopio, carga de camión, pulverización | 3:2 | «Quiénes somos» y «Servicios» |

**Ninguna reemplaza a la foto del producto**: son fondo de familia. La foto de
cada publicación la sube su vendedor.

## 5. Lo que corregí porque lo encontró una puerta

1. **«Imagen ilustrativa» daba 4,49:1**, once centésimas por debajo del mínimo.
   Yo lo había calculado contra el marfil liso; el fondo real de la ilustración
   lleva una trama encima y es más oscuro. **El fondo que hay que medir es el
   que se ve, no el que dice la variable.** Corregido el token.
2. **Desborde horizontal en 390px, pero sólo con sesión.** Sin sesión son dos
   botones y entra en cualquier ancho; con sesión son cuatro —vender, carrito,
   cuenta y salir— y la fila medía 378px. **Mi primera prueba era anónima y no
   lo veía.** Ahora la fila se dobla.
3. **El caso 21 se cayó, y tenía razón.** Probaba que una URL rota se reemplaza
   **contando peticiones bloqueadas**, y con este cambio esas peticiones ya no
   se hacen. Lo reescribí para exigir lo más fuerte —cero pedidos a `picsum` en
   los cinco recorridos— y le conservé lo viejo: una imagen propia rota sigue
   cayendo al respaldo.

## 6. Dos cosas que arreglé y no estaban en la lista

Te las digo explícito porque no me las pediste:

1. **El filtro de calificación eran cinco `span` con `onClick`.** Sin teclado,
   sin nombre accesible, y había que saber que una estrella llena significaba
   «esta cantidad o más». Ahora es el mismo `select` que el resto del panel.
   Entra en «shell del marketplace/filtros», y además las estrellas eran de los
   glifos que había que sacar.
2. **En móvil, los resultados van antes que los filtros.** Había que pasar ocho
   controles para ver una publicación. **Se reordena por CSS y no se esconde
   nada**: los filtros siguen visibles, del mismo tamaño y en el mismo orden de
   teclado. No los volví plegables justamente porque eso sí habría sacado
   marcadores que las puertas usan en 390px.

## 7. Puertas

| Puerta | Resultado |
|---|---|
| **Suite completa desde base limpia** | **117/117, 0 fallas** |
| Puerta del hito | 6/6 pasos encadenados |
| **Accesibilidad**, escritorio y 390×844 | **64/64 pantallas, 0 violaciones** |
| **Contraste**, escritorio y 390×844 | **52/52 mediciones, 0 incumplimientos, 0 cortes** |
| Build | limpio |
| `diff --check` | limpio |

**Ninguna puerta cambió de inventario ni se regrabó.** Lo que cambió son
selectores: `👤` y `⚙️ Admin` ya no existen, así que apuntan al nombre
accesible «Mi cuenta» y «Admin», que además es estable entre cuentas —el
anterior dependía de que el botón mostrara un emoji—. Son 19 selectores en
cinco guiones, y miden exactamente lo mismo que antes.

Cero emojis en el recorrido público. Quedan el `−` y el `+` del selector de
cantidad, que no son emojis sino los signos matemáticos del control y ya tenían
su etiqueta.

## 8. Archivos

| Archivo | Qué |
|---|---|
| `src/index.css` | capa de tokens de identidad |
| `Header.tsx` · `Header.module.css` | marca, búsqueda y acciones |
| `ProductCard.tsx` · `.module.css` | jerarquía de la tarjeta |
| `ProductGrid.tsx` · `.module.css` | estados de carga y vacío |
| `ProductDetailModal.tsx` · `.module.css` | símbolos, galería y paleta |
| `Footer.tsx` · `.module.css` | enlaces falsos y paleta |
| `FilterSidebar.tsx` · `.module.css` | filtro de calificación |
| `App.module.css` | orden en móvil |
| `ProductImage.tsx` · `.module.css` | ilustración en vez de foto de relleno |
| `IlustracionDeFamilia.tsx` · `utils/ilustracion.ts` | **nuevos**: los motivos y a qué familia va cada categoría |
| `smoke.mjs` · `a11y.mjs` · `contraste.mjs` · `hito.mjs` · `mobile-audit.mjs` | selectores y caso 21 |

## 9. Lo que decide Emi

1. **El signo de la marca.** Hoy es sólo tipografía. Un logotipo es decisión
   suya y no la tomé por él.
2. **La bajada «Marketplace agro».** Es descriptiva y sin promesas; si prefiere
   otra, es una línea.
3. **Las imágenes del inventario del punto 4.**

## 10. Riesgos y lo que dejé afuera

1. **La ubicación de la tarjeta es la del VENDEDOR, no el origen de la
   publicación.** El origen real vive en la base como localidad —lo usa
   logística— pero **no sale en la respuesta pública de productos**, y el
   backend estaba fuera de alcance. Se muestra tal como viene, sin reordenar:
   adivinar cuál parte era la provincia producía «Argentina, Buenos Aires».
   Exponer el origen real es un cambio de backend para otra pieza.
2. **No toqué las otras apariciones de emojis.** Su inventario, como pediste:
   `AdminPanel` (📦 Productos y las otras pestañas), `UserDashboard`,
   `CartModal`, `CheckoutModal`, `AddProductModal`, `Toast` y las páginas
   institucionales. No las mezclé.
3. **La portada sigue con su hero de plantilla.** Está fuera del alcance que
   nombraste y no lo abrí.
4. **No desplegué nada.**

Vuelvo a PM. No abro UX-2.
