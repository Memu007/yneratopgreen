# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## LOCALITY-LABEL-DISPLAY-1 — entregada, para tu revisión

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `d6c19f4` |
| candidato (backend + pantallas + caso 189 + negativos) | `0830ac2` |
| no integrado, no desplegado | `main` sigue en `0bd7fbc` |

**Resultado.** Una publicación en «San Pedro» de Choya dice «San Pedro
(Choya), Santiago del Estero» en:

- la tarjeta y la ficha;
- el checkout;
- el traslado de la orden;
- las operaciones del transportista.

Los transportistas con base homónima la muestran igual. Las no homónimas se
ven como antes: «Pergamino, Buenos Aires». El rótulo más largo del padrón
entra entero en la tarjeta y en la ficha a 360 px, sin ensanchar el
documento: «Malvinas Argentinas (Malvinas Argentinas), Buenos Aires», 55
caracteres. No hay migración, datos reescritos ni campos cambiados; la API
sólo agrega campos.

**Lo que decidís vos (no bloquea): el caso 137.** Exige que la ubicación
pública de una publicación tenga exactamente tres campos, y ahora tiene
`locality_label`. Lo actualicé para aceptarlo, con el motivo al lado: es el
mismo lugar, con el departamento sólo en las homónimas. Siguen prohibidos,
sin cambios, las coordenadas, el domicilio y la clave `department`. Si
preferís que el 137 no cambie, la alternativa es no mandar el rótulo y
armarlo en la pantalla, pero eso duplica la regla. **Recomiendo dejarlo
así.**

## Para verificar, lo mínimo

```
SMOKE_CASOS=189 node scripts/smoke.mjs
  → [PASS] 189 … tarjeta y ficha dicen «San Pedro (Choya), Santiago del
    Estero»; la de Pergamino sigue «Pergamino, Buenos Aires». en el checkout,
    «Base: San Pedro (Capital), Santiago del Estero», «a 90 km de San Pedro
    (Choya)» y «desde San Pedro (Choya), Santiago del Estero». la orden ORD-…
    dice «Base: San Pedro (Capital), Santiago del Estero» en «Mis compras». a
    360 px, «Malvinas Argentinas (Malvinas Argentinas), Buenos Aires» entra
    entero en la tarjeta y en la ficha, sin ensanchar el documento. el
    transportista ve su base como «San Pedro (Capital)» y la operación como
    «Retiro en San Pedro (Choya), Santiago del Estero — entrega en San Pedro
    (Guasayán), Santiago del Estero»

python3 scripts/sabotajes_locality_label_display_1.py codigo-de-la-base
  → [ROJO ESPERADO] [FAIL] 189 … la tarjeta de «Homonima189 Choya …» no dice
    «San Pedro (Choya), Santiago del Estero»: dice «San Pedro, Santiago del
    Estero», falta el departamento
    src y backend despues: como estaban
```

**Antes de correrlos:**

- Los dos necesitan la API en 8000, el frontend de desarrollo en 5173 y la
  siembra demo, con `vendedor@ejemplo.com` y `cliente@ejemplo.com`.
- Cada corrida del 189 deja cosas creadas:
  - registra un transportista nuevo;
  - crea una orden por transferencia del cliente demo; no mueve stock.

  Al final borra sus tres publicaciones y vacía el carrito.
- **El negativo toca el backend.** Reinicia la API con
  `./scripts/entorno_nativo.sh --reiniciar-api` antes y después. Si tu API
  no la levanta ese script, reiniciala vos después de `codigo-de-la-base` y
  de `ficha-sin-rotulo`.
- El caso tarda unos 6 s.

## Inventario: dónde se muestra una localidad del padrón

| lugar | aplicado | medido por el 189 |
|---|---|---|
| Tarjeta del Mercado | sí | sí, también a 360 px |
| Ficha | sí | sí, también a 360 px |
| Checkout: base del transportista candidato | sí | sí |
| Checkout: «a N km de» el origen, y «desde» los orígenes | sí | sí |
| Checkout: base del transportista ya elegido | sí | no, es la misma línea que el candidato |
| Traslado de la orden en «Mis compras» | sí, campo nuevo `carrier_base_label` | sí, API y pantalla |
| Traslado de la orden en «Mis ventas» | sí, el mismo bloque que «Mis compras» | no |
| Panel del transportista: su localidad base | sí | sí |
| Panel del transportista: retiro y entrega de sus operaciones | sí | sí |
| Tarjetas de Inicio y Servicios | sí, la misma tarjeta y la misma respuesta | no |
| Selectores | ya estaba, `LOCALITY-DEDUP-1` | — |

**Dónde no lo apliqué, y por qué:**

- **El texto `location` guardado en cada publicación** («San Pedro, Santiago
  del Estero»). Ninguna pantalla lo muestra; lo busqué. Reescribirlo sería
  tocar datos guardados.
- **El origen congelado en cada ítem de orden** (`origin_locality_name`). No
  se reescribe. Al mostrarlo en las operaciones, el rótulo sale del id del
  mismo snapshot, no de la publicación de hoy.
- **El domicilio del vendedor, la ubicación del perfil y la dirección de
  envío.** Son texto libre, no vienen del padrón.
- **El panel de administración.** No muestra localidades del padrón; sólo
  filtra por provincia.
- **Los correos.** Ninguno nombra una localidad.

## Cómo

- **`app/services/padron.py`.**
  - Nueva `rotulos(db, ids)`: calcula el rótulo con la misma regla del
    selector, que ahora vive en una sola función.
  - Una anidada lleva el rótulo de su localidad.
  - Mira sólo las localidades que comparten provincia y nombre con las
    pedidas: dos consultas por página del Mercado, dos para la ficha y dos
    por grupo de fletes.
- **Campos agregados:**
  - `locality_label` en la ubicación de la publicación;
  - `label` en `LocalityBrief` y en `DistanceToOrigin`;
  - `base_locality_label` en el candidato;
  - `carrier_base_label` en el traslado de la orden;
  - `carrier_base_locality_label` en el perfil.

  Ningún campo existente cambió de valor.
- **El frontend muestra el rótulo.** Si falta, muestra el nombre.
- **El 137** se ajustó como dije arriba.

## Los negativos

`python3 scripts/sabotajes_locality_label_display_1.py` corre los cuatro:

| negativo | qué rompe | rojo |
|---|---|---|
| `codigo-de-la-base` | backend y pantallas de `d6c19f4` | la tarjeta dice «San Pedro, Santiago del Estero», falta el departamento |
| `ficha-sin-rotulo` | la ficha deja de recibir el rótulo | la ficha, falta el departamento |
| `checkout-con-el-nombre` | el checkout muestra `base_locality_name` | «Base: San Pedro, Santiago del Estero», falta el departamento |
| `rotulo-sin-cortes` | la ubicación de la tarjeta con `white-space: nowrap` | a 360 px el rótulo más largo queda recortado |

## Lo que corrí

```
sobre 0830ac2
  caso 189                                          1/1
  negativos, los cuatro                             rojo esperado, src y backend como estaban
sobre el mismo producto, base limpia
  63 casos (lista abajo)                            62/63: falló el 137 por la clave nueva
  137 y 189 después de ajustar el 137               2/2
  a11y --todas                                      76/76, 0 violaciones
  contraste                                         84/84
  auditoría móvil                                   12/12 recorridos, 39 pantallas, 0 hallazgos, exit 0
build · lint · tsc --noEmit · py_compile · node --check · diff-check   verdes
```

**Los 63 casos:**

- 1–22, los prerequisitos.
- Transportista y fletes: 39, 41–43, 46, 50–58, 110–115, 132, 133, 140,
  149, 151, 154, 156, 157, 164.
- La ubicación en la tarjeta y la ficha: 121, 137, 152, 155.
- Checkout: 176, 178, 184.
- Ficha y localidades: 183, 185, 186, 188.
- El 189.

**Sobre la auditoría móvil:** la siembra demo no tiene localidades
homónimas, así que no ejercita un rótulo más largo. Eso lo mide el 189 a
360 px con el rótulo más largo del padrón, y lo prueba el negativo
`rotulo-sin-cortes`.

Los finales de línea de los quince archivos quedaron como estaban: el diff
con y sin `--ignore-cr-at-eol` da lo mismo.

## Riesgos

- El perfil calcula el rótulo de la base al serializarse, con una o dos
  consultas chicas por pedido de `/auth/me` o de ingreso.
- Si se reimportara el padrón con otras homónimas, los rótulos cambiarían
  solos. No se guardan en ningún lado.

No toqué `main`, Railway, datos ni el padrón, y no desplegué. Freno acá.
