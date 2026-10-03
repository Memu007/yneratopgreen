# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## AVISOS-1: devolución chica, entrega

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `7f5fbaf` (mi entrega anterior); integré tus commits hasta `f38cd21`, que tocan sólo `docs/pm` |
| producto | `1fa8516` (los cuatro puntos), `d3c31fc` y `cc689e5` (lo del subagente y de la autorrevisión), `a802eff` (saca un cambio que no se reprodujo) |
| casos, negativos y arnés | `5cde33d`, `38bb62d`, `0afe394`, `e051df2`, `7b95bc2`, `e86bcd8`, `6aa82e1` y `3f6b65b` |
| subagentes con esfuerzo, aparte | `80a1938` (`.claude/agents/`) |
| no integrado, no desplegado | `main` sigue en `e5d592e` |

**Resultado: terminado.** El producto quedó fijo en `cc689e5`. Los focales,
los 16 negativos y las puertas corrieron sobre ese producto.

**Nada para decidir.** Supuestos, todos reversibles:

1. **Las capas le dejan lugar al aviso (punto 1).** Mientras haya un aviso,
   toda capa con `aria-modal` se achica y sube lo que mide la pila plegada.
   El costo: cuando aparece o se va un aviso con una capa abierta, la capa
   salta unos 100 px. La alternativa, bajar el aviso detrás de las capas,
   escondía el error que se queda.
2. **Un aviso con acción que llegó por el teclado no se va solo (punto 4).**
   Espera a que la persona llegue con Tab, o lo cierre. Empieza a contar los
   4 s si el foco entra a una capa (desde ahí el teclado no llega) o si la
   persona pasa al mouse o al dedo. Hoy el único aviso con acción es
   «Agregado», en la ficha.
3. **El foco vuelve al botón que provocó el aviso** («Agregar al carrito»),
   no a lo último antes de entrar a los avisos: con Tab se pasa por toda la
   página, y lo último antes de los avisos era el enlace de WhatsApp del pie.
   Si ese botón ya no está, va a lo último antes de los avisos. Con una capa
   abierta, siempre a la capa.
4. **Deslizar: tu sugerencia.** Sólo de costado, y `pan-y pinch-zoom`, así
   que lo vertical desplaza la página y se puede ampliar con dos dedos.

## Los cuatro puntos

| # | Qué cambió | Caso | Negativo |
|---|---|---|---|
| 1 | Con un aviso a la vista, las capas se achican y suben: ninguna parte de «Publicar producto», «Continuar compra» ni «Continuar al pago» queda debajo | 243, en 1440, 390 y 320 | `tapa-la-capa` |
| 2 | Con el dedo no se pausa: sólo el mouse o el foco | 242 A1 | `el-dedo-pausa` |
| 3 | Se cierra sólo de costado, con más de 60 px; lo vertical desplaza la página; si el navegador cancela el gesto, el aviso vuelve a su lugar | 242 A2 y A3 | `cierra-con-poco`, `touch-none` |
| 4 | Con el teclado: el aviso con acción espera (B1); el foco vuelve a «Agregar al carrito» al cerrar el carrito abierto desde el aviso (B2) y al cerrar el último aviso (B3) | 242 B1 a B3 | `teclado-se-va`, `foco-al-body` |

**Más de lo mismo, que salió de la revisión:**

- Con el carrito abierto, el aviso que esperaba al teclado se va solo (B5), y
  cerrar con el teclado el último aviso deja el foco en el carrito, no detrás
  (B6). Negativos `capa-no-arranca` y `foco-detras`.
- Después de agregar con el teclado, un clic en la página hace que el aviso
  cuente (B7). Negativo `mouse-no-arranca`.
- El aviso que se está yendo (200 ms) ya no se alcanza con Tab ni atrapa el
  puntero. Lo encontró el 242: con el teclado rápido, el foco caía en el que
  se iba y Enter no cerraba nada. No tiene negativo propio: depende de
  apretar Tab dentro de esos 200 ms.

**Una diferencia con tu reproducción del punto 1.** En mi recorrido, a 390,
el error tapa sólo 7 px del borde de abajo de «Publicar producto», no el
centro, y tocar el centro reintenta aun sin el arreglo. Por eso el 243 mide
todo el alto del botón y no sólo el centro. Con el sabotaje, el rojo sale en
los tres anchos:

```
1440px: con el error a la vista, el aviso tapa 43 px de alto de «Publicar producto»
1440px: con el error a la vista, el aviso tapa 48 px de alto de «Continuar al pago»
1440px: con el error a la vista, en el centro de «Continuar al pago» está DIV «!Error al publicar el producto. Por favor intenta »
390px: con el error a la vista, el aviso tapa 7 px de alto de «Publicar producto»
320px: con el error a la vista, el aviso tapa 48 px de alto de «Continuar compra»
320px: con el error a la vista, en el centro de «Continuar compra» está SPAN «Error al publicar el producto. Por favor intenta d»
```

## Cómo verificarlo

Con la API en 8000 y el frontend de desarrollo en 5173:

```bash
SMOKE_CASOS=241,242,243 node scripts/smoke.mjs
# → 3/3 pasaron; 0 fallaron

python3 scripts/sabotajes_avisos_1.py tapa-la-capa el-dedo-pausa cierra-con-poco teclado-se-va
# → cuatro [ROJO ESPERADO], «src después: como estaba» y «todos dieron el rojo esperado»

node scripts/guia-admin.mjs
# → «LA GUÍA Y EL PANEL COINCIDEN: 30 pasos en escritorio y celular», sin la nota «un aviso tapaba el control»
```

## Puertas

Todo sobre el producto `cc689e5`.

| puerta | resultado |
|---|---|
| 241, 242 y 243 | «3/3 pasaron; 0 fallaron». El 241: lo bueno se fue a los 3941 ms (1440) y 3979 ms (390). El 243: el centro de «Publicar producto» en y=758 (1440), 647 (390) y 351 (320), y reintentó en los tres |
| negativos | 16 de 16 «[ROJO ESPERADO]» y «src después: como estaba»: los 7 de antes y los 9 nuevos |
| a11y `--todas` | «SIN VIOLACIONES BLOQUEANTES, COBERTURA COMPLETA» |
| contraste | «las 88 mediciones exigidas se hicieron», «TODO OK, COBERTURA COMPLETA» |
| `guia-admin.mjs` | «[OK] Paso 24. Editar o desactivar una opción (4 frases de resultado)» en los dos anchos; «LA GUÍA Y EL PANEL COINCIDEN: 30 pasos en escritorio y celular». La nota del paso 24 ya no aparece |
| `tsc`, lint y build | verdes |
| diff-check con `cr-at-eol` sobre `7f5fbaf..HEAD` | limpio; `--stat` da igual con y sin CR |

**Antes del verde hubo un rojo de las puertas, ya corregido:** contraste
midió el carrito con el aviso todavía yéndose (1,00:1, «Agregado: Fertilizante
Triple 15 - NPK»). Al aviso que se va le puse `aria-hidden`, y el localizador
por rol lo daba por ido antes de tiempo. a11y y contraste esperan ahora a que
no quede ningún aviso.

**Líneas con CR por archivo, contra la base:**

| archivo | base | ahora |
|---|---|---|
| `Toast.tsx` | 353 de 353 | 470 de 470 |
| `Toast.module.css` | 332 de 332 | 347 de 347 |
| `scripts/smoke.mjs` | 4 | 4, las mismas. Una reescritura mía las había pasado a LF; `7b95bc2` las devuelve |
| `a11y.mjs`, `contraste.mjs`, `sabotajes_avisos_1.py` | 0 | 0 |

## Subagente y autorrevisión

**Subagente adversarial:** Sonnet 5.5, como agente general. El esfuerzo fue
el de la sesión (medio): las definiciones de `.claude/agents/` las carga
Claude Code al abrir el chat, y en este no estaban. Sólo leyó código, sobre
una copia limpia (los sabotajes estaban rompiendo los archivos del aviso).
Seis hallazgos; reproduje cuatro.

| # | Hallazgo | ¿Lo reproduje? | Qué hice |
|---|---|---|---|
| 1 | Con una capa abierta, el aviso que esperaba al teclado no se va nunca y la capa queda achicada | Sí (B5) | Arreglado; negativo `capa-no-arranca` |
| 2 | Cerrar con el teclado el último aviso con una capa abierta manda el foco detrás de la capa | Sí (B6) | Arreglado; negativo `foco-detras` |
| 3 | La altura de la pila no se vuelve a medir al cambiar el ancho | No: a 320 el error mide lo mismo que a 390, y el sabotaje no dio rojo | El cambio lo saqué (`a802eff`) |
| 4 | El 242 podía dar verde sin observar: el toque sin comprobar, el cierre por tiempo y no por el gesto, la posición después del gesto vertical | Sí, en el caso | El caso comprueba que el toque llega, que el cierre llega antes de los 3,5 s y que el aviso vuelve a su lugar |
| 5 | La confirmación «Descartar cambios», que está por encima de los avisos, también se achica | Inofensivo | Sin cambio |
| 6 | Menores: `dvh` sin respaldo, ampliar con dos dedos, el arrastre perdía el lugar en la pila, el foco previo que queda viejo | — | Los tres primeros, arreglados sin caso; el cuarto, sin cambio |

**Autorrevisión,** `/code-review` en nivel alto sobre `7f5fbaf..HEAD`, sin
`docs/pm`. No es independiente. Nueve hallazgos:

| # | Hallazgo | Qué hice |
|---|---|---|
| 1 | El aviso que espera al teclado no se va si la persona pasa al mouse, ni si nació con el foco en una capa | Arreglado. El del mouse, con rojo (B7, `mouse-no-arranca`); el de la capa, sin caso: hoy no hay acción dentro de una capa |
| 2 | La regla de las capas le ponía un tope de 90 % del alto a ventanas con su alto ajustado, como «Ingresar» | Saqué el tope: sólo resta lo del aviso. Sin caso |
| 3 | Las capas saltan con cada aviso; la reserva se soltaba mientras el último aviso se iba; la pila desplegada no tiene reserva | La reserva dura hasta que el aviso se va y el que se va no atrapa el puntero. El salto queda (supuesto 1); la pila desplegada es un riesgo |
| 4 | Sin captura del puntero, el lápiz deja el aviso corrido | Volvió la captura. Sin caso |
| 5 | El carrito de la cuenta de demostración queda con los productos del 242 y del 243 | Los dos lo vacían al terminar |
| 6 | La capa de arriba se toma por orden del documento | Revisado: las anidadas de hoy (la confirmación dentro de «Vender») quedan después. Sin cambio; es un riesgo |
| 7 | a11y y contraste esperan que no quede ningún aviso, no sólo el suyo; una sangría corrida | Corregí la sangría. La espera queda así: en ese recorrido no hay otro aviso, y si lo hubiera, falla con su tiempo |
| 8 | Los tres casos de avisos repiten la preparación | Sin cambio |
| 9 | Las definiciones de subagentes dicen «no escribe» pero tienen Bash | Es así: Bash no se puede limitar a lectura, y sin Bash no corren Playwright. Queda en la consigna |

## Subagentes con esfuerzo

`.claude/agents/` tiene cuatro definiciones: `adversario-sonnet-medio`,
`adversario-sonnet-alto`, `adversario-opus-medio` y `adversario-opus-alto`.
Cada una lleva la consigna adversarial de `ONBOARDING-DEV.md`, sin `Write`
ni `Edit`.

La documentación de Claude Code
(<https://code.claude.com/docs/en/sub-agents>) trae el campo `effort`:
«Effort level when this subagent is active. Overrides the session effort
level. Default: inherits from session. Options: `low`, `medium`, `high`,
`xhigh`, `max`». El modelo va en `model` (`claude-sonnet-5-5`,
`claude-opus-5-5`). Opus no pasa de `high`.

Se cargan al abrir un chat: en este no las pude usar.

## Riesgos

- **La pila desplegada puede tapar el botón de una capa.** La reserva es la
  de la pila plegada. Se despliega sólo con el mouse encima o con el foco
  adentro, o sea mientras la persona está usando los avisos.
- **Un error que se queda no se alcanza con el teclado mientras hay una capa
  abierta:** la capa encierra el foco. Ya era así antes. Ahora, al menos, no
  tapa los botones.
- **Lector de pantalla, lápiz y dedo reales:** no los probé.
- **Ninguno de datos:** no cambia la API ni la base.

## Qué no se corrió

- La suite completa: no la pediste.
- La auditoría móvil y la guía de uso: no las pediste, y la guía de uso no
  toca avisos con capas.
- Un dedo, un lápiz y un lector de pantalla reales.

## Desvíos del entorno

- **PostGIS** instalado con `apt-get install postgresql-16-postgis-3`.
- **Chromium:** Playwright 1.62 espera uno que la imagen no trae; le apunté
  el 141 de la imagen con un enlace en `/opt/pw-browsers`, sin tocar el
  repositorio.
