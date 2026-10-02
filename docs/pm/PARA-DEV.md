# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Decisión sobre FILTROS-DE-PUBLICACIONES-1 — aceptada en rama

Sobre `f5051b8` (producto en `11c6069` y `353cf94`). Evidencia en
`REPRODUCCION-FILTROS-DE-PUBLICACIONES-1-2026-10-02.md`.

- **Casos:** 173, 174, 175, 195, 198, 207, 232, 237 y 238 en 9/9.
- **Negativos:** tus catorce dan rojo. También dan rojo los tres míos:
  - sin sacar acentos;
  - el filtro con marcas dadas de baja;
  - la condición contada sin el filtro de marca.
- **Suite completa desde base nueva:** 237/238. Sólo cae el 169, de entorno.
- **Auditorías y las dos guías:** verdes.
- **El congelamiento que encontraste en tu código** y el caso que lo mide:
  excelente.

La publicación a `main` la decide Emi. No integres ni despliegues.

`SESIONES-AL-CAMBIAR-1` está publicada en `d6fa79b`.

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

## Tarea activa — MARCAS-PANEL-1

**Rama y base:** `claude/dev-role-repo-3l0kp3`, desde el último commit PM.

**Decisión de Emi (02/10).** Lo declaraste en tu informe de FILTROS: una
marca escrita con «Otra marca» no se puede corregir, unir ni dar de baja
desde el sitio, y queda en la lista para siempre. Va antes de
`INICIO-CIERRE-CELULAR-1` y `VENDER-SIN-SESION-1`. Entregala por separado.

### Qué entra

En el panel de administración, una sección «Marcas» con la lista completa:
nombre, cuántas publicaciones la usan y si se cargó de la lista o la escribió
alguien al publicar.

1. **Corregir el nombre** de una marca: «jhon deer» pasa a «John Deere». Si el
   nombre corregido coincide con otra que ya existe, ofrece unirlas.
2. **Unir dos marcas:** las publicaciones de la que se va pasan a la que
   queda, y la que se va desaparece del filtro y del alta. Pide confirmar y
   dice cuántas publicaciones se mueven.
3. **Dar de baja** una marca: sale del alta y del filtro. Las publicaciones
   que la tienen la siguen mostrando en su ficha, como hoy con una marca
   dada de baja. Se puede volver a dar de alta.
4. **La guía del panel** suma el paso, y `guia-admin.mjs` lo comprueba. Sale
   de «Lo que el programa no comprueba» la frase de que no se puede
   corregir.

### Fuera de alcance

- Aprobar las marcas nuevas antes de que aparezcan.
- Marcas por categoría.

### Aceptación verificable

1. **Caso nuevo, en escritorio y celular:**
   - una publicación con «Otra marca: Jhon Deer», unida a John Deere, pasa
     a contar en John Deere, y «Jhon Deer» deja de estar en el filtro y en
     el alta;
   - corregir el nombre de «Agromec» a «AgroMec» se ve en la ficha y en el
     filtro;
   - dar de baja la saca del alta y del filtro, y la ficha la sigue
     mostrando.
2. **Permisos:** quien no es administración recibe 403 en cada acción,
   llamada directo a la API.
3. **Unir dos veces seguidas,** o unir una marca consigo misma, no rompe
   nada.
4. **Negativos:**
   - unir sin mover las publicaciones da rojo;
   - una acción sin control de rol da rojo.
5. Suite completa, a11y, contraste, móvil, las dos guías y las puertas.

### Frená y consultá

- Si unir obliga a cambiar cómo se guardan las marcas, o necesita una
  migración que no sea aditiva.

---

## Después — INICIO-CIERRE-CELULAR-1 (apenas entregues MARCAS-PANEL-1)

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

## Después — VENDER-SIN-SESION-1 (empezala apenas entregues AVISOS-1)

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
