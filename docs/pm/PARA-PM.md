# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-11.

## 1. Resultado

**Corregido.** El commit es **`1ec7082`**, sobre `e3fe9cb`; este informe va
aparte y encima.

**Tenías razón, y el hallazgo es bueno.** Dos archivos: `CheckoutModal.tsx` y
el tramo de pantalla del caso 43. La suite sigue en 44 casos y el barrido en 52
pantallas.

## 2. El falso verde, con nombre y apellido

Tu diagnóstico es correcto en las tres partes. Lo resumo con lo que agregué al
mirarlo:

El carrito que ve la persona vive en el navegador. El servidor arma los grupos
con **su** carrito, y ese sólo se sincroniza al avanzar al pago. Entre que
alguien abre el checkout y elige destino, el carrito del servidor puede estar
vacío, o traer lo de una sesión anterior. El listado describía, entonces, un
viaje que no era el suyo.

Y mi caso 43 no lo veía **porque yo mismo se lo escondí**: preparaba el carrito
del servidor por API y recién después abría la interfaz. Los dos coincidían por
construcción. Es exactamente la clase de prueba que mide el andamio en vez del
producto.

## 3. Qué hice

| Punto que pediste | Cómo quedó |
|---|---|
| Sincronizar y esperar antes de la primera consulta | `/cart/sync` con el carrito local exacto, y recién después la búsqueda |
| Si falla la sincronización, no consultar | se corta ahí y se muestra el motivo real de la API |
| Carga que cubra las dos operaciones | un solo estado desde antes de sincronizar hasta después de responder |
| Protección de respuestas tardías en ambas | el número de consulta se comprueba después de cada espera |
| Invalidar si el carrito cambia | un retrato del carrito visible dispara el efecto |
| Reutilizar sólo con el mismo snapshot | se reutiliza únicamente si el retrato es idéntico al que se mandó |

El retrato es la lista de `producto × cantidad` ordenada. Si cambia una
cantidad, cambia el retrato, y se vuelve a sincronizar antes de mostrar nada.
Si un error deja la sincronización a medias, el retrato guardado se borra, así
que el intento siguiente vuelve a sincronizar en vez de confiar en algo que no
pasó.

## 4. La regresión que reemplaza al falso verde

Tomé tu caso preferido, tal cual:

```text
[PASS] 43 … el listado sigue al carrito armado en pantalla, no al del
  servidor; sin contacto en JSON ni DOM
```

El tramo de pantalla ahora:

1. carga el carrito **del servidor** con el producto del vendedor A;
2. abre el navegador con `agromarket_cart` **borrado**: la persona empieza sin
   carrito propio;
3. busca por nombre el producto del vendedor **B** y lo agrega sólo desde la
   interfaz;
4. abre el checkout, elige destino;
5. exige que el listado diga **«Envío de B»**, que **no** nombre a A, y que el
   carrito del servidor haya quedado con un solo ítem: el de B.

**Rojo forzado, que es lo que faltaba la vez pasada.** Saqué la sincronización
previa y el caso falló nombrando el defecto:

```text
[FAIL] 43 — el listado no habla del carrito visible (Terneros Angus - Lote 20
  cabezas): "…Envío de Administrador TopGreen desde Rosario, Santa Fe…"
```

Ese rojo es la prueba de que ahora el caso mide la integración y no el andamio.

Conservé intactas la comparación con PostGIS grupo por grupo y la comprobación
de privacidad; lo único que cambió del caso es de dónde sale el carrito del
tramo de pantalla.

## 5. Estado final

| Comprobación | Resultado |
|---|---|
| Suite completa, base recreada | **44/44** |
| Caso 43 sin la sincronización previa | rojo, nombrando el producto que falta |
| `npm run a11y -- --todas` | **52/52**, 0 violaciones de cualquier impacto |
| `npm run build` | verde |
| `git -c core.whitespace=cr-at-eol diff --cached --check` | sin avisos |

No repetí contraste: no toqué un solo color ni estilo. No toqué migración,
regla geográfica, declaración, persistencia de órdenes ni Railway, y no abrí
selección, contacto ni asignación.

## 6. Riesgos

**Uno, y conviene que lo sepas.** Ahora el carrito del servidor se sincroniza
al elegir destino, no sólo al pagar. Es más temprano que antes, pero es la
misma escritura que ya hacía el checkout y sin ella el listado no puede ser
cierto. Efecto secundario real: si alguien abre el checkout y no compra, su
carrito de servidor queda igual al visible. Me parece correcto —son el mismo
carrito—, pero es un cambio de momento y no quiero que aparezca como sorpresa.

**Sigue abierto el `float` del checkout**, obligatorio antes de Fase 4.

El entorno local sigue levantado: API en `:8000`, Vite en `:5173`, base
recreada y con seed.
