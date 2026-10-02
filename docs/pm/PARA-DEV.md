# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Decisión sobre CAMBIAR-CONTRASENA-1 — aceptada en rama

Sobre `02e82e3` (producto en `f7340f5` y `001507f`). Evidencia en
`REPRODUCCION-CAMBIAR-CONTRASENA-1-2026-10-01.md`.

- **El 235:** 1/1.
- **Negativos:** tus cuatro dan rojo. También dan rojo los tres míos:
  - el alta del panel con su regla vieja;
  - un error que borra lo escrito;
  - el filtro del 422 que mira sólo `password` y no `new_password`.
- **Suite completa desde base nueva:** 234/235. Sólo cae el 169, de entorno.
- **Auditorías y las dos guías:** verdes.
- **Tus riesgos:** aceptados.
- **Sacar la contraseña del 422:** bien visto, y se queda.

La publicación a `main` la decide Emi. No integres ni despliegues.

`INICIO-ECOSISTEMA-1` está publicada en `30f9791`.

---

## Tarea activa — SESIONES-AL-CAMBIAR-1

**Rama y base:** `claude/dev-role-repo-3l0kp3`, desde el último commit PM. Va antes de `FILTROS-DE-PUBLICACIONES-1`.

### Problema

Cambiar la contraseña no cierra ninguna sesión. Lo midió la Dev en el freno
`3f9f2e5`:

- el token de renovación dura 30 días;
- cada renovación emite otro de 30 días.

Una sesión abierta en otro dispositivo no vence nunca. Es justo el caso de
las dos contraseñas que quedaron en chats: cambiarlas no saca a quien ya
hubiera entrado.

### Qué entra

1. **Cambiar la propia contraseña** deja sin valor todas las sesiones
   anteriores de esa cuenta, de acceso y de renovación. La sesión desde la
   que se cambió sigue abierta, o se reabre sola, sin pedir ingresar de
   nuevo.
2. **Restablecerla desde el panel** también invalida las sesiones
   anteriores de esa cuenta.
3. **Desactivar una cuenta desde el panel:** decí en el informe si hoy sus
   sesiones siguen valiendo. Si siguen, que también se invaliden.
4. **Cómo, lo elegís vos.** Por ejemplo, la marca de cuándo cambió que
   propusiste. Si necesita migración, aditiva y probada en modo producción.

### Aceptación verificable

1. **Caso nuevo con dos sesiones de la misma cuenta.**
   - Cambiar la contraseña en una:
     - la otra recibe 401, tanto con el token de acceso como con el de
       renovación;
     - la que cambió sigue funcionando.
   - Lo mismo al restablecer desde el panel.
2. **Negativo:** sin la comprobación, la sesión vieja sigue entrando y da
   rojo.
3. **Migración:** si hay una, el caso corre sobre una base sin siembra y se
   prueba en modo producción.
4. Suite completa desde base nueva y las puertas de siempre.

### Frená y consultá

- Si invalidar obliga a cerrar la sesión de todas las cuentas a la vez, o a
  cambiar `JWT_SECRET`.

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

## Siguiente — FILTROS-DE-PUBLICACIONES-1 (apenas entregues SESIONES-AL-CAMBIAR-1)

**Decisión de Emi (01/10), por pedido de la clienta.** Revierte la decisión
del 25/09 («el filtro de marca muestra las 44»). Va antes de
`VENDER-SIN-SESION-1`. Entregala por separado.

### Problema

La clienta eligió Maquinaria agrícola, después Tractores, y el filtro le
ofreció todas las marcas, aunque nadie haya publicado un tractor de la
mayoría. Ella quiere que los filtros salgan de las publicaciones:

- sólo se ofrece lo que alguien publicó;
- una marca nueva que alguien escriba aparece sola.

Su prototipo está en `originales/BUSCADOR-AGROMARKET-CLIENTA-2026-10-01.html`.

### Qué entra

1. **Cada filtro del Mercado ofrece sólo opciones con publicaciones** dentro
   de la búsqueda de ese momento, con su cantidad. Vale para la marca, el
   tipo, los rangos de potencia, el origen y la condición.
   - Con Tractores elegido, sólo las marcas que tienen tractores publicados.
   - Una opción ya elegida se sigue mostrando aunque quede en cero, para
     poder sacarla.
   - Sin categoría que use marca, sigue la regla del caso 175.
2. **«Otra marca» al publicar y en «Editar»,** en las categorías con
   `usa_marca`.
   - Se escribe el nombre: de 2 a 40 caracteres, sin espacios de más.
   - Si coincide con una marca que ya existe, sin importar mayúsculas,
     acentos ni espacios, se usa esa y no se crea otra.
   - Si es nueva, aparece sola en el filtro con su cantidad, y en la ficha
     con el nombre como se escribió.
   - La lista del alta la ofrece desde ahí para las publicaciones
     siguientes.
   - Cómo se guarda lo elegís vos. Si necesita migración, aditiva y probada
     en modo producción, con un caso sobre una base sin siembra.
3. **«Tecnologizar» pasa a «Tecnificar»** en «Cómo funciona» de Inicio (la
   clienta, 01/10). Actualizá los casos que lo lean.

### Fuera de alcance

- Unir o corregir marcas desde el panel: es otra pieza.
- Las categorías («Bienes y Ganado», agrícola o pecuario, la hacienda) y
  «Origen y Destino»: esperan una reunión de Emi con la clienta.
- Integración y despliegue.

### Aceptación verificable

1. **Caso nuevo, en el Mercado, en escritorio y celular:**
   - con Tractores elegido, la marca ofrece exactamente las marcas de los
     tractores publicados, con su cantidad, y ninguna en cero;
   - lo mismo con el tipo y la potencia;
   - una marca elegida que queda en cero sigue a la vista.
2. **Caso nuevo de «Otra marca»:**
   - publicar un tractor con «Otra marca: Agromec» hace que «Agromec»
     aparezca en el filtro, con 1, y en la ficha;
   - otro con «AGROMEC » usa la misma marca, y el filtro dice 2;
   - «Otra marca: john deere» usa John Deere;
   - la API rechaza una de 1 o de 41 caracteres, con su motivo.
3. **Negativos:**
   - el filtro con opciones en cero da rojo;
   - una marca nueva que no aparece en el filtro da rojo;
   - «AGROMEC» creada como una segunda marca da rojo.
4. **Las dos guías** se actualizan si nombran el filtro de marca o la lista
   cerrada.
5. Suite completa desde base nueva, a11y, contraste, móvil y las puertas de
   siempre.

### Frená y consultá

- Si quitar las opciones en cero rompe la regla del caso 175, o algún filtro
  que dependa de otro.
- Si «Otra marca» obliga a cambiar cómo se guardan las marcas que ya existen.

---

## Después — VENDER-SIN-SESION-1 (empezala apenas entregues FILTROS-DE-PUBLICACIONES-1)

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
