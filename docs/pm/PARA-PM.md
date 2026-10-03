# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## INICIO-CIERRE-CELULAR-1 y el agregado de MARCAS-PANEL-1: entrega

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `4f453a0`; después integré tus `4085a9a` y `4b1eee4`, sólo `docs/pm` |
| INICIO-CIERRE-CELULAR-1 | código `666bbf1`; caso, 232 ajustado y negativos `8fbd0aa` |
| agregado de MARCAS-PANEL-1 | código `1eb819d`; casos y negativos `baa2705` |
| no integrado, no desplegado | `main` está en `4085a9a`, tu publicación de `MARCAS-PANEL-1` |

**Lo que decidís:** si sumás a esta entrega lo que encontró la revisión
independiente (al final, en «Revisión independiente de esta entrega»).
Recomiendo sumar el punto 1, un P2 de «Editar» que ya tiene arreglo y rojo
listos sin subir, y los cuatro arreglos de una línea.

**También al final:** lo que Emi decidió hoy sobre cómo nos comunicamos. Te
pide escribir tus propios comandos y dejar un loop de espera.

Los cuatro puntos del agregado están hechos, cada uno con su negativo en
rojo. Están más abajo, en «Agregado de MARCAS-PANEL-1». El único cambio de API
es aditivo: `/products/my` suma el nombre de la marca.

**Resultado de INICIO-CIERRE-CELULAR-1.**

- **En el celular,** «¿Te interesa alguno?» va al final de Inicio, después de
  «Principio de AgroBoeda», con los mismos textos y el mismo botón.
- **El crédito de las fotos** queda inmediatamente después de la tarjeta 07.
- **En la computadora no cambia nada.** Capturé Inicio entero antes y
  después del cambio. En 1440 las dos capturas son idénticas píxel por píxel.
  En 600 y 768 también, salvo las primeras 300 filas (cabecera y portada):
  esas cambian igual entre dos capturas seguidas del mismo código, así que es
  ruido de la captura y no el cambio.

**Desde qué ancho cambia: 599 px o menos.** Es el corte de celular del
contrato. Con ese mismo corte la grilla ya pasaba a una columna, y la cabecera
cambia el texto de la búsqueda. Sólo en una columna el bloque queda en el
medio:

- de 600 a 1023 px la grilla tiene dos columnas, y con el bloque son ocho
  piezas: cuatro filas completas;
- desde 1024 px son cuatro columnas: dos filas completas.

**Por qué no se hizo sólo con estilos.** Con estilos sólo cambia lo que se ve.
El lector de pantalla y el Tab seguirían encontrando el bloque en el medio.
Por eso el bloque cambia de lugar en el documento, según el ancho. Está una
sola vez en cada ancho.

Tres supuestos, todos reversibles:

1. **Al final, el título «¿Te interesa alguno?» pasa a nivel 2.** En la
   grilla sigue de nivel 3, como las tarjetas. Si quedara en 3, en el índice
   de títulos del lector de pantalla caería dentro de «Cómo funciona». Se ve
   igual.
2. **Separación en el celular:** 24 px entre el principio y el bloque, y
   48 px debajo del bloque, el margen que antes tenía el principio. No había
   maqueta para esto.
3. **Si cambia el ancho con la página abierta** (girar el celular, achicar la
   ventana), el bloque se muda. Si el foco estaba en «Escribinos», lo
   conserva.

## Caso y negativos de INICIO-CIERRE-CELULAR-1

**Caso 240, nuevo, en 390, 599, 600, 768 y 1440:**

- en 390 y 599, el bloque está después de «Principio de AgroBoeda» y Inicio
  no dice nada más después de él. Después de la tarjeta 07 viene el crédito,
  a menos de 40 px;
- en 600, 768 y 1440 es la octava pieza de la grilla, en la fila de la
  tarjeta 07 y a su derecha;
- en todos los anchos, el título, el texto y «Escribinos» están una sola vez
  en el documento;
- lo que se lee va en el orden en que se ve: cada tarjeta, el bloque, el
  crédito y el principio, debajo de lo anterior o a su derecha en la misma
  fila;
- con Tab, desde «Entrar al Mercado»: en el celular, los cinco enlaces del
  crédito y después «Escribinos», y ahí termina Inicio. En la computadora,
  primero «Escribinos» y después los enlaces;
- abierta en 1440 con el foco en «Escribinos», al pasar a 390 el bloque va
  al final y el foco sigue en «Escribinos». Al volver a 1440, lo mismo.

**El 232 se ajustó sin cambiar lo que mide.** Buscaba el bloque dentro de la
sección del ecosistema, y en el celular ya no está ahí. Ahora lo busca en la
página, comprueba que esté una sola vez, y mide lo mismo que antes: sus
textos y su botón. **El 233 no cambió** y sigue verde.

`python3 scripts/sabotajes_inicio_cierre_celular_1.py` → «todos dieron el rojo
esperado» (seis) y «src después: como estaba»:

| sabotaje | rojo del 240 |
|---|---|
| `en-el-medio` (pedido): en el celular el bloque vuelve a la grilla | 13 problemas, sólo en 390 y 599 y al pasar a 390: «390: «¿Te interesa alguno?» no está después de «Principio de AgroBoeda»: es la 8.ª de la grilla», «390: después de la tarjeta 07 viene el cierre, y no el crédito», «el crédito no se ve junto a la tarjeta 07: 316 px» y el Tab en el orden viejo |
| `dos-veces`: el bloque se dibuja en la grilla y al final | «390: el cierre está más de una vez o falta en el documento: 2 título(s), 2 «Escribinos», 2 texto(s)», y lo mismo en 599 |
| `en-todos-los-anchos`: el bloque va al final también en la computadora | «1440: «¿Te interesa alguno?» no es la octava de la grilla: está al final de Inicio», y lo mismo en 600 y 768. Nada en 390 ni en 599 |
| `sin-escuchar`: el ancho se lee al abrir y no se escucha | 1 problema: «al pasar de 1440 a 390, el cierre no fue al final» |
| `foco-perdido`: al mudarse, el bloque no devuelve el foco | 2 problemas: «al pasar de 1440 a 390 con el foco en «Escribinos», el foco quedó en BODY», y lo mismo de vuelta |
| `titulo-h3`: al final, el título sigue de nivel 3 | 2 problemas: «390: al final, el cierre es un H3 y en el índice de títulos queda dentro de «Cómo funciona»», y lo mismo en 599 |

## Agregado de MARCAS-PANEL-1

En dos commits aparte: el código en `1eb819d`, y los casos y los negativos en
`baa2705`.

1. **Unir con pausadas y eliminadas.** El 239 crea una marca con tres
   publicaciones (una activa, una pausada y una eliminada), la une a John
   Deere y comprueba que las tres quedan con John Deere. La respuesta dice
   «movidas 2», las que no están eliminadas. **Tu negativo
   `unir-solo-activas` ahora da rojo:** «API: unir una marca con una
   publicación activa, una pausada y una eliminada respondió 200 (movidas 2),
   y la pausada quedó con «quieta-…», la eliminada quedó con «quieta-…»».
2. **Configuración no renombra una marca.** El 239 pide
   `PUT /admin/form-options/{id}` sobre una marca y espera 400 con el nombre
   intacto. **Tu negativo `configuracion-renombra` ahora da rojo:** «API:
   Configuración renombró una marca por la ruta genérica (HTTP 200)». Lo
   pruebo antes que el borrado: con el borrado roto, renombrar después daría
   404 y no diría nada del cambio de nombre.
3. **«Editar» muestra el nombre de una marca dada de baja.** La causa:
   «Editar» lee la lista de publicaciones propias (`/products/my`), que
   traía sólo el valor interno, y la marca ya no venía en la lista del alta.
   - **Arreglo:** `/products/my` suma `brand_label`, con una sola consulta
     para todas las publicaciones, y «Editar» lo usa. Si no hay nombre,
     muestra el valor, como antes.
   - **Caso:** en el 239, en los dos anchos, con «AgroMec» dada de baja,
     quien vende abre «Editar» y el selector dice «AgroMec».
   - **Negativos, los dos en rojo** con «escritorio: dada de baja, «Editar»
     muestra la marca como «agromec»» y lo mismo en celular:
     `editar-valor-interno` (la pantalla vuelve a mostrar el valor) y
     `mis-publicaciones-sin-nombre` (la API deja de mandar el nombre).
4. **El 195 espera las opciones del tipo.** Las relee hasta que coinciden con
   la base, por 20 s como máximo, y si no llegan dice qué ofreció. Reproduje
   la carrera retrasando 3 s la respuesta del catálogo: leídas enseguida dan
   `["Todos"]`; con la espera, `["Todos","Rastras (1)"]`.
   - **Otros casos que leían igual:** el 198, el 238 y el 239 leen el filtro
     de marca apenas aparece. Ahora esperan a que alguna opción diga «(n)».
     Los demás que leen opciones (el alta y «Editar») leen listas que no
     dependen de la respuesta del catálogo, y ya esperaban sus opciones.

`python3 scripts/sabotajes_marcas_panel_1.py` → «todos dieron el rojo
esperado» con los doce: los cuatro nuevos y los ocho de antes. Los repetí
porque el 239 cambió. Siguen en rojo, algunos con más problemas: por
ejemplo, `unir-sin-mover` pasa de 8 a 9, porque ahora también falla la marca
de las tres publicaciones. «src y backend después: como estaban», y la base
sigue con las 44 marcas de la lista.

## Cómo verificarlo

Con el entorno arriba (API en 8000 y frontend de desarrollo en 5173):

```bash
SMOKE_CASOS=239,240 node scripts/smoke.mjs
# → 2/2 pasaron; 0 fallaron

python3 scripts/sabotajes_inicio_cierre_celular_1.py en-el-medio
# → [ROJO ESPERADO] y «todos dieron el rojo esperado»

REINICIAR_API="<tu reinicio>" python3 scripts/sabotajes_marcas_panel_1.py unir-solo-activas configuracion-renombra
# → dos [ROJO ESPERADO] y «todos dieron el rojo esperado»
```

Los negativos de Inicio son de pantalla y no reinician la API. Los dos tuyos
de marcas sí: usan `REINICIAR_API`.

## Puertas

| puerta | resultado |
|---|---|
| suite completa desde base nueva, sobre `baa2705` (todo lo entregado) | **239/240**. Sólo cae el **131**, de entorno: «puente docker: sólo se traduce 'docker exec'». Pasan el 195, el 198, el 232, el 233, el 238, el 239 y el 240 |
| la corrida anterior, sobre `8fbd0aa` (sólo Inicio) | también 239/240, con el mismo 131 |
| 232 | el ajustado lo corrí también sobre el código de antes del cambio, y pasó: no depende de dónde esté el bloque, eso lo mide el 240 |
| tipos, lint, build | verdes: `npm run lint` sin avisos y `npm run build` con `tsc` |
| diff-check con `cr-at-eol` sobre `4f453a0..baa2705`, fuera de `docs/pm` | limpio; ninguna línea cambia sólo por el final |
| a11y `--todas` | 82 de 82 pantallas, «SIN VIOLACIONES BLOQUEANTES, COBERTURA COMPLETA» |
| contraste | «las 86 mediciones exigidas se hicieron», «TODO OK, COBERTURA COMPLETA» |
| auditoría móvil | 12 de 12 recorridos y 39 pantallas: 0 desbordes, 0 controles tapados, 0 errores de consola y 0 respuestas 4xx/5xx |
| `guia-admin.mjs` | «LA GUÍA Y EL PANEL COINCIDEN: 30 pasos en escritorio y celular» |
| `guia-usuario.mjs` | «LA GUÍA Y EL SITIO COINCIDEN: 23 pasos en escritorio y celular» |
| backend | `compileall` verde; sin migración. Un solo cambio de API: `brand_label` en `/products/my`, aditivo |

Las auditorías y las dos guías son de la corrida sobre `baa2705`. Las guías
no mencionan el bloque de Inicio ni el selector de marca de «Editar», así
que no cambiaron.

**Líneas con CR por archivo, contra la base:**

| archivo | base | ahora |
|---|---|---|
| `HomePage.module.css` | todo CRLF (818) | todo CRLF (825) |
| `HomePage.tsx` | 0 de 296 | 0 de 327 |
| `Header.tsx` | 0 de 278 | 0 de 254 |
| `scripts/smoke.mjs` | 4 | 4 (las mismas) |
| `backend/app/api/products.py` | 931 de 933 | 942 de 944: las 11 agregadas, con CR como sus vecinas |
| `UserDashboard.tsx` | 4209 de 4538 | 4220 de 4549: las 11 agregadas, con CR como sus vecinas |
| `src/hooks/useEsMovil.ts` y los dos scripts de negativos | nuevos o en 0 | 0 |

## Lo que cambió además

- **La consulta del ancho de celular pasó a un archivo compartido**
  (`src/hooks/useEsMovil.ts`). La cabecera ya la tenía para el texto de la
  búsqueda, e Inicio ahora la usa también. La cabecera hace lo mismo que
  antes: el 128, que mide ese texto en la computadora («Buscar producto,
  servicio o ubicación») y en el celular («Buscar»), sigue verde.

## Riesgos

- **Ninguno nuevo de datos:** lo de Inicio es sólo de pantalla, y la API
  sólo suma un campo de lectura. Nada que ya existía cambia ni sale.
- **El 195 que te cayó** ahora espera. No lo puedo hacer caer a voluntad sin
  retrasar la respuesta, y con la respuesta retrasada la espera lo cubre.
- **Si un navegador no supiera leer el ancho** (`matchMedia`, que tienen
  todos los actuales), el bloque queda en la grilla, como estaba antes.

## Revisión independiente de esta entrega

Es el paso nuevo de `/entregar` (abajo), corrido por primera vez sobre esta
entrega: `/code-review` en nivel alto, sobre `4f453a0..HEAD`, sin `docs/pm`.
Sólo lee el código: no corre la app ni los casos. Encontró nueve puntos.
Ninguno rompe un flujo principal ni toca datos.

Emi me pidió no sumar nada sin que lo veas. El arreglo del punto 1 está
hecho, con su rojo, pero **no está subido**.

| # | Qué encontró | Severidad | Recomendación |
|---|---|---|---|
| 1 | En «Editar», con la marca dada de baja: si quien vende elige otra, la dada de baja desaparece del selector y ya no la puede volver a elegir (sólo cancelando). Ya pasaba antes de esta entrega, en el mismo selector del agregado | P2 | **Sumarlo.** El 239 lo detecta en los dos anchos: «escritorio: dada de baja, en «Editar» quien elige otra ya no puede volver a elegir «AgroMec»» (rojo antes del arreglo, verde después) |
| 2 | El nombre de una marca: si hubiera dos filas con el mismo valor, «Editar» y la ficha podrían elegir nombres distintos | P3 | Nada por ahora: hoy no se pueden crear dos (el alta las une con candado) |
| 3 | Si el ancho cambia justo entre el primer dibujo y el arranque de Inicio, el bloque se muda sin devolver el foco | P3 | Sumarlo: una línea |
| 4 | Al girar el celular, un cuadro con el bloque en su lugar viejo y el estilo nuevo, y el foco vuelve después de ese cuadro | P3 | Sumar lo del foco: una línea. El cuadro, no |
| 5 | La espera nueva de los filtros (198, 238, 239) acepta cualquier cantidad, no la de la respuesta nueva | P3, de las pruebas | Nada por ahora: cada lectura es en una página recién abierta |
| 6 | El corte de 599 px también está escrito en la foto de la portada | P3, ya estaba | Nada |
| 7 | Los scripts de negativos repiten las mismas funciones | P3, ya estaba | Una pieza aparte, si querés ordenarlo |
| 8 | Inicio guarda el aviso de cambio de ancho mientras dibuja, y no después | P3 | Sumarlo: una línea |
| 9 | Si la marca de las tres publicaciones del 239 no se creara, el caso cae con un error genérico y no con su mensaje | P3, de las pruebas | Sumarlo: una línea |

Si decís que sí, lo subo con la suite y las puertas otra vez.

## Emi decidió hoy (03/10): cómo nos comunicamos

Su prioridad: «menos errores» y «la mejor calidad de código posible; quiero
un producto full confiable». Si estás de acuerdo, lo sumamos así:

1. **Comandos del proyecto, cada lado los suyos.** Los míos ya están en
   `.claude/skills/`:
   - `/respondio`: traer la rama, integrar tus commits y hacer lo que dice
     `PARA-DEV.md`;
   - `/entregar`: revisión independiente, negativos, puertas, commits,
     informe y push.

   **Los tuyos los escribís vos.** Propuesta: `/revisar-entrega` (leer
   `PARA-PM.md` desde la rama, correr los comandos del informe y tus
   negativos, y escribir el veredicto) y `/ponete-al-dia` (`ONBOARDING-PM`).
2. **Un loop de espera, en vez del aviso de Emi.** Después de subir, cada
   lado revisa la rama cada ~30 min y retoma solo cuando el otro escribió en
   su canal. Yo: `/loop 30m /respondio`. Vos: lo mismo con tu comando. No te
   puedo avisar directo: tu sesión no está en mi máquina, así que el canal
   sigue siendo la rama.
3. **Lo que sigue pasando por Emi:** publicar en `main`, desplegar y las
   decisiones de producto, costo o riesgo. Tu veredicto y la siguiente pieza
   de la cola corren solos.
4. **Una pieza nueva arranca recién con el veredicto de la anterior.** Esta
   vez arranqué `INICIO-CIERRE-CELULAR-1` antes de que aceptaras
   `MARCAS-PANEL-1`, y el agregado llegó con la mitad hecha. Si le vas a
   sumar algo a una tarea, que esté escrito antes de activarla; si no, va
   como pieza aparte.
5. **Revisión independiente antes de cada informe:** `/code-review`, y
   `/security-review` cuando la pieza toca dinero, sesión, permisos o datos.
   No reemplaza tu reproducción: te llega antes lo que encuentra.
6. **La skill de Karpathy no la sumé.** Emi preguntó por ella, pero
   `CLAUDE.md` ya cubre sus cuatro reglas, y tenerlas escritas dos veces haría
   que una de las copias quede vieja.

Sumé una línea en `CLAUDE.md` §4 que apunta a los dos comandos. Si algo de
esto no te cierra, decilo y lo saco.

### Dos borradores para que elijas

Emi me pidió elegir las dos mejores ideas y que vos decidas. Están en
`.claude/propuestas/`, donde no se activan solas. Si adoptás una, se mueve a
`.claude/skills/`:

- **`/como-venimos`, para Emi, en tu sesión y en la mía.** Le contesta en tres
  líneas quién tiene la pelota, qué sigue y qué decide ella, leyendo la rama y
  no la memoria del chat. Sólo lee. Hoy Emi pregunta «¿cómo venís?» a cada
  lado por separado.
- **`/revisar-entrega`, el tuyo.** Es tu método de `ONBOARDING-PM` puesto en
  orden: ver si `PARA-PM.md` cambió, reproducir, veredicto en `PARA-DEV.md`,
  subir y dejar el loop de espera. Cambialo como quieras: es tuyo.

`/ponete-al-dia` no lo escribí: sería sólo llamar a «Cuando Emi diga “ponete
al día”» de `ONBOARDING-PM`, que ya está paso a paso.

La tercera idea, informes más cortos, la dejé afuera: ya es regla en
`CLAUDE.md`, y acortar más podría sacarte evidencia que necesitás para
verificar.
