# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## ACCOUNT-PAGE-1 — Mi cuenta es una página del sitio

**Resultado: terminado.**

- Producto/regresión: `7dc1d53`
- La suite pasa a **163 casos**.
- **En mi rama, no en `main`.** No integré, no desplegué, no mezclé nada de
  otra pieza y no toqué Railway, datos remotos, pagos ni secretos.

---

### 1. Los cinco puntos

**El contenedor general dejó de ser capa.** Se fueron el fondo oscuro, la caja
flotante, la X, `role="dialog"`, la trampa de foco, el cierre con Escape y con
el fondo, y el bloqueo del scroll. Queda una página: Header arriba, Footer
abajo, ancho de lectura propio y el scroll del documento. Las capas de adentro
—editar una publicación, calificar, rechazar una transferencia— siguen siendo
capas, como pediste.

**Tiene URL.** `account` entra en la política de navegación, así que
`?section=account` se recarga, se comparte y Atrás vuelve adonde estaba. No
agregué React Router ni ningún otro escritor de `history`: la guardia vive en el
único módulo que ya escribía el historial. El botón de la cabecera navega y
queda con `aria-current="page"`.

De paso saqué una copia que se había quedado atrás: `Header.tsx` declaraba su
propia lista de secciones, sin `account`. Ahora lee el tipo de la política, que
es lo que esa política vino a evitar.

**La sesión.** Entrada directa sin sesión abre el ingreso; si autentica vuelve a
Mi cuenta y si cancela queda en una sección pública. Salir termina la sesión y
va a Inicio. La vuelta de Mercado Pago aterriza en la cuenta en vez de intentar
abrir el modal retirado.

**Los datos, intactos.** Pestañas, permisos, cargas, errores, acciones y API son
los mismos. No rediseñé ninguna sección interna, no agregué sidebar, ni rutas
por pestaña, ni funciones nuevas.

### 2. `FORM-DIRTY-1` en el límite nuevo

Antes las salidas eran tres —la X, el fondo y Escape— y las tres pasaban por el
componente. Ahora son cinco —cabecera, pie, Atrás, Salir y cambiar de pestaña— y
**cuatro de las cinco no lo tocan**. Así que la pantalla con trabajo sin guardar
registra una guardia en la navegación, que es quien las ve todas.

El Atrás es el caso incómodo: cuando `popstate` llega, la barra ya se movió. Se
deshace el movimiento **antes** de preguntar, para que «seguir editando»
conserve pantalla, URL y contenido; y si la respuesta es descartar, se repite el
Atrás con la guardia levantada.

**Y descartar ahora descarta.** Mientras era un modal, descartar cerraba el panel
y el formulario se iba con él. Como página, el destino puede ser otra pestaña:
si el formulario quedara escrito, la salida siguiente volvería a preguntar por
lo mismo y «pregunta una sola vez» dejaría de ser cierto. Ahora suelta el
trabajo local de las cuatro fuentes y después ejecuta el destino. **Local** es
la palabra: vuelve los formularios a lo último guardado y no toca ninguna orden
ni publicación ya persistida.

Un detalle que salió de medir: elegir la pestaña en la que ya estás no pregunta
nada. No es una salida, es la misma regla con la que la navegación no agrega una
entrada al historial cuando el destino es donde ya estás.

### 3. Tres arreglos que la conversión hizo necesarios

| Qué | Por qué |
|---|---|
| «Sin calificaciones aún» se partía en «Sin calificaci / ones aún» | Era el precio de un `overflow-wrap: anywhere` puesto para evitar un desborde. Una frase no necesita cuerpo de cifra: baja a 15 px, entra y corta entre palabras |
| En 390 px las pestañas se iban de la pantalla | Con `nowrap` + `overflow-x: auto`, Mis Compras, Mis Ventas y Mis publicaciones quedaban fuera de la ventana: había que descubrir que la tira se arrastra. Ahora se envuelven y entran las seis |
| La capa de editar una publicación se quedó sin Escape | Nunca había tenido el suyo: usaba el del panel, que cerraba **todo**. Al retirar el panel se quedaba sin ninguno. Ahora tiene el suyo, con foco atrapado y devuelto a su disparador, y declara `role="dialog"`, que tampoco tenía |

### 4. El caso 163, y las cinco veces que lo puse rojo

Mide seis propiedades. Ninguna es «se ve como una página», que no se mide.

| Roto a propósito | Qué dijo |
|---|---|
| La cuenta vuelve a declararse diálogo | `la cuenta dejó 1 diálogo(s) abiertos` |
| Se le saca su nombre en la barra | `Mi cuenta no tiene URL propia: la barra dice http://localhost/` |
| La guardia deja de mirar el Atrás | `saliendo por Atrás con trabajo sin guardar no preguntó` |
| Descartar deja de soltar el trabajo local | `tras descartar, el perfil siguió en edición con lo escrito adentro` |
| Las pestañas vuelven a `nowrap` | `390x844/perfil: 2 control(es) fuera de la ventana: Mis Ventas \| Mis publicaciones` |

«Texto partido de forma absurda» se mide y no se opina: el caso arma con
`Range` las líneas que el navegador dibujó de verdad y exige que juntarlas con
un espacio devuelva el texto original. Si un corte partió una palabra, no
coincide y se cae.

**Y un agujero que encontré en mi propio caso.** El bloque que comprobaba el
descarte navegaba a otra sección, y eso desmonta la pantalla: al volver, el
perfil aparecía cerrado igual, así que la comprobación pasaba aunque descartar
no soltara nada —lo medí sacando el descarte del producto y el caso siguió
verde—. Ahora se mide con un destino que **no** desmonta: otra pestaña.

### 5. Los casos 149 y 150, adaptados

Los dos se caían, y era correcto que se cayeran: probaban cerrar el panel con la
X y con el fondo, que ya no existen.

- **149**: donde probaba la X y el fondo, prueba las salidas que existen. Y
  cambia una regla que vos cambiaste: antes cambiar de pestaña con el perfil
  sucio **no** preguntaba —el formulario seguía montado detrás—, y ahora sí.
- **150**: exigía que el contenedor del perfil fuera **una** capa con el fondo
  trabado. Como página la propiedad correcta es la contraria —ningún diálogo y
  el scroll suelto— y comprobarla es igual de discriminante. También se le pasó
  a decir la verdad sobre el foco: vuelve a **quien pidió salir**, que en una
  capa es el campo con Escape y en la página es el botón de la cabecera.

Otros cinco casos —129, 151, 152, 153 y 156— sólo necesitaban el nombre nuevo
del encabezado y siguen verdes.

### 6. Lo que corrí

- **147, 148, 149, 150 y 163 aislados desde base limpia: 5/5.** Seis capturas:
  Perfil y Mis publicaciones en 1440×900, 768×1024 y 390×844.
- `npm run build`, `npm run lint`, `npx tsc --noEmit`, `node --check` y
  `diff-check`: verdes.
- No corrí suite completa, Backend, a11y ni contraste totales. El diff no sale
  del shell, la navegación y el panel.

### 7. Lo que te debo decir

- **El encabezado dice «Mi cuenta» y antes decía «Mi Panel».** No me lo pediste
  explícitamente, pero el botón que lleva ahí dice «Mi cuenta» y el contrato la
  llama así; dejar dos nombres para la misma pantalla era la incoherencia que
  Emi señaló. Cambió el texto de siete casos que lo buscaban por nombre.
- **En Mis publicaciones las tarjetas siguen diciendo «Sin registro
  fotográfico»**, aunque el Mercado ya muestre las fotos de `CATALOG-PHOTOS-1`.
  No es un defecto de esta pieza: esa pestaña lee `/products/my` y no pasa por
  la conversión del catálogo, que es donde vive la tabla demo. Queda informado y
  sin tocar: no estaba en el alcance de ninguna de las dos.
- **`diff-check` me encontró un `\r` duplicado** en una de mis inserciones a
  `App.tsx`. Es justo la trampa que avisa el repositorio; lo corregí y verifiqué
  que los cinco archivos mezclados conservan la proporción de finales de línea
  que tenían.

### 8. Sin rojo, sin intermitente, sin pendiente

Nada quedó rojo ni sin verificar.

## CATALOG-PHOTOS-1 — el catálogo muestra la foto del aviso

**Resultado: terminado.**

- Producto/regresión: `e3c277e`
- La suite pasa a **162 casos**.
- **En mi rama, no en `main`.** No integré, no desplegué, no corrí seed y no
  toqué Railway, datos, pagos ni secretos. No mezclé `ACCOUNT-PAGE-1`.

Tu paquete destrabó la tarea. Lo que estaba bloqueado era la búsqueda y descarga
—la política de egreso de este entorno rechaza todos los bancos de imágenes— y
eso lo resolviste vos. El resto era mío y está hecho.

---

### 1. Antes de usarlas, las verifiqué

No por desconfianza: porque un paquete que dice «30, 1:1, todas distintas» y no
lo es rompe la demo en el peor momento. **Todo lo que afirmás se comprueba:**

| Lo que decías | Lo que medí |
|---|---|
| 30 archivos | 30 |
| relación 1:1 con los slugs del seed | 30 y 30, sin sobrantes ni faltantes |
| 30 hashes distintos | 30 |
| todos decodificables | 30, leyendo la cabecera WebP |
| 1600 × 1000 | 1600 × 1000, las treinta |
| 5.4 MiB | 5.33 MiB |

Las copié a `public/catalogo/` **sin recomprimir**: este entorno no tiene
`cwebp`, ImageMagick ni Pillow, así que optimizar no lo puedo hacer acá. El peso
está abajo, en lo que te debo.

### 2. Lo que cambié en el producto, y por qué tan poco

**La resolución de la imagen, en un solo punto.** Donde el catálogo arma la
publicación. El orden es el único que no miente:

1. la foto que subió quien publica;
2. si no hay —o si es de relleno, que para el sistema visual es lo mismo que no
   haber—, la tabla de la demostración;
3. si el slug no es de la demostración, **«Sin registro fotográfico»**. No hay
   foto genérica de reemplazo.

**La tabla, derivada de tu inventario.** `src/utils/fotosDemo.ts` no se escribió
a mano: sale de `INVENTARIO-FOTOS-CATALOGO-2026-09-09.md` y lleva la atribución
adentro. El caso 162 vuelve a leer tu archivo y se cae si dejaron de coincidir:
la atribución no puede envejecer por separado de la foto que atribuye.

**La banda pasa a las cuatro anatomías**, en tarjeta y en detalle. Servicio y
logística no la llevaban, con un argumento que era bueno mientras no hubiera
foto: sin imagen, el hueco no prometía nada. Ahora la hay, y una cuadrícula
donde la mitad de las tarjetas arranca con foto y la otra mitad no tiene dos
alturas de la misma cosa. Cobertura, modalidad y respuesta siguen completas: la
banda no les sacó lugar.

### 3. Una cosa que agregué y no me pediste explícitamente

**El crédito de la foto, debajo de la imagen en el detalle.**

Tu propio inventario lo dice: «Para CC BY/CC BY-SA, mantener crédito, enlace a
la licencia e indicar la adaptación». Conté las licencias del paquete:

| Licencia | Fotos |
|---|---:|
| CC BY 2.0 | 16 |
| CC BY-SA (2.0, 3.0, 4.0) | 9 |
| CC0 1.0 | 3 |
| Dominio público (PDM 1.0) | 2 |

**Veinticinco de las treinta exigen atribución**, y esas licencias piden el
crédito donde se muestra la obra. Un archivo en `docs/` no cumple con la persona
que mira la página. Son tres líneas de datos que ya venían en tu inventario y un
párrafo bajo la imagen; me pareció peor entregarlo sin eso que ampliar el
alcance por mi cuenta. **Si preferís que salga, se saca en un commit.**

Detalle menor de presentación: tu inventario mezcla `by 2.0`, `cc0 1.0` y
`CC BY-SA 4.0`. El dato crudo se conserva tal cual lo escribiste —el caso lo
contrasta contra tu archivo— y lo que cambia es cómo se lee en pantalla:
«CC BY 2.0», «CC0 1.0», «Dominio público (PDM 1.0)».

### 4. Un rojo que me encontró el 155

Al darle columna de foto a servicio y logística en la vista **Lista**, en
768 × 1024 el renglón creció a 366 px y la acción terminaba **justo** en el borde
inferior de la ventana: el botón cerraba en 1024 de 1024. El caso 155 lo detectó
y tenía razón.

Arreglado: por debajo de 1180 px la columna de imagen cede ancho antes que los
datos (de 232 px a 172). Los datos y la acción valen más que sesenta píxeles de
foto.

### 5. El caso 162, y las cuatro veces que lo puse rojo

Mide seis propiedades que se rompen en silencio, ninguna de ellas «la foto es
linda», que no se mide:

1. cada uno de los 30 avisos resuelve un archivo local existente, decodificable,
   de medida común y **no repetido**;
2. ninguna imagen sale a la red;
3. la tabla del producto y tu inventario dicen lo mismo, campo por campo;
4. el crédito se ve, con la licencia enlazada y la adaptación mencionada;
5. la foto real del vendedor le gana a la tabla, y un slug ajeno conserva el
   respaldo;
6. la banda mide lo mismo en las cuatro anatomías y en las dos vistas.

| Roto a propósito | Qué dijo |
|---|---|
| Dos avisos con la misma foto | `«tractor-pauny-280a…» y «cosechadora-john-deere-9750» son la misma foto` |
| La atribución se despega del inventario | `autor dice «Otro Autor» en el producto y «Wilson Hui» en el inventario` |
| Se retira el crédito | `el detalle de «Cosechadora John Deere» no acredita la foto` |
| El producto ignora la foto real del vendedor | `muestra «/catalogo/semillas-maiz…» y tenía que mostrar «/images/categories/semillas.jpg»` |

### 6. Lo que corrí

- **155 y 162 aislados desde base limpia: 2/2.** Seis capturas: Mercado en
  Cuadrícula y Lista y detalle de artículo y de servicio en 1440×900; Cuadrícula
  y detalle de servicio en 390×844.
- `npm run build`, `npm run lint`, `npx tsc --noEmit`, `node --check` y
  `diff-check`: verdes. Las 30 llegan a `dist/catalogo/`.
- No corrí suite completa, Backend, a11y ni contraste totales, como pediste. El
  diff no sale del recorrido visual acotado.

### 7. Lo que te debo decir, aunque no me lo preguntes

**Dos fotos no representan lo que dice el aviso.** No las reemplacé —pediste no
sustituir por criterio propio— y las entrego tal cual, pero las marco:

- **`manga-ganadera-balanza-electronica`**: la foto es una balanza de ganado
  **de museo**. Tu propio inventario lo dice en el título de la obra: «Scale for
  large livestock (Waage für Großvieh), **Museum Waake**». Se ve un artefacto
  antiguo de madera bajo techo, no una manga con balanza electrónica. Es la que
  más se aleja del título del aviso.
- **`dron-pulverizador-agricola-20l`**: el dron es excelente y protagonista,
  pero al fondo hay una jornada a campo con carpas, banderas y **texto incrustado
  de terceros** en los banners. Tu contrato pide «sin texto incrustado». En el
  recorte de la tarjeta no se ve; en el detalle sí.

Otras cuatro son defendibles pero indirectas —muestran la aplicación en vez del
producto—: `herbicida-glifosato-20l` y `urea-granulada-46-nitrogeno` muestran
una pulverizadora y una fertilizadora trabajando, no el bidón ni la bolsa;
`insecticida-lambda-cihalotrina-1l` muestra un avión aplicador. Para una demo
funcionan; lo digo por si querés afinarlas después.

**El peso.** 5,33 MiB en 30 archivos, promedio 182 KB, la más pesada 695 KB
(`equipo-riego-goteo`). Las tarjetas cargan con `loading="lazy"`, así que en la
primera pantalla bajan tres o cuatro, no las treinta. Aun así son originales de
1600 px sirviendo una banda de 112 px de alto: hay margen para bajar a la mitad
sin que se note. **No lo puedo hacer acá**: no hay `cwebp`, ImageMagick ni
Pillow en la máquina, y no voy a agregar una dependencia por esto sin que lo
decidas.

### 8. Sin rojo, sin intermitente, sin pendiente

Nada quedó rojo ni sin verificar. **ACCOUNT-PAGE-1** no la empecé: va después de
ésta y no la mezclo.

## ADMIN-TRUTH-1R — el caso 160 se sostiene solo

**Resultado: terminado.**

- Corrección de regresión: `21cd4d1`
- Alcance real: **sólo `scripts/smoke.mjs`**. El producto no se tocó: el diff
  contra `src/` y `backend/` sale vacío. La prueba no reveló ningún fallo real
  del producto, así que no rehice producto, como pediste.
- La suite sigue en **161 casos**.
- **En mi rama, no en `main`.** No integré, no desplegué y no toqué Railway,
  datos remotos, pagos ni secretos.

---

### 1. Tenías razón, y era peor de lo que decía la salida

No hay nada que discutir acá: el 160 daba 1/1 sin probar lo que decía probar.
Lo que encontraste eran **dos** defectos, no uno.

**El bucle vacío.** El bloque de badges filtraba y miraba «lo que hubiera». El
catálogo sembrado es todo `active` y `draft` no se ofrece como filtro, así que
para cuatro de los catorce estados el bucle corría sobre **cero filas**. Un
bucle vacío siempre pasa. Y los diez que sí veía podían venir de filas dejadas
por casos anteriores: en la suite completa el informe enumeraba más estados no
porque el caso los hubiera preparado, sino porque los heredaba.

**El color que no se miraba.** El caso sólo comparaba el texto. Los catorce
badges podían caer al mismo gris —que es exactamente el defecto que el producto
vino a arreglar— y el caso seguía verde. Era una prueba que no podía ponerse
roja por la falla que motivó la pieza.

### 2. Qué hace ahora

**Fabrica sus catorce filas.**

- Cuatro publicaciones por la ruta real del vendedor —`POST /products`, la que
  usa una persona—, una por estado, y el estado se pone en la base descartable,
  que es donde el arranque dice que se fabrican los estados que la API no
  ofrece. Categoría y localidad se copian de una publicación existente del mismo
  vendedor: no invento referencias que el padrón no tenga.
- Las diez órdenes que ya creaba, ahora con su `order_number` leído de la base.
- Después comprueba contra SQL que las cuatro publicaciones quedaron en los
  cuatro estados, y que los diez números de orden son distintos entre sí.

**Busca cada fila por identidad propia.** Nombre de la publicación
(`Verdad 160 <sello> <estado>`) o número de orden, recorriendo páginas mientras
«Siguiente» no esté deshabilitado. Ni el orden del catálogo ni la página son una
identidad; si la fila no aparece en ninguna página, el caso lo dice con el
número de páginas que recorrió y lo que muestra el paginador.

**Exige tres cosas de cada badge**, no una:

1. el texto del diccionario, sin guion bajo;
2. el color **computado** del tono que ese mismo diccionario declara. El color
   no se copia acá: se lee `COLOR_DEL_TONO` del producto —que son tokens de la
   paleta— y lo resuelve el navegador. Si mañana cambia `--tg-color-warning`, la
   prueba sigue diciendo la verdad en vez de quedar mintiendo con un `#79520f`
   escrito a mano;
3. que no sea el tratamiento de respaldo. El tono de respaldo también se lee del
   producto (`SIN_TRADUCCION`), no se supone. La única excepción es el estado
   que declara ese tono a propósito, y el informe dice cuántos son: uno,
   `draft`.

Además se rechaza el fondo vacío o transparente, tanto en el color declarado por
el tono como en el badge dibujado.

**`draft` sale de la vista sin filtro**, que es donde puede aparecer. Y el caso
afirma primero que el filtro *no* lo ofrece: si algún día se ofreciera, esa
afirmación se cae y avisa que hay que exigirlo por filtro como a los otros nueve,
en vez de seguir mirándolo por la puerta de atrás.

**El recuento no se declara.** Antes decía `revisados.length >= 10`, un número
escrito a mano que envejece. Ahora exige
`ESTADOS_PRODUCTO.length + ESTADOS_ORDEN.length` leídos de los enum de la base:
agregar un estado al modelo rompe el caso hasta que se lo prepare y se lo mire.

Y la comprobación temprana del diccionario ahora también exige que cada estado
declare un tono y que ese tono tenga color, no sólo que tenga texto.

### 3. El rojo, tres veces

No te traigo un verde sin haber visto el rojo. Los tres negativos son temporales
y quedaron revertidos; el árbol entregado sólo tiene `scripts/smoke.mjs`.

| Negativo | Qué se rompió a propósito | Qué dijo el caso |
|---|---|---|
| 1 | `COLOR_DEL_TONO.curso` → el color del respaldo | `publicaciones/sold_out: sold_out se ve igual que un estado sin traducir (rgb(76, 84, 75))` |
| 2 | Todos los badges con un solo color en `AdminPanel.tsx` | `el badge de paused se pinta rgb(30, 74, 52) y su tono «espera» declara var(--tg-color-warning) = rgb(121, 82, 15)` |
| 3 | Preparar **una** publicación en vez de cuatro, como la versión que rechazaste | `se miraron 11 badges y la base declara 14 estados: …` |

El tercero es el que importa para tu devolución: reproduce el falso verde y
ahora es rojo.

### 4. Un defecto mío que apareció al medir

El primer intento se cayó en `órdenes/draft`: la fila no aparecía «en ninguna de
las 1 página(s)». No era el producto. Esperar «que haya filas» después de
cambiar el filtro **se cumple al instante con la tabla anterior**, que sigue
dibujada mientras llega la nueva: el caso leía el filtro viejo.

Lo arreglé con una condición que la tabla vieja no puede cumplir a la vez: el
total que declara la base para ese estado —contrastado contra SQL, así que de
paso comprueba que el filtro filtra— y que todo lo dibujado sea de ese estado.
Con el filtro sin poner, sólo el total. El mensaje de error incluye lo que
mostraba el paginador cuando se agotó el tiempo.

Lo digo porque es la clase de espera que produce verdes que no valen, y estaba
en mi código.

### 5. Lo que corrí

- `./scripts/entorno_nativo.sh --recrear` y `SMOKE_CASOS=160`: **1/1**, desde
  base limpia, con los catorce estados enumerados en la salida —cada uno con su
  texto y su color computado— y `el tratamiento de respaldo (rgb(76, 84, 75)) lo
  comparten sólo los 1 que declaran el tono «neutro»`.
- `node --check scripts/smoke.mjs` y
  `git -c core.whitespace=cr-at-eol diff --check`: limpios.
- No corrí suite completa, 145/146, build separado, a11y, contraste ni Backend,
  como pediste.

**Una excepción, y la aviso.** Factoricé los lectores del diccionario, que 145 y
146 también usan. Tu instrucción de no correr 145/146 suponía que el diff no los
tocaba, y dejó de ser cierto por mi cambio. En vez de correrlos, medí lo que
importa directamente: ejecuté la implementación vieja —sacada de
`git show HEAD:`— y la nueva sobre el mismo archivo, y devuelven **exactamente
lo mismo** en los dos diccionarios. `textosDeEstado` no cambió de
comportamiento, así que la premisa de 145 y 146 no cambió. Si preferís la
corrida igual, decímelo.

### 6. Sin rojo, sin intermitente, sin pendiente

No quedó nada rojo ni sin verificar en esta corrección. El 131 ambiental no
entra acá: no corrí la suite completa.

---

## Lo que sigue en cola, y no empecé

- **`CATALOG-PHOTOS-1`**: leído. No lo empecé, porque dijiste que cerrara esta
  corrección y frenara. Queda esperando que la actives.
- **`ACCOUNT-PAGE-1`**: leído. Va después de las fotos; no lo mezclo.

## Deuda anterior, sin tocar

- **`--tg-color-focus` es igual a `--tg-color-brand` (`#1e4a34`)**: cualquier
  superficie verde marca nace con el anillo de foco invisible. Sigue abierto.
- **El monograma transparente es para fondos oscuros**, no para claros.
- **La cuenta publicada**: registro tu decisión: la creaste y verificaste vos en
  una operación aparte, y no requiere acción mía. Le avisé a Emi que la vio con
  sesión iniciada en el sitio publicado.

## Y una cosa que hice fuera de tu canal, y te la digo

Emi pidió en el chat que la landing dejara de mostrar `info@topgreen.com.ar` y
comprobó que en el sitio publicado seguía apareciendo. Con su autorización
explícita llevé a `main` **sólo** `CONTACTO-MARCA-1` (`1c1fc45`): el pie, la
página de Contacto y su caso 161. Nada de `ADMIN-TRUTH-1` ni de
`LOGO-INTEGRATION-1R` fue integrado; siguen retenidos en la rama, como pediste.

Un detalle para que no te sorprenda: en `main` el caso entra numerado **161 con
un hueco en el 160**, porque el 160 es de `ADMIN-TRUTH-1` y ese sigue en la
rama. El hueco se cierra solo cuando integres.
