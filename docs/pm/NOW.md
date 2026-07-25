# Estado actual

Actualizado: 2026-07-25

## Objetivo activo

**Geolocalización: tabla de localidades y ubicación en las
publicaciones.** Primer bloque del diferencial contractual.

La línea base está cerrada y aprobada. Se pasa de arqueología a
construcción.

## Estado

- **Línea base verde, verificada y reproducible.** PostgreSQL 16 +
  PostGIS 3.4.3, una migración generada desde los modelos (15 tablas, 40
  índices, sin `DROP`), seed repetible, build de frontend en verde y los
  diez smoke tests en `200`. Commit `de98fae` en `main`.
- Avance medido contra el contrato: **~38%**. Detalle y bugs abiertos en
  `MATRIZ.md`.
- El frontend **no tiene llamadas huérfanas**: los 23 endpoints que
  invoca existen en el backend. Era el mayor riesgo pendiente y quedó
  descartado.
- **UI recorrida.** Funciona registro, login con tres roles, catálogo con
  filtros combinados, detalle, carrito, checkout hasta el botón de pago,
  dashboard de vendedor y admin. **Publicar está roto y nunca funcionó**:
  la app se desmonta completa al elegir una categoría.

## Próximas tareas

1. **Desbloquear la publicación** (dev). Requisito contractual 3.1.
   Fusionar la respuesta de `form_options` con el estado inicial en lugar
   de reemplazarlo, sembrar los tipos de opción faltantes salvo
   provincias, y agregar un error boundary de nivel superior.
   - Criterio de aceptación: se publica un producto entero desde la UI,
     sin errores de consola, y con la tabla `form_options` vacía el
     formulario carga igual en vez de romperse.

2. **Tabla de localidades y ubicación en publicaciones** (dev).
   Georef v2, 4.028 localidades con copia versionada. Selección desde
   lista. Alcance en `PROJECT.md`.
   - Criterio de aceptación: seed de localidades reproducible y sin
     internet; una publicación guarda su localidad; una consulta PostGIS
     devuelve distancia entre dos localidades con datos reales.

3. **Filtro por ubicación en el catálogo** (dev).
   Cierra el requisito 3.1 del contrato.
   - Criterio de aceptación: el catálogo filtra por provincia y
     localidad, combinable con categoría, y el filtro se conserva al
     navegar.

## Bloqueos

- **El repositorio es público.** Contiene el proyecto de un cliente, su
  documentación y notas internas de PM. Nadie lo decidió de forma
  explícita. Definir si pasa a privado.
- **Plazo y presupuesto.** El contrato son 12 a 14 semanas a precio
  cerrado y falta el diferencial completo. Estimado de trabajo restante:
  8 a 10 semanas. Falta la fecha de firma para saber cuánto se consumió.
  Conversación comercial pendiente antes de comprometer fechas.
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

Línea base PostgreSQL + PostGIS con los diez smoke tests en `200`, seed
repetible y build en verde. Revisados y aprobados los tres arreglos de
código que hicieron falta: `UUID` → `str` en parámetros y schemas,
acumulador `Decimal` en el total del carrito, y el slug del seed.
