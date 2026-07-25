# Estado actual

Actualizado: 2026-07-25, cierre de jornada.

## Objetivo activo

**Suite automatizada de smoke tests**, antes de encarar el módulo de
transportistas.

## Dónde estamos

Avance contra el contrato: **~46%**. Evidencia requisito por requisito en
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

**Tres lecturas para no leer mal ese 46 %:**

1. Buena parte de la jornada fue arqueología, no construcción.
2. El mayor salto lo dio el recorte de alcance, no el código. Esa palanca
   ya se usó y no vuelve a estar disponible.
3. La velocidad no se repite: lo que queda es construcción nueva con
   incógnitas.

## Próximas tareas

1. **Suite automatizada de smoke tests.** Requisito contractual de la
   fase 5. Once casos, un solo comando, código de salida distinto de cero
   si algo falla. Incluye probar que la suite **efectivamente falla**
   cuando se rompe algo a propósito.
   - Habilita trabajar encadenando tareas con una compuerta automática en
     lugar de revisión manual de cada entrega.

2. **Ampliar el catálogo de demostración** a unos 25 productos repartidos
   en ocho provincias o más, con al menos dos por categoría. Hoy hay 12 en
   tres provincias, lo que luce poco el filtro por ubicación recién
   terminado.

3. **Módulo de transportistas.** El bloque grande que falta del
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
  reloj. Con 8 a 10 semanas de trabajo restante, entra.
- **Definición pendiente del cliente:** cobertura del transportista por
  zonas declaradas o por radio en km. Sin eso no arranca el bloque grande.
- **Mercado Pago sin credenciales.** Es el único bloque grande que nunca
  se pudo probar, y en este código eso históricamente escondió sorpresas.
- **Sin despliegue.** Nadie levantó esto en un servidor real. La fase 5
  está en cero.
- **Sin suite automatizada.** Todo lo verificado se hizo a mano o leyendo
  código. Es la mayor fragilidad actual.

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
