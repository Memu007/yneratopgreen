# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## AVISOS-DE-PAGO-1: entrega

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `2e86854` (tu asignación) |
| código | `efb743c` |
| casos y negativos | `a97911b` |
| no integrado, no desplegado | `main` sigue en `c92c0d7` |

**Resultado.**

- **Rechazar la transferencia le avisa a quien compra.** Pasa con comprobante
  y sin él.
- **Aprobarla les avisa a las dos partes.**
- **El pago acreditado por Mercado Pago les avisa a las dos partes, una sola
  vez por orden.** Da igual cómo se confirme primero: por el aviso de Mercado
  Pago, por la vuelta de quien compra o por el reconciliador. Las
  confirmaciones repetidas no suman avisos.
- **«Pago aprobado» y «¡Venta confirmada!» se reescribieron:** en «vos» y
  sin prometer envío. «¡Venta confirmada!» pasa a llamarse «Venta pagada»,
  porque confirmar es un paso que todavía falta.
- **El 210 sigue pasando.** Sus cuentas exactas suman los avisos de las tres
  transferencias que aprueba.

**Encontré un P1 que ya existía. No lo arreglé porque está fuera de
alcance.** Tres confirmaciones del mismo pago de Mercado Pago a la vez
cuelgan la API entera: no vuelve a atender a nadie hasta que se la reinicia.
Está abajo, en «Encontrado», con evidencia y recomendación. **Bloquea
habilitar Mercado Pago.** Hoy el sitio publicado no lo tiene habilitado, así
que no está pasando.

**Una pregunta, no bloqueante.** Está en «Para decidir».

## Los avisos

| cuándo | a quién | título | texto |
|---|---|---|---|
| quien vende rechaza el comprobante o la transferencia | quien compra | Transferencia rechazada | «El vendedor rechazó la transferencia de tu pedido #N y el pedido quedó rechazado. El motivo está en Mis Compras.» |
| quien vende aprueba el comprobante o la transferencia | quien compra | Pago aprobado | «El vendedor aprobó la transferencia de tu pedido #N.» |
| lo mismo | quien vende | Venta pagada | «Aprobaste la transferencia del pedido #N. Ya podés confirmar el pedido en Mis Ventas.» |
| Mercado Pago acredita el pago y el producto lo confirma | quien compra | Pago aprobado | «Mercado Pago acreditó el pago de tu pedido #N.» |
| lo mismo | quien vende | Venta pagada | «Mercado Pago acreditó el pago del pedido #N. Ya podés confirmar el pedido en Mis Ventas.» |

**Por qué estos textos.**

- **El rechazo no ofrece mandar el comprobante otra vez.** La orden queda
  rechazada y el producto no lo permite. El motivo lo escribe quien vende, y
  Mis Compras lo muestra; el 211 lo mira.
- **«Ya podés confirmar el pedido en Mis Ventas»** nombra un paso que existe:
  con la orden pagada, Mis Ventas ofrece «Confirmar Pedido». El 211 y el 212
  lo miran.
- **«Acreditó»** es la palabra que el panel ya usa para Mercado Pago («Pago
  acreditado en Mercado Pago.»).

**Dónde sale cada uno. No cambia el orden de lo que hace la API.**

- **Transferencia:** después del `commit` de la decisión, como los demás
  avisos. Si el aviso falla, la decisión queda escrita.
- **Mercado Pago:** en `cobro.aplicar`, en la línea donde la orden pasa de
  «colocada» a «pagada». Es el único lugar donde una orden de Mercado Pago
  queda pagada; lo dice el módulo y lo comprobé.
  - Desde la segunda confirmación, la orden ya no está «colocada» y el aviso
    no sale.
  - El aviso se escribe en la misma transacción, sin `commit`: el webhook y
    el reconciliador tienen la fila bloqueada y deciden cuándo soltarla. Así
    el aviso existe si la transición quedó escrita, y sólo entonces.
  - Va en un savepoint: si escribir el aviso falla, se pierde el aviso y no
    el pago. Lo prueba el negativo `aviso-que-falla`.
  - Lo único nuevo en ese camino es un `flush` antes del savepoint. Escribe
    antes, dentro de la misma transacción, lo que ya se iba a escribir.

## Encontrado: tres confirmaciones a la vez cuelgan la API (P1, ya existía)

**Qué pasa.**

1. El webhook (`procesar_pago`) y la vuelta de quien compra (`sincronizar`)
   toman la fila de la orden con `FOR UPDATE` (`cobro.py:506` y `:553`).
2. Con la fila tomada, esperan a Mercado Pago para apagar el link
   (`await apagar_link`, `:516` y `:575`).
3. Si en ese momento llega otra confirmación, pide la misma fila con una
   llamada síncrona. Esa llamada frena el único bucle de eventos del proceso.
4. La primera ya no puede terminar, y la API no atiende ninguna otra
   petición.

Producción corre un solo proceso de uvicorn (`backend/railway-entrypoint.sh`).

**Evidencia.**

- Reproducido 4 de 4 veces con el backend de antes de esta pieza
  (`2e86854`), y 2 de 2 con el nuevo. `main` tiene el mismo código.
- A los 43 segundos, la base mostraba esto:

  | pid | estado | espera | consulta |
  |---|---|---|---|
  | 2465 | idle in transaction | Client / ClientRead | `UPDATE products SET stock=…` (la primera, parada en el `await`) |
  | 2492 | active | Lock / transactionid | `SELECT orders… FOR UPDATE` (la segunda, frenando el proceso) |

- Con dos confirmaciones a la vez no se colgó en 9 intentos (6 con el
  backend viejo y 3 con el nuevo). Con tres, sí.
- Lo mismo puede pasar en «Rechazar» o «Cancelar» de una orden de Mercado
  Pago (`orders.py:712` y `:851`): toman la fila y esperan a Mercado Pago en
  `_terminar_el_cobro`. No lo reproduje.

**Cómo verlo:** `SMOKE_CASOS=213 node scripts/smoke.mjs` da rojo en 30
segundos y deja la API colgada. Después hay que reiniciarla. El 213 no es
parte de la suite: corre sólo si se lo pide.

**Recomendación: una tarea aparte, antes de habilitar Mercado Pago.** Tomar
la fila sin frenar el proceso:

- `FOR UPDATE NOWAIT` dentro de un savepoint;
- si está tomada, esperar con `await asyncio.sleep` y reintentar, con tope;
- en los cuatro caminos que toman la fila y después esperan a Mercado Pago.

Se mantiene la regla de que el link se apaga con la fila tomada, y el 213
pasa a la suite.

**Mientras tanto**, el 212 confirma de a una por vez. Cubre la repetición,
no la simultaneidad.

## Para decidir (no bloqueante)

**¿Qué avisa un pago que llega a una orden ya cerrada?** `cobro.aplicar`
tiene un segundo camino a «pagada»:

- un pago que ya estaba en vuelo cuando se apagó el link se acredita después
  de que la mercadería volvió al catálogo;
- la orden vuelve a «pagada», con el pago «en revisión»;
- hace falta que una persona decida.

Ese camino **no avisa**. «Pago aprobado» diría algo que no es cierto: la
venta no está confirmada.

**Recomiendo dejarlo sin aviso** hasta que se diseñe quién revisa esos pagos.
El aviso se escribe con esa decisión.

## Casos y negativos

| caso | qué mira |
|---|---|
| 211 | Con cuentas nuevas y cinco transferencias: un comprobante rechazado con motivo, una transferencia rechazada sin comprobante, una aprobada, decidir otra vez (400, sin avisos nuevos) y aprobar y rechazar a la vez (pasa una sola, con su aviso). Cuenta los avisos exactos de cada orden, para las dos cuentas, en la API. Los lee en «Notificaciones» en escritorio y en celular. En Mis Compras está el motivo y no se ofrece reenviar; en Mis Ventas está «Confirmar Pedido» |
| 212 | Con el doble local de Mercado Pago, tres órdenes. La primera se confirma por el aviso, que llega tres veces, y después vuelve quien compra dos veces. La segunda, primero por la vuelta y después por dos avisos. La tercera, primero por el reconciliador y después por un aviso tardío. Cada orden tiene exactamente un «Pago aprobado» y un «Venta pagada». Se leen en la pestaña en los dos anchos, y en Mis Ventas está «Confirmar Pedido» |
| 213 | Sólo con `SMOKE_CASOS=213`. Hoy da rojo: es el P1 de arriba |
| 210 | Suma «Pago aprobado» y «Venta pagada» de las tres transferencias que aprueba |

**Contra el backend de antes** (`2e86854`):

- el 211 encuentra 18 problemas;
- el 212 encuentra 10;
- todos son avisos que faltan.

`python3 scripts/sabotajes_avisos_de_pago_1.py` → «todos dieron el rojo esperado» y «src y backend después: como estaban»

| sabotaje | rojo |
|---|---|
| `sin-aviso-de-rechazo` | 211: 6 problemas. En la API, las dos órdenes rechazadas no tienen «Transferencia rechazada», y en los dos anchos quien compra no la lee. Nada de la aprobada ni de quien vende |
| `aviso-duplicado` | 212: 2 problemas. La orden que se volvió a consultar tiene tres «Pago aprobado» y tres «Venta pagada». Las tres órdenes quedan pagadas |
| `sin-aviso-de-mercado-pago` | 212: 10 problemas. Faltan los dos avisos en las tres órdenes, en la API, y no se leen en los dos anchos. Las órdenes quedan pagadas |
| `aviso-que-falla` | 212: los mismos 10, avisos que faltan. **Ninguna orden deja de quedar pagada**: el savepoint salva el pago |

**Aviso de entorno.** El script reinicia la API con `REINICIAR_API`, como
pediste. Por omisión usa `./scripts/entorno_nativo.sh --reiniciar-api`. En
tu entorno, por ejemplo: `REINICIAR_API="docker restart topgreen-api"`.

## Cómo verificarlo

Con el entorno arriba y la siembra demo:

```bash
SMOKE_CASOS=210,211,212 node scripts/smoke.mjs
# → 3/3 pasaron; 0 fallaron

REINICIAR_API="<tu reinicio>" python3 scripts/sabotajes_avisos_de_pago_1.py
# → todos dieron el rojo esperado
# → src y backend después: como estaban
```

## Puertas

| puerta | resultado |
|---|---|
| suite completa desde base nueva, sobre `a97911b` | **211/212**. Sólo cae el **131**, de entorno: «puente docker: sólo se traduce 'docker exec'». Pasan el 79, el 96, el 210, el 211 y el 212. El 213 no corre en la suite |
| tipos, lint, build | verdes (`npm run build` incluye `tsc`; lint sin avisos) |
| `compileall`, `node --check`, parseo de Python | verdes (27 scripts de Python) |
| `alembic check` | `No new upgrade operations detected.` |
| diff-check con `cr-at-eol` y finales de línea | limpios sobre `2e86854..a97911b` |
| a11y `--todas` | 80 de 80 pantallas, 0 violaciones |
| contraste | 88 de 88, ninguna por debajo del mínimo |
| auditoría móvil | 12 de 12 recorridos y 39 pantallas: 0 desbordes, 0 controles tapados, 0 errores de consola y 0 respuestas 4xx/5xx |
| `guia-admin.mjs` | «LA GUÍA Y EL PANEL COINCIDEN: 26 pasos en escritorio y celular» |
| `guia-usuario.mjs` | «LA GUÍA Y EL SITIO COINCIDEN: 22 pasos en escritorio y celular» |

## Riesgos

- **El P1 de arriba**, y lo que no sé de él: cuántas confirmaciones a la vez
  hacen falta en producción. Mercado Pago suele mandar el aviso justo cuando
  quien compra vuelve.
- **Quien vende recibe un aviso de algo que hizo.** Al aprobar la
  transferencia le llega «Aprobaste la transferencia…». Lo pediste así; el
  aviso le sirve porque dice el paso siguiente.
- **Las guías no nombran los avisos nuevos.** La de uso dice que no mira
  «Notificaciones». Agregarlos pide pasos nuevos en `guia-usuario.mjs`; no
  lo hice.

---

## NOTIF-TEXTOS-1

Aceptada en `2e86854`. Sin cambios.
