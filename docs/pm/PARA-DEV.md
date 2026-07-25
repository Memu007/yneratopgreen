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

## Estado: bugs (a) y slug aprobados. (b) y (c) pendientes de verificación

Commit `83c2752`. Buen trabajo, con una corrección de proceso al final.

**Aprobado y cerrado:**

- **Bug (a), contador de ventas.** Verifiqué la cadena entera que vos no
  pudiste probar: la API devuelve `sales_count`, se mapea a `salesCount`
  en `AuthContext.tsx:76` y se muestra en `UserDashboard.tsx:1157`. El
  perfil público lee de `/ratings/user/{id}`, que también arreglaste.
  Llega bien a la interfaz por los dos caminos.
- **El slug**, verificado en base.
- El cambio de `package-lock.json` es sólo sincronizar la versión con
  `package.json`. Inofensivo, de hecho corrige una inconsistencia.

**Pendientes:** los bugs (b) y (c) quedaron sin verificar en navegador. El
código se ve correcto y lo revisé, pero sin verlo funcionar no los doy por
cerrados. **Los verificás vos**, es la tarea 1 de abajo.

### Tus dos observaciones adversariales

**La #2 es muy buena.** Tenés razón: en el código no existe el cambio de
rol, el rol se fija en el login. Yo repetí el síntoma tal como me lo
describieron sin comprobarlo contra el código. Tu lectura es la correcta y
tu arreglo apunta al momento real en que cambia el usuario.

**La #1 también sirve**, y confirma algo que ya sabíamos del código
heredado: hay arreglos empezados y nunca terminados. Bien visto.

### Corrección de proceso — importante

El criterio de aceptación pedía los tres verificados **en navegador**. No
lo hiciste, y en vez de frenar, completaste y entregaste.

Esa es la condición de corte número 1: *"un criterio de aceptación no se
cumple"*. Lo correcto era commitear lo hecho, escribirlo y parar ahí.

Que lo declararas con claridad en "Qué NO corrí" está muy bien y no es
poca cosa. Pero declararlo no reemplaza frenar. **Si no podés cumplir un
criterio, no completes la tarea: avisá.**

**Y navegador tenés**: estás trabajando en Windsurf, que trae uno
integrado. Así que de ahora en más, cuando un criterio pida verificación
visual, se hace. No es opcional ni delegable.

---

## Tarea 1: verificar en navegador los bugs (b) y (c)

No cambies código salvo que encuentres algo roto. Esto es mirar que
funcione lo que ya escribiste.

Levantá el entorno y abrí la aplicación en el navegador de Windsurf.

### (b) El carrito al cambiar de usuario

1. Entrá como `cliente@ejemplo.com` / `cliente123`.
2. Agregá dos productos al carrito. Confirmá que el badge muestre 2.
3. Cerrá sesión.
4. Entrá como `vendedor@ejemplo.com` / `vendedor123`.
5. **Sin recargar la página**, mirá el badge del carrito.

Tiene que estar vacío. Si muestra los productos del usuario anterior, tu
arreglo no funcionó y quiero saberlo.

### (c) El respaldo de imágenes

1. En el catálogo, con las imágenes cargando bien, confirmá que se ven
   las fotos normales.
2. Rompé una imagen a propósito: cortá la red y recargá, o cambiá en la
   base la URL de un producto por una inválida.
3. Mirá las tarjetas del catálogo.

Tiene que aparecer el bloque con el nombre del producto sobre el fondo
degradado, **no** el ícono de imagen rota del navegador.

4. Probalo también en modo oscuro. Agregaste estilos específicos para eso
   y nunca los viste funcionar.

### Criterio de aceptación

Los dos comportamientos vistos con tus propios ojos, contados paso por
paso: qué hiciste, qué esperabas y qué viste. Más los errores de consola
del navegador, aunque estén vacíos.

Si algo no funciona: **no lo arregles todavía.** Reportalo y esperá.

---

## Tarea 2: corregir la documentación heredada

Es la que vos misma detectaste el primer día.

`README.md` línea 49 dice "SQL Server 2022 (Developer) | 1433" y
`README_LOCAL_SETUP.md` lo menciona nueve veces. El proyecto corre sobre
PostgreSQL 16 con PostGIS 3.4 desde hace varios commits.

**Qué corregir en los dos archivos:**

- Base de datos: PostgreSQL 16 + PostGIS 3.4.
- Puertos: `5433` en el host, `5432` dentro de Docker.
- El instructivo de instalación, que hoy describe el flujo viejo de SQL
  Server, por el real:

  ```bash
  ./scripts/init_local_db.sh
  npm install && npm run dev
  ```

**No toques `docs/PROJECT_STATUS.md`.** Tiene errores conocidos y se
reescribe entero más adelante.

### Criterio de aceptación

No queda ninguna mención a SQL Server que describa el stack actual.
Comprobalo así, y pegame la salida:

```bash
grep -rin "sql server\|1433" README.md README_LOCAL_SETUP.md
```

Si el instructivo del README menciona comandos que ya no existen,
corregilos también.

Esta tarea no necesita navegador ni levantar nada.

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
