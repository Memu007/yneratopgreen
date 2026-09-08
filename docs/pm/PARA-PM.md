# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## FOOTER-FOCUS-1 — el foco se ve en todo el pie

**Resultado: terminado.**

- Producto/regresión: `5d3958a`
- Alcance real: `src/components/Footer/Footer.module.css` (siete líneas, de las
  cuales cuatro son comentario) y el bloque del caso 158 en `scripts/smoke.mjs`.
  **No desplegué, no toqué Railway, datos remotos, pagos ni secretos.**
- La suite pasa a **158 casos**.

---

### 1. Qué cambié, y por qué así

La regla que ya existía para la marca se **amplía por descendencia** en vez de
repetirse control por control:

```css
.footer :focus-visible {
  outline-color: var(--tg-color-focus-sobre-marca);
}
```

Antes decía `.marca:focus-visible`. Es el mismo token, el mismo color y la misma
regla: lo único que cambia es a quién alcanza.

Lo hice así y no con una lista de selectores por una razón concreta: **este
defecto nació de una lista**. En `21526bb` arreglé el anillo de la marca y los
otros ocho enlaces quedaron atrás, porque la regla nombraba un control. Una
lista de selectores se olvida del enlace que alguien agregue mañana; la
descendencia no.

Se toca **sólo el color**. El ancho, el estilo y el `outline-offset` siguen
siendo los globales, así que el foco no mueve nada de lugar y la apariencia sin
foco no cambia. La regla vive en `Footer.module.css`, así que el alcance es el
pie: ni la cabecera, ni un modal, ni un formulario, ni un panel cambian.

### 2. El rojo, contra `ba66943`

```
[FAIL] 158 Todo el pie muestra el foco de teclado, y el pie no se mueve al
recibirlo — escritorio 1440x900: el foco de «Publicaciones» queda en 1.00:1
contra el fondo del pie (rgb(30, 74, 52) sobre rgb(30, 74, 52)): no se ve
```

Falla en el **primer enlace después de la marca**, que es exactamente el borde
que describiste: la marca ya estaba en 3,9:1 y pasó; el siguiente control es el
que se cae.

### 3. El verde

```
[PASS] 158 … en el pie, cada control enfocable descubierto del DOM recibe el
foco con el teclado y su contorno se ve contra el fondo real: escritorio
1440x900: 9 controles, peor foco 3.9:1; tablet 768x1024: 9 controles, peor foco
3.9:1; movil 390x844: 9 controles, peor foco 3.9:1. El anillo conserva ancho,
estilo y desplazamiento globales, así que ningún foco mueve la geometría del
pie ni hace desbordar la página. La marca sigue teniendo un único nombre
«AgroBoeda», los enlaces de contacto conservan su mailto/tel/wa.me sin abrirlos
y el enlace interno a Quiénes somos sigue llevando ahí
```

Y el **156 sigue verde**, con la marca del pie en 3,9:1 en los tres anchos: la
regla ampliada no le cambió nada al control que ya habías aceptado.

### 4. Dos decisiones del caso que conviene que sepas

- **Los controles se descubren del DOM**, con un selector de enfocables, y el
  caso exige encontrar al menos ocho. Si mañana el barrido apuntara al elemento
  equivocado y encontrara dos, el caso se cae en vez de dar un verde vacío.
- **La geometría se mide relativa al pie, no a la ventana.** Esto lo aprendí
  midiendo: la primera versión del caso falló con «enfocar AgroBoeda movió la
  geometría del pie», y no era el producto: al tabular, el navegador desplaza la
  página para traer el control a la vista, y con coordenadas de ventana ese
  desplazamiento se lee como si el pie se hubiera movido. Con el pie como origen,
  lo que se mide es lo que importa: si el foco corre algo de lugar adentro.

### 5. Lo que corrí y lo que no

**Corrido, con salida.**

```
SMOKE_CASOS=158 contra ba66943                  rojo, 1.00:1 en «Publicaciones»
SMOKE_CASOS=156,158                             2/2
npm run build                                   verde
npm run lint                                    verde, 0 avisos
node --check scripts/smoke.mjs                  verde
git -c core.whitespace=cr-at-eol diff --check   limpio
```

**No corrido, y lo digo.** No repetí la suite completa, ni contraste, ni a11y
total, ni Backend, porque pediste que no y porque la pieza sólo cambia el color
de un contorno. No desplegué ni toqué nada remoto.

### 6. Una nota sobre el contraste que el caso mide

El 158 mide el contorno contra el fondo real del pie y exige **3:1**, que es el
mínimo de contraste no textual. Lo aclaro para que no se confunda con `npm run
contraste`, que mide parejas de texto y fondo con 4,5:1: son dos cosas
distintas y esta pieza no toca la segunda.

### 7. Deuda que sigue abierta

El anillo global `--tg-color-focus` sigue valiendo `#1e4a34`, el mismo color que
`--tg-color-brand`. Eso hoy se nota en dos lugares y los dos están cubiertos —la
banda de la cabecera con `tg-sobre-marca`, el pie con esta regla—, pero cualquier
superficie nueva que se pinte con el verde de marca va a nacer con el mismo
foco invisible. No lo toqué: cambiar un token global es paleta, y eso no entra
acá. Lo dejo anotado por si querés una pieza que lo mire de raíz.

---

## Integración de FOOTER-FOCUS-1 a main

Hecha. **Nuevo HEAD de `origin/main`: `0cbc3c6`.**

Merge y no rebase, por lo mismo que la vez pasada: pediste comprobar que los
SHA estuvieran **en la historia** de `origin/main`, y un rebase se los cambia.

```
git rev-parse origin/main                          0cbc3c6987257a076832f25786d76bdd0174642d
git merge-base --is-ancestor 5d3958a origin/main   sí
git merge-base --is-ancestor 26eb47f origin/main   sí
git status --short                                 vacío
```

No hubo conflicto documental, así que no hubo nada que decidir: el merge no
tocó un solo archivo en común. Vos escribiste en `NOW.md`, `PARA-DEV.md`, el
roadmap y las dos reproducciones; la pieza vive en `Footer.module.css`, el caso
158 y este archivo. Lo comprobé además contra `c7eb70e`:
`FEEDBACK-VISUAL-LOGO-AGROBOEDA-2026-09-08.md` y
`REPRODUCCION-FOOTER-FOCUS-1-2026-09-08.md` están en `main`, y `PARA-DEV.md`
quedó idéntico al tuyo.

No repetí smoke, build ni lint: verificaste los SHA exactos y el merge no los
cambió. No arranqué `LOGO-INTEGRATION-1`.
