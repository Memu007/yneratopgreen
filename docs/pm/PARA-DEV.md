# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Tarea activa — ADMIN-GUIDE-1, corrección de ronda 1

**Decisión sobre `81f40dd`: DEVUELTA, ronda 1 de 2, por un solo hallazgo.**
Todo lo demás queda aceptado y no se vuelve a auditar: la guía, el
inventario, las imágenes, `USER_MANUAL.md` y el tratamiento de
suscripciones.

Evidencia en `REPRODUCCION-ADMIN-GUIDE-1-2026-09-24.md`.

**Lo que reproduje en verde:**

- `guia-admin.mjs` da 26/26 en escritorio y 26/26 en celular.
- Tus dos negativos dan rojo.
- Mis negativos del lado del panel también dan rojo:
  - un botón nuevo «Exportar lista» en «Usuarios» lo detecta el
    inventario;
  - el backend que deja viva la sesión de una cuenta desactivada lo detecta
    el paso 5.
- Build, `node --check`, `py_compile` y diff-check con `cr-at-eol`.

### El hallazgo

**Del lado de la guía, el script sólo controla las citas entre «».** Los
resultados que comprueba el recorrido no están atados a la frase del paso
que los describe.

En una copia de la guía cambié tres afirmaciones sin comillas y el script
dio **26/26 verde**:

1. **Paso 10:** «La publicación deja de verse en el Mercado» pasó a
   «sigue viéndose en el Mercado». Es lo contrario de lo que el recorrido
   comprueba en la línea 523.
2. **Paso 3:** «Muestra veinte cuentas por página» pasó a «cincuenta».
3. **Límites:** «Nadie recibe un aviso de lo que se cambia desde el panel»
   pasó a «La persona recibe un correo con cada cambio que hagas desde el
   panel».

Tu negativo cumple el ejemplo que puse en el criterio 2, que era un botón
inexistente. Lo que no se cumple es el criterio 1: «comprueba lo que la
guía dice que pasa; si la guía y el panel no coinciden, falla y nombra el
paso». Tampoco se cumple la promesa de «Cómo se comprueba esta guía».

### Qué tiene que quedar

1. **Cada resultado que el recorrido comprueba queda atado a su frase en
   el paso.** Si esa frase se cambia o se borra, el script falla y nombra
   el paso.
   - La forma la elegís vos. Sirve, por ejemplo, que el script lleve la
     frase exacta de cada comprobación, o marcas en comentarios HTML.
   - La guía se tiene que seguir leyendo limpia para la clienta, sin marcas
     visibles.
2. **Lo que el script no puede comprobar se declara.**
   - Comprobá lo que se pueda: por ejemplo, las veinte cuentas por página.
   - Lo demás va listado en «Cómo se comprueba esta guía», con de dónde
     sale: una decisión o el código. Por ejemplo, los límites del principio
     o que nadie recibe aviso.
   - Así la promesa de esa sección queda exacta.
3. **Un negativo nuevo en `sabotajes_admin_guide_1.py`** con mi cambio
   exacto del paso 10 («deja de verse» → «sigue viéndose»). Tiene que dar
   rojo y nombrar el paso 10. Sumá otro de tu elección sobre una frase de
   resultado.
4. Corré de nuevo la guía en los dos anchos y los tres negativos. Si no
   cambia el panel, las imágenes no hace falta rehacerlas.

### Tu consulta de teléfonos y suscripciones

**Tenías razón:** mi tarea decía «el teléfono sólo sale con suscripción
activa». La decisión del 05/08 pasó suscripciones y candados por plan a la
Fase 6, y eso no está construido. Verifiqué en `orders.py` y `logistics.py`
que la guía describe lo que pasa hoy.

La contradicción entre las dos reglas la escalé a Emi. **El párrafo queda
como está, con PENDIENTE.** No cambies producto por esto.

### Los cuatro defectos que encontraste

Quedan registrados en la reproducción: tres P2 y el de la cuenta propia,
P3. Van en la pieza siguiente al cierre de esta. **No los corrijas ahora.**

**Fuera de alcance:**

- cambios en `src/` y `backend/`;
- las secciones de comprador y vendedor;
- reescribir la guía más allá de lo necesario para atar las frases.

**Entrega** en `PARA-PM.md`:

- SHA;
- cómo quedó el vínculo entre frase y comprobación;
- la lista de lo que no se comprueba;
- la salida de la guía y de los tres negativos.

No integres ni despliegues.
