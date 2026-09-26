# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Tarea activa — PUBLISH-FIELDS-1

**Rama y base:** `claude/dev-role-repo-3l0kp3`, desde el último commit PM.

### Decisión sobre USER-GUIDE-1

**Aceptada en rama** sobre `5a197bf`. Evidencia en
`REPRODUCCION-USER-GUIDE-1-2026-09-26.md`.

- **Casos:** 205 y 206 en 2/2.
- **La guía:** coincide en los 22 pasos, en los dos anchos.
- **Negativos:** los siete tuyos dan rojo, y también el mío. Rompí el
  producto sin tocar la guía: aprobar el comprobante dejó de descontar el
  stock, y el paso 17 cayó con «el stock pasó de 50 a 50».
- **Suite completa desde base nueva:** 205/206. Sólo cae el 169, de entorno.
- **Auditorías:** verdes, y las dos guías coinciden.

Muy buen trabajo que la guía te haya corregido cuatro frases antes de llegar
a mí: es exactamente para lo que está.

### Problema y prioridad

La guía encontró dos defectos en el alta. Los dos son de quien vende y los
dos confunden:

1. **«Características del Producto» y «Etiquetas» se pierden al publicar.**
   Quien vende las escribe y desaparecen sin aviso.
2. **La marca no se ve para quien compra**, y «Editar» no la deja cambiar.

### Qué entra

1. **Sacar del formulario de publicar** los bloques «Características del
   Producto» y «Etiquetas», con lo que sólo sirve a ellos. Si la edición
   también los muestra, sacarlos ahí. No se toca la API ni la base.
2. **Marca en la ficha**, junto a modelo y año, con el rótulo «Marca». Sin
   marca, la fila no se dibuja.
3. **Marca en «Editar»** (el panel de quien vende), con la misma lista y las
   mismas reglas que el alta:
   - sólo en categorías con `usa_marca`;
   - «Sin declarar» la quita;
   - cambiar a una categoría sin marca la suelta.
4. **La guía** (`docs/USER_MANUAL.md`) se actualiza: saca los dos defectos
   de «Lo que el programa no comprueba» y comprueba lo nuevo.
   `guia-usuario.mjs` tiene que seguir coincidiendo.

### Fuera de alcance

- Guardar características o etiquetas (sería otro hito, con API y base).
- La marca en la tarjeta: la tarjeta ya está justa a 360 px.
- Teléfono y WhatsApp (PENDIENTE de Emi).
- Integración y despliegue.

### Aceptación verificable

1. **Caso nuevo:**
   - el alta ya no ofrece «Características del Producto» ni «Etiquetas»;
   - la ficha dice «Marca: John Deere» y, sin marca, no dibuja la fila;
   - «Editar» cambia la marca, la quita con «Sin declarar», y la suelta al
     pasar a Insumos.
2. **Negativos:**
   - la ficha sin la marca da rojo;
   - «Editar» sin el selector de marca da rojo.
3. `guia-usuario.mjs` y `guia-admin.mjs` coinciden.
4. Suite completa desde base nueva, a11y, contraste, móvil y las puertas de
   siempre.

### Frená y consultá

- Si sacar los bloques rompe algo que los usa fuera del alta.
- Si la API no acepta la marca en la edición como se espera.

### Entrega en `PARA-PM.md`

- SHA;
- los casos y los negativos;
- las guías;
- las puertas;
- los riesgos.

No integres ni despliegues.

---

## Después (no empezar todavía)

Lo decide la PM cuando cierre `USER-GUIDE-1`. Lo que depende de Emi (correo,
cuentas de prueba de Mercado Pago) puede reordenar la cola.
