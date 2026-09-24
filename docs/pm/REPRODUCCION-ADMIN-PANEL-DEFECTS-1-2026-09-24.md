# Reproducción PM — ADMIN-PANEL-DEFECTS-1, parte 1

Fecha: 2026-09-24. Base de la tarea `ad5f07d`; producto, caso 190 y negativos
`8f2c543`; ajuste del caso 116 `1ff7b87`; informe Dev `1e0507d`. `main`
permanece en `0bd7fbc`. **Parte 1 verificada; la pieza sigue abierta** por la
vía del checkout que Dev encontró y consultó. Sin integración ni despliegue.

## Qué se revisó

- **P1:** una sola regla, `exigir_que_se_pueda_modificar`
  (`backend/app/api/products.py:39`), en editar, cambiar el estado, borrar,
  subir foto y borrar foto.
  - Quien vende recibe 409 sobre una eliminada.
  - El administrador puede todo.
  - Quien no es dueño recibe 403, como antes.
- **«Agotada»:** el aviso del panel dice lo que pasa y quien vende la ve
  «Agotado».
- **Detalle de la orden en el panel:** `GET /api/admin/orders` agrega los
  artículos, el correo, la dirección, el subtotal y el envío.
- **Cuenta propia:** el panel muestra el motivo que manda el servidor.
- **Guía y script:** la guía saca las advertencias y el script ya no necesita
  que exista `backend/outbox` antes de correr.

## Entorno PM

Base PostGIS Docker recién creada con siembra demo, API nativa, frontend de
desarrollo, `.env` inventados y Chromium 141, que no es el que fija
Playwright 1.62.

**Corrección de método.** En la primera tanda, el reinicio de la API que usa
PM no terminaba el proceso anterior: el nuevo no podía tomar el puerto y
seguía respondiendo el código viejo. Por eso los negativos de backend
parecieron no discriminar. PM rehízo el reinicio: termina el proceso por su
línea de comando y cuenta que quede uno solo. Después repitió los tres
negativos de backend. Sólo cuentan los resultados de la repetición.

## Resultados

| Verificación | Resultado |
|---|---|
| Caso 190 sobre la candidata | **1/1**: 7 caminos de quien vende rechazados sin tocar la fila; el administrador la reactiva; pausar y activar lo propio sigue funcionando |
| Negativo: `products.py` de la base | **rojo**, y nombra los seis caminos abiertos |
| Negativo PM: sólo «borrar foto» sin la regla | **rojo**, nombra sólo `DELETE /products/{id}/images/{imagen}` |
| Caso 190 después de restaurar | **1/1** |
| Negativo: `admin.py` de la base | **rojo** en el paso 14: «el detalle no dice el correo de quien compra» |
| Negativos de interfaz de Dev (panel, «Mis publicaciones», tabla en el celular) | **tres rojos esperados**, en los pasos 8, 12, 13 y 14 |
| `guia-admin.mjs` | **26/26** en escritorio y **26/26** en celular |
| a11y `--todas` / contraste / auditoría móvil | **76/76**, **84/84**, **12/12** sin desbordes |

## La vía que queda abierta: el checkout

PM la reprodujo por API sobre esta base:

1. quien compra agrega una publicación al carrito;
2. el administrador la pasa a «Eliminada»;
3. `POST /orders/checkout/transfer` responde **200** y crea la orden
   `ORD-20260924-45EAA453`, en espera del comprobante.

El carrito controla el estado al agregar y al sincronizar, pero el checkout
sólo mira el stock. PM restauró la publicación después de la prueba. Todo fue
local.

**Decisión PM:** es la opción 1 de Dev. El checkout rechaza cualquier
publicación que no esté activa (eliminada, pausada o agotada) antes de crear
la primera orden, con un mensaje que la nombra. El Mercado tampoco muestra
ninguno de esos tres estados.

## Otras decisiones PM

- **Órdenes que ya existían** sobre una publicación eliminada: siguen su
  curso. Bloquearlas dejaría varada una orden ya pagada. Se acepta.
- **Carrera entre fotos y borrado**: si quien vende sube una foto en el mismo
  instante en que el administrador elimina, la foto puede quedar. La
  publicación queda eliminada igual. Se registra como **P3**, sin tarea.
- **Caso 187 inestable:** a Dev le falló 1 de 3 veces, porque dos
  publicaciones de la siembra perdieron la marca a mitad de la suite. No se
  sabe por qué. PM corre la suite completa sobre la candidata final para
  buscarlo.

No se tocó `main`, Railway ni datos reales.
