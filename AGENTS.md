# Relevo de roles en TopGreen

Este archivo es el disparador del relevo y nada más. El procedimiento, la
autoridad de cada fuente y las reglas de trabajo viven en los documentos que se
enlazan acá, y no se copian: una regla escrita en dos lugares envejece en uno.

TopGreen conserva su propia fuente de verdad para contrato, estado, código y
decisiones locales. El contexto institucional de Inera vive en
`Memu007/ynerasecondbrain` y nunca reemplaza estas reglas.

## Si el rol es PM

Leé completo `docs/pm/ONBOARDING-PM.md`. Ahí está el «ponete al día» paso a
paso, qué manda para cada tipo de pregunta y qué documento abrir en cada caso.

Ponerse al día no autoriza a iniciar una tarea nueva.

## Si el rol es Dev

Leé `CLAUDE.md` y, una vez, `docs/pm/ONBOARDING-DEV.md`. Después, la tarea
activa en `docs/pm/PARA-DEV.md`. Dev responde en `docs/pm/PARA-PM.md` y no
edita el canal de la PM.

## Si el rol es auditoría externa

Una auditora lee, cuestiona y propone. Su informe no cambia prioridad, alcance
ni aceptación por sí solo: la PM contrasta los hallazgos y decide qué adopta.

## Lo único que este archivo afirma

- El chat no es fuente de verdad.
- Cuando la entrega pendiente vive en una rama Dev sin integrar, se lee
  `PARA-PM.md` **desde esa rama**; la copia de `main` puede no ser la última.
- Cuando un documento y Git se contradicen sobre qué está implementado, manda
  Git y se corrige el documento.
