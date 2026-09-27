# Reproducción PM — NOTIF-TEXTOS-1

Fecha: 2026-09-27. Base `4a69064` (la asignación).

- Código: `3e806de`.
- Caso 210, negativos y 79 suelto: `e912d8f`.
- Informe: `4db386b`.

`main` está en `c92c0d7`. **Aceptada en rama**, sin integración ni
despliegue.

## Qué cambia

Seis notificaciones cambian de texto. Ninguna promete dinero, envíos ni
avisos que el producto no da, y todas usan el «vos».

| Notificación | Antes | Después |
|---|---|---|
| Pedido realizado | «Procede al pago» | cómo pagar en Mis Compras |
| Nueva venta | «Tienes» | «Tenés» |
| Pedido confirmado | «Pronto será enviado» | sale |
| Pedido enviado | «Te avisaremos cuando llegue» | confirmá la recepción en Mis Compras |
| Pedido rechazado | «El monto total será reembolsado» | sale |
| Bienvenida | «marketplace», «productos agrícolas» | la frase de Quiénes somos |

Además:

- el comentario de Quiénes somos cita sólo lo que dijo la clienta;
- el caso 79 corre solo.

## Resultados PM

Base PostGIS Docker recién creada, API nativa, frontend de desarrollo y
configuración local inventada, sobre `4db386b`.

| Verificación | Resultado |
|---|---|
| Caso 79 suelto, sobre la base recién creada | **1/1**; antes fallaba con `localityId` |
| Caso 210 | **1/1** |
| Negativos de la Dev: reembolso, «tú», aviso y sin «Confirmar Recepción» | **cuatro rojos esperados**; «src y backend después: como estaban». Corridos con el reinicio de PM en lugar de `entorno_nativo.sh --reiniciar-api`, que no existe en el entorno de PM, sin tocar el script |
| Negativo PM 1: el envío deja de mandar la notificación | **rojo** en el 210: «falta «Pedido enviado …»», en la API y en los dos anchos. El caso cuenta las notificaciones exactas, no sólo lee textos |
| Negativo PM 2: la bienvenida vuelve a «productos agrícolas» | **rojo** en el 210: «dice «marketplace» o «agrícola»», para las dos cuentas |
| Suite completa desde base recién creada | **209/210**; sólo cae el **169**, de entorno; el 79, el 96, el 131, el 191 y el 210 pasan |
| a11y `--todas` / contraste / auditoría móvil | **80/80**, **88/88**, **12/12** sin desbordes |
| `guia-admin.mjs` y `guia-usuario.mjs` después de la suite | 26 pasos y 22 pasos coinciden, en los dos anchos |
| Build, tipos, lint, `compileall`, `alembic check`, diff-check `4a69064..4db386b` con `cr-at-eol` | verdes |

## Decisiones PM sobre el informe

- **El dinero de un pedido pagado por transferencia que se cae:** **opción
  A**, como entregó la Dev. El aviso dice sólo lo que pasó.
  - La opción B, «el reintegro lo arreglás con el vendedor», queda atada a la
    decisión sobre qué datos de contacto ve cada persona. Esa decisión está
    PENDIENTE de Emi.
  - Hoy, en una orden rechazada, quien compra no tiene cómo llegar a quien
    vende desde el producto.
- **Avisos que faltan (P2), a la tarea siguiente, `AVISOS-DE-PAGO-1`:**
  - «Rechazar comprobante» no le avisa a quien compra;
  - aprobar un pago no le avisa a nadie.

  Quien pagó no se entera de lo que pasó con su pago.
- **«Pago aprobado» con «tú»**, que hoy nadie recibe, se reescribe en esa
  misma tarea, cuando se conecte.
- **P3 sin tarea:** unos 15 mensajes de error de la API tratan de «tú». Van
  a una limpieza de texto cuando haya lugar.

No se tocó `main`, Railway ni datos reales.
