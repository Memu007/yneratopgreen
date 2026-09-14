# Reproducción PM — POST-INTEGRATION-CLEAR-1

Fecha: 2026-09-14.

## Composición revisada

- base: `2d8ecfd`;
- producto y caso 170: `eb62d3d`;
- ajuste de arnés en casos 114 y 169: `a7ed544`;
- informe Dev: `48bae67`;
- integración local: `c973c6f`.

`a7ed544` sólo cambia `scripts/smoke.mjs`; `48bae67` sólo cambia el informe.
No hubo integración remota ni despliegue durante esta aceptación.

## Evidencia independiente

- Caso 170 sobre `eb62d3d`: **1/1**. En escritorio y celular, la sesión
  inválida bajó la identidad sin perder el carrito; cerrar el Login devolvió
  los mismos ítems; la cabecera reabrió el carrito incluso tras recargar; no
  hubo checkout anónimo; login válido continuó el flujo; logout explícito
  vació; la FAQ nombró transferencia y Mercado Pago condicional.
- El mismo caso y arnés sobre `2d8ecfd`: **0/1**. Falló en el punto exacto:
  había un ítem guardado y la cabecera sin sesión no ofrecía Carrito.
- Caso 169 sobre `a7ed544`: **1/1** con Docker real. `topgreen-api` cambió de
  PID `66031` a `34374` y de inicio `2026-09-13T21:13:50.623186228Z` a
  `2026-09-14T02:07:14.141871153Z`; los tres negativos conservaron su poder
  discriminante.
- Build, lint y `git diff --check`: verdes.
- A11y sobre producto `eb62d3d`: **70/70**, cero violaciones bloqueantes.
- Contraste sobre producto `eb62d3d`: **78/78**, cero incumplimientos.

El caso 114 no es focal independiente: aislado frena porque su escenario usa el
outbox fabricado por casos anteriores. No se le inventó ese estado para hacerlo
pasar. El delta revisado cambia la selección de `stock > 0` a disponibilidad
real `stock > stock_reservado`, coherente con producto y con el rojo informado.

## Suite completa y decisión

Dev ejecutó la suite completa desde base limpia sobre `a7ed544`: **169/170**.
El único rojo fue el caso 131 por falta de `docker run --rm` en su puente. Ese
caso no cambió y ya había pasado en la corrida Docker real anterior de PM.

PM no repitió la suite destructiva: su lanzador elimina volúmenes Docker
locales y Emi no autorizó borrar esos datos. La corrida completa Dev, la
evidencia PM anterior del caso 131 y los focales PM sobre todos los deltas
cubren los 170 casos sin declarar una corrida verde inexistente.

Resultado: **ACEPTADA** e integrada en `main` local mediante `c973c6f`. El
relevo se publica únicamente en la rama Dev para permitir la tarea siguiente;
publicar `main` sigue pendiente de autorización explícita de Emi porque
Railway observa esa rama y el cambio toca producto.
