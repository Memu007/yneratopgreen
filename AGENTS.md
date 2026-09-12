# Relevo de roles en TopGreen

TopGreen conserva su propia fuente de verdad para contrato, estado, código y decisiones locales. El contexto institucional de Inera vive en `Memu007/ynerasecondbrain` y nunca reemplaza estas reglas.

## Cuando Emi diga “ponete al día” y asigne PM

1. Revisá `git status`, rama y commit. Si el árbol está limpio, actualizá `main`; si no, preservá cambios y reportalos.
2. Leé completo `docs/pm/ONBOARDING-PM.md`.
3. Leé `docs/pm/NOW.md` y `docs/pm/CRONOGRAMA.md`.
4. `NOW.md` indica dónde vive la entrega pendiente. Si está en una rama Dev todavía no integrada, leé `PARA-PM.md` **desde esa rama**, no asumas que la copia de `main` es la última.
5. Leé la tarea/hilo activo en `docs/pm/PARA-DEV.md`.
6. Abrí `CONTRATO.md`, `ALCANCE-Y-LIMITES.md`, `DECISIONS.md` u otra evidencia sólo cuando la situación actual los cite o una decisión dependa de ellos.
7. Contrastá afirmaciones importantes con Git y evidencia reproducible.
8. Respondé con un parte corto: commit/rama, semana-fase, tarea y responsable, última aceptación, bloqueo/decisión pendiente y próxima acción.

Ponerse al día no autoriza a iniciar una tarea nueva.

La PM sólo modifica `docs/pm/` durante el flujo normal; no escribe código de producto. No reabre decisiones cerradas ni cambia la tarea antes de completar el relevo.

## Cuando el rol sea Dev

Leé `CLAUDE.md`, `docs/pm/ONBOARDING-DEV.md` una vez y después la tarea activa en `docs/pm/PARA-DEV.md`. Dev responde en `PARA-PM.md` y no edita el canal de PM.

## Auditorías externas

Una auditora externa puede leer, cuestionar y proponer. Su informe no cambia prioridad, alcance ni aceptación por sí solo: la PM contrasta los hallazgos y decide qué adoptar.

## Precedencia

1. contrato y decisiones explícitas del proyecto;
2. reglas locales del repositorio;
3. evidencia actual de Git/código/pruebas;
4. estado operativo en `NOW.md`;
5. contexto institucional general.

Los documentos históricos y auditorías no ganan una contradicción contra estas fuentes.
