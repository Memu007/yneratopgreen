# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Tarea activa — ADMIN-PANEL-DEFECTS-1

**Rama y base:** `claude/dev-role-repo-3l0kp3`, desde el último commit PM de
esta tarea.

### Decisión sobre la entrega anterior

`ADMIN-GUIDE-1` quedó **aceptada en rama** en la ronda 2, sobre `091e846`.

- La guía da 26/26 en escritorio y 26/26 en celular.
- Mis tres afirmaciones falsas de la ronda 1 dan rojo en los pasos 3, 5 y 10.
- Mi negativo nuevo del paso 11 da rojo.
- Tus siete negativos dan rojo.

Se acepta el límite declarado: una frase agregada después no se controla
hasta que alguien la ate o la declare. Evidencia en
`REPRODUCCION-ADMIN-GUIDE-1-2026-09-24.md`.

**Anotado para esta tarea (P3 del arnés):** en una base recién creada no
existe `backend/outbox` hasta el primer correo. Por eso los pasos 5 y 10
dieron rojo aunque `EMAIL_TRANSPORT=outbox` estaba configurado. Tuve que
crear la carpeta a mano.

### Problema y prioridad

Son los cinco defectos que encontraste al escribir la guía. Van juntos
porque son del mismo panel y la guía los vigila.

1. **P1: quien vende puede volver a activar una publicación que el
   administrador eliminó.** Confirmé en `products.py` (`update_product`) que
   la edición sólo mira que la publicación sea suya. «Eliminada» es la
   herramienta de moderación del panel, y así se deshace en silencio.
2. **P2: «Agotada» no hace lo que dice su aviso.** El aviso dice «Sigue
   visible pero no se puede comprar.», pero la publicación sale del Mercado y
   su enlace no abre.
3. **P2: quien vende ve «Activo» una publicación «Agotada»** con stock.
4. **P2: el detalle de la orden en el panel sale incompleto.** Faltan los
   artículos, el correo y la dirección de quien compra, y el subtotal y el
   envío aparecen en $ 0.
5. **P3: desactivar la cuenta propia muestra un error genérico** en vez del
   motivo que manda el servidor.

### Decisiones PM

- **Eliminada:** para quien vende es definitiva. Ninguna vía de quien vende
  (API o pantalla) la cambia de estado ni la edita. Sólo el administrador la
  saca de «Eliminada». Pausar y volver a activar una publicación propia sigue
  igual que hoy.
- **Agotada:** se mantiene lo que hace hoy: sale del Mercado y su enlace no
  abre, igual que pausada.
  - Se corrige el aviso del panel para que diga eso.
  - Quien vende la ve como «Agotado», no como «Activo».
  - No se construye «visible pero no comprable».

### Alcance

- **Los cinco defectos, con las decisiones de arriba.**
  - Para el 1, hacé primero un inventario de **todos** los caminos que
    pueden cambiar el estado o los datos de una publicación: endpoints,
    carrito, órdenes, tareas. Cerralos todos, no sólo el `PATCH`.
- **La guía y el script:**
  - sacá las advertencias de los defectos que se corrigen, y atá la frase
    nueva de cada paso a su comprobación;
  - rehacé con `--capturas` sólo las imágenes que cambian;
  - el script no debe depender de que `backend/outbox` exista de antes.

### Fuera de alcance

- Avisos a quien vende, motivo de la eliminación o registro de moderación.
- Suscripciones y teléfono: siguen PENDIENTE de Emi.
- Las secciones de comprador y vendedor del manual.
- Integración y despliegue.

### Aceptación verificable

1. **Caso nuevo en el smoke para el P1:**
   - con la sesión de quien vende, cada camino del inventario falla sobre
     una publicación eliminada por el administrador, y la base no cambia;
   - la publicación sigue fuera del Mercado;
   - el administrador sí la puede volver a «Activa»;
   - quien vende sigue pausando y activando las publicaciones suyas no
     eliminadas.
2. **Negativo del P1:** con el endpoint de la base, el caso nuevo da rojo y
   nombra el camino abierto.
3. **Los defectos 2 a 5 se ven corregidos en la guía.**
   - `guia-admin.mjs` da 26/26 en escritorio y celular, sin las advertencias.
   - Cada comprobación de esos pasos falla si se vuelve al código de la base.
     Mostralo con un negativo por lo menos.
4. **Sin regresiones:** los casos del smoke de publicaciones, estados,
   panel admin, carrito y órdenes que toques o que dependan de lo que tocás.
   Elegilos vos y justificá la lista.
5. **Si cambia la interfaz:** a11y `--todas`, contraste y auditoría móvil.
   Además build, lint, tipos, `compileall` y diff-check con `cr-at-eol`.

### Frená y consultá

- Si cerrar el P1 obliga a cambiar lo que quien vende puede hacer con
  publicaciones pausadas o agotadas.
- Si hace falta migrar datos.
- Si aparece otra vía, fuera del panel, que haga lo mismo que el defecto 1.

### Entrega en `PARA-PM.md`

- SHA;
- el inventario de caminos del P1 y cómo quedó cerrado cada uno;
- salida del caso nuevo y de los negativos;
- lista de regresión con su resultado;
- riesgos.

No integres ni despliegues.
