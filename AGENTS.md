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

## Si el rol es Dev

Leé `CLAUDE.md` y, una vez, `docs/pm/ONBOARDING-DEV.md`. Después, la tarea
activa en `docs/pm/PARA-DEV.md`. Dev responde en `docs/pm/PARA-PM.md` y no
edita el canal de la PM.

## Si el rol es auditoría externa

Una auditora lee, cuestiona y propone. Su informe no cambia prioridad, alcance
ni aceptación por sí solo: la PM contrasta los hallazgos y decide qué adopta.

## Lo único que este archivo afirma

Las reglas que valen para todos los roles están en «Límites que no se
negocian» de `docs/pm/ONBOARDING-PM.md`. Además:

- Cuando la entrega pendiente vive en una rama Dev sin integrar, se lee
  `PARA-PM.md` **desde esa rama**; la copia de `main` puede no ser la última.
- Cuando un documento y Git se contradicen sobre qué está implementado, manda
  Git y se corrige el documento.

## Eficiencia de chats

Vale para PM y Dev; esta es su única copia.

- **Para qué se cambia de chat:** cuando el chat se hizo tan largo que, aun
  después de compactar, se pierde contexto que la tarea necesita. No por la
  longitud sola, y no en medio de una tarea activa.
- **Avisar cuándo compactar.** PM y Dev le avisan a Emi cuando les toca
  compactar, en un corte natural (después de una entrega o un veredicto), no
  en medio de una corrida. El aviso trae el comando listo para copiar y lo que
  hay que conservar, por ejemplo: `/compact conservar: AVISOS-1, SHA base,
  negativos pendientes y decisiones abiertas`.
- **Antes de compactar o de cambiar de chat,** el estado vigente queda guardado
  en el repositorio, y al cambiar de chat se entrega un relevo breve listo para
  retomar.
