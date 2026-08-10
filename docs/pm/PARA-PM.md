# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-10.

## 1. Resultado

**Terminado.** La suite pasa de 28 a **31 casos**.

Los cuatro puntos de pruebas obligatorias están cubiertos; el cuarto —que el
flujo válido siga completándose— ya lo cubría el caso 19 y sigue verde.

## 2. Commit y alcance real

`e915d6a`, este informe aparte. Cinco archivos.

| Archivo | Qué |
|---|---|
| `src/components/Checkout/CheckoutModal.tsx` | fuera el respaldo POST/PUT; `role="alert"` |
| `backend/app/api/cart.py` | `sync` rechaza en vez de descartar o recortar |
| `scripts/smoke.mjs` | casos 29, 30 y 31 |
| `scripts/smoke.sh`, `README.md` | el total decía 28 |

Sin migraciones, pantallas nuevas, diseño, Mercado Pago ni instalación. El
refactor de `float` sigue sin abrirse.

## 3. Evidencia

### El respaldo, fuera

`syncBackendCart` eran 26 líneas con un `try/catch` que ante **cualquier** fallo
reintentaba `POST /cart/items` y, si eso también fallaba, `PUT`. Ahora son 4
líneas: una sola llamada, sin `catch`. `apiFetch` ya propaga `errorData.detail`,
así que el motivo real sube sin tocar nada más.

### El contrato de `sync`

| Situación | Antes | Ahora |
|---|---|---|
| publicación inexistente | `continue` silencioso | 400 «ya no existe» |
| publicación inactiva | `continue` silencioso | 400 «ya no está disponible» |
| sin stock | `continue` silencioso | 400 «se quedó sin stock» |
| cantidad > stock | recortaba al stock | 400 «pediste N y quedan M» |
| cantidad ≤ 0 | recortaba o descartaba | 422 del esquema de entrada |

Los cuatro rechazos ocurren en la primera pasada, **antes de borrar el carrito
anterior**. La normalización de duplicados que ya aceptaste se conserva, y el
stock se controla sobre la suma.

### Los tres casos, con su salida

```text
[PASS] 29 Sincronizar no descarta ni recorta en silencio —
  5 motivos distintos con HTTP 400 (inexistente, inactivo, sin stock,
  cantidad mayor al stock, duplicado que suma de más), cantidad 0 con
  HTTP 422, carrito previo intacto en todos, y el sync válido en 200

[PASS] 30 El motivo real de la sincronización llega al comprador —
  aviso visible con role="alert": "⚠️ «Smoke motivo real 1786362325606»
  ya no está disponible. Quitala del carrito "; 0 llamadas de respaldo;
  órdenes 11→11

[PASS] 31 Sin datos bancarios, el comprador ve el motivo del vendedor —
  aviso visible: "⚠️ Juan Vendedor no configuró CBU ni alias bancario"
```

El **29** incluye el duplicado que pediste: 6 + 6 sobre un stock de 10, donde
cada línea entraría sola. Compara las filas del carrito previo producto por
producto y cantidad por cantidad después de **cada** rechazo, no sólo al final.

El **30** desactiva la publicación **con el carrito ya armado en el navegador**,
que es la única forma de reproducir el caso real. Además de leer el aviso,
escucha las peticiones de la página y afirma que hubo **cero** llamadas
`POST/PUT /cart/items`: si alguien reintroduce el respaldo, el caso lo detecta.
Y comprueba que el modal sigue abierto y que no se creó ninguna orden.

El **31** vacía los datos bancarios del vendedor y los restaura en un `finally`.

### Estado final

| Comprobación | Resultado |
|---|---|
| Suite oficial, base recreada desde cero | **31/31** |
| `npm run a11y -- --todas` | **40 de 40 pantallas**, 0 de cualquier impacto |
| `npm run build` | verde |
| `alembic check` | sin diferencias |
| `git -c core.whitespace=cr-at-eol diff --cached --check` | sin avisos |

**No corrido:** `npm run smoke` tal cual, que exige Docker; corrí la misma suite
contra la base recreada a mano. Tampoco `npm run contraste`: el único cambio de
`src/` es un atributo `role`, que no altera ningún color.

## 4. Desvíos, riesgos y hallazgos fuera de la tarea

**Sin desvíos.**

**Dos errores míos en las pruebas, los dos encontrados corriendo.** Los cuento
porque el síntoma no señalaba la causa:

- el caso 29 daba «carrito previo inesperado» con filas de más. Mi consulta
  contaba los ítems de **todos** los carritos del comprador, y a esa altura
  arrastra once carritos `CONVERTED` de casos anteriores. Ahora filtra por
  carrito `ACTIVE`;
- el caso 30 no encontraba el botón «Agregar». **El primer rubro alfabético,
  "Acopio", es de servicios**, así que la tarjeta ofrece contratar y no agregar.
  Los productos de prueba ahora se publican en un rubro de producto.

**Riesgo que introduce esta pieza, y conviene decirlo.** `sync` pasó de tolerante
a estricto. Un carrito viejo en `localStorage` con una publicación que ya no
existe **bloquea el checkout** hasta que la persona la saque a mano. Es lo que
pediste —mejor eso que una orden silenciosamente más chica— pero el mensaje dice
«quitala del carrito» y hoy hay que hacerlo a mano.

Lo natural sería que el propio aviso ofreciera quitarla, o que el carrito marque
la fila caída. **No lo hice porque es pantalla nueva y está fuera de alcance.**

**Sigue abierto el `float` del checkout**, obligatorio antes de Fase 4.

## 5. DECISIÓN SOLICITADA

**a) El bloqueo del carrito viejo** (punto 4). Beneficio: la persona puede
resolverlo sin adivinar. Esfuerzo: chico si es un botón «quitar» en el propio
aviso; medio si el carrito marca las filas caídas. Riesgo: toca la vista del
carrito. Fase: la misma en la que se retome el checkout. **Recomiendo el botón
en el aviso**, que es lo mínimo que evita el callejón.

**b) El descarte silencioso que te informé la vez pasada** queda resuelto por
esta pieza: ya no se descarta nada. Lo doy por cerrado salvo que digas otra cosa.

El entorno local sigue levantado.
