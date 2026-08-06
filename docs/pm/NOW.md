# Estado actual

Actualizado: 2026-08-06.

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

**La corrección `f7fd2a2` fue revisada el 2026-08-06.** Las cinco
devoluciones de Sol están bien, pero apareció un hueco adicional: cambiar el
destino deja candidatos, distancias y selección del tramo anterior. La entrega
sigue rechazada por ese único punto. La corrección activa está especificada en
`PARA-DEV.md`; de ella depende cerrar la Fase 1 en fecha.

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

**Hoy es jueves 2026-08-06: el reloj arranca mañana.** Emi confirmo que la
semana 1 comienza el **viernes 2026-08-07** y que cada semana corre de
viernes a jueves. Las doce semanas cierran el **2026-10-29** y el colchon
llega al **2026-11-12**.

**El PDF original lo tiene Emi, fuera del repositorio**, porque incluye
montos y forma de pago. Lo versionado y suficiente para trabajar son la
transcripcion funcional en `CONTRATO.md` y el anclaje en `CRONOGRAMA.md`.

## Objetivo activo

**Cerrar el flujo UX/UI de logistica y la puerta de la Fase 1 antes del
20/08.** La orden de transferencia inmortal se cerro antes del inicio
contractual en `0039e00` y fue aceptada por la PM el 2026-08-05.

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
2. **Cerrar Fase 1 antes del 20/08:** dejar completo el flujo UX/UI de
   logistica aunque su implementacion corresponda a Fase 3. Tarea activa.
3. **El seed no carga CBU ni alias**, así que sobre una instalación limpia
   la transferencia no se puede usar. Y la pantalla de pago muestra un
   error que no corresponde.
4. **El camino de instalación sin Docker no funciona** siguiendo la guía:
   el archivo de configuración de ejemplo tiene claves que el sistema
   rechaza, y el proxy del frontend apunta a un puerto que sólo existe con
   nginx.
5. **Transportistas.** La Pieza A está hecha con dos objeciones abiertas
   —el perfil no se puede editar y el campo de certificación obligatorio
   no informa nada—. Las decisiones de B/C y el mapa de contacto quedaron
   cerrados el 2026-08-05; su implementacion corresponde a Fase 3.
6. **Mercado Pago para las compras**, reconstruido sin split, dentro de la
   Fase 4 contractual.
7. **Fase 6, despues del lanzamiento:** suscripciones, planes, mensajeria
   premium y tierras. No compite por tiempo con las fases 1 a 5.
8. **Al final:** correcciones de la vista en celular, revisión de
   seguridad y despliegue en producción.

**Despliegue:** Railway fue aprobado como destino el 2026-08-05. La dev
subio la preparacion en `382bcbe` —`Dockerfile.railway`, `railway.toml` y
`RAILWAY.md`— sin desplegarla. Falta revisarla, y **no se publica nada sin
la revision de seguridad**.

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

## La pregunta que abre el módulo de transportistas

Antes de escribir la primera línea de ese módulo hay que responder **quién
puede ver los datos de contacto de quién**.

El contrato pide que el comprador pueda "contactar directo con los datos
provistos" por el transportista. Eso significa que la plataforma va a
mostrar teléfonos, direcciones y ubicaciones base de personas reales:
productores y transportistas argentinos.

No es un tema de auditoría posterior, es la forma del módulo:

- ¿El teléfono del transportista se ve antes de contratarlo o después?
- ¿El comprador ve la dirección exacta del vendedor o sólo la localidad?
- ¿El transportista ve el detalle de la compra o sólo origen y destino?

Si esto se define al empezar, es un parámetro. Si se define al auditar, es
reescribir el módulo entero, y ahí sí se paga dos veces.

**Va a la lista de preguntas para la clienta**, junto con la de zonas
declaradas contra radio en km. Son la misma conversación.

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
