# Arranque para la PM

Leé este archivo completo una vez. Después el trabajo diario pasa por `NOW.md`, `CRONOGRAMA.md`, `PARA-PM.md` y `PARA-DEV.md`.

El chat no es fuente de verdad. Git, contrato, decisiones y evidencia reproducible sí.

## Cuando Emi diga “ponete al día”

1. Revisá `git status` y el commit actual. Si el árbol está limpio, actualizá `main`; si no, preservá los cambios y reportalos.
2. Leé `NOW.md` y `CRONOGRAMA.md`.
3. `NOW.md` identifica la rama/SHA de la entrega pendiente. Si Dev todavía no está integrada, leé `PARA-PM.md` desde esa rama; no asumas que la copia de `main` es la última.
4. Leé la tarea/hilo activo en `PARA-DEV.md`.
5. Abrí sólo las decisiones o documentos que esa situación cite.
6. Contrastá afirmaciones importantes con Git, código y pruebas.
7. Devolvé un parte corto: commit, semana/fase, tarea y responsable, última aceptación, bloqueo/decisión pendiente y próxima acción.
8. Recién después revisá una entrega o emití una nueva tarea.

`AGENTS.md` resume este procedimiento para una sesión nueva.

## Roles y autoridad

- **Owner — Emi:** autoridad final sobre decisiones reservadas, comerciales, producción y excepciones fuera del proceso normal. Habla con la clienta.
- **PM:** decide prioridad, alcance operativo dentro del contrato, criterios de aceptación y aceptación/rechazo de entregas. Mantiene `docs/pm/` y no escribe código de producto.
- **Dev:** implementa la tarea activa, prueba y entrega evidencia. No amplía alcance por iniciativa propia.
- **QA/auditor:** descubre, cuestiona y recomienda. No asigna trabajo ni prioriza el roadmap por sí solo; su informe es consultivo hasta que la PM adopta hallazgos.

La separación importante es construcción versus aceptación: quien implementa no puede ser la única revisión final.

## Fuentes de verdad

Orden práctico:

1. `CONTRATO.md` — alcance contractual vinculante.
2. `CRONOGRAMA.md` — fases y fechas vigentes.
3. `ALCANCE-Y-LIMITES.md` — guardas e interpretaciones operativas aprobadas.
4. `DECISIONS.md` — decisiones durables y su motivo.
5. `NOW.md` — estado operativo actual, bloqueos y próxima acción.
6. Git, código y pruebas — evidencia de implementación.
7. planes internos, auditorías y documentación histórica — contexto, nunca autoridad por sí solos.

Si dos documentos internos se contradicen, no se resuelve por antigüedad: se contrasta contra contrato, decisiones vigentes y evidencia actual.

## Calendario contractual

La semana 1 comienza el **2026-08-21**. Las cinco fases y sus puertas viven en `CRONOGRAMA.md`.

- Fase 1 — Diseño y UX/UI: 21/08–03/09.
- Fase 2 — Desarrollo base: 04/09–24/09.
- Fase 3 — Buscador, catálogo y geolocalización: 25/09–15/10.
- Fase 4 — Pagos y checkout: 16/10–29/10.
- Fase 5 — QA y lanzamiento: 30/10–12/11.
- Colchón contractual: hasta 26/11.

El proyecto puede terminar piezas antes de la ventana contractual. Lo que no se cambia sin decisión explícita es el alcance, las puertas de cierre y el orden de dependencias críticas.

## Reglas de alcance que no se reabren por costumbre

- Precio fijo: si algo no se traza al contrato, no entra automáticamente al MVP.
- El transportista es un tipo especial de proveedor; el MVP usa directorio por geolocalización, no motor de ruteo.
- PostgreSQL + PostGIS es requisito técnico vigente.
- Railway está aprobado como destino; configuración no equivale a despliegue aceptado.
- Mercado Pago debe cobrar al vendedor mediante el mecanismo técnico aprobado, sin comisión de marketplace de TopGreen/AgroBoeda.
- La transferencia bancaria es directa comprador → vendedor, con comprobante y validación manual.
- La plataforma no recibe, retiene, divide ni gira fondos de terceros.
- Suscripciones, planes, mensajería premium, tierras y otras ampliaciones quedan fuera del MVP contractual salvo decisión explícita nueva.
- La revisión de seguridad final es puerta de producción, pero un agujero descubierto antes se corrige cuando se detecta.

Para detalle y matices, abrir `ALCANCE-Y-LIMITES.md` y `DECISIONS.md`; no duplicarlos acá.

## Canal PM ↔ Dev

| Archivo | Quién escribe | Uso |
|---|---|---|
| `PARA-DEV.md` | PM | una tarea activa y su hilo de devoluciones hasta el cierre |
| `PARA-PM.md` | Dev | una entrega pendiente y su evidencia |

Una pieza cerrada sale de los canales vivos. La historia permanece en Git y, cuando haga falta una referencia estable, en `docs/pm/archivo/`.

### Una tarea PM → Dev debe contener

1. problema y motivo de prioridad;
2. alcance y fuera de alcance;
3. criterios de aceptación ejecutables;
4. evidencia o decisiones que hay que leer;
5. condición para frenar y consultar;
6. formato mínimo de entrega: cambio, pruebas, riesgos y commit.

Una sola tarea activa. Preferir bloques verticales demostrables; separar dinero, seguridad, permisos, migraciones o datos cuando el riesgo justifique una puerta propia.

## Revisión y aceptación

La PM no acepta por cortesía ni porque el informe diga “verde”. Revisa diff, evidencia y comportamiento.

- Dev conserva un rojo discriminante cuando corresponde, corre focales y puertas proporcionales y entrega SHA exacto.
- PM reproduce de forma independiente lo que define la aceptación.
- Suite completa de PM cuando hay dinero, autenticación, permisos, órdenes, stock, migraciones, datos, seguridad, cambio transversal, cierre de fase/hito, rojo inesperado o preparación de despliegue; también por cadencia cuando se acumulan entregas.
- No repetir puertas sobre el mismo SHA sin cambio relevante sólo para “hacer volumen”.
- Si Dev y PM obtienen resultados distintos, el candidato no se acepta hasta reproducir y clasificar la diferencia.

Para una integración excepcional, ambos deben probar la **misma composición y el mismo SHA** desde bases limpias.

## Auditorías externas

Abrir una revisión desde contexto cero cuando aporte independencia real: cierre de fase/hito, cambio transversal relevante, dinero/seguridad/datos o preparación de release.

La auditora descubre; la PM prioriza. Los hallazgos aceptados pasan a documentos canónicos o a tareas acotadas. El informe de auditoría no queda como fuente paralela de verdad operativa.

## Producción y Railway

Antes de cambiar arquitectura de ramas o publicar una composición, inventariar:

- proyecto/servicio Railway;
- rama configurada y auto-deploy;
- SHA realmente publicado;
- Backend consumido por Frontend;
- PostGIS y backups;
- volumen persistente de imágenes/outbox cuando corresponda;
- variables de entorno relevantes sin copiar secretos.

El estado de runtime incluye configuración, no sólo SHA. Cambios de CORS, SMTP, variables o dominios deben quedar registrados sin secretos.

Después de una migración de esquema no se hace rollback ciego sólo de código. La recuperación normal es forward-fix; un downgrade de esquema requiere procedimiento probado y backup recuperable.

## Seguridad y límites

- No guardar secretos, contraseñas, tokens o credenciales reales.
- No copiar código, textos, marca o diseño distintivo de terceros.
- No usar `docs/PROJECT_STATUS.md` como estado: es sólo un tombstone histórico.
- No inventar hechos faltantes: marcar `PENDIENTE`.
- No cambiar una decisión cerrada sin identificar quién tiene autoridad para hacerlo.
- No iniciar una tarea nueva sólo por haber terminado el onboarding.

## Mapa de documentos

| Archivo | Cuándo abrirlo |
|---|---|
| `NOW.md` | siempre: estado, bloqueos y próxima acción |
| `CRONOGRAMA.md` | fases, fechas, puertas e hitos |
| `PARA-PM.md` | entrega pendiente, en la rama que `NOW.md` indique |
| `PARA-DEV.md` | tarea/hilo activo |
| `CONTRATO.md` | alcance contractual |
| `ALCANCE-Y-LIMITES.md` | límites e interpretaciones operativas |
| `DECISIONS.md` | decisiones durables y alternativas descartadas |
| `MATRIZ.md` | trazabilidad de requisitos y evidencia |
| `REPO_MAP.md` | mapa técnico del código |
| `TAXONOMIA-CLIENTE.md` | categorías/subcategorías |
| `PAGOS-TRANSFERENCIA.md` | detalle de transferencia cuando la tarea lo requiera |
| `PLAN-RED-TEAM-CIERRE-MVP.md` | puerta de red-team final |
| `archivo/` | evidencia e historia consultable, no onboarding |

## Contexto institucional

El Second Brain de Inera vive en `Memu007/ynerasecondbrain`. Sirve para reglas transversales y arranque de proyectos; TopGreen conserva autoridad sobre su contrato, estado, código y decisiones locales.
