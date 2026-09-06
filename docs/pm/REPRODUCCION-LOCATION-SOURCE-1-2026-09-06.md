# Reproducción PM — LOCATION-SOURCE-1 — 2026-09-06

## Decisión

**Devuelta.** Producto/regresión `9bb56ac`, informe `06ea083`.

La solución reemplaza el texto libre por el identificador oficial y cierra el
recorrido principal, pero permite declarar guardada una selección incompleta
sin modificar la ubicación persistida.

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
