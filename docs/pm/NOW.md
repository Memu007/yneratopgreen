# Estado actual

Actualizado: 2026-08-24.

## Relevo inmediato — leer primero

- Contexto Inera: el Second Brain institucional quedó integrado en
  `Memu007/ynerasecondbrain`, `main` `f34627e`, el 2026-08-15. TopGreen sigue
  siendo la fuente de verdad para contrato, cronograma, estado y tareas. El
  puente en el `AGENTS.md` raíz está pendiente; una PM no debe instalarlo porque
  sólo edita `docs/pm/`. Ante “ponete al día con Inera”, consultar además ese
  repo; ante “ponete al día”, manda el onboarding local.
- GitHub: la documentación de vendedores quedó aceptada: producto `b8fee0e`,
  cierre `9988879` e informe `bbb0d2d`. Los dos bordes de la primera revisión
  quedaron cerrados. La PM sólo debe editar `docs/pm/` y contrastar el commit
  actual al ponerse al día.
- Cronograma: firma confirmada por Emi el 22/08. Se conserva el ancla contractual
  acordada: viernes 21/08, primer día de la semana 1. Fase 1 corre hasta el 03/09;
  las doce semanas cierran el 12/11 y el colchón el 26/11. El producto está
  adelantado en Fase 4 sin habilitar producción ni el hito final.
- Orden acordado: antes de la firma la Dev sólo prepara una simulación UX
  aislada de logística, autorizada por Emi; no modifica producto. PM puede
  relevar UX y hacer una única prueba MP con sesiones aisladas. Tras la firma:
  UX de recorridos principales, pulido de logística, hito intermedio, pagos en
  su fase y finalmente seguridad, responsive, QA, producción y capacitación.
- Avance por dimensión, revisado el 22/08: funcionalidad MVP **~88–90 %**;
  preparación productiva **~75–80 %**; avance contractual combinado
  **~82–85 %**. Pagos **~85 %**. Código MP-A/B/C aceptado; homologación
  externa MP-D incompleta. Hito intermedio aceptado; hito final no. El antiguo
  **~89 %** describía funcionalidad, no una entrega lista para producción.
- Entorno descartable: frontend `https://ynerav.up.railway.app`, Backend
  `https://backend-production-ba84.up.railway.app`, Railway
  `strong-playfulness`. Último cierre verificado: despliegue Backend
  `ab617231-9b78-46c3-8e0f-205cd6ee9037` en `SUCCESS`, `/api/health` HTTP 200,
  migración limpia y aplicación iniciada. Incluye el cierre CSRF `6ece3fb` y el
  hotfix previo `python-multipart==0.0.31`. La bandera de pagos no se modificó.
- Mercado Pago: aplicación `TopGreen Agro Argentina`, ID `2410255372643376`.
  Webhook de prueba y variables están cargados; secretos sólo en Railway, nunca
  en Git. La cuenta real de Emi quedó **desvinculada** del vendedor demo.
- Tres órdenes de ensayo quedaron canceladas y cerradas, sin pago:
  `ORD-20260814-BFBDF01F`, `ORD-20260814-8400E59A` y
  `ORD-20260814-630AEE45`. La tercera ya usó vendedor y comprador de prueba,
  creó una preferencia real y llegó a la revisión de ARS 18.500. Mercado Pago
  devolvió su error genérico tanto con la tarjeta guardada como con la Visa
  oficial nueva, titular `APRO`; no emitió pago ni Webhook. Verificación final:
  orden/pago `CANCELLED`, cero intentos MP, reserva liberada, link cerrado,
  stock 240, reservado 0 y ventas 0.
- Bloqueo actual: repetir únicamente la compra aprobada en una ventana de
  incógnito, manteniendo separadas las sesiones del integrador/vendedor y del
  comprador. La guía oficial de Checkout Pro lo exige para evitar duplicidad
  de credenciales; el ensayo fallido cambió ambas cuentas en el mismo perfil
  del navegador. Si falla también aislado, capturar la actividad de la cuenta
  MP y recién entonces decidir una devolución a Dev.
- Dev: los tres datos logísticos quedan aceptados en `0395d67` + `4a57722`.
  Hotfix `python-multipart` aceptado en `b496ed4` y desplegado por PM. La
  auditoría CSRF `717f40b` reprodujo una escritura multipart entre sitios sin
  token robado. Base de cierre CSRF `6ece3fb`: Bearer header-only para API y
  refresh, cookie `SameSite=None` sólo leída por el callback MP. Corrección de
  comentarios `0f330a7` aceptada y desplegada. UX-1 `e701cb4` conserva flujos y
  puertas, pero **no fue aceptada visualmente**: se percibe genérica y con
  aspecto de AI slop. UX-2A queda **en pausa antes de empezar**: Emi y PM
  definirán primero la identidad de TopGreen —personalidad, tipografía, color,
  fotografía y voz— y recién entonces se dará una dirección aprobada a la Dev.
  La Dev queda sin tarea activa y no debe crear una skill ni otro mockup a ciegas.
- Dirección de marca: Emi asignará una cuenta separada con GPT-5.6 Sol en
  razonamiento muy alto como diseñadora premium. Su brief está en
  `docs/pm/BRIEF-DISENO-PREMIUM.md`: primero estrategia y benchmarking; después
  dos direcciones visuales; finalmente handoff a Opus. La Dev continúa pausada.
- Puertas de marca: la estrategia `La operación a la vista` queda aceptada y
  Emi eligió **B — Mesa de negocios**. La decisión y ocho condiciones están en
  `docs/pm/diseno-premium/DECISION-PUERTA-2.md`. La diseñadora debe cerrar
  Puerta 3 —wordmark propio, sistema, catálogo denso y cuatro anatomías— antes
  de que Opus reciba una implementación. B todavía no es diseño final.
- El handoff obligatorio para la Dev está en
  `docs/pm/diseno-premium/REQUISITOS-HANDOFF-DEV.md`: identidad y activos
  utilizables, tokens, cuatro anatomías, componentes/estados, tres viewports,
  prototipos aislados y mapa contra el producto real. Opus no empieza con
  láminas sueltas ni completa decisiones de diseño por su cuenta.
- Handoff Puerta 3 `8bd91d7`: completo en alcance y conforme en dirección, pero
  todavía no aceptado. La revisión independiente está en
  `handoff/REVISION-PM-8bd91d7.md`: axe encontró contraste serious en los
  índices `02/03` y en el texto de publicación pausada, y la regla táctil de
  44×44 está escrita de forma más absoluta que la implementación. Diseño debe
  corregir sólo esos bordes; Opus sigue pausada.
- Corrección de Diseño `344dbe9`: PM reprodujo axe en los tres prototipos y los
  tres viewports, **9/9 sin violaciones, errores ni overflow**. Los dos bloqueos
  quedan técnicamente cerrados. Puerta 3 espera únicamente la aprobación visual
  explícita de Emi del wordmark y sistema B; Opus continúa pausada hasta ese sí.
- **Puerta 3 aprobada:** Emi confirmó visualmente B — Mesa de negocios el
  2026-08-23. PM ya había cerrado 9/9 auditorías en `833ee0e`. Opus deja de estar
  pausada y recibe UX-2B en Extra: implementar el handoff por capas, preservar
  funciones, resolver semántica explícita de las cuatro anatomías y pasar todas
  las puertas antes de desplegar. La diseñadora vuelve a quedar sin tarea.
- UX-2B queda **aceptada técnicamente por PM**: base `08907cd`–`873ad2e`, cierre
  `177cdb2`, informes `8943143`/`6b9bd1d`. La corrección cierra el cruce entre
  `publication_type` y categoría, panel por anatomía, foto opcional, offline y
  zoom 200 %, y retira los mocks con Unsplash. PM reprodujo build aislado, lint,
  sintaxis y checks estáticos; la Dev informa suite 123/123 y puertas visuales
  completas desde base limpia. **Emi rechazó parcialmente la revisión visual**:
  Inicio y Servicios conservan la composición vieja, la masa índigo no se
  siente agro y el tratamiento tapa la fotografía. La devolución y la nueva
  pieza de Diseño están en `diseno-premium/DEVOLUCION-EMI-UX2B.md`. La Dev
  queda sin tarea y no abre UX-3 ni despliega hasta recibir un nuevo handoff.
- **Extensión comercial aprobada:** Emi comparó A/B y eligió **A — Mercado a
  cielo abierto**. Diseño entregó en `diseno-premium/extension-comercial/`
  prototipos de Inicio, Servicios y Mercado, tokens, copy, fotografía, activos,
  tres viewports, mapa, paridad y auditoría axe 9/9 sin violaciones/overflow.
  La tarea activa vuelve a Dev como **UX-2C** según el último bloque de
  `PARA-DEV.md`. B queda archivada; no se reabren wordmark ni anatomías y no se
  despliega hasta revisión PM/Emi.
- **Revisión PM de la extensión `0a05a0a`:** apta para implementar UX-2C, no
  todavía para publicación. La verificación independiente está en
  `diseno-premium/extension-comercial/REVISION-PM-0a05a0a.md`. Quedan como
  puertas de salida la cesión/autoría de las dos fotos fuente y el reemplazo
  final de la foto interina de Servicios. Conteos, cards y fotos conceptuales
  del HTML no pueden copiarse al producto.
- **UX-2C aceptada técnicamente pero rechazada visualmente por Emi:** base `cae6855`–`ddcd1ff`, corrección de
  escala `35eaf30`, informes `e095ab8`/`d904329`. El filtro opcional
  `publication_type` se aplica antes de contar/paginar; preview y Mercado ya no
  pueden dar un vacío falso por mirar sólo los primeros 100. PM reprodujo
  build, lint, sintaxis y checks estáticos; Dev informa suite 126/126 y puertas
  completas. Docker local sigue apagado. En la revisión local Emi determinó que
  crema + rojo óxido + serif dominante se perciben como un diario, no como agro.
  La devolución está en `diseno-premium/DEVOLUCION-EMI-UX2C.md`. Se preserva la
  implementación y vuelve sólo color/tipografía/señalética a Diseño; Dev queda
  pausada y no se despliega. Paginación y conteo visible >100 quedan registrados
  en `ux2c/DEUDA-PAGINACION.md`, fuera de este cierre.
- **Prueba Ox Alpha autorizada:** antes de volver a la diseñadora o a Dev, Ox
  debe demostrar criterio sobre un alcance mínimo. El contrato está en
  `diseno-premium/PRUEBA-OX-ALPHA.md`: tres variantes navegables A/B/C del mismo
  primer viewport real de Inicio, usando copy/foto/acciones existentes y sin
  tocar `src/`, producto o despliegue. La puerta visual se evalúa en navegador
  con Emi; si ninguna variante evita diario, banco, SaaS IA y eco genérico, se
  detiene sin ampliar al resto del sitio.
- Seguridad operativa: nunca pagar si el checkout muestra la cuenta real,
  tarjetas reales o el nombre Emiliano. Encender la bandera sólo para una orden
  controlada; al terminar dejarla en `false`, esperar `SUCCESS`, comprobar
  health y verificar base. No usar `railway up` desde la raíz para Backend,
  `railway down` como rollback ni `restart` durante un despliegue.

## Entrega aceptada y tarea actual

UX-2B queda aceptada técnicamente con producto `08907cd`–`873ad2e`, corrección
`177cdb2` e informes `8943143`/`6b9bd1d`. Las cuatro anatomías salen de datos
persistentes y no se reabren. La devolución visual posterior de Emi ya tiene
dirección aprobada: **A — Mercado a cielo abierto**, documentada completa en
`diseno-premium/extension-comercial/`. Dev tiene como tarea activa UX-2C:
implementar Inicio, Servicios y la coherencia cromática/fotográfica del Mercado
sin tocar Backend, pagos ni funciones. Diseño auditó sus prototipos 9/9 con axe,
sin errores ni overflow; Dev debe repetir puertas sobre el producto y frenar
antes de desplegar.

Los datos logísticos validados quedan **aceptados**: producto `0395d67`, cierre
de normalización `4a57722` e informe final `580f254`. Marca/modelo y cargas se
muestran antes de elegir; el dominio no existe en el contrato ni en la consulta
de candidatos y aparece con el contacto tras selección válida. Las cargas no
filtran ni reordenan. El caso 115 cierra el detalle huérfano de «Otra» por alta,
edición, API y SQL. PM verificó normalizador, build, sintaxis y checks estáticos;
la Dev informa suite 115/115 y conserva puertas visuales previas.

El hotfix de `python-multipart` queda **aceptado en código**: dependencia
`b496ed4`, informe `0bad6a0`. El pin pasa de `0.0.6` a `0.0.31`, mínima versión
sin avisos registrados por PyPI al 22/08. La Dev informa instalación limpia,
`pip check`, recorridos de imagen, comprobante y documentación, y suite 115/115;
PM confirmó fuentes oficiales, sintaxis y diff. **Cierre operativo 22/08:** PM
desplegó una copia temporal verificada de `backend/` desde `main` `38270de`, sin
alterar Git ni los volúmenes. Railway aplicó las migraciones pendientes, marcó
`c73a0f2b-4a03-423a-a074-99bdf9c6cf77` como `SUCCESS`, instaló explícitamente
`python-multipart-0.0.31` según el log de build y `/api/health` respondió 200.
Dos intentos previos no se promovieron: `c0907885` fue `SKIPPED` por el filtro
`/backend/**`; `c90f36bb` tomó el manifiesto raíz del frontend y quedó `FAILED`
por healthcheck. El Backend anterior permaneció activo. Lección: para una carga
CLI aislada usar una copia temporal de `backend/` con el `watchPatterns`
omitido; nunca ejecutar `railway up` desde la raíz del repo apuntando a Backend.

La consulta CSRF `717f40b` queda aceptada en su hallazgo y corregida por PM en
la ejecución: no se elimina `credentials: include`, porque el frontend y Backend
son orígenes distintos y login/refresh/logout necesitan respetar `Set-Cookie`;
además `/auth/refresh` queda explícitamente header-only. La base `6ece3fb`
mantiene Bearer/localStorage para toda API protegida y sólo permite leer la
cookie desde el callback MP con `state`. `SameSite=None` permanece porque
`up.railway.app` es un sufijo público y el navegador descarta `Lax` en el login
cruzado; la defensa CSRF es estructural, no el atributo. Sin token CSRF,
`Origin` global, revocación ni CSP en esta pieza. Producto `6ece3fb`, comentarios
`0f330a7` e informes `6264fa2`/`e1185b3` quedan **aceptados**. PM reprodujo
build, sintaxis Python, revisión de lectores de cookie, `node --check` y
`diff --check`; la Dev informa suite 117/117 desde base limpia. Docker local de
PM sigue apagado, por lo que esa suite no fue repetida independientemente.
**Cierre operativo 22/08:** PM desplegó únicamente el Backend desde una copia
aislada, sin `watchPatterns`; Railway promovió
`ab617231-9b78-46c3-8e0f-205cd6ee9037` a `SUCCESS`, ejecutó Alembic sin error,
inició la aplicación y `/api/health` respondió HTTP 200. La corrección ya está
activa en el entorno descartable.

El prototipo logístico queda **aceptado**: base `8002fea`, corrección `c26495d`
e informe `ee2fefb`. PM completó el comprador y el alta, reprodujo el primer
clic corregido en escritorio y 390×844, confirmó los valores exactos en el
resumen, cero corte móvil y cero errores de consola. Es una simulación aislada:
no agrega todavía marca/modelo, dominio separado ni cargas permitidas al
producto real. PM decidió que los tres entran después de la firma con alcance
mínimo: marca/modelo visible, dominio posterior a la selección y cargas sólo
informativas. No se agrega cotización, reserva, pago ni seguimiento del flete.

La documentación manual de vendedores queda **aceptada**: producto base
`b8fee0e`, cierre `9988879` e informe `bbb0d2d`. Es informativa y no bloquea
registro, publicaciones, checkout ni cobros; sólo una presentación aprobada
muestra «Documentación revisada». La aprobación obsoleta tras reemplazo queda
cerrada por versión de presentación y la configuración falla si los PDF caen
dentro del árbol público. PM obtuvo build y controles estáticos verdes y
reprodujo el rechazo de configuración; la Dev informa suite 110/110 y
migraciones verdes. No hay tarea nueva para Dev antes de la firma.

La cobertura accesible de perfiles y administración quedó aceptada el
2026-08-11: producto `6fd060d`, informe `1f7150f`. La Dev objetó correctamente
la cuenta pedida por PM: lectura y edición del transportista en dos medidas
agregan cuatro recorridos, por lo que el inventario correcto es 50, no 48.

La PM compiló el frontend, desplegó el Backend en Railway, corrió el seed dos
veces y reprodujo el barrido completo contra el entorno público: **50/50**, cero
violaciones de cualquier impacto. La primera corrida del seed creó el cuarto
usuario transportista y la segunda reconoció el existente. Las tres tablas
móviles de administración y las vistas de transportista pasaron. La dev
informa además suite 41/41 e idempotencia contrastada por SQL.

**Hallazgo operativo:** el frontend se desplegó automáticamente desde `main`,
pero Backend siguió sirviendo el commit anterior. Para probar esta entrega la
PM tuvo que desplegar Backend manualmente. El entorno sigue siendo descartable;
no se puede usar su estado verde como prueba de que los próximos cambios de
backend se publicaron.

La Pieza B de logística queda **aceptada**: producto inicial `e3fe9cb`, cierre
de identidad `93ea92c` e informe final `8dc9543`. Los casos 43, 45, 47 y 48 ya
fuerzan carrito visible, desmontaje, orden inverso y cambio de cuenta. La PM
revisó el flujo y obtuvo build independiente verde. La suite completa no pudo
arrancar en el entorno PM porque Docker sigue apagado; la dev informa 48/48 y
la revisión del código de las regresiones no encontró preparación artificial.

El conflicto de credenciales queda **aceptado**: producto `70b0d7b`, informe
`ce5ae84`. Cookie y Bearer distintos reciben 401 antes de resolver identidad o
escribir; la misma regla cubre access, refresh y la dependencia opcional. La PM
obtuvo build independiente, sintaxis Python y `diff --check` verdes. La dev
informa suite 50/50; no se repitió accesibilidad porque no cambió interfaz.

La Pieza C de logística queda **aceptada**: producto inicial `ecfaa4c`, cierre
`a960eef` e informe final `75379a2`. La respuesta tardía de selección ya no
restaura contacto descartado y cada ítem congela el origen oficial usado al
comprar. Las regresiones 56–58 fuerzan los defectos anteriores. La PM obtuvo
build, sintaxis Python y `diff --check` verdes; la dev informa suite 58/58,
accesibilidad 56/56 y contraste 40/40.

La puerta conjunta del hito intermedio queda **aceptada**: producto inicial
`1e8822d`, cierre `3580faa` e informe `803e8e9`. El catálogo se sincroniza con
la respuesta filtrada y contrasta pantalla, API y SQL aun retrasándola 2,5 s;
la operación se comprueba dentro de la tarjeta exacta recién creada. Las dos
fallas forzadas discriminan los falsos positivos anteriores. La PM obtuvo
build, sintaxis y `diff --check` verdes. La ruta oficial desde base limpia no
pudo repetirse porque el Docker local de PM está apagado; la Dev informa
puerta 6/6 y suite 58/58 desde base recreada.

**El hito intermedio queda habilitado para presentar y cobrar.** La evidencia
une catálogo, búsqueda y geolocalización funcional en un único recorrido.

El contrato monetario previo a Fase 4 queda **aceptado**: producto `2220e94` e
informe `8abaeb2`. Ambos checkouts, carrito y opciones de transferencia calculan
y persisten con `Decimal`; los casos 59–61 discriminan `0,10 × 3`, el rango alto
y la atomicidad multivendedor contra el código anterior. La PM obtuvo build,
sintaxis Python, comprobación directa de los dos importes y `diff --check`
verdes. La Dev informa suite 61/61 y puerta del hito 6/6 desde base recreada.

**Decisión de producto cerrada por PM:** el carrito no reserva precio. Rige el
precio publicado al confirmar; la orden lo congela. Antes de pagar siempre debe
mostrarse el total vigente. Es la opción mínima que no obliga al vendedor a
honrar carritos abandonados indefinidamente.

La PM releyó el PDF original: se prometió checkout básico de Mercado Pago para
crédito, débito y dinero en cuenta, pero el documento **no define quién recibe
los fondos ni prohíbe OAuth**. «Sin OAuth de vendedores» era una interpretación
interna de alcance, no una condición ofrecida a la clienta. Que cobre cada
vendedor sigue siendo preliminarmente la opción más segura porque TopGreen no
custodia ni redistribuye dinero, y puede ser el mecanismo técnico necesario
para cumplir lo prometido, no una función comercial adicional.

El análisis técnico de la Dev `925de4e` queda **aceptado con una corrección**.
OAuth por vendedor es más seguro que hacer cobrar a TopGreen y trae ciclo de
vida de tokens, cifrado, revocación, webhooks firmados y un pago por vendedor.
Pero Mercado Pago no es sólo «conversión» postergable: el PDF lo incluye
explícitamente. OAuth con comisión de marketplace cero es la implementación
mínima segura de ese requisito ya vendido, no una ampliación funcional.

La PM confirmó en documentación oficial que Checkout Pro de marketplace exige
el token OAuth de cada vendedor; la comisión normal de Mercado Pago se descuenta
al vendedor; `marketplace_fee: 0` es válido; y Checkout Pro sigue usando
`/checkout/preferences`. La nueva API Orders corresponde a Checkout API, no
reemplaza las preferencias de Checkout Pro. El modelo general es 1:1; un carrito
con varios vendedores requiere un pago por orden salvo acceso comercial al
modelo 1:N.

**Decisión confirmada por Emi:** cada vendedor vincula Mercado Pago, cobra
directamente y paga la comisión normal; TopGreen cobra comisión cero. Un carrito
multivendedor requiere un pago por orden/vendedor. Estas dos consecuencias se
informan a la clienta como funcionamiento del requisito, no como adicional.

La Pieza MP-A queda **aceptada**: producto inicial `5aee032`, corrección
`e5cb94e` e informes `81f89ce` y `38a952b`. El vínculo OAuth usa state opaco de
un solo uso, credenciales cifradas, cuenta MP única por vendedor y salidas
accionables; `manual-link` desapareció. La corrección exige exactamente `1`
para descartar tokens heredados, trata una clave Fernet inválida sin 500 y
consume también el intento cancelado.

La Dev informa suite **74/74**, hito 6/6, accesibilidad 56/56 y contraste 40/40.
PM confirmó build, sintaxis Python, los tres discriminantes por código y
`diff --check`. Docker local sigue apagado, por lo que PM no repitió la suite
integral. No hay preferencias ni cobros: `payments.py` sigue desmontado.

**Tarea abierta entonces:** Pieza MP-B, contrato plural y preferencias de
Checkout Pro contra el doble local, con activación productiva cerrada hasta
MP-C. Un vendedor sin vínculo MP conserva transferencia y catálogo; el checkout
resuelve el medio por grupo de vendedor.

Primera entrega MP-B `c671a4c` e informe `1bc3d08`, **todavía no aceptados**.
La arquitectura, bandera apagada, preferencia sin comisión y contrato plural
quedan conformes; PM verificó build, sintaxis y `diff --check`. Vuelve por tres
defectos: confirmar el mismo carrito en paralelo puede duplicar órdenes, una
orden terminal todavía devuelve/crea link y «Mis compras» no permite recuperar
un pago interrumpido. MP-C no se abre.

La corrección MP-B `fe4a0b2` e informe `64b0bd3` cierran esos tres defectos;
PM verificó build, sintaxis y `diff --check`. **Todavía no se acepta MP-B** por
un único borde bloqueante descubierto en la revisión: la ruta general de cambio
de estado referencia `old_status`, variable inexistente, al cancelar o rechazar
y puede responder 500. La suite 84/84 informada usa la ruta específica de
cancelación y no lo cubre. La Dev tiene una corrección acotada y una regresión
por esa ruta; MP-C continúa cerrada.

La Pieza MP-B queda **aceptada**: producto final `abebedb` e informe `c406a4b`.
El caso 85 atraviesa las dos salidas terminales por `PATCH /orders/{id}/status`
y cubre respuesta, persistencia, intención local, stock y cierre del pago. PM
confirmó la corrección, la discriminación contra `fe4a0b2`, sintaxis Python y
`diff --check`; Docker local sigue apagado, por lo que la ejecución 85/85 y las
demás puertas son evidencia informada por la Dev.

**Tarea activa hasta esta revisión:** Pieza MP-C, verdad de pago por webhook firmado,
transiciones idempotentes y política segura de stock/vencimiento contra el doble
local. La Dev continúa en **Extra**. La bandera productiva permanece apagada:
esta pieza no autoriza credenciales reales, Railway ni cobros.

Primera entrega MP-C `9fa0eaf` e informe `4199aab`, **todavía no aceptados**.
La base es sólida —firma HMAC, consulta al cobrador, intentos, reserva atómica,
estado visible y reconciliador— y PM obtuvo build, sintaxis y `diff --check`
verdes. La suite 93/93 es evidencia informada por la Dev porque Docker local de
PM sigue apagado. Vuelve por seis bordes no cubiertos: reserva sin intención
local cuando falla la primera preferencia, `notification_url` contrario al
modo Webhook oficial, cancelación de una orden MP ya pagada, edición de stock
por debajo de lo reservado, preferencia viva/doble aprobación y pérdida del
bloqueo dentro del reconciliador. Producción y bandera siguen cerradas.

La Pieza MP-C queda **aceptada**: corrección principal `b47ae14`, cierre
transaccional `39c3907`, corrección de doble cobro `98ca684` e informe final
`0f9646b`. La intención y su vencimiento nacen con la reserva; el Webhook se
autentica antes de leer el cuerpo y usa la URL oficial; una orden cobrada no se
cancela; el stock no baja de lo reservado; el primer cobro cierra el link y
dos cobros quedan visibles en revisión; el reconciliador conserva el candado
hasta decidir. La Dev agregó regresiones 94–99 y encontró/corrigió además dos
fallas propias antes del cierre.

PM verificó el diff de código y las seis regresiones, compilación frontend,
sintaxis Python y `diff --check`. Docker local sigue apagado, por lo que la
suite 99/99, hito 6/6, migración y puertas visuales son evidencia informada por
la Dev, no repetida por PM.

**MP-C no habilita producción.** La bandera sigue apagada y Railway no se
tocó. El próximo portón es MP-D: homologación contra Mercado Pago de prueba,
URL pública firmada y reconciliación programada en el Railway descartable. No
se usan compradores ni dinero reales y no se activa producción sin una
aceptación nueva de PM y autorización explícita de Emi.

**Tarea activa única:** MP-D, preparar la homologación real sin ejecutarla. La
Dev continúa en **Extra** y debe volver a PM antes de tocar Railway o usar
credenciales de prueba.

Primera entrega MP-D `86d755b` e informe `b8d69cd`, **todavía no aceptados**.
El runbook reproducible y el caso 100 de dos reconciliadores solapados quedan
bien encaminados; no hubo código de producto, credenciales, Railway ni bandera.
La Dev frenó correctamente ante el bloqueo de documentación de su entorno.

PM sí pudo consultar las fuentes oficiales vigentes el 14/08 y devolvió una
corrección documental acotada: el panel de la aplicación debe configurar URL
de prueba, evento Pagos y guardar para generar el secreto; el checklist de
marketplace debe distinguir integrador, vendedor y comprador; y el runbook
debe incorporar los contratos ya confirmados sin dejar `[VERIFICAR]` genéricos.
También debe corregirse el comentario viejo del código que todavía afirma que
toda query degrada a IPN, contradiciendo `source_news=webhooks`. MP-D no se
ejecuta ni se abre Railway.

La preparación de MP-D queda **aceptada**: runbook inicial `86d755b`, caso 100
de reconciliadores solapados, corrección documental `13434a4` e informe final
`76611d0`. El panel Webhooks, los tres perfiles, la firma, los campos reales de
pago, el cierre de preferencia y los medios quedaron contrastados con fuentes
oficiales; el comentario técnico falso y el ensayo de aviso perdido quedaron
corregidos sin cambiar comportamiento.

PM confirmó que el único cambio de producto son 11 líneas de comentario y que
el validador permanece intacto; `diff --check` queda verde. La Dev informa caso
95 focal verde y conserva la evidencia previa 100/100. **No hay tarea activa de
Dev:** MP-D queda detenido en una acción humana de Emi —crear/autorizar la
aplicación, vendedor y comprador de prueba, configurar Webhooks y cargar las
variables en el Railway descartable— y en una orden explícita posterior para
ejecutar. La bandera sigue apagada y no se movió dinero.

**Avance externo verificado por PM el 2026-08-14:** se creó en la cuenta real
de Emi la aplicación separada `TopGreen Agro Argentina`, número
`2410255372643376`, para pagos online, desarrollo propio y Checkout Pro, con el
frontend descartable como sitio de prueba. No se reutilizó ni modificó
`cdiynera`, que pertenece a CDI y apunta a otro despliegue. Mercado Pago ya
tenía dos cuentas argentinas reutilizables, una compradora y una vendedora; no
se crearon duplicados ni se consumieron cupos. El asistente del panel rotuló la
aplicación como Checkout Pro pero mostró «API de Orders» en la confirmación:
antes de homologar debe contrastarse ese rótulo con el contrato implementado
mediante `/checkout/preferences`, sin asumir compatibilidad por el solo alta.
Siguen pendientes Webhooks, secreto y variables de Railway, OAuth del vendedor,
ejecución de pagos de prueba y cualquier activación productiva. No se cargaron
secretos en el repositorio, no se tocó Railway y no se movió dinero.

**Duda del rótulo cerrada por PM el 2026-08-14:** la
[guía oficial vigente de Checkout Pro](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/create-application)
indica exactamente el alta realizada —pagos online, desarrollo propio,
Checkouts y Checkout Pro— y su paso siguiente documentado es crear una
preferencia. La referencia oficial conserva
[`POST /checkout/preferences`](https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-pro/preferences/create-preference/post)
y
[`PUT /checkout/preferences/{id}`](https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-pro/preferences/update-preference/put)
dentro de Checkout Pro. El panel de la aplicación terminada también la
identifica como «Integración con CheckoutPro».
Por estas tres señales concordantes, «API de Orders» en el resumen del asistente
no obliga a cambiar el contrato implementado. No se hizo una llamada con el
token porque ya no era necesaria para resolver la clasificación y habría
ampliado el uso autorizado de credenciales sin aportar una decisión distinta.

**Preparación externa completada por PM el 2026-08-14, sin homologar:** Emi
autorizó y realizó los consentimientos humanos; la aplicación conserva la URL
OAuth `https://backend-production-ba84.up.railway.app/api/mp-oauth/callback`.
Webhooks quedó configurado en modo de prueba con
`https://backend-production-ba84.up.railway.app/api/mp/webhook` y el evento que
el panel vigente denomina **«Pagos (legacy)»**; no se seleccionó «Order (Mercado
Pago)» porque el contrato implementado recibe avisos de pagos y consulta
`/v1/payments`. Para poder obtener Client ID/Secret, Emi activó las credenciales
productivas desde el panel; esa activación habilita capacidad técnica pero no
movió dinero ni enciende TopGreen por sí sola.

Railway `strong-playfulness`, servicio Backend, entorno `production`, recibió
las once variables previstas: `FRONTEND_URL`, `MP_APP_ID`,
`MP_CHECKOUT_HABILITADO`, `MP_CLIENT_SECRET`, `MP_MINUTOS_DE_GRACIA`,
`MP_MINUTOS_DE_VIGENCIA`, `MP_NOTIFICACION_URL`, `MP_REDIRECT_URI`,
`MP_TOKEN_KEY`, `MP_TOLERANCIA_FIRMA_SEGUNDOS` y `MP_WEBHOOK_SECRET`. Las tres
secretas viajaron directamente a Railway, nunca a Git ni al chat; los archivos
temporales de transferencia se eliminaron y los valores se limpiaron de la
sesión. La comprobación posterior devolvió los once nombres y
`MP_CHECKOUT_HABILITADO=false`. Todas se cargaron con despliegues omitidos: no
se reinició Backend, no se ejecutaron migraciones, no se vinculó al vendedor,
no se corrió el guion MP-D y no hubo pagos. El próximo paso requiere una orden
separada de Emi para desplegar/homologar.

**MP-D ejecutado parcialmente por PM el 2026-08-14, sin pago:** Emi dio la
orden separada para homologar en `strong-playfulness`, exclusivamente con
cuentas y datos de prueba. Backend quedó desplegado con el manifiesto correcto
(`Dockerfile.railway`, migración previa y salud en `/api/health`) y la cuenta
TopGreen `vendedor@ejemplo.com` quedó vinculada por OAuth a una cuenta que en
ese momento se creyó vendedora de prueba. La interfaz confirmó que el vendedor
cobra en su propia cuenta y que TopGreen no recibe ni retiene el dinero. La
segunda ejecución descrita abajo demostró que la cuenta vinculada era en
realidad la cuenta productiva de Emi; esta afirmación queda corregida y no se
usa como evidencia de homologación.

PM encendió temporalmente `MP_CHECKOUT_HABILITADO`, entró como la compradora de
prueba de TopGreen y creó la orden `ORD-20260814-BFBDF01F` por ARS 18.500 sobre
`Insecticida Lambda Cihalotrina 1L`. Mercado Pago generó la preferencia en la
cuenta vinculada del vendedor; antes de pagar, la base mostró orden `PLACED`,
reserva `reservada`, pago `PENDING`, preferencia presente, ningún `payment_id`,
stock 240, reservado 1 y ventas 0. El checkout mostró producto e importe
correctos.

La sesión de Mercado Pago abierta en el navegador resultó ser la cuenta real de
Emi y mostró sus medios reales. PM lo detectó antes de cualquier acción de
pago, no pulsó «Pagar» y Emi ordenó explícitamente **no comprar**. La orden de
prueba se canceló desde TopGreen: la comprobación posterior en base devolvió
orden y pago `CANCELLED`, reserva `liberada`, `link_cerrado=true`, ningún pago,
stock 240, reservado 0 y ventas 0. Finalmente Railway quedó con
`MP_CHECKOUT_HABILITADO=false` efectivo y Backend respondió HTTP 200. No se
movió dinero ni quedó un enlace de esta orden utilizable.

Por lo tanto, MP-D **no está homologado completo**. Quedaron sin ejecutar el
pago aprobado, Webhook, descuento único de stock, rechazo, reconciliación y
vencimiento. No deben darse por verdes ni delegarse como si ya tuvieran
evidencia real. Para retomarlo hacen falta las dos partes de prueba: vincular
al vendedor de prueba y pagar desde el comprador de prueba. No alcanza con
cambiar sólo al comprador.

**Segundo intento controlado de MP-D, 2026-08-14:** Emi autorizó efectuar un
pago exclusivamente de prueba. PM inició sesión en Mercado Pago como comprador
de prueba, creó la orden `ORD-20260814-8400E59A` por ARS 18.500 y confirmó en
base el estado previo: orden `PLACED`, reserva `reservada`, pago `PENDING`, sin
`payment_id`, stock 240, reservado 1 y ventas 0. El checkout identificó la
sesión como cuenta de prueba y mostró una tarjeta oficial de prueba. Al pulsar
«Pagar», Mercado Pago frenó la operación antes de cobrar con el mensaje de que
una de las partes era de prueba.

La verificación posterior explicó el bloqueo: el vendedor TopGreen estaba
vinculado al MP user `241548475`, correspondiente a la cuenta real de Emi, no a
la cuenta vendedora de prueba. No hubo pago ni Webhook: la orden seguía
`PLACED`, el pago `PENDING`, sin `payment_id`, stock 240, reservado 1 y ventas
0. PM canceló esa orden desde «Mis compras» y comprobó luego orden y pago
`CANCELLED`, reserva `liberada`, `link_cerrado=true`, stock 240, reservado 0 y
ventas 0. También desvinculó la cuenta real del vendedor demo.

Railway terminó el despliegue de cierre en `SUCCESS`, Backend respondió HTTP
200 y `MP_CHECKOUT_HABILITADO=false` quedó efectivo. La protección de Mercado
Pago y la cancelación segura de TopGreen funcionaron; el pago aprobado,
Webhook, descuento de stock, rechazo, aviso perdido y vencimiento continúan sin
evidencia externa. No hay corrección de producto asignada a Dev: el siguiente
paso es una acción humana de PM/Emi, entrar al panel integrador, obtener la
cuenta **vendedora** de prueba ya creada, vincularla por OAuth y repetir el
guion con el comprador de prueba.

**Incidentes operativos de esta ejecución:** el primer intento de desplegar
Backend desde la raíz aplicó por error el manifiesto del frontend. PM lo
detectó antes de OAuth o pagos; al retirarlo también se retiró el despliegue
Backend sano y hubo un 404 breve. Se recuperó desde una copia temporal que
contenía sólo `backend/`, sin alterar Git ni los volúmenes. Más tarde, durante
el encendido temporal, Railway demoró el reemplazo y una orden de reinicio que
la CLI reportó como fallida terminó apagando el contenedor recién sano; hubo un
502 transitorio y se recuperó mediante un redeploy del mismo artefacto. La base
y los archivos persistentes no se perdieron. Lección operativa: no usar
`railway up` desde la raíz para Backend, no usar `railway down` como rollback y
no pedir `restart` mientras un despliegue todavía está cambiando de estado.

## Ensayo Railway descartable — Gate A y Gate B cerrados

**Cerrado por PM el 2026-08-10.** Emi declaró descartable el proyecto Railway
`strong-playfulness` y autorizó usarlo. Queda encendido para inspección y no se
elimina nada sin una autorización nueva. No es producción ni habilita el hito
final.

Evidencia comprobada, no inferida del estado verde de Railway:

- Git estaba limpio en `df6c8d3`; Gate A ya estaba cerrado en Docker aislado.
- Proyecto `049653ee-c04f-46e7-9a58-dde7ff926915`, plan Hobby, con tres
  servicios `SUCCESS`: Frontend `yneratopgreen`, Backend y PostGIS 16 + 3.4.
- Frontend: `https://ynerav.up.railway.app`. Backend:
  `https://backend-production-ba84.up.railway.app`; `/api/health` devuelve JSON
  de producción, no el HTML del SPA.
- El PostGIS inicialmente no arrancaba aunque Railway había marcado el servicio
  anterior como exitoso: el volumen aportaba `lost+found`. Se corrigió sólo en
  Railway con `PGDATA=/var/lib/postgresql/data/pgdata`; los registros confirman
  inicialización de PostGIS y base lista para conexiones.
- Migraciones de pre-deploy y backend quedaron operativos. El seed corrió dos
  veces: la primera creó 4.028 localidades y 30 publicaciones; la segunda
  reconoció todos los datos existentes y no duplicó.
- El frontend se recompiló con la API y las imágenes del Backend. En la web
  pública cargaron 30 publicaciones; el filtro Córdoba devolvió 3 y habilitó
  sus localidades; el cruce Córdoba + Riego devolvió correctamente cero.
- CORS aceptó `https://ynerav.up.railway.app` y rechazó un origen ajeno.
- Registro real con correo demo: se generó el `.eml` en `/data/outbox`, se leyó
  el enlace sin imprimir ni guardar el token, la confirmación respondió 200 y
  el login posterior funcionó. `/verificar-correo` directo tampoco da 404.
- Se subió `topG.png` al volumen Backend. Después de reiniciar el servicio,
  health, la misma imagen, los 30 productos y el login de la cuenta creada
  siguieron respondiendo 200: persisten `/data` y PostGIS.
- Uso medido al cierre: ~1 MB en `/data` y ~112 MB en PostGIS. Son 2 volúmenes
  de 5 GB, dentro del máximo de 10 volúmenes por proyecto Hobby. A los precios
  vigentes, ese almacenamiento ronda USD 0,02/mes; CPU y RAM se cobran por uso
  real y el panel de Railway es la fuente de facturación. Hobby incluye USD 5
  mensuales de uso.
- Backups manuales y programados están disponibles para ambos volúmenes, pero
  no se activó ninguno. Railway los cobra por tamaño incremental como volumen;
  tampoco se habilitó PITR ni se probó una restauración.

Fuentes de límites y costos consultadas el 2026-08-10: documentación oficial de
[precios](https://docs.railway.com/pricing),
[volúmenes](https://docs.railway.com/volumes/reference) y
[backups](https://docs.railway.com/volumes/backups) de Railway.

Hallazgo de producto separado del despliegue: el registro con un dominio de
correo deliberadamente inválido recibe el detalle estructurado de FastAPI pero
la interfaz lo muestra como `[object Object]`. Un correo válido completa el
flujo. Es la tarea activa única para la dev; Gate B no se reabre.

## Cambio de PM, hoy

**Hay PM nueva desde el 2026-08-06.** Es el segundo relevo del rol: la
primera PM es hoy la dev, la segunda fue Sol, y ahora entra la tercera. La
dev no cambia.

**Arranca por `ONBOARDING-PM.md`**, que se reescribió hoy para ella, y
después por este archivo.

Lo que no cambia con el relevo, y es lo importante:

- **El calendario del PDF, reanclado al viernes 21/08.** Ver
  `CRONOGRAMA.md`.
- **Todo lo que está en `DECISIONS.md` sigue decidido.** Discutirlo se
  puede; cambiarlo es decisión de Emi.
- Los dos canales y sus dueños: `PARA-DEV.md` lo escribe la PM, `PARA-PM.md`
  lo escribe la dev, y ninguna toca el archivo de la otra.
- Seguimos adversariales en las dos direcciones.

**La corrección logística `823c3fe` fue aceptada el 2026-08-06**, con
informe `a2e5abb`. El destino editable ya controla candidatos, distancias y
selección; cambiarlo invalida el contacto y vuelve a bloquear el checkout. La
puerta UX/UI de logística de Fase 1 quedó cerrada antes del inicio contractual.
El contraste productivo quedó cerrado el 2026-08-09 con `918c4b9` y su informe
`0d1f1b5`. La PM reprodujo la compilación y la suite oficial 25/25 desde una
base local limpia. `83c4b59` corrigió la identidad visible, `d2063c9` cerró dos
falsos verdes del recorrido y `5924fbb` hizo que cualquier fallo acumulado
impida el éxito final. La cobertura 40/40 y 34/34 y la puerta de accesibilidad
quedan cerradas. `652bc34` dejó el seed bancario demo utilizable desde la
primera instalación y subió la suite a 26/26. La validación de correo quedó
aceptada en `ccc0794`; la tarea activa pasa al ensayo temprano de Railway. La
instalación quedó aceptada con `82c1df8` y `896386a`; la PM completó en
Docker aislado migraciones, seed idempotente, health y persistencia de uploads.
Correo informa 37/37, build y puertas visuales verdes: enlace de 24 horas y un
solo uso, reenvío no enumerable y cero peticiones con el token gracias al
fragmento.

## El proyecto fue aprobado

La clienta dio el visto bueno el **martes 2026-07-28**. Se terminó la
etapa de conseguir el trabajo y empieza la de entregarlo, con el reloj
corriendo.

Cambia el criterio de fondo: hasta ahora se decidía pensando en la
demostración —qué mostrar, qué no—. Desde acá se decide pensando en la
entrega, y todo lo que se construya se va a usar en producción con datos
de gente real.

## El calendario manda, y sale del PDF del socio

Las fases y las semanas del *Documento de Especificación Funcional* son
el compromiso escrito con la clienta. Están ancladas a fechas reales en
**`CRONOGRAMA.md`**.

| Fase | Semanas | Desde | Hasta |
|---|---|---|---|
| 1 — Diseño y UX/UI | 1–2 | 21/08 | 03/09 |
| 2 — Desarrollo base | 3–5 | 04/09 | 24/09 |
| 3 — Buscador y catálogo | 6–8 | 25/09 | 15/10 |
| 4 — Pagos y checkout | 9–10 | 16/10 | 29/10 |
| 5 — QA y lanzamiento | 11–12 | 30/10 | 12/11 |

**Este bloque se escribió antes del reanclaje.** La fecha vigente está en
`CRONOGRAMA.md`: semana 1 desde el **viernes 2026-08-21**, cierre de doce
semanas el **2026-11-12** y colchón hasta el **2026-11-26**.

**El PDF original lo tiene Emi, fuera del repositorio**, porque incluye
montos y forma de pago. Lo versionado y suficiente para trabajar son la
transcripcion funcional en `CONTRATO.md` y el anclaje en `CRONOGRAMA.md`.

## Objetivo activo

**Cerrar la edición general del perfil sin sobrescribir datos reales y hacerla
parte de la puerta accesible.** Es una pieza de integridad de Fase 2, previa al
directorio geográfico de transportistas de Fase 3. El perfil transportista ya
quedó aceptado en `c484513`; Railway descartable conserva la evidencia externa,
pero su Backend no se actualiza automáticamente y debe comprobarse por commit
en cada ensayo hasta corregir esa configuración.

El cronograma y los limites del PDF quedaron operativizados en
`CRONOGRAMA.md` y `ALCANCE-Y-LIMITES.md`. Suscripciones, planes, mensajeria
y tierras quedaron decididos para una Fase 6 posterior al MVP contractual.

## Dónde estamos

La medición contractual reponderada al 2026-08-14 es **~89%**. Es una
aproximación por esfuerzo, no habilita cobros ni reemplaza las puertas de
`CRONOGRAMA.md`. El hito intermedio ya tiene demostración conjunta aceptada.

Ponderado por esfuerzo, no por cantidad de renglones. Los nueve
requisitos de logística son un módulo entero, no nueve tareas chicas.

| Bloque | Peso | Avance |
|---|---|---|
| Comprador y vendedor | 30 % | 95 % |
| **Logística y transportistas** | **25 %** | **100 % y demostración conjunta aceptada** |
| Pagos | 15 % | 85 %; código aceptado, homologación externa incompleta |
| Catálogo y categorías | 8 % | 100 % |
| Stack y responsive | 10 % | 85 % |
| Cierre, despliegue y entrega | 12 % | 50 % |

El faltante grande ya no es logística: es Mercado Pago básico y el cierre de
producción/entrega. No se adelantan por entusiasmo; manda el cronograma.

Se pasó de un repositorio donde la base de datos no se podía crear a un
sistema que levanta desde cero con un comando. Todo lo declarado tiene
evidencia de ejecución detrás.

**Verificado y funcionando:**

- Línea base reproducible: PostgreSQL 16 + PostGIS 3.4.3, una migración
  generada desde los modelos, seed idempotente, build en verde.
- Recorrido de compra completo, probado en navegador: registro, ingreso
  con tres perfiles, catálogo con filtros combinados, detalle, carrito,
  checkout hasta el botón de pago, publicación, panel de vendedor y las
  cuatro vistas de administración.
- Geolocalización: 4.028 localidades de Georef con copia versionada y
  validación de hash, `Geography(POINT,4326)` con índice GIST,
  `products.locality_id` obligatorio contra el padrón. `ST_Distance`
  contrastado de forma independiente.
- Filtro por provincia y localidad, **de punta a punta**: selectores
  encadenados en la interfaz, filtrado en el servidor y estado en la URL.
  Verificado el 2026-08-05 en las 13 localidades con publicaciones: 32/32
  resultados coincidieron con SQL. Cierra el requisito 3.1.
- Las cinco categorías del contrato con productos y localidad.
- **Suite automatizada de 25 smoke tests**, ejecutada el 2026-08-05 desde
  base limpia con el mismo cuerpo de pruebas pero sin el runner oficial de
  Docker. Los cuatro casos nuevos fallaron antes del arreglo y quedaron
  verdes despues. Antes del lanzamiento se repite por el camino oficial.
- **Transferencia sin ordenes inmortales:** comprador y vendedor cancelan
  antes del comprobante; despues decide el vendedor; se puede decidir sin
  archivo, la referencia es visible y dos aprobaciones simultaneas descuentan
  stock una sola vez.
- **Taxonomía real de la clienta cargada**: sus 7 categorías con las 43
  subcategorías textuales, más `Bienes y Ganado` que exige el contrato,
  más 4 servicios. Verificado por SQL: 7/6/7/5/6/4/8, ninguna publicación
  sin categoría y ninguna categoría vacía.
- **Catálogo de demostración**: 30 publicaciones en doce categorías y
  nueve provincias. Seed idempotente, corrido dos veces sin duplicar.

**Tres lecturas para no leer mal ese 83 %:**

1. Buena parte de la jornada fue arqueología, no construcción.
2. El mayor salto lo dio el recorte de alcance, no el código. Esa palanca
   ya se usó y no vuelve a estar disponible.
3. La velocidad no se repite: lo que queda es construcción nueva con
   incógnitas.

## Orden de trabajo, revisado el 2026-08-05

**Primero se cierra lo roto de lo ya entregado.** No se abren módulos
nuevos con deuda encima.

1. ~~**Orden de transferencia inmortal.**~~ **Cerrada y aceptada el
   2026-08-05** en `0039e00`; 25/25 en la misma suite y compilacion
   independiente en verde.
2. ~~**Cerrar Fase 1 antes del 20/08:** dejar completo el flujo UX/UI de
   logística aunque su implementación corresponda a Fase 3.~~ **Cerrada el
   2026-08-06** con `823c3fe`, antes del inicio contractual.
3. ~~**Contraste productivo y puerta accesible.**~~ **Cerrados y aceptados el
   2026-08-09.** `83c4b59` agregó el barrido, `d2063c9` dejó la cobertura real en
   40/40 y 34/34, y `5924fbb` cerró el último falso verde del código de salida.
4. ~~**Seed bancario demo.**~~ **Cerrado y aceptado el 2026-08-09** en
   `652bc34`: primera corrida utilizable, repetición idempotente y suite 26/26.
5. ~~**Contrato monetario y precios altos.**~~ **Cerrado y aceptado el
   2026-08-10** con `61624ce`, `b2f2e89` y `5616aec`; suite 28/28.
6. ~~**Errores reales de sincronización y pago.**~~ **Cerrados y aceptados el
   2026-08-10** en `e915d6a`; suite 31/31 y cobertura accesible 40/40.
7. ~~**Instalación nativa y regresión Docker.**~~ **Cerradas y aceptadas el
   2026-08-10** en `82c1df8` y `896386a`; suite 32/32 y prueba Docker aislada
   completada por PM.
8. ~~**Validación de correo.**~~ **Aceptada el 10/08** en `ccc0794`; 37/37 y
   token ausente incluso del access log del frontend.
9. **Tarea activa — ensayo Railway condicionado.** Gate local inmediato. Gate
   externo sólo después de login y confirmación de Trial/Hobby por Emi; tope de
   una jornada, datos demo y cierre antes del 20/08. No cuenta como producción.
10. **Transportistas.** La Pieza A está hecha con dos objeciones abiertas
   —el perfil no se puede editar y el campo de certificación obligatorio
   no informa nada—. Las decisiones de B/C y el mapa de contacto quedaron
   cerrados el 2026-08-05; su implementacion corresponde a Fase 3.
11. **Antes de Fase 4:** reemplazar cálculos monetarios `float` por `Decimal` en
   ambos checkouts y probar centavos en el rango alto ya admitido.
12. **Mercado Pago para las compras**, reconstruido sin split, dentro de la
   Fase 4 contractual.
13. **Fase 6, despues del lanzamiento:** suscripciones, planes, mensajeria
   premium y tierras. No compite por tiempo con las fases 1 a 5.
14. **Al final:** correcciones de la vista en celular, revisión de
   seguridad y despliegue en producción.

**Despliegue:** Railway fue aprobado como destino el 2026-08-05. El proyecto de
prueba `strong-playfulness` está en Hobby y tiene auto-deploy de `main`. El
10/08 desplegó `46109ba` con éxito aparente en `ynerav.up.railway.app`, pero sólo
existe el servicio raíz `yneratopgreen`, sin volúmenes: `/health` responde `ok`
y tanto `/api/health` como `/api/catalog/categories` devuelven el HTML del SPA.
Por lo tanto **no es un despliegue funcional** de la aplicación ni cuenta como
producción. Emi autorizó reutilizar ese proyecto para el ensayo descartable.
Gate B debe agregar Backend, PostGIS y los dos volúmenes sólo después de cerrar
Gate A. No se elimina nada al terminar sin una nueva autorización explícita.

**Las correcciones de celular se aparcan.** Se hizo sólo el relevamiento
—capturas e inventarios de consola y red— para saber cuánto trabajo es.
Arreglar hoy pantallas que van a cambiar cuando entren transportistas es
pagar dos veces. Mismo criterio que con la seguridad.

**Resultado del relevamiento, 2026-07-26:** 36 pantallas en tres medidas,
**cero desbordes horizontales, cero errores de consola y cero respuestas
fallidas**. Nada impide completar ningún recorrido. Lo que queda son
controles táctiles por debajo de 44 px y dos barras de pestañas que piden
desplazamiento horizontal. Es media jornada al final, no un rediseño.

La decisión de aparcarlo quedó respaldada por los datos: no había
incendio.

## Equipo

**Una PM y una dev.** Todo sobre `main`, con canal único en `PARA-DEV.md`
—escribe la PM— y `PARA-PM.md` —escribe la dev—.

La dev ejecuta con **Opus 5 en razonamiento alto**. La regla permanente para
escribirle —una tarea, contexto concreto, límites, evidencia y condición de
freno; sin dictarle el cómo ni pedir razonamiento extenso— está en la sección
6 de `ONBOARDING-PM.md`.

La PM ejecuta con **GPT-5.6 Sol en razonamiento alto**. La regla espejo para
informarle y pedirle decisiones —resultado primero, commit y evidencia,
opciones con recomendación y sin repetir contexto— está en la sección 5 de
`ONBOARDING-DEV.md`.

El rol de PM cambió dos veces: la primera PM pasó a dev el 2026-08-04, Sol
la sucedió, y hay PM nueva desde el 2026-08-06. **La dev es la misma desde
el 04/08**, así que la continuidad del código no se cortó.

`PARA-DEV.md` quedó archivado el 2026-08-04: pasó de 1.378 a 494 líneas.
El historial completo está verbatim en
`docs/pm/archivo/PARA-DEV-historico.md` y no se edita.

## Cómo se escriben los criterios de aceptación

**Relacionales, no absolutos.** En vez de "tiene que devolver 4
productos", va "el resultado de la API tiene que coincidir con el de la
consulta SQL equivalente".

Motivo: se le pasaron a la dev números fijos que habían quedado viejos
cuando el seed creció. Ella reportó los reales en lugar de acomodarse, y
así se detectó. Los números fijos envejecen mal.

## Bloqueos y pendientes

- ~~**Fecha de inicio pendiente.**~~ **Reemplazada el 2026-08-14:** semana 1
  comienza con la firma legal programada para el viernes 2026-08-21.
- ~~**Tratamiento de suscripciones pendiente.**~~ **Resuelto el
  2026-08-05:** suscripciones, planes, mensajeria y tierras van a Fase 6,
  despues del MVP contractual.
- ~~**Definición pendiente del cliente:** cobertura del transportista.~~
  **Resuelto el 2026-07-26 leyendo el contrato**, que dice "zona de
  cobertura (radio en km)". No era una pregunta abierta: era yo que no
  había leído bien mi propia transcripción. El bloque grande arranca.
- **Mercado Pago: desmontado el 2026-07-26, se rehace desde cero.** La
  auditoría de la dev demostró que lo heredado no era el "checkout
  básico" del contrato: era split con comisión de marketplace y OAuth de
  vendedores, o sea la plataforma cobrando y girando. Sólo estaba apagado
  porque las credenciales estaban vacías, no por diseño.

  Además apareció un agujero vivo: `POST
  /payments/simulate-payment/{order_id}` dejaba a un comprador
  autenticado pasar su propia orden a `PAID` sin pagar. **Eliminado.**

  El router `payments` sigue sin montarse y las rutas de cobro permanecen en
  `404`. El vínculo `mp_oauth` fue reconstruido y aceptado en MP-A; no mueve
  dinero. Preferencias, webhook y activación se construyen en MP-B/MP-C.
- **Sin despliegue.** Nadie levantó esto en un servidor real. La fase 5
  está en cero salvo las pruebas.
- **Revisión de seguridad: al final, como condición para desplegar.** La
  fase 5 no arranca sin ella, y **no se adelanta**.

  Motivo de la fecha: auditar ahora sería certificar la mitad del
  sistema. Faltan por construir transportistas y el Mercado Pago nuevo,
  que son justamente los bloques que tocan datos sensibles y dinero.
  Revisar antes obliga a revisar dos veces.

  **Matiz aprendido el 2026-07-26:** posponer la auditoría no significa
  posponer un agujero encontrado. El simulador de pagos apareció en una
  revisión de alcance, no de seguridad, y se cerró el mismo día. La regla
  es: la auditoría completa va al final, lo que aparece se arregla cuando
  aparece.

  Motivo de que igual se haga, y es económico: el contrato da **90 días
  de garantía**. Todo lo que se despliegue con un agujero se arregla
  gratis, con urgencia y en el peor momento.

  Ya verificado el 2026-07-25 lo único que no podía esperar, porque el
  repositorio se entrega y se clona: sin secretos en los 115 commits del
  historial, `.gitignore` cubriendo `.env`, `*.pem` y `*.key`,
  contraseñas con bcrypt y CORS sin comodín. Se repite antes de entregar.

  **La excepción, y no es una auditoría:** el módulo de transportistas
  arranca con una decisión de diseño que no se puede posponer. Ver abajo.

## Privacidad y radio de transportistas: decisión cerrada

No se vuelve a preguntar a la clienta. Desde el 2026-08-05 rige el radio en
kilómetros sobre origen y destino, el listado no expone contacto y el comprador
ve el contacto del transportista sólo después de seleccionarlo. El
transportista recibe origen, destino y necesidad logística, sin precios,
comprobantes ni detalle financiero. Las ubicaciones del MVP son las
localidades oficiales; no se agrega exposición de domicilios exactos.

## Línea base de calidad — 2026-08-13

Evaluación interna de PM, no porcentaje contractual: **aproximadamente 7,5/10
para un MVP**. La base es sólida y está por encima de un prototipo improvisado,
pero todavía no es producción madura.

Fortalezas que se conservan como estándar de las piezas siguientes:

- puertas reproducibles de producto, hito, accesibilidad y contraste;
- importes con `Decimal`, snapshots y validación anterior a escribir;
- migraciones reversibles y evidencia que discrimina contra la versión previa;
- límites de autorización y privacidad comprobados;
- OAuth con credenciales cifradas, state de un solo uso y fallos cerrados.

Deudas asignadas, no tareas activas nuevas:

- MP-B centraliza la creación de órdenes y elimina la duplicación entre
  checkouts; MP-C reemplaza definitivamente el módulo de pagos heredado;
- los componentes y guiones grandes se dividen sólo cuando la pieza que los
  toca lo necesite para evitar duplicación o hacer verificable una regla. No se
  hace una reescritura cosmética;
- Fase 5 cierra `lint`, política de finales de línea, documentación falsa o
  vieja, auditoría integral de seguridad y despliegue reproducible;
- Mercado Pago no se considera maduro hasta probar preferencia, webhook,
  idempotencia, stock y un cobro externo controlado.

La calificación se revisa después de MP-C y nuevamente antes del lanzamiento;
no habilita adelantar Fase 6 ni gastar el colchón.

## Contraste externo de auditoría — 2026-08-22

Una auditoría independiente sobre `main` `6d6b985` estimó correctamente el
avance contractual en **~80–85 %**: el faltante dominante ya no es funcional,
sino homologación de Mercado Pago, seguridad, despliegue, backups, CI y cierre
de entrega. PM reprodujo `npm run lint` con **14 errores y 8 advertencias** y
confirmó que no existen tests unitarios ni CI; la suite E2E sigue siendo la
evidencia principal y su última ejecución completa todavía depende de la Dev.
El README conserva el número viejo de 46 casos.

La auditoría acertó al registrar JWT persistidos en `localStorage`, ausencia de
rate limiting, credenciales conocidas del seed y auto-deploy inconsistente del
Backend. Dos riesgos adicionales encontrados por PM no pueden esperar a la
auditoría integral de Fase 5:

- `python-multipart==0.0.6` está afectado por una vulnerabilidad alta de ReDoS
  y el producto usa formularios multipart. Debe actualizarse y probarse antes
  de seguir exponiendo cargas públicas.
- El backend acepta cookies `HttpOnly` con `SameSite=None` además de Bearer,
  pero no hay defensa CSRF visible por token ni validación de origen. Hace falta
  revisar las rutas mutadoras y cerrar una estrategia única antes de producción.

La ruta S3 sí existe, pero no es desplegable todavía: falta la dependencia y
evidencia de integración. Las contraseñas demo no se cargan automáticamente en
Railway, aunque el seed debe quedar bloqueado explícitamente en producción.

**Orden de decisión:** no mezclar estos hallazgos con la tarea logística ya
asignada. Al recibir esa entrega, PM decide un hotfix de seguridad acotado antes
de abrir otro bloque funcional. MP-D continúa como prueba humana aislada hasta
que reproduzca un defecto propio del producto.

## Deuda técnica registrada, sin acción

- Identificadores como `String(36)` en lugar del tipo `uuid` nativo.
- `OptionType` como `String(50)` mientras los otros estados generaron
  enums nativos.
- **Modo oscuro inalcanzable:** existen el contexto y los estilos, pero
  ningún componente usa `toggleTheme` ni `useTheme`. No es contractual.
- Imágenes del seed servidas desde `picsum.photos`, aleatorias y con
  dependencia externa. Mitigado con el respaldo del `ProductCard`.
- `docs/PROJECT_STATUS.md` acumula **ocho afirmaciones verificadas como
  falsas**. Se reescribe entero más adelante; mientras tanto, no usarlo.
- `npm run lint` conserva deuda previa y no es todavía una puerta verde.
- El repositorio mezcla LF y CRLF; `diff --check` puede reportar ruido por CR
  heredado. La normalización se hace en un commit mecánico aislado, con
  `.gitattributes`, después de pagos y antes de la auditoría final.
- Hay componentes y guiones extensos. No se fragmentan por cantidad de líneas:
  se extrae sólo la lógica compartida que una pieza activa necesite probar o
  reutilizar.
