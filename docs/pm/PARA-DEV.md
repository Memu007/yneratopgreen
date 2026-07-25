# PM → Dev

Este archivo es el canal de la PM hacia la dev. **Sólo lo escribe la PM.**
Vos leelo, no lo edites.

Para responder, escribí en `docs/pm/PARA-PM.md` y pusheá. Ese archivo es
tuyo y la PM no lo toca. Así ninguna pisa el trabajo de la otra.

**Antes de cada tarea:**

```bash
git pull origin main
cat docs/pm/PARA-DEV.md
```

Hacelo siempre, porque puede haber cambiado.

---

## Estado: tarea 2 aprobada

Verificada en `a5dd60e`. Doce productos, dos por categoría nueva,
contraste SQL coincidente y seed idempotente. Bien hecho.

Dos observaciones, ninguna bloqueante:

1. **El slug `vaquillonas-braford-preñadas` tiene `ñ`.** Es el único no
   ASCII de los diecisiete del seed. Los slugs existen para ir en URLs.
   Hoy no rompe nada porque el frontend no rutea por slug, pero
   corregilo a `vaquillonas-braford-prenadas` y metelo en el próximo
   commit. No hagas un commit sólo para esto.
2. Las imágenes usan `picsum.photos`, que devuelve fotos aleatorias. Eso
   ya venía del seed original, **no lo tocás vos**. Está registrado y lo
   resuelve otra persona.

---

## Tarea actual: dos bugs visibles en la interfaz

Se ven en la demo con el cliente, por eso pasaron a tener prioridad.
Hacelos de a uno.

### a) El contador de ventas del vendedor muestra 0

El perfil del vendedor muestra "0 ventas" mientras "Mis Ventas" lista 2
pedidos. Hay un contador guardado en la tabla `users` que nunca se
actualiza.

**Arreglo:** que ese número se calcule contando las ventas reales en el
momento de pedirlo, en lugar de leer el contador guardado.

**No borres la columna** de la tabla ni escribas una migración. Sólo dejá
de usarla para mostrar el número.

### b) El badge del carrito persiste al cambiar de rol

Cuando el usuario pasa de comprador a vendedor, el badge sigue mostrando
los productos del carrito. Hoy sólo se corrige recargando la página.

**Arreglo:** que el estado del carrito se limpie al cambiar de rol.

### c) Las imágenes rotas se ven como imágenes rotas

`src/components/ProductCard/ProductCard.tsx:29` tiene un `<img>` sin
manejo de error. Las imágenes vienen de un servicio externo; si falla o
no hay conexión, cada tarjeta muestra el ícono de imagen rota del
navegador. En una demo con el cliente eso se lee como producto sin
terminar.

**Arreglo:** que cuando la imagen no cargue, aparezca en su lugar un
bloque limpio con el nombre del producto. Usá el evento `onError` del
`<img>`.

No busques ni agregues fotos nuevas. No cambies las URLs del seed. Es
sólo el respaldo para cuando no cargan.

### Criterio de aceptación

Los tres verificados **en el navegador y sin recargar la página**. El
contador tiene que coincidir con la cantidad de ventas listadas abajo.

Para el punto (c), probalo de verdad: cortá la conexión o cambiá una URL
de imagen por una inválida y confirmá que se ve el bloque de respaldo y
no el ícono roto.

### Qué mandar en `PARA-PM.md`

- El diff de cada arreglo.
- Los comandos que corriste y su salida textual, sin resumir.
- Qué viste en el navegador, pantalla por pantalla.
- El hash del commit. **Commit y push antes de escribir el informe.**

---

## Cómo encadenar tareas sin esperarme

Los tres arreglos de arriba, (a), (b) y (c), ya tienen criterio de
aceptación y los verifiqué antes de dártelos. Podés hacerlos **uno tras
otro sin pedirme permiso entre cada uno**.

El ciclo por arreglo es el mismo de siempre: lo hacés, lo verificás contra
su criterio, **commit y push**, agregás su sección en `PARA-PM.md`, y
seguís con el que sigue.

### Cuándo PARÁS y me esperás

Cortá enseguida, sin arrancar el siguiente, si pasa cualquiera de estas:

1. **Un criterio de aceptación no se cumple** y no sabés por qué.
2. **Aparece un error que no entendés**, o que te obliga a cambiar algo
   que no estaba en la tarea.
3. **Tendrías que tomar una decisión de diseño.** Si te encontrás
   eligiendo entre dos formas de hacer algo, esa elección es mía.
4. **Tendrías que tocar algo de la lista de "qué no tocar".**
5. **Algo que ya funcionaba dejó de funcionar.**
6. **Una tarea contradice a otra** o contradice algo del contexto.

En cualquiera de esos casos: commit de lo que tengas, escribilo en
`PARA-PM.md` y frená. **No improvises para destrabarte.** Un corte
temprano cuesta una vuelta; una tarea mal hecha encima de otra mal hecha
cuesta tres.

### Lo que no se encadena nunca

Tareas que no estén escritas en este archivo. Si terminás todo lo de acá,
**pará y avisame**. No busques trabajo por tu cuenta ni deduzcas cuál
sería el paso siguiente, aunque te parezca evidente.

---

## Reglas permanentes

Estas no cambian. Si alguna vez cambian, te aviso acá.

1. **Si no lo corriste, decí que no lo corriste.** Un "debería funcionar"
   cuenta como no hecho.
2. **Una tarea por vez**, aunque las encadenes. Terminás una entera
   —incluido el commit y su sección del informe— antes de empezar la
   siguiente. Nunca dos abiertas a la vez.
3. **Commit y push apenas termina cada pieza**, antes del informe. Ya se
   perdieron dos días de trabajo por dejarlo sin subir.
4. **Sos adversarial.** Si te pido algo técnicamente mal, decilo antes de
   hacerlo. Si algo no cierra, frená y preguntá.
5. **Cuando la documentación y el código se contradigan, gana el
   código.** Y avisá, porque hay un documento para corregir.

## Qué no tocar

- El esquema de la base, sin aprobación previa.
- Funcionalidad que no se pidió, por obvia que parezca.
- Credenciales reales de Mercado Pago.
- `docs/PROJECT_STATUS.md`. Tiene errores conocidos y se reescribe
  entero más adelante.
- El frontend del filtro de ubicación y la suite de tests. Los hace otra
  dev.

## Dónde está el contexto

Todo en `docs/pm/`, en `main`:

- `NOW.md` — estado y tareas. **Leé sólo esto primero.**
- `CONTRATO.md` — el alcance. Si algo no está ahí, no es requisito.
- `PROJECT.md` — qué se construye y qué queda afuera.
- `REPO_MAP.md` — dónde está cada cosa.
- `DECISIONS.md` — por qué se decidió cada cosa.
