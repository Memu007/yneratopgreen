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

## Próximas tareas

1. **Filtro por ubicación en el catálogo** (dev). Cierra el requisito 3.1.
   - Criterio de aceptación: el catálogo filtra por provincia y
     localidad, combinable con categoría y precio, y el filtro se
     conserva al navegar.

2. **Automatizar los smoke tests** (dev, ~medio día).
   Convertir en script los diez casos que hoy se corren a mano, más la
   publicación desde la UI. Es requisito contractual de la fase 5
   ("pruebas integrales"), no trabajo extra.
   - Criterio de aceptación: un comando los corre todos contra un
     arranque limpio y falla con código distinto de cero si alguno se
     rompe.
   - Motivo de hacerlo ahora y no al final: cada vuelta encontramos algo
     que nunca funcionó, y no hay nada que detecte una regresión sobre lo
     ya arreglado. Además se deja de repetir trabajo manual en cada
     entrega.

3. **Módulo de transportistas** (dev). El bloque grande que falta del
   diferencial. Antes de arrancar hay que resolver la definición
   pendiente: zonas declaradas o radio en km.

## Bloqueos

- **El repositorio es público.** Contiene el proyecto de un cliente, su
  documentación y notas internas de PM. Nadie lo decidió de forma
  explícita. Definir si pasa a privado.
- **Plazo y presupuesto.** El contrato son 12 a 14 semanas a precio
  cerrado. Estimado de trabajo restante revisado a **7 a 9 semanas** tras
  el primer dato de velocidad real. Falta la fecha de firma para saber
  cuánto se consumió. Conversación comercial pendiente antes de
  comprometer fechas.
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
