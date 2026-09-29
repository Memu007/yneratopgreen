# Reproducción PM — PAGO-ORDEN-CERRADA-1

Fecha: 2026-09-28. Base `b5a7944` (la asignación).

- Código: `c1e7f0c`.
- Casos 220, 221 y 222, y negativos: `b3b5f3c`.
- Informe: `f8929af`, con el merge `ad9c0c6`, que trae sólo `docs/pm` de PM.
  `ad9c0c6` difiere de `b3b5f3c` sólo en `docs/pm`.

`main` está en `58bb62b`. **Aceptada en rama**, sin integración ni
despliegue.

## Qué cambia

- **Un pago que llega a una orden ya cerrada deja de pasar callado.**
  - La orden queda como antes: pagada, en revisión y sin volver a tomar stock.
  - La API dice `pago_tras_cierre` y no `en_revision`. Se calcula de lo que ya
    hay: la intención en revisión y la reserva liberada.
  - Mis Compras, Mis Ventas y la vuelta de Mercado Pago dicen lo que pasó, y
    no «más de un pago», que ahí era falso.
  - Cada parte recibe un aviso, «Pago en un pedido cerrado», una sola vez.
- **Dos cobros para una orden:** cada parte recibe «Más de un pago…», una
  sola vez. La pantalla sigue diciendo «más de un pago».
- **El P2 del reconciliador:** intenta apagar el link una sola vez por barrido
  y ya no espera a Mercado Pago con la fila de una publicación tomada.
- **Sin migraciones.** Los dos tipos de aviso nuevos van en una columna de
  texto (`notifications.type`, `varchar(50)`).

## Revisión del código

- **Una sola vez por orden y por motivo.** Lo decide el aviso ya escrito,
  leído con la fila de la orden tomada. Los tres caminos que aplican un pago
  la toman antes: el aviso, la vuelta y el reconciliador, y también
  `cerrar_cobro`, desde «Cancelar» y «Rechazar».
- **Si escribir el aviso falla, el pago queda.** El aviso va en un savepoint,
  como en `AVISOS-DE-PAGO-1`.
- **`pago_tras_cierre` sólo con la reserva liberada.** Una orden pagada tiene
  la reserva consolidada, así que dos cobros sobre una venta hecha siguen
  diciendo «más de un pago».
- **El reconciliador.** Se sacó el reintento de `_una`. Los imports que
  quedaron sin uso se retiraron, y no queda ninguna referencia a ellos.
- **La regla de avisos de `NOTIF-TEXTOS-1` se aflojó para cuatro frases
  exactas**, en las que devuelve quien vende. Cualquier otra forma de prometer
  una devolución sigue dando rojo: lo comprueba el negativo PM 1.

## Resultados PM

Base PostGIS recién creada, API nativa reiniciada en el código entregado (un
solo proceso), frontend de desarrollo y configuración local inventada.

| Verificación | Resultado |
|---|---|
| Casos 220, 221 y 222 | **3/3** en 36 s |
| Negativos de la Dev (8) | **8 rojos esperados**, cada uno por su motivo; «src y backend después: como estaban». Detalle abajo |
| Negativo PM 1, `pm-aviso-promete-devolucion`: el aviso a quien compra dice «AgroBoeda te devuelve el pago» | **rojo** en el 220, en las tres escenas y en la pestaña: «promete una devolución: «devuelv»». La regla aflojada sigue cazando la promesa de AgroBoeda |
| Negativo PM 2, `pm-dos-cobros-dicen-orden-cerrada`: el estado visible dice «pago tras el cierre» para cualquier revisión | **rojo** en el 221: «buyer ve «pago_tras_cierre»» y «seller ve «pago_tras_cierre»». Es el borde opuesto al de `api-dice-mas-de-un-pago` |
| Suite completa desde base recién creada | **221/222** en 26 minutos. Sólo cae el **131**, de entorno: «puente docker: sólo se traduce 'docker exec'». Pasan del 96 al 100, del 210 al 219 y del 220 al 222 |
| Build, tipos, lint, `compileall`, `pip check`, `node --check`, `alembic check` | verdes; «No broken requirements found.» y «No new upgrade operations detected.» Sin migraciones |
| a11y `--todas`, contraste, auditoría móvil | **80 de 80** pantallas sin violaciones bloqueantes; **88 de 88** mediciones; **12 de 12** recorridos, sin desbordes, sin errores de consola y sin respuestas 4xx o 5xx. Las capturas no se suben |
| Las dos guías, después de la suite | «LA GUÍA Y EL PANEL COINCIDEN: 26 pasos» y «LA GUÍA Y EL SITIO COINCIDEN: 22 pasos», en escritorio y celular |
| Diff-check `b5a7944..b3b5f3c` con `cr-at-eol` | limpio. En `cobro.py` la única línea CRLF de la base era el import, y el import nuevo conserva ese terminador |
| `PRE_FIRMA.md`, `.env` o secretos en el delta | ninguno. Las contraseñas del delta son de cuentas locales de la suite, en `example.com` |

Los negativos de la Dev:

| Sabotaje | Rojo |
|---|---|
| `orden-cerrada-dice-pago-aprobado` | 220: «tiene 0 veces el aviso del pago en un pedido cerrado» y «además tiene ["Pago aprobado \| …"]» |
| `api-dice-mas-de-un-pago` | 220: «la vuelta dijo «en_revision»» y «quien compra ve «en_revision»» |
| `panel-dice-mas-de-un-pago` | 220: «Mis Compras: dice «más de un pago»» |
| `vuelta-dice-mas-de-un-pago` | 220: «la vuelta de Mercado Pago no dice «Tu pago llegó con la orden ya cerrada»» |
| `aviso-dos-veces` | 220: «tiene 3 veces el aviso del pago en un pedido cerrado», las dos partes |
| `sin-aviso-de-mas-de-un-pago` | 221: «tiene 0 veces el aviso de más de un pago», las dos partes |
| `aviso-que-falla` | 220: faltan los avisos, y la orden igual queda pagada y en revisión |
| `reconciliador-reintenta` | 222: «intentó apagar el link 2 veces en el mismo barrido», y la API dejó de responder (7 de 9 consultas) |

## Decisiones PM sobre el informe

- **Los textos se aceptan como están.** Dicen lo que el código hace: la
  reserva liberada no se vuelve a tomar, y la plata la cobra la cuenta
  vinculada de quien vende. Emi los lee en el parte.
- **«Devolvé el pago desde Mercado Pago» se queda.** Devolver un pago cobrado
  es una operación de la cuenta de Mercado Pago de quien vende, no de
  AgroBoeda. El aviso no promete que se haga: le dice a quien vende qué le
  toca.
- **P3, propuesta de PM para el texto de quien vende en la orden cerrada:**
  agregar que, si la entrega, baje el stock de la publicación. Hoy la unidad
  sigue a la venta en el catálogo, y en una publicación de una sola unidad
  (un tractor) otra persona la puede volver a comprar. Lo decide Emi.
- **Se acepta el P2 como está, con su efecto:** si apagar el link falla, queda
  abierto hasta el barrido siguiente. **El reconciliador no está programado en
  ningún lado** (lo dice `reconciliar.py`). Sin eso, no hay barrido siguiente:
  el link de una orden cobrada queda abierto y las reservas de las órdenes que
  nadie paga no vencen. **Programarlo en Railway es condición para habilitar
  Mercado Pago.** Es un cambio de Railway, así que pide tarea explícita y
  autorización de Emi.
- **P3, sin tarea:**
  - no hay caso para una orden cerrada que además tiene dos cobros; el código
    manda los dos avisos y la pantalla dice el texto de la orden cerrada;
  - «mercadería» también se dice cuando la publicación es un servicio, igual
    que en los textos anteriores;
  - el panel de administración no ve estos pagos.

No se tocó `main`, Railway ni datos reales.
