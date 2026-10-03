# Reproducción PM — devolución de AVISOS-1 (03/10, PM nueva)

Sobre `ff9a5ce` (producto fijo en `cc689e5`; después sólo cambian `scripts/` y
`docs/`, verificado con `git diff --name-only cc689e5 ff9a5ce`). Base de la
devolución `7f5fbaf`. Entorno PM con `levantar.sh ff9a5ce`: PostGIS en Docker
recién creada, API nativa (1 proceso), frontend de desarrollo, `.env`
inventados, sólo local.

## Lo del informe

| Qué | Resultado PM |
|---|---|
| `SMOKE_CASOS=241,242,243` | **3/3 pasaron; 0 fallaron** |
| Los 16 sabotajes de `sabotajes_avisos_1.py` | **No corridos.** El clasificador del entorno de PM bloqueó la corrida en segundo plano; no se rodeó. Quedan para la próxima entrega |
| Suite completa y puertas | No corridas: el veredicto es devolución y el producto va a cambiar. Se corren sobre el SHA que se publique |
| `effort` en `.claude/agents/` | Coincide con <https://code.claude.com/docs/en/sub-agents>: «Overrides the session effort level. Options: low, medium, high, xhigh, max». La misma página dice que la primera definición en una carpeta `agents` nueva pide reiniciar la sesión: por eso no cargaron en la sesión que las creó ni, al principio, en la de PM |

## Mis reproducciones de la ronda anterior, contra el arreglo

Scripts de `archivo/avisos-1/subagente/`, con el id del producto tomado de la
base (`pid()`) en vez del fijo.

| | Antes (`5b1032d`) | Ahora (`ff9a5ce`) |
|---|---|---|
| `pm-t12`, «Vender» a 390 con error | en el centro del botón estaba el aviso; POST 1 → 1 | botón y=639-682, en su centro está el botón; **POST 1 → 2** |
| `pm-t7` T1, tocar el aviso con el dedo | seguía a los 9 s | **se fue antes de los 7 s** |
| `pm-t7` T2, deslizar 40 / 100 px de costado | — | 40: queda 1; 100: queda 0 |
| `pm-t7` T3, deslizar en vertical sobre el aviso | scrollY 684 → 684 | **684 → 1544** |
| `pm-t8` K1, cerrar con Enter el último aviso | foco en `BODY`, Tab al logo | foco en «Agregar al carrito»; el Tab siguiente, «Ver perfil del vendedor» |

Captura de «Vender» a 390 con el error: el aviso queda debajo de «Cancelar», sin
tocar los botones.

## Subagente adversarial

Opus 5.5, agente general, esfuerzo alto (heredado: las definiciones de
`.claude/agents/` todavía no cargaban en esta sesión). Contexto nuevo, sólo
lectura y Playwright contra el entorno local. Scripts en
`archivo/avisos-1/subagente-2/`; se corren con
`PLAYWRIGHT_BROWSERS_PATH=$PM_DIR/pw node <script>` desde esa carpeta copiada a
otro lado (importan `lib.mjs`, que apunta a `$PM_DIR/cand/node_modules`).
Algunos leen el correo de una cuenta compradora creada en la base local
(`/tmp/adv-avisos/comprador.txt`) con una clave inventada: hay que registrar
una cuenta local antes de correrlos.

| # | Hallazgo | PM | ¿Lo había visto alguien? |
|---|---|---|---|
| 1 | Panel de administración: «Categorías», «Marcas» y «Configuración» se dibujan fuera de la parte que desplaza (`.content`); la capa tiene `overflow: hidden` y no se pueden recorrer | **Reproducido** (`admin-recorte.mjs`): a 1440×900 «Marcas» deja 114 de 132 controles fuera de la capa y la rueda mueve 0 → 0; se ven 6 de 44 marcas (captura). A 1366×768, «Categorías» 21 de 38 fuera; a 390×844, «Configuración» 8 de 19. `AdminPanel.tsx` y su CSS son iguales en `e5d592e` y `cc689e5`: **es anterior a AVISOS-1 y está publicado**. Con un aviso, empeora un poco (p. ej. 117 → 120) | No. La guía del panel pasa porque Playwright desplaza por programa |
| 2 | Celular apaisado 568×320, carrito con error: el pie no entra y el aviso tapa «Vaciar carrito» | **Reproducido** (`apaisado-carrito.mjs`): «Continuar compra» 303-351 en una ventana de 320, aviso 241-304; sin aviso ya quedaba cortado (283-331). Tocar su parte visible llega al botón | No |
| 3 | Apaisado 568×320, «Vender» con error: no queda formulario a la vista | **Reproducido** (`apaisado-vender.mjs`): entre cabecera y botones, 116 px → **−11 px**; «Publicar producto» reintenta (POST 1 → 2) | No |
| 4 | La reserva no se vuelve a medir al girar o cambiar el ancho | **Reproducido** (`girar.mjs`): de 568×320 o 1440×900 a 320×568, `--tg-avisos-alto` queda en **63 px** y el aviso mide **83 px**; la capa termina en 461 y el aviso empieza en 469 (8 px). Hoy no tapa. Desmiente «a 320 el error mide lo mismo que a 390» del informe: cargado directo a 320 mide 83, a 390 mide 63. El sabotaje de la Dev no podía dar rojo porque el 243 carga cada ancho de cero | Sí: era el hallazgo 3 del subagente de la Dev, descartado con un dato falso |
| 5 | Con el mouse, la pila desplegada tapa el botón de una capa a ≤768 px (POST 3 → 3) | No reproducido por PM | Sí: riesgo declarado por la Dev |
| 6 | El panel de administración salta 19-25 px con cada aviso, al aparecer y al irse | No reproducido por PM; es el supuesto 1 de la Dev | Sí: supuesto 1 |
| 7 | Un aviso alto detrás de uno bajo asoma 13 px por debajo de la reserva | Teórico; no tapa | No |
| 8 | Un «Agregado» que llegó por teclado sigue al cambiar de sección | No reproducido; es el supuesto 2 | Sí: supuesto 2 |
| 9 | A 320 px, deslizar desde el centro del «Agregado» cae en «Ver carrito» y no cierra | No reproducido | No |

**Medición:** 9 hallazgos, 4 reproducidos por PM, 3 que nadie más había visto
(1, 2 y 3).

Además, por código: todas las capas que achica la regla nueva tienen una parte
interna con desplazamiento (`.content` y `.orderDetailContent` en el panel,
`overflow-y: auto` en checkout y en las de «Mi cuenta»), así que no se pierden
botones salvo en lo que ya estaba fuera de esa parte (hallazgo 1).

## Clasificación

- **Rompe, anterior y publicado:** el 1. Quien administra no llega con el mouse
  ni con el dedo a las marcas después de «Case», a las últimas categorías ni a
  parte de «Configuración». Entra en esta devolución, en un commit aparte.
- **Riesgo:** el 4 (con un mensaje una línea más largo, el error taparía los
  botones después de girar el celular). Entra.
- **Riesgo, no entra:** 2 y 3 (apaisado en un celular de 320 de alto; el
  carrito ya estaba cortado antes), 5, 7, 8.
- **Se ve:** 6 y 9. El 6 se le consulta a Emi junto con el supuesto 1.

## Veredicto

Devolución chica sobre `ff9a5ce`. Detalle en `PARA-DEV.md`.
