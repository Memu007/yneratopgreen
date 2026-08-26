# Tokens y contraste — UX-2D, dirección B «Mercado nacional»

Los valores salen de `docs/pm/diseno-premium/mercado-nacional-b/HANDOFF-DEV.md`
y viven en una sola capa, `src/tokens.css`. Los nombres viejos que todavía usan
veinte hojas de componente son alias sin valor propio en `src/index.css`: no
hay dos paletas.

Las mediciones de acá son el cálculo WCAG 2.x del cociente de luminancias. La
puerta que manda es `npm run contraste`, que mide el color efectivo contra el
fondo que lo pinta de verdad —capas translúcidas, gradientes y opacidad
heredada incluidas— en 52 pantallas.

## La paleta

| Token | Valor | Para qué |
|---|---|---|
| `--tg-color-canvas` | `#f7f6f2` | Fondo de las páginas. |
| `--tg-color-surface` | `#ffffff` | Tarjetas, paneles, campos. |
| `--tg-color-surface-subtle` | `#edf0ec` | Hover y selección. |
| `--tg-color-surface-muted` | `#f0efe9` | Placas y bloques neutros. |
| `--tg-color-text` | `#1e2420` | Texto y anatomía de logística. |
| `--tg-color-text-secondary` | `#4c544b` | Texto de apoyo. |
| `--tg-color-brand` | `#1e4a34` | Marca, acción y anatomía de activo. |
| `--tg-color-action-hover` | `#143526` | Acción apretada. |
| `--tg-color-accent` | `#8a671c` | Cereal profundo: el cereal cuando es TEXTO. |
| `--tg-color-signal` | `#c49a43` | Cereal: filetes, marcas, reglas. Nunca texto. |
| `--tg-color-signal-hover` | `#b3862f` | Cereal apretado. |
| `--tg-color-steel` | `#5a6b60` | Rótulos de dato y anatomía de servicio. |
| `--tg-color-border` | `#d8dad2` | Regla y borde. |
| `--tg-color-border-control` | `#79837a` | Borde de algo que se toca. |
| `--tg-color-focus` | `#1e4a34` | Anillo de foco sobre claro. |
| `--tg-color-focus-sobre-marca` | `#c49a43` | Anillo de foco sobre la banda verde. |
| `--tg-color-disabled-bg` | `#e6e6df` | Fondo deshabilitado. |
| `--tg-color-disabled-text` | `#616760` | Texto deshabilitado. |

Los semánticos se conservan tal cual estaban —éxito `#1f6b4f`, advertencia
`#79520f`, error `#a22f2f`, información `#1d4e89`— porque siguen midiendo y
porque el verde de marca no puede pasar a significar «salió bien».

## Texto contra fondo

Mínimo 4,5:1 para texto normal.

| Texto | canvas #f7f6f2 | surface #ffffff | subtle #edf0ec | muted #f0efe9 |
|---|---|---|---|---|
| `--tg-color-text` #1e2420 | 14.62 | 15.81 | 13.76 | 13.72 |
| `--tg-color-text-secondary` #4c544b | 7.25 | 7.84 | 6.83 | 6.81 |
| `--tg-color-steel` #5a6b60 | 5.24 | 5.67 | 4.93 | 4.92 |
| `--tg-color-brand` / `-link` / `-action` #1e4a34 | 9.32 | 10.08 | 8.77 | 8.75 |
| `--tg-color-accent` #8a671c | 4.81 | 5.20 | 4.53 | 4.51 |
| `--tg-color-success` #1f6b4f | 5.93 | 6.41 | 5.58 | 5.57 |
| `--tg-color-error` #a22f2f | 6.51 | 7.04 | 6.12 | 6.11 |
| `--tg-color-warning` #79520f | 6.42 | 6.94 | 6.04 | 6.02 |
| `--tg-color-info` #1d4e89 | 7.76 | 8.39 | 7.30 | 7.28 |

### El cereal, en dos valores y no en uno

| Pareja | Medida | Uso |
|---|---|---|
| cereal `#c49a43` sobre canvas | 2.41:1 | **no sirve como texto**, sólo marca |
| cereal profundo `#8a671c` sobre canvas | 4.81:1 | texto |
| cereal profundo sobre `surface` | 5.20:1 | texto |
| cereal profundo sobre `subtle` | 4.53:1 | texto |
| cereal profundo sobre `muted` | 4.51:1 | texto |

El cereal claro mide 2,41:1 contra el canvas: se ve como marca y no se lee como
letra. Por eso el ojo de buey lleva el cuadro en cereal y la palabra en cereal
profundo, y por eso `--tg-color-signal` no aparece nunca en una regla `color`.

**Dónde no llega el cereal profundo.** Contra los tintes semánticos queda por
debajo de 4,5:1:
- advertencia `#f3e7c8`: 4.23:1
- error `#f8e7e5`: 4.35:1
- información `#e7eef8`: 4.45:1
- deshabilitado `#e6e6df`: 4.15:1

Y tampoco sobre el filete del pautado de Inicio: el ojo de buey a 12 px sobre
`--tg-color-border` da **3,69:1**, y bajar el filete no lo salva —ni al 6 % de
tinta sobre el canvas el cereal profundo llega a 4,5—. La columna de copy lleva
los dos filetes verticales de la lámina; el ojo de buey lleva fondo propio, así
que el filete se interrumpe en ese renglón y el rótulo vuelve a medirse contra
el canvas: **4,81:1**.

La medición encontró dos parejas reales —el rótulo «Logística» del bloque de
logística del detalle, sobre el tinte de información, y el ojo de buey de
Inicio sobre el filete— y las dos se resolvieron por donde correspondía. En el
detalle: ese bloque no es un aviso del sistema, es la anatomía de
logística, y bajo B su color es el grafito sobre superficie neutra. Para lo que
venga, `.alert .tg-eyebrow` toma el color del aviso, que ahí sí está medido.

## Sobre la banda de marca

| Pareja | Medida |
|---|---|
| blanco sobre verde de marca | 10.08:1 |
| blanco sobre verde apretado | 13.40:1 |
| grafito sobre cereal (celda «Vender») | 6.06:1 |
| grafito sobre cereal apretado | 4.79:1 |
| cereal sobre verde (anillo de foco) | 3.86:1 |

## El anillo de foco

La lámina de referencia pone el foco en cereal en todas partes. Contra el canvas
el cereal mide 2,41:1 y un indicador de foco necesita 3:1 contra lo que lo
rodea, así que sobre claro el anillo va en el verde de marca (9,32:1) y sobre la
banda verde —donde el verde desaparecería— va en cereal (3,86:1). Es el mismo
anillo, de 3 px, con el único color que en cada fondo se ve.

## Bordes

| Pareja | Medida | Mínimo |
|---|---|---|
| `--tg-color-border-control` sobre blanco | 3.93:1 | 3:1 |
| `--tg-color-border-control` sobre canvas | 3.64:1 | 3:1 |

`--tg-color-border` (`#d8dad2`) mide 1,41:1 contra el blanco y es correcto: es
una regla que separa, no el límite de algo que se opera. Todo lo que se toca
lleva `--tg-color-border-control`.
