# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## FILTER-COLLAPSE-FOCUS-1 — entregada, para tu revisión

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `d468a8b` |
| candidato (panel + caso 187 + negativos + marcador de a11y y contraste) | `4fa8809` |
| no integrado, no desplegado | `main` sigue en `0bd7fbc` |

**Resultado.** A 360, 390 y 768 px, con el panel cerrado:

- Tab va de «Filtros» a «Ordenar» en un solo paso;
- ninguno de los 12 controles del panel está en el árbol de accesibilidad
  (los 11 alcanzables más «Localidad», que está deshabilitada).

Con el panel abierto:

- Tab recorre los 11 controles en su orden;
- escribir un precio mínimo con el teclado filtra;
- «Ver N resultados» cierra el panel y deja el foco en «Filtros», a la vista.

A 1280 px, los 10 controles del panel siguen en el recorrido de Tab. Con el
componente de la base, el 187 da rojo y nombra los 11 controles invisibles.

**Lo que decidís vos (no bloquea).** Tu criterio pide «Filtros» visible
después de «Ver N resultados», y eso mueve la página. Medido con el dedo,
después de bajar hasta el botón:

| a 360 px | base | ahora |
|---|---|---|
| «Filtros» | fuera de la pantalla (−75 px) | a la vista (218 px) |
| foco | en «Ver 35 resultados», que ya no se ve | en «Filtros» |
| primera tarjeta | a 158 px | a 451 px |

A 768 px, la primera tarjeta pasa de 110 a 362 px. **Recomiendo dejarlo
así.** La alternativa es pegar «Filtros» al borde de arriba; por cuenta, no
medido, la primera tarjeta subiría unos 218 px. Entre 600 y 1023 px la
cabecera queda fija arriba, así que esa opción necesita un margen distinto
según el ancho.

**Para que no te sorprenda: a11y y contraste suman dos pantallas.** Pasan
de 74 a 76 y de 82 a 84, por una superficie nueva, «catálogo: filtros
abiertos».

- El marcador del catálogo era `#catalog-category`, un control del panel.
- En celular contaba como «visible» aunque estaba recortado. Ahora está
  oculto de verdad, y los dos scripts no llegaban al catálogo.
- El marcador pasa a ser «Ordenar».
- La superficie nueva abre el panel en celular para medir sus controles
  donde se ven. En escritorio es la misma pantalla que el catálogo.

## Para verificar, lo mínimo

```
SMOKE_CASOS=187 node scripts/smoke.mjs
  → [PASS] 187 … 360px: cerrado, «Filtros» → «Ordenar» en 1 Tab y 12
    controles fuera del árbol; abierto, 11 controles en orden; precio mínimo
    30 → 10; «Ver 10 resultados» deja el foco en «Filtros». 390px … 768px …
    1280px: los 10 controles del panel siguen en el recorrido de Tab, a la vista

python3 scripts/sabotajes_filter_collapse_focus_1.py componente-de-la-base
  → [ROJO ESPERADO] [FAIL] 187 … a 360px, con «Filtros» cerrado, Tab cayó en
    11 controles que no se ven antes de «Ordenar»: «Tipo» (#catalog-type),
    «Categoría» (#catalog-category), «Provincia» (#catalog-province), «Precio
    mínimo» (#catalog-price-min), «Precio máximo» (#catalog-price-max), «Solo
    con stock disponible», «Calificación mínima del vendedor» (#catalog-rating),
    «Condición» (#catalog-condition), «Marca» (#catalog-brand), «Limpiar
    filtros», «Ver 30 resultados»
    src despues: como estaba
```

**Antes de correrlos:**

- Los dos necesitan la API en 8000, el frontend de desarrollo en 5173 y la
  siembra demo.
- El 11 incluye «Marca», que sólo aparece si el Mercado tiene marcas; la
  siembra demo las tiene.
- Sobre la base demo limpia salen 30 publicaciones, y el precio mínimo las
  baja a 10. Si antes corrieron otros casos, el 30 cambia; en mi corrida
  eran 35.
- El caso tarda unos 6 s y cada negativo, unos pocos segundos.

**Sobre tu Chromium 141.** El negativo `desplazamiento-sin-cortar` depende
de en qué cuadro llega Enter. Mide si el desplazamiento suave que trae el
botón se corta a tiempo.

- En 5 de 5 corridas dio rojo en alguno de los tres anchos, pero no siempre
  en el mismo.
- Con otro Chromium puede cambiar el ancho. Si da verde, avisame con la
  salida.
- Los otros dos negativos no dependen del tiempo.

## Causa

- **El foco en controles invisibles.** Por debajo de 1024 px, el panel se
  plegaba sólo con `max-height: 0` y `overflow: hidden`. Eso recorta lo que
  se ve, pero no saca los controles del recorrido de Tab ni del árbol de
  accesibilidad. Ahora el panel plegado lleva además `visibility: hidden`, y
  al abrirse vuelve a `visible`.
  - El nodo sigue siendo el mismo y el plegado sigue siendo por altura, así
    que el motivo documentado en el CSS se mantiene.
  - La regla está dentro de `@media (max-width: 1023px)`, así que el
    escritorio no cambia.
- **«Ver N resultados».** Al plegarse, el botón quedaba oculto con el foco
  encima y Chrome devolvía el foco al documento. Ahora el foco pasa a
  «Filtros».
- **Encontrado en el camino: el desplazamiento suave.** Viene de
  `scroll-behavior: smooth` en `index.css`.
  - Si Enter llega antes de que termine el desplazamiento que Tab usó para
    traer «Ver N resultados», ese desplazamiento seguía después de plegar y
    dejaba «Filtros» 475 px por encima de la pantalla.
  - `scrollIntoView` no lo corta cuando no tiene nada que mover; un
    `scrollTo` a la posición actual sí.
  - Medido con Enter a 0, 16, 50, 100, 200, 400 y 800 ms del Tab, en los
    tres anchos: sin el corte quedaron 3 de 21 fuera de la pantalla, todos
    los de 0 ms; con el corte, ninguno.
  - «Filtros» se centra en vez de subirse al borde, porque entre 600 y
    1023 px la cabecera fija lo taparía. Como está cerca del principio de
    la página, centrarlo en la práctica lleva la página arriba de todo.

Cambios de producto: `FilterSidebar.module.css` (+9) y `FilterSidebar.tsx`
(+24 −3).

## Los negativos

`python3 scripts/sabotajes_filter_collapse_focus_1.py` corre los tres:

| negativo | qué rompe | rojo |
|---|---|---|
| `componente-de-la-base` | componente y CSS de `d468a8b` | Tab cae en los 11 controles invisibles, nombrados |
| `foco-sin-volver` | «Ver N resultados» sólo pliega | el foco quedó en «ningún control: el foco volvió al documento» |
| `desplazamiento-sin-cortar` | sin el `scrollTo` que corta | «Filtros» con el foco pero a −475 px |

## Lo que corrí

```
sobre 4fa8809
  negativos, los tres                     rojo esperado, src como estaba
  desplazamiento-sin-cortar               rojo en 5 de 5 corridas
  a11y --todas                            76/76, 0 violaciones
  contraste                               84/84, 0 por debajo del mínimo
  auditoría móvil                         12/12 recorridos, 39 pantallas,
                                          0 hallazgos, exit 0
  panel-cerrado de MOBILE-AUDIT-FLOW-1    sigue dando su rojo
  build · lint · tsc --noEmit · node --check · py_compile · diff-check
                                          verdes
smoke, base limpia
  1–6, 147, 148, 155, 171, 175, 183, 185, 186, 187       15/15
```

- El smoke corrió antes del último ajuste del commit, que cambió sólo una
  comprobación del negativo (tres líneas). Producto y caso son los mismos.
- Sumé 155 y 175 a los que pediste porque son los que operan el panel en
  celular.
- Al editar, el componente había perdido sus finales de línea mixtos. Los
  restituí: el diff muestra sólo el cambio.

## Visto y no tocado

- **Pasar de escritorio a menos de 1024 px con el foco adentro del panel**,
  por ejemplo al girar una tablet: el panel se pliega con el foco adentro y
  el foco vuelve al documento. No hay un «cerrar» que lo provoque, así que
  excede la pieza.
- **Las fechas de fase.** `NOW.md` dice Fase 2, con ventana 04/09–24/09,
  es decir hoy. `CRONOGRAMA.md` pone la Fase 3 (buscador, catálogo y
  geolocalización de fletes) del 25/09 al 15/10, y la próxima secuencia de
  `NOW.md` no dice nada del cambio de fase. Es tuyo y de Emi; te lo marco
  para que no quede colgado.

No toqué `main`, Railway, backend ni datos, y no desplegué. Freno acá.
