# Estado actual

Actualizado: 2026-08-11.

## Entrega aceptada y tarea actual

La integridad y accesibilidad de la edición general del perfil quedó aceptada
el 2026-08-11: producto `c5d2caa`, informe `6dfff09`. Build y `diff --check`
independientes quedaron verdes. La PM desplegó ese Backend en Railway y
reprodujo con una cuenta nueva que teléfono, WhatsApp y ubicación ausentes
siguen siendo `null` después de guardar los tres campos vacíos. La dev informa
40/40 y demostró el rojo del formulario anterior.

La PM también ejecutó el barrido completo contra Railway: las 46 pantallas se
abrieron, y la edición de perfil pasó en escritorio y celular. El resultado
global no fue verde: `scrollable-region-focusable` encontró dos violaciones
serias preexistentes en las tablas móviles de productos y órdenes de
administración. Son ajenas al diff aceptado; se cierran como tarea separada y
no se ocultan ni se cargan retroactivamente a esta entrega.

**Hallazgo operativo:** el frontend se desplegó automáticamente desde `main`,
pero Backend siguió sirviendo el commit anterior. Para probar esta entrega la
PM tuvo que desplegar Backend manualmente. El entorno sigue siendo descartable;
no se puede usar su estado verde como prueba de que los próximos cambios de
backend se publicaron.

**Tarea activa única de la dev:** volver a cerrar la puerta accesible: corregir
las dos regiones desplazables móviles y sumar un transportista demo completo
para que sus controles de perfil entren en el barrido permanente. El alcance y
los frenos están al final de `PARA-DEV.md`.

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

- **El calendario del PDF, que arranca mañana viernes 07/08.** Ver
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
| 1 — Diseño y UX/UI | 1–2 | 07/08 | 20/08 |
| 2 — Desarrollo base | 3–5 | 21/08 | 10/09 |
| 3 — Buscador y catálogo | 6–8 | 11/09 | 01/10 |
| 4 — Pagos y checkout | 9–10 | 02/10 | 15/10 |
| 5 — QA y lanzamiento | 11–12 | 16/10 | 29/10 |

**Hoy es lunes 2026-08-10 y estamos en la semana 1.** Emi confirmó que la
semana 1 comenzó el **viernes 2026-08-07** y que cada semana corre de
viernes a jueves. Las doce semanas cierran el **2026-10-29** y el colchon
llega al **2026-11-12**.

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

La ultima medicion heredada fue **~53%**, pero ya no es una cifra vigente:
no incorporaba la Pieza A de transportistas y mezclaba alcance contractual
con alcance nuevo. Hasta reponderar `MATRIZ.md`, el control se hace por las
puertas de `CRONOGRAMA.md`, no por un porcentaje unico.

Ponderado por esfuerzo, no por cantidad de renglones. Los nueve
requisitos de logística son un módulo entero, no nueve tareas chicas.

| Bloque | Peso | Avance |
|---|---|---|
| Comprador y vendedor | 30 % | 90 % |
| **Logística y transportistas** | **25 %** | **Pieza A parcial; B/C en 0** |
| Pagos | 15 % | 50 % |
| Catálogo y categorías | 8 % | 90 % |
| Stack y responsive | 10 % | 70 % |
| Cierre, despliegue y entrega | 12 % | 35 % |

**Subió sólo 4 puntos aunque se construyó mucho**, y el motivo importa:
la transferencia bancaria sumó, pero Mercado Pago **restó**. Estaba
contado como medio hecho y pasó a cero al desmontarlo. Fue la decisión
correcta y aun así el número la castiga; así tiene que ser un porcentaje
honesto.

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

**Tres lecturas para no leer mal ese 53 %:**

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

- ~~**Fecha de inicio pendiente.**~~ **Resuelto el 2026-08-05:** semana 1
  comienza el viernes 2026-08-07.
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

  Los routers `payments` y `mp_oauth` ya no se montan, y el caso 19 de la
  suite verifica que responden `404` —no `503`—, así que la propiedad es
  del código y no de la configuración. Se reconstruye sin split cuando
  haya credenciales.
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
