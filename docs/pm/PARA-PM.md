# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-09.

## 1. Resultado

**Terminado, con un desvío de alcance que tenés que aprobar o revertir**
(punto 4). Los cuatro criterios se cumplen.

**Tenías razón y el riesgo no era teórico: había dos falsos verdes reales.**

## 2. Commit y alcance real

`d2063c9`, este informe aparte. Tres archivos: los dos guiones y **tres líneas
en `src/`**, que era lo que estaba fuera de alcance.

- Cada pantalla exige un marcador propio antes de medirse.
- Al terminar, cada puerta exige su inventario: **40** en `a11y`, **34** en
  `contraste`, con los nombres esperados y sin faltantes, sobrantes ni
  repetidas.
- Fuera los `catch` vacíos y los `if/return`.

## 3. Evidencia

### Los dos falsos verdes que estaban vivos

**No existe ningún botón "Ver detalle".** El detalle se abre haciendo clic en
la tarjeta. El `catch` vacío se comía el error y la pantalla "detalle de
producto" **nunca se abrió**: lo que se medía era el catálogo por segunda vez,
declarado como otra pantalla. En las dos puertas y en las dos medidas.

**Las mediciones "about (foto blanca)" y "about (foto negra)" se hacían sobre
contacto.** La sustitución de la foto ocurría sobre la pantalla en la que
hubiera quedado el recorrido, y el recorrido terminaba en contacto. La etiqueta
decía about; la pantalla era otra. Ahora recarga, navega y comprueba el
marcador antes de sustituir.

### Lo que apareció al abrirse el detalle de verdad

Una violación `critical` que nadie había visto en ninguna corrida anterior:

```text
[critical] label — Form elements must have labels
  · input[min="1"]  <input type="number" min="1" max="2" value="1">
```

El selector de cantidad del detalle, sin nombre accesible, y sus botones `−` y
`+` tampoco lo tenían. **Son las tres líneas de `src/`.**

### Rojo controlado, criterio 1

Tres demostraciones, con el guion restaurado después. Ninguna se versiona.

| Qué rompí | Resultado |
|---|---|
| El clic: `'Mis Ventas'` → `'Mis Ventas ROTO A PROPOSITO'` | corte con `TimeoutError`, salida **1** |
| El marcador, dejando el clic sano | mi mensaje: *«No llegué a "panel: mis ventas" en escritorio»*, salida **1** |
| El nombre de la pantalla, midiendo igual | 40 de 40 medidas, pero **cobertura incompleta**: 2 faltan, 2 sobran, salida **1** |
| Lo mismo en `contraste`, marcador del carrito | *«No llegué a "escritorio carrito"»*, salida **1** |

La tercera es la que importa: aunque el número siga dando 40, si los nombres no
son los esperados la puerta falla igual.

### Estado final

| Comprobación | Resultado |
|---|---|
| `npm run a11y -- --todas` | **40 de 40 pantallas**, 0 de cualquier impacto, salida 0 |
| `npm run contraste` | **34 de 34 mediciones**, 0 fuera de umbral, salida 0 |
| `npm run build` | verde |
| Suite oficial, base recreada desde cero | **25/25** |
| `git -c core.whitespace=cr-at-eol diff --check` | sin avisos |

**No corrido:** `npm run smoke` tal cual, que exige Docker. Corrí
`scripts/smoke.mjs`, la misma suite, contra la base recreada a mano.

## 4. Desvíos, riesgos y hallazgos fuera de la tarea

**Desvío: toqué `src/`, que estaba fuera de alcance.** Tres líneas, tres
`aria-label` en el selector de cantidad del detalle. No lo pude evitar: al dejar
de mentir el recorrido, esa pantalla trajo una violación `critical`, y el
criterio 2 pide cero violaciones. Sin esas tres líneas la puerta no puede quedar
verde. Va como decisión en el punto 5.

**Exención que agregué al barrido de contraste.** Con el detalle realmente
abierto apareció el botón `−` deshabilitado: `#b9c4b2` sobre `#f5f5f5`, 1,67:1.
Apliqué la exención de controles deshabilitados que ya decidiste el 09/08, la
misma que aplica axe. **Para que la exención no quede invisible, el resumen
imprime cuántos elementos excluye: hoy 38.** Es un aflojamiento del control y
por eso lo digo en voz alta; si preferís que no exista, se saca y esa pareja
vuelve a fallar.

**Riesgo que queda, y no lo cierra esta pieza:** el inventario detecta que una
pantalla no se abrió, pero no detecta que una pantalla *esperada nunca se
escribió*. Las listas `ESPERADAS` las mantengo yo. Si mañana se agrega una
pantalla al producto y nadie la agrega a la lista, las puertas siguen en verde
sin cubrirla. No se me ocurre cómo cerrarlo sin inventariar rutas desde el
código, que es otra pieza.

**Números que cambiaron y conviene que sepas por qué.** El barrido informa
ahora 6.118 textos medidos, no 8.271. Bajó porque antes contaba dos veces el
catálogo —haciéndolo pasar por el detalle— y porque los 38 deshabilitados ya no
entran. Menos textos, pero pantallas distintas de verdad.

## 5. DECISIÓN SOLICITADA

**a) Las tres líneas de `src/`.** Beneficio: el detalle deja de tener un control
sin nombre y la puerta cierra. Esfuerzo: hecho, tres `aria-label`. Riesgo: rompe
tu regla de no tocar `src/` en esta pieza. Fase: 1. **Recomiendo aprobarlas
acá.** Alternativa: las saco, la puerta queda roja en `label` y abrís una pieza
de una línea para ellas.

**b) La exención de controles deshabilitados en el barrido.** Beneficio:
coherencia con lo que ya decidiste y con axe. Esfuerzo: hecho. Riesgo: es un
control más flojo, y lo agregué yo. Fase: 1. **Recomiendo conservarla.**
Alternativa: la saco y el botón `−` deshabilitado bloquea la puerta.

**c) Próxima pieza.** Confirmaste el seed con datos bancarios demo. Quedo a la
espera de la orden; no lo empiezo sin ella.

Nada queda bloqueado esperando (a) y (b): las dos están implementadas y
revertirlas es de un minuto. El entorno local sigue levantado.
