# Arranque para la PM

Leé este archivo completo una vez. Después el trabajo diario pasa por `NOW.md`, `CRONOGRAMA.md`, `PARA-PM.md` y `PARA-DEV.md`.

El chat no es fuente de verdad. Git, contrato, decisiones y evidencia reproducible sí.

## Cuando Emi diga “ponete al día”

1. Revisá `git status` y el commit actual. Si el árbol está limpio, actualizá `main`; si no, preservá los cambios y reportalos.
2. Leé `NOW.md` y `CRONOGRAMA.md`.
3. `NOW.md` identifica la rama/SHA registrada de la entrega pendiente. Verificala
   contra Git: `NOW.md` es un puntero operativo y puede haber envejecido. Si Dev
   todavía no está integrada, leé `PARA-PM.md` desde esa rama; no asumas que la
   copia de `main` es la última.
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

No hay una sola precedencia para preguntas distintas:

- **Alcance y autoridad:** `CONTRATO.md`, decisiones explícitas y
  `ALCANCE-Y-LIMITES.md` mandan sobre planes, auditorías y código accidental.
- **Fechas y puertas contractuales:** manda `CRONOGRAMA.md`.
- **Rama, SHA, contenido y comportamiento implementado:** mandan Git, código,
  pruebas y runtime observados. Si contradicen `NOW.md`, se corrige `NOW.md`;
  no se fuerza la evidencia para sostener la prosa.
- **Prioridad y próximo paso:** los decide la PM y se registran en `NOW.md` y
  `PARA-DEV.md`.

Los planes, auditorías y documentos históricos aportan contexto; no cambian
alcance, prioridad ni aceptación por sí solos.

## Calendario contractual

La semana 1 comienza el **2026-08-21**. Fases, fechas, hitos, puertas y colchón
viven únicamente en `CRONOGRAMA.md`. `NOW.md` calcula la semana vigente y el
proyecto puede adelantar piezas, pero no cambiar alcance ni puertas sin una
decisión explícita.

## Alcance

No reconstruyas alcance desde memoria, chat, roadmap ni código existente. Abrí
`CONTRATO.md`, `ALCANCE-Y-LIMITES.md` y `DECISIONS.md` cuando la tarea dependa
de ellos. Precio fijo significa que una mejora no trazada se propone y decide;
no entra al MVP por costumbre.

## Canal PM ↔ Dev

| Archivo | Quién escribe | Uso |
|---|---|---|
| `PARA-DEV.md` | PM | una tarea activa y su hilo de devoluciones hasta el cierre |
| `PARA-PM.md` | Dev | una entrega pendiente y su evidencia |

Una pieza cerrada sale de los canales vivos. La historia permanece en Git y, cuando haga falta una referencia estable, en `docs/pm/archivo/`.

`PARA-PM.md` se reemplaza: conserva el encabezado del canal y una sola entrega
vigente. No se agrega un informe nuevo arriba de los anteriores.

### Una tarea PM → Dev debe contener

1. rama y SHA base, y problema y motivo de prioridad;
2. alcance y fuera de alcance;
3. criterios de aceptación ejecutables;
4. evidencia o decisiones que hay que leer;
5. condición para frenar y consultar;
6. formato mínimo de entrega: cambio, pruebas, riesgos y commit.

Una sola tarea activa. Preferir bloques verticales demostrables; separar dinero, seguridad, permisos, migraciones o datos cuando el riesgo justifique una puerta propia.

## Revisión y aceptación

Antes de asignar compuertas, aplicá la decisión «Dev no tiene Docker/PostGIS;
PM conserva esas puertas y Dev puede delegar» de `DECISIONS.md`: la falta de
Docker en Dev no elimina la puerta, la traslada a PM.

La PM no acepta por cortesía ni porque el informe diga “verde”. Revisa diff, evidencia y comportamiento.

- Dev conserva un rojo discriminante cuando corresponde, corre focales y puertas proporcionales y entrega SHA exacto.
- PM reproduce de forma independiente lo que define la aceptación.
- Un caso nuevo o modificado que pueda dar verde sin observar el estado real
  debe demostrar su negativo discriminante; la PM reproduce ese sabotaje antes
  de confiar en el verde.
- Suite completa de PM cuando hay dinero, autenticación, permisos, órdenes, stock, migraciones, datos, seguridad, cambio transversal, cierre de fase/hito, rojo inesperado o preparación de despliegue; también por cadencia cuando se acumulan entregas.
- No repetir puertas sobre el mismo SHA sin cambio relevante sólo para “hacer volumen”.
- Si Dev y PM obtienen resultados distintos, el candidato no se acepta hasta reproducir y clasificar la diferencia.

Para una integración excepcional, ambos deben probar la **misma composición y el mismo SHA** desde bases limpias.

El SHA probado puede ser el último commit de producto/arnés. El informe puede
ir después si el delta hasta el HEAD entregado es exclusivamente documental y
esa condición se demuestra con Git; un `.md` no obliga a repetir una suite.

Los logs temporales ayudan durante una revisión, pero no son evidencia durable.
La decisión canónica debe conservar SHA, resultado y la parte discriminante;
las rutas de `/private/tmp` se retiran de `NOW.md` cuando la pieza se cierra.

En correcciones visuales, cambiar qué token ya existente usa un elemento para
cumplir la semántica declarada es un arreglo acotado. Cambiar el valor global de
un token o introducir una nueva dirección visual requiere alcance explícito.

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

Mientras Railway siga conectado a `main` con auto-deploy, cualquier push que
toque producto o configuración se trata como una acción de producción y exige
autorización explícita. No se confía en una lista eterna de watch paths: primero
se verifica la configuración vigente.

Después de una migración de esquema no se hace rollback ciego sólo de código. La recuperación normal es forward-fix; un downgrade de esquema requiere procedimiento probado y backup recuperable.

## Límites que no se negocian

Son reglas de Emi. Valen para PM y Dev, y esta es su única copia: los demás
documentos remiten acá.

- `PRE_FIRMA.md` nunca llega a `main`: el repositorio se le entrega a la
  clienta al final del proyecto.
- Montos, porcentajes y reparto de ingresos no se versionan; viven en el PDF
  original, fuera del repositorio.
- Ningún secreto en el repositorio ni en los informes, tampoco credenciales
  reales de Mercado Pago o SMTP. Los `.env` locales llevan valores
  inventados.
- No se copia código, texto, marca ni diseño de Agrofy ni de ningún tercero.
- No se rodea la política de seguridad de ningún entorno. Si bloquea algo, se
  informa.
- La plataforma no recibe, retiene ni administra fondos de terceros. La única
  excepción es el cobro de suscripciones (`ALCANCE-Y-LIMITES.md`,
  `DECISIONS.md` del 26/07).
- **Teléfono de contacto: PENDIENTE de Emi.** La regla dada fue que no sale
  de la API sin una suscripción activa, y que se hace cumplir en el backend,
  no ocultándolo en la pantalla. Choca con `DECISIONS.md` del 05/08, que
  pasó suscripciones y candados por plan a la Fase 6. Hoy el teléfono no
  aparece en el Mercado ni en las fichas. Lo ven las dos partes de una orden
  y quien compra, después de elegir transportista. El transportista no recibe
  el de quien compra.
- La auditoría de seguridad completa va al final, antes del despliegue. Lo
  que aparezca antes se corrige cuando aparece.
- Toda reproducción ofensiva es local y acotada. Nunca contra Railway.
- El chat no es fuente de verdad. Lo son Git, el contrato, las decisiones y
  la evidencia reproducible. `docs/PROJECT_STATUS.md` es sólo un tombstone
  histórico.
- No se inventan hechos faltantes: se marcan `PENDIENTE`.
- Una decisión cerrada no se cambia sin identificar quién tiene autoridad
  para hacerlo.
- Terminar el onboarding no habilita a iniciar una tarea nueva.

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
| `ROADMAP-CIERRE-MVP-2026-08-31.md` | orden de cierre e índice de piezas aceptadas con sus SHA |
| `REPO_MAP.md` | mapa técnico del código |
| `TAXONOMIA-CLIENTE.md` | categorías/subcategorías |
| `PAGOS-TRANSFERENCIA.md` | detalle de transferencia cuando la tarea lo requiera |
| `PLAN-RED-TEAM-CIERRE-MVP.md` | puerta de red-team final |
| `archivo/` | evidencia e historia consultable, no onboarding |

## Contexto institucional

El Second Brain de Inera vive en `Memu007/ynerasecondbrain`. Sirve para reglas transversales y arranque de proyectos; TopGreen conserva autoridad sobre su contrato, estado, código y decisiones locales.
