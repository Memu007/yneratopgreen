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

---

## 2026-08-10 — `896386a`: instalación aceptada

Aceptado. Las dos plantillas cargan con el `Settings` real, sin duplicados ni
claves muertas; el caso 32 deja la regresión versionada. La instalación nativa
ya había quedado probada en `82c1df8`.

La PM completó la evidencia Docker que la dev no podía ejecutar por política de
egreso. Proyecto aislado `tgpmcheck`, puertos `55443/58010`, imágenes locales:
seis migraciones hasta `a1c4f7e9b2d3`, seed dos veces, conteos
`3/30/12/4028`, health 200 y upload servido antes y después de reiniciar la API.
Se eliminaron sólo sus contenedores, red y volúmenes. `topgreen-db` y
`topgreen-api` originales siguieron saludables. Suite informada: 32/32.

Decisiones solicitadas: se conservan las `VITE_*` comentadas; no se versiona un
instalador nativo adicional ahora —queda para Fase 5—; las claves `ADMIN_*`
muertas quedan correctamente eliminadas.

## Tarea activa única: validación de registro por correo

Es la primera deuda contractual de Fase 2. Al registrarse, comprador, vendedor
o transportista debe quedar sin verificar, recibir un enlace de un solo uso con
24 horas de vigencia y no poder iniciar sesión hasta usarlo. Debe existir
reenvío sin crear otra cuenta. Recuperación de contraseña no entra.

### Contrato backend

- Agregá una migración nueva y un modelo específico para tokens de verificación
  con usuario, **hash** del token, creación, vencimiento y consumo/invalidez. No
  guardes el token crudo en base ni uses el JWT de sesión como verificación.
- Generá tokens criptográficamente aleatorios. Vencen exactamente a las 24 h,
  son de un solo uso y la verificación concurrente no puede aceptar dos veces el
  mismo token.
- `POST /auth/register` crea `is_verified=false`, envía el correo y devuelve una
  respuesta pendiente **sin access token, refresh token ni cookies de sesión**.
- Agregá endpoints para verificar el token y reenviar por email. El reenvío
  invalida todos los tokens anteriores no usados y no duplica al usuario.
- La respuesta de reenvío debe ser genérica para email inexistente, ya
  verificado o pendiente; no reveles qué cuentas existen.
- `login`, `refresh`, `get_current_user` y el acceso opcional deben impedir que
  un usuario no verificado use tokens viejos o consiga sesión. Seed y usuarios
  creados por administración siguen verificados.
- Normalizá los errores: pendiente, vencido, ya usado/inválido y correo no
  enviado deben ser controlados; ningún caso termina en 500 ni deja una sesión.

### Transporte de correo

- Definí una interfaz mínima con dos transportes: `outbox` local/pruebas y SMTP
  productivo. Preferí biblioteca estándar; no agregues una dependencia si no es
  necesaria.
- El outbox guarda el mensaje verificable en una carpeta no pública e ignorada
  por Git. La suite debe poder leer el enlace real sin un endpoint de prueba.
- Sumá sólo las variables necesarias a `Settings` y a ambas plantillas:
  transporte, remitente, host/puerto/credenciales/TLS, outbox y URL del frontend.
  No commitees credenciales ni el contenido del outbox.
- El enlace apunta al frontend y contiene el token sólo en la URL que recibe el
  usuario. No lo imprimas en logs normales ni lo devuelvas en la API.

### Interfaz

- Registro exitoso deja de dar la bienvenida/iniciar sesión. Muestra “revisá tu
  correo”, el email usado y una acción de reenvío; no guarda tokens locales.
- El enlace abre una vista mínima que verifica una vez y ofrece ir a iniciar
  sesión. Muestra estados claro de éxito, vencido/inválido y reenvío.
- Login bloqueado muestra el motivo real y permite pedir reenvío. No agregues
  recuperación de contraseña, magic link ni rediseño general de autenticación.
- Los mensajes de estado/error deben ser accesibles y no revelar información
  adicional sobre cuentas ajenas.

### Pruebas obligatorias

1. Registro API: usuario `false`, sin JWT/cookies; outbox contiene enlace y la
   base sólo el hash. Login y endpoint protegido quedan bloqueados.
2. Enlace vigente: verifica, marca consumo, permite login y falla al reutilizar
   el mismo token. Dos verificaciones simultáneas aceptan exactamente una.
3. Vencimiento forzado: rechaza; reenvío conserva un usuario, invalida el token
   anterior, emite otro y el nuevo verifica. Reenvío de desconocido/verificado
   responde igual sin enviar correo.
4. Tokens de sesión anteriores de un usuario no verificado fallan también en
   refresh y rutas protegidas.
5. Navegador real: registro → aviso pendiente → enlace del outbox → éxito →
   login. Cubrí también login pendiente + reenvío y un enlace vencido.
6. Adaptá los primeros casos de la suite: ya no es válido esperar JWT al
   registrar ni login antes de verificar. Seed, admin y recorrido completo deben
   seguir verdes.

### Límites y entrega

- Sin recuperación de contraseña, cambio de email, OAuth, captcha, campañas,
  proveedor transaccional pago ni diseño de plantillas comerciales.
- Sin cambios en perfiles, transportistas B/C, pagos, catálogo o despliegue.
- Migración limpia y sobre base existente, `alembic check`, suite completa,
  build, accesibilidad de las vistas nuevas y `diff --check` verdes.
- Un commit de código y otro con `PARA-PM.md`. Informá modelo de amenaza,
  contrato de cada endpoint, mensajes del outbox, pruebas de 24 h/un solo uso,
  total final de la suite y cualquier desvío.

---

## 2026-08-10 — Decisión PM sobre riesgos de cronograma

La propuesta `6747e78` no cambia la tarea activa. Seguí con validación de
correo hasta entregar sus criterios completos; no abras Railway, Mercado Pago,
transportistas ni documentación de estado en paralelo.

1. **Railway: riesgo aceptado, ensayo condicionado.** Si correo queda aceptado
   por PM antes del 18/08, la pieza siguiente podrá ser un ensayo descartable
   de una jornada como máximo y deberá terminar antes del 20/08. Usará datos
   demo, sin secretos productivos ni presentación a la clienta. Si no entra en
   esa ventana, vuelve a Fase 5: no consume la puerta de perfiles de Fase 2.
   Configuración o URL de ensayo no cuentan como despliegue contractual.
2. **Mercado Pago: dependencia real, sin implementación adelantada.** PM pide
   que la aplicación quede bajo la cuenta de la clienta y que el acceso de
   prueba se entregue por canal seguro antes del 10/09. No guardes ni pidas
   secretos en GitHub. La reconstrucción sigue en Fase 4.
3. **Transportistas: no hay dos preguntas abiertas.** Contacto y radio ya se
   cerraron el 05/08: radio sobre origen y destino; contacto visible al
   comprador después de seleccionar; transportista sin contacto del comprador
   ni detalle financiero. No las vuelvas a elevar a la clienta.
4. **`PROJECT_STATUS.md`: el problema es real, borrar no se aprueba.** Al hacer
   el ensayo Railway, reemplazalo por un aviso breve de documento histórico y
   enlaces a la documentación vigente. No dediques ahora una reescritura ni lo
   uses como fuente.

No hay corrimiento contractual ni consumo del colchón. La próxima entrega que
PM espera es el commit de validación de correo y su informe separado.

---

## 2026-08-10 — `cb6d888`: correo devuelto una vez

No aceptado todavía. Se acepta provisionalmente el modelo con hash, 24 horas,
consumo condicional, bloqueo de `login`/`refresh`/rutas, alta sin sesión, los dos
transportes y el flujo visual. La compilación independiente quedó verde y el
diff está limpio. No repitas trabajo ya cerrado. Corregí estas tres puertas.

### Hallazgo 1 — el token sí entra en registros normales

`VerifyEmailPage` lee el token pero conserva `?token=...` en la barra mientras
hace `POST /auth/verify-email`. La PM lo reprodujo con navegador: esa llamada
llevó el encabezado
`Referer: http://127.0.0.1:5173/verificar-correo?token=abcdefghijklmnop`.
Además, los botones cambian el estado de React pero conservan la ruta y el
query; al recargar reaparece la verificación con un token usado.

- Capturá el token en memoria y quitá inmediatamente el query con
  `history.replaceState`, **antes** de llamar a la API.
- Al ir al inicio o al login, la URL debe quedar en `/`, sin conservar
  `/verificar-correo` ni el token.
- En el caso de navegador, interceptá la petición de verificación y exigí que
  ni su URL ni `Referer` contengan el token. Exigí también URL limpia después de
  abrir el login y después de recargar.

### Hallazgo 2 — el fallo del transporte enumera cuentas

`POST /auth/resend-verification` devuelve 200 con texto genérico para cuenta
inexistente o verificada, pero devuelve 503 sólo cuando la cuenta pendiente
existe y el transporte falla. Durante una caída o mala configuración SMTP, el
código HTTP revela qué cuenta está pendiente y contradice el contrato genérico.

- Para reenvío, estado y cuerpo externos deben seguir siendo idénticos para
  inexistente, verificada y pendiente aunque el transporte falle. Hacé rollback
  y registrá internamente el fallo sin email ni token; no lo expongas al caller.
- Forzá un transporte fallido en una prueba mínima y compará código y cuerpo
  con los otros dos estados. El alta inicial sí puede conservar su 503 y
  rollback: ahí todavía no existe una cuenta que enumerar y la persona necesita
  saber que debe reintentar.

### Hallazgo 3 — falta el vencimiento en navegador

El caso 35 prueba vencimiento por API. El caso 37 abre en navegador un token
**invalidado por reenvío**, no uno vencido. La tarea pedía expresamente el
estado vencido en interfaz.

- Dentro del recorrido de navegador, emití otro token, vencelo por SQL, abrí su
  enlace y comprobá el mensaje de vencimiento y el formulario de reenvío.
- No hace falta crear otro caso si ampliar el 37 deja la regresión clara.

### Decisiones solicitadas

- `PaymentResultPage`: esperar a Fase 4 y sumar esa pantalla al barrido cuando
  se reconstruya Mercado Pago; hoy esas rutas están fuera del flujo habilitado.
- Ensayo Railway: usa `outbox` y sólo datos demo. No se piden credenciales SMTP
  para una prueba descartable. Producción sí exige `EMAIL_TRANSPORT=smtp` y
  credenciales reales; el ensayo no cuenta como producción.

Límites: no refactorices autenticación, no agregues rate limiting, colas ni
proveedores, y no toques pagos. Conservá el resto de los 37 casos, build,
accesibilidad, contraste, migración y `diff --check` verdes. Un commit de
corrección y el informe separado; informá la evidencia exacta de los tres
hallazgos.

---

## 2026-08-10 — `7262955`: tres hallazgos cerrados; fragmento aprobado

Aceptadas las tres correcciones: la URL se limpia antes del `POST`, salir vuelve
a `/`, el fallo del transporte mantiene 200 y cuerpo genérico con rollback y
registro interno, y el caso 37 distingue un token vencido de uno invalidado.
La compilación independiente y `diff --check` quedaron verdes. No rehagas esas
soluciones.

Se aprueba tu recomendación de eliminar la última aparición del token en el
access log. Es parte de la misma puerta —no dejar tokens en registros normales—
y se cierra ahora, no en Railway ni en Fase 5.

### Corrección final única

- Armá el enlace como `/verificar-correo#token=...`, no con query. Leé el token
  desde `window.location.hash`, guardalo sólo en memoria y limpiá el fragmento
  antes de llamar a la API. El servidor debe recibir únicamente
  `GET /verificar-correo`.
- Retirá el `<meta name="referrer" content="strict-origin">`: con fragmento ya
  no protege ningún token y dejar una política global redundante agrega un
  efecto lateral innecesario.
- Adaptá el lector del correo y el caso 37. Con el token vigilado, exigí **cero
  peticiones totales** cuya URL o `Referer` lo contengan —incluido el documento,
  no sólo la API—, barra limpia, recarga sin reconsumo y salida a `/`.
- Conservá el cuerpo del `POST /auth/verify-email`; el token no pasa a query de
  API ni se devuelve en respuestas o logs.

Sin caso nuevo, proveedor, refactor ni cambios fuera de esos cuatro archivos y
el informe. Repetí 37/37 porque el parser del enlace alimenta toda la suite,
además de build y `diff --check`; no hace falta repetir accesibilidad ni
contraste si el DOM y los estilos no cambian. Un commit mínimo y el informe
separado.

---

## 2026-08-10 — `ccc0794`: correo aceptado

Aceptado. El enlace usa fragmento, el servidor recibe sólo
`GET /verificar-correo`, el token se limpia antes del `POST`, el cambio de hash
procesa un enlace nuevo sin gastar dos veces el mismo, el `meta referrer`
redundante salió y la vigilancia exige cero peticiones con el token. Build
independiente y `diff --check` verdes; suite informada 37/37.

Los dos marcadores `?token=` que quedaron en `a11y.mjs` y `contraste.mjs` miden
el estado incompleto con el mismo DOM y estilos que el inválido. No bloquean la
aceptación. Alinealos cuando esos guiones vuelvan a tocarse; no abras otra
corrección de correo por eso.

## Tarea activa única: ensayo descartable de Railway

Objetivo: descubrir ahora los defectos de despliegue que no aparecen en Docker
local, sin llamar producción a este entorno ni consumir la puerta de perfiles
de Fase 2. Tope total: una jornada y cierre antes del 20/08.

**Relevo PM 2026-08-10:** Gate A quedó cerrado por la PM porque tu bloqueo de
egreso no se reproduce en su entorno. Tu commit `0cf960b` queda aceptado junto
con la construcción y el ensayo Docker completo documentados en `NOW.md`. Gate
B está parcialmente creado en Railway y queda en manos de la próxima PM porque
tu sesión no tiene acceso; no hagas más cambios ni abras otra tarea hasta que
la PM entrante termine el contraste del estado externo.

### Gate A — hacelo ahora, sin cuenta Railway

- `railway whoami` responde hoy `Unauthorized`. No intentes login interactivo,
  no crees recursos y no pidas ni guardes tokens en GitHub.
- Corregí `RAILWAY.md`: elimina las `ADMIN_*` que `Settings` ya no acepta;
  documentá las variables reales de correo. Para el ensayo se usa `outbox`,
  `EMAIL_OUTBOX_DIR=/data/outbox` y sólo datos demo. Producción exigirá SMTP.
- Ajustá cualquier contradicción entre la guía, los dos `railway.toml`, los dos
  Dockerfiles y los entrypoints. Conservá el monorepo actual: Frontend raíz
  `/`, Backend raíz `/backend`, archivo de configuración absoluto por servicio.
- Construí las dos imágenes Railway localmente. En recursos Docker aislados,
  comprobá: PostGIS, pre-deploy de migraciones, seed dos veces, API y frontend
  saludables, `/verificar-correo` directo sin 404, catálogo, outbox, upload y
  persistencia de `/data` tras reiniciar. No toques `topgreen-*`.
- Reemplazá `docs/PROJECT_STATUS.md` por un aviso breve de documento histórico
  y enlaces a las fuentes vigentes; no lo reescribas entero ni borres historia.
- Si Gate A descubre un defecto imprescindible, corregí sólo configuración,
  entrypoint o documentación. Un cambio de producto frena y vuelve a PM.

### Gate B — autorizado por Emi el 2026-08-10, después de cerrar Gate A

La CLI ya está autenticada como Emiliano Sejumil y la cuenta usa Hobby. Emi
confirmó que `strong-playfulness` es un proyecto de prueba, no final ni
importante, y autorizó reutilizarlo. No crees otro proyecto. Hoy contiene sólo
el servicio raíz `yneratopgreen`, con auto-deploy de `main`, ningún volumen y el
dominio `ynerav.up.railway.app`. El último deploy (`46109ba`) figura `SUCCESS`,
pero la PM comprobó que sólo sirve el frontend: `/health` da texto `ok` y las
rutas `/api/health` y `/api/catalog/categories` devuelven `text/html` del SPA.
Ese verde no satisface Gate B.

Con autorización:

- Reutilizá `strong-playfulness` como proyecto inequívocamente descartable con
  datos demo, secreto JWT aleatorio sólo en Railway,
  `EMAIL_TRANSPORT=outbox`, PostGIS privado y volumen Backend en `/data`. No uses
  SMTP, Mercado Pago ni datos reales.
- Desplegá desde `main` los tres servicios. Verificá HTTPS y dominios, health de
  ambos servicios, migraciones, PostGIS, seed idempotente, catálogo, CORS,
  registro y enlace leído desde `/data/outbox`, ruta directa de confirmación y
  login posterior.
- Subí una imagen demo, redesplegá o reiniciá Backend y comprobá que sigue
  servida. Comprobá que la base conserva usuarios y catálogo. Railway sólo usa
  el healthcheck al desplegar; no lo presentes como monitoreo continuo.
- Registrá uso estimado, límites y disponibilidad de backups, pero no actives
  backups pagos ni restaures nada en este ensayo. No elimines el proyecto al
  terminar: reportá el resultado y esperá autorización de PM para limpiarlo.

### Evidencia y freno

- Si Emi todavía no autenticó Railway al cerrar Gate A, entregá Gate A y
  reportá el bloqueo; no abras otra pieza ni excedas la jornada.
- Sin secretos, contenido de outbox ni tokens en commits o informe. Sí se pueden
  informar dominios demo, IDs no sensibles, estados, tiempos y costo estimado.
- Corré sólo las pruebas proporcionales a los archivos tocados, build,
  validación de plantillas y `diff --check`. No repitas 37/37 salvo que cambies
  producto, correo o seed.
- Un commit de Gate A/configuración y documentación; si Gate B se habilita, otro
  commit sólo si el despliegue exige un ajuste versionable. Informe separado en
  `PARA-PM.md` con una tabla Gate A/Gate B y cada criterio.

## Tarea cerrada y aceptada: error de validación legible

Gate B quedó cerrado por PM en el proyecto descartable de Railway. No tenés que
entrar a Railway, repetir el despliegue ni tocar su configuración.

### Evidencia que dispara esta tarea

En `https://ynerav.up.railway.app`, el alta con un dominio de correo que
`EmailStr` rechaza devuelve el detalle estructurado normal de FastAPI y el modal
muestra literalmente `[object Object]`. Con un correo válido, el registro,
outbox, confirmación y login funcionan. La causa está acotada al manejo común de
errores HTTP en `src/utils/api.ts`: hoy entrega `errorData.detail` directamente
a `new Error(...)`, aunque FastAPI puede devolver una lista de objetos.

### Resultado exigido

- Convertí cualquier `detail` de FastAPI en un mensaje humano estable: cadena,
  lista de errores de validación u otra forma inesperada. Nunca debe llegar
  `[object Object]` a la interfaz.
- Conservá sin cambios los mensajes de negocio que ya son cadenas, en especial
  registro pendiente, correo no enviado, login sin verificar y confirmación.
- Agregá una regresión ejecutable para el `422` estructurado y una para un
  `detail` de texto. Comprobá además el modal de registro con correo inválido.
- Corré sólo esas regresiones, el build y `git diff --check`.

### Límites y freno

No cambies validación de correo, backend, Railway, perfiles, catálogo ni textos
comerciales. No diseñes una jerarquía nueva de excepciones si una normalización
pequeña en el cliente alcanza. Si la corrección obliga a tocar el backend o
rompe un mensaje de negocio existente, frená e informá.

Entregá un solo commit y un informe mínimo en `PARA-PM.md`: causa, archivos,
pruebas exactas y cualquier riesgo. Ahí termina la tarea; no abras otra mejora.

**Aceptada por PM el 2026-08-10:** `ca23451`, informe `085f2b5`. Build
independiente y los dos mensajes reproducidos en Railway. No la reabras.

## Tarea cerrada y aceptada: perfil transportista editable de Fase 2

### Situación comprobada

El alta ya guarda `is_carrier`, localidad base, transporte, declaración de
certificación, radio y capacidad. `/auth/me` los devuelve. Pero
`UserUpdateRequest`, `PATCH /auth/me`, `AuthContext.updateProfile` y el panel de
perfil no permiten editarlos. Por eso la puerta contractual de Fase 2 sigue
abierta aunque el registro inicial funcione.

### Resultado exigido

- Un usuario que ya es transportista puede ver y editar desde su perfil:
  localidad base del padrón oficial, transporte habilitado, declaración de
  certificación, radio de cobertura positivo y capacidad.
- La actualización se valida también en backend: localidad existente y perfil
  transportista completo/coherente. Un payload parcial no puede dejarlo en un
  estado inválido.
- Guardar, recargar la página y volver a iniciar sesión conserva los cambios.
  `GET /auth/me` y la interfaz muestran lo mismo.
- La edición general de comprador/vendedor y sus mensajes actuales no cambia.
- Agregá la regresión integral mínima: alta y confirmación de un transportista,
  edición de los cinco datos, recarga/GET, rechazo de localidad inexistente y
  radio no positivo. Actualizá el conteo documentado sólo si el caso entra en
  la suite oficial.
- Corré la regresión nueva, build, pruebas proporcionales y `git diff --check`.

### Alcance y freno

No conviertas al transportista en un rol nuevo y no permitas crear un perfil
incompleto. No implementes todavía listado compatible, PostGIS por radio,
selección/contacto, estados logísticos, tarifa, ruteo, GPS, documentos ni
verificación oficial. No toques Railway.

Usá los campos y el padrón existentes; una migración sólo se justifica si es
imprescindible para cumplir un dato contractual ya documentado, no para prever
funciones futuras. Si aparece una ambigüedad que cambie quién puede convertirse
en transportista o abandonar esa condición, frená: esa política no está
decidida y es de PM/Emi.

Entregá un commit de producto y el informe mínimo separado en `PARA-PM.md` con
causa, archivos, pruebas exactas y riesgos. Ahí termina la tarea.

**Aceptada por PM el 2026-08-10:** producto `c484513`, informe `b753b17`. El
hash `d4623b4` escrito en el informe no corresponde al historial publicado; el
commit de producto real es `c484513`. Build independiente verde. En Railway la
PM reprodujo alta y confirmación, actualización de los cinco campos, lectura
posterior con localidad/provincia derivadas y rechazo atómico de una localidad
inexistente. No reabras esta pieza.

## Tarea cerrada y aceptada: integridad y accesibilidad de la edición del perfil

### Situación comprobada

`UserDashboard` inicializa teléfono, WhatsApp, provincia, ciudad y dirección
con constantes demo. Abrir edición y guardar puede escribir esos datos falsos
sobre una cuenta real. También muestra un email editable que el guardado no
envía. Los controles generales anteriores no tienen etiquetas asociadas y los
barridos miden el panel sólo en lectura, por lo que hoy pueden quedar verdes sin
abrir el modo edición.

### Resultado exigido

- El formulario se hidrata únicamente con datos reales de `/auth/me`; si un
  dato no existe, empieza vacío. No inventa teléfono ni ubicación.
- Definí una sola representación reversible para la ubicación disponible hoy.
  Abrir y guardar sin cambios debe conservar exactamente el valor persistido,
  incluso si está vacío o no tiene las tres partes esperadas. No agregues un
  padrón nuevo ni una migración para resolverlo.
- El email se muestra como dato de sólo lectura, salvo que exista un camino
  real y ya probado para actualizarlo. No dejes un control que aparenta guardar
  y luego se ignora.
- Cancelar restaura todos los campos generales y de transportista al último
  estado guardado. Una edición abandonada no puede reaparecer en el guardado
  siguiente.
- Cada control del modo edición tiene nombre accesible mediante `label`/`id` o
  un equivalente semántico. Incorporá el modo edición del perfil al barrido de
  accesibilidad en escritorio y celular; una falla al abrirlo no puede omitirse
  silenciosamente.
- Agregá una regresión de integridad mínima: cuenta con datos reales y cuenta
  sin datos, abrir/cancelar/guardar sin cambios y cambiar un dato explícito.
  Contrastá el resultado con `GET /auth/me` o SQL, no con constantes.

### Alcance y freno

Es una corrección del perfil existente. No cambies el modelo de usuario, no
agregues campos de provincia/ciudad/dirección, no conviertas la ubicación libre
en padrón, no abras directorio de transportistas, pagos, catálogo ni Railway.
No rediseñes el panel y no hagas retoques cosméticos.

Si conservar una ubicación libre sin pérdida exige decidir un modelo nuevo,
frená y traé el caso exacto: no adivines una estructura. Si el barrido descubre
una familia distinta de accesibilidad fuera del modo edición, reportala y no la
mezcles con esta pieza.

Entregá un commit de producto y otro separado con el informe en `PARA-PM.md`.
Corré la regresión nueva, el barrido de accesibilidad en sus dos medidas, build
y `git diff --check`; no repitas pruebas de pagos, catálogo o Railway si estos
archivos no los afectan. Ahí termina la tarea.

**Aceptada por PM el 2026-08-11:** producto `c5d2caa`, informe `6dfff09`. Build
y `diff --check` independientes verdes. La PM desplegó el Backend nuevo en el
Railway descartable y comprobó que una cuenta con teléfono, WhatsApp y ubicación
ausentes sigue con los tres valores `null` después de guardar campos vacíos.
La edición del perfil abrió y pasó axe en escritorio y celular.

El barrido externo completo sí encontró un rojo ajeno a esta pieza: dos
`scrollable-region-focusable` serios en las tablas móviles de productos y
órdenes de administración. No invalida el arreglo de perfil, pero reabre la
puerta global y dispara la tarea siguiente.

## Tarea cerrada y aceptada: cobertura accesible de perfiles y administración

### Evidencia y resultado exigido

1. Reproducí en 390×844 las dos violaciones `scrollable-region-focusable` de
   `administración: productos` y `administración: órdenes`. Hacé que esas
   regiones desplazables sean alcanzables y utilizables por teclado, con foco
   visible y nombre comprensible. No suprimas la regla, no bajes el umbral y no
   agregues `tabIndex` sin comprobar el recorrido real.
2. Se aprueba agregar **un cuarto usuario demo transportista** al seed. Debe
   usar una localidad oficial y tener completos los cinco datos existentes:
   localidad base, transporte, declaración de habilitación, radio positivo y
   capacidad. Seed inicial y repetido deben dejar exactamente una cuenta, sin
   duplicar ni alterar las tres cuentas demo actuales.
3. Usá esa cuenta en `a11y.mjs` para abrir el perfil transportista en lectura y
   edición en escritorio y celular. Exigí un marcador propio de sus controles;
   si la cuenta no es transportista o la sección no abre, la puerta falla. El
   inventario pasa de 46 a **48 pantallas**.
4. El comando completo termina 48/48, con cero violaciones `serious` o
   `critical`. Conservá además build, contraste y `diff --check` verdes. Agregá
   sólo la regresión mínima de idempotencia del seed si la suite actual no lo
   demuestra.

### Alcance y freno

Esta pieza cierra una puerta existente; no rediseñes las tablas ni el panel.
No abras directorio o matching de transportistas, contactos, tarifas, estados
logísticos, pagos, catálogo ni Railway. El usuario demo no publica, compra ni
recibe privilegios nuevos.

Si el rojo de las tablas no se reproduce localmente, no declares verde: traé
la diferencia de navegador/DOM y verificá la semántica del elemento desplazable
con la evidencia externa indicada arriba. Si aparece otra familia distinta de
violaciones, frená y reportala antes de ampliar.

Entregá un commit de producto y otro separado con el informe en `PARA-PM.md`.
Ahí termina la tarea.

**Aceptada por PM el 2026-08-11:** producto `6fd060d`, informe `1f7150f`. Tu
objeción aritmética es correcta: el inventario es 50 y no 48. Build y
`diff --check` independientes verdes. La PM desplegó el Backend nuevo en el
Railway descartable; el seed creó el transportista en la primera corrida y lo
reconoció en la segunda. El barrido público terminó **50/50**, sin violaciones
de ningún impacto. No reabras esta pieza.

## Tarea activa única — bloque largo: listado compatible de transportistas

Objetivo vertical: en el checkout, una persona elige un destino del padrón y
ve, por cada futura orden/vendedor del carrito, los transportistas cuya base
cubre el destino y todos sus orígenes. Es la Pieza B de logística y el bloque
que falta para demostrar la geolocalización de fletes del hito intermedio. No
incluye todavía elegir transportista ni revelar contacto.

### 1. Cerrar primero el dato contractual incompleto

Hoy sólo existen el texto del vehículo y un booleano. `ALCANCE-Y-LIMITES.md` y
`DECISIONS.md` exigen que la habilitación sea una **declaración con detalle y
fecha**.

- Agregá detalle de la declaración y fecha registrada por el servidor. La
  persona no escribe ni retrodata la fecha.
- Registro y edición de transportista exigen el detalle; una declaración nueva
  o un cambio de detalle actualiza la fecha. Se muestra como declaración del
  transportista, nunca como verificación de TopGreen.
- No inventes detalle para perfiles existentes. Si la migración encuentra uno
  sin detalle, queda incompleto y no aparece como compatible hasta completarlo.
  El transportista demo sí debe quedar completo e idempotente.
- Migración reversible, esquema/API, registro, perfil y regresión. Sin archivos,
  organismos externos, vencimientos ni validación oficial.

### 2. Destino oficial y persistente

- Reemplazá provincia fija + ciudad libre del checkout por los selectores
  encadenados del padrón ya usado en catálogo y perfiles. La dirección exacta
  sigue siendo texto libre y no entra al cálculo.
- Cada checkout nuevo envía y valida `shipping_locality_id`. Persistilo en cada
  orden creada, con FK a localidades; las órdenes históricas deben seguir
  leyendo aunque no tengan ese dato. Provincia y ciudad visibles se derivan del
  padrón, no de texto aportado por el cliente.
- Cambiar provincia o localidad invalida inmediatamente cualquier resultado
  anterior. Una respuesta tardía no puede pisar el destino actual.

### 3. Compatibilidad geográfica por carrito

- El backend deriva los grupos del carrito activo: una futura orden por
  vendedor. No acepta que el cliente le dicte vendedor, origen ni radio.
- Para cada grupo, un transportista es compatible sólo si su base está dentro
  de su radio declarado respecto del destino **y de cada localidad de origen
  distinta** de los productos de ese grupo. Un producto sin localidad oficial
  hace que ese grupo no pueda declarar compatibilidad; no se adivina desde
  texto libre.
- Usá `ST_DWithin` sobre `localities.coordinates` para filtrar en base. No
  calcules distancias en Python ni traigas todos los transportistas para
  filtrarlos en memoria. `ST_Distance` puede producir las distancias visibles
  en km.
- Sólo entran cuentas activas, verificadas, transportistas, con declaración
  completa, base válida y radio positivo. La capacidad se muestra pero no
  filtra. No ordenes por “mejor”; el directorio no recomienda.
- La respuesta y las tarjetas muestran nombre, base, vehículo, declaración,
  fecha, radio, capacidad y distancias rectas a destino y a cada origen. No
  envían email, teléfono, WhatsApp, domicilio, CBU ni alias.
- La interfaz distingue cargando, sin coincidencias, grupo sin origen oficial y
  error real. Un destino nuevo reemplaza el listado anterior; no lo mezcla.

### 4. Evidencia obligatoria

- Regresión integral con al menos dos vendedores y orígenes distintos, límites
  dentro/fuera del radio y cambio de destino. Para cada grupo, compará la API
  con SQL/PostGIS equivalente; no uses cantidades fijas del seed.
- Demostrá que un candidato que falla en un solo origen queda afuera, que un
  perfil incompleto queda afuera y que ningún campo de contacto aparece ni en
  el JSON ni en el DOM.
- Demostrá validación y persistencia del destino en las órdenes nuevas sin
  romper lectura de órdenes históricas ni los dos checkouts actuales.
- Build, suite completa, accesibilidad, contraste y `diff --check` verdes. Si
  agregás recorridos permanentes, actualizá el inventario exigido con la cuenta
  correcta y explicala.

### Límites y freno

Bloque estimado de **1–2 días**. No implementes selección de transportista,
contacto, asignación a la orden, vista logística del transportista, tarifa,
ruteo, GPS, mapas, peso/capacidad automática, suscripciones ni pagos nuevos.
No toques Railway. No uses distancia por caminos ni una API externa.

Si el modelo actual de carrito no permite identificar los orígenes por grupo,
o una migración obliga a romper órdenes existentes, frená con el caso concreto
antes de cambiar la regla contractual. Entregá un commit de producto y otro
separado con el informe en `PARA-PM.md`. Ahí termina la tarea.

### Revisión PM de la entrega `e3fe9cb`: no aceptada todavía

El informe `e063c18`, el build independiente y el `diff --check` están verdes,
pero la evidencia funcional tiene un falso verde que bloquea la aceptación:

- `CartContext` mantiene el carrito visible en almacenamiento local y no lo
  sincroniza al agregar, quitar o cambiar cantidades.
- `CheckoutModal` consulta `/logistics/compatible-carriers` al elegir localidad
  antes de ejecutar `/cart/sync`; esa sincronización ocurre recién al avanzar
  a pago.
- El caso 43 prepara por API el carrito del servidor antes de abrir la interfaz.
  Por eso no demuestra que el listado corresponda al carrito que la persona
  acaba de armar en pantalla y puede pasar aunque la integración real falle.

Corregí únicamente esta integración dentro de la tarea ya entregada:

1. Antes de la primera consulta de compatibilidad para el destino elegido,
   sincronizá y esperá el carrito local exacto mediante `/cart/sync`. Si falla
   la sincronización, no consultes compatibilidad y mostrá el error real.
2. El estado de carga debe cubrir sincronización y consulta. La protección
   contra respuestas tardías debe cubrir ambas operaciones: una respuesta de
   un carrito o destino anterior no puede reemplazar el estado vigente.
3. Si el carrito visible cambia con el checkout abierto, invalidá el resultado
   y volvé a sincronizar antes de mostrar compatibilidad. Podés reutilizar una
   sincronización sólo mientras puedas demostrar que representa exactamente el
   mismo snapshot del carrito.
4. Reemplazá el falso verde por una regresión que empiece con carrito servidor
   vacío o deliberadamente distinto, agregue el producto sólo desde la UI,
   abra checkout, elija destino y compruebe que los grupos corresponden
   exactamente al carrito visible. Caso preferido: servidor con producto A y
   UI con producto B; la respuesta debe reflejar B y nunca A.
5. Conservá la comparación SQL/PostGIS y la privacidad del caso 43, pero su
   tramo UI no puede depender del carrito preparado antes por API.

No cambies la migración, la regla geográfica, la declaración, la persistencia
de órdenes, Railway ni abras selección, contacto o asignación. Corré el caso
corregido, la suite y puertas proporcionales, build y `diff --check`. Entregá
un nuevo commit de producto y el informe separado; ahí vuelve a PM.

### Segunda revisión PM de `1ec7082`: todavía no aceptada

El caso A/B nuevo corrige el falso verde original y el alcance se mantuvo bien,
pero la protección declarada para ambas operaciones no está completa:

1. El número de consulta evita que una promesa vieja actualice React, pero no
   evita que su `POST /cart/sync` escriba después de un POST nuevo. Si cambia el
   carrito mientras la primera sincronización está en vuelo, la vieja puede
   terminar última, sobrescribir el carrito servidor y hacer que la consulta
   vigente lea el snapshot anterior. El `if (!vigente()) return` ocurre después
   de que esa escritura ya sucedió.
2. Cuando `localityId` queda vacío, el efecto retorna antes de incrementar
   `consultaDeFletes`. Cambiar provincia borra la localidad; una respuesta en
   vuelo del destino anterior sigue siendo considerada vigente y puede volver
   a escribir `fletes` aunque ya no haya destino.

Corregí sólo esas dos carreras. Serializá o coordiná las sincronizaciones para
que una escritura vieja nunca pueda quedar como estado final ni alimentar la
consulta vigente; cancelar del lado cliente no alcanza si el servidor ya pudo
procesar el POST. Invalidá la generación antes de cualquier retorno por destino
vacío.

Agregá una regresión determinista que demore la sincronización vieja, cambie el
carrito, deje terminar primero la nueva y luego libere la vieja; al consultar,
servidor y listado deben representar únicamente el snapshot nuevo. Agregá el
caso de cambiar provincia o vaciar destino con una respuesta anterior en vuelo:
al finalizar no debe reaparecer ningún listado viejo. No alcanza una prueba
dependiente de tiempos naturales de red.

No reescribas el caso A/B que ya sirve ni amplíes el módulo. Corré los casos
enfocados, suite y puertas proporcionales, build y `diff --check`; entregá nuevo
commit de producto e informe separado. Ahí vuelve a PM.

### Tercera revisión PM de `db85ff4`: todavía no aceptada

La cola es correcta dentro de una instancia y la generación ahora se mueve
antes del retorno. Acepto que el caso 46 no discrimina el arreglo sin volver
observable estado interno: no cambies la interfaz para fabricar esa prueba.

El caso 45, en cambio, no cumple la regresión pedida. No cambia el carrito
mientras la primera sincronización está retenida: el destino dispara B y el
pago intenta sincronizar el mismo B. Que haya una sola escritura demuestra la
deduplicación del mismo retrato, no que A y B se serialicen ni cuál queda al
final.

Hay además un recorrido normal que conserva la carrera: la cola y el retrato
son `useRef` del `CheckoutModal`. Si la persona elige destino con el snapshot A,
cierra el modal mientras el POST está en vuelo, modifica el carrito y reabre
checkout con B, la instancia nueva crea otra cola. El POST B puede terminar
primero y el POST A de la instancia desmontada puede terminar último,
sobrescribiendo el carrito vigente.

Corregí la coordinación en el dueño mínimo que sobreviva al desmontaje del
modal y cubra todas las sincronizaciones de este carrito. No agregues una
segunda solución ni una dependencia. La regresión determinista debe:

1. armar A sólo desde la interfaz, abrir checkout, elegir destino y retener su
   `/cart/sync`;
2. cerrar checkout, cambiar el carrito visible de A a B desde la interfaz y
   reabrirlo;
3. elegir destino, dejar terminar la sincronización B y recién después liberar
   A;
4. comprobar que servidor, listado y paso de pago representan sólo B;
5. ponerse rojo con la cola local actual y verde con la coordinación corregida.

No hace falta otra prueba para el caso 46 ni tocar su corrección. No reabras
PostGIS, migraciones, declaración, órdenes, Railway o la Pieza C. Corré el caso
enfocado, suite y puertas proporcionales, build y `diff --check`; entregá nuevo
commit de producto e informe separado. Ahí vuelve a PM.

### Cuarta revisión PM de `fe73073`: falta el límite de identidad

El caso 45 nuevo sí usa A/B distintos, fuerza el orden y se pone rojo con la
cola local. La coordinación en `CartContext` es el dueño correcto y esa parte
queda conforme. No la reescribas otra vez.

Queda un problema de integridad entre sesiones: `retratoEncolado` resume sólo
producto y cantidad, y la cola sobrevive al logout porque vive en el proveedor.
Si la cuenta A ya sincronizó X, cierra sesión y la cuenta B arma el mismo X, la
función puede considerarlo sincronizado aunque el carrito servidor de B esté
vacío o sea distinto. Además, un turno de A encolado pero todavía no iniciado
ejecuta `apiFetch` cuando le llega el turno; si para entonces entró B, puede usar
las credenciales vigentes de B para escribir la instantánea de A.

Corregí sólo el límite de sesión:

1. La deduplicación debe incluir la identidad autenticada, no sólo el retrato
   del carrito. Un login nuevo nunca hereda “ya sincronizado” de otro usuario.
2. Trabajo encolado bajo una sesión no puede comenzar usando credenciales de
   una sesión posterior. Al salir o cambiar de identidad debe descartarse de
   forma segura o conservar explícitamente su identidad original; no alcanza
   con vaciar los ítems visibles.
3. Una petición que ya salió antes del logout puede terminar para su usuario
   original, pero no puede bloquear ni sobrescribir el carrito de la cuenta
   nueva.

Agregá una regresión determinista, sin recargar: A sincroniza un carrito X,
cierra sesión, entra B con carrito servidor vacío o distinto, arma el mismo X
desde la interfaz y elige destino. Debe salir una sincronización nueva y sólo el
carrito de B debe quedar en X. Cubrí además un turno de A encolado pero aún no
iniciado al cambiar de cuenta: nunca debe salir autenticado como B ni escribir
en su carrito.

No cambies autenticación general, no agregues dependencia y no abras alcance.
Conservá los casos 43, 45 y 46. Corré el caso nuevo o ampliado, suite y puertas
proporcionales, build y `diff --check`; entregá nuevo commit de producto e
informe separado. Ahí vuelve a PM.

### Quinta revisión PM: Pieza B aceptada

Aceptados producto `e3fe9cb` con cierre `93ea92c` e informe final `8dc9543`.
Los casos 43, 45, 47 y 48 ahora miden los recorridos reales pedidos. Build y
`diff --check` independientes verdes. La PM intentó la suite completa, pero no
pasó de la preparación porque el daemon de Docker local está apagado; se acepta
la evidencia 48/48 informada junto con la inspección de las regresiones. No
reabras esta pieza.

## Tarea activa única — credenciales contradictorias

Tu hallazgo queda confirmado en código: los endpoints protegidos prefieren la
cookie de acceso sobre el Bearer, y refresh hace lo mismo con su cookie. Si
ambos pertenecen a usuarios distintos, hoy la API opera silenciosamente como
uno de ellos. Es un límite de identidad, no una preferencia de transporte.

### Resultado exigido

1. Una sola credencial presente sigue funcionando, tanto cookie como Bearer.
2. Si cookie y Bearer están presentes y son el mismo token, funciona una sola
   vez como esa identidad.
3. Si ambos están presentes y difieren, la API responde 401 sin revelar cuál
   era válido y sin leer datos privados ni ejecutar ninguna escritura. No gana
   cookie ni header y no se intenta continuar con uno después de rechazar otro.
4. Aplicá la misma regla a access y refresh. Los endpoints opcionales no pueden
   personalizar una respuesta bajo credenciales contradictorias: deben quedar
   anónimos o rechazar de forma consistente, sin elegir identidad.
5. Login, refresh automático, logout y los clientes actuales de una sola fuente
   siguen funcionando. No cambies tokens, expiraciones, cookies, localStorage,
   roles, CORS ni criptografía.

### Evidencia obligatoria

- Regresión con dos cuentas reales: header A + cookie B sobre `/auth/me` y una
  escritura protegida como `/cart/sync` debe dar 401 y dejar ambas cuentas sin
  cambios. Invertí A/B para demostrar que el orden no decide.
- Los equivalentes con sólo header, sólo cookie y ambos iguales deben conservar
  identidad y funcionar.
- Repetí la matriz para `/auth/refresh`, usando refresh tokens; una contradicción
  no emite tokens nuevos ni modifica cookies de sesión.
- Conservá 43, 45, 47 y 48. Suite completa, build y `diff --check`; pruebas de
  accesibilidad/contraste sólo si tocás interfaz, cosa que no debería hacer falta.

### Alcance y freno

Resolvé la fuente contradictoria en el punto común mínimo. No refactorices toda
la autenticación, no cambies el contrato de respuestas salvo el conflicto, no
agregues revocación, sesiones en base, CSRF, OAuth ni dependencias. Si una
fuente única existente depende realmente de la precedencia actual, traé el
recorrido antes de ampliar. Entregá commit de producto e informe separado; ahí
vuelve a PM.

**Aceptada por PM:** producto `70b0d7b`, informe `ce5ae84`. Build, sintaxis
Python y `diff --check` independientes verdes; la dev informa 50/50. La regla
401 ante tokens distintos coincide con el criterio y no se detectó elección de
identidad posterior al rechazo. No reabras esta pieza.

## Tarea activa única — bloque largo: selección e inclusión del flete

Objetivo vertical: completar la Pieza C usando el flujo aprobado en
`docs/ux/logistica/`. Para cada grupo del carrito —una futura orden por
vendedor— el comprador debe elegir explícitamente un transportista compatible
o declarar que coordina el traslado por su cuenta. La decisión llega a la orden
y cada participante ve únicamente lo necesario.

Bloque estimado de **1–2 días**. Mantené esfuerzo Extra: toca autorización,
privacidad, migración y los dos checkouts.

### 1. Decisión explícita y contacto protegido

- La elección es por grupo/vendedor, no una sola para todo el carrito. Ninguna
  orden puede quedar en el estado ambiguo “necesito flete pero no elegí”.
- Las dos únicas decisiones válidas son transportista seleccionado o traslado
  por cuenta propia. La interfaz no avanza hasta resolver todos los grupos.
- Antes de elegir, el listado conserva cero email, teléfono, WhatsApp,
  domicilio y datos bancarios. Al seleccionar, el backend vuelve a derivar el
  grupo del carrito y revalida que ese transportista cubra destino y todos sus
  orígenes; recién entonces devuelve al comprador email y los teléfonos de
  contacto disponibles. No confíes en los candidatos enviados por el cliente.
- Cambiar destino, productos, cantidades o vendedor invalida inmediatamente
  selección y contacto de los grupos afectados. Una respuesta tardía no puede
  restaurarlos. Quitar/cambiar selección vuelve a ocultar el contacto.
- “Por cuenta propia” no revela contacto ni crea un transportista ficticio.

### 2. Persistencia y atomicidad de los dos checkouts

- Persistí por orden el modo de traslado y, cuando corresponda, el
  transportista elegido mediante una relación válida. Migración reversible;
  órdenes históricas sin esos datos siguen legibles y se muestran como traslado
  no definido, no se reinterpretan como cuenta propia.
- Transferencia y Mercado Pago reciben el mapa de decisiones, pero el backend
  deriva los grupos reales. Debe exigir exactamente una decisión por grupo,
  rechazar grupos extra, vendedores inyectados, transportistas incompatibles,
  inactivos o incompletos y cualquier carrier en modo cuenta propia.
- Revalidá todo justo antes de crear órdenes. Si falla una decisión, no se crea
  ninguna orden, no se descuenta stock y no queda una operación parcial.
- La compatibilidad se exige al elegir y otra vez al confirmar; que el perfil,
  radio, origen o destino cambien entre ambos pasos debe producir un error
  visible y conservar el carrito.

### 3. Vistas y límites de privacidad

- Comprador: en checkout/resumen e historial ve su decisión. Si eligió
  transportista, ve nombre, base, transporte, capacidad y contacto; si eligió
  cuenta propia, ve esa frase y nada más.
- Vendedor: en la venta ve transportista elegido y su contacto, o que el
  comprador coordina por su cuenta. No gana acciones logísticas nuevas.
- Transportista elegido: vista propia de operaciones asignadas con origen,
  destino, artículos y cantidades existentes. No recibe teléfono/email del
  comprador, precios, totales, comprobantes, CBU, alias ni otros datos
  financieros. Un transportista no elegido no puede enumerar ni abrir la
  operación.
- Una asignación histórica sigue visible aunque el perfil luego quede
  incompleto o inactivo; eso no lo vuelve elegible para operaciones nuevas.
- No agregues aceptar/rechazar viaje, estados de entrega, chat, notificaciones,
  tarifa ni pago al transportista.

### 4. Evidencia obligatoria

- Recorrido integral con al menos dos vendedores: uno resuelto con
  transportista y otro por cuenta propia. Probá ambos checkouts y contrastá
  órdenes/stock con SQL, sin cantidades fijas del seed.
- Contacto ausente antes de seleccionar tanto en JSON como DOM; presente sólo
  para el comprador después de revalidar. Quitar selección y cambiar destino o
  carrito vuelven a ocultarlo.
- Inyección de carrier incompatible/de otro grupo y decisiones faltantes o
  extra: rechazo atómico, cero órdenes nuevas y stock intacto.
- Autorización de las tres vistas: comprador y vendedor ven lo permitido;
  carrier elegido ve sólo necesidad logística; carrier ajeno recibe 403/404;
  ningún JSON ni DOM del carrier contiene datos financieros o contacto del
  comprador.
- Orden histórica sin decisión sigue legible. Migración downgrade/upgrade y
  `alembic check` verdes.
- Suite completa, build, accesibilidad en escritorio/celular para cada pantalla
  nueva, contraste y `diff --check`. Actualizá los inventarios con aritmética
  explícita si agregás recorridos permanentes.

### Alcance y freno

Reutilizá el padrón, la consulta PostGIS, el agrupamiento del carrito, las
órdenes y el prototipo ya aprobados. No rediseñes el checkout fuera de ese
acuerdo y no agregues dependencias. No implementes mapas, distancia por ruta,
GPS, cálculo de peso/capacidad, precio o cobro del flete, Carta de Porte,
mensajería, planes ni Railway.

Si los dos checkouts no pueden validar todas las decisiones antes de la primera
escritura, frená con el caso concreto: no aceptamos compensar órdenes parciales
después. Entregá commit de producto e informe separado; ahí vuelve a PM.

### Primera revisión PM de `ecfaa4c`: todavía no aceptada

La arquitectura general, la revalidación compartida, la atomicidad previa a la
primera fila y los límites de las tres vistas quedan conformes. Build, sintaxis
Python y `diff --check` independientes verdes. No reescribas esas partes.

Quedan dos defectos funcionales concretos:

1. **Una selección tardía restaura una decisión descartada.**
   `elegirTransportista` sólo compara la generación de destino/carrito. Si el
   POST está en vuelo y la persona cambia ese grupo a “coordino por mi cuenta”,
   la generación no cambia; cuando llega la respuesta, vuelve a guardar modo
   `carrier` y revela el contacto. El caso 52 espera cada respuesta y por eso no
   cubre la carrera.
2. **El origen de una operación histórica es mutable.** `_operacion` recorre
   `item.product.locality`, que es la localidad actual de la publicación. El
   vendedor puede editarla después de la compra y el transportista pasa a ver
   otro punto de retiro. Nombre y cantidad ya son snapshots; el origen de la
   carga también debe representar el momento de la orden.

Corregí únicamente esos dos puntos:

- Cada cambio de decisión de un grupo —por cuenta propia, quitar, cambiar o una
  nueva selección— invalida cualquier selección anterior en vuelo para ese
  grupo. Una respuesta tardía puede terminar en red, pero no cambiar la decisión
  ni volver a mostrar contacto. No hace falta bloquear toda la pantalla.
- Guardá por ítem de orden el origen oficial usado al confirmar. Debe ser un
  snapshot estructurado y legible aunque después cambie la publicación. Las
  operaciones nuevas lo leen de ahí; los ítems históricos sin snapshot siguen
  legibles sin inventar origen. Migración reversible y sin reinterpretar datos
  anteriores.

### Regresiones exigidas

1. Retené determinísticamente la respuesta de `/logistics/select-carrier`,
   elegí “por cuenta propia” antes de liberarla y comprobá que, al llegar, sigue
   modo propio, no aparece contacto y el checkout envía `self`. La prueba debe
   ponerse roja con `ecfaa4c`; no uses tiempos naturales de red.
2. Creá una orden con transportista y origen A, cambiá después la localidad de
   la publicación a B y comprobá por API y DOM del transportista que la
   operación conserva A. Restaurá la publicación al terminar.
3. Una orden/ítem anterior sin snapshot de origen sigue siendo legible y no se
   presenta falsamente como A ni B. Probá downgrade/upgrade y `alembic check`.

Conservá los casos 51–55; ajustá el inventario sólo si agregás una ruta visual
permanente, no por sumar regresiones dentro de una ruta existente. Corré casos
enfocados, suite completa, build, puertas visuales proporcionales y
`diff --check`. No agregues restricciones, snapshots de contacto, estados
logísticos ni dependencias fuera de estos dos defectos. Entregá commit de
producto e informe separado; ahí vuelve a PM.

**Aceptada por PM:** producto inicial `ecfaa4c`, cierre `a960eef`, informe
`75379a2`. Las regresiones 56–58 discriminan contra la versión anterior; ambos
checkouts congelan origen y la respuesta tardía ya no recupera contacto. Build,
sintaxis Python y `diff --check` independientes verdes. La dev informa 58/58,
56/56 y 40/40. No reabras la Pieza C.

## Tarea activa única — puerta del hito intermedio

No construyas otra función. El segundo hito depende de **demostrar juntas** las
tres capacidades textuales: catálogo, búsquedas y geolocalización funcional.
Hoy existen, pero su evidencia está repartida entre casos distintos.

Dejá un único recorrido de navegador, reproducible desde base limpia, que:

1. use el catálogo real y aplique categoría más provincia/localidad desde la
   interfaz; contraste los resultados visibles con SQL, sin cantidades fijas;
2. abra un producto del resultado, lo agregue, elija destino oficial y muestre
   el grupo/origen que el servidor derivó;
3. muestre al menos un transportista compatible calculado por PostGIS, sin
   contacto previo; lo seleccione, revele contacto y cree la orden;
4. contraste por SQL destino, origen congelado, transportista y modo de traslado;
5. entre como el transportista y muestre esa operación sin datos financieros ni
   contacto del comprador.

El recorrido debe usar sólo datos que deja el **seed idempotente**. No puede
preparar productos, radios, carritos u orígenes por API/SQL antes de abrir el
navegador. Si el seed actual no ofrece un tramo compatible, hacé el cambio
mínimo sobre el transportista demo o una publicación demo existente y probá
seed inicial + repetido sin duplicar. SQL se usa después para contrastar, no
para fabricar el escenario.

Agregá un comando explícito y corto para ejecutar esta puerta sin correr casos
ajenos; debe terminar con un resumen legible para una demostración y rojo ante
cualquier paso omitido. Reutilizá Playwright y helpers existentes, sin nueva
dependencia ni segundo framework. Conservá la suite completa y las puertas ya
aceptadas; build y `diff --check` verdes.

No toques Railway, Mercado Pago, estilos, migraciones, privacidad ni reglas de
compatibilidad salvo que descubras un defecto reproducible —en ese caso frená y
reportalo. Entregá commit de producto y el informe separado. Esta tarea va en
esfuerzo **Alto**, no Extra. Ahí vuelve a PM para decidir si el hito intermedio
queda habilitado para presentar y cobrar.

### Primera revisión PM de `1e8822d`: todavía no aceptada

El alcance es correcto y no hay cambios de producto. Build, sintaxis y
`diff --check` independientes están verdes. La PM no pudo ejecutar la ruta
oficial desde base limpia porque su Docker local está apagado; eso es un límite
del entorno PM, no un defecto atribuido a la entrega. No reabras el recorrido ni
sumes casos.

Corregí sólo estos dos falsos positivos de la puerta:

1. En el paso del catálogo, eliminá `waitForTimeout(1200)`. Sincronizá con una
   señal determinística de la consulta de productos correspondiente a la
   categoría, provincia y localidad elegidas, y recién después compará DOM con
   SQL. Una respuesta más lenta no puede producir una medición prematura.
2. En la vista del transportista, delimitá la comprobación a la tarjeta de
   `Operación #${datos.orden}`. Dentro de esa tarjeta deben estar el producto,
   la cantidad y el recorrido de esa orden; dentro de esa misma tarjeta no
   pueden aparecer importes, datos financieros ni contacto del comprador. La
   presencia de esos textos en otra operación no puede hacer pasar el caso.

Agregá una regresión mínima o una falla forzada que demuestre cada discriminante
sin crear otro framework. Conservá el comando, los seis pasos, el helper SQL y
la suite completa. El informe separado debe citar el commit real `1e8822d` como
entrega inicial —no `cc08aa2`— y el nuevo commit de cierre. Esfuerzo **Alto**.

**Aceptada por PM:** producto inicial `1e8822d`, cierre `3580faa`, informe
`803e8e9`. Las dos fallas forzadas discriminan los falsos positivos anteriores;
build, sintaxis y `diff --check` independientes verdes. La Dev informa puerta
6/6 y suite 58/58. El hito intermedio queda habilitado para presentar y cobrar.

## Tarea activa única — contrato monetario antes de Fase 4

Objetivo: que ningún total que se guarda o decide una orden pase por aritmética
binaria `float`. Cerrá juntos los dos recorridos existentes —checkout común y
transferencia— antes de reconstruir Mercado Pago.

Alcance exacto:

1. Usá `Decimal` desde el precio `NUMERIC` hasta subtotal, total, snapshot y
   persistencia en ambos checkouts. Incluí los totales del carrito sincronizado
   y `transfer-options`, porque alimentan esos recorridos. Multiplicación y suma
   monetarias no pueden volver a `float`.
2. Reutilizá `app/core/montos.py` y los límites `NUMERIC(12,2)` / `(14,2)` ya
   aceptados. Centralizá sólo lo mínimo que evite repetir conversión o
   cuantización. No agregues una segunda política de redondeo.
3. Conservá el contrato JSON que hoy consume el frontend. Si el borde exige un
   número JSON, convertí sólo después de calcular y validar el `Decimal`; no
   uses esa conversión para persistir ni continuar aritmética.
4. No toques distancias, ratings, stock ni otros `float` no monetarios. No
   actives ni refactorices `payments.py`: sus routers siguen desmontados y se
   reconstruyen en la siguiente pieza. No hace falta migración; las columnas ya
   son `Numeric` con precisión correcta.

Regresiones obligatorias, en ambos checkouts:

- tres unidades de un precio con centavos simples (por ejemplo 0,10) conservan
  exactamente 0,30 en opción/carrito, respuesta y SQL;
- 99 unidades de `9.999.999.999,97` conservan exactamente
  `989.999.999.997,03`; esta prueba debe ponerse roja contra el cálculo `float`
  anterior y contrastar snapshots, subtotal y total por API y SQL;
- varios vendedores mantienen total independiente y, si uno excede el máximo,
  el rechazo ocurre antes de escribir cualquier orden y el carrito sigue
  activo, como ya exige la atomicidad aceptada.

No uses comparación redondeada de pantalla como única prueba: el discriminante
de centavos debe observar el valor de API y SQL. Conservá suite, puerta del hito,
build y `diff --check` verdes. Entregá commit de producto e informe separado con
los comandos y una demostración explícita de rojo contra la versión anterior.
Esta pieza va en esfuerzo **Extra** por cruzar los dos caminos que crean órdenes;
no abras Mercado Pago ni cambios visuales.
