# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## LOGO-INTEGRATION-1 — el monograma se apoya en la banda

**Resultado: terminado.** La fuente raster sí permitió un recorte limpio, así
que no hubo que frenar.

- Producto/regresión: `d252a0c`
- La suite pasa a **159 casos**.
- **No desplegué, no toqué Railway, datos remotos, pagos ni secretos.** No
  cambié favicon, metadatos, paleta ni texto.

---

### 1. El archivo nuevo

```
public/marca/agroboeda-monograma-alfa.png   320x197  RGBA
sha256 837bb0feb7b2531694c605e2885931c3bc58c0e6033add133e1118d468c70958
```

Mide lo mismo que el opaco —320×197— a propósito: la caja que Header y Footer
ya reservaban es exactamente la misma, y las alturas renderizadas siguen siendo
40 px en escritorio y tablet, 30 en celular y 44 en el pie. El nombre del
archivo dice `alfa` para que ninguna caché vieja lo confunda con el otro.

Lo que **no** cambió, y lo verifica el caso:

```
docs/pm/originales/AGROBOEDA-LOGO-FUENTE.png  5606077c429b…  intacta
public/marca/agroboeda-favicon.png            1e1da0e55abf…  intacto
public/marca/agroboeda-monograma.png          697178b4873d…  intacto
```

El opaco sigue siendo la imagen social de `index.html`, como dijiste.

### 2. Cómo se separó el fondo, y por qué no alcanzaba con borrar un color

`derivar_marca.py` no borra el verde: **resuelve la mezcla**. Cada píxel del
borde de la fuente es el glifo dibujado sobre un fondo opaco conocido,
`p = a·F + (1−a)·fondo`. Con el fondo medido y los dos colores del glifo también
medidos, el alfa sale de proyectar el píxel sobre la recta fondo→glifo, y el
color limpio sale de **despejar `F`**.

Ese despeje es la descontaminación. Sin él, el semitransparente conserva el
verde oscuro del original y sobre otra banda se ve como halo —y transparencia
con halo, como escribiste, sigue pareciendo un recorte pegado—.

Dos cosas que sin medir salen mal, y que están en el commit:

- **El grano del fondo.** La fuente no tiene un fondo plano perfecto: la
  compresión le dejó grano, y ese grano da un alfa chico pero distinto de cero
  en *todo* el fondo. El piso se **mide** sobre el marco exterior —que es fondo
  y nada más— y dio `0,0190`; se descuenta y lo que queda se reestira. Sin eso,
  el PNG sale con un velo verde en vez de con fondo transparente.
- **El reescalado.** Promedia en alfa **premultiplicado**. Promediar color y
  alfa por separado mezcla el color de los píxeles invisibles con el de los
  visibles, y eso vuelve a manchar el borde después de haberlo limpiado.

El script sigue **sin dependencias**: lee y escribe PNG con la biblioteca
estándar, y el caso comprueba que todos sus `import` sigan siendo de ahí.

### 3. El rojo, contra `1c3aecc`, en dos pasos

```
1. tal cual está 1c3aecc
   [FAIL] 159 … — la derivación no informa agroboeda-monograma-alfa.png
2. con el archivo nuevo ya derivado, pero Header y Footer todavía apuntando al opaco
   [FAIL] 159 … — src/components/Header/Header.tsx no usa /marca/agroboeda-monograma-alfa.png
```

Y la medición que explica la pieza entera, hecha con la misma cuenta del caso
sobre la misma caja de 65×40 de la cabecera:

| | píxeles más oscuros que la banda | peor caída de luminancia | píxeles del marco distintos de la banda |
|---|---|---|---|
| monograma opaco | **1510** de 2600 | 32 | **404** de 404 |
| monograma nuevo | **0** | 0 | **0** |

Eso es la placa, medida. Todo el glifo es marfil y lima, más claro que el fondo
del sitio: cualquier placa y cualquier halo son, por definición, más oscuros que
la banda. Por eso el caso puede exigir **cero**.

### 4. El verde

```
[PASS] 159 … archivo 320x197: 62% transparente, 34% opaco, 1652 píxeles de
borde y ninguno contaminado; escritorio 1440x900/cabecera: 65x40 sobre rgb(30,
74, 52), 0 píxeles más oscuros que la banda; escritorio 1440x900/pie: 71x44 …;
tablet 768x1024/cabecera: 65x40 …; tablet 768x1024/pie: 71x44 …; movil
390x844/cabecera: 49x30 …; movil 390x844/pie: 71x44 …. La marca conserva su
único nombre accesible, la imagen sigue siendo decorativa, el foco se ve, Enter
lleva a Inicio y ninguna medida desborda
```

Y el **156 sigue verde**: la identidad, el nombre accesible y el recorrido no se
movieron.

### 5. Las seis capturas

En `/tmp/cap159`, fuera de Git:

```
159-cabecera-1440x900.png   159-pie-1440x900.png
159-cabecera-768x1024.png   159-pie-768x1024.png
159-cabecera-390x844.png    159-pie-390x844.png
```

El caso las escribe en una carpeta temporal única salvo que se le pase
`SMOKE_CAPTURAS`, así que reproducirlo no ensucia el árbol.

### 6. Lo que corrí y lo que no

```
SMOKE_CASOS=159 contra 1c3aecc                  rojo, en dos pasos
SMOKE_CASOS=156,159                             2/2
npm run build                                   verde
npm run lint                                    verde, 0 avisos
node --check scripts/smoke.mjs                  verde
python3 scripts/derivar_marca.py --verificar    verde, sin escribir
git -c core.whitespace=cr-at-eol diff --check   limpio
```

No corrí suite completa, contraste, a11y total ni Backend, como pediste.

### 7. Dos cosas que quiero que sepas antes de aceptar

- **Quité del CSS el borde redondeado y el relleno verde del monograma.** Eran
  la presentación de la placa: la esquina redondeada ya no tiene qué redondear y
  el relleno pintaba un rectángulo del color de la banda detrás de un glifo que
  ahora es transparente. No cambian tamaño ni alineación —el alto sale de
  `.marca img` y de las medidas declaradas en la etiqueta— y no agregué borde,
  sombra, filtro ni `mix-blend-mode`. Si preferís que vuelvan, se revierten en
  dos líneas, pero dejarlos sería documentar una caja que ya no está.
- **El monograma transparente es para fondo oscuro.** Sobre blanco, la «A»
  marfil casi desaparece: es el color que tiene en el original, no algo que haya
  hecho la separación. Hoy no importa —Header y Footer son la banda verde y el
  social sigue siendo el opaco—, pero si alguna vez se usa sobre una superficie
  clara, hay que usar el opaco o pedir una variante a la clienta. Lo dejo dicho
  para que no se descubra en producción.

### 8. Deuda que sigue abierta, sin tocar

El token global `--tg-color-focus` sigue valiendo `#1e4a34`, el mismo color que
`--tg-color-brand`. Cualquier superficie nueva pintada con el verde de marca va
a nacer con el foco invisible. Está anotado desde `FOOTER-FOCUS-1`.
