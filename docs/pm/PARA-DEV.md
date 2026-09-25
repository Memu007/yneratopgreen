# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Tarea activa — MERCADO-UNICO-1

**Rama y base:** `claude/dev-role-repo-3l0kp3`, desde el último commit PM.

**Cambio de prioridad.** Esta tarea reemplaza a `USER-GUIDE-1`, que queda
para después: las guías tienen que mostrar el sitio ya sin la pestaña
Servicios. Si ya empezaste la guía, guardá lo hecho en un commit aparte, sin
entregarlo, y seguí con esta.

`COPY-AGRO-1` quedó **aceptada en rama** (`2b92988`). La evidencia está en
`REPRODUCCION-COPY-AGRO-1-2026-09-25.md`.

### Decisión de Emi

Es el punto #7 de la devolución de la clienta
(`DEVOLUCION-CLIENTA-REVISION-01-2026-09-20.md`), que ella repitió tres
veces: **Servicios no va como pestaña aparte. Queda un solo Mercado.** Los
servicios se encuentran ahí, con el filtro por tipo que ya existe.

### Decisiones PM de experiencia

- **La cabecera** deja de ofrecer «Servicios». Quedan Inicio, Mercado, Quiénes
  somos y Contacto, más las acciones de la sesión.
- **Los enlaces viejos a Servicios** (URL propia, historial, enlaces de Inicio
  y del pie) llevan al Mercado con el filtro de servicios ya puesto. No
  terminan en una pantalla vacía ni en error.
- **Todo lo que hoy lista la página Servicios tiene que poder encontrarse en
  el Mercado**, incluidas las publicaciones de logística si hoy salen ahí.
  Hacé el inventario antes de sacar nada.
- **El contenido propio de la página Servicios** («Qué mirar antes de
  cotizar», «¿Prestás un servicio…?», video, textos): hacé el inventario y
  proponé qué se pierde.
  - Si algo es una advertencia o un límite de responsabilidad, por ejemplo
    que la plataforma no verifica a quien presta el servicio, tiene que
    seguir visible donde se ven los servicios.
  - El resto se saca sin reemplazo.
  - Frená y consultá si creés que algo más merece mudarse.
- **Inicio no se rediseña.** Espera la decisión #5. Sólo se corrigen sus
  enlaces a Servicios.

### Fuera de alcance

- #5 (qué es Inicio), #6 (el bloque repetido), #10 (AgroMarket) y #9
  (atributos por rubro).
- Renombrar en el código lo que internamente se llama «servicio».
- Cambiar cómo se publica un servicio.
- Integración y despliegue.

### Aceptación verificable

1. **Caso nuevo en el smoke:**
   - la cabecera no ofrece Servicios, en escritorio y celular;
   - la URL vieja y los enlaces de Inicio y del pie llevan al Mercado con el
     filtro de servicios, y muestran los mismos servicios que mostraba la
     página;
   - Atrás y Adelante funcionan.
2. **Negativo:** con la cabecera o el enlace viejo de la base, el caso da
   rojo.
3. **El inventario:** qué se sacó, qué se mudó y dónde quedaron las
   advertencias.
4. **Regresión:** los casos del smoke que recorren Servicios, la navegación y
   el filtro por tipo. Actualizá los que afirmaban la pestaña y justificá la
   lista. También `guia-admin.mjs`.
5. a11y `--todas`, contraste y auditoría móvil. Van a cambiar las
   superficies: si se reduce la cobertura, explicá por qué.
6. Build, lint, tipos y diff-check con `cr-at-eol`.

### Entrega en `PARA-PM.md`

- SHA;
- el inventario;
- la salida del caso y del negativo;
- la regresión;
- lo que consultás, si hay algo.

No integres ni despliegues.

---

## Después — USER-GUIDE-1 (no empezar todavía)

Guía de uso para quien compra, vende y transporta, verificada por script como
`GUIA-PANEL-ADMIN.md`. Se asigna completa cuando cierre `MERCADO-UNICO-1`.
