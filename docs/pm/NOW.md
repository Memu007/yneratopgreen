# Estado actual

Actualizado: 2026-07-26.

## Objetivo activo

**Preparar la demostración del 30 de julio** y construir el módulo de
transportistas.

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

## Orden de trabajo, decidido el 2026-07-26

1. ~~**Pago por transferencia bancaria.**~~ **Terminado y verificado el
   2026-07-26.** Los tres requisitos contractuales de la sección 3.3
   cerrados, con copia de los datos bancarios guardada en la orden y
   avisos en pantalla para comprador y vendedor. **Suite en 20/20.**
2. **Transportistas: arranca ya.** Estaba trabado por error mío. El
   contrato **ya define** la cobertura: *"zona de cobertura (radio en
   km)"*. Las zonas declaradas eran una propuesta mía, no lo contratado;
   si la clienta las quiere, es un cambio a cotizar.

   Y también aclara que es un **directorio, no un motor de ruteo**: se
   filtra por distancia y se lista, sin calcular rutas ni tiempos.

   Se hace en tres piezas: el transportista como tipo especial de
   proveedor, la coincidencia por `ST_DWithin`, y la selección con los
   datos de contacto **recién después de elegirlo**.
3. **Mercado Pago: se reconstruye desde cero, sin split.** Lo heredado se
   desmontó el 2026-07-26. Ver el bloqueo de abajo.
4. **Al final, antes de desplegar:** correcciones de la vista en celular,
   revisión de seguridad y despliegue.

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

## Próximas tareas

1. **Ensayo de la demostración del 30-07.** Recorrer el camino exacto que
   se va a mostrar, sobre instalación limpia y cronometrado. Guión en
   `DEMO.md`.

2. **Módulo de transportistas, en curso.** El bloque grande del
   diferencial, 25 % del contrato. Radio en km por contrato, directorio y
   no ruteo, en tres piezas con informe entre cada una.

## Equipo

Una sola dev, sobre `main`, con canal único en `PARA-DEV.md` y
`PARA-PM.md`. El estimado de trabajo restante vuelve a **7 a 9 semanas**.

## Cómo se escriben los criterios de aceptación

**Relacionales, no absolutos.** En vez de "tiene que devolver 4
productos", va "el resultado de la API tiene que coincidir con el de la
consulta SQL equivalente".

Motivo: se le pasaron a la dev números fijos que habían quedado viejos
cuando el seed creció. Ella reportó los reales en lugar de acomodarse, y
así se detectó. Los números fijos envejecen mal.

## Bloqueos y pendientes

- **El contrato no está firmado.** Firma prevista el 2026-07-30. El plazo
  de 12 a 14 semanas arranca ahí, así que lo construido es previo al
  reloj. Con 7 a 9 semanas de trabajo restante, entra.
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
