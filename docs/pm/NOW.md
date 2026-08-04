# Estado actual

Actualizado: 2026-08-04.

## Cambio de roles, hoy

**La PM ahora es Sol. La dev ahora soy yo.** El intercambio es completo:
Sol define, prioriza, escribe criterios y revisa; yo escribo el código y
le informo. Seguimos siendo adversariales en las dos direcciones.

Sol arranca por **`ONBOARDING-PM.md`** y después por este archivo.

Lo que cambia en la práctica:

- `PARA-DEV.md` lo escribe Sol. Lo archivé de 1.378 a 494 líneas; el
  historial completo quedó verbatim en `archivo/PARA-DEV-historico.md`.
- `PARA-PM.md` lo escribo yo, y lo pisé con el informe de hoy.
- El plan con fechas reales quedó en **`CRONOGRAMA.md`**, nuevo.

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
| 1 — Diseño y UX/UI | 1–2 | 27/07 | 09/08 |
| 2 — Desarrollo base | 3–5 | 10/08 | 30/08 |
| 3 — Buscador y catálogo | 6–8 | 31/08 | 20/09 |
| 4 — Pagos y checkout | 9–10 | 21/09 | 04/10 |
| 5 — QA y lanzamiento | 11–12 | 05/10 | 18/10 |

**Hoy es martes 2026-08-04: semana 2, fase 1.** El plazo es de 12 a 14
semanas; las doce cierran el **2026-10-18** y el colchón llega al
**2026-11-01**.

**El ancla al lunes 2026-07-27 todavía no está confirmada con la
clienta.** Si ella entiende otra fecha de inicio, las cinco fases se
corren en bloque. Conviene resolverlo ahora y no en la semana 10.

## Objetivo activo

**Cerrar lo que quedó roto de lo ya entregado** y arrancar los dos módulos
grandes: transportistas y suscripciones.

## Dónde estamos

Avance contra el contrato: **~53%**. Evidencia requisito por requisito en
`MATRIZ.md`.

Ponderado por esfuerzo, no por cantidad de renglones. Los nueve
requisitos de logística son un módulo entero, no nueve tareas chicas.

| Bloque | Peso | Avance |
|---|---|---|
| Comprador y vendedor | 30 % | 90 % |
| **Logística y transportistas** | **25 %** | **0 %** |
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
  Cierra el requisito 3.1.
- Las cinco categorías del contrato con productos y localidad.
- **Suite automatizada de veinte smoke tests**, un solo comando contra
  arranque limpio, con criterios relacionales contra SQL y publicación
  desde la interfaz con navegador real. Verificado que **falla** con
  código distinto de cero al romper un caso a propósito.
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

## Orden de trabajo, revisado el 2026-08-04

**Primero se cierra lo roto de lo ya entregado.** No se abren módulos
nuevos con deuda encima.

1. **Órdenes de transferencia que quedan colgadas.** Si el comprador no
   sube el comprobante, nadie puede aprobar, rechazar ni cancelar esa
   orden nunca más. Cuatro arreglos chicos, detallados en
   `PAGOS-TRANSFERENCIA.md`.
2. **El seed no carga CBU ni alias**, así que sobre una instalación limpia
   la transferencia no se puede usar. Y la pantalla de pago muestra un
   error que no corresponde.
3. **El camino de instalación sin Docker no funciona** siguiendo la guía:
   el archivo de configuración de ejemplo tiene claves que el sistema
   rechaza, y el proxy del frontend apunta a un puerto que sólo existe con
   nginx.
4. **Transportistas.** La Pieza A está hecha con dos objeciones abiertas
   —el perfil no se puede editar y el campo de certificación obligatorio
   no informa nada—. Las Piezas B y C esperan a que la dev conteste las
   cuatro preguntas de diseño y haga el mapa de por dónde sale hoy el
   contacto del comprador.
5. **Suscripciones con Mercado Pago, dos planes y mensajería premium.**
   Alcance nuevo confirmado. **Falta escribir la tarea**; el análisis está
   en `DECISIONS.md` y `PROJECT.md`.
6. **Tierras y parcelas como aviso de consulta**, sin carrito. Chico:
   la categoría ya existe y el candado de contacto ya se construye.
7. **Mercado Pago para las compras**, reconstruido sin split.
8. **Al final:** correcciones de la vista en celular, revisión de
   seguridad y despliegue en producción.

**Despliegue:** la dev subió la preparación para Railway en `382bcbe`
—`Dockerfile.railway`, `railway.toml` y `RAILWAY.md`— sin informe. Falta
revisarlo, y **no se publica nada sin la revisión de seguridad**.

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

**Sol, PM. Una sola dev.** Todo sobre `main`, con canal único en
`PARA-DEV.md` —escribe Sol— y `PARA-PM.md` —escribe la dev—.

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

- ~~**El contrato no está firmado.**~~ **Proyecto aprobado el
  2026-07-28.** Queda confirmar con la clienta la fecha de inicio del
  plazo. Trabajamos sobre el ancla del lunes 2026-07-27; ver
  `CRONOGRAMA.md`.

  **El estimado ya no cierra igual.** Eran 7 a 9 semanas de trabajo
  restante; el alcance nuevo —suscripciones con cobro recurrente, dos
  planes y mensajería— suma entre 4,5 y 6. Total 11,5 a 15 contra un
  plazo de 12, o 14 con el colchón. **Entra raspando en el mejor caso.**

  Y las suscripciones **no están en el PDF**: son alcance agregado después
  de la propuesta, sobre un precio cerrado. Las tres salidas posibles
  —addendum, absorberlo, o correrlo a una fase 6— están en `CRONOGRAMA.md`
  sección 5. **No decidir es elegir absorberlo sin haberlo acordado.**
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
