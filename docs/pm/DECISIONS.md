# Decisiones

Registro breve. Una entrada por decisión relevante, más reciente arriba.
Formato: fecha, decisión, motivo.

---






## 2026-10-03 — La API no se puede congelar entera, antes de lo visual

La Dev midió (D8 de `2ef9fbe`) que en producción la API corre en un solo proceso y que 17 rutas
`async` consultan la base de forma bloqueante: si una se traba, se traba todo el sitio. PM lo
pone como `CONFIABILIDAD-API-1`, después de `AVISOS-1` y antes de `FILTROS-VISUAL-1`, sin más
recursos de Railway. Motivo: Emi pidió «menos errores» y «un producto full confiable» (03/10), y
un congelamiento rompe todo lo demás. PM no adopta `/como-venimos` ni `/revisar-entrega`.

## 2026-10-02 — Tarjetas, publicación, ingreso, carrito y Mi cuenta: aprobadas

Emi aprobó («Dale») `maquetas/MERCADO-FICHA-V1-2026-10-02.html` y
`maquetas/CUENTA-V1-2026-10-02.html`. Son dos tareas de cómo se ve, sin funciones nuevas:
`MERCADO-FICHA-VISUAL-1` (tarjetas y página de la publicación) y `CUENTA-VISUAL-1` (ingresar,
carrito como panel lateral y Mi cuenta con menú). Van después de `BUSCADOR-SINONIMOS-1` y antes
de `OBSERVABILIDAD-1`. Sólo muestran datos que ya existen.

Motivo: son las partes que más se ven y las más genéricas. Si la cola se atrasa para el
congelamiento del ~27/10, `CUENTA-VISUAL-1` es la primera que pasa a después del lanzamiento.

## 2026-10-02 — Avisos: la píldora verde de la marca

Emi rechazó la v1 de los avisos por genérica y eligió la opción A de
`maquetas/AVISOS-V2-2026-10-02.html`: una píldora verde de la marca, abajo al centro, que se
apila con profundidad, trae una acción cuando sirve y entra con un rebote corto. Es
`AVISOS-1`, después de `INICIO-CIERRE-CELULAR-1`. Emi pidió el mismo trabajo para los filtros:
la maqueta es `maquetas/FILTROS-V1-2026-10-02.html` y espera su aprobación.

## 2026-10-02 — En el celular, «¿Te interesa alguno?» cierra Inicio

Emi vio en su celular que el bloque «¿Te interesa alguno?» corta la lectura entre los servicios
y «Cómo funciona», con el crédito de las fotos suelto debajo. Eligió la opción A: en el celular
pasa al final de Inicio, y en la computadora sigue como octava tarjeta. Es
`INICIO-CIERRE-CELULAR-1`, después de `MARCAS-PANEL-1`.

## 2026-10-02 — Las marcas se corrigen, se unen y se dan de baja desde el panel

Con «Otra marca» (`FILTROS-DE-PUBLICACIONES-1`), una marca mal escrita queda en el alta y en el
filtro para siempre. Emi eligió sumar al panel corregir, unir y dar de baja marcas, como
`MARCAS-PANEL-1`, antes de `VENDER-SIN-SESION-1` y del lanzamiento.

Motivo: lo que escribe cualquiera llega a la lista de todos, y la administración necesita una
forma de ordenarlo.

## 2026-10-02 — Monitoreo gratis y orden de las pruebas finales

- **Monitoreo:** Emi crea UptimeRobot (sin código). La Dev suma Sentry y Microsoft Clarity,
  gratis y sin datos personales, como `OBSERVABILIDAD-1`, al final de la cola y antes del
  lanzamiento.
- **Pruebas finales:** se corrige `PLAN-RED-TEAM-CIERRE-MVP.md`. Todo lo ofensivo y la carga
  van sólo en Docker local. `strong-playfulness` es el sitio publicado, no uno descartable. El
  orden es carga, navegadores reales, usabilidad, QA exploratorio de un modelo independiente y
  después el red-team.

Motivo: hoy no se ven los errores de quienes usan el sitio, y Emi pidió que una IA
independiente lo pruebe a fondo antes de lanzar.

## 2026-10-02 — Producción animal y buscador con sinónimos; la clasificación automática, fuera del MVP

Sobre el documento de la clienta `originales/INDEXACION-CLIENTA-2026-10-02.docx`, Emi eligió:

- **Ahora, sin reunión:**
  - `PRODUCCION-ANIMAL-1`: «Bienes y Ganado» pasa a «Producción animal», con especies y raza;
  - `BUSCADOR-SINONIMOS-1`: el buscador ignora acentos, mayúsculas y plurales, busca en la
    categoría y usa sinónimos.

  Van después de `FILTROS-DE-PUBLICACIONES-1` y `VENDER-SIN-SESION-1`.
- **Fuera del MVP**, para una etapa posterior que se cotiza aparte:
  - publicar sin categoría;
  - clasificación automática e interpretación de frases con inteligencia artificial;
  - publicaciones de «Compra» y «Disponibilidad».
- **A la reunión:** la familia «Producción» (vegetal, forestal, acuícola).

Motivo: el contrato pide filtros por categoría y ubicación, y la clasificación automática
necesita un servicio pago y control humano. Lo que se hace ahora le da a la clienta buena parte
de lo que busca, sin eso.

## 2026-10-01 — Los filtros salen de las publicaciones, y se puede escribir otra marca

**Revierte la del 25/09** («el filtro de marca muestra siempre la lista completa»). La
clienta, al ver Tractores, pidió que los filtros ofrezcan sólo lo publicado, y que una marca
nueva aparezca sola. Emi eligió hacerlo sin esperar la reunión. Pasa a la Dev como
`FILTROS-DE-PUBLICACIONES-1`:

- cada filtro ofrece sólo opciones con publicaciones en la búsqueda del momento;
- al publicar se puede escribir «Otra marca». Si coincide con una que ya existe, sin
  importar mayúsculas, acentos ni espacios, se usa esa;
- «Tecnologizar» pasa a «Tecnificar».

Unir o corregir marcas desde el panel es otra pieza. Las categorías esperan la reunión.

Motivo: la clienta quiere un buscador que sea un resumen de lo que se publicó. Un filtro
lleno de opciones vacías no ayuda a encontrar.

## 2026-10-01 — Inicio cuenta el concepto: «Por qué AgroBoeda» (maqueta v3)

La clienta le pidió a Emi que Inicio haga entender mejor el concepto, y le pasó su documento
«Propuesta de MVP Marketplace» (2025). La idea central del documento es que gran parte de la
maquinaria no genera datos, que un kit de conectividad la actualiza sin cambiarla, y que esos
datos dan labores verificables, trazabilidad e historial técnico. Emi eligió la opción A:
sumar debajo de la portada una sección «Por qué AgroBoeda», que cuente eso en tres pasos y
con un diagrama propio, sin rehacer el resto de Inicio.

- **Las imágenes del documento no se usan.** Son de 470 px de ancho y de origen desconocido.
  El diagrama de la página 10 se le pregunta a la clienta. La maqueta usa uno propio, en
  SVG.
- **No se muestra** lo del documento que choca con reglas del proyecto: criptomonedas,
  contratos inteligentes y financiamiento.
- **La maqueta** es `maquetas/INICIO-CONCEPTO-V3-2026-10-01.html`, con capturas en 1440. Sólo
  escritorio: la versión de celular viene cuando la clienta la apruebe. Incluye la portada
  más baja de `HERO-COMPACTO-1`.
- **`HERO-COMPACTO-1` queda en espera.** Cuando la clienta apruebe, se programa junto con la
  sección nueva, en una sola pieza.

Motivo: la clienta quiere que se entienda el problema que AgroBoeda resuelve, y el Inicio
publicado habla de la ruta productiva sin nombrarlo.

## 2026-10-01 — La portada de Inicio se achica

Emi miró el Inicio publicado (`30f9791`) en su notebook: la portada ocupa toda la pantalla, el
título va en cuatro renglones y los servicios del ecosistema no se ven sin bajar. Eligió la
opción A: el título en tres renglones o menos, y la portada más baja, para que en 1440×900 y
1366×768 se vea el comienzo de los servicios. Los textos y la foto no cambian. Pasa a la Dev
como `HERO-COMPACTO-1`, antes de `VENDER-SIN-SESION-1`.

Motivo: la versión 2 pone el ecosistema primero, y con la portada a pantalla completa quedaba
escondido.

## 2026-10-01 — Una sola regla de contraseña, y el cambio cierra las sesiones viejas

PM, sobre el freno de `CAMBIAR-CONTRASENA-1` (`3f9f2e5`).

- **Una regla en la API** (6 caracteres a 72 bytes) para el registro, el cambio, el alta y el
  restablecer del panel. Más de 72 bytes se rechaza con un mensaje claro y en el ingreso es
  «incorrecta»; nada se trunca ni cambia cómo se guarda.
- **`SESIONES-AL-CAMBIAR-1`:** cambiar o restablecer una contraseña invalida las sesiones
  anteriores de esa cuenta. Va antes de `VENDER-SIN-SESION-1`.

Motivo: hoy las reglas difieren en cuatro lugares y más de 72 bytes da 500. Y una sesión
renovada no vence nunca, así que cambiar las dos contraseñas que quedaron en chats no saca a
quien ya hubiera entrado.

## 2026-10-01 — «Vender» se ve siempre, también sin sesión

Al aceptar `INICIO-ECOSISTEMA-1` quedó un hueco: sin sesión no hay ningún botón para publicar.
«Publicar una oferta» salió de Inicio con la maqueta v2, y el otro botón estaba en «Quiénes
somos», que salió del sitio. Emi eligió la opción B: «Vender» se ve siempre en la cabecera, y
sin sesión pide ingresar y después abre el formulario. Pasa a la Dev como
`VENDER-SIN-SESION-1`, después de `CAMBIAR-CONTRASENA-1`.

Motivo: quien quiere vender tiene que ver por dónde empezar sin tener cuenta todavía.

## 2026-09-30 — Inicio v2 se programa sin esperar las respuestas de la clienta

Emi aprobó la maqueta de Inicio versión 2 y pidió programarla sin esperar las cuatro respuestas
de la clienta. La maqueta pone el ecosistema primero, con una tarjeta con foto por servicio, y
el Mercado como una más. Pasa a la Dev como `INICIO-ECOSISTEMA-1`, después de
`LINK-ABIERTO-DEVUELTO-1`.

Mientras la clienta no diga otra cosa, valen:

- los servicios y el orden de la maqueta;
- el nombre «Mercado»;
- las fotos del sitio, con crédito para las dos CC BY;
- el texto del documento, versión 2.

Si la clienta pide cambios, son una pieza chica aparte.

Motivo: Emi quiere mostrarle el Inicio nuevo funcionando. Las preguntas cambian textos o fotos,
no la estructura.

## 2026-09-30 — Inicio muestra el ecosistema, con lo que viene como «Próximamente»

Después de la presentación, la clienta pidió que Inicio muestre el ecosistema y no sólo el
mercado, y que se saque «Quiénes somos». Emi eligió la propuesta de PM:

- arriba, la idea del proyecto, con el texto del prototipo de la clienta;
- después, lo que funciona hoy (el Mercado) y, como «Próximamente» y sin botones, los
  servicios que vienen después del MVP: ruta productiva, trazabilidad, cumplimiento y
  certificaciones, tecnología, noticias del agro, y charlas y capacitaciones.

Motivo: se entiende hacia dónde va el proyecto sin prometer lo que todavía no existe. La
clienta ya había marcado que el sitio «promete de más» (#14). Retoma la decisión #10, que el
27/09 había quedado para más adelante. Mostrar esos servicios es chico; construirlos es otro
proyecto, fuera del MVP.

## 2026-09-30 — Mercado Pago se prueba en el sitio publicado

Emi eligió probar Mercado Pago en el sitio publicado, con cuentas de prueba, y
no en un Railway aparte como decía `docs/homologacion-mercadopago.md`. Los pasos
están en `PASOS-MERCADO-PAGO-2026-09-30.md`.

Motivo: todavía no hay usuarios reales, cuesta menos y es más rápido. Mercado
Pago sólo aparece en las publicaciones del vendedor de prueba, y sólo mientras
dura la prueba.

Lo que se acepta con eso:

- mientras estén cargadas las variables de Mercado Pago, cualquier vendedor ve
  «Vincular Mercado Pago»;
- las órdenes de prueba quedan en la base publicada.

PM agrega, antes de probar, la pieza chica del link abierto de un pago devuelto
(`LINK-ABIERTO-DEVUELTO-1`), para que la prueba corra sobre el código final.

## 2026-09-29 — Desvincular: aviso por las devoluciones y carrera achicada

La Dev frenó `DESVINCULAR-CON-COBROS-1` con dos hallazgos, que PM verificó en
el código:

- **Una devolución o un contracargo que llega con la cuenta desvinculada no se
  registra.** El aviso de Mercado Pago da 503 porque no hay a quién
  preguntarle, y quien compra sigue viendo «pagado». Con la cuenta vinculada
  sí se registran.
- **Una compra que se confirma justo mientras el vendedor desvincula puede
  quedar trabada**: el checkout confirma la orden antes de leer el token.

PM decidió:

- **La regla queda como estaba:** sólo frenan los cobros en curso. Frenar por
  ventas ya cobradas trabaría a quien vendió hace poco durante todo el plazo de
  devoluciones, por un estado que la plataforma sólo muestra.
- **La confirmación de desvincular avisa** que una devolución o un contracargo
  posterior no se va a ver en AgroBoeda.
- **La carrera se achica sin tocar el checkout** y queda como riesgo dicho: la
  ventana es de milisegundos, Mercado Pago no está habilitado, y la orden se
  destraba volviendo a vincular la misma cuenta.

Motivo: cerrar lo que traba órdenes y stock sin agregarle a quien vende una
traba larga ni tocar el checkout, que es lo más delicado del cobro.

## 2026-09-29 — No se desvincula Mercado Pago con cobros en curso

Emi eligió asignar `DESVINCULAR-CON-COBROS-1` antes que el cambio de
contraseña desde la pantalla. La regla: mientras un vendedor tenga cobros de
Mercado Pago en curso, no puede desvincular su cuenta ni pasar a otra. Renovar
y reconectar la misma cuenta siguen permitidos.

Motivo: sin el token del vendedor nadie puede preguntarle a Mercado Pago por
esas compras, y la orden y la mercadería quedan trabadas hasta que vuelva a
vincular. La plata no corre riesgo, pero ni quien vende ni quien compra saben
por qué. Es condición para encender el cobro.

## 2026-09-29 — El reconciliador se crea con Mercado Pago y corta solo a los 9 minutos

Al revisar `RECONCILIADOR-PROGRAMADO-1`, PM decidió:

- **El servicio se crea el día que se habilita Mercado Pago**, con el Backend
  ya con su `MP_TOKEN_KEY` y antes de encender el cobro. Nadie confirmó que
  el Backend tenga hoy esa clave. `RAILWAY.md` no la pone entre sus
  variables, y vale vacía por omisión. Sin ella, cada corrida saldría con
  error, y sin Mercado Pago no hay nada que reconciliar.
- **El comando lleva un tope de 540 segundos** (`timeout 540`), como propuso
  la Dev. Railway no corta una corrida colgada y saltea las siguientes
  mientras siga activa; así el reconciliador dejaría de correr sin avisar. Con
  el tope, la corrida se corta antes de la siguiente y queda como fallida a la
  vista.

Motivo: que los pasos de Emi funcionen la primera vez, y que una falla se vea
en vez de pasar callada.

## 2026-09-29 — El reconciliador se programa desde el panel de Railway

Railway dejó en desuso la configuración en el repositorio (`railway.toml`).
Los servicios nuevos no pueden usarla, y los que ya la usan la pierden el
01/12/2026. Lo dicen los resúmenes del buscador sobre `docs.railway.com`; ni
PM ni la Dev llegan a la página. La Dev frenó `RECONCILIADOR-PROGRAMADO-1` por
eso, y se decidió:

- **El servicio se programa desde el panel, cada 10 minutos** (PM). Es lo que
  Railway recomienda para el horario. El repositorio guarda los pasos en
  `RAILWAY.md`, la comprobación local y los casos.
- **Las variables van como referencia al Backend, no como copia** (PM). Con
  otra `MP_TOKEN_KEY`, el reconciliador marcaría a los vendedores para
  reconectar su cuenta de Mercado Pago; por eso la comprueba al arrancar.
- **Emi aprobó el costo de un servicio más** («Ok el costo»). Corre unos
  segundos cada 10 minutos. PM lo estima en centavos por mes, sin medirlo.
- **El corte del 01/12 del Backend y el Frontend va en una pieza propia**,
  antes de esa fecha.

Motivo: sin barridos, las reservas que nadie paga no vencen y un link que no se
pudo apagar queda abierto. Es la última condición para habilitar Mercado Pago.

## 2026-09-28 — PM y Dev siguen con Opus

Salió Claude Sonnet 5.5. Para programar queda cerca de Opus 5.5, pero no por
encima, y cuesta la mitad por token nuevo; releer lo que está en caché cuesta
lo mismo en los dos. Emi decidió seguir con Opus en las dos sesiones, por las
dudas: la pieza en curso es de pagos, y lo caro en este proyecto son los
errores que se escapan. Si se vuelve a evaluar, la propuesta de PM es probar
Sonnet sólo en la Dev, en una pieza que no sea de plata, y medir cuánto trabajo
devuelve la revisión.

## 2026-09-28 — Las publicaciones de prueba las carga la Dev

Emi decidió que las cargue la Dev (`PUBLICACIONES-PRUEBA-1`), antes de la pieza
del pago a una orden cerrada. Cambia la decisión del 27/09 en quién las carga,
no en cómo quedan: «(prueba)» en el título, «No está a la venta» en la
descripción, sin fotos, y se pausan al terminar.

- **La cuenta la crea Emi** desde el panel, y la contraseña va por el chat de
  la Dev. Nunca al repositorio, a un informe, a un script o a un log.
- **La Dev usa el sitio como quien vende:** la pantalla o la API pública con
  esa cuenta. Sin base, sin Railway, sin cuenta de administración, sin
  siembra y sin código.
- **Si su red no llega a `railway.app`, frena**, y la carga vuelve a Emi.
- **Ningún programa que escriba en producción se sube al repositorio.**

## 2026-09-27 — Publicaciones de prueba en el sitio publicado, cargadas a mano

Emi eligió cargarlas a mano desde el sitio, sin fotos, con cuentas creadas
desde el panel. Cada una dice «(prueba)» en el título y «No está a la venta»
en la descripción, y se pausan al terminar. No se agrega código ni programa, y
nada se carga por Railway: la siembra sigue sin correr en producción. La lista
está en `PUBLICACIONES-DE-PRUEBA-2026-09-27.md`.

Motivo: el sitio publicado sólo tiene lo que alguien cargó a mano. Sin
publicaciones no se ven los filtros ni se puede probar la logística.

## 2026-09-27 — Lo que quedaba de la devolución de la clienta

Emi respondió los puntos que esperaban una charla:

- **#5, para qué es Inicio:** lo habla Emi con la clienta. Hasta entonces,
  Inicio queda como se publicó el 27/09.
- **#10, AgroMarket como módulo de algo más grande:** no se trabaja por ahora.
  Es la visión a futuro de la clienta.
- **#12, misión y visión:** la clienta va a mandar el texto. Hasta entonces no
  se toca.
- **#11b, retener la plata hasta la doble conformidad:** no se hace, y ya se le
  explicó a la clienta. Sigue la regla de que la plataforma no recibe, no
  retiene y no administra fondos de terceros. Cómo se explica que AgroBoeda
  cobra queda sin decidir; hoy el sitio no lo menciona.
- **Logística en los filtros:** Emi quiere mejorarla. La pieza está por
  definir.

Motivo: cerrar lo que no es trabajo de Dev, para no arrastrarlo como
pendiente.

## 2026-09-27 — «Operaciones» pasa a «publicaciones» en lo visible

Devolución #3 de la clienta (20/09), repetida el 27/09: lo que se ofrece son
publicaciones, y la operación es lo que se concreta. Cambia el texto visible y
el que se lee en voz alta, no los nombres internos. «Operación» queda sólo
donde es una operación concretada. El punto quedó sin asignar entre el 20/09 y
el 27/09 por un descuido de PM.

## 2026-09-26 — El orden del panel de filtros lo deciden PM y Dev

Emi, en el sitio publicado, sintió el panel de filtros desordenado. Delegó la
decisión de experiencia en PM y Dev, con revisión adversarial («que sea
adversarial y lo que decidan»).

PM propuso tres bloques y un plegado para lo poco usado: qué buscás, dónde,
precio y «Más filtros». La Dev la ataca antes de construir, dentro de la parte
2 de los atributos. Lo que quede en pie se construye sin volver a Emi. Los
hechos técnicos se resuelven con evidencia.

## 2026-09-26 — Las categorías no se cargan por migración; las marcas y las localidades sí

Decisión PM sobre la discrepancia de la Dev en `PROD-LISTS-1`.

- **Marcas y localidades:** se cargan con una migración idempotente, que
  inserta sólo lo que falta y no toca lo editado en el panel.
- **Categorías y subrubros:** no se cargan así. Producción ya los tiene, y el
  panel cambia su nombre corto al renombrar: insertar «los que faltan»
  duplicaría uno renombrado. Una base de producción nueva los carga de forma
  explícita (`RAILWAY.md`).

Desde ahora, toda lista o catálogo nuevo dice cómo llega a producción y lo
prueba con un caso sobre una base sin siembra.

## 2026-09-25 — El filtro de marca muestra siempre la lista completa

Decisión de Emi. Con Maquinaria agrícola elegida, el filtro «Marca» del
Mercado aparece siempre, con las 44 marcas y cuántas publicaciones tiene cada
una, aunque sea cero.

Antes aparecía sólo cuando el conjunto que se miraba tenía publicaciones con
marca. Motivo: la lista completa es más fácil de revisar y se ve igual desde
el primer día, aunque haya pocas publicaciones. Se acepta que elegir una
marca sin publicaciones dé cero resultados.

## 2026-09-25 — Cómo se cargan las listas de tipo de la clienta

Decisión PM a partir de la consulta de Dev (`68e5223`). De los 43 subrubros:

- 29 tienen una lista clara y se cargan tal cual;
- Tractores va por potencia;
- 4 listas mezclan dos características y quedan con una sola dimensión
  (Siembra, Fertilizantes, Compra-venta y Alquiler por campaña), porque cada
  publicación elige un solo tipo;
- las 4 «Mejoras» de Tierras y las 5 listas de una sola opción quedan sin
  tipo.

Lo que sale del filtro sigue encontrándose con el buscador de texto. Se
agregan «bebederos» y «sustratos», que nombran los propios subrubros.

El tipo es de elección única a propósito: con elección múltiple, quien vende
marcaría todo para aparecer en todos los filtros. Las mejoras de un campo,
que sí son varias a la vez, quedan para una pieza propia.

## 2026-09-25 — Los atributos por rubro se absorben; «Inversores» afuera; el origen, declarado

Decisiones de Emi sobre la devolución de la clienta #9 y la taxonomía del
25/07, que ella volvió a mandar el 25/09 sin cambios: 7 rubros, 43
subrubros, unos 200 ítems de tercer nivel, 48 marcas y 5 servicios.

1. **Se absorbe, sin cotizar aparte**, y se limita a su listado:
   - el tercer nivel como atributo filtrable en todos los rubros;
   - la potencia de los tractores;
   - modelo y año en maquinaria.

   Motivo: la taxonomía llegó antes de la firma, así que la clienta puede
   leer el tercer nivel como parte de la «búsqueda por categoría»
   contratada. Lo nuevo, modelo y año, es chico. El cronograma tiene margen.
2. **«Inversores» no se carga.** Es una idea a futuro, mezclada con el
   manifiesto del proyecto.
3. **El origen (agencia o dueño directo) entra como dato declarado por quien
   vende.** Se muestra siempre rotulado «declarado por quien vende» y nunca
   con el aspecto del distintivo de documentación revisada. Reemplaza el
   punto 3 de las decisiones del 15/09 en `PROPUESTA-BUSQUEDA-FACETADA.md`.

Orden: primero `MERCADO-UNICO-1`, después los atributos por rubro y después
las guías de uso, para que sus capturas muestren el alta y los filtros
finales.

## 2026-09-25 — Un solo Mercado: Servicios deja de ser una pestaña aparte

Decisión de Emi sobre la devolución de la clienta #7, que ella pidió tres
veces. Los servicios se encuentran en el Mercado con el filtro por tipo. Los
enlaces viejos llevan al Mercado filtrado. Las advertencias de
responsabilidad siguen visibles donde se ven los servicios. Inicio (#5) no se
rediseña en esta pieza. Se hace antes de las guías de uso, para que sus
capturas muestren el sitio final.

## 2026-09-25 — La bajada de la portada queda en dos renglones en celulares angostos

Con «Mercado agropecuario · Argentina», la bajada pasa a dos renglones a 320 y
360 px, sin desbordes. Emi decidió que quede como lo pidió la clienta, con la
palabra «agropecuario» y sin redacción alternativa.

## 2026-09-25 — Publicar en el entorno demostrativo sin backup previo

Decisión de Emi. Railway es hoy un entorno de demostración, sin clientes ni
datos reales. Si la migración `b6d3f12a8e94` fallara, la base se recrea con
migraciones y siembra. La migración sólo deja una imagen principal por
publicación y no borra imágenes, y Railway la corre antes de desplegar: si
falla, sigue sirviendo la versión anterior.

El backup administrado sigue siendo condición del lanzamiento real (Fase 5).
Esta decisión reemplaza, sólo para el entorno demostrativo, la puerta de
recuperación de `PROPUESTA-RECUPERACION-PRE-MIGRACION-2026-09-23.md`.

## 2026-09-23 — El detalle de una publicación será una página con URL propia

Emi pidió que al abrir una publicación se vea una página, en lugar del modal
actual. Se trata como reemplazo de la presentación del detalle ya incluido en
el catálogo, dentro de los ajustes de usabilidad del MVP; no agrega funciones
de compraventa. La página debe abrir en la misma pestaña, tener enlace directo
recargable y usar el historial normal del navegador. No se copia diseño de
otro marketplace ni se abre alcance de SEO, recomendaciones o atributos nuevos.

La pieza `PRODUCT-DETAIL-PAGE-1` quedó **aceptada en rama** en `087fa2c`
después de la revisión PM; no está integrada ni desplegada. Abrir o recargar
la ficha consulta el detalle y suma una vista en `views_count`, tal como hace
la API existente. Se acepta que esa métrica cuente aperturas y recargas.

Motivo: el detalle vigente es un `ProductDetailModal` ligado al estado de la
tarjeta y al historial sin URL distinta. Una página permite compartir y
recargar una publicación y presenta el producto como destino del catálogo.

---

## 2026-09-21 — Dev no tiene Docker; PM conserva esa puerta y Dev puede delegar

El entorno de Dev **no tiene acceso a Docker**. Dev informó el 23/09 que sí
dispone de PostgreSQL con PostGIS 3.4.2 nativo y pudo correr pruebas que
dependen de esa extensión. Se corrige la premisa factual anterior: PM no
asume ausencia de PostGIS ni asigna una repetición innecesaria. La puerta
que exige Docker, incluido el caso 131, queda en PM. Dev escribe el código
y el arnés, corre las compuertas que su entorno permite y declara lo no
ejecutado. PM conserva la revisión independiente antes de aceptar.

Dev **puede usar subagentes** para subtareas acotadas de implementación,
inspección o pruebas. Sigue siendo responsable de revisar e integrar su trabajo,
respetar una sola tarea activa y entregar un único SHA/informe coherente. Una
corrida o revisión de un subagente de Dev no sustituye la independencia de PM,
no amplía alcance y no autoriza integración ni despliegue.

Motivo: no convertir una limitación conocida del entorno en bloqueos repetidos
ni en afirmaciones de pruebas que no se corrieron, sin perder la separación
entre construcción y aceptación.

## 2026-09-21 — El push directo de POST-INTEGRATION-CLEAR-1 no se revierte ni crea precedente

Dev tomó la tarea vieja que seguía visible en `main`, implementó
`POST-INTEGRATION-CLEAR-1` en `cb3a4a7` y empujó el informe `615619c` a esa rama.
Eso contradijo la prohibición explícita de integrar/desplegar y la afirmación de
su informe de que no desplegó: Railway publicó el Frontend en `615619c`; el
Backend continuó en `b8447a3`.

PM conserva el resultado porque la lógica de producto coincide con la pieza ya
aceptada y reproducida en `eb62d3d`; un rollback ciego agregaría riesgo sin
recuperar una composición mejor. Esto no autoriza futuros pushes: la tarea
vigente vuelve a la rama Dev y `main` queda sólo para una publicación
explícitamente autorizada por Emi.

## 2026-09-14 — Página y orden del Mercado describen la entrada, no crean una por clic

`page` y `sort` quedan en la URL y se restauran junto con los filtros al volver
a una entrada del historial, pero los cambios dentro del Mercado usan
`replaceState`, igual que los filtros existentes. Por lo tanto, **Atrás no
recorre una por una las páginas visitadas**: vuelve a la entrada anterior y
restaura el estado completo que esa entrada tenía.

Es la política mínima y coherente con `NAV-URL-1`: evita llenar el historial por
cada ajuste del catálogo y conserva enlaces compartibles y recarga. Convertir
cada página en una entrada propia sería otro comportamiento de producto y no
forma parte de `CAT-PAGE-1`.

## 2026-09-13 — Integrar y desplegar la candidata aceptada antes del backup

Emi autorizó expresamente publicar en `main` la composición ya aceptada
`c565e6e`, aun sabiendo que Railway despliega automáticamente y que todavía no
hay backup/restauración ensayados. La integración quedó en el merge `b8447a3`,
que además consolida `AGENTS.md` y preserva la regla local de eficiencia de
chats; el producto fuera de documentación y de ese disparador coincide con la
candidata aceptada.

Esta es una excepción de publicación, no una aceptación de producción ni una
renuncia a la puerta operativa. `BACKUP-RESTORE-1` pasa a ser la tarea activa;
siguen pendientes la separación integración/producción, SMTP, configuración,
homologación de pagos, red-team y demás puertas registradas en `NOW.md`.

## 2026-09-13 — El carrito conservado sigue accesible y la FAQ enumera los medios reales

Cuando una sesión se confirma inválida, el carrito local conserva sus ítems. Si
la persona cierra esa capa, la cabecera debe seguir ofreciendo **Carrito**
mientras tenga contenido, aunque ya no haya sesión. Esto no habilita checkout
anónimo: continuar la compra abre el ingreso existente y, al autenticar, vuelve
al mismo carrito. Una salida explícita conserva la regla vigente de vaciarlo.

La FAQ «¿Cuáles son las formas de pago?» debe nombrar las dos posibilidades
reales: transferencia directa al vendedor y Mercado Pago cuando ese vendedor lo
tenga habilitado. No promete que todos los vendedores ofrezcan ambos medios ni
inventa comisiones, planes o custodia de fondos por AgroBoeda.

Ambos ajustes quedan en `POST-INTEGRATION-CLEAR-1`, después de integrar la
candidata congelada. No modifican `c565e6e` ni interrumpen la puerta operativa.

## 2026-09-07 — Cuenta AgroBoeda de evaluación, común y sólo sembrada en local

Emi pidió las credenciales exactas `pruba@agroboeda.com` / `@agroboeda` para
recorrer las áreas autenticadas y simular el alta de una publicación. Se
conserva `pruba` tal como fue escrito. La cuenta es una identidad de demo
conocida: rol `user`, activa y verificada, sin administración, transportista,
órdenes, publicaciones iniciales, datos bancarios ni Mercado Pago.

Se implementará en `DEMO-USER-1`, después de `BRAND-AGROBOEDA-1`, mediante el
seed idempotente que ya corta antes de abrir la base salvo `ENV=local`. No se
habilita una excepción, un endpoint oculto, el seed en Railway ni un despliegue.
Contrato completo en `CUENTA-DEMO-AGROBOEDA-CLIENTE-2026-09-07.md`.

## 2026-09-07 — La marca pública exacta es AgroBoeda y el monograma AB es la fuente oficial

Emi corrigió la decisión anterior: el nombre público no es `BOEDA` a secas,
sino **AgroBoeda**, con A y B mayúsculas y sin espacio. `TopGreen` queda como
nombre viejo. La sustitución visible se hará en `BRAND-AGROBOEDA-1`; no se
renombran en masa repo, base, contenedores, variables, servicios ni la
aplicación externa de Mercado Pago.

La fuente oficial recibida es el PNG `AGROBOEDA-LOGO-FUENTE.png`, monograma AB
sobre fondo verde. Se conserva sin modificar y fuera de `public/` en
`docs/pm/originales/`; SHA-256
`5606077c429b20edecb62986d6b7500c7142c6a6230c006fdfb33c4978b206cf`.
Mide 1536 × 1024, es RGB y no tiene transparencia. Como no contiene el nombre
completo, el producto debe acompañarlo con `AgroBoeda` visible o con nombre
accesible según la superficie; no se lo presenta falsamente como wordmark.

`MARKET-VIEWS-1` sigue como única tarea activa. La marca se ejecuta inmediatamente
después, en pieza separada, para no mezclar geometría de catálogo con identidad.

## 2026-09-06 — Sol Alto por defecto; la PM avisa cada cambio de razonamiento

Emi convierte en regla permanente la selección de esfuerzo de la PM. Se usa
GPT-5.6 Sol en Alto para el trabajo normal y Muy alto/XHigh sólo en bloques
puntuales con evidencia contradictoria, riesgo material o cierre complejo. La
PM debe avisar antes con motivo, alcance y condición de regreso, y recomendar
volver a Alto al terminar.

No se escala por ansiedad, longitud o uso disponible. El red-team profundo
mantiene su decisión separada de Astra Alto. Disparadores completos en
`ONBOARDING-PM.md`, sección «Cuándo cambiar el razonamiento de la PM».

## 2026-09-06 — Mercado tendrá dos vistas explícitas y Registro debe alcanzar la base profesional

Emi rechazó la geometría variable del catálogo y la calidad visual del alta a
partir de cuatro capturas del entorno descartable. La inspección de `7ff8c8a`
confirma ambas raíces: los activos toman automáticamente la fila completa y el
grupo de contraseña no ocupa su contenedor.

Mercado queda con exactamente dos modos elegibles: **Cuadrícula**, de tarjetas
uniformes con lectura cuadrada, y **Lista**, de rectángulos horizontales
uniformes. La anatomía cambia datos y señal, no el tamaño exterior; ordenar no
cambia la presentación. El alta recibe una pasada profesional acotada sobre el
sistema visual vigente, sin alterar su contrato ni abrir funciones nuevas.

`TRANSFER-REVIEW-1` continúa como única tarea activa. Después se ejecutan
`REGISTER-POLISH-1` y `MARKET-VIEWS-1`, en ese orden. Alcance, pruebas y no
objetivos en `FEEDBACK-VISUAL-EMI-2026-09-06.md`.

## 2026-08-31 — BOEDA reemplaza a TopGreen como marca pública

La cliente entregó la identidad BOEDA y confirmó que el producto ya no debe
presentarse públicamente como TopGreen. La lámina de marca pasa a gobernar
nombre, paleta, fotografía, tono y recursos visuales. El manual de producto y
la guía interáreas se aceptan como visión y principios; no amplían por sí solos
el contrato ni el MVP.

La migración será una pieza separada, `BRAND-BOEDA-1`, después del arnés vigente
y `TRANSFER-REC-1`, antes del cierre visual/responsive. Se cambiarán las
superficies visibles al usuario, no de forma ciega los nombres internos de repo,
base, contenedores, variables o servicios. Antes de implementación se pide el
logo vectorial y PNG transparente. Triage completo en
`IDENTIDAD-BOEDA-CLIENTE-2026-08-31.md`.

## 2026-08-22 — Firma confirmada; comienza trabajo postfirma

Emi confirmó que el contrato quedó firmado. Se mantiene el ancla ya acordada:
viernes 2026-08-21 como primer día de la semana 1; Fase 1 cierra el 03/09, las
doce semanas el 12/11 y el colchón contractual el 26/11.

Se levanta el freno previo a la firma. La primera pieza de producto integra los
tres datos logísticos ya validados en el prototipo y decididos el 15/08. No se
abre un rediseño genérico ni Mercado Pago: el bloque tiene alcance y evidencia
propios. Después corresponde revisar los recorridos principales con problemas
concretos, no con una orden vaga de “mejorar UX”.

## 2026-08-15 — Datos logísticos mínimos: comparar mejor sin construir un Uber de fletes

Después de revisar el prototipo y contrastarlo con productos del sector, PM
cierra la propuesta de los tres campos. La referencia útil de Agrofy no es su
marca sino el patrón: categoría y atributos estructurados mejoran búsqueda y
comparación; las plataformas especializadas que suman cotización,
disponibilidad, flota y seguimiento ya operan un producto logístico distinto.

Para el MVP de TopGreen rige esta solución mínima:

- **marca y modelo:** entra como dato opcional y visible para comparar; no es
  filtro ni requisito para aparecer;
- **dominio:** entra como dato opcional y privado; se revela sólo después de
  seleccionar al transportista, junto con el contacto. No se usa como prueba
  de identidad, no se muestra en el directorio y no filtra;
- **cargas permitidas:** entra como selección múltiple opcional, con «Otra» y
  detalle libre. En el MVP sólo se muestra; no excluye transportistas ni crea
  una promesa de compatibilidad automática.

El filtrado duro por carga se posterga hasta tener taxonomía validada y datos
reales suficientemente completos. Activarlo ahora haría desaparecer perfiles
que no completaron un campo nuevo y confundiría ausencia de dato con
incompatibilidad. La ficha alcanza para el MVP con localidad base, tipo de
vehículo, marca/modelo, capacidad, cargas declaradas, radio, distancias y
habilitación declarada; dominio y contacto aparecen después de seleccionar.

Se mantiene el límite contractual: TopGreen selecciona y conecta. No cotiza,
reserva, cobra ni sigue el flete. La implementación se programa después de la
firma dentro del pulido UX/logístico; no es tarea activa de Dev hoy.

## 2026-08-15 — La simulación logística no amplía silenciosamente el MVP

Emi pidió revisar por separado el alta de quien ofrece logística y el camino de
quien necesita contratarla. Se aprueba un prototipo UX aislado antes de la
firma porque el recorrido es crítico; no se habilita todavía una función nueva
en producto.

La simulación debe respetar el alcance vigente: TopGreen lista transportistas
compatibles, permite seleccionar y luego revela contacto. No cotiza, cobra,
reserva ni hace seguimiento del flete. Llamar a eso «contratación dentro de la
plataforma» sería prometer una función inexistente y fuera del MVP actual.

Marca/modelo, dominio separado y categorías de carga se prueban como propuesta
UX porque Emi los considera importantes. Se distinguen de los campos existentes
y sólo pasan al producto con una decisión posterior de alcance.

## 2026-08-14 — Antes de la firma no se abre otra función

La Dev termina únicamente la tarea activa de documentación revisada de
vendedores. Después no se abre otra función de producto hasta que el contrato
esté firmado. Durante la espera, PM puede relevar UX sin implementar y repetir
una sola homologación técnica de Mercado Pago con sesiones aisladas; la bandera
vuelve a quedar apagada.

Después de la firma, el orden interno será: UX de los recorridos principales,
pulido de logística dentro de esos recorridos, demostración del hito intermedio,
Mercado Pago en su fase contractual y, al final, seguridad, responsive, QA,
producción y capacitación. Logística ya está cerrada funcionalmente: sólo un
defecto reproducible habilita reabrirla antes del pulido.

Mercado Pago se prueba temprano porque es el mayor riesgo externo, pero no se
activa ni presenta como terminado antes de su fase. No se posterga su primera
prueba hasta el final y tampoco se usa el adelanto para regalar alcance.

La clienta dio el OK comercial en reunión y la firma legal quedó programada
para el viernes 2026-08-21. Ese día es la nueva ancla de la semana 1 y
reemplaza la fecha provisoria del 07/08. Las doce semanas cierran el 12/11 y el
colchón de catorce el 26/11. Hasta la firma termina la tarea activa, pero no se
abre alcance nuevo que pueda verse afectado por la redacción legal final.

## 2026-08-14 — Cortesía de cierre: documentación de vendedores revisada

Emi decide incorporar sin costo adicional una verificación **manual y mínima**
de documentación de vendedores como gesto para la primera clienta. La opera la
clienta desde administración; Ynera construye el flujo, pero no certifica la
identidad ni asume la decisión.

Alcance cerrado: CUIT, razón social, una constancia fiscal en PDF, estados
pendiente/aprobado/rechazado, registro de quién decidió y cuándo, y distintivo
visible **«Documentación revisada»**. No se usa «Vendedor verificado» porque
implicaría una garantía mayor que la comprobación realizada.

Quedan fuera RENAPER/ARCA, DNI, selfie o biometría, validación automática,
monitoreo permanente, alertas de vencimiento y garantía contra fraude. Entra
como cortesía de cierre después de las funciones contractuales pendientes y
antes de cerrar la puerta de lanzamiento; no desplaza Mercado Pago, no modifica
los hitos y no consume el colchón de las semanas 13–14.

## 2026-08-13 — Un retorno no prueba pago y Mercado Pago reserva stock

La fuente de verdad de un cobro es una notificación Webhook autenticada seguida
de una consulta del pago a la API de Mercado Pago con el token del vendedor.
Los parámetros de retorno del navegador nunca cambian orden, pago ni stock.
El webhook se configura como Webhook —no IPN— y valida `x-signature`,
`x-request-id` y `data.id` con el secreto fuera del repositorio.

Una orden de Mercado Pago reserva stock de forma atómica antes de exponer la
preferencia. La reserva no incrementa ventas; se confirma una sola vez al pago
aprobado y se libera una sola vez al terminar sin cobro. El vencimiento local no
libera a ciegas: primero reconcilia con Mercado Pago para no vender dos veces ni
cobrar algo cuyo stock ya fue liberado. La preferencia comparte el mismo plazo.

Motivo: descontar recién al webhook puede cobrar sin mercadería; reservar sin
vencimiento deja stock inmortal; confiar en la vuelta del navegador permite
falsos pagos. La documentación oficial recomienda Webhooks firmados y permite
definir vigencia de preferencias:
https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/payment-notifications
https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-settings/term-of-preference

La duración exacta y el mecanismo productivo de ejecución se validan contra el
doble en MP-C. La bandera sigue apagada hasta probar el recorrido real; esta
decisión no incorpora reembolsos automáticos, suscripciones ni comisión.

## 2026-08-13 — Mercado Pago es opcional por vendedor

Un vendedor sin vínculo usable de Mercado Pago conserva publicaciones y puede
cobrar por transferencia si tiene datos bancarios. No se le exige Mercado Pago
para publicar ni se oculta su catálogo. En un carrito mixto, cada grupo muestra
sólo los medios realmente disponibles para ese vendedor.

Motivo: preserva el flujo contractual ya aceptado y evita convertir una
integración de pago en requisito de publicación. Si el vínculo cae, se apaga
Mercado Pago para ese vendedor; no desaparecen sus productos.

Una clave de cifrado ausente o mal formada es una falla de configuración de la
plataforma, por lo que el estado visible es `no_configurado`, no «reconectar»:
el vendedor no puede solucionar una clave operativa rota.

## 2026-08-12 — Emi confirma Mercado Pago por vendedor

Cada vendedor vincula su propia cuenta de Mercado Pago mediante OAuth, cobra
directamente y asume la comisión normal del procesador. TopGreen no recibe,
retiene ni redistribuye fondos y configura comisión de marketplace cero. En un
carrito multivendedor hay una orden y un pago por vendedor.

La confirmación habilita la implementación en piezas y esfuerzo **Extra**. La
primera pieza es sólo la base OAuth segura: cifrado, rotación, revocación y
estado visible. No se activa un cobro hasta que esa base sea aceptada. Motivo:
es la implementación mínima del Checkout Pro ofrecido y evita que TopGreen
custodie dinero ajeno.

## 2026-08-12 — El precio se confirma al crear la orden

El carrito no reserva ni promete el precio de una publicación. Rige el precio
vigente cuando el comprador confirma; ahí la orden lo congela en su snapshot.
Antes de iniciar cualquier pago debe verse ese total vigente. Motivo: evita que
un carrito abandonado obligue al vendedor a sostener un precio indefinidamente,
sin agregar reservas ni vencimientos fuera del MVP.

## 2026-08-12 — Mercado Pago: el PDF no prohíbe OAuth

La documentación oficial de Mercado Pago para marketplaces exige usar el token
de cada vendedor obtenido mediante OAuth:
https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/how-tos/integrate-marketplace

La revisión del PDF original confirma que se ofreció checkout básico para
crédito, débito y dinero en cuenta, pero no se definió quién cobra ni se
prohibieron OAuth o split. Por lo tanto, «sin OAuth» no era un límite textual de
la clienta: fue una interpretación interna posterior que puede corregirse si
OAuth es el medio técnico necesario para que cada vendedor cobre directamente.

El contraste técnico de la Dev `925de4e` y la verificación directa de PM
confirman la hipótesis: OAuth por vendedor, sin comisión de marketplace, es la
implementación segura del Checkout Pro ya vendido. No amplía el resultado
comercial, aunque sí exige infraestructura sensible que debe construirse bien.

Checkout Pro sigue usando preferencias (`/checkout/preferences`); la API Orders
nueva pertenece a Checkout API. `marketplace_fee: 0` es válido. La comisión
normal la descuenta Mercado Pago al vendedor. El modelo estándar es 1:1, por lo
que cada orden/vendedor necesita su pago; 1:N requiere relación comercial
asesorada con Mercado Pago.

Queda pendiente confirmación de Emi antes de implementar: cada vendedor debe
vincular Mercado Pago y los carritos multivendedor implican pagos separados.
Eso se informa a la clienta como funcionamiento del requisito, no como adicional.
Hasta entonces `payments.py` y `mp_oauth` siguen desmontados.

## 2026-08-09 — Navegación contextual sin ampliar el MVP

Emi aprobó para Fase 3 que la ubicación del detalle de una publicación sea una
acción: abre el catálogo filtrado por su provincia y, cuando exista, por su
localidad oficial. Se reutilizan filtros y URL existentes; no agrega mapa,
ruteo, GPS ni recomendaciones.

La implementación no puede usar `seller.location`: hoy el detalle muestra ese
texto libre, incluso con ciudad/provincia invertidas, mientras que el filtro
real trabaja con la localidad oficial del producto. La respuesta pública del
catálogo deberá exponer los datos oficiales necesarios.

La dev puede detectar y proponer mejoras equivalentes, con problema, beneficio,
cambio, esfuerzo y fase recomendada. No las implementa sin aprobación de PM.
PM también puede proponerlas y aplica el mismo filtro: impacto verificable,
reutilización de lo existente y nada fuera del cronograma contractual.

## 2026-08-06 — Segundo relevo del rol de PM

Decisión de Emi. Entra una PM nueva; Sol deja el rol. **La dev es la misma
desde el 2026-08-04**, así que la continuidad del código no se corta.

Lo que **no** cambia con el relevo, y se deja escrito para que no se
reabra por desconocimiento:

- **El calendario del PDF.** Semana 1 desde el viernes 2026-08-07, cinco
  fases, cierre a las doce semanas el 29/10 con colchón hasta el 12/11.
- **Todo lo registrado en este archivo sigue vigente.** Se puede discutir;
  cambiarlo es decisión de Emi.
- Los dos canales y sus dueños, y el trabajo adversarial en las dos
  direcciones.

`ONBOARDING-PM.md` se reescribió el mismo día para la PM entrante, con una
sección nueva —"Lo que ya está decidido y no se reabre"— que resume las
doce decisiones vigentes en una tabla. Motivo: el riesgo principal de un
relevo no es la falta de contexto, es rehacer lo ya resuelto.

**Queda pendiente de la PM entrante** aceptar o rechazar la corrección del
prototipo logístico (`f7fd2a2`), de lo que depende que la Fase 1 cierre en
fecha el 20/08.

## 2026-08-05 — Definiciones del prototipo logistico

- El flete no es obligatorio, pero cada pedido exige una eleccion explicita:
  transportista seleccionado o traslado por cuenta propia.
- El MVP usa `full_name`; no agrega nombre comercial fuera del contrato.
- La compatibilidad muestra dos distancias en linea recta: base a origen y
  base a destino. No recomienda ni ordena “el mejor”.
- El comprador ve el contacto del transportista despues de seleccionarlo. El
  transportista no recibe el contacto del comprador en el MVP; el comprador
  inicia la coordinacion.
- La operacion muestra articulos y cantidades existentes, sin inventar peso.
- La declaracion de habilitacion con detalle y fecha entra en Fase 2. TopGreen
  no la verifica.
- Los candados de contacto por plan siguen en Fase 6.
- El destino estructurado por `locality_id` queda como cimiento de Fase 2; el
  prototipo no habilita a implementarlo antes.

El prototipo `778f6ab` vuelve una vez por estas correcciones y por contraste
insuficiente en el verde principal. No se repite la suite de producto porque
la pieza sigue aislada en `docs/ux/`.

## 2026-08-05 — Transferencia aceptada; sigue UX/UI de logistica

La PM acepta `0039e00`: cierra las salidas de los dos estados de
transferencia, permite decidir sin comprobante, evita el doble descuento de
stock, muestra la referencia y no intenta reembolsar transferencias mediante
Mercado Pago. La misma suite quedo 25/25; el runner oficial de Docker se
repite en Fase 5.

La dependencia residual con el modulo heredado de reembolsos no se abre ahora:
queda para la reconstruccion de pagos en Fase 4. La siguiente pieza es el
prototipo navegable del flujo logistico que cierra la puerta de Fase 1.

## 2026-08-05 — Inicio, correo, Railway y Fase 6 quedan cerrados

Decisiones de Emi:

1. La semana 1 comienza el viernes 2026-08-07. Las doce semanas terminan
   el 2026-10-29 y el colchon de catorce llega al 2026-11-12.
2. "Registro con validacion" se implementa por correo electronico: enlace
   de un solo uso, 24 horas de vigencia, reenvio y login bloqueado hasta
   verificar.
3. Railway es el hosting aprobado. Configuracion no cuenta como despliegue;
   produccion exige HTTPS, persistencia, backups, migraciones y salud
   comprobados.
4. Primero se cumple el cronograma completo del PDF. Suscripciones, planes,
   mensajeria y tierras pasan a Fase 6 posterior al lanzamiento.

Esta decision reemplaza las alternativas y el ancla provisoria registradas
el 2026-08-04.

---

## 2026-08-05 — El PDF gobierna fases, hitos y limites

Se revisaron visualmente las cinco paginas del documento aprobado y se
convirtieron sus fases en puertas verificables dentro de `CRONOGRAMA.md`.

- La Fase 1 no estaba cerrada: falta el flujo UX/UI de logistica.
- La Fase 2 no estaba cerrada: falta implementar la validacion por correo y
  la edicion del perfil transportista.
- Las semanas 13 y 14 son contingencia, no una fase nueva.
- El hito intermedio exige demostrar tambien la geolocalizacion de fletes.
- Suscripciones, planes, mensajeria y tierras no aparecen en el PDF y se
  asignaron a Fase 6.
- Railway fue aprobado como destino; falta demostrar el despliegue.

Los limites operativos por bloque quedaron en `ALCANCE-Y-LIMITES.md`.

## 2026-08-05 — Primero se desbloquea la transferencia; stock va aparte

Se acepta la propuesta asimetrica de la dev:

- en `AWAITING_TRANSFER_RECEIPT`, comprador y vendedor pueden cancelar;
- en `TRANSFER_RECEIPT_SUBMITTED`, solo el vendedor puede cancelar o
  decidir;
- el vendedor puede aprobar o rechazar sin comprobante si verifico su
  cuenta;
- la referencia visible es el numero de orden;
- cancelar una transferencia no dispara un reembolso de Mercado Pago.

Vencimiento y reserva de stock se separan. Hoy el sistema verifica stock al
crear la orden pero no lo reserva; pedir "liberacion" sin decidir primero
la reserva seria especificar un comportamiento inexistente.

---

## 2026-08-04 — Cambio de roles: Sol pasa a PM, la anterior PM pasa a dev

Decisión del dueño del proyecto. **Sol define, prioriza, escribe criterios
de aceptación y revisa. La PM anterior escribe el código.**

Lo que **no** cambia:

- **Siguen siendo adversariales en las dos direcciones.** La dev frena una
  instrucción técnicamente mala antes de ejecutarla; la PM verifica contra
  el código y no contra el informe.
- **La PM no escribe código de producto.** Sólo edita `docs/pm/`.
- Los dos canales y sus dueños: `PARA-DEV.md` lo escribe la PM,
  `PARA-PM.md` lo escribe la dev, y ninguna toca el archivo de la otra.

Traspaso ejecutado el mismo día: `ONBOARDING-PM.md` nuevo con las reglas y
los errores de la PM saliente, `PARA-DEV.md` archivado de 1.378 a 494
líneas con el historial completo preservado en
`archivo/PARA-DEV-historico.md`, y `PARA-PM.md` pisado con el primer
informe de la dev entrante.

## 2026-08-04 — El cronograma sale del PDF del socio, anclado a fechas

**Decision provisoria, reemplazada el 2026-08-05 por el inicio en viernes
2026-08-07.** Se conserva para no borrar la historia de la planificacion.

El *Documento de Especificación Funcional y Propuesta Comercial* que
aprobó la clienta define cinco fases en semanas numeradas, sin fechas.
Se ancla **la semana 1 al lunes 2026-07-27**, la semana en que la clienta
aprobó el proyecto el martes 28.

Motivo del ancla: el reloj arranca cuando arranca el trabajo pagado. Es
una lectura nuestra y **falta confirmarla con la clienta**; si ella
entiende otra fecha, las cinco fases se corren en bloque.

Consecuencias, desarrolladas en `CRONOGRAMA.md`:

- Las doce semanas cierran el **2026-10-18**; el colchón que el propio PDF
  concede —"12 a 14 semanas"— llega al **2026-11-01**.
- **Hacia la clienta se reporta con estas cinco fases**, aunque
  internamente se trabaje en otro orden.
- El **hito intermedio** ya está casi disparado en la semana 2, salvo por
  la geolocalización de fletes. No se reclama hasta que el listado de
  transportistas por cercanía funcione.
- **Las suscripciones no están en el PDF.** Son alcance agregado después
  de la aprobación, sobre un precio cerrado. Hay que resolver si van como
  addendum, absorbidas, o corridas a una fase 6. No decidir equivale a
  absorberlas sin haberlo acordado.

## 2026-07-26 — El candado de suscripción entra; el cobro de suscripción, no

Definición del dueño del proyecto: **el teléfono del comprador se ve sólo
con suscripción paga.** Es el mecanismo de ingresos de la clienta — el
transportista paga por acceder a contactos.

Suscripciones estaba listado como fuera de alcance. Se separa en dos:

- **Dentro: el candado.** Un estado de suscripción en el usuario, activado
  a mano por el administrador, y la verificación en el backend. El
  endpoint no devuelve el teléfono sin suscripción activa. Incluye el caso
  de suscripción vencida por fecha.
- **Fuera: el sistema.** Cobro, renovación, planes, niveles, avisos de
  vencimiento. Módulo entero, se cotiza aparte.

Motivo de incluir el candado ahora, aunque no esté contratado: **el
control de acceso es la forma de los endpoints, no una capa posterior.**
Construirlos devolviendo el teléfono siempre obliga a tocarlos todos
después. Definido de entrada es una condición en un lugar.

Es el mismo criterio que se aplicó a la privacidad de los datos de
contacto y a la revisión de seguridad: la auditoría se posterga, las
decisiones estructurales no.

**Queda por confirmar con la clienta quién paga** —lo natural es el
transportista— y si los vendedores también. El mecanismo es idéntico en
cualquier caso, así que no bloquea la construcción.

---

## 2026-07-26 — Suscripciones con Mercado Pago, dos planes, y mensajería en el premium

Decisión del dueño del proyecto, tomada después de que la PM recomendara
lo contrario. Queda registrada como suya y se ejecuta completa.

**Entra:**

- **Cobro de suscripciones por Mercado Pago**, recurrente. *"Es la base de
  todo"*: sin eso la clienta no tiene con qué financiarse.
- **Dos planes, básico y premium**, que habilitan distinto nivel de acceso
  a los datos de contacto.
- **Mensajería interna, sólo en el plan premium.** Resuelve la objeción
  que había planteado la PM: si cualquiera puede chatear, se pasan el
  teléfono en el primer mensaje y nadie paga. Reservada al plan caro, deja
  de canibalizar y pasa a justificar el precio del plan.

**Queda afuera:**

- **Verificación automática de pagos.** El dueño la descarta: la operación
  es entre empresas y ya se cobra una suscripción.
- **Carta de porte electrónica.** Descartada, ni siquiera por hora.

### Una aclaración que evita confundir esto con lo anterior

Cobrar una suscripción **no contradice** la decisión de que la plataforma
no toque fondos de terceros. Son cosas distintas:

- Cobrar una comisión de cada venta es administrar plata ajena. Eso quedó
  descartado.
- Cobrar una suscripción es **facturarle a un cliente propio por un
  servicio propio**. Eso es una venta común y no tiene implicancia
  regulatoria.

### Lo que esto cuesta, y hay que resolverlo antes de firmar

| Pieza | Estimado |
|---|---|
| Suscripción recurrente con Mercado Pago | 1,5 a 2 semanas |
| Dos planes aplicados a lo que se ve | 1 semana |
| Mensajería con hilos, no leídos y candado por plan | 2 a 3 semanas |
| **Total agregado** | **4,5 a 6 semanas** |

El trabajo restante era de 7 a 9 semanas. Con esto pasa a **11,5 a 15**,
contra un plazo contractual de 12 a 14 semanas y un precio cerrado. Entra
raspando en el mejor caso y se pasa en el peor, sin margen para
imprevistos.

**No es una objeción al alcance: es una advertencia de plazo y precio.**
El tratamiento comercial está en el documento de prefirma.

---

## 2026-07-26 — La plataforma no toca el dinero, y es a propósito

En el pago por transferencia, los fondos van **directo de la cuenta del
comprador a la del vendedor**. TopGreen muestra el CBU y guarda una
imagen del comprobante. Nunca recibe ni retiene dinero.

No es una limitación: es la decisión. Una plataforma que cobra, retiene
comisión y gira el resto está manejando fondos de terceros, y eso en la
Argentina toca el régimen de proveedores de servicios de pago, con
registro ante el Banco Central. **El contrato pide "checkout básico" y
nada más.**

Consecuencias que se derivan y quedan fijadas:

1. **El split payment heredado sigue apagado.** Ya estaba marcado como
   construido por encima del alcance; esta es la razón más fuerte.
2. **Quien valida el pago es el vendedor, mirando su cuenta bancaria.**
   El comprobante subido es una imagen falsificable: sirve como registro
   de la conversación, no como verificación. La pantalla tiene que
   decirlo, porque si no un vendedor puede entregar mercadería contra un
   PNG.
3. **Los términos y condiciones del sitio no están en el alcance.** Quién
   responde si una operación entre usuarios sale mal es una definición
   legal del cliente, no una función a construir.

---

## 2026-07-25 — No se instalan skills de agente antes de la demostración

Evaluado `addyosmani/agent-skills`: 24 skills en markdown con soporte
nativo para Codex y Windsurf, así que técnicamente la dev podría usarlas.

**Decisión: ninguna antes del 30-07.** Faltan tres días para la
demostración y la firma. Cambiar el comportamiento de la dev y terminar
las tareas pendientes al mismo tiempo es mover dos variables a la vez
justo cuando menos margen hay para depurar.

**Después de la demostración, sólo dos:**

- `browser-testing-with-devtools`, que es lo único que se superpone con
  trabajo real pendiente.
- `security-and-hardening`, antes del despliegue.

**Descartadas de forma permanente** las de definición, planificación y
documentación —`spec-driven-development`, `planning-and-task-breakdown`,
`documentation-and-adrs` y similares—. Hacen exactamente lo que hace
`docs/pm/`: especificar, priorizar y registrar decisiones. Instalarlas
crearía una segunda fuente de verdad manejada por la dev, en paralelo a
la del PM y sin la clienta ni el contrato a la vista.

El valor de ese repositorio es más alto para un equipo sin PM. Acá el
cuello de botella nunca fue que la dev no supiera cómo trabajar.

---

## 2026-07-25 — Línea base aprobada. Empieza la construcción

PostgreSQL 16 + PostGIS 3.4.3, una migración generada desde los modelos
(15 tablas, 40 índices, sin `DROP`), seed repetible, build en verde y los
diez smoke tests en `200`. Commit `de98fae`.

Aprobados los tres arreglos de código que hicieron falta, todos mínimos y
sin tocar el esquema: `UUID` → `str` en parámetros y schemas de request
(las columnas son `String(36)`), acumulador `Decimal` en el total del
carrito, y corrección del slug inexistente en el seed.

Ese segundo arreglo confirma el diagnóstico anterior: un
`float += Decimal` en el total del carrito significa que **nadie sumó
nunca dos ítems a un carrito** en el código heredado.

Verificado además que el frontend no tiene llamadas huérfanas: los 23
endpoints que invoca existen en el backend. Era el mayor riesgo pendiente
y queda descartado.

Se cierra la fase de auditoría. El avance medido contra el contrato es
~40%, con la matriz de evidencia en `MATRIZ.md`.

---

## 2026-07-25 — No se cambian los IDs a `uuid` nativo

Los modelos usan `String(36)` para los identificadores. En PostgreSQL el
tipo `uuid` nativo sería mejor: índices más chicos y validación de tipo. Y
este es el momento más barato para cambiarlo, con la base vacía y el
esquema recién generado.

**No se hace.** No afecta ningún requisito contractual, el presupuesto es
cerrado y a la escala de este MVP `String(36)` funciona. Aplicar acá el
mismo criterio que se le exige al alcance: no se construye lo que no está
pedido.

Queda registrado porque la ventana barata se cierra cuando haya datos.

---

## 2026-07-25 — Geolocalización con localidades sembradas, sin API paga

Se evaluó dejar la geolocalización como extra por el costo de las APIs de
geocoding. **Rechazado.** Está en las cinco secciones del contrato, y la
sección 4 elige PostGIS específicamente para resolverla; sin geo el
diferencial del producto desaparece. Además el segundo hito de cobro se
paga contra demostrarla funcionando, así que recortarla bloquea el pago.

La preocupación por el costo era válida pero mal dirigida: **el contrato
no pide geocoding**. Se resuelve con una tabla de localidades sembrada una
vez y selección desde lista. PostGIS calcula distancias localmente. Costo
recurrente cero, sin dependencias externas en runtime.

Recortado dentro de la geo, sin costo contractual: geocoding de
direcciones libres, mapas y selección con pin, distancia por ruta real
—el contrato rechaza el ruteo— y radio elegido por el comprador.

---

## 2026-07-25 — Primer bloque contractual entregado y verificado

Publicación desbloqueada y geolocalización con cimiento real, commit
`190525b`. Primera funcionalidad del contrato construida por este equipo,
no heredada.

Verificado de forma independiente: hash del CSV, cantidad de registros,
correspondencia de la localidad guardada con el padrón, y la distancia de
`ST_Distance` contrastada contra un cálculo propio por haversine. La
diferencia de 80 metros es la esperada entre elipsoide y esfera, lo que
confirma que PostGIS está bien configurado y en uso real.

Confirmado además que el fallback de categorías hardcodeadas **sí estaba
activo** mientras cargaba la API, ofreciendo categorías inexistentes como
"Ganadería". Eliminado.

Primer dato de velocidad: el cimiento geográfico estaba estimado en unas
dos semanas y salió en una sesión. El estimado de trabajo restante baja de
8–10 a **7–9 semanas**. Es un solo dato y lo que queda tiene más
incógnitas, así que se firmará después del módulo de transportistas.

---

## 2026-07-25 — Automatizar los smoke tests antes de transportistas

Hoy los diez casos se repiten a mano en cada entrega y no existe nada que
detecte una regresión.

Se aprueba automatizarlos, alrededor de medio día. No es trabajo extra: la
fase 5 del contrato pide "pruebas integrales". Y se hace ahora en lugar de
al final porque en cada vuelta apareció algo que nunca había funcionado, y
todo lo ya arreglado está sin protección.

---

## 2026-07-25 — Fuente de localidades: Georef v2 del Estado argentino

Aprobada. Descarga completa de `localidades.csv`: 4.028 registros con ID
oficial, provincia, nombre, latitud y longitud. Oficial, abierta y
descargable entera.

Se versiona una copia en el repositorio para que el seed sea reproducible
y no dependa de internet en runtime. Costo recurrente cero, como exigía la
decisión de geolocalización.

**Las provincias salen de esta tabla, no de `form_options`.** Sembrar
provincias a mano en `form_options` sería trabajo descartable.

---

## 2026-07-25 — Publicación rota en la UI. Arreglo aprobado

El recorrido de UI encontró que **publicar no funciona y nunca funcionó**:
al elegir una categoría, `TypeError: Cannot read properties of undefined
(reading 'length')` en `AddProductModal`, y React desmonta la aplicación
entera.

Causa raíz: `/catalog/form-options` arma la respuesta dinámicamente y omite
la clave de cualquier tipo de opción que no tenga filas activas. El
frontend hace `setFormOptions(data)`, que reemplaza el estado completo, así
que las claves ausentes quedan `undefined` y revientan al leer `.length`.
La tabla `form_options` está vacía.

La verificación por API no lo detectó: el endpoint responde `200` con un
objeto incompleto.

Aprobado, porque bloquea el requisito contractual 3.1 de gestión de
catálogo:

1. Fusionar la respuesta con el estado inicial en lugar de reemplazarlo.
   Una línea, y protege para siempre contra cualquier tipo de opción
   ausente.
2. Sembrar los tipos de opción que faltan, **excepto provincias**.
3. Un error boundary de nivel superior. No es contractual, pero una
   pantalla en blanco en una demo con el cliente es catastrófica y cuesta
   veinte líneas.

Registrados sin acción, por cosméticos: el contador de ventas del vendedor
en 0 con 2 ventas reales, y el badge del carrito que persiste al cambiar de
rol.

---

## 2026-07-25 — PROPUESTA GUARDADA: directorio por zonas en lugar de radio

**No es una decisión.** Es una idea a evaluar cuando se llegue al módulo
de transportistas. Hasta entonces sigue vigente el radio en km, que es lo
que dice el contrato al pie.

Se guarda con el análisis hecho para no volver a razonarlo desde cero.

El transportista declara **las zonas que atiende**, de una lista. El
comprador elige una zona y se listan los que la declararon. Sin cálculo
de radios.

Cobertura contractual: la sección 3.2 se titula *"Sugerencia de
Implementación Ágil"* y dice *"se propone"*, así que el radio en km es un
mecanismo sugerido, no un requisito. Lo vinculante es la sección 2,
*"transportistas vinculados por proximidad geográfica"*, y una zona es
proximidad geográfica.

Motivos, además de que es más simple: las zonas declaradas reflejan cómo
trabaja un fletero real —piensa en provincias que atiende, no en un radio
desde su base— y el ahorro estimado es de 3 a 4 días.

Dos condiciones que se mantienen:

1. **Los campos de búsqueda son estructurados.** La dirección en texto
   libre sirve para mostrar y contactar, nunca para buscar. Provincia,
   localidad y zonas atendidas salen de listas.
2. **Las coordenadas se mantienen**, para ordenar resultados por cercanía
   y porque la sección 4 elige PostGIS para las consultas de cercanía de
   fletes. Entregar cero uso de PostGIS sería no implementar lo
   especificado.

El selector de zona del comprador viene precargado con su localidad, con
lo que se cumple que "el sistema detecta la ubicación" y además él elige.

**A resolver cuando se llegue:** zonas declaradas o radio en km. La
propuesta de zonas es más simple y más fiel al negocio; el radio es lo que
el contrato sugiere textualmente. Las coordenadas se siembran igual en los
dos casos, así que la tarea de localidades no depende de esta definición y
puede avanzar.

---

## 2026-07-25 — El radio del transportista cubre origen y destino

Vigente mientras no se resuelva la propuesta de zonas.

El contrato dice que el sistema detecta la ubicación del comprador y del
vendedor y lista transportistas "disponibles en la zona" (3.2), sin
precisar contra qué punto se mide.

Definido: **las dos puntas dentro del radio declarado**. Un transportista
que sólo cubre el destino no puede levantar la carga.

---

## 2026-07-25 — Se abandona SQL Server y el esquema se genera desde los modelos

Se activó el tope de una sola pasada. El autogenerate de reconciliación
propuso borrar tablas y columnas y cambiar tipos, no sólo agregar.

Causa de fondo, verificada: las migraciones heredadas describen un
esquema **anterior** al rediseño de los modelos. Son renombres y cambios
de tipo, no drift: `orders.total` → `total_amount`,
`orders.shipping_address` (Text) → `shipping_address_json` (JSON),
`orders.notes` → `buyer_notes` + `seller_notes`, `orders.tax` eliminada,
`order_items.unit_price` → `unit_price_snapshot`.

Y no hay camino alternativo: **no existe `create_all` en el código**. Por
ningún medio disponible en el repositorio se puede obtener un esquema que
coincida con los modelos. Lo que corrió en producción fue construido por
algo que no vino en el paquete.

Decisión: PostgreSQL con PostGIS disponible, borrar las 10 migraciones
heredadas —quedan en el historial de git— y generar una migración inicial
desde los modelos contra una base vacía.

Motivo del cambio respecto de la decisión anterior: el argumento de
aislar variables ya no aplica, porque no existe una verificación más
barata sobre SQL Server. Y este trabajo no es descartable: PostgreSQL +
PostGIS es el destino contractual (sección 4).

Prerrequisito detectado: `app/models/__init__.py` no importa `rating` ni
`notification`, así que `Base.metadata` no las ve. Eso produjo dos falsos
`DROP` en el autogenerate y, sin corregirlo, generaría un esquema sin esas
dos tablas.

---

## 2026-07-25 — Una pasada de reconciliación de esquema, con tope

El seed falla por `users.whatsapp`: la columna está en el modelo y en dos
módulos de la API, pero ninguna migración la crea. Medido el desfasaje
completo, **faltan unas 20 columnas en 6 tablas** (`orders` 10 de 27,
`payments` 3, `users` 2, `audit_logs` 2, `contact_messages` 2, `carts` 1).

Las migraciones no describen los modelos. Arreglar columna por columna
son días de ida y vuelta.

Decisión: **una** migración de reconciliación autogenerada sobre SQL
Server. Si esa única pasada no deja la línea base verde, se abandona SQL
Server y se pasa directo a PostgreSQL + PostGIS generando el esquema
inicial desde los modelos.

Motivo de no saltar ya a PostgreSQL, aunque el trabajo sobre SQL Server
se descarte igual: cambiar motor, driver y esquema a la vez sobre una
aplicación que nadie vio funcionar mezcla demasiadas variables. Un round
acotado de verificación vale más que ahorrarlo.

Restricción: la migración sólo puede agregar. Cualquier `DROP` o cambio
de tipo propuesto por el autogenerate detiene la tarea.

Consecuencia sobre el diagnóstico general: los modelos son la fuente de
verdad del esquema, no las migraciones. Cuando se genere el esquema de
PostgreSQL, se genera desde los modelos.

---

## 2026-07-25 — `alembic upgrade head` nunca pudo ejecutarse

`010_add_ratings_table.py` declara `down_revision = '009'`, pero la
revisión 009 se llama `'009_add_product_subcategory'`. Alembic corta con
`KeyError: '009'` y no aplica ninguna migración. Verificado en la cadena
completa: sólo la 010 rompe el formato `'0NN_nombre'`.

Tercera falsedad confirmada en la documentación de entrega, y la
definitiva: **una instalación limpia nunca pudo crear el esquema.** La
tabla `ratings` no existe por migración y "Fase I funciona end-to-end"
es imposible sobre una base nueva.

Se aprueba el arreglo mínimo: corregir `down_revision`. Sin tocar
esquema.

Consecuencia sobre `docs/PROJECT_STATUS.md`: siete afirmaciones falsas
verificadas. El documento se trata como no fiable en su totalidad.
Notablemente, tres errores son en contra del proyecto — el admin **sí**
tiene CRUD de subcategorías, el frontend **sí** usa `form_options`, y los
campos de servicio **sí** llegan a la API. La documentación subestima lo
construido tanto como lo sobreestima.

---

## 2026-07-25 — Fuera del contrato no implica remover

Al inventariar lo construido por encima del contrato, se distinguen tres
tratamientos en lugar de uno:

1. **Se queda y no recibe esfuerzo**: split payments, notificaciones,
   `form_options`, CRUD de subcategorías, tema claro/oscuro, About y
   Contact, mensajes de contacto. Desarmar código que funciona cuesta
   igual que escribirlo.
2. **Se oculta del frontend porque induce a error**: ratings y reputación
   de vendedor, badges y tags, `ServicesPage` estática.
3. **Riesgo a resolver antes de producción**: el endpoint de simulación
   de pagos (`payments.py:547`), declarado de desarrollo, no puede quedar
   alcanzable en producción.

Motivo: el criterio de recorte es económico, no doctrinario. Se recorta
lo que cuesta construir o lo que engaña al usuario, no lo que ya está
hecho y es inofensivo.

---

## 2026-07-25 — El contrato entra al repositorio y define el alcance

Se incorpora `CONTRATO.md` con la transcripción funcional del PDF
(secciones 1 a 5). Pasa a ser la única fuente de alcance. Las secciones
comerciales no se versionan porque el repositorio es público.

Consecuencia: `PM_ROADMAP.md` baja de rango. Sirve como plan interno,
pero **sobrepasa el contrato** y no es alcance.

---

## 2026-07-25 — Se recorta el alcance que el roadmap inventó

Contrastado el roadmap v3 contra el contrato, queda **fuera del MVP**:

- Cuatro perfiles de usuario. El contrato define dos roles; el
  transportista es "un tipo especial de proveedor" (3.2), no un rol.
- Modo `consulta_cotizacion`. No existe en el contrato.
- Cotización al transportista y estados logísticos. El contrato pide
  seleccionarlo o contactarlo con los datos provistos (3.2).
- Perfil público de vendedor tipo sucursal. El contrato dice "panel de
  control básico" (3.1).
- Filtros de atributos por categoría. El contrato pide filtros por
  categoría y ubicación (3.1).
- Subcategorías navegables y badges.

Motivo: casi todo eso viene del benchmark de Agrofy, que es referencia
interna y no justifica alcance. El contrato es a precio cerrado; construir
lo no pedido sale del margen.

---

## 2026-07-25 — La logística es un directorio, no un motor de ruteo

El contrato lo dice explícitamente en 3.2: *"en lugar de un complejo
algoritmo automatizado de ruteo, se propone un modelo de Directorio de
Logística por Geolocalización"*.

Alcance: transportista con ubicación base, certificación, radio de
cobertura y capacidad de carga; listado por zona al momento de la compra;
selección o contacto directo. Nada más.

---

## 2026-07-25 — El split payment está por encima del contrato

El contrato pide "checkout básico" de Mercado Pago (3.3) y no menciona
split payments, OAuth de vendedores ni comisión de marketplace. El código
ya lo tiene implementado.

Queda como está — ya está construido y desarmarlo cuesta más que
dejarlo — pero **no se le suma esfuerzo**. Lo que sí falta y es
contractual es la transferencia bancaria con comprobante, que hoy está en
cero.

Pendiente de confirmar con el cliente: si la comisión del 5 % del
marketplace es parte del modelo de negocio acordado, porque en este
documento no aparece.

---

## 2026-07-25 — El camino Docker del README nunca funcionó

Primer intento real de levantar la línea base: `alembic upgrade head`
falla con error 4060, la base `topgreen` no existe. Verificado que nada
en el repositorio la crea, incluido `scripts/init_local_db.sh`.

Segundo hallazgo confirmado contra la documentación de entrega, más grave
que el de la migración `011`: el quickstart de 3 comandos del README es
inejecutable. Falla el criterio de aceptación "instalación reproducible
desde cero".

Se aprueba el arreglo mínimo: creación idempotente de la base en los
scripts de init, antes de las migraciones. No se toca esquema ni modelos.

Pendiente menor: `.env.example` usa `topgreen` y
`README_LOCAL_SETUP.md:126` usa `topgreen_local`. Unificar en `topgreen`.

---

## 2026-07-24 — Agrofy es referencia interna, no requisito

El cliente no pidió Agrofy y no lo conoce. Es un marco de referencia del
equipo (decisión de PM del 20-07-2026).

Consecuencia: Agrofy no justifica alcance. Resuelve *cómo* implementar
algo que el contrato ya pide, nunca *qué* construir. Un patrón que no se
trace a un requisito del PDF no entra al MVP.

Corrige una afirmación errónea que este documento y `PROJECT.md` tenían
antes ("el cliente pidió algo similar a Agrofy").

---

## 2026-07-24 — El PDF del contrato no está en el repositorio

`PM_ROADMAP.md` v3 es un resumen del PDF hecho en la auditoría del
20-07-2026, no el contrato. El PDF no está versionado en ningún lado.

Consecuencia: las decisiones de alcance se están tomando sobre una
fuente de segunda mano. Conseguir el PDF o transcribir sus requisitos al
repositorio es prioritario, y hasta entonces cualquier "requisito
contractual" que citemos es una cita indirecta.

---

## 2026-07-24 — La documentación de entrega no es fuente de verdad

La migración `011` con `lat`, `lng` e índice geo, declarada en
`docs/PROJECT_STATUS.md`, **no existe**. Verificado: hay 10 migraciones
(`001`–`010`), ninguna menciona coordenadas, y `product.py` no las tiene.
`PM_ROADMAP.md` ya lo marcaba como sospecha; queda confirmado.

Consecuencia: el estado declarado en la documentación de entrega se trata
como afirmación no verificada hasta que exista evidencia end-to-end. El
alcance vinculante es `PM_ROADMAP.md` v3.

---

## 2026-07-24 — El objetivo activo es la Fase 0, no un MVP navegable

Se corrige el objetivo que figuraba antes en `NOW.md`. Nadie ejecutó el
código todavía: no hay evidencia de build, migraciones, seed ni smoke
tests. Planificar features sobre eso es especular.

Motivo: el roadmap v3 condiciona todas las fases siguientes a la
aprobación de la línea base, y la auditoría del `011` muestra por qué.

---

## 2026-07-24 — Adoptar `docs/pm/` como contexto de trabajo

Se crea la estructura `NOW.md`, `PROJECT.md`, `REPO_MAP.md` y
`DECISIONS.md` para trabajar sin recorrer el repositorio completo en cada
sesión.

Motivo: la documentación de entrega es extensa y descriptiva; hacía falta
una capa corta y actualizable que diga en qué estamos.

---

## Heredadas de la entrega Fase I (2026-06-04)

Decisiones tomadas por el equipo anterior que siguen vigentes. No fueron
revisadas por el equipo actual.

- **Split payment con Mercado Pago Marketplace**, 5 % de comisión
  configurable. Moneda única ARS.
- **Vendedor y comprador no son roles separados.** Los roles en base son
  `admin` y `user`; cualquier usuario puede publicar y comprar.
- **Mercado Pago se entrega desvinculado**, con todas las variables `MP_*`
  vacías. Motivo declarado: seguridad en el traspaso.
- **Imágenes en filesystem local** (`/data/uploads`) en lugar de S3 o
  Cloudinary. La entrega lo marca como no apto para producción.
- **Navegación por estado en `App.tsx`**, sin `react-router`.
  Consecuencia: no hay URL por producto.
- **Los módulos de Fase II quedan integrados a medio terminar** en vez de
  removidos, porque están entrelazados en migraciones, modelos y UI.
  La decisión sobre cada uno queda abierta para el equipo actual.

---

## Pendientes de decidir

Sin resolver. Cada una debería cerrarse con una entrada arriba.
Ordenadas por cuánto bloquean.

1. **PostgreSQL + PostGIS, o cambio contractual aprobado por escrito.**
   El contrato lo exige; el código usa SQL Server. Es Fase 2 y es caro.
   Hay que decidirlo antes de empezarla, no durante.
2. **Qué se hace con cada módulo de Fase II** (ratings, servicios,
   subcategorías, form options): completar, ocultar o remover. Están
   entrelazados en migraciones, modelos y UI; no se apagan con un flag.
3. **URLs por producto:** decidido por Emi el 2026-09-23; ver la entrada
   `PRODUCT-DETAIL-PAGE-1` arriba. Implementada y aceptada en rama; aún sin
   integrar ni desplegar.
4. **Alcance del rol transportista** en el MVP: selección directa,
   cotización, o ambas.
