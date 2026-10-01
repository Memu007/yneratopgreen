# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## INICIO-ECOSISTEMA-1: entrega

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `5412555` (tu nota de traspaso) |
| producto | `b5daa24` · `7d7d808` (la banda en 390) |
| casos y negativos | `c020222` |
| capturas | `162e04b` (1440) · `7d7d808` (390, rehecha) |
| no integrado, no desplegado | `main` sigue en `77d3d2c` |

**La empezó otra cuenta de Dev y la cierro yo.** Dejó `b5daa24`,
`c020222` y `162e04b`, sin informe. Revisé su diff contra la tarea y la
maqueta, y rehíce toda la evidencia de este informe en esta sesión.

**Resultado.**

- **Inicio es la maqueta v2** con los textos aprobados, tal cual:
  - la portada sobre la banda verde;
  - los siete servicios en su orden; sólo el Mercado dice «Disponible hoy»,
    con su número y «Entrar al Mercado»;
  - «¿Te interesa alguno?» con «Escribinos»;
  - el crédito de las dos fotos CC BY, con la obra, el autor y la licencia
    enlazados como en el inventario;
  - «Cómo funciona», en cinco pasos;
  - el principio con sus tres niveles.

  Salieron «Publicar una oferta», los tipos de publicación y «Lo que muestra
  cada publicación».
- **«Quiénes somos» salió** del menú (escritorio y celular), del pie y del
  sitio. `?section=about` lleva a Inicio reescribiendo la barra, sin sumar
  una entrada al historial. El manual ya no la nombra.
- **Agregué una corrección** (`7d7d808`). En 390, la banda de la foto de
  portada («Cosecha y descarga de grano · Campo argentino») se cortaba con
  puntos suspensivos: necesitaba 344 px y tenía 282.
  - Venía del Inicio anterior: es la misma regla de CSS, de UX-2D.
  - La maqueta la parte en dos líneas, y ahora el sitio también.
  - Medí todos los textos de Inicio en 390 y en 1440, y ninguno se corta.
- **Ningún caso se retiró entero.** Se cambiaron 16; abajo está qué se sacó
  de cada uno y por qué.

**Nada para decidir.** Hay un riesgo de producto en «Riesgos».

## Capturas

`docs/pm/capturas/inicio-ecosistema-1/`:

- `inicio-1440-sitio-y-maqueta.jpg`;
- `inicio-390-sitio-y-maqueta.jpg`.

**Lo que difiere de la maqueta, y por qué:**

| | sitio | maqueta | por qué |
|---|---|---|---|
| número del Mercado | el del catálogo (30 en una base recién creada) | 242 | el 242 es de ejemplo |
| crédito de las fotos CC BY | debajo de las tarjetas | no está | lo pide la tarea |
| franja «Maqueta…» | no está | arriba | la tarea la saca |
| espacios entre secciones | algunos píxeles más en 1440 | | las medidas salen de `tokens.css`, como pide la tarea |

## Casos

| caso | qué mira |
|---|---|
| 232 | En 1440 y en 390: los textos aprobados, los siete servicios en orden, el estado de cada uno, ninguna «Próximamente» con enlace o botón, las fotos (archivo, `alt` vacío, carga diferida, ancho y alto), el crédito y sus cinco enlaces, la ruta y el principio |
| 233 | En los dos anchos, «Conocé el ecosistema» deja el foco en «¿Qué querés hacer?», y «Entrar al Mercado» y «Escribinos» llevan adonde dicen. El número del Mercado es el del catálogo, también en singular; mientras no se sabe, no se escribe ninguno |
| 234 | «Quiénes somos» no está en el menú, en escritorio ni en celular, ni en el pie. `?section=about` termina en Inicio sin sumar una entrada al historial |

**Casos cambiados:** 122, 123, 124, 128, 147, 155, 156, 158, 163, 167, 168,
170, 192, 193, 208 y 209.

- **Usaban «Quiénes somos» como una sección más**, y ahora usan Contacto: 122,
  128, 147, 156, 158, 163, 170 y 193.
- **Miraban el Inicio de antes** (el título, «Publicar una oferta», las
  tarjetas), y ahora miran el nuevo: 123, 124 y 155.
  - El 155 busca las tarjetas de publicaciones como `article[class*="card"]`,
    para no confundirlas con las de los servicios.
  - Tiene 1 px de tolerancia porque la cabecera en celular quedó en una sola
    fila.
- **El 156** ya no toma «AGROBOEDA» como el nombre viejo. Es el rótulo nuevo
  en mayúsculas.

**Lo que se retiró, porque era propio de lo que salió:**

| caso | qué se sacó |
|---|---|
| 167 | publicar sin sesión desde «Publicar una oferta» de Inicio y de Quiénes somos, y que el formulario se retome después de ingresar. Los dos botones salieron, y con ellos `pedirPublicar` de `App.tsx` |
| 168 | que Quiénes somos no dijera «Contactanos» ni tratara de «tú» |
| 192 | el cierre de Quiénes somos, «Publicá o buscá en el Mercado agropecuario» |
| 208 | «Lo que muestra cada publicación» en Inicio |
| 209 | el bloque de datos de Inicio y lo de Quiénes somos: la invitación, «Nuestro equipo» y la foto. Siguen Inicio sin publicaciones, Contacto sin preguntas frecuentes y nada que diga «comisión» |

## Negativos

`python3 scripts/sabotajes_inicio_ecosistema_1.py` → «todos dieron el rojo
esperado» y «src y backend después: como estaban».

| sabotaje | rojo |
|---|---|
| `proximamente-con-enlace` (pedido) | 232: 12 problemas, las seis tarjetas «Próximamente» con un enlace, en los dos anchos |
| `quienes-somos-en-el-pie` (pedido) | 234: 4 problemas, «el pie tiene «Quiénes somos»» y «la página nombra «Quiénes somos»», en 1440 y en 390 |
| `sin-credito` (pedido) | 232: 2 problemas, «no está el crédito de las fotos», en los dos anchos |
| `numero-provisorio` | 233: 1 problema, «con el catálogo sin contestar, el Mercado ya dice un número» (decía 0) |
| `sin-foco` | 233: 2 problemas, el foco queda en el botón y no en «¿Qué querés hacer?», en los dos anchos |
| `about-sin-retirar` | 234: 2 problemas, la barra queda en `?section=about` al abrir el enlace viejo y al volver a él con «Adelante» |

Los seis son de pantalla. El script igual reinicia la API con `REINICIAR_API`.

## Cómo verificarlo

Con el entorno arriba y la siembra demo:

```bash
SMOKE_CASOS=232,233,234 node scripts/smoke.mjs
# → 3/3 pasaron; 0 fallaron

REINICIAR_API="<tu reinicio>" python3 scripts/sabotajes_inicio_ecosistema_1.py
# → todos dieron el rojo esperado
```

## Puertas

| puerta | resultado |
|---|---|
| suite completa desde base nueva, sobre `7d7d808` | **233/234**. Sólo cae el **131**, de entorno: «puente docker: sólo se traduce 'docker exec'». Pasan el 213, el 232, el 233 y el 234 |
| tipos, lint, build | verdes (`npm run build` incluye `tsc`; lint sin avisos) |
| `node --check`, parseo de Python | verdes |
| diff-check con `cr-at-eol` sobre `5412555..7d7d808` | limpio; ninguna línea cambia sólo por el final |
| a11y `--todas` | 78 de 78 pantallas, 0 violaciones. Eran 80: salieron las dos de Quiénes somos |
| contraste | 82 de 82, ninguna por debajo del mínimo. Eran 88: salieron las de Quiénes somos |
| auditoría móvil | 12 de 12 recorridos y 39 pantallas: 0 desbordes, 0 controles tapados, 0 errores de consola y 0 respuestas 4xx/5xx |
| `guia-admin.mjs` | «LA GUÍA Y EL PANEL COINCIDEN: 26 pasos en escritorio y celular» |
| `guia-usuario.mjs` | «LA GUÍA Y EL SITIO COINCIDEN: 22 pasos en escritorio y celular» |

**Líneas con CR por archivo, contra la base:**

| archivo | base | ahora |
|---|---|---|
| `scripts/smoke.mjs` | 4 | 4 (las mismas) |
| `src/App.tsx` | 534 | 525: 11 en líneas borradas, 2 en agregadas |
| `src/components/Pages/HomePage.module.css` | 429 de 429 | 818 de 818 |
| `AboutPage.tsx` y `AboutPage.module.css` | 130 y 292 | borrados |
| los otros 11 archivos | 0 | 0 |

## Riesgos

- **Sin sesión no queda ningún botón para publicar.** Salió «Publicar una
  oferta» de Inicio, como pide la tarea, y salió la página de Quiénes somos,
  que tenía el otro. «Vender» aparece en la cabecera sólo después de
  ingresar. La tarjeta del Mercado dice «o publicá una oferta», pero su
  botón lleva al Mercado. Si se quiere un camino para publicar sin sesión,
  es una pieza chica: volver a usar el que se fue.
- **La cabecera en celular cambió de forma.** Con tres destinos, el menú va
  en tres columnas y en una sola fila. Es parte de sacar «Quiénes somos» del
  menú.
- **«Próximamente» describe servicios que todavía no existen,** con el texto
  aprobado.
