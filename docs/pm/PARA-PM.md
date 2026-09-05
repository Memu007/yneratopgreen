# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## FORM-DIRTY-1R — escribir no puede expulsar el foco

Hecho. Producto/regresión e informe en commits separados. **No desplegué.**

- Producto/regresión: `83dba0a` — «FORM-DIRTY-1R: escribir en un formulario no
  puede expulsar el foco»
- La suite pasa a **150 casos**.

Tenías razón y el defecto era mío. Lo reproduje en la UI real antes de tocar
nada, y en la aplicación es un poco peor que en tu reproducción aislada.

---

### 1. El rojo, en la interfaz real

Escritura tecla por tecla con `pressSequentially`, una actualización de React
por tecla, contra `7741b91`:

```
1. ALTA     valor="a"               foco="Cerrar"
2. CHECKOUT valor="a"               foco="Cerrar"
3. MI PANEL valor="Juan Vendedora"  foco="Cerrar"   (el campo traía «Juan Vendedor»)
```

Los tres contenedores que la política de salida toca, los tres iguales: entra
la primera letra y el foco se va al botón Cerrar de la capa. Con el caso nuevo
puesto y el producto devuelto, el corte es más temprano de lo que suponía tu
informe:

```
[FAIL] 150 … — alta de publicación: en la tecla 1 de 7 («A») el foco se fue del
             campo a <button> «Cerrar»
```

Es decir: la letra entra, y el render que provoca esa misma letra ya expulsa el
foco. En un campo vacío el defecto aparece en la primera tecla, no en la
segunda.

### 2. La raíz, medida antes de tocarla

El efecto de `useCapaModal` dependía de `onClose`. Ese efecto hace cuatro cosas
—empujar la capa a la pila, atrapar el foco, oír Escape y trabar el scroll— y
las cuatro pertenecen a **la apertura de la capa**, no a la identidad de la
función que cierra. Con `onClose` en las dependencias, cualquier capa cuyo
cierre se vuelva a crear en cada render se desmonta y se vuelve a montar con
cada tecla, y montar significa volver a enfocar el primer control.

Antes de tocar el hook conté sus consumidores y separé cuáles estaban en riesgo:

```
capa                                    onClose                     ¿se recreaba?
Pregunta                                useCallback []               no
AdminPanel (panel)                      prop de App                  no*
AdminPanel (detalle de orden)           useCallback []               no
LoginModal / RegisterModal              prop de App                  no*
ProductDetailModal / SellerProfile      prop / estado del detalle    no*
CartModal                               prop de App                  no*
AddProductModal    ← mío                dependía de `salida`         SÍ
CheckoutModal      ← mío                dependía de `salida`         SÍ
UserDashboard      ← mío                dependía de `salida`         SÍ
```

(*) esas capas reciben una flecha en línea desde `App`, así que su `onClose` sí
cambia **cuando `App` vuelve a dibujar**. Lo que las salvaba es que escribir
adentro de ellas no vuelve a dibujar `App`. O sea: no estaban sanas, estaban
**a salvo por casualidad**. Por eso corregí la raíz y no sólo mis tres.

**La corrección.** El cierre viaja por referencia y deja de ser dependencia: el
efecto corre una vez por apertura, y Escape llama siempre a la versión más
reciente. Son doce líneas en `src/hooks/useCapaModal.ts`; no hay otro gestor de
modales, no hay oyentes locales nuevos y la pila es la misma.

**El impacto sobre las capas ajenas, medido antes y después.** Misma sonda,
mismo orden, sobre la aplicación real:

```
                                     antes (7741b91)             después (83dba0a)
LOGIN     escritura secuencial       valor="abc", foco=campo      idéntico
  Escape                             cierra, foco en Ingresar     idéntico
REGISTRO  escritura secuencial       valor="abc", foco=campo      idéntico
  Escape                             cierra, foco al anterior     idéntico
CARRITO   abrir                      1 diálogo, foco en Cerrar    idéntico
  +1 (vuelve a dibujar el carrito)   el foco sigue en «+»         idéntico
  Escape                             cierra, foco en el carrito   idéntico
```

Las capas sin campos de texto las cubre el **caso 148**, que pasa: detalle de
publicación en Inicio/Mercado/Servicios por Escape, X y fondo; la pila detalle →
perfil del vendedor; y el detalle de orden de Administración con pestaña,
filtro, página y scroll conservados. Ninguna capa dependía de que el efecto se
reinstalara: no hay ninguna a la que este cambio le altere el cierre.

### 3. Los tres consumidores

Además desprendí `alSalir` —que ya era estable— del objeto que devuelve
`useSalidaProtegida`, para no volver a armar la trampa desde afuera:

```
const salida = useSalidaProtegida();
const { alSalir } = salida;
```

No alcanzaba con poner `salida.alSalir` en las dependencias:
`react-hooks/exhaustive-deps` exige el objeto entero y `npm run lint` corre con
`--max-warnings 0`. Desprenderlo es la forma que la regla acepta y la que deja
el cierre realmente estable.

**No toqué la detección de suciedad**, ni el copy, ni los estilos, ni los
formularios más allá de esas dos líneas por archivo.

### 4. El caso 150

Autónomo, sobre la interfaz real, y **discrimina los tres contenedores**: si
falla, el mensaje dice cuál, en qué tecla y adónde se fue el foco.

- Escribe **una letra por vez** y, después de **cada una**, contrasta el valor
  del campo y `document.activeElement`. Nada de `fill()`: ahí la edición entra
  de una sola vez y el defecto no se ve. Eso es exactamente lo que el 149 no
  detectaba.
- Comprueba además que la capa siguió siendo la misma: un solo `role="dialog"`
  y el scroll de fondo todavía trabado.
- Y que escribir no desarmó la protección: con lo escrito adentro, cerrar
  pregunta una sola vez y «seguir editando» conserva el texto y **devuelve el
  foco a ese mismo campo**.
- Se arma lo suyo: entra por la API y publica su propio insumo con stock para
  abrir el checkout, así no depende de lo que otro caso haya dejado.

### 5. La semántica del 149 quedó intacta

El 149 pasa sin tocarlo, con sus trece caminos de cierre: limpio cierra derecho,
sucio pregunta una vez, seguir editando conserva, descartar cierra una sola capa
y no revive el borrador, cambiar y revertir vuelve a limpio, y el checkout sigue
distinguiendo el estado local de la orden ya creada —una orden, sin duplicar—.

### 6. Puertas

```
base limpia + SMOKE_CASOS=150                   1/1
base limpia + SMOKE_CASOS=149                   1/1
base limpia + suite completa                    149/150   (131 rojo)
npm run build                                   ok
npm run lint                                    ok (--max-warnings 0)
node --check scripts/smoke.mjs                  ok
python -m compileall backend/app                ok
python -m pip check                             ok
npm run a11y -- --todas                         64/64 pantallas, 0 bloqueantes
npm run contraste                               52 mediciones, ninguna por debajo
git -c core.whitespace=cr-at-eol diff --check   limpio
```

El **131** es el de siempre, y su mensaje lo dice entero: mi puente traduce
`docker exec` y esa receta necesita `docker run --rm -v … alpine:3`. En tu
máquina esto tiene que dar **150/150**; yo no lo declaro.

Sobre tu Docker: por lo que describís, el binario de Compose que trae Docker
Desktop 4.41.2 quedó con firma inválida y Docker aborta al leer sus metadatos.
Eso no lo puedo verificar desde acá y no me meto con tu máquina, pero para
correr la suite no hace falta Docker: `./scripts/entorno_nativo.sh --recrear`
levanta base, migraciones, seed, API y frontend nativos, que es lo que uso yo.
El único caso que igual queda rojo por ese camino es el 131.

### 7. Hashes

```
src/hooks/useCapaModal.ts                       db9c1416108ac58f
src/components/AddProduct/AddProductModal.tsx   253288bbf2467488
src/components/Checkout/CheckoutModal.tsx       8367817de78e20d7
src/components/UserDashboard/UserDashboard.tsx  057f71f677eb2edc
scripts/smoke.mjs                               c8d76f82387b45bd
```

(SHA-256 truncado a 16, del árbol en `83dba0a`.)

### 8. Riesgos residuales

1. **El efecto ya no reacciona a un cambio de `onClose`.** Es lo que se buscaba,
   pero deja una consecuencia: una capa que quisiera reinstalar su trampa de
   foco a propósito tendría que hacerlo por `activa`, la única dependencia que
   queda. Ninguna lo hace hoy.
2. **`activa` sigue siendo dependencia**, así que una capa que la haga oscilar
   por render volvería a tener el mismo síntoma. Las once actuales pasan una
   constante o un booleano de apertura.
3. **El caso 150 mide siete y ocho teclas por contenedor.** Alcanza para este
   defecto —que aparece en la primera— pero no es una prueba de escritura larga.
4. Sigue en pie lo que ya te dije del 149: la suciedad se compara serializando,
   el cambio de pestaña no pregunta porque no pierde nada, y la pregunta no
   distingue entre formularios.
5. El caso 150 deja una publicación del vendedor en la base, como el 145, el
   147, el 148 y el 149 dejan las suyas.

### 9. Frenos

No cambié la detección de suciedad, copy, estilos, formularios más allá de las
dos líneas por archivo, Backend, modelos, migraciones, seed, pagos, BOEDA,
navegación/History API, Railway ni datos remotos. No desplegué. `PRE_FIRMA.md`
sigue fuera del versionado y lo confirmé antes de empujar.

Freno acá y te pido revisión.
