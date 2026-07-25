# Estado actual

Actualizado: 2026-07-25, cierre de jornada.

## Objetivo activo

**Preparar la demostración del 30 de julio** y desbloquear el módulo de
transportistas.

## Dónde estamos

Avance contra el contrato: **~49%**. Evidencia requisito por requisito en
`MATRIZ.md`.

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
- **Suite automatizada de doce smoke tests**, un solo comando contra
  arranque limpio, con criterios relacionales contra SQL y publicación
  desde la interfaz con navegador real. Verificado que **falla** con
  código distinto de cero al romper un caso a propósito.
- **Taxonomía real de la clienta cargada**: sus 7 categorías con las 43
  subcategorías textuales, más `Bienes y Ganado` que exige el contrato,
  más 4 servicios. Verificado por SQL: 7/6/7/5/6/4/8, ninguna publicación
  sin categoría y ninguna categoría vacía.
- **Catálogo de demostración**: 30 publicaciones en doce categorías y
  nueve provincias. Seed idempotente, corrido dos veces sin duplicar.

**Tres lecturas para no leer mal ese 49 %:**

1. Buena parte de la jornada fue arqueología, no construcción.
2. El mayor salto lo dio el recorte de alcance, no el código. Esa palanca
   ya se usó y no vuelve a estar disponible.
3. La velocidad no se repite: lo que queda es construcción nueva con
   incógnitas.

## Próximas tareas

1. **Ensayo de la demostración del 30-07.** Recorrer el camino exacto que
   se va a mostrar, sobre instalación limpia y cronometrado. Guión en
   `DEMO.md`.

2. **Módulo de transportistas.** El bloque grande que falta del
   diferencial. **No arranca** hasta que el cliente defina si la
   coincidencia va por zonas declaradas o por radio en km.

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
- **Definición pendiente del cliente:** cobertura del transportista por
  zonas declaradas o por radio en km. Sin eso no arranca el bloque grande.
- **Mercado Pago sin credenciales.** Es el único bloque grande que nunca
  se pudo probar, y la suite tampoco lo cubre por eso. En este código, lo
  no verificado históricamente escondió sorpresas.
- **Sin despliegue.** Nadie levantó esto en un servidor real. La fase 5
  está en cero salvo las pruebas.
- **Revisión de seguridad: al final, como condición para desplegar.** La
  fase 5 no arranca sin ella, y **no se adelanta**.

  Motivo de la fecha: auditar ahora sería certificar la mitad del
  sistema. Faltan por construir transportistas, transferencia bancaria y
  la puesta en marcha de los pagos, que son justamente los bloques que
  tocan datos sensibles y dinero. Revisar antes obliga a revisar dos
  veces.

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
