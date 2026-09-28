# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Decisión sobre COBRO-CONCURRENTE-1 — aceptada en rama

Sobre `599dded` (producto en `5893d19`). Tu informe `94e333d` difiere sólo en
`docs/pm`. Evidencia en `REPRODUCCION-COBRO-CONCURRENTE-1-2026-09-28.md`.

- **Casos:** 213 a 219, 7/7 en base recién creada.
- **Negativos:** tus 15 dan su rojo, cada uno por su motivo. También dan rojo
  los dos míos, que atacan el candado mismo:
  - la espera entre intentos con `time.sleep`: el 213 ve la API sin
    responder;
  - el `NOWAIT` sin savepoint: el 214 ve respuestas 500, y la API sigue viva.
- **Suite completa desde base nueva:** 218/219. Sólo cae el 131, de entorno.
- **Puertas:** verdes.
  - Lint, tipos, build, `compileall`, `pip check`, `node --check`,
    `alembic check` y diff-check.
  - Las dos guías, con 26 y 22 pasos.
- **La recuperación funciona.** En los cinco sabotajes que colgaban la API,
  el caso la destrabó cortando las esperas en la base, sin reiniciarla.

**Lo que cambiaste de más, aceptado:**

- apagar el link antes de aplicar. Comprobé en el código que `hay_cobro`
  equivale a lo que devolvía `aplicar`;
- los cuatro lugares fuera del cobro.

**P2, a la pieza del pago a una orden cerrada:** el borde del reconciliador
que declaraste. Se acepta tu propuesta: `_una` no reintenta apagar el link si
`sincronizar` ya lo intentó en ese barrido.

**P3, sin tarea:**

- ante el 409, «Cancelar» y «Rechazar» muestran el error genérico: mostrar el
  mensaje de la API;
- al subir fotos, si se cumple el tope, los archivos quedan guardados sin su
  fila;
- ningún caso mira el camino «ocupada» del reconciliador.

**Un detalle del informe.** En «Cómo verificarlo» pusiste
`REINICIAR_API="docker restart topgreen-api"` para mi entorno. Mi API es
nativa: usé el reinicio por omisión, y funcionó.

Emi autorizó publicarla el 28/09: la publica PM. Vos no integres ni
despliegues.

---

## Tarea activa — PUBLICACIONES-PRUEBA-1

**Sobre tu freno (28/09): bien frenado, las dos veces.** No rodeaste la red,
y no tocaste la base ni Railway para conseguir una cuenta. Tenés razón en que
producción no tiene cuenta de administración. Lo resuelve Emi en Railway: se
registra en el sitio y se da el rol de administración con una consulta. Vos
no lo hacés. Cuando te pase la contraseña de «AgroBoeda Prueba», seguí desde
el paso 3. Mientras tanto, esperá.

**Decisión de Emi (28/09):** cargás vos las publicaciones de prueba en el
sitio publicado, antes de la pieza del pago a una orden cerrada.

**No es código:** es usar el sitio como lo usa quien vende, con una cuenta de
prueba. No hay rama nueva ni commit de producto. Lo único que subís es el
informe en `PARA-PM.md`.

### Qué hay que hacer

1. **Probá si llegás al sitio publicado.** Lo primero, antes de pedir nada:
   - `https://yneratopgreen-production.up.railway.app`;
   - la API, `https://backend-production-ba84.up.railway.app/api`.

   La red de PM no llega a `railway.app`. Si la tuya tampoco, frená y avisá
   en `PARA-PM.md`. No lo rodees: ni proxy, ni otro camino.
2. **La cuenta la crea Emi** desde el panel: «AgroBoeda Prueba», rol
   «Usuario». Te pasa la contraseña por tu chat.
3. **Cargá la parte A** de `docs/pm/PUBLICACIONES-DE-PRUEBA-2026-09-27.md`:
   las 16 publicaciones, sin fotos. Van con el título y la descripción
   exactos, y con los datos de cada ficha.
4. **Revisá los filtros en el sitio publicado.** Recorré la tabla «Qué tiene
   que mostrar el Mercado» y la ficha de la 1. Anotá lo esperado y lo
   observado, fila por fila. Esa tabla sale de leer el código: lo que no
   coincida es un hallazgo, no algo que se arregla en esta tarea.

### Cómo

- Por la pantalla o por la API pública, con el token de esa cuenta. Nada más:
  - ni la base;
  - ni la consola ni el CLI de Railway;
  - ni una cuenta de administración;
  - ni la siembra;
  - ni migraciones.
- **Una publicación por vez.** Antes de cargar, mirá en «Mis publicaciones» si
  ya existe una con ese título, así no se duplica.
- **Si algo falla a mitad de camino, no reintentes a ciegas.** Fijate qué
  quedó cargado y seguí desde ahí.
- **La contraseña y el token no se escriben en ningún lado:** ni en el
  repositorio, ni en el informe, ni en un script, un log o un commit. Si usás
  un programa, que la lea de una variable de entorno. Y el programa no se sube
  al repositorio: no queremos una herramienta que escriba en producción.
- **No compres, no crees órdenes y no toques publicaciones ni cuentas de
  otros.** Tampoco registres cuentas nuevas: el transportista es la parte B,
  y espera al correo.

### Frená y consultá

- Si no llegás al sitio o la cuenta no entra.
- Si falta en producción una categoría, un subrubro, un tipo o una marca de
  la lista. Esa publicación se saltea y se anota.
- Si el sitio devuelve errores 5xx dos veces seguidas: no se insiste contra
  producción.
- Si algo pide una acción de administración o tocar Railway.

### Fuera de alcance

- La parte B: el transportista y el flete.
- Las fotos.
- Arreglar lo que no coincida: se informa.
- Pausar o eliminar las publicaciones. Se hace cuando termine la revisión de
  la clienta, y lo pide Emi.

### Entrega en `PARA-PM.md`

- Hasta dónde llegaste y desde qué red.
- Las publicaciones creadas, con título y dirección. Las que no se crearon, y
  por qué.
- La tabla de filtros con lo observado, y la ficha de la 1.
- Los hallazgos.
- Una línea que diga que la contraseña y el token no quedaron escritos en
  ningún lado.

---

## Después (no empezar todavía)

Lo decide la PM. Lo que depende de Emi puede reordenar la cola:

- el pago que llega a una orden ya cerrada, con el P2 del reconciliador, antes
  de habilitar Mercado Pago;
- la parte B de las publicaciones de prueba (el transportista y el flete),
  cuando ande el correo;
- P3:
  - los errores de la API en «tú»;
  - las guías que no nombran los avisos de pago;
  - los tres de `COBRO-CONCURRENTE-1`;
- el correo (#15);
- las cuentas de prueba de Mercado Pago;
- la mejora de la logística en los filtros, por definir;
- Inicio (#5) y misión y visión (#12), cuando lleguen de la clienta.
