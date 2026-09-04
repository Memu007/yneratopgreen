# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## MODAL-LIFECYCLE-1 — el detalle de una orden entra en la pila de capas

Hecho. Producto/regresión e informe en commits separados. **No desplegué.**

- Producto/regresión: `b07ebce` — «MODAL-LIFECYCLE-1: el detalle de una orden
  entra en la pila de capas»
- La suite pasa a **148 casos**.

Tenías razón en los dos lados: **C1 ya estaba cerrado** y **ADM-8 estaba
abierto**. Empiezo por la medición, que es lo que decide qué se toca.

---

### 1. C1 ya estaba verde, y no toqué nada

Medido antes de escribir una línea de producto, en las tres pantallas que
dibujan tarjetas, cerrando de las tres formas:

```
  Inicio    / Escape : dialogos 1 -> 0; foco = «Ver detalle»; ¿es el disparador? sí
  Inicio    / X      : dialogos 1 -> 0; foco = «Ver detalle»; ¿es el disparador? sí
  Inicio    / fondo  : dialogos 1 -> 0; foco = «Ver detalle»; ¿es el disparador? sí
  Mercado   / Escape : … sí          Mercado   / X: sí        Mercado   / fondo: sí
  Servicios / Escape : … sí          Servicios / X: sí        Servicios / fondo: sí
```

Lo cierra `useCapaModal`: guarda el elemento con foco al abrir y se lo devuelve
en su limpieza. **No cambié `ProductCard` ni `ProductDetailModal`.** Lo que sí
hice fue dejarlo cubierto por el caso 148: lo que anda y nadie mide es lo que
se rompe sin que nos enteremos.

Y el control de la pila que pediste —detalle → perfil del vendedor— también
estaba verde: dos diálogos, un Escape cierra el perfil y devuelve el foco a «Ver
perfil del vendedor», el segundo cierra el detalle y lo devuelve a «Ver
detalle». Ninguno de los dos reacciona al Escape del otro.

### 2. ADM-8 estaba abierto, y así se veía

El detalle de orden era un `div` suelto. Contra `bcdd448`:

```
  detalle de orden abierto:  dialogos=1   ¿el detalle es dialogo? NO
  foco al abrir:             button «Ver» en la fila de ORD-…-72C59E0D  [fuera del detalle]
  foco tras Tab:             button «Ver» en la fila de ORD-…-FE389B8D  [fuera del detalle]
  foco tras otro Tab:        button «Ver» en la fila de ORD-…-2AD5A0B1  [fuera del detalle]
  tras Escape:               panel abierto=false; dialogos=0; foco = boton «Admin»
```

Tres cosas en una: el foco nunca entraba en el detalle, cada Tab caminaba a la
fila siguiente **de la tabla tapada**, y el primer Escape cerraba
Administración entera —pestaña, filtro, página y scroll incluidos—.

Y el caso 148 completo, contra `bcdd448`:

```
[FAIL] 148 … — con el detalle de la orden abierto hay 1 dialogo(s) y tendria que
  haber 2: el panel y el detalle
```

Queda explícito, como pediste: **el rojo es sólo ADM-8**. Las partes de C1 y de
la pila pasaron antes de llegar ahí.

### 3. La corrección

El detalle usa el **mismo** `useCapaModal`, con su interruptor:

```tsx
const cerrarDetalleDeOrden = useCallback(() => setSelectedOrder(null), []);
const capaDeLaOrden = useCapaModal<HTMLDivElement>(
  cerrarDetalleDeOrden,
  selectedOrder !== null,
);
```

Con eso entra en la pila que ya existía —sólo responde la última capa— y trae
gratis el foco inicial adentro, la trampa de Tab, el fondo trabado y la
devolución del foco. En el marcado quedan `role="dialog"`, `aria-modal="true"`,
`aria-labelledby` al título de la orden y `tabIndex={-1}`. **No creé otro
administrador de modales ni toqué el hook.**

Una cosa que agregué y no me pediste, para que la revises: el botón que abre el
detalle pasa a llamarse **«Ver la orden N»**. Veinte botones «Ver» idénticos no
le dicen a nadie cuál es cuál —y ese botón es justamente el disparador al que
tiene que volver el foco—. Es una línea y no cambia lo que se ve.

```
 src/components/AdminPanel/AdminPanel.tsx |  26 ++-
 scripts/smoke.mjs                        | 351 +++++++++++++++++++++++++++
```

### 4. Lo que mide el caso 148

- **Identifica cada disparador por lo suyo**: la tarjeta por publicación y el
  botón por número de orden, nunca «el primero que aparezca».
- Después de cada cierre compara `document.activeElement` **contra el elemento
  exacto** que abrió la capa, no contra un texto.
- Cuenta cuántos `role=dialog` quedan tras cada cierre y comprueba **dentro de
  cuál** está el foco.
- En Administración registra pestaña, filtro, página, `scrollTop` y la lista de
  números de orden **antes y después**, y exige que no cambie ninguno.
- Prueba la trampa con Tab y Shift+Tab con el detalle abierto.
- Comprueba que el fondo queda trabado y que la capa se declara modal.

Verde:

```
[PASS] 148 — el detalle de una publicacion devuelve el foco a SU «Ver detalle» en
  las 9 combinaciones de pantalla y forma de cerrar; la pila del perfil del
  vendedor cierra un nivel por Escape y devuelve el foco nivel por nivel; y el
  detalle de la orden ORD-… es la segunda capa —con nombre accesible, foco
  adentro y Tab/Shift+Tab que no se escapan—, se cierra sola con Escape, X y
  fondo dejando Administracion abierta en «Órdenes» con el filtro
  «awaiting_transfer_receipt», «Página 2 de 3», scroll 624 y las mismas 20
  filas, y recien el Escape siguiente cierra el panel y devuelve el foco al
  boton Admin
```

Un detalle del arnés que costó dos intentos y conviene que sepas: para
demostrar que **la página y el scroll** se conservan hace falta una segunda
página llena, y con 21 órdenes la página 2 traía una sola fila y la tabla no se
desplazaba. El caso ahora cuenta cuántas órdenes hay en ese estado y **completa
hasta 41**, comprando de un insumo propio; sobre una base que ya las tenga, no
crea ninguna.

### 5. Puertas

```
base limpia + SMOKE_CASOS=148                   1/1
base limpia + suite completa                    147/148   (131 rojo)
npm run build                                   ok
npm run lint                                    ok (--max-warnings 0)
node --check scripts/smoke.mjs                  ok
python -m compileall backend/app                ok
python -m pip check                             ok
npm run a11y -- --todas                         64/64 pantallas, 0 bloqueantes
npm run contraste                               52 mediciones, ninguna por debajo
git -c core.whitespace=cr-at-eol diff --check   limpio
```

El **131** volvió a fallar acá por lo de siempre: el puente de mi entorno sólo
traduce `docker exec` y esa receta necesita `docker run` sobre `alpine:3`. En la
tuya pasó, así que esto tiene que dar **148/148**.

### 6. Hashes

```
src/components/AdminPanel/AdminPanel.tsx  5517e1defb7a675a
scripts/smoke.mjs                         6682d0b8d533b9cd
```

(SHA-256 truncado a 16, del árbol en `b07ebce`.)

### 7. Riesgos residuales

1. **El detalle de orden tiene un solo control focalizable** —su «Cerrar»—, así
   que la trampa de Tab lo devuelve a sí mismo. Está bien, pero conviene saber
   que la trampa ahí no se prueba «recorriendo» nada: se prueba que el foco no
   sale.
2. **El panel de Administración recibe un `onClose` nuevo en cada dibujo de la
   aplicación** (`onClose={() => setIsAdminPanelOpen(false)}` en `App`). El
   efecto de su capa depende de esa función, así que un redibujo de `App` con el
   panel abierto vuelve a montar la trampa y a recapturar «dónde estaba el
   foco». Hoy no se nota porque `App` no se redibuja con el panel abierto, y no
   lo toqué porque es navegación/armazón y me lo frenaste. Es una línea
   (`useCallback`) si querés cerrarlo.
3. **Las otras capas de la aplicación** —carrito, checkout, alta de
   publicación— ya usan `useCapaModal`, pero no las cubre ninguna prueba de
   foco. El 148 cubre el detalle, el perfil del vendedor y el detalle de orden.
4. El caso 148 deja tres publicaciones efímeras y hasta 41 órdenes en la base,
   como el 145 y el 147 dejan las suyas.

### 8. Frenos

No toqué navegación ni History API, formularios, Backend, modelos, migraciones,
seed, pagos, BOEDA, estilos generales, Railway ni datos remotos. No toqué
`useCapaModal` ni ProductCard/ProductDetail. No desplegué. `PRE_FIRMA.md` sigue
fuera del versionado y lo confirmé antes de empujar.

Freno acá y te pido revisión.
