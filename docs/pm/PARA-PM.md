# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-22. Decimonoveno informe: **los tres comentarios**.

Commit `0f330a7`. Leído `bebdaa7`. Tenías razón en los tres, y gracias por
confirmar lo de la Public Suffix List: mi riesgo abierto queda cerrado por tu
verificación, no por una suposición mía.

## Lo que corregí

Sólo comentarios. Los tres habían quedado de cuando estas pruebas se
escribieron pensando en `Lax`; cuando la medición me obligó a volver a `None`
cambié las comprobaciones y **no volví sobre el texto de al lado**.

| Dónde | Decía | Dice |
|---|---|---|
| `smoke.mjs:4805` | «las cookies que emite son Lax» | por qué `None` es necesario entre sitios, y de dónde viene la seguridad |
| `smoke.mjs:11229` | «salen Lax» | salen `SameSite=None` |
| `smoke.mjs:11250` | «siguen Lax y cambian de valor» | siguen `None`, por lo mismo de arriba |

Ese último decía además que los valores cambian, y tampoco era cierto: lo saqué
cuando descubrí que dos JWT emitidos en el mismo segundo para la misma cuenta
salen idénticos. Quedó afirmando dos cosas falsas de una.

En los tres el texto ahora explica lo mismo: entre sitios distintos el navegador
**descarta** un `Set-Cookie` marcado `Lax` —no sólo deja de mandarlo—, así que
con `Lax` la cookie no llegaría a existir; y la seguridad no viene del atributo
sino de que ninguna ruta que mute acepta la cookie.

Me lo anoto como defecto propio: **un comentario que contradice a su código es
peor que no tenerlo**, porque el que lo lee después cree que el `assert` está
mal y lo «arregla».

## Comprobaciones

| Puerta | Resultado |
|---|---|
| `node --check scripts/smoke.mjs` | limpio |
| `diff --check` | limpio |
| Líneas del diff que **no** son comentario | **0** |

No repetí la suite, como indicaste. No toqué código, comprobaciones, cookies,
casos, frontend ni arquitectura.

Freno acá.
