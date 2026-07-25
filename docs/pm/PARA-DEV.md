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

## Estado: todo aprobado y cerrado

Commits `83c2752`, `c9aa2ea`, `ff096e0`. Muy buena vuelta.

**Verificación en navegador (b) y (c): aprobada.** Usaste Playwright con
navegador real, interceptaste la request de la imagen para forzar el
`onError` en lugar de esperar que fallara sola, y probaste el modo oscuro.
Eso es más de lo que te pedí y está bien hecho. Los dos bugs quedan
cerrados.

**Documentación heredada: aprobada.** Verifiqué tu criterio y da vacío, sin
menciones a SQL Server, 1433, mssql ni pyodbc. Además corregiste el
instructivo de instalación nativa y el `DATABASE_URL`, que no te lo había
pedido explícitamente y hacía falta.

### Tus dos observaciones adversariales: las dos ciertas

**CORS frágil.** Confirmado, `main.py` sólo cubre 5173 y 5174. Tu
diagnóstico es correcto y es la última tarea de abajo.

**No hay toggle de modo oscuro.** Confirmado y es peor de lo que viste:
busqué `toggleTheme` y `useTheme` en todo el frontend y **no los usa ningún
componente**. El modo oscuro existe entero —contexto y estilos— pero no
hay forma de activarlo desde la interfaz. Es funcionalidad construida e
inalcanzable, y la documentación heredada la declara como terminada.
Queda registrado. **No lo construyas**: no es requisito del contrato y no
gastamos ahí.

---

## Tarea: fijar el puerto del frontend

Tu hallazgo de CORS. Elijo arreglarlo por el lado del puerto y no
ampliando la lista de orígenes permitidos, porque esa lista también se usa
en producción y no la quiero más laxa.

En `package.json`, el script `dev` es `vite` a secas. Si el 5173 está
ocupado, Vite se corre solo a otro puerto y el backend lo rechaza por
CORS, que es exactamente lo que te pasó.

**Cambialo a que falle fuerte en vez de moverse en silencio:**

```json
"dev": "vite --port 5173 --strictPort"
```

Con `--strictPort`, si el 5173 está ocupado Vite corta con un error claro
en lugar de arrancar en un puerto que no funciona.

### Criterio de aceptación

1. `npm run dev` levanta en 5173 y la aplicación funciona.
2. Con el 5173 ocupado por otro proceso, `npm run dev` **falla con un
   mensaje explícito** en vez de arrancar en otro puerto. Pegame la salida
   de ese caso.

No toques `main.py` ni la configuración de CORS.

### Cuando termines

Es la última tarea mecánica que tengo para vos. **Cuando la cierres, pará
y avisá.** Lo que sigue —el filtro de ubicación en el frontend y la suite
de tests— lo hace la otra dev.

---

## Cómo encadenar tareas sin esperarme

Cuando arriba haya **varias tareas o varios puntos**, podés hacerlos
**uno tras otro sin pedirme permiso entre cada uno**. Ya tienen criterio
de aceptación y los verifiqué antes de dártelos.

El ciclo por cada uno es el mismo de siempre: lo hacés, lo verificás
contra su criterio, **commit y push**, agregás su sección en
`PARA-PM.md`, y seguís con el que sigue.

### Empezar nunca necesita permiso

Lo que está escrito en este archivo **ya está aprobado**. No preguntes si
arrancás: arrancá. Si te lo escribí acá, es porque quiero que lo hagas.

Las condiciones de corte de abajo son para **cuando algo sale mal en el
medio**, no para pedir permiso antes de empezar. Frenar tarde cuesta caro,
pero preguntar de más también: cada consulta innecesaria es una vuelta
perdida.

La regla corta: **empezá sin preguntar, frená si algo se rompe.**

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
