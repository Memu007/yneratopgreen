# Reproducción PM — ADMIN-PANEL-DEFECTS-1

Fecha: 2026-09-24. Base de la tarea `ad5f07d`; producto, caso 190 y negativos
`8f2c543`; ajuste del caso 116 `1ff7b87`; informe Dev `1e0507d`. `main`
permanece en `0bd7fbc`. Parte 2 (checkout): `7ed5099` + `10f1bd6`, informe
`d483ede`. **Aceptada en rama** (ver al final). Sin integración ni despliegue.

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

## Parte 2 — el checkout: aceptada; la pieza queda aceptada en rama

Candidato `7ed5099` + `10f1bd6`, informe `d483ede`. La regla
`exigir_publicaciones_activas` (`backend/app/services/checkout.py`) se aplica
en `preparar`: rechaza con 400, y nombrando la publicación, cualquier ítem que
no esté activo. Lo hace antes de escribir nada, en las dos rutas.

| Verificación | Resultado |
|---|---|
| Caso 191 | **1/1**: eliminada, pausada y agotada por las dos rutas, sin órdenes ni reservas; sacada del carrito, el resto se compra; el aviso se ve en la pantalla a 390 px y en escritorio |
| Negativo: `checkout.py` de la base | **rojo**, nombra los seis cruces de estado y ruta |
| Negativo PM: la regla rechaza sólo las eliminadas | **rojo**, nombra pausada y agotada por las dos rutas |
| 191 después de restaurar / 190 | **1/1** / **1/1** |
| `guia-admin.mjs`, base recién creada | **26/26** en escritorio y **26/26** en celular |

### Suite completa sobre la candidata final

La corrió PM sobre una base recién creada, con la configuración local
inventada de `entorno_nativo.sh`. Esa configuración incluye un Mercado Pago
simulado. Una primera corrida sin ella dio 37 rojos de Mercado Pago «no
configurado»; se descarta como error de entorno de PM.

- **Corrida: 171/191.**
  - El **169**, que reinicia la API de verdad, falla en este entorno. Como la
    API no se reinicia, el límite de intentos de ingreso no se limpia, y los
    casos 167, 168 y 170 a 185 caen en cadena con 429.
  - Repetidos después de reiniciar la API, esos 18 casos dan **18/18**.
- **El 131 pasó.**
- **El 187 falló** porque las dos publicaciones de la siembra que tienen
  marca (John Deere y Pauny) la perdieron a mitad de la suite. Solo, con las
  marcas repuestas, pasa **1/1**.
- **Cobertura:** 190 de los 191 casos quedan cubiertos. El 169 es de
  entorno.

**La pérdida de marcas** ocurrió en 3 de 5 suites completas: 1 de 3 de Dev y
2 de 2 de PM. En la corrida 2 de PM, las dos filas cambiaron a las 22:10:05 y
a las 22:11:08 UTC, cerca de los casos 157 a 162 según los tiempos
acumulados.

PM verificó dos cosas:

- repetir la siembra no borra la marca;
- una edición por `PATCH` que sólo cambia el precio o el estado tampoco la
  borra, aunque la respuesta del `PATCH` no incluye `brand`.

Los casos 155 a 163 corridos de a uno tampoco la borran. **La causa sigue
sin encontrarse**: puede ser un caso del arnés o una vía del producto, y
esta última sería una pérdida de datos. Pasa a `BRAND-LOSS-1`.

**P3 del script de la guía:** después de la suite, el paso 2 en celular leyó
«Volumen vendido» sin decimales: 16268903 contra 1626890,3. El script no
contempla importes con centavos. No es un defecto del panel.

**Decisión PM: `ADMIN-PANEL-DEFECTS-1` aceptada en rama.** Sin integración ni
despliegue.
