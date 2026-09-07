# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## MARKET-VIEWS-1 — dos geometrías elegidas y ninguna accidental

Hecho. Producto/regresión e informe en commits separados. **No desplegué.**

- Producto/regresión: `b5ee28d` — «MARKET-VIEWS-1: la geometria del Mercado la
  elige la persona»
- La suite pasa a **155 casos**.

Emi tenía razón y el diagnóstico también: `.activo` traía `grid-column: 1 / -1`
y su propia composición horizontal, así que una máquina se quedaba con la fila
entera y el resto caía en columnas. Como ordenar cambia qué anatomía queda
arriba, ordenar cambiaba el diseño de la pantalla. Eso se terminó: la forma
exterior es una decisión de quien mira y las cuatro anatomías la comparten.

---

### 1. El rojo, contra `7268958`

El caso 155 se cae en lo primero que hay que mirar:

```
[FAIL] 155 … — no pasó a tiempo: el Mercado no ofrece el selector de vista
```

Y la geometría, medida sobre la UI real antes de tocar nada, en las tres
medidas que pediste:

```
                total  con grid-column   anchos        altos distintos
escritorio        32          10         372 y 1156          8
tablet            32          10         342 y 704           8
móvil             32          10         358                 7

escritorio: activo 1156x445 (1 / -1) · insumo 372x594 · servicio 372x411
```

Diez de treinta y dos operaciones se reservaban la fila entera, había **dos
anchos** y **ocho alturas** en el mismo breakpoint. En 390 px el ancho era uno
solo, pero las alturas seguían siendo siete y las diez tarjetas seguían
declarando `grid-column: 1 / -1`: el privilegio estaba puesto igual, sólo que
no se notaba porque ahí no hay más que una columna.

### 2. Lo que quedó

```
                total  con grid-column   ancho x alto        por fila
escritorio  cuadrícula  34       0       372x499                 3
escritorio  lista       34       0       1156x255                1
tablet      cuadrícula  34       0       342x499                 2
tablet      lista       34       0       704x329                 1
móvil       cuadrícula  34       0       358x519                 1
móvil       lista       34       0       358x442                 1
```

Un ancho y una altura por vista y por medida, sin excepciones y sin desborde
horizontal en ninguna de las seis combinaciones.

### 3. Cómo

**El selector** son dos radios de verdad —`Cuadrícula` y `Lista`— dentro de un
grupo con nombre, al lado de «Ordenar por» porque son la misma decisión sobre
la misma lista. El radio queda escondido a la vista pero **no del teclado ni
del árbol de accesibilidad**: las flechas alternan, el elegido se pinta y el
foco se ve. No hay un tercer modo y Cuadrícula es el inicio por omisión.

**La tarjeta** deja de decidir su tamaño exterior. Se retiraron de
`ProductCard.module.css` el `grid-column: 1 / -1` de `.activo`, su composición
horizontal y las tres reglas que la neutralizaban en otros contextos. Lo que
sigue siendo propio de cada anatomía es lo de adentro: la regla de color, los
datos comparables y la acción.

**La presentación se declara.** `ProductCard` acepta `catalogo`, `lista` y
`compacta`, y quien dibuja dice cuál usa. En el Mercado lo dice la persona con
el selector; en Inicio y Servicios sigue siendo `compacta`. No dupliqué la
tarjeta ni agregué otra familia.

**El renglón** reparte lo de adentro en tres columnas —qué es y dónde, cuánto y
de quién, qué se puede hacer— y baja a dos y a una según el ancho. En 390 px
sigue siendo un renglón: la foto queda al costado, que es lo que lo distingue
de la cuadrícula, donde ocupa todo el ancho arriba. Esa diferencia es la que
mide el caso, porque a 390 px las dos vistas tienen el mismo ancho exterior y
la composición no se puede leer del tamaño:

```
                foto / ancho de la tarjeta
                cuadrícula      lista
escritorio          99 %         20 %
tablet              99 %         33 %
móvil               99 %         31 %
```

**La banda de la foto se reserva por llevar foto**, no por ser un activo:
servicio y logística no la tienen —eso no cambió— y usan todo el ancho para sus
datos en vez de dejar un hueco que no promete nada.

### 4. Dos correcciones que no me pediste y que hacían falta

1. **El título se recorta a dos renglones**, en las dos vistas. Sin eso, un
   título largo estiraba su tarjeta y rompía la huella común que vos pediste en
   el punto 2. El título entero sigue estando en el detalle, y el caso lo
   verifica: la tarjeta recorta, el detalle conserva.
2. **La caja de la condición reserva su alto aunque no haya condición.** La
   tarjeta que llevaba «NUEVO» empujaba su título 13 px más abajo que las
   vecinas de la misma fila, así que títulos, precios y vendedor no se
   alineaban. Con el mínimo puesto, sí.

Las dos están adentro del alcance —son la huella exterior y la alineación que
pediste— pero son decisiones mías. Si alguna te sobra, decime cuál.

### 5. Un desborde que introduje y cerré

Con el conteo, el orden y la vista en la misma banda, a 768 px la fila no
entraba: la página desbordaba **28 px** a lo ancho. La banda ahora envuelve
siempre y el `select` de orden puede achicarse. Lo dejo escrito porque lo
rompí yo en esta misma pieza y el caso 155 lo mide en las tres medidas.

### 6. El caso 155

Un solo caso, sobre la UI real y sin esperas fijas. Lo que el seed no tiene se
crea por rutas reales: cuatro publicaciones con la misma marca en el título —una
por anatomía—, de las cuales una lleva **título larguísimo** y otra **foto de
verdad** subida por `POST /products/{id}/images`. La **foto rota** se rompe
donde de verdad se rompe —404 en la respuesta de la imagen— y no fabricando un
dato falso. Las cuatro se dan de baja al terminar, por la ruta real.

La huella se mide sobre el catálogo entero, que es la pantalla de verdad; la
mezcla de anatomías se mide sobre esas cuatro, convocadas con el buscador. Ese
reparto salió de un rojo propio, y está abajo.

En 1440 × 900, 768 × 1024 y 390 × 844 exige: dos controles con nombre, estado y
teclado; Cuadrícula sin columnas privilegiadas, huella única y acciones
alcanzables de verdad —`elementFromPoint`, no «existe en el DOM»—; Lista con
una operación por renglón y la diferencia de composición medida; las cuatro
anatomías con rótulo, dato y acción en las dos vistas; los cinco órdenes, una
búsqueda con su limpieza, un filtro con su limpieza y un detalle sin perder la
vista elegida; sin desborde; y el orden de teclado desde «Ordenar por» al
selector y de ahí a la primera operación.

Aparte: foto válida, ausente, rota y título largo comparten huella y el detalle
conserva el título entero; e Inicio y Servicios siguen con sus tres previas
compactas y sin selector.

Seis capturas, dos por medida, **fuera de Git**:

```
/tmp/topgreen-mercado-qCdS6a/cuadricula-1440x900.png    1440 × 900
/tmp/topgreen-mercado-qCdS6a/lista-1440x900.png         1440 × 900
/tmp/topgreen-mercado-qCdS6a/cuadricula-768x1024.png     768 × 1024
/tmp/topgreen-mercado-qCdS6a/lista-768x1024.png          768 × 1024
/tmp/topgreen-mercado-qCdS6a/cuadricula-390x844.png      390 × 844
/tmp/topgreen-mercado-qCdS6a/lista-390x844.png           390 × 844
```

La carpeta la crea el caso con `mkdtempSync`, como quedó en
`REGISTER-POLISH-1R`: una corrida por defecto no toca nada rastreado. Con
`SMOKE_CAPTURAS` se elige el destino.

### 7. Puertas

```
base limpia + SMOKE_CASOS=155                   1/1
base limpia + suite completa                    154/155   (131 rojo)
  123, 124, 125, 127, 138 y 139                 los seis en verde
npm run build                                   ok
npm run lint                                    ok (--max-warnings 0)
npx tsc --noEmit                                ok
node --check scripts/smoke.mjs                  ok
npm run contraste                               ok (52/52, 0 incumplimientos)
npm run a11y -- --todas                         ok (64/64, 0 bloqueantes)
git -c core.whitespace=cr-at-eol diff --check   limpio
```

El **131** es el ambiental de siempre: mi entorno no tiene demonio de Docker.
**155/155 es lo que tiene que dar en tu máquina.**

Backend, `compileall` y `pip check` no corresponden: el diff no toca Backend.

### 8. Hashes

```
src/components/ProductCard/ProductCard.tsx          a244279a98ac2bfb
src/components/ProductCard/ProductCard.module.css   926d5a6edeb49645
src/components/ProductGrid/ProductGrid.tsx          1f8ab2379c658f52
src/components/ProductGrid/ProductGrid.module.css   8a1bc44dbcc87c3e
scripts/smoke.mjs                                   6550fd713f7392fb
```

(SHA-256 truncado a 16, del árbol en `b5ee28d`.)

### 9. Un rojo mío que sólo aparece en la suite entera

La primera corrida completa dio **153/155**: además del 131 ambiental, se cayó
el propio 155.

```
[FAIL] 155 … — escritorio 1440x900, Cuadrícula: no hay ninguna operación de
             anatomía «logistica»
```

Aislado pasaba y en la suite no, por un motivo que no es del producto: cuando
le toca a este caso, el 126 ya publicó más de cien servicios y en la primera
página del catálogo no queda ninguna operación de logística. El caso estaba
midiendo lo que el orden de la suite le dejara arriba.

Lo cerré creando la mezcla en vez de buscarla: cuatro publicaciones, una por
anatomía, con la misma marca en el título, y el buscador para convocarlas.
Ahora la parte de anatomías mide exactamente las cuatro, y la parte de huella
sigue midiendo el catálogo entero. Después de eso volví a recrear la base y
corrí la suite completa otra vez, que es el 154/155 de arriba, y también lo
verifiqué contra la base ya cargada por una suite anterior —100 tarjetas
dibujadas— para no volver a depender del estado.

### 10. Algo que queda contradicho y no toqué

`docs/pm/diseno-premium/handoff/RESPONSIVE.md` dice, en su línea 23:

> Catálogo de dos columnas; activo de alto valor ocupa ambas.

Eso ya no es el producto, y el comentario que lo citaba en `ProductCard` era la
razón escrita del privilegio que acabo de retirar. **No lo edité**: es un
handoff de diseño y la precedencia entre ese documento y `DECISIONS.md` la
fijás vos. Dejé en el CSS la nota de que quedó contradicho. Decime si lo
corrijo yo en una línea o si lo hacés vos.

### 11. Riesgos residuales

1. **Las previas de Inicio y Servicios no igualan alturas entre sí.** Miden
   427×493 y 427×483 porque su grilla es propia y no usa `grid-auto-rows: 1fr`.
   No lo toqué porque tu punto 6 dice que las previas no cambian, pero ahora
   que el Mercado sí las iguala, la diferencia se nota si se comparan las dos
   pantallas.
2. **La altura pareja la fija la tarjeta más alta.** Con `grid-auto-rows: 1fr`,
   una publicación con muchos datos estira a todas las demás. Hoy da 499 px en
   cuadrícula y 255 en renglón; si mañana entra una anatomía con más datos, la
   pantalla entera crece con ella.
3. **La vista se pierde al salir del Mercado.** Es lo que autorizaste —«al
   volver a entrar puede iniciar en Cuadrícula»—, pero conviene que quede
   escrito: no está en la URL, ni en la cuenta, ni en `localStorage`.
4. **El radio escondido no se puede `check()` desde Playwright**, porque el
   rótulo lo tapa. El caso hace clic en el rótulo, que es lo que hace una
   persona; quien escriba una regresión futura sobre este control tiene que
   saberlo.
5. **Sigue en pie lo del informe anterior**: el copy del Login quedó sin tocar
   —`Iniciar Sesión`, `¿No tienes cuenta?`, `Regístrate aquí`— esperando tu
   decisión sobre si entra en `COPY-CLEAR-1`.

### 12. Frenos

No agregué un tercer modo, preferencia persistente, rediseño del detalle, fotos
nuevas, paginación ni algoritmo de relevancia. No cambié Backend, API, modelos,
migraciones, conteo, filtros, búsqueda, ordenamiento, carrito, cotización,
ingreso, detalle ni navegación. No toqué marca BOEDA, Railway, pagos ni datos
remotos. No creé el 156. No desplegué. `PRE_FIRMA.md` sigue fuera del versionado
y lo confirmé antes de empujar.

Freno acá y te pido revisión.
