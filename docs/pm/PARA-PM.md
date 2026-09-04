# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## FORM-DIRTY-1 — cerrar con trabajo sin guardar pregunta una sola vez

Hecho. Producto/regresión e informe en commits separados. **No desplegué.**

- Producto/regresión: `88df2f1` — «FORM-DIRTY-1: cerrar con trabajo sin guardar
  pregunta una sola vez»
- La suite pasa a **149 casos**.

Tenías razón en que no fallaban igual. Empiezo por la medición, porque cambió
lo que había que hacer en dos de los cinco.

---

### 1. Los cinco recorridos, medidos contra `b07ebce`

Cada uno: abrir, hacer un cambio real, cerrar por un camino accidental y volver
a abrir para ver qué quedó.

| Recorrido | Cierre accidental | Qué pasaba |
| --- | --- | --- |
| Perfil de transportista | Escape | cerraba **Mi Panel entero** sin avisar; el radio volvía de `777` a `125.5` |
| Alta de publicación | clic en el fondo | cerraba sin avisar, pero el borrador **no se perdía: reaparecía** al volver a abrir |
| Edición de publicación | X | cerraba sin avisar; la descripción volvía a la guardada |
| Checkout | Escape | cerraba sin avisar; la dirección escrita se perdía |
| Calificación | clic en el fondo | cerraba la calificación **y Mi Panel entero**; el comentario se perdía |

Dos que no entraban en el molde:

- **El alta no perdía nada.** Su modal queda montado, así que el borrador
  sobrevive al cierre. El problema es el otro: un borrador que la persona dejó
  vuelve a aparecer solo. Por eso, acá, **descartar además limpia el
  formulario**: sin eso, «descartar cambios» no descartaba nada.
- **La calificación se llevaba el panel puesto.** Su fondo no frenaba el clic,
  que subía al fondo de Mi Panel —que también cierra—. Medido:
  `panel=1 textareas=1` antes del clic, `panel=0 textareas=0` después.

Y una que **medí y no protegí**: el **cambio de pestaña**. Con el perfil sucio,
cambiar a Notificaciones y volver deja el formulario en edición y el radio en
`777`. No se pierde nada, así que preguntar ahí sería una alarma falsa. Lo que
sí sigue preguntando después es cerrar el panel, y el caso 149 lo comprueba en
ese orden. Si igual la querés, es una línea.

### 2. La política, una sola

```
src/formularios/salidaProtegida.tsx    useSalidaProtegida: envuelve un cierre
src/formularios/Pregunta.tsx           la confirmación, en la pila de capas
src/formularios/salidaProtegida.module.css
```

- **Suciedad contra el retrato inicial.** Cada formulario se compara con los
  valores con los que abrió: un valor precargado no es un cambio, y volver un
  campo a su valor original deja el formulario limpio otra vez. Las imágenes y
  archivos entran por nombre —un `File` no se serializa—, y las selecciones,
  casillas y datos logísticos entran como cualquier otro campo.
- **Limpio cierra derecho.** Sin diálogo, por todos los caminos que ya tenía.
- **Sucio pregunta una vez.** La pregunta usa `useCapaModal`, así que es la capa
  de arriba de la pila ya aceptada: foco adentro, trampa de Tab, fondo trabado.
  **No hay `window.confirm`, no hay otro gestor de modales y no hay cinco
  implementaciones**: hay una y la usan los cinco.
- **Escape, X y fondo de la pregunta = seguir editando.** Cierran sólo la
  pregunta, conservan todo y devuelven el foco al control que pidió cerrar.
  Descartar cierra la capa original y el foco vuelve por la pila.
- **Un cierre en curso no se puede pedir dos veces**: mientras la pregunta está
  arriba, un segundo pedido no encola otro cierre.

En el checkout, lo local y lo guardado son cosas distintas:

```
antes de crear las órdenes  -> destino, traslado y medio elegido son trabajo
                               descartable: se protegen
después                     -> las órdenes existen y NO son «cambios sin
                               guardar»: cerrar no pregunta
                               salvo que haya un comprobante elegido y todavía
                               no enviado, que sí es pérdida real
```

Para que eso último sea cierto tuve que corregir una cosa: el comprobante ya
enviado quedaba igual en la lista de archivos elegidos, así que «hay un archivo
sin mandar» habría sido verdad para siempre. Ahora el envío exitoso lo saca. **No
toqué el contrato de ninguna orden creada.**

### 3. Dos agregados que no me pediste

1. **El fondo de la edición y el de la calificación ya no propagan el clic** al
   fondo de Mi Panel. Sin esto, mi propia protección quedaba incoherente: un
   cierre sucio cerraba una capa y uno limpio cerraba dos.
2. **El alta limpia el formulario al descartar**, por lo del borrador que
   reaparecía. Es lo que hace que «descartar» signifique algo ahí.

### 4. Cuatro casos viejos que se rompieron, y por qué

Con la corrección puesta, la suite completa dio **144/149**: los casos **40,
45, 47 y 48** cerraban formularios **con datos escritos** y esperaban que se
cerraran en silencio. Eso es exactamente lo que esta tarea cambió.

```
[FAIL] 40 — waiting for locator('#perfil-nombre') to be detached
[FAIL] 45 — waiting for heading /Datos de env/i to be hidden
[FAIL] 47 — waiting for button «Salir» … intercepts pointer events
[FAIL] 48 — waiting for button «Agregar» … intercepts pointer events
```

Los corregí para que **descarten explícitamente**, que es lo que hacían antes
sin que nadie se lo preguntara, con un ayudante compartido que espera a que
pase una de las dos cosas —la pregunta o el cierre— y no usa pausas fijas. No
cambié lo que cada caso mide.

### 5. Rojo y verde del caso 149

Rojo, con el caso final contra `b07ebce`:

```
[FAIL] 149 … — perfil sucio + X del panel: no preguntó nada antes de cerrar
```

Verde, con trece caminos de cierre recorridos:

```
[PASS] 149 … — perfil limpio/X del panel, perfil sucio/cambio de pestaña (no
  cierra: no pregunta), perfil revertido/X del panel, alta limpia/fondo, alta
  sucia/fondo, edición limpia/Cancelar, edición sucia/Cancelar, calificación
  limpia/fondo, calificación sucia/fondo, checkout limpio/Escape, checkout
  sucio/Escape, checkout con comprobante sin enviar/Escape, checkout con orden
  creada/Finalizar
```

El caso arma lo suyo: un transportista propio —el seed no trae ninguno—, dos
publicaciones y una orden llevada a entregada por las rutas reales, para que
exista «Calificar Vendedor».

### 6. Puertas

```
base limpia + SMOKE_CASOS=149                   1/1
base limpia + suite completa                    148/149   (131 rojo)
npm run build                                   ok
npm run lint                                    ok (--max-warnings 0)
node --check scripts/smoke.mjs                  ok
python -m compileall backend/app                ok
python -m pip check                             ok
npm run a11y -- --todas                         64/64 pantallas, 0 bloqueantes
npm run contraste                               52 mediciones, ninguna por debajo
git -c core.whitespace=cr-at-eol diff --check   limpio
```

El **131** es el de siempre: mi puente sólo traduce `docker exec` y esa receta
necesita `docker run`. En tu máquina esto tiene que dar **149/149**.

### 7. Hashes

```
src/formularios/salidaProtegida.tsx             8c36c669346e122b
src/formularios/Pregunta.tsx                    d436a072ed7ffe27
src/formularios/salidaProtegida.module.css      1c423f7ee18fc634
src/components/AddProduct/AddProductModal.tsx   d46cb13b3aaf03c4
src/components/Checkout/CheckoutModal.tsx       864292720df99bc9
src/components/UserDashboard/UserDashboard.tsx  13ea3710d1d9ba05
scripts/smoke.mjs                               af382696f1c7cd2a
```

(SHA-256 truncado a 16, del árbol en `88df2f1`.)

### 8. Riesgos residuales

1. **La suciedad se compara serializando.** Es suficiente para estos cinco
   formularios —texto, números, listas y casillas— pero no distingue el orden
   de una lista reordenada ni dos archivos con el mismo nombre.
2. **El cambio de pestaña no pregunta**, por lo medido arriba. Si mañana algo
   descarta el formulario al cambiar de pestaña, esto pasa a ser un agujero; el
   caso 149 lo dejaría ver porque comprueba que el valor sigue ahí al volver.
3. **La pregunta no distingue entre formularios.** Dice «tenés cambios sin
   guardar» y nada más. Con un solo formulario abierto por vez alcanza.
4. **El alta sigue conservando su borrador si se guarda y se vuelve a abrir**
   por otros caminos que no son el cierre —por ejemplo publicar y reabrir—; eso
   ya se limpiaba y no lo toqué.
5. El caso 149 deja dos publicaciones, una cuenta de transportista y dos órdenes
   en la base, como el 145, el 147 y el 148 dejan las suyas.

### 9. Frenos

No toqué validaciones de alta ni de edición, fuente de ubicación, estrellas,
persistencia de calificaciones, navegación/History API, Backend, modelos,
migraciones, seed, pagos, BOEDA, estilos generales, Railway ni datos remotos. No
desplegué. `PRE_FIRMA.md` sigue fuera del versionado y lo confirmé antes de
empujar.

Freno acá y te pido revisión.
