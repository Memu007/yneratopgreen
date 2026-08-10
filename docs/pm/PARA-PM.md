# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-10.

## 1. Resultado

**Terminado.** Sin desvíos ni decisiones pendientes.

Tenías razón otra vez, y el diagnóstico era exacto, línea por línea.

## 2. Commit y alcance real

`5924fbb`, este informe aparte. **Un archivo, seis líneas**: sólo
`scripts/contraste.mjs`, como pediste. Nada de `src/`, backend ni dependencias.

```js
const todoBien = fallos.length === 0;
```

`fallos` pasa a ser la única fuente de verdad. Antes `todoBien` miraba
`reales.length && cobertura` y dejaba afuera todo lo demás que pasa por `ok()`
—hoy, el desborde horizontal—. Aproveché para que el cierre **enumere qué
falló** en vez de dar sólo un número: cuando el comando muere quiero saber por
qué sin volver a correrlo.

## 3. Evidencia

### Rojo temporal, forzando un desborde real

Inserté un `<div>` de 5000 px de ancho antes de cada comprobación, corrí, y
restauré el guion. La rotura no se versiona.

```text
34 FALLOS:
  · escritorio portada: sin desborde horizontal
  · escritorio portada (foto blanca): sin desborde horizontal
  …
  · movil administración: sin desborde horizontal
SALIDA=1
```

Las 34 mediciones detectaron el desborde y el comando salió con **1**. Con el
código anterior, esas mismas 34 líneas se habrían impreso y la salida habría
sido **0**.

### Estado final, con el guion restaurado

| Comprobación | Resultado |
|---|---|
| `npm run contraste` | **34 de 34 mediciones**, 0 fuera de umbral, salida **0** |
| `npm run a11y -- --todas` | **40 de 40 pantallas**, 0 de cualquier impacto, salida **0** |
| `npm run build` | verde |
| `git -c core.whitespace=cr-at-eol diff --check` | sin avisos |
| Diff | 1 archivo, 6 inserciones, 2 borrados |

**No corrido en esta pieza:** la suite. El cambio no toca `src/`, backend ni
`scripts/smoke.mjs`, y la última corrida sobre este mismo código dio 25/25. Si
querés el número igual, la corro y te lo agrego; son unos minutos.

## 4. Desvíos, riesgos y hallazgos fuera de la tarea

Ninguno. No toqué nada más.

**Lo que conviene registrar:** en cuatro piezas seguidas, tres falsos verdes
salieron de mis propias herramientas de verificación y no del producto. El
patrón es siempre el mismo —una comprobación que existe pero no llega a la
salida— y las tres las encontraste vos leyendo el código, no corriéndolo.

Queda vivo el riesgo que ya te señalé y que esta pieza no cierra: las listas
`ESPERADAS` las mantengo yo. Si el producto suma una pantalla y nadie la anota,
las dos puertas siguen en verde sin cubrirla.

## 5. DECISIÓN SOLICITADA

Ninguna. Quedo a la espera de la orden del **seed con datos bancarios demo**;
no lo empiezo sin ella.

El entorno local sigue levantado.
