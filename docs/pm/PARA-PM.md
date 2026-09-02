# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## SERVICE-STATE-1 — el panel dejó de cambiarle la anatomía a lo publicado

Hecho. Producto/regresión e informe en commits separados. **No desplegué.**

- Producto y regresión: `a038b56` — «SERVICE-STATE-1: una sola conversión para
  las publicaciones del panel»
- Regresión nueva: caso **143**. La suite pasa a **143 casos**.

---

### 1. El rojo, contra `ebb2b20`

```
[FAIL] 143 … — despues de pausar: el panel lo da por agotado, y un servicio no
  reserva unidades (la base dice stock 0, estado PAUSED):
  «Agotado INSUMO ESTANDARIZADO Smoke servicio de estado … Acopio $ 48.000
   Stock: 0 0 0 Editar»
```

Mirá el final de esa tarjeta: **el único botón que queda es «Editar»**. El de
pausar/activar no se dibuja sobre lo agotado, así que el servicio quedaba sin
forma de reactivarse desde el panel.

### 2. El recorrido completo, antes y después

Lo medí paso por paso sobre un servicio recién publicado —la fila nace con
stock 0, que es el valor por omisión de la columna—:

```
                        ANTES (ebb2b20)                       DESPUÉS
1. recién publicado     Activo · SERVICIO · Por hectárea      igual
2. pausar               Agotado · INSUMO · Stock: 0           Pausado · SERVICIO · Por hectárea
                        botones: [Editar]                     botones: [Editar, Activar]
3. reactivar            imposible: no hay botón               Activo · SERVICIO · Por hectárea
4. editar               Agotado · INSUMO · Stock: 0           Activo · SERVICIO · Por hectárea
5. recargar la página   Pausado · SERVICIO · Por hectárea     igual
```

El paso 5 es el que delata dónde estaba la falla: recargando la página entera
todo volvía a estar bien. La API y la base decían `operation_kind=servicio`,
`pricing_type=por_hectarea` y `status=PAUSED` en los cinco momentos. Lo que
cambiaba era **quién** convertía la respuesta.

Y en el paso 2 aparecía además una caja de fotografía que un servicio no puede
tener, más un «Stock: 0» que nadie cargó.

### 3. Lo que cambió

Un archivo de producto y una función:

```
 src/components/UserDashboard/UserDashboard.tsx | 113 +++++--------
 scripts/smoke.mjs                              | 209 ++++++++++++++++++++++
```

La conversión `BackendProduct → UserProduct` estaba **copiada tres veces** y
las copias no decían lo mismo: la de la carga inicial ya sabía de anatomía —es
la que arreglamos en la entrega del panel—, y las otras dos, la de
`reloadUserProducts` y la de la recarga posterior a editar, se habían quedado
con la regla vieja. Quedó una sola función pura, `aPublicacionDelPanel`, arriba
del componente, y los tres caminos la llaman:

```
carga inicial                         → map(aPublicacionDelPanel)
recarga por pausar/activar/eliminar   → map(aPublicacionDelPanel)
recarga posterior a editar            → map(aPublicacionDelPanel)
```

Son 70 líneas menos. Sin capa nueva, sin archivo nuevo, sin Backend, sin
endpoint, sin migración, sin dependencia y sin rediseño del panel.

La regla que conserva: `operationKind`, `unit` y `pricingType` viajan siempre,
y «Agotado» sólo existe donde hay unidades que agotar. En una publicación de
servicio manda su estado real, activo o pausado.

### 4. El control, en los cuatro momentos

El caso 143 lleva además un producto de verdad con stock 0, publicado por el
mismo camino. Ese **sí** tiene que decir «Agotado», y lo sigue diciendo en la
carga inicial, después de pausar el servicio, después de editar y después de
recargar la página. Sin ese control, «que no diga Agotado» se podría cumplir
rompiendo el caso legítimo.

### 5. Puertas

```
base limpia + node scripts/smoke.mjs            142/143   (131 rojo)
base limpia otra vez                            141/143   (131 y 114 rojos)
base limpia una tercera vez                     142/143   (131 rojo)
npm run build                                   ok
npm run lint                                    ok (--max-warnings 0)
node --check scripts/smoke.mjs                  ok
python -m compileall backend/app                ok
python -m pip check                             ok
git -c core.whitespace=cr-at-eol diff --check   limpio
npm run a11y -- --todas                         64/64 pantallas, 0 bloqueantes
npm run contraste                               TODO OK, cobertura completa
npm run hito                                    6/6 pasos
```

El **131** es el de siempre: acá no hay demonio de Docker. En tu Mac pasa.

Hice **tres** corridas y no dos por el **114**, que se puso rojo en la segunda
y pasó en la primera y en la tercera, con el mismo commit y el mismo
procedimiento. Lo que puedo afirmar:

- El paso que falla es el clic en la acción de una tarjeta del catálogo: la
  publicación que eligió `prepararEscenarioDeFletes` no ofrecía «Agregar».
- **No es de mi cambio.** El caso 114 no abre «Mis publicaciones» y no dibuja
  ninguna tarjeta del panel; toca el perfil del transportista y el catálogo.
- Descarté dos causas concretas sobre la base de esa corrida: no era compra de
  lo propio —vendedor y comprador son cuentas distintas— y no era stock
  reservado: la publicación elegida no tenía ninguna orden ni ningún carrito.
- No lo pude reproducir aislado, y eso es una limitación del arnés, no una
  respuesta: el caso 114 depende de la sesión que deja el caso 03, así que
  corrido solo entra sin sesión y falla por otro motivo.

No lo abrí porque pediste una sola tarea activa y porque no tengo todavía la
causa. Si querés que lo persiga, la primera medida que haría es que el caso
guarde el HTML de la tarjeta cuando el botón no aparece: hoy el mensaje dice
qué esperaba y no qué había.

### 6. Hashes

```
src/components/UserDashboard/UserDashboard.tsx  5d314eed22fc6395
scripts/smoke.mjs                               5c5e3ade09a4b868
```

(SHA-256 truncado a 16, del árbol en el commit de producto.)

### 7. Riesgos residuales

1. **La lista del panel sigue viniendo de `/products/my` sin paginar.** No lo
   toqué —no es esta tarea—, pero con muchas publicaciones esa respuesta crece
   sin techo y el panel la convierte entera en cada recarga.
2. **`operationKind` sigue siendo `string` en el tipo del panel**, no
   `OperationKind`. La conversión lo pasa tal cual y `normalizarAnatomia` lo
   ordena al dibujar, que es donde ya vivía la regla. Ajustar el tipo tocaría
   el formulario de edición y no me pareció parte de esto.
3. **Una publicación de servicio con stock cargado a mano** —la base lo
   permite— nunca va a decir «Agotado» en el panel. Es deliberado: un servicio
   no reserva unidades. Lo aviso porque es una decisión, no un olvido.
4. **El caso 143 deja dos publicaciones nuevas** del vendedor del seed: el
   servicio y el producto de control con stock 0. Corre último y no ensucia a
   nadie, pero quedan en la base como cualquier otro dato de la corrida.

### 8. Frenos

No toqué Backend: la API y la base ya decían lo correcto en todos los pasos. No
creé capa ni archivo nuevo: una función pura en el mismo módulo alcanzaba. No
abrí administración, navegación, formularios, BOEDA, Mercado Pago ni el riesgo
de escritura de `localStorage`. No desplegué. `PRE_FIRMA.md` sigue fuera del
versionado y lo confirmé antes de empujar.

Freno acá y te pido revisión.
