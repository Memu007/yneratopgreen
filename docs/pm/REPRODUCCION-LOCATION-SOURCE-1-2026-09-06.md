# Reproducción PM — LOCATION-SOURCE-1 — 2026-09-06

## Decisión

**Aceptada después de corrección.** Pieza base `9bb56ac`, informe `06ea083`;
corrección `025753c`, informe `266c434`.

La pieza inicial reemplazó el texto libre por el identificador oficial y cerró
el recorrido principal, pero permitió declarar guardada una selección
incompleta sin modificar la ubicación persistida. LOCATION-SOURCE-1R cerró ese
borde y habilitó la aceptación final.

## Diff y procedencia

- base de la tarea: `d7cb343`; base de producto para el rojo: `042a3e3`;
- producto/regresión: `9bb56ac`; informe y `HEAD`: `06ea083`;
- tres archivos de producto/regresión: 414 inserciones y 37 eliminaciones;
- `diff-check` con `core.whitespace=cr-at-eol`: limpio;
- hashes SHA-256 reproducidos por PM:

```text
551a38d90b159abaa3675fcb573f1e9ad085da3d935d9e6b5cbb35fe25183bcb  backend/app/api/products.py
b4f316e96f65ee7f2b91e058caaaa18a937e919c596337d96cb81355b41fd544  src/components/UserDashboard/UserDashboard.tsx
28bd4719d3bdbc81d20f5a1cb869464493f7ec6a1cc82c7927810ee780f18f81  scripts/smoke.mjs
```

No hay modelos, migraciones, estilos, pagos ni infraestructura en el diff.

## Regresión discriminante reproducida

PM ejecutó el caso 152 actual con PostgreSQL, API, Frontend y Chromium locales;
Mercado Pago permaneció apagado y no participaron Railway ni datos remotos.

Contra `042a3e3`:

```text
[FAIL] 152 — el editor no ofrece un select de localidad del padron
0/1 pasaron; 1 fallaron
```

Contra `9bb56ac`:

```text
[PASS] 152 — la ubicación publicada sale del padrón y de ningún otro lado
1/1 pasaron; 0 fallaron
```

El verde cubre ID y texto derivados, recarga, tarjeta, detalle, filtros,
representación heredada y suciedad. La fila heredada se simula en la respuesta
de `/products/my`; para esta devolución se acepta ese límite porque el payload
sin ubicación sí queda inspeccionado y no hay una ruta real que cree la fila.

## Rojo adicional de PM

Sobre `9bb56ac`, PM abrió una publicación persistida en Rosario, eligió sólo la
provincia Buenos Aires y guardó con la localidad vacía:

```json
{
  "initial_locality_id": "82084270",
  "selected_province": "Buenos Aires",
  "selected_locality_id": "",
  "patch_has_locality_id": false,
  "patch_status": 200,
  "success_message": true,
  "stored_locality_id_after": "82084270",
  "silent_noop": true
}
```

El Frontend vacía `locality_id` al cambiar provincia y luego sólo lo agrega al
payload si es verdadero. No valida que la selección esté completa, por lo que
el Backend recibe un PATCH válido sin ubicación y conserva el ID anterior.

## Límite deliberado de revisión

PM no corrió la suite completa ni repitió build, lint, Backend o a11y: el rojo
de aceptación ya determina la devolución y repetir puertas no cambiaría el
dictamen. Dev informó una suite 151/152 con el rojo ambiental conocido en 131 y
las demás puertas verdes; esa evidencia sigue siendo de Dev, no de PM.

No hubo despliegue, pagos, secretos ni datos remotos. La base, los servicios y
los checkouts usados por PM fueron locales y descartables.

## Cierre de LOCATION-SOURCE-1R

La corrección queda limitada a `UserDashboard.tsx` y al caso 152: 88
inserciones y 4 eliminaciones. Guarda el par inicial provincia/localidad y, si
la ubicación fue tocada pero quedó sin localidad, frena antes del PATCH, deja
el error persistente como alerta, marca el select inválido y lo enfoca. La fila
heredada intacta sigue pudiendo guardar otros campos.

Hashes SHA-256 reproducidos por PM:

```text
fd3313b7ba631ac7cc92a2c54adda71718548ed0075c0ac13b1513e3a98218fb  src/components/UserDashboard/UserDashboard.tsx
6ffb298a5f0c80be2b5a18d6cbf449ecc975dac7a103041af1d0436e71780ad4  scripts/smoke.mjs
```

PM no volvió a pagar el rojo contra `9bb56ac`: ya estaba reproducido y
persistido arriba. Desde una base PostgreSQL local limpia reprodujo el verde:

```text
[PASS] 152 — media selección de ubicación no guarda ni declara éxito; el resto
del recorrido oficial, heredado y de suciedad continúa verde
1/1 pasaron; 0 fallaron
```

Puertas independientes de PM:

```text
npm run build                                             OK (incluye tsc)
npm run lint                                              OK
node --check scripts/smoke.mjs                            OK
git -c core.whitespace=cr-at-eol diff --check             OK
```

No se repitieron Backend, `pip check`, contraste, a11y completa ni la suite
completa porque la corrección no los toca y Dev ya ejecutó una sola corrida:
151/152, con el único rojo ambiental conocido en 131. Esa suite sigue siendo
evidencia de Dev.

Riesgo menor aceptado: si se vacía también Provincia, Localidad queda
deshabilitada y no puede recibir el foco inmediato; la alerta viva igual
anuncia el bloqueo y no sale ninguna escritura. No se reabre sin evidencia de
daño real.

La base sintética, el correo de prueba y los servicios locales fueron
eliminados. Mercado Pago permaneció en `false`; no participaron Railway, datos
remotos ni pagos.
