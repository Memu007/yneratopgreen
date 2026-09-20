# Devolución de la clienta — Revisión 01 — 2026-09-20

Original: `originales/DEVOLUCION-CLIENTA-REVISION-01-2026-09-20.docx` (5,5 MB,
con capturas anotadas). **Este documento lo reemplaza para leer**: está escrito
para que nadie tenga que abrir el `.docx`.

Recibido por Emi. **Nada de esto se ejecuta ahora**: la tarea activa sigue
siendo la que esté en `PARA-DEV.md`. Esto es material para dimensionar y
priorizar, no una orden de trabajo.

Las citas son de la clienta. Lo que va abajo de cada una, en la fila «Hoy», es
estado verificado del repositorio, no interpretación.

---

## Resumen en una pantalla

| # | Observación | Tipo | Tamaño |
|---|---|---|---|
| 1 | Decir «agropecuario» donde se nombre el sector | Copy | chica |
| 2 | Inicio no debería mostrar publicaciones | Producto | media |
| 3 | «Operaciones» es la palabra equivocada | Concepto + copy | media |
| 4 | «Los datos definen la operación»: los tres ítems no se entienden | Copy | chica, pero ver 5 |
| 5 | Inicio no tiene idea rectora — quiere conversarlo | **Decisión** | grande |
| 6 | El bloque que se repite entre pestañas no hace falta | Producto | chica |
| 7 | Servicios no va como pestaña aparte (lo dice tres veces) | **Decisión** | grande |
| 8 | Localidades repetidas | Datos | chica, medida |
| 9 | Campos por rubro que alimenten el filtro (marca, modelo, año…) | **Alcance nuevo** | la más grande |
| 10 | AgroMarket es un módulo dentro de un ecosistema | **Decisión** | media |
| 11 | FAQ: sacarla o rehacerla; y dos afirmaciones que no van | **Choca con reglas vigentes** | ver abajo |
| 12 | Misión y visión, en función del ecosistema | Copy + decisión | media |
| 13 | Sacar «Nuestro equipo» por ahora | Producto | chica |
| 14 | «Listo para transformar tu producción» promete de más | Copy | chica |
| 15 | **No pudo registrarse: nunca llegó el correo** | **Operativo, bloqueante** | ver abajo |

---

## Lo que no es materia de diseño y conviene mirar antes

### 15. La clienta no pudo entrar

> «Aquí intenté registrarme y no lo pude hacer. Hice varios intentos, pero
> nunca llegó el link para registrarme, aunque revisé todo como sugiere el
> texto. Al no poder ingresar con ningún status no pude ver el proceso de
> registro, publicación, compra, administración, pago, etc.»

Esto no es una opinión sobre el producto: es la razón por la que **más de la
mitad del producto quedó sin revisar**. Toda la devolución que sigue es sobre
las pantallas públicas, porque no pudo pasar de ahí.

**Hoy**: el correo de verificación es real y la suite lo lee del outbox local
en cada corrida. En un entorno desplegado depende de SMTP configurado, y eso
está en la lista de pendientes de operación desde el despliegue del 13/09
—`NOW.md` lo nombra junto con secretos, pagos y recuperación—. Dev no toca
Railway ni credenciales: esto es PM/operación.

**Propuesta**: verificar el envío en el entorno que usó la clienta antes de
pedirle una segunda revisión. Cualquier devolución sobre registro, publicación,
compra, administración y pago va a llegar recién después.

### 11b. Dos afirmaciones de la FAQ que chocan con reglas vigentes del proyecto

> «…justamente garantizaríamos la transferencia al convertirnos en **agentes de
> retención**, esto lo tengo que hablar con Laura, pero después de cierto
> importe no se libera hasta la doble conformidad o seguro de reembolso…»

**Choca de frente** con una restricción que el proyecto viene sosteniendo desde
el principio: *la plataforma no recibe, no retiene y no administra fondos de
terceros*. Retener un pago hasta la doble conformidad es exactamente eso. No es
una función que se agrega: cambia qué es legalmente la plataforma, y la propia
clienta dice que lo tiene que hablar con Laura. **Queda como decisión, no como
tarea.** Mientras no se decida, el producto sigue como está.

> «Con respecto a que AgroBoeda no cobra comisión no lo diría así. Si cobra,
> pero hay que ver de qué manera se explica…»

**Hoy** el producto no cobra comisión y no lo simula: no manda `marketplace_fee`
a Mercado Pago —ni un porcentaje ni un cero—, y así está escrito en las
plantillas de entorno. Si va a cobrar, hay que decidir **qué** cobra
—suscripción, publicación destacada, comisión por venta— porque cada una es una
pieza distinta. La suscripción es la única que hoy está contemplada como
excepción a la regla de fondos.

---

## Lo conceptual: tres decisiones que no son de Dev

### 5. Inicio no tiene una idea rectora

> «Donde dice *Los datos definen la operación* no queda muy claro los 3 ítems
> siguientes (porque parecen un instructivo…)». «Como no sé cuál es la idea
> rectora de la pestaña INICIO me cuesta pasar texto específico porque
> implicaría reformular toda la pestaña entera. Si te parece eso lo charlamos.»

Los tres reparos puntuales:

1. «precio o modalidad no deberían ser excluyentes», y la «indicación **honesta**
   de cotización» le suena mal: *la honestidad debería ser axioma*, no una
   característica que se anuncia.
2. Razonable, pero **falta el radio de alcance** — dice que no lo encontró.
   **Hoy**: el radio existe y funciona, pero es del **transportista** y vive en
   su perfil y en la elección de flete, no en Inicio. Puede ser un problema de
   dónde está contado, no de que falte.
3. «responsable y próximo paso» no se entiende si es explicación o instructivo.

Corregir las tres frases sueltas es media hora. **Pero ella pide otra cosa**:
decidir para qué es Inicio. Eso es una conversación, y hasta que pase, tocar el
texto es trabajo que se va a tirar.

### 7. Servicios como pestaña aparte

Lo dice **tres veces**, y una cuarta de costado:

> «Esto lo hablamos la última vez, la pestaña de servicios (como pestaña aparte)
> no tiene mayor sentido.»
> «En mercado el filtro de servicios no cambia la pestaña servicios. Y creo que
> no hace falta pestaña separada.»
> «Creo que no tiene sentido poner separadas las pestañas de mercado y
> servicios, siendo partes del mismo módulo.»

**Hoy**: son dos secciones distintas con rutas propias, y el filtro «servicios»
del Mercado y la pestaña Servicios son cosas separadas —que es justo lo que
ella nota—. Unificar no es borrar una pestaña: es decidir qué pasa con la
navegación, la URL, el filtro por tipo y las publicaciones de logística, que ya
son una anatomía aparte.

### 10. AgroMarket es un módulo, no el producto entero

> «Hay que tener presente que esto “AgroMarket” es un módulo dentro del
> ecosistema y debería leerse o identificarse como módulo o nodo dentro de otro
> contexto que es más amplio.»

Toca la marca, la portada, Quiénes somos, misión y visión (#12) y el propio
nombre. Es la decisión que más condiciona el copy de todo lo demás, así que
conviene resolverla **antes** de reescribir textos.

---

## 9. La pieza grande: campos por rubro que alimenten el filtro

> «En el listado de marcas debería haber una vinculación entre las publicaciones
> y el ingreso de ese dato (marca)… cuando el usuario que publica un producto
> ingresa para cargar las características distintivas, debería encontrar campos
> a completar con las referencias que le dan identidad a su producto, y esa
> información sería los datos a indexar, ejemplo: vendo, maquinaria, tractor,
> rango de potencia, marca, modelo, año (campos interactivos vinculantes a los
> filtros… cuantos más datos aporta el vendedor mayor probabilidad de aparecer
> al filtrar)». Y avisa: **«le voy a pasar a Marian los datos para el filtrado
> de productos y servicios»**.

**Hoy**: no existe ningún atributo por rubro. Ni marca, ni modelo, ni año, ni
potencia, ni condición, ni origen. Se filtra por categoría, subcategoría, tipo,
provincia, localidad, precio, stock y calificación — el detalle completo está en
`ESTADO-DATOS-Y-FILTROS-2026-09-20.md`.

Condición y origen ya figuraban como **alcance nuevo** en `TAXONOMIA-CLIENTE.md`
desde julio, con las 48 marcas que ella misma mandó entonces.

Lo que hay que resolver antes de estimar: si los campos son **por categoría**
—un tractor tiene potencia, una semilla no— cada rubro necesita su propio
conjunto. Eso es modelo, migración, alta, edición, API, barra lateral y suite.
**Conviene esperar los datos que le va a pasar a Marian antes de diseñarlo**:
hacerlo dos veces cuesta más que esperar.

---

## Lo chico y acotado

| # | Qué pide | Hoy | Nota |
|---|---|---|---|
| 1 | Que diga «agropecuario» donde se nombre el sector | El copy dice «agro» y «mercado agro» | Reemplazo de texto; entra en cualquier pieza de copy |
| 2 | Inicio sin publicaciones | Inicio muestra operaciones reales de la API | Depende de #5: qué es Inicio |
| 3 | «Operaciones» → «publicaciones» / «oferta» | «Operación» es el término interno **y** el visible | Ojo: se usa también en código y en la suite. Cambiar lo visible no obliga a renombrar lo interno |
| 6 | El bloque repetido entre pestañas no hace falta | Se repite en algunas, no en todas | Acotado, pero conviene junto con #5 y #7 |
| 8 | Localidades repetidas | 154 pares medidos: 105 sobran de verdad, 49 son homónimas legítimas | **Medido y con arreglo barato**: ver el otro documento |
| 13 | Sacar «Nuestro equipo» | Está publicado | Sacar una sección es pequeño; ella dice que lo va a pensar |
| 14 | «Listo para transformar tu producción» promete de más | Está en la portada | Reemplazo de texto, atado a #10 |
| 11a | FAQ: esperar a ver las preguntas reales | Hay FAQ fija | «La primera pregunta los tratamos de giles» |
| 12 | Misión y visión | Publicadas | Atado a #10 |

Sobre logística, que aparece dentro de #11:

> «El tema de la logística no está dentro de lo indexado, hay que verlo mejor
> porque es un rubro en sí mismo, diferente de producto tangible; es un servicio
> o producto intangible y no está claramente desarrollado.»

**Hoy**: logística **sí** es una anatomía propia del producto, con su
publicación, su transportista, su radio y su elección dentro de la compra. Lo
que no tiene es lugar en la taxonomía de filtros, que es un problema distinto —y
es otra vez #9.

---

## Lo que Dev propone, y no ejecuta

1. **Primero lo que no es opinión**: que la clienta pueda registrarse (#15).
   Sin eso, la próxima revisión va a repetir esta.
2. **Después las tres decisiones** —#5 Inicio, #7 Servicios, #10 módulo—, que
   son una sola conversación y condicionan todo el copy.
3. **En paralelo, lo barato y sin discusión**: #8 localidades, #1 «agropecuario»,
   #13 «Nuestro equipo». Son piezas chicas y no dependen de las decisiones.
4. **#9 recién cuando lleguen los datos** que la clienta le va a pasar a Marian.
5. **#11b no se toca hasta que haya decisión**: retener fondos y cobrar comisión
   cambian qué es la plataforma.
