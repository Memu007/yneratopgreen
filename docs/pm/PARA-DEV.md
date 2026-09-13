# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en `docs/pm/PARA-PM.md` y no edita este archivo.

Este archivo contiene únicamente la tarea activa y su hilo de devoluciones hasta el cierre. La historia anterior permanece en Git; la instantánea previa a esta poda está en `ab4165fc`.

Antes de empezar:

```bash
git pull origin main
cat docs/pm/PARA-DEV.md
```

---

## 2026-09-13 — AGENTS-CONSOLIDATION-1

`INTEGRATION-CANDIDATE-1` quedó **aceptada** en `c565e6e`, con informe
`ad914a3`. Después de tu informe, `main` avanzó y tu rama remota todavía no
incorporó las decisiones PM nuevas. Primero actualizá referencias y leé este
archivo desde `origin/main`. Si tu copia dice «sin tarea activa», está vieja.

### Problema y prioridad

La consolidación de `AGENTS.md` que ya preparaste vive sólo dentro de la
candidata congelada. `main` conserva el disparador anterior y duplica una
precedencia que contradice la autoridad por tipo de pregunta fijada en
`ONBOARDING-PM.md`. Además, el árbol de Emi agrega una sección de eficiencia de
chats que no se puede perder. Cada rol nuevo lee este archivo antes de llegar al
onboarding, por eso se cierra antes de la pieza de backups.

### Alcance

Prepará una rama/commit documental limpio **desde `origin/main` vigente**, no
desde la composición de producto. El `AGENTS.md` resultante debe:

1. conservar la versión consolidada de `c565e6e`: disparador breve, enlaces a
   `ONBOARDING-PM.md` y `ONBOARDING-DEV.md`, sin duplicar procedimiento ni una
   precedencia única;
2. conservar al final, sin cambiar su sentido, esta regla local de Emi:

   > Avisale a Emi cuando convenga continuar en un chat nuevo para no cargar
   > contexto innecesario, especialmente al cerrar una tarea, cambiar de rol o
   > empezar un bloque que ya no necesita el historial actual. No interrumpas
   > una tarea activa sólo por la longitud del chat. Antes de recomendar el
   > cambio, dejá el estado vigente guardado en el repositorio y entregá un
   > relevo breve listo para retomar.

3. no tocar ningún otro archivo salvo el informe breve en `PARA-PM.md`.

### Fuera de alcance

- No mezclar ni integrar `c565e6e`, no tocar producto, scripts, dependencias,
  Railway, GitHub settings ni ramas de despliegue.
- No empezar `BACKUP-RESTORE-1`, `POST-INTEGRATION-CLEAR-1` ni `CAT-PAGE-1`.
- No hacer push a `main`. Esta entrega es una candidata documental para revisión
  PM; la autorización de integración viene después.

### Criterios de aceptación

1. El commit candidato tiene como base el `origin/main` vigente y el diff total
   fuera de `AGENTS.md` y `docs/pm/PARA-PM.md` está vacío.
2. `AGENTS.md` no contiene el procedimiento numerado viejo ni una lista global
   de precedencia; sí enlaza los dos onboardings y conserva las tres reglas
   mínimas de la consolidación.
3. La sección de eficiencia anterior queda presente y no obliga a cambiar de
   chat por rutina: sólo se recomienda cuando conviene y con estado ya guardado.
4. Todos los enlaces locales del archivo existen y `diff-check` queda limpio.

### Frená y consultá si

- no podés construir la pieza desde `origin/main` sin arrastrar producto de la
  candidata;
- `origin/main` contiene otra edición ya comprometida de `AGENTS.md` que no esté
  descripta en esta tarea;
- el diff incluye cualquier archivo no autorizado.

### Entrega

Entregá rama, base exacta, SHA candidato, diff completo y `diff-check`.
Reemplazá `PARA-PM.md` en esa misma rama con un informe breve. No integres ni
despliegues; frená para revisión PM.
