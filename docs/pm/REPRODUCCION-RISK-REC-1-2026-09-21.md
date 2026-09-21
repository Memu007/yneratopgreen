# Reproducción PM — RISK-REC-1 — 2026-09-21

## Composición revisada

- Base integrada: `4c8569d`.
- Relevo PM sobre la base: `2a9a72c`, sólo documental respecto del producto.
- Producto y arnés: `2d18d55`.
- Informe final Dev: `d518f40`, sólo modifica `docs/pm/PARA-PM.md` respecto del candidato.
- Entorno PM: worktree aislado, Docker local descartable, migraciones desde cero y seed versionado.

## Revisión del cambio

La aceptación de una transferencia dejó de leer disponibilidad y restar después
en Python. `stock.vender` comprueba y descuenta mediante un `UPDATE ... WHERE`
condicional sobre el producto, dentro de la transacción que decide la orden. Los
productos se recorren por identificador para conservar un orden de bloqueo
estable y un fallo revierte la transacción completa. No hay tabla, migración,
dependencia, endpoint ni política comercial nueva.

La interfaz suma la salida que faltaba en dos paredes ya existentes: retirar una
línea desde el resumen cuando el producto se agotó o el vendedor no puede cobrar.
También presenta el motivo del paso de envío y anuncia como error el reenvío de
correo que no salió.

## Focales y negativo discriminante

- Casos 176, 177 y 178 juntos sobre `2d18d55`: **3/3**.
- Caso 176: tres rondas simultáneas sobre la última unidad; todas terminaron con
  una orden pagada, otra rechazada, stock 0 y una venta.
- Sabotaje `venta`: se restauró temporalmente el leer-y-escribir anterior. El
  caso 176 dio **FAIL** en la ronda 2 porque dos órdenes distintas terminaron
  pagadas por una sola unidad.
- El arnés restauró el archivo y reinició la API con identidad distinta antes de
  continuar.

Los dos primeros intentos del sabotaje no dieron veredicto: el lanzador focal
había retirado Vite y después su `.env` temporal. No fueron verdes ni rojos de
producto. Con ambos requisitos locales repuestos, el negativo falló por la causa
exacta declarada.

## Puertas completas

- Suite desde base Docker limpia: **178/178**, cero rojos; el caso 131 pasó.
- Accesibilidad: **74/74** superficies, cero violaciones `serious` o `critical`.
- Contraste: **82/82** mediciones, cero incumplimientos y cero desbordes.
- Build de producción, lint, `tsc --noEmit` y `node --check`: verdes.
- `compileall` con caché en `/tmp` y `pip check`: verdes. El primer intento de
  `compileall` sólo encontró que el usuario de la imagen no puede crear
  `__pycache__` dentro de `/app/app`; no fue un error de sintaxis.
- `alembic check`: `No new upgrade operations detected`.
- `git -c core.whitespace=cr-at-eol diff --check`: verde. El comando plano
  interpreta como whitespace los CRLF preexistentes de esos archivos.

## Decisión

PM **acepta `RISK-REC-1` en `2d18d55`**.

- R1 es real y queda cerrado: dos transferencias podían terminar pagadas por la
  misma última unidad; el Backend vuelve a ser autoridad atómica.
- R5 es real y queda cerrado: el grupo sin medio puede retirarse sin abandonar
  el checkout ni perder los grupos válidos.
- R4 es falso como defecto vigente: el ingreso ya ofrece el reenvío. La
  dependencia de una frase del rechazo queda vigilada por el caso 177 y su
  sabotaje; corregirla correctamente requiere una señal estable nueva de Auth y
  no entra en esta pieza.
- La devolución de stock al cancelar o rechazar una orden pagada queda como
  riesgo adyacente no reproducido, no como defecto aceptado ni tarea abierta.

La aceptación no integra ni publica. `main` permanece en `4c8569d` y su push
activa Railway; la próxima acción necesita autorización explícita de Emi.
