# Reproducción PM — ADMIN-SAFETY-1 — 2026-09-09

## Resultado

Devuelta como `ADMIN-SAFETY-1R`.

- Producto/regresión Dev: `79f3219`.
- Informe Dev: `c26db85`.
- Delta revisado: siete archivos, 1023 inserciones y 88 eliminaciones. Queda
  dentro de panel administrativo, confirmación compartida, reset existente,
  guarda de subcategoría y caso 164; no toca pagos, Railway, datos remotos ni
  dependencias.
- PM ejecutó el 164 desde base Docker local limpia. El recorrido imprimió
  `[PASS]`, pero el resumen informó **0/1**. Log persistente:
  `/private/tmp/topgreen-pm-admin-safety-164.log`.
- PM no ejecutó la suite completa: el arnés ya había demostrado que no podía
  contar ni propagar el resultado del caso nuevo.

## Lo que queda técnicamente conforme

- `province` se retira sólo de Configuración; el padrón oficial sigue siendo la
  fuente y las filas/API legado no se borran.
- La inconsistencia real se reprodujo en subcategorías: una subcategoría
  inactiva desaparece del filtro y deja visibles sus publicaciones. El Backend
  ahora rechaza sólo esa desactivación cuando tiene publicaciones activas; el
  resto de la edición permanece disponible.
- Rol, activación, estado y borrados pasan por una confirmación propia común.
  El 164 reprodujo cero escrituras al cancelar y una al confirmar el cambio de
  rol, además de foco contenido y devuelto.
- El reset usa el endpoint existente, genera una clave fuerte en el navegador,
  invalida la anterior y no conserva el nuevo secreto en URL ni almacenamiento.

Estos puntos todavía no se aceptan como entrega final porque la regresión que
los sostiene tiene un falso verde y quedan tres bordes de producto.

## Defectos que impiden aceptar

1. **El caso 164 quedó después del cálculo de resultados.** `passed` y `failed`
   se calculan antes de ejecutar `runCase(164, ...)`. Por eso el recorrido puede
   imprimir PASS y el resumen dice 0/1; si el 164 fuera rojo, tampoco cambiaría
   `process.exitCode`. En la suite explica la aparente contradicción entre
   156/164 y siete rojos: el contador sólo conocía los primeros 163 casos.
2. **Una mutación en curso todavía se puede cerrar con Escape.** Los botones y
   el fondo respetan `enCurso`, pero `useCapaModal` recibe `alCancelar` sin esa
   guarda. Escape desmonta el diálogo mientras la solicitud sigue escribiendo,
   de modo que la pantalla comunica cancelación aunque la operación continúe.
3. **El estado de categoría sigue siendo un control sin efecto público.** La
   propia reproducción Dev demostró que cambiarla a Inactiva conserva las 12
   categorías, 30 publicaciones, filtros y detalle. Aun así el selector sigue
   visible y `handleUpdateCategory` sigue enviando `is_active`. No debe
   ofrecerse una acción administrativa que afirma retirar algo y no hace nada.
4. **La contraseña no es temporal.** El producto no tiene interfaz que fuerce o
   permita cambiarla al entrar. El texto «pedile que la cambie al entrar» es una
   instrucción imposible y la credencial queda vigente hasta otro reset. No se
   abre ahora un flujo nuevo: se corrige el nombre y la explicación para decir
   la verdad.

La corrección queda acotada al arnés, ciclo pendiente, retiro del selector sin
efecto y texto honesto. No se reabre la arquitectura entregada.
