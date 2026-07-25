# Estado actual

Actualizado: 2026-07-25, cierre de jornada.

## Objetivo activo

**Filtro por ubicación en el frontend** y **suite de smoke tests**, antes
de encarar el módulo de transportistas.

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
- Filtro por provincia y localidad en la API, contrastado contra SQL.
- Las cinco categorías del contrato con productos y localidad.

**Tres lecturas para no leer mal ese 46 %:**

1. Buena parte de la jornada fue arqueología, no construcción.
2. El mayor salto lo dio el recorte de alcance, no el código. Esa palanca
   ya se usó y no vuelve a estar disponible.
3. La velocidad no se repite: lo que queda es construcción nueva con
   incógnitas.

## Próximas tareas

1. **Filtro por ubicación en el frontend** (dev de mayor capacidad).
   Dos selectores encadenados, provincia y localidad, contra los
   parámetros que ya existen en la API. El estado se guarda en la URL.
   Es la pieza que demuestra geolocalización en la reunión del 30-07.
   - Criterio: se filtra desde la interfaz, el resultado coincide con la
     base, y al recargar se mantiene el filtro.

2. **Automatizar los smoke tests** (dev de mayor capacidad).
   Requisito contractual de la fase 5. Se perdieron una vez sin subir y
   hay que rehacerlos.
   - Criterio: un comando corre los once casos contra un arranque limpio
     y devuelve código distinto de cero si alguno falla.
   - Habilita que la dev de menor capacidad trabaje encadenando tareas
     con una compuerta automática en lugar de revisión manual.

3. **Módulo de transportistas** (dev de mayor capacidad). El bloque
   grande que falta del diferencial. **No arranca** hasta que el cliente
   defina si la coincidencia va por zonas declaradas o por radio en km.

## Reparto por capacidad

**Menor capacidad:** tareas mecánicas, sin decisiones de diseño.
Instrucciones prescriptivas, criterios comprobables por ella misma, y
revisión de código además del informe.

**Mayor capacidad:** lo que exige criterio, tiene riesgo o define
arquitectura.

**Regla dura:** la dev de menor capacidad no escribe la suite de tests.
Tests mal escritos son peores que no tenerlos, porque dan confianza falsa.

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
