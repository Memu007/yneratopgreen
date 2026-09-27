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

5. **Agregado del 27/09 — «operaciones» pasa a «publicaciones» en todo
   lo visible.** Es la devolución #3 de la clienta (20/09), que quedó sin
   asignar: se me pasó a mí. Ella lo repitió hoy: «son publicaciones, no son
   operaciones; la operación está hecha cuando se concreta».
   - Cambia sólo el texto que se ve y se lee en voz alta (`aria-label`,
     `sr-only`): el Mercado («N publicaciones», «No hay publicaciones con estos
     filtros.», la paginación), Inicio, la ficha y cualquier otro lugar.
   - «Operación» sigue donde de verdad es una operación concretada, como las
     órdenes. En esos casos, decí en el informe cuáles dejaste y por qué.
   - Los nombres internos (variables, casos, `operation_kind`) no se tocan.
   - Actualizá los casos, las auditorías y las dos guías que lean el texto
     viejo.
   - Negativo: devolver «operaciones» al contador del Mercado da rojo.

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

## Siguiente — REV1-PENDIENTES-1 (empezala apenas entregues PUBLISH-FIELDS-1)

Emi pidió el 27/09 arreglar todo lo que quedó sin hacer de la devolución de
la clienta del 20/09 (`DEVOLUCION-CLIENTA-REVISION-01-2026-09-20.md`; sus
palabras exactas están en el `.docx` de `originales/`). Esto es lo que se
puede hacer sin decisiones pendientes. Entregala por separado de
PUBLISH-FIELDS-1.

1. **Inicio sin publicaciones (#2).** La clienta: «si el inicio es para
   poner en tema, no deberían aparecer publicaciones aleatorias o
   representativas», y no entiende «Mercado activo». Sacá de Inicio la
   sección de publicaciones y su encabezado. Dejá un único acceso claro al
   Mercado.
2. **Los tres ítems de «Los datos definen la operación» (#4).**
   - Sacá «honesta»: «la honestidad debería ser axioma».
   - Precio y modalidad no son excluyentes: «Precio y modalidad», no «o».
   - Nombrá el radio de alcance del transportista, que ella no encontró.
   - Que «responsable y próximo paso» se entienda como lo que la plataforma
     muestra, no como un instructivo.

   El título cambia junto con el #3. Texto corto y en el tono del resto.
3. **El bloque que se repite entre pestañas (#6).** «Toda esta parte que se
   repite en otras pestañas (no en todas) no creo que haga falta.» Identificá
   qué bloque se repite entre Inicio, Quiénes somos y Contacto. Dejalo en un
   solo lugar, el que tenga sentido, y decí en el informe cuál era y dónde
   quedó.
4. **Preguntas frecuentes (#11a).** La clienta prefiere esperar a las
   preguntas reales: la primera «los trata de giles», y no quiere que se
   anticipe el tema de comisiones. **Sacá la sección de preguntas
   frecuentes** de Contacto.
5. **Nada visible afirma «no cobra comisión».** La clienta: «si cobra, pero
   hay que ver de qué manera se explica y sólo si preguntan».
   - Sacá esa afirmación de la vinculación de Mercado Pago del panel
     (`UserDashboard.tsx`) y de la guía de uso.
   - **Se mantiene, porque es regla del proyecto y es verdad:** la plataforma
     no recibe ni guarda el dinero de las ventas, y la transferencia la
     confirma quien vende.
   - Lo que no cambia es el comportamiento: seguimos sin mandar
     `marketplace_fee`.
6. **Sacar «Nuestro equipo» (#13)** de Quiénes somos, «por el momento».
7. **«¿Listo para transformar tu producción?» (#14)** promete de más.
   Reemplazalo por una invitación concreta y sin promesas, por ejemplo
   publicar o buscar en el Mercado agropecuario. Si ese bloque es el que se
   repite (#6), resolvelo una sola vez.

**No toques** (esperan una decisión de Emi con la clienta):

- la idea rectora de Inicio (#5), más allá de lo de arriba;
- AgroMarket como módulo del ecosistema (#10);
- misión y visión (#12);
- retener fondos o cobrar comisión (#11b), que chocan con reglas del
  proyecto;
- la logística en los filtros.

**Aceptación:**

- casos que comprueben cada punto en la pantalla, en escritorio y en celular;
- negativos para Inicio con publicaciones, para la FAQ y para «comisión»
  visible;
- las dos guías coinciden;
- a11y, contraste, móvil y suite completa.

## Después (no empezar todavía)

Lo decide la PM cuando cierre `USER-GUIDE-1`. Lo que depende de Emi (correo,
cuentas de prueba de Mercado Pago) puede reordenar la cola.
