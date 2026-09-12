# Feedback visual de Emi — integración del logo AgroBoeda

Fecha: 2026-09-08
Estado: decisión de cliente; siguiente pieza después de `FOOTER-FOCUS-1`.

## Problema observado

En la cabecera del Mercado, el monograma AB aparece dentro de un rectángulo
verde oscuro claramente distinto de la banda. Emi lo describió como “pegado”.
La causa no es el tamaño ni el wordmark: el derivado actual es PNG RGB, sin
canal alfa, y conserva el fondo `#08281e` de la fuente sobre el fondo
`#1e4a34` del sitio.

## Dirección cerrada

- El monograma de Header y Footer queda sin placa: fondo transparente real.
- Se preservan forma, proporción, blanco/marfil, lima y volumen reconocible del
  AB oficial. No se redibuja ni se reemplaza por una interpretación generada.
- Los bordes semitransparentes deben quedar descontaminados del verde oscuro
  original. Transparencia con halo sigue pareciendo un recorte pegado y no
  cierra la tarea.
- El favicon conserva su recuadro opaco: ahí una superficie cuadrada propia es
  adecuada y mejora legibilidad.
- No cambian el texto `AgroBoeda`, tipografía, barra, Footer, tamaños,
  navegación ni paleta por esta pieza.

## Evidencia de cierre

La Dev entrega derivación reproducible desde
`docs/pm/originales/AGROBOEDA-LOGO-FUENTE.png`, dimensiones y SHA-256, más
capturas de Header y Footer en 1440×900, 768×1024 y 390×844. PM inspecciona las
seis imágenes a tamaño real. Un alfa técnicamente presente no alcanza: no debe
quedar caja, halo, borde serruchado ni pérdida visible de las letras.

Si la fuente raster no permite separar el fondo con esa calidad sin deformar el
glifo, la Dev frena y lo demuestra con una captura; no improvisa un logo nuevo.
