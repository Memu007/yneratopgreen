# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## CAT-PAGE-1 — R1

| | |
| --- | --- |
| **Rama** | `claude/dev-role-repo-3l0kp3` |
| **SHA base** | `617a71b` — tu relevo con la devolución R1, que ya contiene `a521631` y `473ae19` |
| **SHA candidato** | `575f757` |
| **SHA probado** | `575f757` — este informe es el commit siguiente y no toca producto ni pruebas |
| **Diff desde `617a71b`** | `src/App.tsx` (+34/−17) y `scripts/smoke.mjs` (+192). Nada más |
| **Estado** | en mi rama. No integré, no desplegué, no rediseñé el paginador, no cambié el contrato de la API, ni toqué Railway, datos remotos, pagos, imágenes, taxonomía ni seed. No empecé `QUERY-IMG-1` |

---

### Tenías razón, y se ve peor midiéndolo que leyéndolo

`consultaVigente` omitía las cuatro dimensiones que `a521631` hizo viajar al
servidor. El comentario que justificaba dejar afuera dos de ellas —«no viajan a
la consulta»— describía el código anterior a mi propia tarea: lo dejé sin
actualizar cuando las hice viajar.

Lo reproduje antes de escribir la corrección, con la respuesta del catálogo
demorada a propósito y muestreando el DOM cuadro a cuadro. Hacer clic en
«Siguiente»:

```
  +   0ms  Página 1 de 9   ocupado=false  24 tarjetas  Smoke calificacion…
  +  92ms  Página 2 de 9   ocupado=false  24 tarjetas  Smoke calificacion…  ← acá
  + 119ms  (sin paginador) ocupado=true    0 tarjetas
  +1709ms  Página 2 de 9   ocupado=false  24 tarjetas  Pag145… publicacion 17
```

La ventana dura entre **16 y 38 ms** —cinco corridas—: el rótulo ya dice «Página
2» sobre las veinticuatro tarjetas de la 1, sin ningún estado de carga. No es un
cuadro suelto, es todo lo que se pinta hasta que arranca el efecto, porque los
efectos corren después de dibujar. Es el mismo agujero que encontró el caso 167
al soltar un filtro, con otras cuatro dimensiones.

### La corrección

Mínima y sin nada alrededor:

1. En la firma entra ahora todo lo que viaja: `subcategoriaElegida?.id`,
   `minRating`, `ordenPedido.sortBy`, `ordenPedido.sortOrder` y `pagina`.
   Entran los **valores**, no los objetos: lo que describe la consulta es el id
   que viaja, no la identidad del objeto que lo envuelve.
2. Los dos memos que derivan esos valores suben por encima de la firma, porque
   la firma los necesita. No les cambié una línea.
3. El comentario dice la regla en vez de la excepción: **en la firma entra TODO
   lo que viaja a la consulta**, y por qué la excepción anterior era legítima
   mientras subcategoría y calificación se resolvían en el navegador.

### El negativo, y las dos cosas que casi se me pasan

El bloque B11 del caso 171 demora la respuesta del catálogo 1200 ms y exige que
durante esa demora no se presente la página anterior como si fuera la nueva. Las
dos correcciones de método salieron de medir, no de razonar:

**1. El instrumento.** Empecé con un `MutationObserver` —ve cada commit del DOM
se pinte o no— y contra la base daba el rojo esperado. Pero al comprobar
dimensión por dimensión descubrí que **no ve el orden, la subcategoría ni la
calificación**: lo que cambia ahí es el valor de un `<select>`, que el navegador
pinta sin mutar el DOM. Ese negativo habría dejado volver a omitir tres de las
cuatro. Ahora se mira por dos instrumentos:

- `requestAnimationFrame`, que corre justo antes de pintar —no aproxima lo que
  se ve, es lo que se ve—, y es el único que sirve para los tres selectores;
- el `MutationObserver`, que hace la medición independiente del cuadro cuando la
  transición sí muta el DOM, como el rótulo del paginador.

`setTimeout` lo descarté con datos: en Chromium queda detrás del MessageChannel
con el que React vacía los efectos, y en 640 muestras no cayó nunca adentro de
la ventana.

**2. Dónde se mueve cada control.** Mi primera versión medía las cuatro
dimensiones en fila, y con eso **el orden daba verde aunque estuviera omitido**.
Cambiar orden, subcategoría o calificación desde una página interior vuelve a la
página 1, y esa página —que sí está en la firma— cambiaba sola y tapaba el
defecto. Ahora cada dimensión se mueve donde es **lo único** que cambia en la
consulta: las tres primeras desde la página 1, y la página al final. Quedó
escrito en el caso, porque es la clase de detalle que se pierde en la próxima
edición.

El caso además se niega a dar verde por no haber mirado nada: exige que algún
estado observado haya marcado la espera y que los dos instrumentos hayan
aportado muestras.

### La prueba de que discrimina

Saqué **una sola dimensión de la firma por vez** —sin tocar las dependencias del
efecto, para que la consulta siguiera saliendo y el único cambio fuera la firma—
y corrí el caso completo:

| Firma sin… | Caso 171 |
| --- | --- |
| subcategoría | **rojo** — «el control ya decía "Drones y VANTs" y la grilla seguía mostrando las 24 publicaciones anteriores sin ningún estado de carga» |
| calificación mínima | **rojo** — «el control ya decía "4"…» |
| orden | **rojo** — «el control ya decía "price-asc"…» |
| página | **rojo** — «el control ya decía "Página 2 de 5"…», visto por los dos instrumentos |
| completa | **verde**, tres corridas seguidas |

### Compuertas

| Puerta | Resultado |
| --- | --- |
| caso 171 focal desde base limpia | **verde**, 3/3 corridas |
| rojo discriminante, una dimensión por vez | **los cuatro** de la tabla de arriba |
| suite completa desde base limpia sobre `575f757` | **170/171**; único rojo el **131** |
| `npm run build` | verde |
| `npm run lint` · `npx tsc --noEmit` · `node --check` | verdes, 0 avisos |
| `git -c core.whitespace=cr-at-eol diff --check` | sin avisos |
| `npm run a11y -- --todas` | **72/72** pantallas, 0 violaciones bloqueantes |
| `npm run contraste` | **80/80** mediciones, 10 312 textos, **0 incumplimientos** |
| revisión visual 1440×900 y 390×844 | abajo |

El **131** es el rojo ambiental de siempre: la receta necesita `docker run --rm`
con `alpine:3` y acá el `docker` del PATH es un puente que sólo traduce
`docker exec`. No es de esta tarea y no lo toqué.

### La revisión visual

En los dos anchos, y midiendo el desborde horizontal en cada paso:

```
escritorio  página 1     «Página 1 de 9»  Anterior apagado   desborde 0 px
            esperando    aria-busy=1, 0 tarjetas             desborde 0 px
            página 2     «Página 2 de 9»  los dos activos    desborde 0 px
celular     idéntico en los tres pasos                       desborde 0 px
```

Lo que cambia la R1 se ve en el paso del medio: al avanzar de página, donde
antes quedaban las tarjetas viejas bajo el rótulo nuevo, ahora aparecen los
bloques de carga. El paginador asentado quedó igual que en `a521631`.

### Lo que no corrí

Nada que la tarea pidiera. Corrí las tres puertas completas —suite, a11y y
contraste— aunque el cambio es de una firma y un caso, porque toca el render del
Mercado y prefería no decidir yo cuáles eran «las afectadas».

### Lo que queda abierto de la entrega anterior

Sigue en pie la única decisión que te dejé en `473ae19`, y esta corrección no la
cambia: `page` y `sort` se escriben con `replaceState` como el resto de los
filtros, así que **Atrás no retrocede de página en página** —restaura la página,
el orden y los filtros de la entrada a la que vuelve—. Si querés que cada página
sea una entrada propia del historial, es otra decisión de producto y es tuya.
