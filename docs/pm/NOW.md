# Estado actual

Actualizado: 2026-07-25

## Objetivo activo

**Filtro por ubicación en el catálogo**, que cierra el requisito 3.1, y
**automatizar los smoke tests** antes de encarar el módulo de
transportistas.

El cimiento geográfico está puesto y verificado.

## Estado

- **Línea base verde, verificada y reproducible.** PostgreSQL 16 +
  PostGIS 3.4.3, una migración generada desde los modelos (15 tablas, 40
  índices, sin `DROP`), seed repetible, build de frontend en verde y los
  diez smoke tests en `200`. Commit `de98fae` en `main`.
- Avance medido contra el contrato: **~44%**. Detalle en `MATRIZ.md`.
- **UI verificada de punta a punta**, publicación incluida. Se arregló el
  crash que la rompía desde siempre.
- **Geolocalización con cimiento real**: 4.028 localidades oficiales de
  Georef con copia versionada y validación de hash,
  `Geography(POINT,4326)` con índice GIST, y `products.locality_id`
  obligatorio contra el padrón. `ST_Distance` verificado de forma
  independiente.
- **No hay suite automatizada.** Cada vuelta se repiten los smoke tests a
  mano. Es el próximo riesgo: ya arreglamos cosas que "nunca
  funcionaron" y no hay red que detecte una regresión.

## Trabajo perdido — rehacer

El filtro por ubicación y el script de smoke tests se completaron el
2026-07-25 pero **nunca se subieron**: la sesión de la dev se cortó por
límite de uso antes del commit. Verificado que `main` está en `190525b`,
sin ese trabajo. **Hay que rehacerlo.**

Se sabe que funcionó, así que el camino está probado:

- Filtro por provincia y localidad, backend y frontend, combinable con
  categoría y precio, con el estado en la URL.
- Smoke automático de 11 casos, incluida la publicación real desde UI.

**Lección, aplicable de acá en adelante: se commitea y se pushea al
terminar cada pieza, antes de producir evidencia.** El código en el
repositorio vale más que el informe completo.

## Cambio de dev

A partir del 2026-07-25 el rol de desarrollo pasa a un modelo con menos
capacidad. Consecuencias para la conducción:

- Las tareas se parten en piezas más chicas.
- Las instrucciones son prescriptivas: qué hacer, no qué lograr.
- No se le delega criterio técnico. Las decisiones de diseño las toma PM
  por adelantado.
- La verificación deja de ser control de calidad y pasa a ser búsqueda de
  errores: se revisa el código, no sólo el reporte.
- **El estimado de trabajo restante vuelve a 8–10 semanas.** Las 7–9 se
  midieron con la dev anterior y no se sostienen con otra herramienta.

## Reparto por capacidad de la dev

Criterio: **la demo con el cliente es el 2026-07-30.** Se prioriza lo que
hace ver bien el producto, y se asigna según cuánto criterio técnico
exige cada tarea.

**Dev de menor capacidad — mecánico, sin decisiones de diseño:**
filtro de ubicación en el backend, actualización de la documentación
heredada, siembra de las categorías faltantes con productos de ejemplo, y
los dos bugs cosméticos del panel de vendedor.

**Dev de mayor capacidad — criterio, riesgo o diseño:**
filtro de ubicación en el frontend (es lo que se muestra en la demo),
automatización de los smoke tests, módulo de transportistas,
transferencia bancaria, validación de cuentas y despliegue.

**Regla dura: la dev de menor capacidad no escribe la suite de tests.**
Tests mal escritos son peores que no tener tests, porque dan confianza
falsa sobre lo único que nos protege de regresiones.

## Próximas tareas

1. **Filtro por ubicación, sólo backend** (dev). Requisito 3.1.
   Agregar parámetros `province` y `locality_id` a `GET /catalog/products`,
   que ya filtra por categoría y precio. Nada de frontend en esta tarea.
   - Criterio de aceptación: la consulta con `province` devuelve sólo
     productos de esa provincia, verificado contra la base. Commit y push
     al terminar, antes de escribir el informe.

2. **Sembrar las dos categorías faltantes** (dev menor). Alto valor de
   demo: el cliente ve sus cinco grupos del contrato representados.

   Cotejado el seed contra el contrato, la taxonomía existente ya cubre
   tres de los cinco grupos y es una versión más detallada de ellos, lo
   cual está bien: **no hay que reestructurar nada.**

   | Grupo del contrato | Cubierto por |
   |--------------------|--------------|
   | Insumos y Materia Prima | Semillas, Fertilizantes, Agroquímicos |
   | Maquinaria y Servicios | Maquinaria, Herramientas, Laboreo |
   | Logística | Transporte y Logística (servicio) |
   | **Bienes y Ganado** | **nada** |
   | **Tecnología para el Cultivo** | **nada** |

   - Criterio de aceptación: las dos categorías faltantes existen con dos
     productos de ejemplo cada una, todos con `locality_id` válido, y el
     seed sigue siendo repetible.

3. **Corregir dos bugs visibles del panel de vendedor** (dev menor).
   El contador de ventas muestra 0 con ventas reales, y el badge del
   carrito persiste al cambiar de rol. Eran cosméticos y sin acción,
   pero se ven en la demo.
   - Criterio de aceptación: el contador coincide con la cantidad de
     ventas listadas, y el badge se limpia al cambiar de rol sin recargar.

4. **Filtro por ubicación, frontend** (dev mayor).
   Dos selectores encadenados, provincia y localidad, contra los
   parámetros de la tarea 1. El estado se guarda en la URL. Es la pieza
   que demuestra geolocalización en la reunión, así que tiene que verse
   bien.
   - Criterio de aceptación: se filtra desde la interfaz, el resultado
     coincide con la base, y al recargar se mantiene el filtro.

5. **Automatizar los smoke tests** (dev mayor). Requisito contractual de
   la fase 5, "pruebas integrales". No es trabajo extra.
   - Criterio de aceptación: un comando corre los once casos contra un
     arranque limpio y devuelve código distinto de cero si alguno falla.

6. **Actualizar la documentación heredada al stack real** (dev menor).
   `README.md:49` declara "SQL Server 2022, puerto 1433" y
   `README_LOCAL_SETUP.md` lo menciona nueve veces, cuando
   `docker-compose.yml` usa `postgis/postgis:16-3.4`. Ya hizo perder un
   round a la dev nueva, que concluyó que el proyecto corría en SQL
   Server.
   - Criterio de aceptación: ninguna mención a SQL Server que describa el
     stack actual; el quickstart del `README.md` refleja
     `./scripts/init_local_db.sh`.

7. **Módulo de transportistas** (dev mayor). El bloque grande que falta del
   diferencial. **No arranca** hasta que el cliente defina si la
   coincidencia va por zonas declaradas o por radio en km.

## Nota de acceso a este contexto

`docs/pm/` vive en la rama `claude/acceso-carpeta-proyecto-s4q5j7`, no en
`main`. Cualquier dev que trabaje desde `main` **no ve estos documentos**.
Decirle explícitamente que los lea desde esa rama, o mergearla.

## Bloqueos

- **EL CONTRATO NO ESTÁ FIRMADO.** Firma prevista el 2026-07-30. El plazo
  de 12 a 14 semanas arranca ahí, así que el 44 % construido es previo al
  reloj y el proyecto **empieza adelantado**, no atrasado. Con 8 a 10
  semanas de trabajo restante, entra igual.
- **Quedan pocos días para corregir la propuesta.** Es la única ventana
  para tocar precio, plazo o definiciones ambiguas; después queda cerrado.
  Ver `PRE_FIRMA.md`.
- **Mercado Pago sin credenciales**, con un bug de sandbox conocido. No
  se toca hasta la fase de pagos.

## Deuda técnica registrada, sin acción

- Los IDs son `String(36)` en lugar del tipo `uuid` nativo de PostgreSQL.
  Índices más grandes y sin validación de tipo. **No se cambia**: la base
  está vacía y sería el momento más barato, pero no afecta ningún
  requisito contractual y el presupuesto es cerrado. Registrado por si
  cambia el criterio.
- `OptionType` quedó como `String(50)` mientras los otros cinco estados
  generaron enums nativos. Inconsistente, inocuo.

## Último resultado validado

Localidades y publicación con ubicación estructurada, commit `190525b`.

Verificado de forma independiente contra el repositorio: el SHA-256 del
CSV coincide, los 4.028 registros están, la localidad guardada en el
producto (`06063010`, Balcarce) corresponde al padrón oficial, y la
distancia Balcarce–Tandil de `ST_Distance` (96,75 km sobre elipsoide) es
consistente con 96,67 km calculados por haversine sobre esfera. La
diferencia es la esperada entre los dos modelos.

Confirmado también que `locality_id` es obligatorio en el schema, que la
API valida contra el padrón, y que el seed aborta si el hash no coincide.
