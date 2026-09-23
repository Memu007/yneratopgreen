# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## FICHA-MOBILE-WIDTH-1 — entregada, para tu revisión

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `95f3d8d` |
| candidato (ficha + caso 185 + negativos) | `78b682b` |
| capturas antes/después | `docs/pm/evidence/ficha-movil-2026-09-23/` |
| no integrado, no desplegado | `main` sigue en `0bd7fbc` |

**Resultado.** Se reproduce sobre la base demo limpia: a 360 px la ficha de
«Campo Agrícola de 120 Hectáreas» mide 366 px; vos mediste 368. Queda
corregido. A 360, 390 y 768 px no desborda y no queda nada recortado, ni con
esa publicación, ni con una larga sin foto, ni con una de precio corto. Sobre
la base demo limpia, la auditoría móvil da 12/12 recorridos, 0 desbordes y 0
recortes en el checkout, y sale con 0.

**Una cosa para que decidas; no bloquea esta pieza.** Encontré un defecto de
navegación en mi pieza PRODUCT-DETAIL-PAGE-1. **Después de recargar la ficha,
Atrás vuelve al Mercado y a veces pierde la búsqueda.**

- **Medido:** 8 de 20 intentos. En los 20, la barra pasa por
  `/?section=marketplace`. En 8 se queda ahí, y la lista queda sin la
  búsqueda.
- **Causa:** después de la recarga, el estado de los filtros arranca vacío,
  porque la barra es la de la ficha. Al volver, ese estado vacío se escribe
  en la barra antes de que se aplique la relectura.
- **Por qué no lo vi:** el 183 probaba la recarga y el Atrás por separado.
- **Para reproducirlo:** Mercado a 360 px con `?q=Campo Agrícola de 120
  Hectáreas`, abrir la ficha, recargar, Atrás. Repetido unas veces, la barra
  termina sin `q`.

Es de filtros y navegación, que están fuera de esta pieza, así que no lo
toqué. El caso 185 prueba la recarga y el Atrás por separado, y lo dice en un
comentario. Recomiendo que sea la pieza siguiente: se pierde lo que la
persona buscó, no datos, y se recupera buscando de nuevo.

## Causa, medida

La primera y las dos últimas aparecen con la publicación larga y sin foto.

1. **El precio.** Lleva un espacio duro entre «$» y el número, a propósito,
   para que la cifra no se parta. En celular estaba fijo en 40 px, y
   «$ 950.000.000» pedía 286 px con 244 disponibles. La columna única del
   grid (`1fr`) toma el ancho mínimo de su contenido, así que ensanchaba
   galería, resumen y detalle a 328 px: el documento medía 366. A 390 px el
   documento no desbordaba, pero el resumen sobresalía 12 px respecto de los
   demás bloques. El desborde lo impone el precio, no la foto.
2. **Un texto sin dónde partirse.** Un código pegado en la descripción
   ensanchaba la ficha igual. Con un enlace no alcanza: se parte en «/» y
   «-».
3. **Sin foto.** El marco sigue la proporción de la placa, 800/220. A 286 px
   de ancho queda en 78 px de alto, pero la placa mide al menos 88, y el marco
   le cortaba la leyenda «Sin registro fotográfico». Es lo que te había
   informado como visto y no tocado.

| publicación | 360 antes | 360 después | 390 antes | 390 después | 768 |
|---|---|---|---|---|---|
| Campo Agrícola, $ 950.000.000 | 366 | 360, cifra a 31 px | 390, con el resumen 12 px afuera | 390, cifra a 35 px | 768 antes y después |
| larga sin foto, $ 1.500.000.000 | 401 | 360, cifra a 27 px | 400 | 390, cifra a 30 px | 768 antes y después |
| Fertilizante, $ 28.500 | 360 | 360, cifra a 40 px | 390 | 390, cifra a 40 px | 768 antes y después |

Cada celda es el ancho del documento para esa pantalla. La larga «antes» es
una publicación de prueba con precio largo y un enlace; la del caso agrega
el código pegado.

## Para verificar, lo mínimo

```
SMOKE_CASOS=185 node scripts/smoke.mjs
  → [PASS] 185 … 360 campo 360/360 cifra 31 px; 360 larga 360/360 cifra
    27 px; 360 corto 360/360 cifra 40 px; 390 campo 390/390 cifra 35 px; …

python3 scripts/sabotajes_ficha_mobile_width_1.py geometria-anterior
  → [ROJO ESPERADO] [FAIL] 185 … 360x800 «Campo Agrícola de 120 Hectáreas»
    desde el Mercado: el documento mide 366 px en una pantalla de 360; …
```

Los dos necesitan la API en 8000, el frontend de desarrollo en 5173 y la
siembra demo, con «Campo Agrícola de 120 Hectáreas» activa y
`vendedor@ejemplo.com`. El caso crea la publicación larga y la retira al
terminar.

## Qué cambió

- **Ficha** (`ProductDetailPage.module.css`, más un atributo en el
  componente):
  - la columna única no hereda el ancho mínimo de su contenido;
  - en celular, el precio va a 40 px mientras entra y baja sólo si es largo:
    el componente pasa cuántos caracteres tiene la cifra, y el CSS usa el
    ancho de su bloque;
  - la descripción parte lo que no tiene dónde partirse;
  - el marco sin foto nunca queda más bajo que su placa. Además tiene un
    tope de ancho: el navegador sacaba de la altura mínima un ancho de
    320 px y el marco se salía de la ficha. Eso lo cazó el caso, no lo vi yo.

  No cambia ninguna regla global, dato ni backend.
- **Caso 185:**
  - A, a 360 px: la publicación demo se abre desde el Mercado, Atrás vuelve
    a su búsqueda, y se prueban Adelante y la recarga.
  - B: por enlace directo, las tres publicaciones en 360, 390 y 768.
  - Mide que el documento no desborde y que nada quede fuera de la ficha ni
    de su zona (galería, resumen, detalle). También que ningún texto quede
    cortado, que la cifra entre en su bloque y que la placa entre en su
    marco. El precio corto tiene que seguir a 40 px.
- **Negativos** (`scripts/sabotajes_ficha_mobile_width_1.py`):
  - `geometria-anterior`: el que pediste. Falla por el documento de «Campo
    Agrícola» a 360 px.
  - `cifra-fija`: falla porque la cifra se sale del resumen.
  - `placa-recortada`: falla porque la placa mide 88 en un marco de 79.
  - `enlace-sin-cortes`: falla porque el código pegado lleva el documento a
    544 px.

Los primeros negativos de dos de ellos no discriminaban, y corregí el caso:

- La cifra se medía contra su propia caja, que en línea mide lo mismo que su
  texto. Ahora se mide contra su bloque, y se exige que cada zona contenga
  lo suyo.
- La descripción de prueba tenía un enlace, que el navegador parte en «/» y
  «-». Ahora tiene un código pegado.

## Lo que corrí, sobre `78b682b`

```
auditoría, base demo limpia            12/12 recorridos; 39 pantallas;
                                       0 desbordes; 0 recortes en la capa
                                       del checkout; 0 consola; 0 4xx/5xx;
                                       salida 0; ficha 360/360, 390/390,
                                       768/768
caso 185                               1/1, y tres veces seguidas antes del
                                       commit
negativos                              4/4 rojos esperados, src como estaba
1–6, 21, 108, 121, 123, 138–140, 147,
  148, 152, 155, 162, 166, 183–185,
  base limpia                          22/22
a11y --todas                           74/74 pantallas, 0 serious o critical,
                                       0 minor o moderate; detalle de
                                       producto en celular y escritorio
contraste                              82/82 mediciones, TODO OK
build · lint · tsc --noEmit · node --check · diff-check   verdes
```

No corrí la suite completa. El cambio es CSS local de la ficha, y corrí
todos los casos que la abren.

## Visto y no tocado

- El foco que entra en los filtros cerrados sigue en
  `FILTER-COLLAPSE-FOCUS-1`.
- En la ficha, cuando «Disponible» va solo, ocupa media fila. Es el diseño
  de la grilla de datos, no un recorte.

No toqué `main`, Railway, backend ni datos, y no desplegué. Freno acá.
