# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Decisión sobre MARCAS-PANEL-1 — aceptada en rama

Sobre `ee8e90e` (producto en `24296c5`). Evidencia en
`REPRODUCCION-MARCAS-PANEL-1-2026-10-02.md`.

- **Caso 239:** 1/1, en escritorio, celular y por la API.
- **Negativos:** tus ocho dan rojo. De los míos, dan rojo dos:
  - contar las eliminadas;
  - corregir y dar de baja sin pedir administración.
- **Dos negativos míos sobreviven.** El código está bien; falta el caso.
  Van abajo, en el agregado de `INICIO-CIERRE-CELULAR-1`.
- **Suite completa desde base nueva:** 237/239.
  - Cae el 169, de entorno.
  - Cae el 195, por una carrera del caso. Está explicada abajo.
- **Auditorías, las dos guías y las puertas:** verdes.
- **Se aceptan tus cuatro supuestos y los riesgos declarados.**
- **Cerrar la ruta genérica de Configuración sin que te lo pidieran:**
  excelente. Lo mismo el contraste del subtítulo.

**Publicada en `main` (`4085a9a`, 02/10)** con autorización de Emi. No integres ni despliegues por tu cuenta.

---

## En espera — HERO-COMPACTO-1 (no empezar)

**En espera desde el 01/10.** La clienta pidió que Inicio explique mejor el
concepto, y Emi eligió sumar una sección «Por qué AgroBoeda» debajo de la
portada (maqueta v3, `maquetas/INICIO-CONCEPTO-V3-2026-10-01.html`). Cuando
la clienta la apruebe, esta pieza y la sección nueva van juntas en una sola
tarea. Va a cambiar el criterio de qué tiene que verse sin bajar. Lo de abajo
queda como referencia.


**Decisión de Emi (01/10), opción A.** Emi miró el Inicio publicado en su
notebook: la portada ocupa toda la pantalla, y los servicios del ecosistema,
que son lo principal de la versión 2, quedan abajo. En 1440 el título se parte
en cuatro renglones, con «cumplimiento» solo en uno, y la foto acompaña esa
altura. Es fiel a la maqueta: lo que cambia es la proporción, no el error.
Entregala por separado.

### Qué entra

1. **El título de la portada en tres renglones o menos** en 1440, con los
   tokens de tipografía que ya existen.
2. **La portada más baja.** En 1440×900 y en 1366×768, sin bajar, se ven:
   - el rótulo «El ecosistema AgroBoeda»;
   - «¿Qué querés hacer?»;
   - el borde de arriba de la primera fila de tarjetas.
3. **La foto acompaña la altura nueva**, sin deformarse y sin cortar el tractor
   ni la tolva.
4. **En 390 no empeora:** la portada no crece. Decí en el informe cuánto mide
   antes y después.

### Fuera de alcance

- Cambiar los textos aprobados, los botones o la foto elegida.
- Tocar las otras secciones de Inicio.

### Aceptación verificable

1. **Caso nuevo** que mida, en 1440×900 y 1366×768:
   - los renglones del título;
   - que «¿Qué querés hacer?» y el borde de la primera tarjeta queden dentro
     de la pantalla al abrir Inicio.
2. **Negativo:** la portada con la altura de hoy da rojo.
3. **Capturas antes y después** en 1440×900, 1366×768 y 390.
4. El 232 y el 233 siguen verdes.
5. Suite completa, a11y, contraste, móvil y las puertas de siempre.

### Frená y consultá

- Si para llegar hace falta un tamaño de letra o una medida que
  `tokens.css` no tiene.

---

## Tarea activa — INICIO-CIERRE-CELULAR-1

**Rama y base:** `claude/dev-role-repo-3l0kp3`, desde el último commit PM.


**Decisión de Emi (02/10), opción A.** En el celular, después de las siete
tarjetas aparece «¿Te interesa alguno?», un bloque verde grande, y debajo
queda suelto el crédito de las fotos. Corta la lectura a mitad de página. En
la computadora es la octava tarjeta y completa la grilla, así que ahí está
bien.

### Qué entra

1. **En el celular, «¿Te interesa alguno?» pasa al final de Inicio,**
   después de «Principio de AgroBoeda», como cierre. Lleva los mismos
   textos y el mismo botón.
2. **El crédito de las fotos queda pegado a las tarjetas.**
3. **En la computadora no cambia nada.** Decí desde qué ancho cambia, y por
   qué ahí.
4. **El orden de lectura** (lector de pantalla y tabulación) tiene que
   coincidir con lo que se ve en cada ancho.

### Aceptación verificable

1. **Caso nuevo:**
   - en 390, «¿Te interesa alguno?» está después de «Principio de
     AgroBoeda» y el crédito está inmediatamente después de la tarjeta 07;
   - en 1440, sigue como octava tarjeta;
   - en los dos anchos, el bloque aparece una sola vez en el árbol del
     documento.
2. **Negativo:** el bloque otra vez en el medio, en el celular, da rojo.
3. El 232 y el 233 siguen verdes. Suite, a11y, contraste, móvil y las
   puertas.

### Agregado chico, de la revisión de MARCAS-PANEL-1

Va en un commit aparte, dentro de esta entrega:

1. **El 239 comprueba que unir mueve también las pausadas y las
   eliminadas.** Mi negativo «unir mueve sólo las activas» sobrevive: el 239
   pasa aunque una pausada quede con la marca borrada.
2. **El 239 comprueba que Configuración no renombra una marca** por
   `PUT /admin/form-options/{id}`. Hoy prueba sólo el borrado. Mi negativo
   «sacar la guarda del cambio de nombre» sobrevive.
3. **«Editar» muestra el nombre de una marca dada de baja,** no su valor
   interno: «AgroMec» y no «agromec». Hoy el selector agrega la opción con el
   valor. Dar de baja ahora está en la pantalla, así que esto se va a ver.
4. **El 195 espera las opciones del filtro de tipo antes de leerlas.** En mi
   suite cayó con «el filtro de tipo ofrece ["Todos"] y en la base hay
   ["Arados (14)","Rastras (3)"]», y repetido solo pasó. Lee las opciones
   apenas aparece el selector, antes de que lleguen las cantidades. Fijate
   si otro caso de `FILTROS-DE-PUBLICACIONES-1` lee igual.

Cada uno con su negativo en rojo: el 1 y el 2 con mis sabotajes, y el 3 con
volver a mostrar el valor interno.

---

## Después — AVISOS-1 (apenas entregues INICIO-CIERRE-CELULAR-1)

**Decisión de Emi (02/10): opción A de `maquetas/AVISOS-V2-2026-10-02.html`**
(y `.jpg`), la «píldora verde de la marca». Los avisos de hoy le parecen
feos y genéricos. Entregala por separado.

### Qué entra

1. **El aviso de la maqueta, opción A:**
   - fondo verde de la marca, texto blanco y esquinas redondeadas;
   - ícono redondo cereal con tilde, o rojo con «!» si es un error;
   - una segunda línea opcional, más tenue.
2. **Abajo al centro**, en la computadora y en el celular. Nunca tapa la
   cabecera.
3. **Entra desde abajo** con un rebote corto y sale bajando. Con
   `prefers-reduced-motion`, sin animación.
4. **Varios a la vez se apilan con profundidad:** los de atrás, más chicos y
   asomando. Con el mouse encima se despliegan.
5. **En el celular se cierran deslizando.** También tienen un botón para
   cerrar, que se puede usar con teclado.
6. **Tiempos:** lo que salió bien se va a los 4 s, y se pausa con el mouse o
   el foco encima. Un error se queda hasta cerrarlo, con `role="alert"`; lo
   demás, `role="status"`.
7. **Una acción opcional** («Ver carrito», «Deshacer», «Reintentar»). Sumala
   donde ya exista lo que hace: por ejemplo, «Ver carrito» al agregar. No
   inventes acciones que el producto no tiene. Decí en el informe dónde la
   pusiste.
8. **Sin rótulo en mayúsculas** («ÉXITO», «ERROR»).
9. **Una librería** como Sonner, si la usás, va por npm, con licencia libre
   y sin cargar nada de afuera (CSP). Si no, a mano. Lo elegís vos.

### Aceptación verificable

1. **Caso nuevo, en 1440 y 390:**
   - el aviso aparece abajo y no se superpone con la cabecera;
   - el de éxito se va a los 4 s y el de error se queda;
   - tres seguidos quedan apilados, sin superponer el texto;
   - se cierra con el botón y con teclado.
2. **Negativo:** el error que se va solo a los 4 s da rojo.
3. **Los casos que leen avisos** siguen verdes o se ajustan, y el informe
   dice cuáles.
4. **Capturas** de éxito, error y pila, en los dos anchos.
5. Suite, a11y (contraste del texto sobre el verde incluido), móvil y las
   puertas.

---

## Después — FILTROS-VISUAL-1 (apenas entregues AVISOS-1)

**Decisión de Emi (02/10): aprobó `maquetas/FILTROS-V1-2026-10-02.html`**
(y `.jpg`). El panel de filtros de hoy, con ocho desplegables iguales, se ve
genérico. Es un cambio de cómo se ve: qué se filtra y cómo se cuenta no
cambian. Entregala por separado.

### Qué entra

1. **Computadora**, como la maqueta:
   - «Todo / Productos / Servicios» como selector de tres partes;
   - la categoría y la subcategoría, como lista con su cantidad, y lo
     elegido marcado;
   - la marca, como lista con su cantidad y un buscador cuando hay más de
     seis;
   - la potencia, la condición y el origen, como etiquetas que se tocan;
   - el año y el precio, con «desde» y «hasta»;
   - «Dónde», con buscador de provincia o localidad;
   - los grupos se pliegan.
2. **Arriba de los resultados**, lo elegido como etiquetas verdes con cruz,
   más «Limpiar todo». Sacar una saca ese filtro.
3. **Celular:** una hoja que sube desde abajo, con «Limpiar» y un botón fijo
   «Ver N publicaciones», con el número de la búsqueda que se va a ver.
4. **Las barritas por año** son opcionales. Si suman un pedido o una
   consulta pesada, no van; decilo.
5. **Sin cambiar las reglas de hoy:** sólo opciones con publicaciones, la
   elegida en cero a la vista, una marca por vez y la URL que conserva los
   filtros.

### Aceptación verificable

1. **Los casos de filtros** (173, 175, 195, 198, 199, 200, 237 y los que
   lean el panel) siguen verdes o se ajustan sin cambiar lo que miden. El
   informe dice cuáles y por qué.
2. **Caso nuevo:**
   - las etiquetas de arriba coinciden con los filtros puestos, y sacar una
     la saca de la búsqueda y de la URL;
   - en 390, «Ver N publicaciones» dice el mismo número que muestra la lista
     al cerrar la hoja.
3. **Teclado y lector de pantalla:** cada opción se elige con teclado y
   anuncia su cantidad; la hoja del celular atrapa el foco y lo devuelve al
   cerrar.
4. **Capturas** en 1440 y 390, junto a la maqueta.
5. Suite, a11y, contraste, móvil, las dos guías y las puertas.

### Frená y consultá

- Si algún control de la maqueta obliga a cambiar la API o a hacer más
  pedidos por cada cambio de filtro.

---

## Después — VENDER-SIN-SESION-1 (empezala apenas entregues FILTROS-VISUAL-1)

**Decisión de Emi (01/10), opción B:** «Vender» se ve siempre en la cabecera.
Entregala por separado.

### Problema

Desde `INICIO-ECOSISTEMA-1`, sin sesión no hay ningún botón para publicar:

- «Publicar una oferta» salió de Inicio;
- la página «Quiénes somos», que tenía el otro botón, salió del sitio;
- «Vender» aparece sólo después de ingresar.

### Qué entra

1. **«Vender» en la cabecera para todos**, en escritorio y en celular.
2. **Sin sesión:** abre el ingreso, y al entrar abre el formulario de
   publicar. Es el mismo recorrido que hacía `pedirPublicar` antes de
   `b5daa24`:
   - cancelar o equivocar la contraseña no abre nada;
   - darse de alta no abre sesión, así que no hay nada que retomar.
3. **Con sesión:** como hoy.

### Fuera de alcance

- Volver a poner «Publicar una oferta» en Inicio: la maqueta aprobada no lo
  tiene.
- Cambiar el texto de la tarjeta del Mercado.

### Aceptación verificable

1. **Caso nuevo, en 1440 y 390, sin sesión:**
   - «Vender» se ve;
   - ingresar lleva al formulario;
   - cancelar el ingreso no abre nada.
2. **Con sesión:** «Vender» abre el formulario como hoy.
3. **Negativos:**
   - «Vender» oculto sin sesión da rojo;
   - ingresar sin que se abra el formulario da rojo.
4. **La cabecera en 390** no desborda ni tapa controles: la auditoría móvil
   y las capturas lo muestran.
5. Suite completa desde base nueva, a11y, contraste, móvil, las dos guías y
   las puertas de siempre.

### Frená y consultá

- Si en 390 «Vender» no entra en la cabecera sin cambiar su forma.

---

## Después — PRODUCCION-ANIMAL-1 (apenas entregues VENDER-SIN-SESION-1)

**Decisión de Emi (02/10), por el documento de la clienta**
(`originales/INDEXACION-CLIENTA-2026-10-02.docx`, punto 1). Entregala por
separado.

### Problema

«Bienes y Ganado» se lee como vacas, y su única subcategoría es «Bovinos». La
clienta quiere que la familia abarque cualquier especie. Es la misma familia
del contrato («animales de cría y comerciales»), más amplia.

### Qué entra

1. **«Bienes y Ganado» pasa a llamarse «Producción animal».** Los enlaces
   viejos siguen funcionando.
2. **Subcategorías:** Bovinos, que ya existe, más Equinos, Porcinos, Ovinos,
   Caprinos, Avicultura, Apicultura y Otras especies.
3. **«Raza»**, opcional, de texto, al publicar y en «Editar» en esta familia.
   Se ve en la ficha y filtra con la regla de `FILTROS-DE-PUBLICACIONES-1`:
   sólo las razas publicadas, sin importar mayúsculas ni acentos.
4. **Producción:** la siembra no corre ahí, y las categorías no se cargan por
   migración (decisión del 26/09). Proponé cómo llegan las subcategorías y el
   nombre nuevo sin duplicar nada. Por ejemplo, agregar por slug las que
   falten y renombrar sólo si el nombre sigue siendo el viejo. Probalo con un
   caso sobre una base sin siembra y en modo producción.
5. **Las guías y los casos** que nombran «Bienes y Ganado».

### Fuera de alcance

- La familia «Producción» (vegetal, forestal, acuícola): espera la reunión.
- Publicar sin categoría y la clasificación automática: fuera del MVP.

### Aceptación verificable

1. **Caso nuevo:**
   - el Mercado y el alta dicen «Producción animal», con sus ocho
     subcategorías;
   - publicar un lote de Apicultura con raza «Carniola» lo hace aparecer en
     el filtro;
   - un enlace viejo lleva a la familia.
2. **Producción:** sobre una base sin siembra, con la familia ya renombrada a
   mano, la carga no duplica ni pisa el nombre. Correrla dos veces no cambia
   nada.
3. **Negativo:** una subcategoría que falta en producción da rojo.
4. Suite completa, a11y, contraste, móvil, las dos guías y las puertas.

### Frená y consultá

- Si renombrar rompe la logística («Hacienda en pie»), el estado «nuevo o
  usado» o la marca de esa familia.

---

## Después — BUSCADOR-SINONIMOS-1 (apenas entregues PRODUCCION-ANIMAL-1)

**Decisión de Emi (02/10).** Es el puente barato al «buscador inteligente» de
la clienta, sin inteligencia artificial. La clasificación automática queda
fuera del MVP. Entregala por separado.

### Problema

Hoy el buscador de texto compara letra por letra con `ilike` en el nombre, la
descripción, la marca y el modelo. «Colmena» no encuentra «colmenas»,
«tractor» no encuentra «Tractór», y «apicultura» no encuentra un lote de
colmenas publicado en Apicultura si el texto no lo dice.

### Qué entra

1. **Sin acentos ni mayúsculas**, y **singular y plural** en español.
2. **El nombre de la categoría y de la subcategoría también se buscan.**
   «Apicultura» encuentra lo publicado en Apicultura.
3. **Sinónimos**, en una lista versionada en el código, corta y revisable por
   la clienta. Por ejemplo:
   - colmena, abeja y apicultura;
   - vaca, vacuno, bovino y hacienda;
   - caballo y equino;
   - cerdo, chancho y porcino;
   - oveja y ovino;
   - cabra y caprino;
   - gallina, pollo y avicultura;
   - pulverizadora, fumigadora y mosquito;
   - cosechadora y trilladora.

   Que la lista diga de dónde sale cada grupo.
4. **Los filtros y el conteo** siguen saliendo del servidor, igual que hoy.

### Fuera de alcance

- Interpretar frases enteras o clasificar con inteligencia artificial.
- Corregir errores de tipeo.
- Ordenar por relevancia: si lo considerás necesario, proponelo.

### Aceptación verificable

1. **Caso nuevo:**
   - «colmena» encuentra «Colmenas Langstroth» y un lote publicado en
     Apicultura;
   - «TRACTOR» y «tractores» encuentran lo mismo que «tractor»;
   - «fumigadora» encuentra una pulverizadora;
   - una palabra sin relación no trae nada.
2. **Negativos:**
   - sin los sinónimos da rojo;
   - sin quitar acentos da rojo.
3. **El tiempo de respuesta** del Mercado con 1000 publicaciones, antes y
   después, medido en el informe.
4. Suite completa y las puertas.

### Frená y consultá

- Si hace falta una extensión de PostgreSQL que el servicio de Railway no
  tenga, como `unaccent`. Decí cómo comprobarlo antes de publicar.

---

## Después — MERCADO-FICHA-VISUAL-1 (apenas entregues BUSCADOR-SINONIMOS-1)

**Decisión de Emi (02/10): aprobó `maquetas/MERCADO-FICHA-V1-2026-10-02.html`**
(y `.jpg`). Las tarjetas del Mercado y la página de una publicación se ven
genéricas: dos botones pesados por tarjeta, uno «Ingresar para continuar», y
rótulos internos como «ACTIVO DE ALTO VALOR». Es un cambio de cómo se ve:
qué se publica, qué se compra y quién ve qué no cambian. Entregala por
separado.

### Qué entra

1. **Tarjeta del Mercado**, como la maqueta:
   - la tarjeta entera lleva a la publicación, con un solo enlace accesible
     (no un enlace por cada parte);
   - salen «Ingresar para continuar» y «Ver detalle»: el ingreso se pide
     recién al comprar, como hoy en la publicación;
   - salen los rótulos internos («Activo de alto valor», «Insumo
     estandarizado» y los que haya). En su lugar, la ruta en palabras de
     quien compra: «Maquinaria agrícola · Tractores»;
   - la condición («Nuevo», «Usado», «Servicio») sobre la foto;
   - una línea con los datos clave que la publicación tenga (marca, año,
     potencia, presentación o cobertura), la ubicación, el precio con su
     unidad y quién vende con su calificación.
2. **Página de una publicación**, como la maqueta:
   - galería con miniaturas cuando hay más de una foto;
   - los datos clave como fichas cortas arriba, y «Datos declarados» completo
     abajo, con «declarado por quien vende»;
   - una sola acción principal («Agregar al carrito» o la que corresponda
     hoy), con la cantidad;
   - quién vende, con su calificación y «Ver perfil», que abre lo que hoy
     abre;
   - la nota «Pagás directo a quien vende, por Mercado Pago o transferencia.
     AgroBoeda no recibe ni guarda tu dinero.»;
   - el crédito de la foto ilustrativa queda chico: «Foto ilustrativa · ver
     créditos».
3. **Celular:** la barra de abajo fija con el precio y la acción principal.
4. **Sólo datos que ya existen.** La maqueta muestra ejemplos. Si un dato de
   la maqueta no existe hoy (por ejemplo, «Documentación revisada» o
   «Responde en 24 h»), no se muestra ni se inventa.

### Fuera de alcance

- Cambiar la API, el carrito, la compra o qué datos de quien vende se ven.
  El teléfono sigue sin aparecer.
- Botones nuevos, como «Consultar a quien vende»: no existe y no entra.
- Las pantallas de ingreso, carrito y Mi cuenta: son `CUENTA-VISUAL-1`.

### Aceptación verificable

1. **Los casos que leen tarjetas y publicaciones** siguen verdes o se ajustan
   sin cambiar lo que miden. El informe dice cuáles y por qué.
2. **Caso nuevo, en 1440 y 390:**
   - tocar cualquier parte de la tarjeta abre esa publicación;
   - ninguna tarjeta dice «Ingresar para continuar», «Ver detalle» ni un
     rótulo interno;
   - la ruta de la tarjeta coincide con la categoría y la subcategoría de la
     publicación;
   - sin sesión, la acción principal lleva al ingreso, y al volver se puede
     seguir;
   - en 390, el precio de la barra fija es el de la publicación.
3. **Teclado y lector de pantalla:** cada tarjeta es una sola parada de Tab
   y anuncia título, precio y ubicación; la galería se recorre con teclado.
4. **Capturas** en 1440 y 390, junto a la maqueta.
5. Suite, a11y, contraste, móvil, las dos guías y las puertas.

### Frená y consultá

- Si algún dato de la maqueta obliga a cambiar la API o a hacer un pedido
  más por tarjeta.

---

## Después — CUENTA-VISUAL-1 (apenas entregues MERCADO-FICHA-VISUAL-1)

**Decisión de Emi (02/10): aprobó `maquetas/CUENTA-V1-2026-10-02.html`**
(y `.jpg`). Ingresar, el carrito y Mi cuenta son ventanas blancas y cajas
apiladas con encabezados de colores, y Mercado Pago usa un azul que no
aparece en ningún otro lado. Es un cambio de cómo se ve: ninguna función
nueva. Entregala por separado.

### Qué entra

1. **Ingresar y Creá tu cuenta:**
   - en computadora, la foto de la marca al lado del formulario; en celular,
     sin foto;
   - campos más amplios, con el foco bien marcado y «Mostrar» la contraseña;
   - «Creá tu cuenta» en lugar de «Registrate acá». No dice «gratis».
2. **Carrito como panel lateral** que entra desde la derecha:
   - los productos agrupados por quien vende, con «Pedido 1 de 2»;
   - la cantidad se cambia con − y +, con los mismos límites de hoy;
   - el total abajo y la nota «Se arma un pedido por cada vendedor. Le
     pagás directo a cada uno.»;
   - en celular, ocupa la pantalla entera.
3. **Mi cuenta:**
   - un menú a la izquierda en lugar de pestañas: Mi perfil, Notificaciones,
     Mis compras, Mis ventas, Mis publicaciones, Cobros, Documentación y
     Seguridad, según lo que cada rol tiene hoy;
   - «Hola, <nombre>» y cuatro cifras arriba (publicaciones, ventas,
     compras, reputación), sólo con datos que ya trae la pantalla;
   - secciones blancas con bordes suaves;
   - Mercado Pago con los colores del sitio, sin el azul;
   - el CBU enmascarado en la vista, completo al editar;
   - «Seguridad» (cambiar contraseña) y «Documentación» tienen su propio
     lugar en el menú, no al fondo de «Mi perfil»;
   - en celular, el menú es una fila deslizable arriba.

### Fuera de alcance

- Cambiar la API, las reglas de la compra, las de la contraseña o qué ve
  cada rol.
- Funciones nuevas en Mi cuenta.
- El texto «gratis» o cualquier promesa sobre suscripciones.

### Aceptación verificable

1. **Los casos de ingreso, registro, carrito, compra, Mi cuenta, Mercado
   Pago, contraseña y sesiones** siguen verdes o se ajustan sin cambiar lo
   que miden. El informe dice cuáles y por qué.
2. **Caso nuevo, en 1440 y 390:**
   - con productos de dos vendedores, el panel muestra dos grupos, el total
     es la suma y «Continuar con la compra» arma dos pedidos, como hoy;
   - cambiar una cantidad con − y + respeta el máximo disponible y el mínimo
     de 1;
   - cada opción del menú de Mi cuenta abre su sección, y la URL o el
     estado la conserva al recargar si hoy la conserva;
   - el CBU no se ve completo fuera de «Editar»;
   - ninguna pantalla dice «gratis».
3. **Teclado y lector de pantalla:** el panel del carrito atrapa el foco,
   cierra con Escape y lo devuelve; el menú de Mi cuenta marca la sección
   actual.
4. **Capturas** en 1440 y 390, junto a la maqueta.
5. Suite, a11y, contraste, móvil, las dos guías y las puertas.

### Frená y consultá

- Si las cuatro cifras de arriba necesitan un pedido nuevo a la API.
- Si el panel lateral cambia cómo se arma o se paga un pedido.

---

## Después — OBSERVABILIDAD-1 (al final de la cola, antes del lanzamiento)

**Decisión de Emi (02/10).** Hoy no hay registro de los errores que ve la
gente ni de cómo usa el sitio. Entregala por separado.

### Qué entra

1. **Sentry** (plan gratis) en el Frontend y en el Backend.
   - Sin datos personales: nada de correos, nombres, teléfonos,
     contraseñas, tokens, cookies, CBU ni datos de pago, ni en el mensaje, ni
     en la URL, ni en el cuerpo.
   - Se enciende sólo si existe la variable con la clave. En local y en las
     pruebas, apagado.
2. **Microsoft Clarity** (gratis) en el Frontend.
   - Todo campo escrito, oculto.
   - El panel de administración, «Mi cuenta» y el pago, sin grabar.
   - Se enciende con su variable, como Sentry.
3. **Una línea en la política de privacidad del sitio,** si existe, que diga
   qué se mide y para qué. Si no existe, decilo y proponé el texto.
4. **`RAILWAY.md`**: qué variables cargar y dónde. Las claves las carga Emi
   en Railway; nunca van al repositorio ni al chat.

### Aceptación verificable

1. **Caso nuevo con un Sentry falso local:**
   - un error del Frontend y otro del Backend llegan;
   - ninguno lleva un correo, una contraseña ni un token, aunque el error
     ocurra en un formulario con esos datos.
2. **Clarity apagado** sin su variable, y sin grabar en el panel, en «Mi
   cuenta» ni en el pago.
3. **Negativo:** un evento que lleva el correo de la sesión da rojo.
4. Suite completa, a11y, contraste, móvil y las puertas.

### Frená y consultá

- Si algún paquete pide una cuenta paga, o carga código de un dominio que la
  política de seguridad del sitio (CSP) no permite.

---

## Después (no empezar todavía)

Lo decide la PM. Lo que depende de Emi puede reordenar la cola:

- la parte B de las publicaciones de prueba (el transportista y el flete),
  cuando ande el correo;
- P3:
  - los errores de la API en «tú»;
  - las guías que no nombran los avisos de pago;
  - los tres de `COBRO-CONCURRENTE-1`;
  - los cuatro de `PAGO-ORDEN-CERRADA-1` y los de
    `RECONCILIADOR-PROGRAMADO-1` y `DESVINCULAR-CON-COBROS-1`, en sus
    reproducciones;
- **antes del 01/12/2026:** sacar de `railway.toml` la configuración del
  Backend y del Frontend (Railway deja de leerla ese día). Pieza propia;
- una devolución o un contracargo que llega con la cuenta desvinculada no
  se registra: quien compra sigue viendo «pagado» (freno de
  `DESVINCULAR-CON-COBROS-1`);
- **antes del lanzamiento real de Mercado Pago:** si la prueba lo confirma,
  la vinculación en Safari, Brave y Firefox (la cookie del Backend en otro
  sitio). Lo más probable es que alcance con un dominio propio, que es de Emi
  y de Railway, no de código;
- el título de la pestaña, la descripción para buscadores y el lema del pie
  con el ecosistema, cuando la clienta dé el texto;
- el correo (#15);
- las cuentas de prueba de Mercado Pago;
- la mejora de la logística en los filtros, por definir.
