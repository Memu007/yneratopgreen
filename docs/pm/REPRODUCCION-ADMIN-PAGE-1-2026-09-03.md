# Reproducción PM — ADMIN-PAGE-1

Fecha: 2026-09-03.  
Base revisada: producto/regresión `fe2b151`, informe `f25a57c`.  
Equipo: macOS con Docker Desktop; cada ejecución válida comenzó con descarte de
contenedores y volúmenes mediante el lanzador oficial.

## Veredicto

La paginación es plausible y el caso focal pasa, pero la entrega no cruza la
puerta completa. Hay un rojo reproducido en el filtro de Productos y un estado
ofrecido por la interfaz que el dominio no admite.

## Evidencia reproducida

| Control | Resultado |
| --- | ---: |
| caso 145 aislado, base limpia | 1/1 |
| suite completa, otra base limpia | 144/145 |
| caso 131 dentro de la suite | pasa |
| caso 145 dentro de la suite | falla |
| build incluido en ambas corridas | pasa |
| lint, `node --check`, compileall, `pip check`, `diff-check` | pasan |

El único rojo completo fue:

```text
no pasó a tiempo: el filtro de publicaciones no coincide con el total del servidor
scripts/smoke.mjs:16921
```

Los casos 114, 121, 131 y 144 pasaron. Por tanto, el rojo 131 que la Dev vio en
sus dos suites no apareció en esta reproducción y no se atribuye a
ADMIN-PAGE-1 sin evidencia nueva.

## Estados de publicación

El modelo declara `active`, `paused`, `sold_out` y `deleted`. La interfaz nueva
ofrece `active`, `paused`, `draft` y `deleted`. Una consulta autenticada de sólo
lectura contra el Backend local devolvió:

```text
active=200  paused=200  sold_out=200  draft=500
```

El caso 145 sólo selecciona `paused`; por eso no detecta la opción falsa ni la
ausencia de `sold_out`.

## Hipótesis técnica a demostrar

Los tres cargadores escriben filas y total cuando resuelve cualquier pedido,
sin comprobar que todavía corresponda a la página y filtros vigentes. Al volver
a una pestaña, conserva sus filas anteriores; el helper de la regresión ve un
`tbody` de inmediato y puede aplicar el filtro mientras la recarga sin filtro
sigue en vuelo. Si la vieja termina última, pisa el resultado nuevo. El hecho de
que el 145 pase aislado y falle con una base mucho más cargada es compatible con
esa carrera, pero la Dev debe hacerla determinista reteniendo y liberando las
respuestas en orden inverso antes de declarar la causa cerrada.

## Puerta pendiente

1. Selector alineado con los cuatro estados reales.
2. Una respuesta vieja no puede sobrescribir ninguna de las tres listas.
3. Caso 145 enumera todas las opciones de publicación y reproduce el orden
   inverso de respuestas.
4. Caso 145 focal y suite completa 145/145 desde bases limpias.
5. Puertas estáticas verdes.

No se modificó producto desde PM, no se desplegó y no se tocaron Railway ni
datos remotos.

## Cierre de la corrección — 2026-09-04

Base revisada: corrección `6cc67b7`, informe `3b13271`.

La corrección del alcance de ADMIN-PAGE-1 queda aceptada. PM reprodujo desde
bases limpias:

| Control | Resultado |
| --- | ---: |
| caso 145 aislado | 1/1 |
| suite oficial completa | 145/145 |
| caso 131 dentro de la suite | pasa |
| lint, `node --check`, compileall, `pip check`, `diff-check` | pasan |

El filtro ofrece ahora `active`, `paused`, `sold_out` y `deleted`. El caso 145
recorre todas sus opciones y la carrera retiene el pedido sin filtro, deja
terminar el filtrado y libera último el viejo; filas y total conservan el pedido
vigente. La suite completa cerró con salida 0.

Hallazgo separado: el selector de estado **por fila**, anterior a esta tarea,
todavía ofrece `draft` y omite `sold_out`. El código y la medición de Dev
coinciden: `draft` devuelve 400 en `PATCH`, mientras `sold_out` devuelve 200.
ADMIN-PAGE-1 no se reabre, pero la puerta administrativa queda detenida en la
tarea mínima ADMIN-STATE-1 antes de avanzar a NAV-URL-1.

PM no modificó producto, no desplegó y no tocó datos remotos.
