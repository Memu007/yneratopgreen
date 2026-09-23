# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## MOBILE-CHECKOUT-1 — entregada, para tu revisión

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `32560c6` |
| candidato (checkout + auditoría + caso 184 + negativos) | `f820146` |
| capturas antes/después | `docs/pm/evidence/checkout-movil-2026-09-23/` |
| no integrado, no desplegado | `main` sigue en `0bd7fbc` |

**Resultado.** El recorte se reproduce y queda corregido. A 360 y 390 px, la
capa del checkout se desplazaba de costado. Quedaban fuera de la vista
rótulos, campos, opciones de traslado, «Confirmar» y el total a pagar. Ahora
no queda nada afuera, y a 768 no cambia nada: las capturas de antes y después
son idénticas byte a byte. La auditoría completa los 12 recorridos: las tres
compras eligen el traslado por cuenta propia y llegan al pago. Mide el envío
y el pago, y también la capa del checkout.

**Dos cosas para que sepas; ninguna bloquea.**

1. **Sobre la base demo limpia, la auditoría sigue saliendo con 1, y es por
   la ficha que entregué yo.** A 360 px, la ficha de «Campo Agrícola de 120
   Hectáreas» mide 366 px, que es el desborde que ya viste. Aparece cuando
   esa publicación es la primera tarjeta. Después de correr casos smoke, la
   primera es otra y la auditoría sale con 0: así salió sobre `f820146`. Mi
   caso 183 midió a 390 px con un insumo sin foto, así que no lo cubría; ese
   hueco es mío. Lo dejé para `FICHA-MOBILE-WIDTH-1`, como pediste, y
   recomiendo que sea la pieza siguiente: es lo único que le queda a la
   auditoría para salir con 0 siempre.
2. **Me pasé un poco del alcance literal, dentro de la misma capa.** La cruz
   de cerrar tapaba 23 px del paso 3 del progreso a 360 y 8 px a 390. No es
   campo, rótulo ni opción, pero es la misma capa, el mismo ancho y dos
   reglas de CSS. También separé «Envío:» de «A coordinar con el vendedor»,
   que se tocaban. Si no lo querés en esta pieza, se saca sin tocar lo demás.

## Medidas

Publicación demo «Fertilizante Triple 15 - NPK», compradora
`cliente@ejemplo.com`, recorrido real: ingresar, agregar, «Continuar
compra», completar el envío, elegir el traslado y llegar al pago. Cada celda
dice cuánto mide el contenido para el ancho de la capa. La página nunca
desbordó: el documento midió siempre lo mismo que la pantalla.

| ancho | paso | antes | fuera de la vista, antes | después |
|---|---|---|---|---|
| 360 | envío | 432 / 320 | 19 a 25 | 320 / 320, 0 |
| 360 | pago | 491 / 320 | 9; en la captura, «Confirmar» y el total cortados | 320 / 320, 0 |
| 390 | envío | 432 / 350 | 19 a 25 | 350 / 350, 0 |
| 390 | pago | 491 / 350 | 9 | 350 / 350, 0 |
| 768 | los dos | 728 / 728 | 0 | igual |

Las causas, medidas:

- **Envío:** el select de provincia necesita 400 px para «Tierra del Fuego,
  Antártida e Islas del Atlántico Sur», y la columna del grid tomaba ese
  mínimo.
- **Pago:** el grupo es un `fieldset`, que toma por omisión el ancho de su
  contenido. El CBU de 22 dígitos no se parte. «Transferencia» iba a 36 px
  al lado de su descripción, y los dos botones tenían 32 px de relleno por
  lado.

## Para verificar, lo mínimo

```
SMOKE_CASOS=184 node scripts/smoke.mjs
  → [PASS] 184 … 360x800: envío 320/320, pago 320/320 con CBU; 390x844:
    envío 350/350, pago 350/350 con CBU; 768x1024: envío 728/728, pago
    728/728 con CBU. La cruz de cerrar no tapa ningún paso del progreso, y
    no se creó ninguna orden

python3 scripts/sabotajes_mobile_checkout_1.py recorte-original
  → [ROJO ESPERADO] caso 184: [FAIL] … 360x800, Datos de envío: la capa del
    checkout mide 320 px y su contenido 432 …
    auditoría: salida 1; recortes en la capa en 360x800 y 390x844, envío
    y pago; compras cortadas: 0
```

Los dos necesitan la API en 8000, el frontend de desarrollo en 5173 y la
siembra demo, con «Fertilizante Triple 15 - NPK» activa y
`cliente@ejemplo.com`. El caso vacía el carrito de esa compradora antes y
después, y no crea órdenes. El sabotaje tarda unos 3 minutos, porque corre
el caso y la auditoría entera.

## Qué cambió

- **Checkout** (sólo `CheckoutModal.module.css`):
  - los bloques del paso y el grupo de pago ya no toman el ancho mínimo de
    su contenido, y los campos ocupan el ancho que hay;
  - hasta 480 px, el medio de pago se apila y el CBU va entero debajo de su
    rótulo;
  - Volver y Confirmar siguen lado a lado, con menos relleno;
  - el progreso le deja la esquina a la cruz.

  No hay cambios de pagos, backend, datos ni otros modales.
- **Auditoría:**
  - la compra elige «Coordino el traslado por mi cuenta» en cada pedido,
    como una persona;
  - mide el envío y el pago, y en esas dos pantallas mide también la capa
    del checkout; sólo ahí, así que la tabla de administración no cuenta;
  - si un recorrido se corta, el motivo agrega lo que dice la pantalla.
- **Caso 184:** el recorrido de arriba, en los tres anchos. En cada paso,
  nada fuera de la capa y la cruz sin tapar el progreso.
- **Negativos** (`scripts/sabotajes_mobile_checkout_1.py`):
  - `recorte-original`: el CSS vuelve a la base. El 184 falla, y la
    auditoría lo cuenta como recorte en la capa a 360 y 390, no a 768, como
    hallazgo de UI y sin cortar las compras.
  - `recorrido-anterior`: la auditoría de la base corta las tres compras
    esperando «Medio de pago».
  - `sin-decidir-traslado`: la auditoría nueva sin elegir el traslado corta
    las tres y dice por qué: «la pantalla dice: «Falta decidir cómo se
    traslada un pedido.»».

## Lo que corrí

```
sobre f820146
  caso 184                                  1/1
  negativos                                 3/3 rojos esperados, árbol como estaba
  auditoría 360/390/768                     12/12 recorridos; 39 pantallas;
                                            0 recortes en 6 medidas de la capa;
                                            0 desbordes; 0 consola; 0 4xx/5xx;
                                            salida 0
  a11y --todas                              74/74 pantallas, 0 serious o
                                            critical, 0 minor o moderate; el
                                            checkout en celular y escritorio
  contraste                                 82/82 mediciones, TODO OK
  build · lint · tsc --noEmit · node --check  verdes
  diff-check compatible con CRLF            sin avisos

sobre el árbol del candidato antes del commit (el commit sólo agregó un
comentario al CSS)
  1–6 + los 23 casos que pasan por el checkout + 184, base limpia
                                            29/30; falló el 19
  1–19 en orden, base limpia                19/19
```

El 19 falló porque usa al vendedor que arman los casos 7 a 18, y yo no los
había incluido. En orden, pasa. No corrí la suite completa, como pediste.

## Visto y no tocado

- A 360 px, el texto de ejemplo de «Dirección Completa» («Av. San Martín
  1234, Piso 5, Depto B») no entra en su campo. El campo está entero y lo
  que se escribe se desplaza adentro; es sólo el ejemplo.
- Revisé el alta de publicación, que usa el mismo select de provincia dentro
  de una capa: a 360 y 390 px no desborda.

No toqué `main`, Railway, backend ni datos, y no desplegué. Freno acá.
