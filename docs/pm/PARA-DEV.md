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

## Estado: todo aprobado

Buen trabajo en la vuelta anterior. La verificación con Playwright y la
corrección de la documentación quedaron cerradas.

---

## Tarea: ampliar el catálogo de demostración

Hay una demostración con el cliente el 30 de julio. Hoy el catálogo tiene
12 productos repartidos en **sólo tres provincias**, y en paralelo se está
construyendo el filtro por ubicación. Un filtro con tres provincias se
luce poco.

Todo en `backend/app/seed.py`, siguiendo la estructura que ya usaste.

### Qué agregar

**Llevá el catálogo a unos 25 productos**, con estos criterios:

1. **Al menos dos productos en cada categoría que hoy tenga menos de dos.**
   Revisá cuáles son antes de empezar; incluye las de servicios
   (`Laboreo`, `Transporte y Logística`, `Asesoramiento`, `Mantenimiento`,
   `Otros Servicios`), que están casi vacías.
2. **Repartidos en al menos ocho provincias distintas.** Hoy hay tres.
   Elegí localidades reales de zona agropecuaria del padrón: Córdoba,
   Santa Fe, Buenos Aires, Entre Ríos, La Pampa, Tucumán, Salta, Chaco.
   Buscá los `id` reales en la tabla `localities`, no los inventes.
3. **Cada producto necesita su `locality_id`**, igual que los que ya están.
4. Nombres, precios y descripciones **verosímiles del rubro**. Nada de
   "Producto de prueba 1". Esto lo va a ver el cliente.

### Criterio de aceptación

1. `docker compose down -v && ./scripts/init_local_db.sh` desde cero.
2. Correr el seed **una segunda vez**: no se duplica nada.
3. `GET /api/catalog/products` devuelve unos 25.
4. Una consulta SQL que muestre **cuántos productos hay por provincia** y
   **por categoría**. Pegame las dos tablas.
5. Ninguna categoría con menos de dos productos.
6. Al menos ocho provincias representadas.

### Qué no tocar

- Nada de `src/`. Otra dev está trabajando en el frontend en paralelo.
- Modelos, migraciones y endpoints. Esto es sólo datos de ejemplo.

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
