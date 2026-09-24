# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Tarea activa — ADMIN-GUIDE-1

**Decisión sobre la entrega anterior.** `LOCALITY-LABEL-DISPLAY-1` quedó
**aceptada en rama** sobre `0830ac2`.

- Caso 189 en 1/1 y los cuatro negativos en rojo. El 189 dio 1/1 otra vez
  después de restaurar.
- 62/62 relacionados, a11y 76/76, contraste 84/84 y auditoría 12/12.
- Se acepta el ajuste del 137. Siguen prohibidas las coordenadas, la clave
  `department` y los datos de contacto, así que la privacidad no se
  debilita.

Evidencia en `REPRODUCCION-LOCALITY-LABEL-DISPLAY-1-2026-09-24.md`.

**Prioridad y problema.** El contrato incluye la **capacitación básica del
panel de administración** (Fase 5, `MATRIZ.md` §5: ❌). Es un entregable que
no depende de Emi ni de la clienta. El material existente,
`docs/USER_MANUAL.md` §«Rol: Administrador», no describe el panel real. Por
ejemplo:

- nombra un botón de tema oscuro que no existe;
- menciona una sincronización de pago por endpoint;
- no menciona secciones que el panel sí tiene.

La clienta va a administrar la plataforma con ese material.

**Alcance.**

- Una guía del panel de administración para la clienta, en español llano, sin
  jerga técnica. Cubre cada sección real del panel: qué muestra, qué se puede
  hacer y qué no, y qué pasa después de cada acción. Por ejemplo, qué ve el
  vendedor cuando se despublica una publicación.
- Incluí los límites que la administradora tiene que conocer:
  - la plataforma no cobra ni retiene dinero de terceros;
  - el teléfono de contacto sólo sale con suscripción activa;
  - la transferencia la valida el vendedor, no el admin;
  - cualquier otro límite que el panel haga cumplir.
- Capturas generadas por script sobre la base demo, en escritorio y celular,
  así se pueden regenerar cuando el panel cambie.
- Reemplazá la sección de administración de `USER_MANUAL.md` por un enlace a
  la guía, sin dejar afirmaciones falsas sobre el panel.
- Proponé la ruta del archivo; se entrega junto con el repositorio.

**Fuera de alcance.**

- Cambios de producto en el panel. Si encontrás un defecto, anotalo con
  reproducción; no lo corrijas.
- Las secciones de comprador y vendedor del manual (van en otra pieza).
- Documentación de despliegue o Railway.
- Video o capacitación en vivo, integración y despliegue.

**Aceptación verificable.**

1. Cada acción que la guía describe tiene un paso reproducible. Un script
   recorre la guía en el navegador sobre la base demo: hace cada acción y
   comprueba lo que la guía dice que pasa. Si la guía y el panel no
   coinciden, falla y nombra el paso.
2. Negativo: una afirmación falsa agregada a propósito, por ejemplo un botón
   inexistente, hace fallar el script.
3. Inventario: lista de secciones y acciones del panel (del código) contra lo
   que cubre la guía, sin huecos no explicados.
4. Sin credenciales reales. Las cuentas demo, si aparecen, van marcadas como
   públicas y a rotar antes de producción. Sin términos comerciales, montos
   ni porcentajes.
5. Sin cambios en `src/` ni en `backend/`. Build y diff-check verdes.

**Frená y consultá** si documentar el panel real exige afirmar algo de
producto que no esté decidido: por ejemplo, qué pasa con comisiones o con
suscripciones. En ese caso marcalo `PENDIENTE` y seguí con el resto.

**Leé antes:**

- `src/components/AdminPanel/`;
- `REPRODUCCION-ADMIN-*` en `docs/pm/`;
- `ALCANCE-Y-LIMITES.md`;
- `docs/USER_MANUAL.md`.

**Entrega** en `PARA-PM.md`:

- SHA, ruta de la guía, inventario y salida del script;
- negativo, defectos encontrados sin corregir y riesgos.

No integres ni despliegues.
