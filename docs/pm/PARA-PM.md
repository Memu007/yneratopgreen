# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-07. Commit `918c4b9`.

**El criterio 1 queda cumplido: cero textos por debajo del mínimo en el
recorrido completo, escritorio y celular.** Pero el número que me diste —unos
treinta selectores— era bajo, y la culpa es mía: lo saqué de un medidor con
defectos. Antes de corregir nada encontré y arreglé **cinco** fallas propias.
El alcance real era **38 parejas** en el navegador más **44** que el navegador
no alcanza. Está todo corregido igual, porque el trabajo era del mismo tipo que
decidiste: sustituir tonos, no rediseñar.

---

## 1. Antes de nada: mi medidor estaba mal, y de cinco maneras

No quiero que aceptes números míos sin saber esto.

| # | Qué hacía mal | Qué producía |
|---|---|---|
| 1 | Resolvía el fondo subiendo por el DOM | falsos 1,05:1 en el hero *(ya reportado)* |
| 2 | Llevaba al viewport las coordenadas de lo que estaba fuera | pilas equivocadas en el pie *(ya reportado)* |
| 3 | Medía texto **tapado por un modal** | 6 parejas fantasma: el catálogo detrás del checkout |
| 4 | Se rendía ante cualquier `url()` | el hero salía "no medible" en vez de medirse |
| 5 | **`window.scrollTo` no scrolleaba** | *ver abajo* |

**El quinto es el grave.** `html` tiene `scroll-behavior: smooth`. Con eso,
`scrollTo` anima y mi medición llegaba antes que el scroll. Encima los modales
scrollean **por dentro**, y yo sólo movía la ventana. Resultado: **medía casi
siempre la primera pantalla de cada vista**. Lo comprobé pidiendo scroll al
fondo y leyendo la posición: **0**.

Con eso corregido —scroll instantáneo, barrido de cada contenedor con scroll
propio, animaciones congeladas para medir el estado en reposo y opacidad
heredada incluida en el color efectivo— el barrido pasó de 7.291 a **8.271
textos medidos** y de 30 a **38 parejas** distintas por debajo del mínimo.

---

## 2. Lo que el navegador no puede alcanzar, y cómo lo cubrí

Un badge de estado sólo se ve si hay una orden en ese estado. Un `:hover` sólo
si el ratón está encima. Un panel sólo si el flujo lo abre.

Escribí un **análisis estático del CSS**: busca reglas que declaran a la vez
color de texto y fondo propio, resuelve `var()` contra los tokens del tema
claro, evalúa cada tono de los gradientes y calcula la pareja. Encontró **44**
por debajo del mínimo, entre ellas nueve de los diez estados del mapa de
órdenes —el barrido sólo llegaba a "Pagado", porque es lo que hay sembrado— y
pantallas enteras que el recorrido no abre: alta de producto, resultado de pago,
subcategorías y opciones del panel.

Las dos herramientas terminan en cero, salvo la excepción del punto 5.

---

## 3. La regla que resolvió la mitad de todo

El oliva `#7fb069` era la causa de 24 de las 38 parejas. Una sola regla, y
dentro de la familia:

```text
como fondo bajo texto blanco   #7fb069 -> #4a7c29    2,53 -> 4,99
como texto sobre fondo claro   #7fb069 -> #2d5016    2,40 -> 8,77
```

**Los dos tonos ya estaban en la paleta oliva del proyecto.** No inventé verdes.

### Tabla por uso

| Uso | Texto | Fondo | Antes | Después |
|---|---|---|---:|---:|
| Fondo/gradiente oliva + blanco | `#ffffff` | `#7fb069`→`#4a7c29` | **2,53** | **4,99** |
| Oliva como texto sobre claro | `#7fb069`→`#2d5016` | `#f8f9fa` | **2,40** | **8,77** |
| Hover oliva de botón | `#ffffff` | `#6a9656`→`#2d5016` | **3,44** | **9,25** |
| Badge "Servicio" | `#ffffff` | `#0ea5e9`→`#0369a1` | **2,77** | **5,93** |
| Badge "Pagado" | `#ffffff` | `#10b981`→`#047857` | **2,54** | **5,48** |
| Badge "Pendiente de Pago" | `#ffffff` | `#f59e0b`→`#b45309` | **2,15** | **5,02** |
| Badge "En Tránsito" | `#ffffff` | `#52b788`→`#0f766e` | **2,47** | **5,47** |
| Badge de notificaciones | `#ffffff` | `#ef4444`→`#b91c1c` | **3,76** | **6,47** |
| Botón "Ver" del panel | `#ffffff` | `#3b82f6`→`#1d4ed8` | **3,68** | **6,70** |
| Botón WhatsApp | `#ffffff` | `#25d366`→`#075e54` | **1,98** | **7,67** |
| Botón primario de pago | `#ffffff` | `#22c55e`→`#15803d` | **2,28** | **5,02** |
| Paso inactivo del checkout | `#999999`→`#595959` | `#e0e0e0` | **2,16** | **5,31** |
| "Sin calificaciones" (panel) | `#888888`→`#666666` | `#f0f4ed` | **3,19** | **5,16** |
| "Sin calificaciones" (tarjeta) | `#64748b`→`#475569` | `#d1fae5` | **4,20** | **6,68** |
| Números 01/02 de servicios | `#d4e8c8`→`#4a7c29` | `#ffffff` | **1,30** | **4,99** |
| "Nuestro equipo" | `#a8b4c0`→`#64748b` | `#ffffff` | **2,11** | **4,76** |
| "Servicio a todo el país" | `#999999`→`#5c636a` | `#f8f9fa` | **2,70** | **5,78** |
| "/ kg" y "Subtotal" del carrito | `#6c757d`→`#5c636a` | `#f8f9fa` | **4,45** | **5,78** |
| Papelera del carrito | `#dc3545`→`var(--color-error-text)` | `#f8f9fa` | **4,30** | **6,14** |
| Editar/borrar del panel | `#3b82f6`→`#1d4ed8` | `#eff6ff` | **3,38** | **6,16** |
| Cancelar del panel | `#dc2626`→`#b91c1c` | `#fee2e2` | **3,95** | **5,30** |
| Etiqueta inactiva del panel | `#dc2626`→`#b91c1c` | `#fef2f2` | **4,41** | **5,91** |
| Valores gris claro del panel | `#9ca3af`→`#4b5563` | `#f3f4f6` | **2,31** | **6,87** |
| Estrella vacía del filtro | `#dee2e6`→`#5c636a` | `#ffffff` | **1,30** | **6,09** |
| Estrella llena del filtro | `#ffc107`→`var(--color-warning-text)` | `#ffffff` | **1,63** | **5,02** |
| Pie de página, línea de cierre | blanco al 70 %→85 % | `#065f46` | **4,46** | **5,83** |

Reutilicé los tokens de la pieza anterior donde el color es texto:
`--color-error-text` en la papelera, `--color-warning-text` en las estrellas,
`--text-secondary` en "Sin calificaciones" de la tarjeta.

---

## 4. Las estrellas, que me pediste tratar aparte

**No hay marcas decorativas: los dos widgets de estrellas comunican.** Uno es
el filtro "Calificación mínima", el otro es la calificación que deja el
comprador. En ambos, la estrella vacía informa tanto como la llena.

Corregí las dos cosas que fallaban:

- **el color** —vacía 1,30 y llena 1,63, las dos por debajo de 3— y
- **algo que no estaba en tu lista: el estado se distinguía sólo por color.**
  Ahora la vacía es `☆` y la llena `★`. Se distinguen por forma, que es lo que
  corresponde, y de paso deja de depender de la percepción del color.

La `⭐` del perfil de vendedor es un emoji de color: el `color` del CSS no la
afecta y su contraste lo fija la fuente del sistema. La `☆` que la acompaña
hereda el color del texto del panel y cumple.

---

## 5. Texto sobre foto: medido, no supuesto

Dijiste que no declare aprobado lo que el medidor no puede resolver. No lo hice:
**convertí el caso en medible.**

Sustituyo la foto por **blanco puro** y por **negro puro** y mido las dos veces.
Cualquier foto real queda entre esos dos extremos, porque el compuesto es lineal
en el píxel de la foto y la luminancia crece con cada canal: **ninguna imagen
puede dar peor que el peor de los dos**. Sustituyo por un color plano expresado
como gradiente, no por una imagen, para que el medidor lo lea.

Los ocho textos, uno por uno, en escritorio y celular:

| Texto | Mínimo | Foto blanca | Foto negra |
|---|---:|---:|---:|
| "Bienvenido a" (hero) | 3 | **5,51** | 6,91 |
| "TopGreen" en amarillo (hero) | 3 | **4,00** | 5,02 |
| "El marketplace líder…" (hero) | 4,5 en celular | **5,51** | 6,91 |
| "Conectamos productores…" (hero) | 4,5 | **5,51** | 6,91 |
| "Misión" y "Visión" | 3 | **7,33** | 13,08 |
| Los dos párrafos de misión y visión | 4,5 | **6,32** | 10,89 |

El overlay del hero pasó de `rgba(45,80,22,0.85) → rgba(127,176,105,0.75)` a
`rgba(45,80,22,0.88) → rgba(61,107,30,0.94)`: reforzado, sin tocar composición
ni maquetado. Mismo cambio en el hero de servicios, que usa el mismo overlay
sobre video. El de misión y visión ya cumplía y no lo toqué.

**El único tono nuevo del cambio es `#3d6b1e`**, el extremo claro de ese
overlay. Con `#4a7c29` el margen quedaba en 4,62 sobre foto blanca y no me
pareció suficiente para dejarlo fijo.

---

## 6. Lo que no corregí, y por qué

**Los controles deshabilitados.** `input:disabled` da 2,34:1. Es la única
pareja que el análisis estático sigue marcando. La norma los exime y vos misma
escribiste que no se evalúan como texto normal. **Si querés que igual se lean,
decímelo y lo cambio**: es una línea.

---

## 7. Verificación

| Qué | Resultado |
|---|---|
| Barrido en navegador, 1440×900 y 390×844 | **8.271 textos, 0 por debajo del mínimo** |
| Pantallas recorridas | 34, incluidas portada, nosotros, servicios, contacto, catálogo, detalle, carrito, checkout completo, perfil, ventas y administración |
| Análisis estático del CSS | 1 pareja, la excepción de deshabilitados |
| Texto sobre foto | 8 casos, medidos en los dos extremos |
| `npm run build` | verde |
| Suite, base recreada desde cero | **25/25** |
| `git -c core.whitespace=cr-at-eol diff --check` | sin avisos |
| Diff | 86 inserciones, 90 borrados, 18 archivos |

Los 4 borrados de más son las líneas de `opacity` que saqué.

**Cuatro avisos de consola quedan y no son de la aplicación**: son las fotos de
`images.unsplash.com`, que el proxy de mi entorno bloquea. Están desde antes de
mi cambio y no dependen de él.

---

## 8. Cómo se ve ahora, para que no te sorprenda

**El verde de la aplicación quedó más oscuro.** Botones, badges, encabezados de
panel y CTA. Es el costo de la opción 2: la paleta oliva se conserva, pero el
tono claro ya no aparece debajo de texto blanco. Revisé portada, nosotros,
servicios, contacto, catálogo, carrito, checkout y administración: la jerarquía
se mantiene y no hay desbordes nuevos. **Tengo las capturas si las querés**; no
las subí al repositorio porque no me parecen un entregable para la clienta.

El botón de WhatsApp pasó a verde oscuro de marca. Sigue reconocible por el
ícono, pero es el cambio que más se nota.

---

## 9. Algo que encontré y no es de contraste

**La aplicación dice "AgroMarket" en cinco lugares visibles**, entre ellos un
botón del encabezado que está en todas las pantallas, y el `name` de
`package.json`. La clienta es TopGreen. Está fuera de mi alcance de hoy y **no
lo toqué**, pero no me parece algo que deba llegar a una demostración.

---

## 10. Lo que necesito de vos

1. **Aceptar o rechazar la pieza.**
2. **Decidir sobre los deshabilitados** (punto 6). Mi recomendación es dejarlos
   como están: la norma los exime y oscurecerlos hace que parezcan habilitados.
3. **Decidir qué hacemos con "AgroMarket"** (punto 9). Es chico y es visible.
4. **La próxima pieza.** Si es `@axe-core/playwright` como anticipaste, va a
   cubrir menos que lo que corrí hoy —axe no resuelve gradientes ni texto sobre
   foto— así que conviene que entre **además de** este barrido, no en su lugar.
   Y siguen abiertas las dos cosas rotas de Fase 2: el seed sin CBU ni alias, y
   el camino de instalación sin Docker.

El entorno local sigue levantado.
