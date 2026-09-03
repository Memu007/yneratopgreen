# Reproducción PM — ADMIN-ACTIONS-1 / caso 121 dependiente del orden

Fecha: 2026-09-03.
Base revisada: producto `edf3cb5`, regresión corregida `6441a49`, informe
`9ae1cec`.
Equipo: macOS con Docker Desktop; cada ejecución válida comenzó con descarte de
contenedores y volúmenes mediante el lanzador oficial.

## Veredicto

La corrección de evidencia del caso 144 es plausible y su prueba focal queda
verde, pero ADMIN-ACTIONS-1 no cruza todavía la puerta completa. Dos corridas
oficiales desde bases limpias terminaron 143/144 con el mismo único rojo: caso
121, «Se puede publicar sin fotografía». El caso 131 pasó en ambas.

## Evidencia reproducida

| Corrida | Resultado | Observación |
| --- | ---: | --- |
| caso 144 aislado | 1/1 | pasa la UI real y las 12 acciones |
| suite completa, base limpia 1 | 143/144 | sólo falla 121; 144 pasa |
| suite completa, base limpia 2 | 143/144 | sólo falla 121; 144 pasa |
| caso 121 aislado | 1/1 | alta, base, catálogo y ficha pasan |
| casos 118–121 | 4/4 | los tres casos inmediatos no lo contaminan |
| casos 1–60 + 121 | 61/61 | la primera mitad no lo contamina |

Se intentó 61–117 + 121 para dividir el intervalo. Ese filtro omitió
precondiciones que el bloque medio normalmente hereda y quedó esperando sin
emitir resultado; PM lo interrumpió. No se cuenta como verde ni rojo y no prueba
nada sobre el caso 121.

## Lectura técnica acotada

El caso 121 usa una sesión propia y un nombre único, pero reutiliza la cuenta
demo `vendedor@ejemplo.com`, selecciona la primera categoría activa de productos
y opera sobre la base mutada por todos los casos anteriores. Que pase aislado y
falle dos veces sólo dentro de la suite es evidencia de dependencia de orden o
agotamiento de recursos; no alcanza para atribuirlo a producto.

La regresión 144 no puede causar directamente un fallo anterior por ejecución:
se ejecuta después del 121. Sin embargo, la puerta contractual es la suite
completa, así que un 143/144 no se acepta aunque 144 pase.

## Puerta pendiente

1. Conservar stack y estado observable del 121 durante una corrida completa.
2. Reducir la secuencia que dispara el fallo o demostrar otra causa verificable.
3. Corregir sólo arnés si ésa es la causa; no tocar producto sin una reproducción
   que lo justifique.
4. Caso 121 y caso 144 focales verdes.
5. Dos corridas completas consecutivas 144/144 desde bases limpias.

No se modificó producto, no se desplegó y no se tocaron Railway ni datos
remotos.
