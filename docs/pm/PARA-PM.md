# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-06. Commit `42f2f98`.

**Freno antes de ampliar el alcance, como pediste.** Corregí el sistema de
estilos, y la medición encontró una deuda mucho mayor que necesita tu
decisión. Los detalles abajo.

Antes que nada: **tenías razón con lo de Ledesma.** Escribí que el pedido B
no lo mostraba y la tabla lo muestra en cinco destinos. Leí mal mi propia
salida.

---

## 1. Lo que corregí

El verde primario fallaba **en las dos direcciones, y es la misma pareja**:
blanco sobre `#059669` da 3,77:1, y `#059669` sobre blanco también 3,77:1.
Por eso el gradiente y `.btn-outlined` fallaban por lo mismo.

**Tokens nuevos, sólo para color usado como texto sobre fondos claros:**

| Token | Valor | Sobre `#ffffff` | Sobre `#f8fafc` |
|---|---|---:|---:|
| `--color-primary-text` | `#047857` | 5,48 | 5,24 |
| `--color-success-text` | `#047857` | 5,48 | 5,24 |
| `--color-warning-text` | `#b45309` | 5,02 | 4,80 |
| `--color-error-text` | `#b91c1c` | 6,47 | 6,18 |
| `--color-info-text` | `#1d4ed8` | 6,70 | 6,41 |

**Los tonos originales quedan intactos** para fondo, borde, icono y
`accent-color`, donde el mínimo de texto no aplica. No oscurecí nada a
ciegas: cambié sólo dónde el color es texto.

### La tabla antes / después que pediste

| Uso | Texto | Fondo | Antes | Después |
|---|---|---|---:|---:|
| Gradiente primario, inicio | blanco | `#059669` → `#047857` | **3,77** | **5,48** |
| Gradiente primario, fin | blanco | `#047857` → `#065f46` | 5,48 | 7,68 |
| Gradiente hover, inicio | blanco | `#047857` → `#065f46` | 5,48 | 7,68 |
| Gradiente hover, fin | blanco | `#065f46` → `#064e3b` | 7,68 | 9,72 |
| `.btn-outlined`, `.btn-text` | `#059669` → `#047857` | blanco | **3,77** | **5,48** |
| `a:hover` | `#059669` → `#047857` | blanco | **3,77** | **5,48** |
| Verde como texto en 5 componentes | `#059669` → `#047857` | blanco / `#f8fafc` | **3,77 / 3,60** | **5,48 / 5,24** |
| `.text-success` | `#10b981` → `#047857` | blanco | **2,54** | **5,48** |
| `.text-warning` y su uso en 2 componentes | `#f59e0b` → `#b45309` | blanco | **2,15** | **5,02** |
| `.text-error` y su uso en 1 componente | `#ef4444` → `#b91c1c` | blanco | **3,76** | **6,47** |

Los cuatro bloques `.alert-*` ya cumplían y no los toqué: success 7,29,
error 7,60, warning 6,84, info 8,01.

**12 usos de color como texto** cambiados, en `index.css` y en cinco
componentes. `npm run build` en verde y **25/25** en la suite.

---

## 2. El criterio 1 no queda cumplido, y tenés que saber por qué

Barrí el recorrido principal con un medidor que resuelve el fondo por la
**pila de pintado** y evalúa los gradientes contra todos sus tonos. **Unos
10.000 textos medidos** entre escritorio y celular, en catálogo, detalle,
carrito, checkout completo, perfil de vendedor, ventas y administración.

Quedan **unos treinta selectores distintos por debajo del mínimo**, en ocho
componentes. Los peores:

| Dónde | Ratio | Mínimo |
|---|---:|---:|
| `.serviceBadge` de la tarjeta de producto | 2,77 | 4,5 |
| `.noRating` "Sin calificaciones" | 4,20 | 4,5 |
| Estrellas `.star` (`#ffd93d` sobre blanco) | 1,30 | 3 |
| `.heroTitle` y `.heroSubtitle` de la portada | 2,53 | 3 / 4,5 |
| `.brandName` "TopGreen" del hero | 1,83 | 3 |
| `.progressCircle` del checkout | 2,16 | 4,5 |
| `.quantityValue` y `.itemName` del carrito | 1,18 / 1,90 | 4,5 |
| `.statLabel` del panel de administración | 3,77 | 4,5 |

### La causa de fondo: hay dos paletas

Esto es lo importante y no lo esperaba.

El sistema de diseño de `index.css` usa **emerald** (`#059669` y su escala).
Pero los componentes tienen escrita a mano **una segunda paleta**, verde
oliva, que no sale de ningún token:

```text
linear-gradient(135deg, #2d5016 0%, #7fb069 100%)   ← AdminPanel, HomePage, ContactPage
linear-gradient(135deg, #2d5016 0%, #4a7c29 100%)   ← AdminPanel
color: #ffd93d                                       ← estrellas y marca del hero
```

Blanco sobre `#2d5016` da 9,25 y cumple; blanco sobre `#7fb069` da **2,53** y
no. Como el gradiente va de uno al otro, **la mitad del hero cumple y la
otra mitad no**. Lo mismo en el panel de administración.

`Toast.module.css` tiene además otras seis gradientes propias.

**Corregir esto no es cambiar tokens: es unificar dos paletas** y decidir
cómo se ven el hero, los badges, las estrellas y el panel de administración.
Eso es rediseño, toca ocho componentes y no está en el alcance que me diste.

**Por eso freno acá y te lo reporto**, que es exactamente lo que pediste que
hiciera si esto pasaba.

---

## 3. Dos cosas sobre la verificación, para que no me creas de más

**Mi primer medidor daba falsos positivos y los descarté.** Resolvía el
fondo subiendo por el DOM, y el título del hero no es descendiente del
overlay que lo pinta: es su hermano. Me daba 1,05:1 en textos que en
pantalla se leen bien. Lo reescribí para resolver el fondo por
`elementsFromPoint`, que sí ve el overlay, y para medir sólo lo que está
dentro del viewport, recorriendo la página con scroll.

Los números de arriba son de la segunda versión. Los de la primera los
tiré.

**Lo que el medidor todavía no puede:** texto sobre foto. Cuando el fondo
es una imagen, no hay color con qué comparar; esos casos los cuenta aparte
y no los declara ni buenos ni malos. En el hero hay texto sobre foto con
overlay, y ahí lo que mido es el overlay, no la foto que asoma.

---

## 4. El criterio 8: `git diff --check` no puede quedar verde acá

Y no es por mi cambio.

**53 de los 56 archivos de `src/` tienen finales de línea CRLF.** Con la
configuración por defecto, git cuenta el `\r` final como espacio sobrante,
así que **cualquier línea agregada a cualquiera de esos archivos dispara el
aviso**. Lo comprobé agregando una línea en blanco a un archivo que no toqué:

```text
src/components/Cart/CartModal.module.css:352: trailing whitespace.
```

Con el ajuste que corresponde, mi cambio está limpio:

```text
$ git -c core.whitespace=cr-at-eol diff --cached --check
(sin salida)
```

**No lo arreglé** porque normalizar los finales de línea de `src/` produce un
diff de miles de líneas y borra el historial útil de `git blame`. Es una
tarea de higiene aparte; decime si la querés y cuándo.

Aparte: el diff inicial me dio 1.810 inserciones para un cambio de 43,
porque mi editor normalizó los finales de línea. Lo revertí conservando el
final original de cada línea que no toqué, y volví a compilar y a correr la
suite después de hacerlo.

---

## 5. Decisiones que no tomé

1. **No unifiqué las paletas.** Es el punto 2 y es tuyo.
2. **No toqué el borde de `.btn-outlined`**, que sigue en `#059669`. Los
   bordes no se evalúan como texto y cambiarlo era decisión visual.
3. **No toqué el tema oscuro.** Está inalcanzable y vos lo acotaste al tema
   claro. **Anoto que si algún día se habilita, estos tokens fallan**:
   `#047857` sobre `#1e293b` no llega. Habría que definir sus equivalentes
   en el bloque `[data-theme="dark"]`.
4. **No normalicé los finales de línea.**
5. **No toqué `backend/`, migraciones, API, seed ni el prototipo.**

---

## 6. Lo que necesito de vos

1. **Aceptar o rechazar esta pieza** por lo que hace: el sistema de estilos y
   el gradiente. Sabiendo que el criterio 1 no queda cumplido a nivel
   aplicación.
2. **Decidir qué pasa con las dos paletas.** Tres caminos, y ninguno es
   gratis: unificar ahora —rediseño chico pero real—, corregir sólo los
   textos que fallan dejando la paleta doble, o dejarlo para la revisión de
   accesibilidad de la Fase 5. Mi recomendación es la tercera: hoy no
   bloquea nada y en Fase 5 se hace una vez, con la vista de celular que ya
   está aparcada para el mismo momento.
3. **La próxima pieza.** Siguen abiertas las dos cosas rotas: el seed sin
   CBU ni alias, y el camino de instalación sin Docker. Las dos son de
   Fase 2 y hay margen antes del 21/08.

El entorno local sigue levantado.
