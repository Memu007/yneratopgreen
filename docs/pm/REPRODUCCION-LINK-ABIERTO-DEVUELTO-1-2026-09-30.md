# Reproducción PM — LINK-ABIERTO-DEVUELTO-1

Fecha: 2026-09-30. Base `487114f` (la asignación de PM).

- Producto: `4b02fec`, una línea de `cobro.en_curso` y su docstring.
- Caso, negativos y terminadores: `cac729d`.
- Informe: `5af8ccf`, que difiere de `cac729d` sólo en `docs/pm`.

`main` estaba en `2ab0a36`. **ACEPTADA EN RAMA** y **publicada en `77d3d2c`
el 01/10**, con autorización de Emi («Dale»), por fast-forward. Lo publicado
difiere de lo probado (`cac729d`) sólo en `docs/pm`.

## Qué cambia

- **El link abierto mira los cuatro estados con cobro** (`CON_COBRO`:
  aprobado, en revisión, devuelto y contracargo), en el criterio único
  `cobro.en_curso`. Antes miraba sólo aprobado y en revisión.
- **Un pago devuelto o con contracargo cuyo link no se pudo apagar:**
  - frena desvincular y pasar a otra cuenta, como cualquier cobro en curso;
  - entra al reconciliador, que apaga el link.
- **Los terminadores de las dos piezas anteriores, restaurados.**
- **Sin migraciones.**

## Revisión del código

- **Apagar no cambia el pago ni mueve stock.** Está leído en `cobro.py` y lo
  confirman el 231 y un negativo de PM:
  - `sincronizar` vuelve a traer el mismo intento y no lo reescribe;
  - `aplicar` deriva de los intentos el mismo estado, devuelto o contracargo;
  - `stock.consolidar` sólo mueve una reserva reservada o en cierre pendiente,
    y la de estas órdenes ya está consolidada;
  - la orden ya está pagada, así que no hay transición ni aviso.
- **La rama de `aplicar` que sí cambiaría el estado no se alcanza con estas
  órdenes.** Es la del cobro sobre una reserva liberada: pasa el pago a «en
  revisión» y avisa. Pero con la reserva liberada, `aplicar` deja el pago en
  revisión y nunca en devuelto, y `liberar` no toca una reserva consolidada.
  Está leído en el código, no construido con un caso.
- **El reconciliador suma sólo órdenes con cobro y link abierto.**
  `_candidatas` no tiene tope por cantidad, así que no desplazan a las
  vencidas.

## Resultados PM

Base PostGIS recién creada, API nativa reiniciada en el código entregado (un
solo proceso), frontend de desarrollo y configuración local inventada.

| Verificación | Resultado |
|---|---|
| El 231 con el producto de la base (`cobro.py` de `487114f`) | **rojo, 5 problemas**, los mismos del informe: desvincular respondió 200 y no 409, el conflicto no dice «cobros_en_curso» y 2, las credenciales cambiaron, y los dos «el reconciliador no apagó el link (sin anotar, vivo en Mercado Pago)» |
| El 231 con la entrega | **verde** en 6 s: «desvincular da 409 con 2; el reconciliador apaga los dos links sin cambiar el estado del pago, la orden, la reserva ni el stock, y después desvincula» |
| Negativos de la Dev (2) | **2 rojos esperados**, cada uno por su motivo; «src y backend después: como estaban». Detalle abajo |
| Negativo PM 1, `pm-criterio-sin-contracargo`: el criterio suma devuelto pero no contracargo | **rojo** en el 231: «el conflicto no dice «cobros_en_curso» y 2» (dice 1) y «contracargo: el reconciliador no apagó el link». La devolución sí se apaga. El caso distingue los dos estados por separado |
| Negativo PM 2, `pm-reaplicar-mueve-stock`: consolidar vuelve a descontar una reserva ya consolidada | **rojo** en el 231: «el stock se movió (stock, reservado, ventas): 6/0/4 → 4/0/6». Cubre «sin mover stock», que los negativos de la Dev no tocaban |
| Negativo PM 3, `pm-reconciliador-saltea-devueltos`: el criterio los incluye pero el reconciliador no los procesa | **rojo** en el 231: los dos «no apagó el link» y, al final, «con los links apagados: desvincular respondió 409». El caso mira el barrido, no sólo el criterio |
| Suite completa desde base recién creada, sobre `5af8ccf` | **230/231** en 23 minutos. Sólo cae el **131**, de entorno: «puente docker: sólo se traduce 'docker exec'». Pasa el 231. «Para desvincular hubo que terminar ventas en curso en: 75, 76, 77, 78, 79, 81, 82, 87, 90, 91, 97, 224, 228, 230», la misma lista del informe y de la pieza anterior |
| Build, tipos, lint, `compileall`, `pip check`, `node --check`, `alembic check` | verdes; «No broken requirements found.» y «No new upgrade operations detected.» |
| a11y, contraste, auditoría móvil y guías | no corridas: la pieza no cambia nada visible y la tarea no las pedía |
| Diff-check `487114f..5af8ccf` con `cr-at-eol` | limpio |
| Líneas con CR por archivo | `smoke.mjs`: 0 → 4, y son **las mismas cuatro líneas** que tenía `0495b31` (ahora 36426 a 36429). `mp-doble.mjs`: 3 → 0, como en `0495b31`. `cobro.py`: 5 → 5, las mismas líneas. El resto, sin CR |
| `PRE_FIRMA.md`, `.env`, secretos o migraciones en el delta | ninguno |

Los negativos de la Dev:

| Sabotaje | Rojo |
|---|---|
| `criterio-sin-los-estados-nuevos` | 231: «desvincular respondió 200 y no 409» y los dos «el reconciliador no apagó el link». Nada cambia de estado |
| `reconciliador-cambia-el-estado` | 231: «devolución: pago cambió: REFUNDED → APPROVED» y «contracargo: pago cambió: CHARGED_BACK → APPROVED» |

Los negativos de PM corren desde un script fuera del repositorio que importa
el de la Dev y le suma sus tres sabotajes.

## Decisiones PM sobre el informe

- **Nada para decidir.** Los dos riesgos del informe se aceptan:
  - un link que Mercado Pago no deja apagar nunca deja la orden en curso y a
    quien vende sin poder desvincular. Ya pasaba con un pago aprobado, y el
    reconciliador lo reintenta en cada barrido;
  - hoy no hay ninguna vendedora con un link así, porque Mercado Pago no está
    habilitado.

No se tocó `main`, Railway ni datos reales.
