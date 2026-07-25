# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** Vos leelo, no lo
edites.

Para responder, escribí en `docs/pm/PARA-PM.md` y pusheá. Ese archivo es
tuyo y la PM no lo toca.

**Antes de cada tarea:**

```bash
git pull origin main
cat docs/pm/PARA-DEV.md
```

---

## Estado: filtro por ubicación aprobado e integrado

Rama `dev/filtro-ubicacion-frontend`, ya mergeada a `main`.

Revisado contra el código, no sólo contra el informe. Está bien resuelto:

- El filtrado ocurre **en el servidor** — se envían `province` y
  `locality_id` a la API en lugar de filtrar en el navegador.
- Resolviste bien la trampa del identificador: el **id** de dos
  caracteres para pedir localidades, el **nombre** para filtrar productos.
- El cambio de provincia limpia la localidad seleccionada.
- El estado en la URL con `replaceState`, sin necesidad de router.

### Sobre los números: tenías razón vos

Te pasé Buenos Aires 4, Córdoba 2, Santa Fe 2. **Los reales son 6, 3 y 3.**
Verifiqué el seed y son los tuyos.

El error fue mío: te di los números de cuando había 8 productos, sin
tener en cuenta que se habían agregado 4 más. Que hayas reportado los
reales en lugar de acomodarte a los míos es exactamente lo que espero.

**Y cambio una regla por esto:** de ahora en más los criterios de
aceptación van a ser **relacionales, no absolutos**. En vez de "tiene que
dar 4", va a decir "el resultado de la API tiene que coincidir con el de
la consulta SQL". Los datos de ejemplo cambian y los números fijos
envejecen mal.

---

## Nota de organización

Hasta ahora había dos devs y dos canales. **Queda uno solo**, que es este.
`PARA-DEV-2.md` se eliminó y tu informe anterior quedó en `PARA-PM.md`.

De acá en adelante trabajás directo sobre `main`, sin ramas, salvo que te
indique lo contrario.

---

## Tarea: suite automatizada de smoke tests

Es lo más importante que falta y no es trabajo extra: la fase 5 del
contrato pide "pruebas integrales".

Hoy cada entrega se verifica a mano. Ya se arreglaron cosas que **nunca
habían funcionado** en este código, y no hay nada que detecte si algo se
rompe de nuevo.

### Qué construir

Un comando que corra los casos de punta a punta contra un arranque
limpio y **devuelva código distinto de cero si alguno falla**.

Casos mínimos:

1. Salud del servicio.
2. Registro de usuario.
3. Ingreso y obtención del token.
4. Catálogo con filtros de categoría y precio.
5. **Catálogo con filtro de provincia y de localidad.**
6. Detalle de producto.
7. Agregar al carrito y verlo.
8. Crear una orden desde el carrito, sin pagar.
9. Publicar un producto como vendedor, desde la interfaz.
10. Ver "mis compras" y "mis ventas".
11. Administración: usuarios, productos y órdenes.

### Decisiones que tomo yo, para que no las tengas que tomar vos

- **Elegí vos la herramienta.** Ya usaste Playwright y funcionó bien; si
  te sirve, seguí con eso.
- **No quiero cobertura ni un framework elaborado.** Quiero una red que
  avise cuando algo se rompe.
- **Los casos de API pueden ser peticiones directas.** Sólo el caso 9
  necesita navegador de verdad.
- **Los criterios son relacionales.** Nada de esperar "4 productos":
  compará el resultado de la API contra la consulta SQL equivalente. Así
  la suite sobrevive a que cambien los datos de ejemplo.

### Criterio de aceptación

1. Un solo comando corre todo contra `docker compose down -v` y arranque
   limpio.
2. Los once casos pasan, y la salida dice cuál pasó y cuál no.
3. **Rompé algo a propósito** —por ejemplo, cambiá un endpoint para que
   devuelva error— y mostrame que la suite falla con código distinto de
   cero y señala el caso. Esto es tan importante como que pase en verde:
   una suite que nunca falla no sirve de nada.
4. Documentá en el `README.md` cómo se corre, en dos líneas.

---

## Reglas permanentes

1. **Si no lo corriste, decí que no lo corriste.** Un "debería funcionar"
   cuenta como no hecho. Declararlo nunca es problema; ocultarlo sí.
2. **Una tarea por vez.** Terminás, commiteás, pusheás, informás.
3. **Commit y push apenas termina cada pieza**, antes del informe. Ya se
   perdió trabajo por dejarlo sin subir.
4. **Sos adversarial.** Si te pido algo técnicamente mal, decilo antes de
   hacerlo. Si algo no cierra, frená y preguntá.
5. **Cuando la documentación y el código se contradigan, gana el código.**
   Y avisá, porque hay un documento para corregir.

## Empezar no necesita permiso

Lo que está escrito acá ya está aprobado. No preguntes si arrancás:
arrancá. Las condiciones de corte son para cuando algo sale mal en el
medio, no para pedir permiso antes de empezar.

## Cuándo parás y me esperás

1. Un criterio de aceptación no se cumple y no sabés por qué.
2. Aparece un error que no entendés o que te obliga a cambiar algo fuera
   de la tarea.
3. Tendrías que tomar una decisión de diseño.
4. Tendrías que tocar algo de la lista de abajo.
5. Algo que ya funcionaba dejó de funcionar.

En cualquiera de esos casos: commit de lo hecho, escribilo y frená. **No
improvises para destrabarte.**

## Qué no tocar

- El esquema de la base, sin aprobación previa.
- Funcionalidad que no se pidió, por obvia que parezca. El contrato es a
  precio cerrado.
- Credenciales reales de Mercado Pago.
- `docs/PROJECT_STATUS.md`. Tiene ocho afirmaciones verificadas como
  falsas y se reescribe entero más adelante.

## Dónde está el contexto

Todo en `docs/pm/`:

- `NOW.md` — estado y tareas. **Leé sólo esto primero.**
- `CONTRATO.md` — el alcance. Si algo no está ahí, no es requisito.
- `PROJECT.md` — qué se construye y qué queda afuera.
- `REPO_MAP.md` — dónde está cada cosa.
- `DECISIONS.md` — por qué se decidió cada cosa.
