# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## ADMIN-PANEL-DEFECTS-1, parte 2: el checkout — entregada

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `3cc4798` |
| candidato | `7ed5099` (regla, caso 191 y negativo) y `10f1bd6` (el caso también termina la compra en la pantalla) |
| migración o datos | ninguno |
| no integrado, no desplegado | `main` sigue en `0bd7fbc` |

**Resultado.** El checkout rechaza cualquier publicación que no esté activa
antes de crear la primera orden.

- **La regla.** Sirve para eliminada, pausada y agotada, y en las dos rutas.
  Responde 400 con ««nombre» ya no está disponible. Quitala del carrito para
  continuar.», la misma frase que ya usaba la sincronización del carrito. No
  se crea ninguna orden ni se reserva stock.
- **El caso 191** da 1/1. Su negativo, con el `checkout.py` de la base, da
  rojo y nombra los seis cruces de estado y ruta.
- **Nada para decidir.** Tampoco hizo falta frenar: ningún recorrido
  existente compra a propósito algo que no esté activo. La regresión lo
  confirma (abajo).

**Lo que encontré en la pantalla.** El aviso ya se veía antes de este
cambio, y un paso antes de lo que esperaba:

- el checkout vuelve a sincronizar el carrito al calcular «Cómo se traslada
  cada pedido», en el paso de envío;
- esa sincronización ya rechazaba lo que no está activo.

Por eso lo que estaba abierto era sólo la API, que es donde cae el negativo.
El caso comprueba igual la pantalla, que es lo que pediste.

## Cómo quedó

`exigir_publicaciones_activas` (`backend/app/services/checkout.py`) está en
`preparar`, después de la regla «nadie compra lo suyo» y antes de todo lo
demás. Las dos rutas pasan por ahí:

- `POST /orders/checkout/transfer`;
- `POST /orders/checkout`, la combinada.

El carrito queda activo para que la persona la saque y siga.

## El mensaje en la pantalla

Lo medí a 390 px y a 1280 px:

- **Qué pasa.** Quien compra agrega dos publicaciones desde su ficha, el
  administrador elimina una, y quien compra abre el checkout y completa el
  envío.
- **Dónde aparece.** En la sección «Cómo se traslada cada pedido», arriba de
  «Continuar al pago», sale el aviso «Semilla de maíz … ya no está
  disponible. Quitala del carrito para continuar.». Está dentro de la
  pantalla en los dos anchos y no se puede seguir al pago.
- **Cómo se sigue.** A la derecha en escritorio, y abajo en el celular, el
  «Resumen del Pedido» tiene «Quitar del carrito» en cada artículo. Al
  sacarla, el aviso se va, se elige el traslado, se paga por transferencia y
  se crea la orden, sólo con la otra publicación. El caso 191 hace todo este
  recorrido en los dos anchos.

## Para verificar, lo mínimo

```
./scripts/entorno_nativo.sh --reiniciar-api          si la API ya corría con el código anterior
SMOKE_CASOS=191 node scripts/smoke.mjs
  → [PASS] 191 Lo que el Mercado ya no ofrece no se compra desde un carrito viejo — eliminada, pausada
    y agotada: las dos rutas responden 400 nombrando la publicación, sin crear órdenes ni reservar
    stock. sacada del carrito, el resto se compra: una orden, sólo con la otra. en la pantalla, a
    390 px y en escritorio, el aviso nombra la publicación, no se crea la orden, y sacada desde el
    resumen, la compra del resto termina
python3 scripts/sabotajes_admin_panel_defects_1.py checkout-de-la-base
  → [ROJO ESPERADO]
      [FAIL] 191 … el checkout dejó pasar lo que no está activo: deleted por /orders/checkout/transfer
      respondió 200 sin nombrar la publicación y creó órdenes o reservó stock; deleted por
      /orders/checkout …; paused por … (dos); sold_out por … (dos)
    src y backend despues: como estaban
```

El caso tarda unos 15 s. El negativo, un poco más de 1 min, porque reinicia
la API antes y después.

## Lista de regresión

**Cómo la elegí.** Busqué en `scripts/smoke.mjs` los casos que llegan al
checkout de cualquier forma:

- directo, por `/orders/checkout` o `/orders/checkout/transfer`;
- por los ayudantes que compran: `crearOrdenTransferencia`,
  `ordenMercadoPago` y `comprarPorLosDosCaminos`;
- por la pantalla, con «Confirmar y crear las órdenes».

Son 59 casos, que cubren checkout, transferencia, Mercado Pago simulado,
stock, logística y la regla «nadie compra lo suyo». Les sumé los casos 1 a 7,
que arman las sesiones y el carrito de los primeros, y el 190.

```
entorno_nativo.sh --recrear, y SMOKE_CASOS con los 67:
  1–8, 14, 15, 18, 19, 22–28, 44, 51, 53, 54, 56–61, 74–79, 81, 83–100, 116, 140, 141, 145,
  148, 149, 153, 160, 165, 176, 189, 190, 191
  → 64/67. Fallaron 19, 23 y 27:
      27  «el caso 13 no dejó la publicación cara»: depende del 13, que no estaba en la lista
      23  401 «Token no encontrado»: la sesión la arma un caso anterior que no corrió
      19  la compra por la pantalla se cortó esperando un control 30 s; no busqué por qué,
          porque en la corrida seguida pasa

entorno_nativo.sh --recrear, y SMOKE_CASOS=1..30 seguidos
  → 30/30, con 19, 23 y 27 en verde
```

Además, en `7ed5099`: tipos, lint, build, `compileall`, `node --check`,
`py_compile` y diff-check con `cr-at-eol`, verdes. `src/` no cambió en esta
parte.

## Riesgos

- **Una ventana dentro del mismo pedido.** La regla mira el estado en
  `preparar`. `crear_ordenes` no vuelve a mirarlo, por diseño: ahí «no se
  valida nada». Si el administrador elimina la publicación en los
  milisegundos entre una cosa y otra, esa orden se crea. Es la misma clase
  que la carrera de las fotos que dejaste como P3.
- **El aviso sale en el paso de envío**, no al confirmar. Es el paso donde
  hoy se vuelve a mirar el carrito, y el recorrido para seguir funciona desde
  ahí.

No toqué `main`, Railway ni datos reales, y no desplegué.
