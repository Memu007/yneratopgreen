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

## Estado: suite de smoke tests aprobada

La mejor entrega hasta ahora. Revisado contra el código, no sólo el informe.

**Lo que más valoro:**

- **La demostración de fallo.** `--force-failure=health` devuelve `exit 1`,
  y la suite **no se detiene en el primer error**: deja el mapa completo de
  qué pasó y qué falló. Eso era el criterio que más me importaba. Una
  suite que nunca falla da confianza falsa y es peor que no tener nada.
- **Aplicaste los criterios relacionales** apenas los establecí:
  `API=6, SQL=6`, `API=SQL=13`. La suite sobrevive a que cambien los datos
  de ejemplo.
- **El caso 9 valida en tres capas**: interacción, API y base. Tenías razón
  en no conformarte con el aviso en pantalla.
- Respaldar y restaurar los `.env` con `trap` no te lo pedí y hacía falta.

El mecanismo de fallo forzado es seguro: sólo se activa con un parámetro
explícito y no puede dispararse por accidente.

### Tu observación 4 es un bug real. Verificado

`AddProductModal.tsx:506` hace `await fetch(...)` para subir la imagen y
**nunca chequea `response.ok`**. Si la subida falla —archivo muy grande,
token vencido, error del servidor—, el código sigue de largo y muestra
"publicado exitosamente". El vendedor cree que subió la foto y no subió
nada.

Afecta un requisito contractual: la publicación con imágenes. Es la
primera tarea de abajo.

---

## Tarea 1: que la subida de imágenes falle a la vista

En `AddProductModal.tsx`, alrededor de la línea 506.

Hoy el `fetch` que sube cada imagen no verifica el resultado. Que lo
verifique:

- Si alguna imagen falla, el producto **igual se publica** —ya está creado
  a esa altura— pero el aviso tiene que decir que la publicación salió y
  que **la imagen no se pudo subir**, con el motivo si lo hay.
- Si todas suben bien, el aviso queda como está.

No cambies el orden de las operaciones ni el backend.

### Criterio de aceptación

Provocá una falla real de subida —por ejemplo interceptando esa petición
con Playwright y devolviendo un error, como hiciste con la imagen rota— y
mostrame que:

1. El producto aparece igual en el catálogo.
2. El aviso dice que la imagen falló, no "publicado exitosamente" a secas.
3. Con la subida funcionando, el comportamiento no cambió.

---

## Tarea 2: ampliar el catálogo de demostración

Hay demostración con el cliente el 30 de julio. Hoy son 12 productos en
**tres provincias**, y acabás de construir el filtro por ubicación: con
tres provincias se luce poco.

Todo en `backend/app/seed.py`.

**Llevalo a unos 25 productos:**

1. **Al menos dos por categoría.** Revisá cuáles tienen menos, incluidas
   las de servicios (`Laboreo`, `Transporte y Logística`, `Asesoramiento`,
   `Mantenimiento`, `Otros Servicios`), que están casi vacías.
2. **Al menos ocho provincias distintas.** Buscá `id` reales en la tabla
   `localities`, no los inventes.
3. Cada producto con su `locality_id`.
4. Nombres, precios y descripciones **verosímiles del rubro**. Esto lo va
   a ver el cliente; nada de "Producto de prueba 1".

### Criterio de aceptación

1. Arranque limpio y seed corrido **dos veces**: no se duplica nada.
2. Consulta SQL con el conteo **por provincia** y **por categoría**.
   Pegame las dos tablas.
3. Ninguna categoría con menos de dos productos, ocho provincias o más.
4. **`npm run smoke` sigue en verde.** Ahora que existe la red, usala.

---

## Podés encadenar las dos

Están escritas y aprobadas. Hacé la 1, commit y push, después la 2. Una
sección por tarea en el informe.

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
