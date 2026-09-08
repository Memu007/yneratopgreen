# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## BRAND-AGROBOEDA-1R — la marca del pie también vuelve a Inicio

**Resultado: terminado.** Tenías razón y el falso verde era mío de leer: el
caso 156 comprobaba el pie con los ojos —texto e imagen— y después activaba el
primer botón `AgroBoeda` de la página, que es el de la cabecera. Con eso, un
pie sin control pasaba igual.

- Producto/regresión: `21526bb`
- Alcance real: `src/components/Footer/Footer.tsx`,
  `src/components/Footer/Footer.module.css` y el bloque del 156 en
  `scripts/smoke.mjs`. Nada más. No rehice activos, inventario, copy, Backend
  ni derivación del logo, como pediste. **No desplegué ni toqué Railway, datos
  remotos, pagos ni secretos.**

---

### 1. La corrección

El bloque de monograma y nombre pasó de `div` a `button` y usa
`handleNavigate('home')`, que es **la navegación que el pie ya tenía** en su
columna de enlaces y que además deja la página arriba. La imagen sigue con
`alt` vacío y el nombre sigue escrito al lado, así que el control se anuncia
`AgroBoeda` una sola vez.

El CSS hace dos cosas y ninguna más:

1. Le saca al botón los adornos del control —`padding`, `background`, `border`,
   `color`, `text-align`— para que la composición se vea igual que cuando era
   una caja.
2. Le da al anillo de foco el único color que se ve sobre el verde del pie.

**Lo segundo no es cosmética, y lo medí.** El anillo del sistema usa
`--tg-color-focus`, que vale `#1e4a34`; el fondo del pie es
`--tg-color-brand`, que vale **el mismo `#1e4a34`**. Un anillo de ese color
sobre ese fondo da 1,0:1: existe y no se ve. El caso no se conforma con que el
contorno exista: mide el contraste del color del contorno contra el fondo real
del pie y exige 3:1. Con `--tg-color-focus-sobre-marca` —el mismo color que la
banda de la cabecera ya usa, por esta misma razón— queda en **3,9:1**.

### 2. El rojo, contra `f0913a7`

Con el caso ampliado y el producto sin corregir:

```
[FAIL] 156 La identidad pública es AgroBoeda, sin renombrar lo que no es marca
       — escritorio 1440x900: el pie no ofrece exactamente un control de marca
         «AgroBoeda» (hay 0)
```

El bloque nuevo no puede reutilizar el control de la cabecera ni el enlace
`Inicio` de la otra columna: busca **dentro de `footer`**, por rol y nombre
exacto, y exige que haya **exactamente uno**. Y empieza en «Quiénes somos»,
porque volver a Inicio desde Inicio no demuestra que se vuelva.

### 3. El verde

```
[PASS] 147 La barra dice que seccion se mira, y Atras vuelve adonde estaba
[PASS] 156 La identidad pública es AgroBoeda, sin renombrar lo que no es marca
2/2 pasaron; 0 fallaron
```

Lo que agrega el 156, en los tres anchos:

```
escritorio 1440x900: la marca del pie vuelve a Inicio con el teclado,
                     deja la página arriba y su foco se ve en 3.9:1
tablet     768x1024: idem
movil       390x844: idem
```

Cada ancho comprueba, en este orden: que en el pie haya **un solo** control
`AgroBoeda`; que escriba el nombre una sola vez; que su imagen sea decorativa;
que la página esté abajo antes de activarlo —si no, «deja la página arriba» no
probaría nada—; que se llegue **tabulando** y no con `focus()`, porque el
anillo es `:focus-visible` y Chromium no lo enciende cuando el foco lo mueve un
script; que el contorno se vea contra el fondo; y que al activarlo con Enter
aparezca Inicio y `window.scrollY` vuelva a 0.

### 4. Lo que corrí y lo que no

**Corrido, con salida.**

```
SMOKE_CASOS=147,156 (base limpia)               2/2
node --check scripts/smoke.mjs                  verde
npm run build                                   verde
npm run lint                                    verde, 0 avisos
git -c core.whitespace=cr-at-eol diff --check   limpio
```

Capturas del 156 en `/tmp/cap1r`: `cabecera-`, `pie-` y `registro-` en
1440×900, 768×1024 y 390×844. Fuera de Git; `git status --short` quedó sin
novedades. Aparte, para mirar la corrección a ojo, dejé una del pie con el foco
puesto en la marca.

**No corrido, y lo digo.**

- **No repetí la suite completa, ni `contraste`, ni `a11y` total, ni Backend,
  ni la derivación del logo**, porque lo pediste así y porque la corrección no
  los toca: es un `div` que pasa a `button` en un solo archivo.
- No desplegué, no corrí seed contra Railway, no toqué datos remotos, pagos,
  secretos ni la aplicación externa de Mercado Pago.
- No empecé `DEMO-USER-1`.

### 5. Hallazgo fuera de la corrección

**Los demás enlaces del pie tienen el mismo anillo invisible.** `Publicaciones`,
`Servicios`, `Inicio`, `Quiénes somos`, `Contacto`, el correo, el teléfono y
WhatsApp reciben el `:focus-visible` global, que es `#1e4a34` sobre un fondo
`#1e4a34`: **1,0:1**. No es un problema que traiga esta tarea; ya estaba, y lo
encontré midiendo el anillo de la marca.

Lo dejé **sin arreglar** porque tu alcance era el control de la marca y porque
el arreglo obvio —ponerle `tg-sobre-marca` al `<footer>`— cambia el
`outline-offset` de todos esos controles y eso ya es tocar la composición
aprobada.

**Arreglo propuesto**, si lo querés como pieza corta: una regla en
`Footer.module.css` que le dé a los enlaces del pie el mismo
`--tg-color-focus-sobre-marca` que ahora tiene la marca, más un caso que mida
el contraste del anillo de cada control del pie —derivado del DOM, no de una
lista escrita a mano—. Esfuerzo: chico. Riesgo: bajo, es sólo color de
contorno. Fase: cuando digas; no bloquea nada.

### 6. Nota sobre esta rama

Esta corrección salió de `f2f4ecc`. Antes de tu devolución, esta rama tenía una
implementación **paralela** de `BRAND-AGROBOEDA-1` —commits `0940660` y
`b1d8838`— que nunca se mergeó, porque `main` tomó `f0913a7`. La rama se
reinició sobre `main` para que 1R fuera el delta que pediste y no una segunda
migración compitiendo con la aceptada. Los dos commits viejos siguen existiendo
en el remoto por su SHA; no hay nada de ellos en esta entrega.

---

## Integración de BRAND-AGROBOEDA-1R a main

Hecha. **Nuevo HEAD de `origin/main`: `1286ed2`.**

Se integró con un merge y no con un rebase a propósito: pediste comprobar que
`21526bb` y `879d79f` estuvieran **en la historia de `origin/main`**, y un
rebase les cambia el SHA, así que esa comprobación habría dado que no. Con el
merge quedan los dos commits tal cual, en su orden producto → informe.

```
git rev-parse origin/main                          1286ed2e57a76487b8ee6f3890b385b3917f8d17
git merge-base --is-ancestor 21526bb origin/main   sí
git merge-base --is-ancestor 879d79f origin/main   sí
git status --short                                 vacío
```

El merge no tocó ningún archivo en común con `ef3152e`: vos escribiste en
`docs/pm/` y la corrección vive en `Footer.tsx`, `Footer.module.css` y el
bloque del 156. No rehice la corrección, no agregué cambios y no repetí
pruebas, como pediste.

`FOOTER-FOCUS-1` queda anotado como deuda, detrás de `DEMO-USER-1`. No arranqué
ninguna de las dos.
