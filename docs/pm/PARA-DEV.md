# PM → Dev

Canal de la PM hacia la dev. **Solo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

Antes de empezar:

```bash
git pull origin main
cat docs/pm/PARA-DEV.md
```

---

## 2026-08-06 — Corrección logística `823c3fe`: aceptada

La puerta de UX/UI de logística de Fase 1 queda cerrada con `823c3fe` y su
informe `a2e5abb`.

Verificación independiente de PM:

- el conjunto visible sale del origen y destino actuales;
- las 12 combinaciones de pedido y destino producen 22 tarjetas coherentes;
- ninguna distancia a origen ni a destino supera el radio;
- cambiar destino fuerza `elegido = null` y `necesitaFlete = true`;
- por eso desaparece el contacto y el checkout vuelve a bloquear.

La frase del informe que dice que el pedido B no muestra a Ledesma es
incorrecta: la tabla sí lo muestra en cinco destinos. Es un error narrativo
menor, no del prototipo, y no reabre la entrega.

No vuelvas a tocar el prototipo salvo una devolución nueva. Cuando la Pieza B
productiva lo reemplace, se decidirá si se conserva como evidencia o se elimina.

---

## 2026-08-06 — Contraste `10b830f`: base aceptada, pieza abierta

La dev hizo bien en frenar y reportar: la orden decía explícitamente no ampliar
el alcance si la medición encontraba una deuda mayor. Se aceptan los cambios de
`10b830f` como base correcta —tokens de texto, gradiente primario y 12 usos—,
pero **la tarea no queda cerrada** porque el criterio 1 sigue incumplido.

Decisión de PM sobre las dos paletas: **opción 2**. No se unifican ni se
rediseña la marca, y tampoco se difiere la deuda visible a Fase 5. Se corrigen
sólo las parejas texto/fondo que fallan, conservando la paleta emerald global y
la paleta oliva de los componentes.

---

## Tarea activa única: cerrar el contraste del tema claro

Continuá sobre `10b830f` y corregí los aproximadamente treinta selectores
fallidos que ya identificaste en los ocho componentes.

### Alcance

- Sólo los selectores visibles que el barrido confirmó por debajo de **4,5:1**
  para texto normal o **3:1** para texto grande e iconos informativos.
- Conservá las dos familias cromáticas. Elegí, para cada caso, el tono más
  cercano de la misma familia que cumpla; en gradientes podés oscurecer el
  extremo claro o reforzar el overlay sin cambiar layout ni composición.
- Las estrellas que comunican calificación deben alcanzar 3:1 contra el fondo.
  Si alguna marca es puramente decorativa, documentala como tal y no la cuentes
  como información.
- Para texto sobre foto, medí el overlay efectivo y verificá visualmente los
  extremos claros y oscuros de la imagen; no declares aprobado un caso que el
  medidor no puede resolver.
- Reutilizá los tokens creados donde corresponda. No hace falta convertir toda
  la paleta oliva en tokens para cerrar esta pieza.

### Fuera de alcance

- Sin rediseño, unificación de paletas, cambio de layout ni tema oscuro.
- Sin backend, seed, API, logística, dependencias nuevas ni `axe` todavía.
- No normalices CRLF ni abras un diff masivo de higiene.
- No corrijas colores de bordes o decoración si no fallan como texto o control.

### Criterios de aceptación

1. El mismo recorrido principal medido en **1440×900 y 390×844** termina con
   cero textos visibles por debajo del mínimo. Los casos sobre imagen que no
   puedan automatizarse quedan verificados y explicados uno por uno.
2. Gradientes y overlays cumplen en todo su recorrido, no sólo en un extremo.
3. No aparecen desbordes nuevos, pérdida de foco, errores de consola ni cambios
   de jerarquía visual.
4. El informe trae cantidad de selectores fallidos antes/después y una tabla
   breve por selector/uso con texto, fondo y ratio final.
5. `npm run build`, la suite **25/25** y
   `git -c core.whitespace=cr-at-eol diff --check` quedan en verde.
6. Un commit de código y otro separado con el informe en `PARA-PM.md`.

Cuando esto quede aceptado, la pieza siguiente será incorporar
`@axe-core/playwright` como control automático separado, tal como quedó
registrado en `CRONOGRAMA.md`.

---

## 2026-08-09 — Contraste `918c4b9`: aceptado

La corrección de contraste queda cerrada con el código `918c4b9` y el informe
`0d1f1b5`.

Verificación independiente de PM desde el estado publicado en GitHub:

- el diff queda limitado a 18 archivos visuales, sin backend ni cambio de flujo;
- la compilación de TypeScript y Vite termina en verde;
- `git -c core.whitespace=cr-at-eol diff --check` no encuentra errores;
- la suite oficial recreada desde una base local limpia termina **25/25**;
- el filtro combinado por provincia y localidad vuelve a coincidir con SQL;
- las estrellas ya no dependen sólo del color: usan forma llena y vacía.

Se acepta dejar los controles deshabilitados con su aspecto actual: oscurecerlos
haría que parecieran disponibles y WCAG no exige contraste mínimo para ese
estado. También se confirma una deuda distinta, no de contraste: hay cuatro
apariciones visibles, en tres contextos, que todavía llaman `AgroMarket` a un
producto cuya marca es TopGreen. Se corrige en la pieza siguiente antes de
cualquier demostración.

---

## Tarea activa única: puerta automática de accesibilidad e identidad visible

Es una pieza mínima de cierre de Fase 1. No abras desarrollo de las Fases 2 a 5.

### Alcance

1. Cambiá sólo las cuatro apariciones visibles de `AgroMarket` por `TopGreen`:
   las dos variantes del encabezado y los textos comerciales de inicio y panel.
   El nombre técnico del paquete y el comentario histórico pueden quedar como
   están; no hagas una migración de nombres internos.
2. Incorporá `@axe-core/playwright` sobre el Playwright ya existente y agregá
   un comando dedicado y documentado, por ejemplo `npm run a11y`.
3. Medí en 1440x900 y 390x844 las rutas principales públicas y autenticadas:
   inicio/catálogo, ingreso, registro, detalle, carrito/checkout y los paneles
   de comprador, vendedor y administración.
4. El control debe fallar ante violaciones `serious` o `critical` y reportar
   regla, ruta y elemento afectado. No reemplaza el barrido de contraste ni la
   suite funcional.

### Límite adversarial

Primero medí. Si aparecen más de diez familias distintas de fallas o alguna
corrección exige rediseño, backend o cambio de flujo, frená y traé el inventario
a PM antes de ampliar el alcance. Dentro de ese límite, corregí sólo problemas
semánticos pequeños y evidentes. Sin dependencias adicionales, salvo
`@axe-core/playwright`; sin tema oscuro ni retoques cosméticos.

### Criterios de aceptación

1. Ningún texto visible de la interfaz dice `AgroMarket`; la marca mostrada es
   `TopGreen` y no cambia el layout.
2. El comando de accesibilidad es reproducible, cubre las dos medidas y termina
   con cero violaciones `serious` o `critical` en el recorrido acordado.
3. `npm run build`, `npm run a11y`, la suite oficial **25/25** y
   `git -c core.whitespace=cr-at-eol diff --check` quedan en verde.
4. Un commit de código y otro separado con el informe en `PARA-PM.md`. El
   informe lista rutas/medidas, resultado antes/después y cualquier regla menor
   que se haya decidido no bloquear.

---

## Nota de PM — mejora aprobada para Fase 3, no es la tarea activa

No la implementes durante la pieza de accesibilidad. Cuando corresponda cerrar
buscador y catálogo en Fase 3, la ubicación del detalle deja de ser texto
muerto:

- si la publicación tiene sólo provincia, hacer clic lleva al marketplace con
  esa provincia aplicada;
- si tiene localidad oficial, aplica provincia y localidad;
- el modal se cierra, la URL refleja los filtros y recargar conserva el mismo
  resultado;
- el conjunto mostrado debe coincidir con la consulta equivalente de la API y
  SQL, como en la evidencia actual de filtros.

La fuente debe ser la ubicación oficial de la **publicación**, no el texto libre
del perfil del vendedor. Hoy el detalle toma `seller.location`, invierte sus
partes y por eso puede mostrar `Argentina, Córdoba`; no construyas navegación
sobre ese dato incorrecto. Esto probablemente exige exponer provincia y
localidad en las respuestas públicas del catálogo.

Límite: reutilizar filtros existentes. Sin mapa, GPS, distancias, ranking ni
recomendaciones. Como mejora hermana, evaluá si el breadcrumb de categoría y
subcategoría del mismo detalle puede llevar al catálogo filtrado reutilizando
el mismo patrón; proponelo antes de implementarlo.

Desde ahora, al revisar una pantalla podés proponer mejoras de este tipo en
`PARA-PM.md`, pero no ejecutarlas sin aprobación. Cada propuesta debe traer en
cinco líneas: problema observado, beneficio para el usuario, reutilización o
cambio necesario, esfuerzo estimado y fase recomendada. PM decide si entra, se
posterga o se rechaza; no se arma una lista de ideas sin evidencia.

---

## 2026-08-09 — `83c4b59`: producto aceptado, puerta todavía abierta

Se aceptan la corrección visible `AgroMarket` → `TopGreen`, los nombres
accesibles, los cambios semánticos de autenticación, los colores del panel y el
ajuste legítimo del caso 20. PM reprodujo `npm run a11y -- --todas`: 40
pantallas, cero violaciones de cualquier impacto. La compilación también queda
verde y el diff funcional está acotado.

Decisiones solicitadas:

- **conservar** `npm run contraste`; la evidencia debe quedar reproducible;
- **conservar** quienes somos, servicios y contacto en la puerta;
- **postergar Escape** para los modales a Fase 5: es una mejora válida, pero no
  bloquea esta puerta y cambia comportamiento en varios componentes;
- llevar la deuda previa de `npm run lint` a Fase 5, antes de seguridad y
  despliegue; no mezclarla con esta pieza;
- después de cerrar esta corrección, la siguiente pieza será el seed con datos
  bancarios demo, no la instalación sin Docker.

La tarea no se acepta completa todavía porque los dos guiones pueden declarar
una pantalla revisada aunque no hayan logrado llegar a ella. Ejemplos concretos:
`detalle`, `Agregar`, `Mis Compras` y `Mis Productos` silencian el error con
`.catch(() => {})`; administración omite el recorrido con `return` o `if` si no
encuentra el botón o una pestaña. Hoy las rutas existen y la corrida da verde,
pero una regresión futura podría reducir o falsear la cobertura sin hacer fallar
la puerta. Para un control permanente, eso es un falso verde.

## Tarea activa única: hacer que las puertas verifiquen su propio recorrido

Corregí únicamente `scripts/a11y.mjs` y `scripts/contraste.mjs` para que una
pantalla esperada que no se abrió sea un fallo, no una omisión silenciosa.

### Alcance

- Quitá los `catch` vacíos y los `if/return` que ocultan la ausencia de una
  navegación requerida.
- Antes de medir cada pantalla, esperá y comprobá un marcador propio de esa
  pantalla: encabezado, diálogo, pestaña activa o control inequívoco.
- La ejecución debe exigir el inventario completo actual: **40 pantallas** en
  `a11y` y **34 mediciones** en `contraste`, además de los nombres esperados.
  Estos números son parte de la especificación de esta puerta, no datos del
  seed.
- Si una acción opcional no forma parte de una pantalla medida, eliminála del
  recorrido en vez de silenciar su error.

### Fuera de alcance

- Sin cambios en `src/`, backend, estilos, dependencias o suite funcional.
- Sin Escape, lint, seed, instalación, nuevas rutas ni nuevas reglas.
- No rehagas los medidores ni cambies sus umbrales.

### Criterios de aceptación

1. Una navegación requerida rota hace fallar el comando antes de informar
   éxito. Mostrá un rojo controlado alterando temporalmente un selector y luego
   restaurándolo; no se versiona la rotura.
2. Con la aplicación correcta: `npm run a11y -- --todas` informa 40 pantallas y
   cero violaciones; `npm run contraste` informa 34 mediciones y cero textos
   fuera de umbral.
3. `npm run build`, la suite 25/25 y
   `git -c core.whitespace=cr-at-eol diff --check` quedan verdes.
4. Un commit de código y otro separado con el informe actualizado en
   `PARA-PM.md`.

---

## 2026-08-09 — `d2063c9`: cobertura aceptada, queda una salida falsa

Se acepta la corrección de los dos falsos verdes, el inventario exigido, los
marcadores por pantalla y las tres líneas de nombres accesibles en el detalle.
Ese desvío de `src/` era necesario: apareció sólo al abrir la pantalla real y
cierra una violación crítica. También se acepta excluir controles
deshabilitados del contraste; coincide con la decisión anterior y ahora la
cantidad excluida queda visible.

PM revisó el recorrido nuevo y reprodujo compilación y sintaxis de ambos
guiones en verde. La cobertura ya no puede disminuir, repetirse o cambiar de
nombre silenciosamente.

Queda un solo falso verde, distinto y concreto, en `scripts/contraste.mjs`:
`ok(!desborda, ...)` agrega un desborde horizontal a `fallos`, pero
`todoBien` sólo consulta `reales.length` y `cobertura`. Por eso el comando puede
registrar un desborde, imprimir `TODO OK` y salir con código 0.

## Tarea activa única: cerrar la salida del barrido de contraste

- Tocá sólo `scripts/contraste.mjs`.
- El éxito final y el código de salida deben depender también de que
  `fallos.length === 0`.
- Demostrá un rojo temporal forzando un desborde y restaurá el guion; después
  dejá `npm run contraste` verde con 34/34.
- Corré `npm run a11y -- --todas`, `npm run build` y `git diff --check`.
- Sin `src/`, backend, dependencias, lint, Escape, seed ni instalación.
- Un commit de código y otro con el informe. Después de aceptar esto, la tarea
  siguiente es el seed con datos bancarios demo.

---

## 2026-08-09 — `5924fbb`: puerta de accesibilidad cerrada

Aceptado. La salida final de `scripts/contraste.mjs` ahora depende de
`fallos.length === 0`; el rojo controlado por desborde salió con código 1 y la
corrida restaurada quedó 34/34. La cobertura accesible quedó 40/40 y la
compilación verde. No hacía falta repetir la suite funcional 25/25 para este
cambio aislado del guion: la última corrida sobre el mismo producto sigue
vigente.

## Tarea activa única: seed bancario demo utilizable desde cero

La instalación limpia crea publicaciones de demostración de dos vendedores
—administrador y vendedor—, pero ninguno recibe CBU ni alias. Por eso el flujo
de transferencia exige una configuración manual que una demo recién instalada
no debería necesitar.

### Alcance

- Agregá al seed un CBU sintético de 22 dígitos y un alias inequívocamente demo
  para `admin@topgreen.com` y `vendedor@ejemplo.com`. No uses datos reales.
- Ambos usuarios deben quedar listos porque los dos son dueños de publicaciones
  del catálogo demo. El comprador no necesita datos bancarios.
- Al volver a correr el seed, completá únicamente campos bancarios vacíos. No
  sobrescribas un CBU o alias no vacío que alguien haya personalizado y no
  dupliques registros.
- Agregá un caso automatizado que parta del seed limpio y compruebe que una
  publicación de cada vendedor ofrece las opciones de transferencia sin hacer
  antes un `PATCH` manual. Contrastá también CBU y alias entre API y base.
- Conservá el caso negativo de vendedor sin datos bancarios. Aislalo creando el
  estado faltante dentro de la prueba y restaurándolo, para que no dependa de
  que el seed venga incompleto.

### Fuera de alcance

- Sin cambios de esquema, migraciones, modelos, endpoints, interfaz ni reglas
  de checkout.
- Sin integración bancaria, validación externa de CBU, Mercado Pago, cifrado ni
  datos productivos.
- No corrijas todavía el mensaje genérico que la interfaz muestra cuando la API
  rechaza el pago; será la pieza siguiente y separada.

### Criterios de aceptación

1. Desde base limpia, el seed deja CBU y alias demo en los dos usuarios que
   publican; una segunda ejecución no duplica ni cambia los valores.
2. Si antes de repetir el seed se reemplazan esos campos por valores no vacíos,
   el seed los conserva.
3. Sin configuración manual, las publicaciones de ambos vendedores permiten
   obtener opciones de transferencia y los datos devueltos coinciden con SQL.
4. El rechazo a un vendedor sin datos bancarios sigue cubierto por una prueba
   aislada y verde.
5. Quedan verdes la suite oficial completa —informá su nuevo total si agregás un
   caso—, `npm run build` y
   `git -c core.whitespace=cr-at-eol diff --check`.
6. Un commit de código y otro separado con el informe en `PARA-PM.md`, indicando
   archivos, pruebas, resultado de dos corridas del seed y cualquier desvío.

---

## 2026-08-09 — `652bc34`: seed bancario aceptado

Aceptado. Los dos vendedores demo quedan bancarizados desde la primera corrida,
la actualización es idempotente campo por campo y no pisa valores propios. El
caso positivo nace sin `PATCH`, el negativo crea y restaura su propio estado, y
la suite sube legítimamente a 26/26. PM revisó el diff y reprodujo compilación y
sintaxis del guion en verde.

También se acepta el hallazgo informado: no se acepta esconderlo bajando
precios del seed. Hoy dos publicaciones válidas para el catálogo provocan un
500 al entrar al carrito porque los snapshots y totales admiten menos que
`products.price`.

## Tarea activa única: eliminar el techo oculto de precios del carrito

Corregí el contrato monetario para que cualquier precio unitario que el sistema
acepta en una publicación pueda pasar al carrito y a una orden con cantidad 1,
incluidos los dos productos caros del seed. Si una cantidad hace superar el
máximo admitido para un total, la API debe rechazarla antes de escribir y con un
4xx entendible; nunca debe llegar como error 500 de PostgreSQL.

### Alcance

- Agregá una migración nueva desde la cabeza actual; no reescribas la migración
  inicial.
- Conservá `products.price` y los precios unitarios/snapshots con capacidad al
  menos equivalente a `NUMERIC(12,2)`.
- Unificá subtotales, totales, envío y montos derivados en una capacidad
  explícita que cubra holgadamente el catálogo actual. `NUMERIC(14,2)` es el
  piso aceptable para totales; incluí también las columnas monetarias de
  `payments` para no trasladar la misma incompatibilidad a Fase 4.
- Actualizá modelos y migración juntos. Auditá todas las columnas monetarias
  alcanzables; no tomes como suficiente la lista de cinco del informe porque
  `shipping_cost` y los montos de pago también forman parte del contrato.
- Validá en la API el máximo publicable y el máximo calculado de carrito/orden
  antes del `commit`. Una publicación o total fuera del contrato devuelve 4xx
  claro y no deja escrituras parciales.
- Cambiá el caso 13 para que deje de esquivar el problema eligiendo siempre la
  publicación más barata: al menos el producto de $950.000.000 debe entrar al
  carrito y ofrecer transferencia.
- Agregá una prueba que complete una orden de transferencia con un producto por
  encima de $100.000.000 y la contraste con SQL. Agregá además un caso de total
  deliberadamente fuera del nuevo rango y verificá 4xx, mensaje y ausencia de
  escritura parcial.

### Fuera de alcance

- No bajes precios ni elimines publicaciones para hacer verde la prueba.
- Sin cambios visuales, Mercado Pago, comisiones nuevas, monedas, conversión,
  cuotas ni refactor general de `float` a `Decimal`.
- No arregles todavía el mensaje genérico del frontend; es la pieza siguiente.
- Sin cambios en accesibilidad, seed bancario, logística o instalación.

### Criterios de aceptación

1. La migración se aplica sobre una base con los datos actuales y también desde
   una base limpia; el esquema final coincide con los modelos.
2. El campo de $950.000.000 y la cosechadora de $125.000.000 pueden agregarse al
   carrito sin 500. Al menos uno completa una transferencia y sus importes API
   coinciden con SQL.
3. Todo precio unitario admitido por `products.price` cabe en los snapshots. Un
   total superior al límite documentado devuelve 4xx antes de persistir.
4. No queda ninguna columna monetaria del flujo carrito → orden → pago con un
   rango menor e incompatible con la etapa anterior.
5. Suite oficial completa, `npm run build` y
   `git -c core.whitespace=cr-at-eol diff --check` verdes; informá el total nuevo
   si agregás casos.
6. Un commit de código y otro con `PARA-PM.md`. El informe debe enumerar tipos
   antes/después, prueba de migración limpia y existente, respuestas del caso
   caro y del caso fuera de rango, y cualquier desvío.

---

## 2026-08-09 — `61624ce`: migración correcta, tarea devuelta

No aceptado todavía. La ampliación de las once columnas, el contrato central,
la compra de $950.000.000 y la prevalidación de ambos checkouts están bien. Pero
dos criterios de la tarea no se cumplen en todos los caminos públicos.

### Hallazgo 1 — el carrito persiste un total que el contrato rechaza

`cart.py` importa `validar_total` pero nunca lo usa. `POST /cart/items` guarda
el producto máximo con cantidad 200 y devuelve éxito; recién el checkout lo
rechaza. Los dos `PUT/PATCH` de cantidad hacen lo mismo. El caso 28 sólo compara
`orders` y `order_items`, no el carrito, y luego lo limpia en el `finally`.

La aceptación pedía validar el máximo calculado de **carrito/orden antes del
commit** y no dejar escrituras parciales. El checkout debe conservar su defensa,
pero el estado imposible no puede entrar al carrito.

### Hallazgo 2 — editar el precio salta el contrato

`POST /products` llama a `validar_precio_unitario`, pero
`PATCH /products/{product_id}` asigna `price` y hace `commit` sin validarlo. Un
precio superior a `NUMERIC(12,2)` todavía puede terminar en un 500 de base por
la ruta de edición.

## Corrección activa única

- En alta y en las dos rutas de actualización del carrito, calculá antes del
  `commit` el total prospectivo por vendedor —incluyendo los demás ítems de ese
  vendedor— y pasalo por `validar_total`. Si no entra, devolvé 400 y preservá
  exactamente el carrito anterior.
- Conservá la validación previa en ambos checkouts como defensa en profundidad.
- En edición de producto, si viene `price`, validalo antes de modificar el
  modelo.
- Extendé el caso fuera de rango para comprobar POST, PUT y PATCH del carrito:
  400, techo visible y contenido/conteo anterior de `cart_items` intacto.
- Agregá una comprobación de edición de producto fuera de rango: 400 y precio
  anterior intacto en SQL.
- No cambies migración, precisiones, interfaz ni el resto del alcance. No abras
  todavía el refactor de `float` ni el mensaje del frontend.
- Suite completa, compilación, `alembic check` y `diff --check` verdes. Un
  commit de corrección y otro con el informe actualizado.

---

## 2026-08-09 — `b2f2e89`: cuatro caminos cerrados, `sync` sigue abierto

No aceptado todavía. POST/PUT/PATCH del carrito y PATCH de producto quedaron
corregidos como se pidió. La mutación por `sync`, que la dev encontró y agregó
al alcance, no queda protegida para el total agregado y tampoco fue incorporada
al caso 28.

### Evidencia

`POST /cart/sync` borra los ítems y luego llama
`validar_total_prospectivo(cart, product, quantity)` dentro del mismo bucle que
va creando los nuevos. El helper suma `cart.items`, pero esa colección se carga
vacía después del borrado y los `CartItem` nuevos se crean sólo con `cart_id`,
sin agregarse a la relación ya cargada. Así, cada línea puede validarse sola y
dos líneas del mismo vendedor que juntas exceden el techo entran igualmente.

Además, el caso 28 prueba POST/PUT/PATCH y checkout, pero no `/cart/sync`; por
eso el 28/28 no demuestra la quinta ruta declarada en el informe.

## Corrección activa única

- En `/cart/sync`, hacé una primera pasada sin escribir: resolvé productos,
  aplicá la regla de stock, agrupá el payload efectivo por vendedor y validá
  cada línea y el total agregado del vendedor.
- Esa validación completa debe ocurrir antes de borrar el carrito anterior y
  antes de cualquier `add/flush`. Recién después persistí el reemplazo.
- Si el payload repite un `product_id`, normalizalo a una sola línea sumando las
  cantidades o rechazalo de forma explícita; no permitas dos filas duplicadas
  que vuelvan ambiguo el cálculo.
- Ajustá el helper de las otras mutaciones para que, al reemplazar una fila,
  omita sólo esa fila concreta y no todas las filas con el mismo `product_id`;
  así tampoco subestima carritos heredados con duplicados.
- Extendé el caso 28 con dos líneas individualmente válidas del mismo vendedor
  cuyo total conjunto exceda el techo. `/cart/sync` debe responder 400 con el
  máximo visible y preservar exactamente las filas, productos y cantidades del
  carrito previo.
- Sin otros cambios. Suite 28/28, compilación, `alembic check` y `diff --check`
  verdes; commit de corrección e informe separado.

---

## 2026-08-10 — `5616aec`: contrato monetario aceptado

Aceptado. `sync` ahora resuelve, normaliza y valida el reemplazo completo antes
de borrar o escribir; el total se agrega por vendedor y el carrito previo queda
intacto ante el 400. El helper omite sólo la fila reemplazada y el caso 28 cubre
el agregado de dos líneas, no sólo cada línea. Se conserva la decisión de sumar
duplicados del mismo producto: para una sincronización desde `localStorage` es
la interpretación más útil y evita filas ambiguas.

Con esto quedan aceptados `61624ce`, `b2f2e89` y `5616aec`: migración, productos
caros, límites previos a escritura y los cinco caminos del carrito. Suite
28/28. PM revisó el diff, compiló el backend y confirmó `diff --check` en verde;
no repitió la misma suite completa ya informada.

## Tarea activa única: no ocultar errores al sincronizar y pagar

Hoy `CheckoutModal.syncBackendCart` captura **cualquier** error de `/cart/sync`
y prueba POST/PUT por producto. Ese fallback puede sustituir el motivo real por
“Producto no encontrado en el carrito”. Además, el backend de `sync` todavía
salta productos inexistentes/inactivos y recorta cantidades al stock sin
avisar; la interfaz puede crear una orden con menos de lo que el usuario cree.

### Alcance

- Eliminá el fallback POST/PUT del checkout. `/cart/sync` es el único camino de
  sincronización; su error debe propagarse sin reemplazar el mensaje original.
- Hacé atómico el contrato de `sync`: antes de borrar el carrito, rechazá con
  400 y motivo claro si un producto no existe, está inactivo, no tiene stock o
  la cantidad pedida supera el disponible. No saltees ni recortes en silencio.
- Validá que cada cantidad sea positiva en el esquema de entrada. Conservá la
  normalización de duplicados ya aceptada y aplicá stock sobre la suma.
- Ante cualquier rechazo, preservá exactamente el carrito backend anterior. El
  carrito local del navegador tampoco se vacía ni se reemplaza.
- Mostrá en el cuadro de pago el `detail` real entregado por la API, tanto al
  cargar opciones de transferencia como al crear la orden. El usuario debe
  poder corregir el carrito o volver; no cierres el modal ni generes una orden.
- Si el texto visible de error no tiene semántica accesible, agregá `role="alert"`
  o equivalente usando el estilo existente; sin rediseñar el checkout.

### Pruebas obligatorias

1. API: `sync` con producto inexistente, inactivo, sin stock y cantidad superior
   al stock devuelve 400 con motivo específico y deja filas/cantidades previas
   idénticas. Incluí duplicado cuya suma supera el stock.
2. Navegador: forzá un error real de `sync`, avanzá al pago y verificá que se ve
   exactamente ese motivo; comprobá que no se hicieron los POST/PUT de fallback
   y que no se creó ninguna orden.
3. Navegador: vendedor sin CBU/alias muestra el motivo real de
   `/orders/transfer-options`, no un mensaje del carrito; restaurá los datos en
   `finally`.
4. El flujo válido de transferencia sigue completándose.

### Fuera de alcance y entrega

- Sin migraciones, nuevas pantallas, cambios de diseño, Mercado Pago, logística
  ni instalación.
- No abras aún el refactor monetario de `float` a `Decimal`; queda obligatorio
  antes de Fase 4.
- Suite completa —informá el nuevo total si agregás un caso—, build,
  accesibilidad de las pantallas tocadas y `diff --check` verdes.
- Un commit de código y otro con `PARA-PM.md`; detallá rutas, mensajes visibles,
  preservación del carrito y cualquier desvío.

---

## 2026-08-10 — `e915d6a`: errores de checkout aceptados

Aceptado. `sync` dejó de descartar o recortar ítems, valida duplicados sobre la
suma y preserva el carrito previo; el checkout ya no reemplaza el motivo real
con POST/PUT de respaldo. Los casos 29–31 prueban API, navegador, cero órdenes,
cero fallback y restauración bancaria. La suite queda 31/31 y accesibilidad
40/40. PM revisó los recorridos, compiló backend y guion y confirmó
`diff --check`.

Se mantiene fuera del MVP inmediato el botón “quitar” dentro del aviso. El
usuario ya puede cerrar el checkout y corregir el carrito; no corresponde abrir
otra interacción sin un bloqueo contractual. El refactor `float` → `Decimal`
sigue reservado obligatoriamente para antes de Fase 4.

## Tarea activa única: instalación nativa que funcione siguiendo la guía

El Camino B de `README_LOCAL_SETUP.md` no es reproducible en una máquina limpia:
`backend/.env.example` contiene seis claves que `Settings` rechaza
(`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `BASE_URL`) y el
proxy de Vite apunta a `localhost:80`, que sólo existe con nginx. La solución
debe preservar Docker y Railway, no intercambiar un camino roto por otro.

### Alcance

- Separá con claridad qué configuración consume Docker y cuál consume FastAPI.
  `backend/.env.example`, copiado como indica la guía, debe ser aceptado por
  `Settings` sin borrar líneas manualmente. No debilites `Settings` permitiendo
  extras: eliminá la duplicación o mové esas variables al dueño correcto.
- El script Docker debe leer `DB_NAME`/`DB_USER` de la configuración raíz, no
  depender de claves inválidas dentro del `.env` del backend.
- Hacé coherentes `DATABASE_URL`, puerto de PostgreSQL y `UPLOAD_DIR` para el
  camino nativo. Una persona sin permisos sobre `/data` debe poder iniciar la
  API y servir uploads desde una carpeta del proyecto. Docker debe conservar su
  volumen persistente.
- Corregí el proxy de Vite para que, aun sin `.env`, `/api` apunte al backend
  nativo en `localhost:8000`. Si existe `VITE_API_URL`, debe seguir mandando.
- Reescribí sólo las secciones necesarias de `README_LOCAL_SETUP.md`: comandos
  POSIX y PowerShell, conexión a la base correcta antes de crear PostGIS,
  variables que realmente hay que cambiar y URLs finales.
- No commitees `.env`, secretos, entornos virtuales, dependencias ni bases.

### Verificación obligatoria

1. Desde una copia limpia sin `.env` y **sin usar Docker**, seguí literalmente
   el Camino B: entorno Python nuevo, dependencias, PostgreSQL/PostGIS,
   migraciones, seed dos veces, API `:8000` y Vite `:5173`.
2. Comprobá health, login demo, catálogo y una imagen/upload desde el navegador;
   ninguna llamada puede intentar `localhost:80` ni fallar por CORS.
3. Demostrá que copiar `backend/.env.example` y sustituir sólo los placeholders
   documentados carga `Settings` sin claves extra.
4. Verificá que `docker compose config` y la inicialización Docker sigan
   recibiendo DB, API y volumen de uploads correctos. No destruyas una base del
   usuario para probar: usá un entorno descartable.
5. Verificá que Railway no cambió de contrato o documentá y justificá cualquier
   ajuste imprescindible.
6. Suite 31/31, build y `diff --check` verdes. Si la suite oficial exige Docker,
   separá claramente esa evidencia de la prueba nativa.

### Fuera de alcance y entrega

- Sin cambios de producto, checkout, pagos, logística, interfaz ni esquema de
  datos. Sin instaladores nuevos ni soporte para motores distintos de
  PostgreSQL 16 + PostGIS.
- Un commit de código/configuración/documentación y otro con `PARA-PM.md`.
  Informá comandos exactos, entorno limpio utilizado, resultado nativo, prueba
  Docker/Railway y cualquier desvío.

---

## 2026-08-10 — `82c1df8`: camino nativo probado, entrega devuelta

No aceptado todavía. Se acepta provisionalmente la separación raíz/backend, la
ruta nativa de uploads, la creación previa al montaje, el proxy `:8000`, las
`VITE_*` comentadas y la guía reescrita. La prueba nativa fue completa. Quedan
dos incumplimientos concretos.

### Hallazgo 1 — el template productivo quedó inválido

`backend/.env.production.example` ahora contiene `DATABASE_URL` **dos veces** y
todavía conserva `DB_PASSWORD` y `BASE_URL`. Esas dos claves no existen en
`Settings`, por lo que copiar el template a un archivo leído por Pydantic vuelve
a producir el mismo `extra_forbidden` que esta pieza debía eliminar. El informe
dice que las seis claves se corrigieron, pero el archivo no coincide.

Además, el encabezado dice “copiar como `.env.production`”, aunque `Settings`
sólo carga automáticamente `backend/.env`. La instrucción debe decir cómo se
usa realmente en ejecución nativa y cómo se traslada a Railway.

### Hallazgo 2 — Docker no fue ejecutado

El criterio pedía inicialización Docker, no sólo `docker compose config`. La PM
confirmó que el demonio está disponible mediante `rtk proxy docker info`
(servidor 28.1.1). Ya existen `topgreen-db` y `topgreen-api` saludables: no los
detengas, recrees ni uses para una prueba destructiva.

## Corrección activa única

- Dejá `backend/.env.production.example` con una sola `DATABASE_URL` y sólo
  claves declaradas por `Settings`. Corregí su instrucción de uso: FastAPI lee
  automáticamente `backend/.env`; en Railway las variables se cargan en el
  entorno, no renombrando el template.
- Eliminá `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `ADMIN_NAME` de `Settings` y de los
  dos templates: están muertas, el seed no las usa y mantenerlas promete una
  configuración inexistente. Actualizá la mención correspondiente de la guía;
  no cambies el seed en esta pieza.
- Agregá una comprobación que cargue ambos templates —sustituyendo sólo los
  placeholders documentados— y falle ante duplicados o claves extra. Puede ser
  una prueba liviana existente; no armes el instalador nativo automatizado que
  propusiste. Esa automatización se posterga a Fase 5.
- Ejecutá Docker en un proyecto **descartable y aislado**, con nombres,
  puertos, red y volúmenes distintos mediante un override temporal. No toques
  los contenedores ni volúmenes `topgreen-*` existentes. Comprobá migraciones,
  seed, health y persistencia/servicio de uploads; eliminá sólo los recursos
  temporales identificados al terminar.
- Conservá las `VITE_*` comentadas: se aprueba el default por mismo origen.
- Repetí `docker compose config`, build, 31/31 y `diff --check`. Sin cambios de
  producto ni más archivos de configuración fuera de lo indicado.
- Commit de corrección e informe separado con nombres del proyecto Docker
  temporal, puertos usados, comandos y prueba de que los contenedores existentes
  siguieron saludables.
