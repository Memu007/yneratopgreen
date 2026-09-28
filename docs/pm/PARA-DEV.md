# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Decisión sobre PUBLICACIONES-PRUEBA-1 — aceptada

Sobre tu informe `c635acb`.

- **Las 16 están cargadas**, cada una con su dirección. Los filtros coinciden
  con la tabla por la API pública, y la ficha de la 1 tiene los seis datos.
- **Lo hiciste dentro de los límites:**
  - la API con la cuenta de prueba;
  - sin base, Railway ni cuenta de administración;
  - el programa fuera del repositorio;
  - frenaste las dos veces que había que frenar.
- **Comprobé que ninguna de las dos contraseñas está en la historia del
  repositorio.** Bien avisado lo de las contraseñas: cambiarlas queda en
  manos de Emi.
- **Lo que PM no puede reproducir:** mi red no llega al sitio. La pantalla la
  mira Emi.
- Las 16 quedan publicadas hasta que Emi pida pausarlas.

`COBRO-CONCURRENTE-1` quedó publicada en `58bb62b`, y viste producción
respondiendo esa revisión. Gracias por anotarlo.

---

## Tarea activa — PAGO-ORDEN-CERRADA-1

**Decisión de Emi (28/09, «dale B»).** Es la última pieza antes de habilitar
Mercado Pago.

**Rama y base:** `claude/dev-role-repo-3l0kp3`, desde el último commit PM.
**Es dinero:** revisión más fuerte y suite completa de PM.

### Problema

1. **Un pago que llega a una orden ya cerrada.** Es la rama
   `orden.stock_reserva == stock.LIBERADA` de `cobro.aplicar`. Hoy pasa esto:
   - la orden vuelve a «pagada»;
   - la intención queda `EN_REVISION`;
   - el stock no se vuelve a tomar, y queda sólo un error en el registro.

   Nadie se entera: el 27/09 se decidió no mandar «Pago aprobado», porque
   sería falso.

   **Y la pantalla miente.** Para `en_revision`, `PaymentResultPage.tsx` y
   `TEXTO_DEL_PAGO` en `UserDashboard.tsx` dicen que hubo más de un pago
   aprobado y que la mercadería se descontó una sola vez. En este caso hubo un
   solo pago, y la mercadería volvió al catálogo.
2. **Dos cobros para una orden** (el 98). La pantalla lo dice bien, pero nadie
   recibe un aviso, y quien vende tiene que devolver uno.
3. **El P2 del reconciliador** que declaraste en `COBRO-CONCURRENTE-1`:
   - `_una` reintenta apagar el link con la fila de la publicación tomada;
   - si Mercado Pago falla dos veces en el mismo barrido, una compra de esa
     publicación frena la API hasta 15 s.

### Qué entra

1. **Los dos motivos de revisión se distinguen**, en lo que devuelve la API y
   en la pantalla de las dos partes: el cobro sobre una orden cerrada, y más
   de un pago. Cada uno con su texto, y los dos verdaderos.
2. **Un aviso a cada parte, una sola vez por orden y por motivo**, con la misma
   mecánica de `AVISOS-DE-PAGO-1`: si escribir el aviso falla, se pierde el
   aviso y no el pago. Los textos:
   - dicen qué pasó y dónde está la plata: en Mercado Pago, en la cuenta de
     quien vende;
   - dicen qué puede hacer cada parte. Quien vende entrega, si todavía tiene
     la mercadería, o devuelve el pago desde Mercado Pago. Quien compra
     coordina con quien vende;
   - no prometen que AgroBoeda devuelva nada, no dicen «Pago aprobado» ni
     «Venta pagada», y no hablan de comisión.
3. **El P2, con tu propuesta aceptada:** `_una` no reintenta apagar el link si
   `sincronizar` ya lo intentó en ese barrido, y el reintento queda para el
   próximo. El reconciliador nunca espera a Mercado Pago con la fila de una
   publicación tomada.
4. **Las reglas vigentes se mantienen:**
   - la orden cerrada con cobro queda como hoy: pagada, en revisión y sin
     volver a tomar stock;
   - el link se apaga con la fila de la orden tomada;
   - `AVISOS-DE-PAGO-1` sigue avisando una vez por orden.

### Casos

- **Cobro después de cerrar,** en tres escenas: cancelada por quien compra,
  rechazada por quien vende, y vencida por el reconciliador.
  - La orden queda como hoy.
  - La pantalla de las dos partes dice el texto nuevo, no el de «más de un
    pago».
  - Sale un aviso a cada parte, una sola vez, aunque el aviso de Mercado Pago
    se repita.
- **Dos cobros:** un aviso a cada parte, una sola vez, y la pantalla sigue
  diciendo «más de un pago».
- **El reconciliador:** con Mercado Pago fallando al apagar dos veces en el
  barrido, y otra compra de la misma publicación a la vez.
  - La salud responde en menos de 2 s y la compra se confirma.
  - El link se apaga en el barrido siguiente.
- El 98, el 212 y del 213 al 219 siguen en verde.

### Negativos

Cada uno da rojo por su motivo y deja el árbol como estaba.

- La orden cerrada avisa «Pago aprobado».
- La pantalla de la orden cerrada vuelve al texto de «más de un pago».
- Un aviso sale dos veces.
- El reconciliador vuelve a reintentar con la fila de la publicación tomada.
- Uno por cada otro camino que toques.

### Fuera de alcance

- Devolver o retener plata: la plataforma no maneja fondos.
- El panel de administración. Si hace falta que vea estos pagos, proponelo.
- Habilitar Mercado Pago, las cuentas de prueba, OAuth real y las
  credenciales.
- Integración y despliegue.

### Aceptación verificable

1. Los casos y los negativos de arriba.
2. Suite completa desde una base recién creada.
3. Build, lint, tipos, `compileall`, `alembic check` y diff-check con
   `cr-at-eol`.
4. a11y, contraste, auditoría móvil y las dos guías, porque cambia texto
   visible. Si las guías nombran los estados del pago, actualizalas.

### Frená y consultá

- Si hace falta una migración: una columna o un estado nuevo en la base.
- Si distinguir los motivos obliga a cambiar el estado en que queda la orden.
- Si un texto tiene que afirmar algo sobre la devolución que no puedas
  comprobar en el producto.

### Entrega en `PARA-PM.md`

- el SHA;
- los casos y los negativos, con su salida;
- la suite y las puertas;
- **los textos nuevos, completos**, para que PM y Emi los lean;
- los riesgos.

No integres ni despliegues.

---

## Después (no empezar todavía)

Lo decide la PM. Lo que depende de Emi puede reordenar la cola:

- la parte B de las publicaciones de prueba (el transportista y el flete),
  cuando ande el correo;
- P3:
  - los errores de la API en «tú»;
  - las guías que no nombran los avisos de pago;
  - los tres de `COBRO-CONCURRENTE-1`;
  - ingresar con una contraseña de más de 72 bytes da 500 (bcrypt);
  - cambiar la propia contraseña desde la pantalla: la API tiene `/auth/change-password` y ninguna pantalla lo usa;
- el correo (#15);
- las cuentas de prueba de Mercado Pago;
- la mejora de la logística en los filtros, por definir;
- Inicio (#5) y misión y visión (#12), cuando lleguen de la clienta.
