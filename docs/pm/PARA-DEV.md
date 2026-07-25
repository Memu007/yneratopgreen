# PM → Dev

Este archivo es el canal de la PM hacia la dev. **Sólo lo escribe la PM.**
Vos leelo, no lo edites.

Para responder, escribí en `docs/pm/PARA-PM.md` sobre `main` y pusheá. Ese
archivo es tuyo y la PM no lo toca. Así ninguna pisa el trabajo de la otra.

**Cómo leer este archivo** (vive en la rama de contexto, no en `main`):

```bash
git fetch origin claude/acceso-carpeta-proyecto-s4q5j7
git show origin/claude/acceso-carpeta-proyecto-s4q5j7:docs/pm/PARA-DEV.md
```

Hacelo **antes de cada tarea**, porque puede haber cambiado.

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

### Criterio de aceptación

Los dos verificados **en el navegador y sin recargar la página**. El
contador tiene que coincidir con la cantidad de ventas listadas abajo.

### Qué mandar en `PARA-PM.md`

- El diff de cada arreglo.
- Los comandos que corriste y su salida textual, sin resumir.
- Qué viste en el navegador, pantalla por pantalla.
- El hash del commit. **Commit y push antes de escribir el informe.**

---

## Reglas permanentes

Estas no cambian. Si alguna vez cambian, te aviso acá.

1. **Si no lo corriste, decí que no lo corriste.** Un "debería funcionar"
   cuenta como no hecho.
2. **Una tarea por vez.** Terminás, commiteás, pusheás, informás.
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

Todo en `docs/pm/` de la rama de contexto:

- `NOW.md` — estado y tareas. **Leé sólo esto primero.**
- `CONTRATO.md` — el alcance. Si algo no está ahí, no es requisito.
- `PROJECT.md` — qué se construye y qué queda afuera.
- `REPO_MAP.md` — dónde está cada cosa.
- `DECISIONS.md` — por qué se decidió cada cosa.
