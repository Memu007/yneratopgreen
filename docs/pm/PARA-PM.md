# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-23. Vigésimo primer informe: **UX-2B, el sistema aprobado
implementado en el producto**.

Cuatro commits de código y este informe. La superficie real aplica «B, Mesa de
negocios»: no es un recoloreo, y las cuatro anatomías salen de un dato de la
publicación y no de una regla escondida en el CSS.

| Commit | Qué trae |
|---|---|
| `08907cd` | Fundación visual y la anatomía declarada de cada publicación |
| `cbb9e74` | La superficie pública: cabecera, pie, mercado, tarjetas, detalle |
| `6b4fe4c` | Superficies autenticadas, capas con foco y el sistema sin emojis |
| `873ad2e` | El color de los paneles, las puertas y la evidencia |

87 archivos de código y documentación, más 30 capturas.

---

## 1. La decisión técnica obligatoria: cómo se elige entre las cuatro anatomías

**Se declara y se guarda: `products.operation_kind`.** No se deduce.

El producto no tenía con qué elegir. `publication_type` sólo separa producto de
servicio; la subcategoría es opcional y está mezclada; y ni el precio, ni la
unidad, ni el stock lo dicen sin adivinar: «Kit de Filtros y Correas» vale medio
millón y se vende de a kits, y «Manga Ganadera» dice `unidad` igual que un
tractor. Cualquier regla armada con esos tres datos iba a estar mal y, peor, iba
a estar mal en un lugar donde nadie podía corregirla.

Dos reglas la sostienen.

**No contradice al cobro.** Quién reserva stock y quién no lo decide desde
siempre `categories.is_service` —lo lee `services/stock.py`— y eso no se toca.
La anatomía tiene prohibido cruzar ese límite: `servicio` y `logistica` sólo en
categorías de servicio, `activo` e `insumo` sólo fuera de ellas. El alta y la
edición rechazan el cruce diciendo qué opciones valen. Mover una publicación de
categoría sí adopta la anatomía de la categoría nueva: es una decisión del
vendedor, no una contradicción guardada.

**Nunca queda vacía.** `categories.default_operation_kind` declara la de cada
categoría; es lo que preselecciona el formulario y lo que usó la migración para
los registros que ya existían. **Es una omisión declarada, no un
descubrimiento**, y así está escrito en la migración: el dato viejo no distingue
una cosechadora de una bolsa de urea, y el vendedor lo corrige editando.

Cobertura: alta, edición, API pública —listado y detalle—, seed, migración y
registros existentes. La migración va y vuelve, no deja ninguna publicación
ambigua ni ninguna que contradiga a su categoría, y `alembic check` no encuentra
diferencias.

En el catálogo sembrado quedan las cuatro, y hay dos publicaciones de la misma
categoría con anatomías distintas, que es la prueba de que no es derivable de la
categoría.

**Una advertencia sobre bajar esta migración**, que anoté en su propio
encabezado: `downgrade` borra la columna, así que borra las declaraciones que
los vendedores hayan corregido a mano, y volver a subir **no las recupera**:
rellena otra vez con la omisión de cada categoría. Es lo que significa borrar
una columna, pero conviene que esté escrito antes de que alguien la baje en
producción creyendo que la vuelta es gratis.

Lo descubrí porque **una aserción mía se cayó por eso**. El caso 118 exigía
encontrar una categoría mezclada en la base, y el caso 58 —que baja y vuelve a
subir la migración con datos adentro— deshacía la mezcla. La aserción estaba mal
planteada: dependía del orden de la suite. Ahora prueba la propiedad
**creándola** —dos publicaciones de la misma categoría con anatomías distintas—,
que no depende de lo que haya hecho el resto.

Nació además `products.condition` —nuevo o usado—, que la anatomía de activo
pide y el esquema no tenía: vivía suelta adentro de la descripción, donde no se
puede filtrar ni comparar.

---

## 2. Dos decisiones que son tuyas, no mías

### A. Un servicio con precio publicado, ¿se compra o se cotiza?

`COPY.md` manda `Solicitar cotización` para **todo** servicio. Antes de
aplicarlo lo medí:

- **14 de 17** servicios activos tienen precio real publicado;
- y el camino de compra de un servicio **funciona de punta a punta**: lo recorre
  la suite, deja ítems de orden y llega al cobro.

Aclaro el segundo dato porque lo medí primero mal: los ítems de orden con
servicios que conté salían de mi base local de pruebas, no de uso de clientes.
El seed no crea órdenes. Lo que está probado es que **el camino existe y
funciona**, no que ya se haya usado en producción.

Aun así: aplicarlo al pie de la letra saca del circuito comercial a catorce
publicaciones con precio puesto. La orden decía frenar antes de redefinir qué es
comprable, así que frené.

**Lo que hice:** la acción sigue lo que la publicación **puede hacer de verdad**.

| Situación | Acción | Camino |
|---|---|---|
| Activo con precio | `Iniciar operación` | carrito y checkout de siempre |
| Insumo con stock | `Agregar` | ídem |
| Servicio o logística **con precio** | `Contratar` | ídem |
| Cualquiera **sin precio** | `Solicitar cotización` | Contacto, y lo dice |
| Producto sin stock | `Sin stock`, deshabilitado | — |

**Lo único que se cerró es comprar algo que no tiene precio**, y eso era un
defecto: un servicio `a_convenir` guarda precio 0, no había ninguna guarda, y se
podía meter al carrito y generar una orden de $0. También mostraba `$ 0`, que
`COPY.md` prohíbe por escrito.

**Las dos opciones, y mi recomendación.**

- **Opción 1 (la que dejé):** la acción sigue al precio. Ningún servicio que hoy
  se cobra pierde su camino, y `Solicitar cotización` aparece exactamente donde
  no hay nada que cobrar. Cuesta una diferencia con `COPY.md` en el rótulo.
- **Opción 2 (la literal):** todo servicio va a `Solicitar cotización`. Cumple el
  documento y deja catorce publicaciones sin forma de venderse hasta que exista
  una solicitud ligada a la publicación, que `FUTURO-NO-IMPLEMENTAR.md` pone
  fuera de alcance.

**Recomiendo la 1.** El rótulo se cambia en una línea el día que exista la
solicitud por publicación; la venta que se corta hoy no vuelve sola. Si decidís
la 2, es un cambio de una función y media hora, no una pieza.

### B. La condición del activo, ¿obligatoria?

`ANATOMIAS.md` la pide obligatoria. El catálogo aprobado tiene dos categorías de
activo donde «nuevo o usado» no significa nada: **«Bienes y Ganado»** —un
ternero no es ninguna de las dos— y **«Tierras y parcelas»**. Obligarla haría que
el vendedor conteste cualquier cosa para poder publicar, que es peor que no
tener el dato.

La dejé **opcional**: se ofrece en el alta y en la edición, se valida si viene,
la ficha la muestra cuando está y omite la fila cuando no. En el seed hay tres
activos `usado`, tres `nuevo` y tres sin declarar —los dos lotes de hacienda y el
campo—, justo para que se vea el caso difícil.

Si querés obligarla, hace falta decidir antes **para qué categorías aplica**, y
eso es una columna más.

---

## 3. La pasada visual, y por qué hizo falta una segunda vuelta

Después de la tercera entrega saqué las capturas y **el panel seguía verde**.
Había arreglado los emojis, los claims y el foco, pero no los colores: las hojas
de estilo de las superficies autenticadas no usaban tokens, tenían **880 colores
escritos a mano** en dieciséis archivos, y por eso el sistema no llegaba hasta
ahí. Lo digo así de claro porque en el commit anterior escribí que esas
superficies «entraban al sistema», y a esa altura era verdad sólo a medias.

No los mapeé a ojo. Escribí un clasificador que calcula tono, croma y luminancia
de cada valor y lo manda **al token cuyo papel le corresponde**: un verde de
marca a la tinta índigo, un gris pizarra a texto secundario, un rosa pálido al
fondo de error. Revisé la tabla que produjo —agrupada por token y por
frecuencia— antes de aplicarla, y la afiné dos veces:

1. La primera versión mandaba los grises fríos como `#e5e7eb` a «celeste»,
   porque HLS les da saturación alta con croma casi nulo. Se cambió el criterio
   a croma.
2. La segunda mandaba los grises pizarra oscuros como `#374151` a «info». Hizo
   falta un segundo umbral: **casi sin croma es neutro siempre; con algo de
   croma es neutro sólo si además es oscuro.**

En la misma pasada se fueron **62 degradados**, **71 sombras** en cosas que no
flotan, **34 levitaciones** al pasar el mouse, **4 sombras de texto** sobre
fotografía y **205 radios** fuera de la escala del sistema —píldoras de 20 px y
cajas de 12—. Las bandas verdes sobre fotografía pasaron a índigo, que es la
única forma que `IDENTIDAD.md` autoriza para poner texto encima de una foto.

Y los cuatro contadores del panel dejaron de tener cuatro colores distintos: son
contadores, no estados, y cuatro colores prometían una diferencia de significado
que no existe. En la misma ficha, la reputación sin datos decía «—»; ahora dice
«Sin calificaciones aún», igual que la tarjeta, el detalle y el perfil público:
una raya obliga a adivinar si es cero, si falta el dato o si algo se rompió.

**La puerta de contraste encontró seis parejas rotas por ese mapeo**, y ahí está
el valor de haberla corrido después y no antes:

| Pareja | Medido | Qué pasaba |
|---|---|---|
| «TopGreen» sobre la banda de la portada | **1,59:1** | el amarillo pasó a ocre de advertencia y quedó ilegible sobre índigo |
| «Ver el mercado» y «Contactar Ahora» | **2,29:1** | tinta índigo sobre ocre; ahora es el botón del sistema, blanco sobre índigo |
| El número del paso en el checkout | **4,13:1** | gris sobre gris |
| «Cancelar» del panel | **4,13:1** | y este tenía un comentario de una pieza anterior explicando que ese mismo par ya se había arreglado una vez: mi pasada colapsó los dos grises distintos en el mismo token y lo rompió de nuevo. Quedó anotado en el código |

## 4. Doce cosas que encontré y no estaban en la orden

1. **Un tercer respaldo de imagen escondido.** `getImageUrl` devolvía un SVG en
   data-URI —fondo verde claro, Arial, «Sin Imagen» con un símbolo— *antes* de
   que el respaldo del sistema pudiera actuar. Una publicación sin foto mostraba
   un diseño que nadie aprobó ni midió.
2. **Google Fonts en tiempo de ejecución.** `index.html` seguía pidiendo Inter a
   `fonts.googleapis.com`, que es exactamente lo que `ACTIVOS.md` prohíbe. Lo vi
   porque la captura registró el pedido fallido.
3. **Un claim prohibido en el `<meta description>`**: «compra y vende productos
   agrícolas **de forma segura**».
4. **Dos claims más en la portada**: «El marketplace **líder** del agro
   argentino» y «una plataforma **segura y confiable**».
5. **Un tema oscuro muerto.** `ThemeContext` no estaba montado en ningún lado
   —nadie lo importaba— pero dejaba una paleta paralela sin medir en el CSS.
   Corrijo lo que dije al principio de la revisión: **nunca llegó a aplicarse**;
   era código muerto, no un tema activo.
6. **Ninguna capa cerraba con Escape ni atrapaba el foco.** Carrito, checkout,
   alta, panel, administración, perfil, ingreso, registro: tabular desde adentro
   seguía recorriendo la página de atrás, que está tapada.
7. **Catorce campos del formulario de edición sin etiqueta asociada**: se
   anunciaban como «cuadro de edición» y nada más.
8. **Se podía comprar un servicio sin precio y generar una orden de $0.**
9. **Cinco fotos de stock pedidas a Unsplash en tiempo de ejecución**: el fondo
   de la portada, el de «Misión y visión» en Quiénes somos y tres de las cinco
   tarjetas de Servicios. Las dos primeras iban **tapadas por una banda al 85–88
   %**: el pedido a un tercero en cada visita compraba el 12 % que se llegaba a
   ver. Ahora es el índigo del sistema. Las tres tarjetas quedan con el rótulo
   «Sin fotografía», que es la verdad; las otras dos usan fotos propias de la
   clienta y se conservan.
10. **Tres enlaces falsos en Contacto.** «Seguinos en Redes» apuntaba a
   `twitter.com`, `linkedin.com` e `instagram.com`: los dominios pelados, no
   perfiles de TopGreen. Un ciclo anterior ya había sacado los enlaces falsos
   del pie y estos habían quedado. Se retiran junto con su CSS muerto; el día
   que existan perfiles reales vuelven con su URL.
11. **Dos botones invisibles que rompí yo con la pasada de color.** «Ver el
   mercado» en la portada y «Contactar Ahora» en Servicios son botones sobre la
   banda índigo, y el mapeo los mandó a `--tg-color-action`, que **es** ese
   mismo índigo: índigo sobre índigo. La puerta de contraste no podía verlo,
   porque lo que mide es el texto —blanco sobre índigo, 14:1, perfecto— y el que
   desaparecía era el botón. Sobre el índigo la relación se invierte: fondo
   claro, tinta índigo. Lo cuento en detalle abajo.
12. **`npm run lint` estaba en rojo en `main`** —14 errores y 8 avisos— antes de
   esta pieza. Ahora está en 0 y 0, sin desactivar ninguna regla ni tocar la
   configuración. Y encontró un bug mío: `useCapaModal` quedaba llamado después
   de un `return` temprano en dos modales.

### El botón que no se veía, y por qué ninguna puerta lo veía

Vale la pena separarlo, porque es el límite de las puertas que tengo.

`contraste` mide **texto contra fondo**. «Ver el mercado» era texto blanco sobre
índigo: 14:1, aprobado. Lo que había desaparecido era la **caja**: el botón
tenía `background: var(--tg-color-action)` y la portada, después de sacarle la
foto, quedó del mismo índigo. Un texto blanco flotando en el medio de una banda
oscura no es un botón, y ninguna de las cinco puertas lo dice.

Así que lo medí aparte: un guion que recorre diez pantallas —las cuatro
públicas, mercado, detalle, ingreso, panel, carrito y checkout— y compara, para
cada botón con fondo propio, ese fondo contra el fondo efectivo de atrás.
Encontró exactamente esos dos. Después de corregirlos: **cero en las diez**.

Dos cosas que marcó y **no** son defectos, para que quede el criterio: la × de
cerrar una capa —el signo es la afordancia, no la caja— y la pestaña activa del
panel, que se señala con el borde de abajo. Ajusté el guion para que mire los
cuatro bordes y para que ignore los botones de un solo signo; con eso las diez
pantallas quedan limpias sin excepciones a mano.

El guion vive en mi scratchpad, no en el repositorio: es una medición, no una
puerta acordada. Si te sirve como puerta, lo dejo en `scripts/` en la pieza que
viene.

---

## 5. Puertas

| Puerta | Resultado |
|---|---|
| `npm run build` | limpio |
| `npm run lint` | **0 errores, 0 avisos** (en `main`: 14 y 8) |
| `npm run contraste` | **52/52** mediciones exigidas, **0** incumplimientos, **0** cortes horizontales |
| `npm run a11y` | **64/64** pantallas, **0** violaciones de cualquier severidad |
| `npm run hito` | **6/6** pasos encadenados |
| suite completa desde base limpia | **119/119**, 0 fallos |
| migración ida y vuelta + `alembic check` | limpios |
| `git -c core.whitespace=cr-at-eol diff --check` | limpio |

Las cinco puertas de navegador —contraste, a11y, hito y la suite— salieron de
**una sola corrida**: base borrada y creada de nuevo, migraciones, seed, API y
frontend levantados sobre el árbol que se entrega. No se recortó ningún
inventario ni se regrabó ninguna medición para llegar al verde.

Medido aparte en catálogo, detalle y panel a 1440×900, 768×1024 y 390×844:
`scrollWidth === clientWidth` en los tres, sin errores de consola, sin errores
de página y sin un solo pedido a un tercero.

Lo digo con el alcance exacto porque esa medición **no cubría** Inicio, Quiénes
somos ni Servicios, y ahí sí había pedidos a un tercero: son los de Unsplash del
punto 9. Se buscaron después por código, en todo `src/` y en `index.html`. Lo
que queda de dominio externo son enlaces que **abre la persona** —WhatsApp del
vendedor y del pie—, no recursos que la página pida sola.

### Los selectores de las puertas

Cambié rótulos y marcado, así que hubo que actualizar selectores. Los enumero
porque un selector actualizado a la ligera es la forma más fácil de que una
puerta pase sin medir:

- el wordmark es una **imagen** y no texto, así que la marca se busca por su
  nombre accesible;
- el conteo dice «N operaciones» y no un número suelto;
- el detalle se reconoce por su **rol de diálogo** y no por un encabezado que
  puede cambiar de texto —es más robusto que lo que había—;
- la tarjeta es un `<article>` y no un `div`;
- y uno más interesante: **«Agregar» ahora se llama igual en la tarjeta y en el
  detalle**. `.first()` sobre toda la página elegía el que está tapado por el
  modal. Se acotó a la tarjeta buscada, con un ayudante que además contempla que
  un activo diga «Iniciar operación».

Ninguna aserción se debilitó. El caso 21 quedó **más** exigente: antes los dos
caminos —sin foto y foto rota— caían en el mismo cartel y el caso no podía notar
si el respaldo decía la verdad; ahora exige los dos textos por separado.

---

## 6. Paridad

`docs/pm/ux2b/PARIDAD.md` es la copia del checklist con la columna de desarrollo
completada y la evidencia de cada ítem. El original de Diseño queda intacto y
las dos filas de revisión —vos y Emi— siguen vacías, que es de ustedes.

**Cuatro casillas quedaron sin marcar, y ninguna por olvido:**

1. **Servicio sin simular compra cerrada** — la decisión A de arriba.
2. **Estado «offline»** — no existe: un fallo de red cae hoy en el mismo mensaje
   de error del mercado. Deuda declarada, no implementada.
3. **Zoom 200 %** — no lo medí con una puerta. No lo marco por inspección visual.
4. Las dos revisiones de aceptación, que son de ustedes.

Y seis diferencias intencionales, con responsable y fecha, en el mismo archivo.

---

## 7. Deudas verdaderas

- **`features: {}`**: el backend no entrega características estructuradas, así
  que la tarjeta del activo no muestra año, horas ni potencia y el detalle no
  arma tabla técnica. **No se parsea la descripción para inventarla**: eso sería
  una ficha que el vendedor nunca completó.
- **No hay ID de operación** para mostrar en el detalle.
- **La ubicación de la tarjeta es la que declaró el vendedor**, no el origen de
  la publicación: ese vive en la base como localidad y no sale en la respuesta
  pública.
- **Sin fotografía real**: el catálogo demo se ve entero con el respaldo del
  sistema, que es a propósito y es el caso más difícil.
- **`src/data/mockData.ts` sigue en el repositorio**: diez publicaciones
  inventadas con fotos de Unsplash. **No lo importa nadie** —es código muerto y
  no llega a la pantalla—, por eso no lo toqué en esta pieza; pero es contenido
  falso versionado en un repositorio que se entrega, y conviene borrarlo. Es un
  `git rm` y una corrida de puertas.
- **El activo ocupa la fila completa** del catálogo, como manda `RESPONSIVE.md`.
  Con nueve activos en el seed la grilla queda larga: nueve filas enteras antes
  de que empiecen las columnas. Lo dejo dicho porque es una consecuencia visible
  de la regla aprobada, no un error, y si molesta se cambia en una línea.

---

## 8. Lo que dejé afuera

- **UX-2B no despliega nada.** Railway y producción quedan en PM, como pediste.
- No abrí `FUTURO-NO-IMPLEMENTAR.md`: no hay mensajería, ni solicitud atada a la
  publicación, ni directorio público, ni ruta «Mesa de negocios».
- `Inicio`, `Quiénes somos` y `Servicios` recibieron marca, fuentes, tokens,
  cabecera, pie y controles, y **conservan su composición**: no inventé
  contenido para páginas que Diseño no entregó. Sí saqué de ahí los dos claims
  prohibidos y los emojis, que son criterio de aceptación.
- No creé una skill ni un design system aparte.

---

## 9. Capturas

`docs/pm/ux2b/capturas/` — 30 imágenes en 1440×900, 768×1024 y 390×844:
catálogo de productos, catálogo de servicios, detalle de activo, detalle de
servicio, panel del vendedor y estados de operación.

Sumé cuatro pantallas que la captura anterior **no cubría** —Inicio, Servicios,
Contacto y Quiénes somos—, que son justamente donde estaban las fotos de
Unsplash. Las tres medidas dan `scrollWidth === clientWidth` en los tres anchos
y **cero dominios externos pedidos**.

Con una salvedad para que nadie la lea de más: la captura registró dos pedidos
fallidos, `/video-servicios.mp4` y `/video-topgreen.mp4`. Son los dos videos de
portada, **existen en `public/` y el servidor los entrega** —comprobado, HTTP
206—: el fallo lo produce la propia captura, que navega a la pantalla siguiente
mientras el video todavía se está descargando. Es ruido de mi instrumento, no un
defecto del producto.

Vuelvo a PM.
