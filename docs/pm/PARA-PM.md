# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## RISK-REC-1 — entregada, para tu revisión

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `2a9a72c` |
| SHA candidato (producto + arnés) | `2d18d55` |
| informe | este commit |
| no integrado, no desplegado | `main` quedó en `4c8569d` |

**Sobre la base.** Pediste partir de `4c8569d`. La rama está en `2a9a72c`, que
es `4c8569d` más tu propio commit de documentación: el único delta son cuatro
archivos de `docs/pm/`. El producto que medí es exactamente el de `4c8569d`.

### El resultado, primero

| Riesgo | Veredicto | Qué pasó |
|---|---|---|
| **R1** | **REAL, y peor de lo que decía el riesgo** | Dos compradores pueden quedar los dos con la orden **pagada** por la misma última unidad. Corregido. |
| **R4** | **Falso como defecto vivo** | La pantalla sí ofrece el reenvío hoy. Encontré otra cosa al ejercitarlo, y ésa sí era real: el reenvío que **falla** se mostraba como si hubiera salido. Corregido. |
| **R5** | **REAL** | Confirmado en navegador: el checkout te dice «sacá sus productos del carrito» y no tiene con qué. Corregido. |

---

## R1 — real, y no donde decía el riesgo

El riesgo hablaba de stock visible viejo entre dos sesiones. **Eso está bien
defendido.** Lo que no estaba defendido es el otro lado, y es peor.

### Lo que sí está bien (medido, no leído)

- Dos compradores hacen checkout por transferencia sobre la última unidad: las
  dos órdenes se crean, y eso **es el diseño** —por transferencia no hay
  reserva, el dinero va de cuenta a cuenta y quien decide es el vendedor cuando
  ve la acreditación—. Confirmar no mueve un solo número: queda 1 disponible,
  0 reservada, 0 ventas.
- El vendedor acepta la primera: vende. Acepta la segunda **una después de la
  otra**: HTTP 400, stock 0, ventas 1, y esa orden no queda pagada.
- Una publicación agotada no vuelve a entrar al carrito del servidor: 4xx y el
  carrito queda intacto.
- Por Mercado Pago la reserva ya la mide el caso 90 y sigue verde.
- **La pantalla nunca confirma algo que el Backend rechaza.** Se frena antes,
  con el motivo del servidor.

### Lo que estaba roto

**Dos aceptaciones simultáneas de órdenes distintas por la misma última unidad
ganaban las dos.** Las dos órdenes quedaban `PAID`. Dos personas transfirieron
plata a la cuenta del vendedor por una bolsa que existe una vez.

Medido con el defecto puesto, con dos peticiones en vuelo al mismo tiempo:
**11 de 12 rondas terminaron con dos órdenes pagadas**. Y los números tampoco
quedaban bien: sobre una publicación con 1 unidad, después de las dos
aceptaciones la base decía `stock 0` y `ventas 1`. O sea que además de vender
dos veces, uno de los dos movimientos se perdía: las dos aceptaciones leían el
mismo número y escribían el mismo resultado.

El motivo es de una línea: la aceptación **leía** si alcanzaba y **después**
restaba en Python, en dos pasos. El bloqueo de fila que ya tenía el endpoint
serializa decisiones sobre *esa* orden, y acá hay dos órdenes: son dos filas
distintas y lo que se disputa es el producto. Además ese endpoint es de los que
corren en hilos, así que las dos peticiones avanzan de verdad en paralelo.

### La corrección

Comprobar y descontar pasan a ser **un solo `UPDATE ... WHERE`** que la base
serializa, exactamente la misma forma que ya usaba la reserva de Mercado Pago.
El que pierde la fila encuentra cero y se lleva su 400, sin haber descontado
nada.

**No amplía ningún contrato:** mismo código de estado, mismo texto, mismo
comportamiento cuando las aceptaciones van una después de la otra. Tampoco
cambia la política de stock: lo que se puede vender sigue siendo
`stock − reservado`, se siguen respetando las unidades comprometidas por
compras de Mercado Pago en curso, y los servicios siguen sin ocupar unidades.
Lo único que cambia es que la regla deja de poder perderse en una carrera, y
deja de estar copiada en dos lugares.

### Y el carrito viejo entre dos sesiones

El Backend frenaba bien, pero la persona quedaba trabada: el checkout decía
«quitala del carrito» y **no tenía con qué**. Es la misma pared que R5 y se
arregla en el mismo lugar; está contado ahí abajo.

---

## R4 — falso como defecto vivo, con una cosa real al lado

### Lo que medí

Con una cuenta sin confirmar, el ingreso devuelve 403 con su motivo y **la
pantalla sí ofrece «Reenviame el correo de confirmación»**. Hoy nadie se queda
sin la salida. Como defecto, **lo cierro como falso**.

### Pero la dependencia del texto es real, y te la dejo ejecutable

La pantalla decide si ofrece el reenvío **leyendo cómo está redactado** el
motivo. Lo probé: cambié «Tu cuenta todavía no está confirmada» por «Todavía
falta confirmar tu cuenta» —una corrección editorial de las que este proyecto
hace seguido— y **el botón desaparece**. La cuenta sigue sin poder entrar y la
persona se queda sin salida.

**No lo cambié**, y es a propósito: los dos rechazos que puede dar el ingreso
comparten el 403 —el otro es «usuario inactivo»—, así que separarlos necesita
una señal nueva de la API, y me dijiste que frenara ahí. Las dos salidas que
veo, para que decidas vos:

1. **Una señal estable en el rechazo** (un campo o un encabezado que diga que
   falta confirmar). Es lo correcto y es lo que amplía el contrato de Auth.
2. **Ofrecer el reenvío ante cualquier 403 del ingreso.** No toca la API. El
   costo es que a una cuenta inactiva se le ofrece una acción que no la ayuda
   —aunque tampoco la delata: el reenvío contesta lo mismo para cualquier
   cuenta—.

Mientras tanto, el caso 177 deja la dependencia **vigilada**: lee el motivo de
la API y exige que la pantalla lo muestre y ofrezca la salida. Si alguien
mejora esa redacción, se pone rojo antes de que lo sufra una persona.

### Lo que sí estaba roto: el reenvío que no salió se veía como si hubiera salido

Ejercitando el transporte de correo caído, como pediste, apareció otra cosa.
Con la petición del reenvío cortada, la pantalla mostraba **«No pudimos
conectarnos. Revisá tu conexión y probá de nuevo.» dentro de la caja verde**,
con `role="status"`. O sea: color de éxito, y un lector de pantalla lo anuncia
como un aviso cualquiera. La persona se queda esperando un correo que nadie
mandó.

Corregido: el fallo se dibuja con el color del error y se anuncia con
`role="alert"`. **No delata ninguna cuenta**: lo que distingue no es la
respuesta del servidor —que es idéntica exista o no la cuenta— sino que el
pedido no llegó a contestar.

Lo demás que ejercité queda como estaba, y está bien: el vencimiento a 24 h, el
reenvío que invalida el anterior y la respuesta que no cambia según la cuenta ya
los mide el caso 35; la pantalla de confirmación ofrece pedir un enlace nuevo
ante **cualquier** error, sin leerle el texto a nadie.

---

## R5 — real, medido en navegador

Fabriqué el escenario: dos vendedores en el carrito, uno sin CBU, sin alias y
sin Mercado Pago vinculado.

**Lo que hace bien:** la API lo identifica con nombre y motivo, el paso de pago
lo muestra, y confirmar no escribe nada —cero órdenes—.

**Lo que estaba roto:** la pantalla dice «Sacá sus productos del carrito para
poder continuar» y en **toda la capa del checkout había tres botones**: cerrar,
volver y confirmar. Ninguno saca nada. Y cerrar con datos escritos abre
«Tenés cambios sin guardar / Descartar cambios», así que retirar un grupo
costaba el destino, el traslado y los grupos que sí se podían comprar.

### La corrección

El resumen del pedido —«Resumen del Pedido», la columna que ya lista lo que se
está comprando en los dos pasos— pasa a tener **«Quitar del carrito»** por
línea. No hay pieza nueva: lo único que le faltaba a esa lista era el verbo.

- No se adivina qué sacar leyendo el mensaje del servidor.
- Retirar **vuelve al paso de envío**, porque cambiar el carrito ya invalida las
  decisiones de traslado —son de otro viaje— y ahí es donde se vuelven a tomar.
  Lo escrito no se pierde y nadie pregunta si se descarta.
- Sirve igual para la publicación agotada de R1: es la misma pared.
- Si al retirar el carrito queda vacío, lo dice en vez de dejar un formulario
  que no lleva a ninguna parte.

### Y una tercera cosa, chica, que apareció midiendo esto

**«Continuar al pago» era mudo.** Sin el traslado resuelto, el paso escribía su
motivo en el estado y ninguna rama lo dibujaba: apretar la acción primaria no
hacía nada y no decía nada. Medido: cero avisos antes del clic y cero después.
Ahora contesta. Y cuando el traslado no se pudo resolver porque el carrito tenía
algo agotado, contesta **ese** motivo: decirle «elegí el destino» a quien ya lo
eligió manda a buscar el problema donde no está.

---

## Diff

```
backend/app/api/orders.py                         +11 −12  la aceptación deja de tener su copia de la regla
backend/app/services/stock.py                     +44      `vender`: comprobar y descontar, una sentencia
src/components/Checkout/CheckoutModal.tsx         +61 −2   quitar del resumen, y el paso deja de ser mudo
src/components/Checkout/CheckoutModal.module.css  +27      el botón de la línea y el carrito vacío
src/components/Auth/LoginModal.tsx                +17 −1   el fallo del reenvío se ve como un fallo
scripts/smoke.mjs                                +714      casos 176, 177 y 178
scripts/sabotajes_risk_rec_1.py                  +206      los cinco rojos
```

Sin endpoint nuevo, sin tabla, sin migración, sin dependencia y sin bandera
nueva. `alembic check` lo confirma: **«No new upgrade operations detected»**.

---

## Los cinco rojos, con su texto

`python3 scripts/sabotajes_risk_rec_1.py` aplica cada rotura, corre el caso
focal contra ella y restaura el árbol. Se puede correr entero o de a uno.

| Sabotaje | Caso | Lo que dice el rojo |
|---|---|---|
| el descuento vuelve a ser leer y después escribir | 176 | «ronda 2: dos aceptaciones simultáneas de órdenes distintas por 1 unidad terminaron con 2 ganadoras; dos personas transfirieron por la misma bolsa» |
| el resumen pierde el botón que retira una línea | 178 | «1440x900: el checkout dice que hay que sacar esos productos del carrito y no ofrece ninguna forma de hacerlo sin cerrar y descartar lo escrito» |
| el paso de envío deja de dibujar su motivo | 176 | «apretar «Continuar al pago» no cambió nada en pantalla: seguía habiendo 1 aviso(s) y la persona no sabe si el botón hizo algo» |
| el fallo del reenvío vuelve a la caja verde | 177 | «el reenvío que falló se anuncia como «status» y no como un problema: quien usa un lector de pantalla no se entera de que no salió nada» |
| el Backend mejora la redacción del motivo | 177 | «con la cuenta sin confirmar el ingreso no ofrece pedir un enlace nuevo, y sin eso la persona se queda sin salida» |

El último no es un defecto del producto de hoy: es **R4 hecho ejecutable**, para
que puedas ver con tus manos de qué está colgada esa salida.

**Una honestidad sobre el primero.** La ventana entre leer y escribir es
angosta y no siempre se cruza: con el defecto puesto, medí **11 de 12** rondas
con dos órdenes pagadas. Por eso el caso 176 corre **tres rondas** y exige que
**todas** terminen con un solo ganador. No debilita la afirmación —la afirmación
es la misma—, hace que el rojo aparezca prácticamente seguro. Si te sale verde
con el sabotaje puesto, corrélo de nuevo: lo estarías viendo perder la moneda
tres veces seguidas.

---

## Lo que ejecuté

```
casos focales 176, 177 y 178                    3/3
suite completa desde base limpia (2d18d55)      177/178   ← único rojo el 131
los cinco sabotajes                             FAIL en su caso focal, 5/5
alembic check                                   No new upgrade operations detected
npm run build / lint / tsc --noEmit             verdes
node --check · compileall · pip check           verdes
git -c core.whitespace=cr-at-eol diff --check   sin avisos
npm run a11y -- --todas                         74/74 pantallas, 0 bloqueantes
npm run contraste                               82/82 mediciones, 0 incumplimientos
```

El **131** es el ambiental de siempre: este contenedor no tiene demonio de
Docker ni la imagen `alpine:3`, que el caso necesita. No cambió y no lo toqué.

Y una cosa que me pasó y te la cuento: la primera corrida completa la abandoné
a los 76 casos porque edité el Frontend en el medio. Una suite con el código
cambiando abajo no mide nada, así que no la informo. La que está arriba arrancó
después del último cambio, con el árbol quieto.

---

## Qué miden los casos nuevos

**176 — el stock lo decide el Backend, y el checkout se corrige sin tirarlo.**
Dos órdenes por transferencia sobre la última unidad; las dos aceptaciones una
después de otra; **tres rondas** de aceptaciones simultáneas de órdenes
distintas; el rebote al querer volver a meter lo agotado; y en navegador el
carrito viejo entre dos sesiones: el motivo del servidor a la vista, la acción
primaria que contesta, la línea que se retira sin descartar lo escrito y la
compra que se completa con el resto del carrito.

**177 — la salida del ingreso sin confirmar.** El motivo que se ve es el que
devuelve la API; el reenvío que no salió se ve como un fallo; la respuesta del
reenvío es la misma para una cuenta pendiente, una confirmada y una que no
existe; y un enlace vencido deja la pantalla de confirmación con el formulario
para pedir otro.

**178 — el grupo sin medio de pago, en 1440×900 y en 390×844.** Lo identifica,
no deja confirmar —y no escribe ninguna orden—, se retira desde el resumen sin
descartar lo escrito ni perder el grupo válido, y la compra sigue con el resto.
Las dos medidas están porque el resumen es una columna al costado en escritorio
y una banda debajo en celular: el control tiene que existir en los dos.

---

## Riesgos adyacentes que encontré y **no** toqué

**El mismo patrón está en otros dos lugares, y hoy no falla por casualidad.**
Cancelar o rechazar una orden ya pagada devuelve las unidades con la misma
forma insegura —leer y después escribir en Python—: `orders.py`, en el cambio
de estado y en la cancelación. Los medí: **0 de 6 rondas** perdieron una unidad.

No fallan porque esos dos endpoints son `async` y corren sobre el mismo hilo,
así que ese bloque no se intercala con otra petición. El que arreglé es `def`
normal y corre en hilos: ahí sí se intercalaban. O sea que la protección es un
accidente de cómo está declarada la función, no una decisión. **Deja de valer el
día que alguien agregue un `await` en el medio de ese bloque o convierta el
endpoint en sincrónico**, y el síntoma sería mercadería que desaparece del
catálogo sin que nadie la venda.

Es la misma corrección de una línea que acabo de hacer. No la hice porque es el
flujo de cancelación y no el de compra, y vos dijiste que no tocara políticas de
stock sin consultar. Decime y va.

**El otro, chico:** desde el ingreso, si alguien corrige el correo mal escrito
en el campo y después aprieta «Reenviame el correo», el reenvío va a la
dirección **nueva** —que puede no ser la cuenta pendiente— y la respuesta
genérica dice igual «te enviamos un enlace». No es enumerable ni pierde datos;
es una confusión posible. Registrado, sin tocar.

---

## Lo que no hice

No habilité Mercado Pago real, no usé credenciales reales y no toqué la bandera
productiva. No hice migraciones, ni esquema, ni rediseño de checkout, ni flujo
de autenticación nuevo. No toqué Railway, datos remotos ni `main`. No integré y
**no desplegué**: `main` quedó en `4c8569d`.

Freno acá para tu revisión.
