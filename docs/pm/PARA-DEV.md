# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Tarea activa — COPY-AGRO-1

**Rama y base:** `claude/dev-role-repo-3l0kp3`, desde el último commit PM.

### Decisión sobre la entrega anterior

`BRAND-LOSS-1` quedó **aceptada en rama** sobre `43f3b20`. Buen hallazgo, y
corrige mi hipótesis de las horas.

Reproduje:

- el 74 de la base deja las dos marcas en `NULL`;
- el 74 nuevo las deja intactas y borra la copia;
- el 187 da 1/1 sin las marcas de la siembra;
- la suite completa dio 172/191, con las marcas intactas y 74, 187, 190 y
  191 en verde;
- los 18 casos que caen en cadena por el 169 de mi entorno dan 18/18;
- la guía da 26/26 después de la suite, con 51 órdenes con centavos.

Evidencia en `REPRODUCCION-BRAND-LOSS-1-2026-09-25.md`. El P3 de los casos
55 y 58 queda registrado, sin tarea.

### Problema y prioridad

Es el punto #1 de la devolución de la clienta
(`DEVOLUCION-CLIENTA-REVISION-01-2026-09-20.md`): quiere que diga
**«agropecuario»** donde se nombra el sector. Hoy el sitio dice «agro» y
«Mercado agro», por ejemplo:

- en la portada, «Mercado agro · Argentina», dos veces;
- en el pie, «Mercado agro: productos, servicios y logística.»;
- en Servicios, «¿Prestás un servicio para el agro?».

Va antes de las guías de comprador y vendedor, para que sus capturas salgan
con el texto final. No depende de ninguna decisión pendiente.

### Alcance

- Hacé el inventario de todo texto **visible** que nombre el sector con
  «agro»: pantallas, pie, títulos, `<title>`, metadatos de `index.html`,
  avisos y correos que salgan de la plataforma. Reemplazalo por
  «agropecuario» o por la forma que corresponda gramaticalmente, por
  ejemplo «Mercado agropecuario · Argentina» o «un servicio para el sector
  agropecuario».
- **No se tocan:**
  - la marca «AgroBoeda»;
  - «AgroMarket», que espera la decisión #10;
  - los identificadores internos del código;
  - los nombres de categorías que vienen de la taxonomía de la clienta.
- Actualizá las pruebas que afirman el texto viejo.

### Fuera de alcance

- Otros puntos de la devolución: #3 «Operaciones», #13 «Nuestro equipo», #14
  y los que esperan decisión.
- Cambios de diseño o de diagramación. Si un texto más largo no entra en el
  celular, frená y consultá antes de achicar letras o reordenar.

### Aceptación verificable

1. El inventario: cada aparición, con archivo, texto anterior y texto nuevo.
   Incluí las que dejás a propósito y por qué.
2. **Una comprobación automática** que falle si vuelve a aparecer «agro»
   visible sin ser parte de «AgroBoeda» o «AgroMarket». Mostrá su negativo.
3. **Sin desbordes:** auditoría móvil 12/12, a11y `--todas` y contraste. Las
   cabeceras que cambian de largo, miradas a 360 px.
4. **Sin regresiones:** los casos del smoke que verifican textos públicos,
   por ejemplo 156 y 168. Elegilos vos y justificá la lista.
5. Build, lint, tipos y diff-check con `cr-at-eol`.

### Entrega en `PARA-PM.md`

- SHA;
- el inventario;
- la comprobación y su negativo;
- las puertas.

No integres ni despliegues.
