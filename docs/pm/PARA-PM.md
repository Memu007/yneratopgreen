# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## AVISOS-1 y su agregado chico: entrega

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `b218412`; integré tus commits hasta `914c2b0`, que tocan sólo `docs/pm` |
| AVISOS-1, producto | `98cc39f`, con los arreglos de la autorrevisión en `0958c76` y los finales de línea en `259f232` |
| AVISOS-1, caso, negativos y puertas | `9900b55`, `a1397b9`, `5eb9ae1` y `5b1032d` |
| agregado, producto | `8fe56f7`; `1066d4b` le saca un `useEffect` sin uso que rompía `tsc` |
| agregado, casos y negativos | `cfeb23f` |
| D6, `DELIVERY_CHECKLIST.md` | `d694763` |
| reglas repetidas, aparte | `9f4d308` (`CLAUDE.md` §3 y `AGENTS.md`) y `ed34fb4` («Eficiencia de chats») |
| no integrado, no desplegado | `main` sigue en `e5d592e` |

**Resultado: terminado.** El producto quedó fijo en `259f232`, y la suite
completa corrió sobre ese SHA. Después sólo cambiaron `a11y.mjs`,
`contraste.mjs` y `guia-admin.mjs`, que se volvieron a correr sobre `5b1032d`.

### Decisiones

| | Qué decidís | Recomiendo |
|---|---|---|
| D1 | En el celular, un aviso de abajo puede tapar un botón del pie de la pantalla. Con el dedo encima se pausa y no se va hasta que se cierra con «×» o se desliza. La guía del panel lo encontró en el paso 24, al guardar una opción de Configuración | **Una pieza chica aparte:** en pantallas táctiles, el aviso se pausa con el foco y no con el dedo encima. La alternativa es dejarlo así: se cierra con «×» o deslizándolo |

**Supuestos, todos reversibles:**

1. **Esquinas de 14 px,** como la maqueta. `tokens.css` llega a 6 px, que es
   para tarjetas y controles.
2. **El ícono rojo del error** usa los dos colores de la maqueta (`#e8746c`
   y `#3b0f0c`), que no están en `tokens.css`. El «!» mide 5,67:1 sobre el
   rojo, y el rojo mide 3,43:1 contra el verde.
3. **La acción va en un botón cereal con texto verde profundo,** como
   «Vender». En la maqueta es texto cereal, y el cereal como texto sobre el
   verde mide 3,86:1, debajo de 4,5. Así mide 5,14:1.
4. **Los cuatro tipos:**
   - éxito: tilde cereal;
   - error: «!» rojo;
   - atención: «!» cereal;
   - información: «i» cereal.

   Todo lo que no es error se va a los 4 s.
5. **La segunda línea** la usa sólo el aviso de «Agregado»: dice
   «Cantidad: N».
6. **«Ver carrito» va sólo en la ficha,** que es el único lugar donde hoy se
   agrega con aviso. La tarjeta del Mercado agrega sin aviso, y no se lo
   sumé. «Deshacer» y «Reintentar» no los puse: no hay ningún aviso cuya
   acción ya exista.
7. **Plegada se ven tres; desplegada, cinco como máximo.** Los de más atrás
   aparecen a medida que se cierran los de adelante.
8. **A mano, sin librería.**

## AVISOS-1

- **Cómo se ve:** píldora verde, texto blanco, ícono redondo, segunda línea
  tenue y sin rótulo en mayúsculas.
- **Dónde y cómo se mueve:**
  - abajo al centro en los dos anchos;
  - entra desde abajo con un rebote corto y sale bajando;
  - con `prefers-reduced-motion`, sin animación.
- **Pila:** los de atrás, más chicos y asomando, no dibujan su texto. Con el
  mouse o el foco encima, la pila se despliega.
- **Tiempos:**
  - lo bueno se va a los 4 s y se pausa con el mouse o el foco encima;
  - el error se queda, con `role="alert"`; lo demás lleva
    `role="status"`.
- **Cerrar:**
  - con «Cerrar aviso», también con Enter. Con el teclado, el foco pasa al
    aviso siguiente;
  - en el celular, deslizándolo de costado o hacia abajo.

Capturas de éxito, error, pila y pila desplegada, en 1440 y 390:
`docs/pm/capturas/avisos-1/`.

**Caso 241, nuevo, en 1440 y 390:**

- **Posición:** abajo, centrado al píxel y debajo de la cabecera.
- **Lo bueno:** sigue a los 3 s y se va entre 3,5 y 5,5 s; en la última
  corrida, a los 3986 y 4040 ms. Con el mouse encima sigue a los 5,5 s, y al
  sacarlo se va.
- **El error:** sigue a los 6 s, con `role="alert"`, y «Cerrar aviso» lo
  cierra.
- **Tres seguidos, plegados:** se lee sólo el de adelante y los de atrás
  asoman menos de 40 px. Desplegados, se leen los tres, no se enciman y no
  suben hasta la cabecera.
- **Teclado:** Enter cierra uno por uno, y el foco pasa al siguiente.
- **Con el mouse:** cerrar el de adelante con un aviso bueno detrás no deja
  la pila en pausa; el bueno se va solo.
- **«Ver carrito»,** al agregar desde la ficha, abre el carrito.

`python3 scripts/sabotajes_avisos_1.py` → «todos dieron el rojo esperado»:

| sabotaje | rojo del 241 |
|---|---|
| `error-se-va` (el tuyo) | «escritorio 1440px: a los 6057 ms quedan 0 errores y tenía que quedar 1», y lo mismo en celular |
| `arriba`: los avisos vuelven arriba | «el aviso empieza en 20 y la cabecera termina en 64», «el aviso no está abajo: termina en 72 de 900» |
| `texto-encimado`: los de atrás dibujan su texto | «plegada, se enciman…» y «plegada, se leen 3 de 3 y tenía que leerse sólo el de adelante» |
| `sin-pausa`: el mouse encima no pausa | «con el mouse encima, lo que salió bien se fue antes de 5509 ms» |
| `foco-perdido`: con el teclado, el foco no pasa al siguiente | «al cerrar con el teclado, el foco quedó en «null» y no en el aviso siguiente» |
| `foco-al-cerrar-con-mouse` | «al cerrar con el mouse el de adelante, el bueno de atrás no se fue solo» |
| `sin-ver-carrito` | «agregar desde la ficha no ofrece «Ver carrito»» |

**Los casos que leen avisos no hubo que ajustarlos.** Los que buscan
`[role="status"]` o `[role="alert"]` siguen verdes en la suite completa.

**a11y y contraste miden el aviso.** Agregué la superficie «aviso con acción»
en `lib/superficies.mjs`, así que las dos puertas la exigen. El Fertilizante
se agrega desde su ficha y se mide el aviso con el mouse encima. Después
«Ver carrito» abre el carrito, que queda igual que antes.

## Agregado chico

1. **El 204: la causa no es la carrera del 195, es un dato.**
   - En toda la siembra hay un solo tractor con marca, el Pauny. Si no está
     en el Mercado, «Marca» no se dibuja.
   - Pausándolo, el 204 da exactamente tu rojo: «el panel va [… "Potencia",
     "Año" …] y el acordado es [… "Potencia", "Marca", "Año" …]», en los dos
     anchos.
   - Retrasar 3 s el catálogo no lo hace caer: el panel aparece junto con la
     respuesta.
   - **Arreglo:** el 204 publica su propio tractor John Deere y lo retira al
     final. Antes de leer el orden, espera «Marca».
   - **Qué caso saca a Pauny en tu entorno: no lo sé.** Corrí una suite
     completa con un vigía que miraba los tractores con marca cada segundo, y
     Pauny no salió nunca: 239/240, con el 131 de entorno. El 198 desactiva
     y reactiva una marca en un `finally`. Es la sospecha que me queda, sin
     confirmar.
   - **Otros casos que leen el filtro de marca:** el 198, el 238, el 239 y
     la guía de uso. Todos publican sus propias marcas; ninguno depende de
     Pauny.
2. **El paso 28 de `guia-admin.mjs`: la misma clase de causa.** Tras dar de
   baja la marca, si Tractores no tiene otra, «Marca» no se dibuja, y la guía
   esperaba 15 s algo que no iba a aparecer. Ahora espera a que el panel esté
   armado: sin «Marca», es una lista vacía. No lo reproduje: con Pauny
   presente no cae.
3. **El punto 1, «Editar».** La opción de la marca dada de baja sale de la
   marca guardada en la publicación (`brand` y `brand_label` de
   `/products/my`), no de la elegida.
   - Antes del arreglo, el 239 daba rojo en los dos anchos: «dada de baja,
     en «Editar» quien elige otra ya no puede volver a elegir «AgroMec»».
   - Negativo nuevo, `editar-ofrece-la-elegida`.
   - `editar-valor-interno` quedó al día con el código nuevo.
4. **Los puntos 3, 4, 8 y 9:**
   - **3:** un cambio de ancho entre el primer dibujo y el efecto pasa por el
     mismo aviso, y el foco no se pierde.
   - **4:** Inicio devuelve el foco antes de pintar.
   - **8:** el aviso se guarda después de dibujar.
   - **9:** el 239 dice «publicar con la marca «Quieta…» no la creó».
5. **D6:** `DELIVERY_CHECKLIST.md` está en `docs/pm/archivo/`. Corregí
   `REPO_MAP.md` y lo anoté en el README del archivo.

**Reglas repetidas:**

- En `9f4d308` saqué de `CLAUDE.md` §3 las tres reglas, y de `AGENTS.md` las
  dos. Cada archivo remite a «Límites que no se negocian».
- «Eficiencia de chats» la reescribí en `ed34fb4`. Pediste que fuera en el
  mismo commit, pero cuando llegó tu pedido el primero ya estaba debajo de
  la integración de la rama.

## Cómo verificarlo

Con la API en 8000 y el frontend de desarrollo en 5173:

```bash
SMOKE_CASOS=204,239,241 node scripts/smoke.mjs
# → 3/3 pasaron; 0 fallaron

python3 scripts/sabotajes_avisos_1.py error-se-va
# → [ROJO ESPERADO] y «todos dieron el rojo esperado»

python3 scripts/sabotajes_marcas_panel_1.py editar-ofrece-la-elegida
# → [ROJO ESPERADO]: «… quien elige otra ya no puede volver a elegir «AgroMec»»
```

El rojo del 204, sin sabotear código: pausá el Pauny de la siembra
(`UPDATE products SET status='PAUSED' WHERE slug='tractor-pauny-280a-doble-traccion'`)
y corré el 204 sobre `e5d592e`. Después volvelo a `ACTIVE`.

## Puertas

| puerta | resultado |
|---|---|
| suite completa desde base nueva, sobre `259f232` | **240/241**. Sólo cae el **131**, de entorno: «puente docker: sólo se traduce 'docker exec'». Pasan el 204, el 239, el 240 y el 241 |
| tipos, lint y build | verdes: `tsc` sin errores, `npm run lint` sin avisos y `npm run build` |
| a11y `--todas`, sobre `5b1032d` | «SIN VIOLACIONES BLOQUEANTES, COBERTURA COMPLETA», con «aviso con acción» en los dos anchos |
| contraste, sobre `5b1032d` | «las 88 mediciones exigidas se hicieron», «TODO OK, COBERTURA COMPLETA» |
| auditoría móvil | 39 pantallas: 0 desbordes, 0 controles tapados, 0 errores de consola y 0 respuestas 4xx/5xx |
| `guia-admin.mjs`, sobre `5b1032d` | «LA GUÍA Y EL PANEL COINCIDEN: 30 pasos en escritorio y celular», con la nota «un aviso tapaba el control» (D1) |
| `guia-usuario.mjs` | «LA GUÍA Y EL SITIO COINCIDEN: 23 pasos en escritorio y celular» |
| negativos | avisos 7/7, marcas 13/13 e Inicio 6/6: «todos dieron el rojo esperado», y «src y backend después: como estaban» |
| backend | `compileall` verde; sin migración y sin cambio de API |
| diff-check con `cr-at-eol` sobre `b218412..HEAD`, fuera de `docs/pm` | limpio; `--stat` da igual con y sin CR |

**Antes de las puertas finales hubo dos rojos míos, ya corregidos:**

- a11y y contraste buscaban «Agregar al carrito» en un insumo, que dice
  «Agregar».
- Contraste midió el aviso a mitad de su salida: 1,00:1, casi transparente.
  Ahora mide el carrito cuando el aviso ya se fue.

**Líneas con CR por archivo, contra la base:**

| archivo | base | ahora |
|---|---|---|
| `Toast.tsx`, `Toast.module.css` | todo CRLF | todo CRLF |
| `App.tsx` | 526 de 1009 | 527 de 1010: la línea nueva, con CR como sus vecinas |
| `UserDashboard.tsx` | 4220 de 4549 | 4222 de 4551: las dos nuevas, con CR como sus vecinas |
| `scripts/smoke.mjs` | 4 | 4, las mismas |
| `ProductDetailPage.tsx`, `HomePage.tsx`, `useEsMovil.ts`, `contextos.ts` y los scripts | 0 | 0 |

`ProductDetailPage.tsx` quedó con 3 CR por error en `98cc39f`; `259f232` lo
devuelve a LF.

## Autorrevisión

`/code-review` en nivel alto sobre `b218412..HEAD`, sin `docs/pm`. Es la
misma IA que escribió el código, así que no es independiente. Sólo leyó el
diff. Encontró diez puntos.

| # | Qué encontró | Qué hice |
|---|---|---|
| 1 | Cerrar con el mouse pasaba el foco al aviso siguiente, y la pila quedaba en pausa | Arreglado; rojo antes con el 241, negativo `foco-al-cerrar-con-mouse` |
| 2 | Cada aviso es su propia región `role="status"`, que entra ya con texto: algunos lectores de pantalla no anuncian así | Riesgo, abajo. No lo probé con un lector real |
| 3 | Sin rótulo, éxito, atención e información son la misma píldora verde | Los distingue el ícono: tilde o «!». La tarea pide sacar el rótulo |
| 4 | Las alturas se medían con la escala de los de atrás | Arreglado (`offsetHeight`) |
| 5 | Cruzar el hueco entre dos avisos desplegados plegaba la pila | Arreglado: la pila entera atrapa el puntero |
| 6 | «Ver carrito» cierra el aviso, y al cerrar el carrito el foco vuelve al cuerpo de la página | Riesgo, abajo |
| 7 | Muchos errores desplegados suben por encima de la pantalla | Arreglado: cinco como máximo |
| 8 | El contexto se recreaba en cada dibujo de la pila | Arreglado (`useMemo`) |
| 9 | `useEsMovil` podía perder un cambio de ida y vuelta | Arreglado; los seis negativos de Inicio, en rojo otra vez |
| 10 | Esperas fijas en el 241 | Las de medir son ahora esperas a que terminen las animaciones. Quedan las de 3, 5,5 y 6 s, que son el tiempo que se mide |

La misma autorrevisión, con las capturas, encontró dos defectos antes de
entregar. Los dos tienen hoy su rojo en el 241:

- cerrar un aviso con el mouse dejaba la pila desplegada para siempre;
- la pila desplegada se encimaba.

## Riesgos

- **Lectores de pantalla (punto 2).** Los avisos que no son error se anuncian
  como una región `status` nueva. NVDA y JAWS pueden no leerlos. Antes había
  un contenedor fijo. No lo probé con un lector real.
- **El foco después de «Ver carrito» (punto 6).** Al cerrar el carrito, el
  foco vuelve al cuerpo de la página.
- **El aviso tapa botones del pie en el celular.** Es D1.
- **Deslizar para cerrar no tiene caso.** Lo programé con eventos de puntero
  táctil, y ningún caso lo prueba.
- **Ninguno de datos:** no cambia la API ni la base.

## Qué no se corrió

- Deslizar con un dedo real, y un lector de pantalla real.
- La suite completa sobre `5b1032d`: desde `259f232` sólo cambiaron
  `a11y.mjs`, `contraste.mjs` y `guia-admin.mjs`, que corrí sobre
  `5b1032d`. El delta es `git diff --stat 259f232..5b1032d`, más las
  capturas y este informe.

## Desvíos del entorno

- **El contenedor no traía PostGIS.** Lo instalé con
  `apt-get install postgresql-16-postgis-3`.
- **Playwright 1.62 espera un Chromium que no está en la imagen.** Le
  apunté el Chromium 141 que trae la imagen con un enlace en
  `/opt/pw-browsers`, sin tocar el repositorio. Si en tu entorno Playwright
  trae el suyo, no te afecta.
- **Mi script de puertas borró sin querer la evidencia móvil versionada**
  del 25 y el 26/07. La restauré desde Git antes de commitear, y no hay
  ningún borrado en la rama.
