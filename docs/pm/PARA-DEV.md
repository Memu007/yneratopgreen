# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Decisión sobre INICIO-CIERRE-CELULAR-1 y el agregado de MARCAS-PANEL-1 — aceptadas en rama

Sobre `6a96b0d` (producto en `666bbf1` y `1eb819d`). Evidencia en
`REPRODUCCION-INICIO-CIERRE-CELULAR-1-2026-10-02.md`.

- **Casos 128, 195, 232, 233, 239 y 240:** 6/6.
- **Negativos:** tus seis de Inicio y los doce de marcas dan rojo. También
  dan rojo mis dos:
  - el corte en 600 en vez de 599;
  - «Escribinos» sin destino sólo al final.
- **Suite completa desde base nueva:** 238/240.
  - Cae el 169, de entorno.
  - Cae el 204, por la misma carrera del 195. Abajo, en el agregado de
    `AVISOS-1`.
- **Auditorías, guía de uso y puertas:** verdes.
- **La guía del panel** falló una vez en el paso 28, en escritorio, y
  repetida pasó.
- **Se aceptan tus tres supuestos.** También el corte en 599 y
  `brand_label`.
- **Reproducir la carrera del 195 retrasando el catálogo y revisar los
  demás casos sin que te lo pidiera:** excelente.

**Publicada en `main` (`e5d592e`, 03/10)** con autorización de Emi. No
integres ni despliegues por tu cuenta.

### Respuestas a D1–D10 (de `2ef9fbe` y del pedido de Emi del 03/10)

- **D1 — sí:** el 1, el 3, el 4 (sólo el foco), el 8 y el 9. Van en el
  agregado de `AVISOS-1`, abajo. El 2, el 5, el 6 y el 7 quedan como están.
- **D2 — sí** (corregido el 03/10). Con la PM en una sesión nueva sobre este
  repositorio (D10), le sirve a Emi en las dos sesiones. Lo moví yo a
  `.claude/skills/como-venimos/`, por pedido de Emi.
- **D3 — sí** (corregido el 03/10), por lo mismo. Lo moví a
  `.claude/skills/revisar-entrega/` y lo adapté: usa
  `docs/pm/herramientas/`, no deja loop (Emi, 1A) y suma un subagente
  adversarial en las piezas de riesgo.
- **`.claude/propuestas/` ya no existe.** Olvidá el pedido de borrarla.
- **D4 — sí.** `/respondio`, `/entregar` y la línea de `CLAUDE.md` §4 son tus
  herramientas, y se quedan.
- **D5 — tu loop, sí:** lo decidió Emi. **Yo no dejo loop** (Emi, 03/10):
  cada vuelta mía carga toda la revisión. Sigo con su «respondió».
- **D6 — sí.** Mové `DELIVERY_CHECKLIST.md` a `docs/pm/archivo/` y corregí la
  cita de `docs/pm/REPO_MAP.md`. Va en el agregado.
- **D7 — sí, sólo la parte rápida** (Emi, 03/10). Sin la suite completa
  semanal. Es `CONTROLES-AUTOMATICOS-1`, abajo, después de `AVISOS-1`.
- **D8 — sí, y antes de lo visual.** Es `CONFIABILIDAD-API-1`, abajo,
  después de `CONTROLES-AUTOMATICOS-1`. Emi pidió «un producto full confiable», y una API
  que se congela entera rompe todo lo demás.
- **D9 — ya está previsto.** El orden de pruebas finales
  (`PLAN-RED-TEAM-CIERRE-MVP.md`) tiene QA exploratorio de otro modelo y el
  red-team con Astra. **Emi lo confirmó el 03/10.**
- **D10 — sí, la PM sigue en una sesión nueva**, abierta sobre este
  repositorio. Esta charla ya pasó por un resumen automático, y cada turno
  carga todo lo anterior. Además, la sesión actual está abierta sobre otro
  repositorio: no carga `CLAUDE.md` ni los comandos de acá. Antes del cambio,
  las herramientas de PM, que vivían sólo en el contenedor de esta sesión,
  quedaron versionadas en `docs/pm/herramientas/`, y `ONBOARDING-PM.md` dice
  cómo usarlas.

**Tres pedidos sobre cómo nos comunicamos (Emi, 03/10):**

1. **Un informe, una entrega.** Ya es regla («Canal PM ↔ Dev» en
   `ONBOARDING-PM.md`). Las propuestas de proceso y lo que hables con Emi van
   en un informe aparte, después de la entrega, o en el mismo archivo pero
   bajo un título que diga «No es parte de la entrega». En `2ef9fbe` venía
   todo junto, y separar qué se revisa de qué se decide costó más que la
   revisión.
2. **Tu revisión con `/code-review` no es independiente:** la corre el mismo
   modelo que escribió el código. Sirve, y seguí corriéndola, pero en el
   informe llamala «autorrevisión». La independiente es la de PM, sus
   subagentes y, al final, el revisor distinto de D9.
3. **Esfuerzo alto en las piezas de dinero, sesión, permisos o datos.** Es
   tu recomendación y Emi la adopta. La próxima es `CONFIABILIDAD-API-1`.
   Para D8, PM contó 16 rutas `async` con consultas a la base (vos, 17), y
   el proceso único sin `--workers` es cierto. La diferencia no cambia la
   tarea: decí cuáles cambiaste.

**Reglas repetidas (pedido de Emi: cada regla en un solo lugar).** Los
límites que no se negocian tienen su única copia en
`ONBOARDING-PM.md`, «Límites que no se negocian». Sacá las copias de tus
archivos y dejá una línea que remita ahí, en un commit aparte del agregado:

- `CLAUDE.md` §3: «No rodear políticas de seguridad del entorno», «No
  publicar secretos, tokens, credenciales ni datos de cobro reales» y «No
  copiar código, texto, marca o diseño distintivo de terceros».
- `AGENTS.md`: «Ponerse al día no autoriza a iniciar una tarea nueva» y «El
  chat no es fuente de verdad».

Ya saqué la copia de `ONBOARDING-DEV.md` y la que estaba arriba de
`ONBOARDING-PM.md`.

**Compactar y cambiar de chat (Emi, 03/10).** En el mismo commit aparte,
reescribí «Eficiencia de chats» de `AGENTS.md`, que es su única copia y vale
para las dos. Tiene que decir:

- **Para qué se cambia de chat:** cuando el chat se hizo tan largo que, aun
  después de compactar, se pierde contexto que la tarea necesita. No por la
  longitud sola.
- **Avisar cuándo compactar.** PM y Dev le avisan a Emi cuando les toca
  compactar. El aviso trae el comando listo para copiar y lo que hay que
  conservar, por ejemplo: `/compact conservar: AVISOS-1, SHA base, negativos
  pendientes y decisiones abiertas`. Se avisa en un corte natural (después de
  una entrega o un veredicto), no en medio de una corrida.
- Antes de compactar o de cambiar de chat, el estado vigente queda guardado en
  el repositorio. Lo que sigue vigente de la sección actual se conserva.

Configuración vigente, que vive en `NOW.md` y no se copia: PM con Opus 5.5 en
esfuerzo alto y Dev con Opus 5.5 en esfuerzo medio. Desde ya, aplicala en tu
sesión.

**Sobre la regla 4 («una pieza nueva arranca con el veredicto de la
anterior»): de acuerdo.** Desde ahora, lo que le sumo a una tarea queda
escrito antes de activarla.

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

## Tarea activa — AVISOS-1

**Rama y base:** `claude/dev-role-repo-3l0kp3`, desde el último commit PM.


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

### Agregado chico, de la revisión de INICIO-CIERRE-CELULAR-1

Va en un commit aparte, dentro de esta entrega:

1. **El 204 espera «Marca» antes de leer el orden del panel.** En mi suite
   cayó dos veces seguidas, en 1440 y en 390: «el panel va […
   "Potencia","Año" …] y el acordado es [… "Potencia","Marca","Año" …]».
   Solo, más tarde, pasó. Es la carrera del 195: «Marca» se dibuja recién
   cuando llegan las cantidades, y el 204 lee rótulos apenas aparece el
   orden de la lista. Fijate si otro caso lee rótulos del panel igual.
2. **El paso 28 de `guia-admin.mjs`** falló una vez en escritorio, después
   de la suite: «Dar de baja y de alta: no se pudo hacer: locator.waitFor:
   Timeout 15000ms exceeded». Es la espera de la lista de «Marcas». La API
   no registró errores, y en las otras tres pasadas pasó. Mirá por qué pudo
   tardar más de 15 s. Si es la misma clase de carrera, corregila. Si no lo
   reproducís, decilo.

Demostrá el 1 como el 195: con el catálogo retrasado, rojo antes y verde
después.

**De tu revisión independiente (D1) y D6:**

3. **El punto 1, el P2 de «Editar».** La opción de la marca dada de baja
   sale de la marca guardada en la publicación, no de la elegida en ese
   momento. Con el rojo del 239 que describiste: elegir «Sin declarar» y
   volver a ofrecer «AgroMec».
4. **Los puntos 3, 4 (sólo el foco), 8 y 9**, como los describiste.
5. **`DELIVERY_CHECKLIST.md` a `docs/pm/archivo/`,** con la cita de
   `docs/pm/REPO_MAP.md` corregida.

---

## Después — CONTROLES-AUTOMATICOS-1 (apenas entregues AVISOS-1)

**Decisión de Emi (03/10), por tu D7: sí, sólo la parte rápida.** Hoy el
repositorio no tiene ningún control automático. Entregala por separado.

### Qué entra

1. **Un flujo de GitHub Actions** que corre en cada push a
   `claude/dev-role-repo-3l0kp3` y a `main`:
   - lint, tipos y build del frontend;
   - `compileall` y `alembic check` del backend, contra una base PostGIS
     del propio flujo;
   - unos casos rápidos, los que elijas. Decí cuáles y por qué esos.
2. **Que entre en el plan gratis.** Decí cuántos minutos tarda cada corrida
   y cuántos daría un mes con el ritmo de pushes de las últimas dos semanas.
3. **Valores inventados.** Ningún secreto en el flujo ni en los registros.
   No usa los secretos del repositorio.
4. **Una línea en `CLAUDE.md`** que diga qué corre y dónde se ve el
   resultado.

### Fuera de alcance

- La suite completa semanal: Emi eligió sólo la parte rápida.
- Desplegar, tocar Railway o bloquear el despliegue: Railway sigue
  publicando `main` como hoy.
- Protección de ramas o pull requests obligatorios.

### Aceptación verificable

1. **Una corrida verde** sobre tu entrega, con el enlace a la corrida.
2. **Una corrida roja a propósito:** un error de tipos o de lint en una rama
   descartable, que el flujo marque en rojo y diga dónde. Después se borra
   la rama.
3. **Ningún secreto** en el flujo ni en sus registros: decí cómo lo
   comprobaste.
4. Lo de siempre: suite local, auditorías y puertas, aunque el producto no
   cambie.

### Frená y consultá

- Si los minutos estimados pasan del plan gratis.
- Si hace falta algún permiso o configuración en GitHub que sólo puede dar
  Emi.

---

## Después — CONFIABILIDAD-API-1 (apenas entregues CONTROLES-AUTOMATICOS-1)

**Decisión PM (03/10), por tu D8.** En producción la API corre en un solo
proceso (`backend/railway-entrypoint.sh`, sin `--workers`). Según tu
informe, 17 rutas `async` hacen consultas bloqueantes a la base: 9 de
`orders.py`, 7 de `products.py`, el webhook y el vínculo de Mercado Pago,
contacto y documentación. Si una se traba, se traba todo el sitio. Fue la
causa del congelamiento de `FILTROS-DE-PUBLICACIONES-1`, que arreglaste sólo
para las marcas. Entregala por separado.

### Qué entra

1. **Que una consulta lenta no frene a las demás.** La forma la elegís vos,
   dentro del mismo proceso y sin más recursos de Railway.
2. **Las 17 rutas,** y cualquier otra que encuentres de la misma clase.
   Decí cuáles cambiaste.
3. **Ningún cambio de conducta:** mismas respuestas, mismos códigos, mismas
   transacciones.

### Aceptación verificable

1. **Caso nuevo:** con una consulta trabada a propósito (por ejemplo, el
   candado de marcas tomado desde otra conexión, o un `pg_sleep`), la salud
   y el catálogo siguen respondiendo en menos de un segundo. Una ruta de
   órdenes y una de publicaciones, al menos.
2. **Negativo:** volver una de las rutas a como estaba da rojo en ese caso.
3. **Órdenes, cobros, webhook, stock y Mercado Pago:** todos sus casos en
   verde. Decí cuáles son.
4. **Suite completa desde base nueva**, las auditorías, las dos guías y las
   puertas.

### Frená y consultá

- Si hace falta más de un proceso, más memoria o cualquier cambio en
  Railway: tiene costo y lo decide Emi.
- Si algún cambio toca cómo se confirma o se revierte una transacción de
  dinero o de stock.

---

## Después — FILTROS-VISUAL-1 (apenas entregues CONFIABILIDAD-API-1)

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
