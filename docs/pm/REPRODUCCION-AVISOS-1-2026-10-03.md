# Reproducción PM — AVISOS-1 y su agregado chico (03/10)

Sobre `5b1032d` (producto fijo en `259f232`), base `e5d592e`. Entorno PM con
`levantar.sh 5b1032d`, base nueva, datos inventados, sólo local.

## Lo del informe

| Qué | Resultado PM |
|---|---|
| `SMOKE_CASOS=204,239,241` | 3/3. El 241: lo bueno se fue a los 3969 ms (1440) y 4024 ms (390); el error sigue a los 6 s |
| `sabotajes_avisos_1.py` (los 7) | «todos dieron el rojo esperado»; `src` quedó como estaba |
| Suite completa desde base nueva, `suite-y-puertas.sh e5d592e 5b1032d` | **240/241** en 1687 s. Cae sólo el **169** (reinicio de la API), rojo de entorno conocido de PM. El 131, que a la Dev le cayó por entorno, acá pasa |
| a11y `--todas` | «SIN VIOLACIONES BLOQUEANTES, COBERTURA COMPLETA» |
| contraste | «TODO OK, COBERTURA COMPLETA» |
| móvil | 12 de 12 recorridos, 0 desbordes |
| guía del panel | 30 pasos en los dos anchos, con la nota «un aviso tapaba el control» (D1) |
| guía de uso | 23 pasos en los dos anchos |
| build, tsc, lint, compileall, alembic, diff-check `cr-at-eol` | verdes; «No new upgrade operations detected» |
| Capturas `docs/pm/capturas/avisos-1/` | se ven como la opción A de la maqueta |

La suite corrió en parte junto con el subagente, que creó publicaciones
propias del vendedor; no hubo rojos atribuibles.

## Negativos de PM (celular táctil emulado, 390×844)

Scripts: `archivo/avisos-1/negativos-pm.mjs` y `negativos-pm-2.mjs`. Se
copian a `scripts/` del candidato para correrlos (importan `playwright`).

| | Resultado |
|---|---|
| A1. Deslizar el error 30 px de costado | queda 1 (bien) |
| A2. Deslizar 120 px de costado | queda 0 (bien) |
| B0. Dónde queda el error, quieto | y=765..828 de 844: del centro al borde hay **48 px**, y cierra con más de 60 |
| B1. Deslizar desde el centro hasta el borde de abajo | **queda 1**: hacia abajo no se puede cerrar |
| B2. Desde el borde de arriba del aviso hasta el borde | queda 0: sólo así |
| C. Tocar un aviso bueno con el dedo | a los 9 s sigue (D1 de la Dev, confirmado) |
| C2. Tocar otra parte de la pantalla | a los 5 s más, sigue |
| C3. Tocar el aviso, tocar arriba y recibir otro bueno | a los 9 s, 0: se suelta cuando cambia la lista |
| D. Ocho errores seguidos | la pila plegada empieza en y=765; 9 toques para limpiarla |

## Subagente adversarial

Sonnet 5.5, esfuerzo de la sesión, contexto nuevo, sólo lectura y Playwright
contra el entorno local. Scripts en `archivo/avisos-1/subagente/` (los `pm-`
son sus scripts con mis ajustes; el id de producto es de mi base local: el de
la «Urea Granulada»).

| # | Hallazgo | PM | ¿Lo había visto alguien? |
|---|---|---|---|
| 1 | Un error que se queda tapa el botón principal de un modal: «Publicar producto» en «Vender» a 390 (botón y 746-789, aviso 765-828) | **Reproducido** (`pm-t12.mjs`): en el centro del botón está el aviso, y tocarlo **no manda el pedido** (1 POST antes, 1 después). Causa: el contenedor tiene `z-index: 10000` desde antes, pero ahora está abajo, donde los modales tienen sus botones; `AddProductModal`, `AuthModal` y `CartModal` usan 1000 y `CheckoutModal` 2000 | No |
| 2 | Tocar un aviso con el dedo lo deja quieto | Reproducido (`pm-t7.mjs`, T1) | Sí: D1 de la Dev y mi C |
| 3 | Con teclado, cerrar el último aviso deja el foco en `BODY`, y el Tab siguiente va al logo. Para llegar a «Ver carrito» desde «Agregar» hacen falta 11 Tab, y el aviso no se pausa hasta que el foco entra: tiene 4 s | **Reproducido** (`pm-t8.mjs`): «K1 tabs to Ver carrito 11», «activeElement BODY», «next Tab lands on BUTTON AgroBoeda» | No (la Dev declaró otro: el foco después de «Ver carrito») |
| 4 | Un deslizamiento vertical que empieza sobre el aviso no desplaza la página (`touch-action: none`) | **Reproducido** (`pm-t7.mjs`, T3): scrollY 684 → 684; fuera del aviso, 1247 | No |
| 5 | A 320 px, con un nombre de 100 caracteres sin espacios, el aviso mide 296 px de alto | No reproducido: nombre extremo | — |
| 6 | Celular apaisado (667×375) con 5 avisos desplegados puede llegar a la cabecera | No reproducido: sólo medido, sin captura | — |

**Medición:** 6 hallazgos, 4 reproducidos, 3 que nadie más había visto
(1, 3 y 4).

## Clasificación

- **Rompe:** el 1. Después de un error al publicar, en el celular «Publicar
  producto» no responde hasta cerrar el aviso. Por el mismo mecanismo
  (z-index 10000 contra 2000), un error que se queda abajo puede tapar
  botones del checkout; eso no lo medí.
- **Riesgo:** el 2 (D1), deslizar hacia abajo (B1), el 3 y el 4.
- **Se ve:** el 5 y el 6, bajos; no entran.

## Veredicto

Devolución chica sobre `5b1032d`, antes de publicar y antes de
`COBRO-ESTADOS-1`. Detalle en `PARA-DEV.md`.
