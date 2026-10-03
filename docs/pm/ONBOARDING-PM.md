# Arranque para la PM

Leé este archivo completo una vez. Después el trabajo diario pasa por `NOW.md`, `CRONOGRAMA.md`, `PARA-PM.md` y `PARA-DEV.md`.

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

## Método de revisión que funciona (25 y 26/09)

- **Entorno PM.** Worktree en el SHA exacto de la Dev, base PostGIS Docker
  recién creada, API nativa, frontend de desarrollo y `.env` inventados. Los
  valores inventados de Mercado Pago salen de `scripts/entorno_nativo.sh`. Sin
  ellos caen unos 37 casos con «no configurado».
- **Reiniciar la API por su línea de comando**, contando que quede un solo
  proceso. El proceso lanzado en segundo plano no puede heredar la salida de
  quien lo llama: redirigila entera. Si no, un `subprocess.run(...,
  capture_output=True)` queda colgado. Nunca uses `pkill -f` con un patrón que
  coincida con tu propia terminal.
- **Negativos:** los de la Dev, más uno o dos propios que ataquen otro borde.
  Cada uno tiene que dar rojo por su motivo, y el árbol tiene que quedar
  limpio.
- **Suite completa desde base nueva.** El 169, que reinicia la API de verdad,
  falla en el entorno de PM y puede tirar en cadena del 167 al 185 con 429.
  Se repiten después de reiniciar. El 131 depende de poder bajar `alpine:3`.
- **Migraciones de datos:** además del caso de la Dev, correrlas con los
  archivos que copia `backend/Dockerfile.railway` y con `ENV=production`,
  sobre una copia de base armada como la publicada. Correrlas dos veces.
  Dentro de `docker build`, `pip` no llega a PyPI: no se fuerza, se declara el
  límite.
- **Las dos guías** (`guia-admin.mjs` y `guia-usuario.mjs`) se corren después de la suite. Un negativo útil rompe el producto sin tocar la guía, para ver que el programa controla lo que la guía afirma y no sólo el texto.
- **Toda lista nueva** tiene que decir cómo llega a producción. Ver la regla
  en `ONBOARDING-DEV.md`, «Producción y Railway».

## Herramientas de PM

Viven en `docs/pm/herramientas/` y usan valores inventados. El trabajo va en
`PM_DIR` (por omisión `~/pm-entorno`), fuera del repositorio.

| Comando | Qué hace |
|---|---|
| `levantar.sh <SHA>` | worktree en el SHA, `.env` inventados, dependencias, navegador, base nueva, API y frontend |
| `base-nueva.sh` | base PostGIS recién creada, migraciones, siembra y API |
| `reiniciar-api.sh` | reinicia la API y dice cuántos procesos quedaron (tiene que ser 1) |
| `revivir.sh` | después de un reinicio del contenedor: Docker, base nueva, API y frontend |
| `suite-y-puertas.sh <base> <SHA>` | suite completa, repetición de los rojos, auditorías, las dos guías y las puertas |
| `negativos-pm.sh` | plantilla de los negativos propios: copiala a `PM_DIR` y cambiá los sabotajes |
| `negativos-dev.py <script>` | corre los negativos viejos de la Dev con el reinicio de PM. Los nuevos aceptan `REINICIAR_API=docs/pm/herramientas/reiniciar-api.sh` |
| `bin/docker` | puente: `docker exec topgreen-api python…` va a la API nativa. Lo pone en el `PATH` `comun.sh` |

Los casos se corren desde el worktree con las variables de `comun.sh`:

```bash
source docs/pm/herramientas/comun.sh; cd "$CAND"
SMOKE_CASOS=239,240 node scripts/smoke.mjs
```

**El contenedor de PM se reinicia entre turnos**, y los procesos en segundo
plano tienen tiempo límite. Lo largo (la suite tarda unos 45 minutos) se
corre separado, y se consulta el registro en esperas de 10 minutos:

```bash
(setsid nohup docs/pm/herramientas/suite-y-puertas.sh <base> <SHA> > "$PM_DIR/suite.out" 2>&1 < /dev/null &)
for i in $(seq 1 58); do grep -q '^fin' "$PM_DIR/suite.out" && break; sleep 10; done; cat "$PM_DIR/suite.out"
```

Si un reinicio corta una corrida, se levanta con `revivir.sh` y se repite
entera. Sólo cuenta la repetición, y la reproducción lo dice.

**Git.** Para traer la rama Dev usá un refspec explícito: una vez un `git
fetch origin <rama>` dejó la referencia en un commit viejo.

```bash
git fetch -q origin +refs/heads/<rama Dev>:refs/remotes/origin/<rama Dev>
```

### Comandos del proyecto

Cargan sólo si la sesión está abierta sobre este repositorio.

- `/revisar-entrega`: el orden de una revisión, de «respondió» al veredicto.
- `/como-venimos`: para Emi, el estado en tres líneas. Sirve también en la
  sesión de la Dev.

**Loop de espera de PM: no.** Emi decidió el 03/10 que PM retoma con su
«respondió», porque cada vuelta de PM carga la revisión entera y gasta tokens
aunque no haya nada nuevo. La Dev sí deja el suyo.

## Subagentes adversariales

Un subagente arranca con contexto nuevo, no carga el de la PM y devuelve sólo
su conclusión. Sirve para hacer las preguntas que nadie hizo, también sobre el
trabajo de la PM. Emi lo pidió el 03/10: no programa, y no puede repreguntar.

**Cuándo:** cuando la pieza toca dinero, sesión, permisos, datos o es
transversal; cuando la PM y la Dev coinciden demasiado rápido; antes de pedir
una publicación con migración. No en piezas visuales chicas: ahí alcanzan los
negativos y el navegador.

**Cómo:**

- Un solo subagente por pieza, con una consigna cerrada: el SHA, el diff a
  mirar, qué afirma el informe y «buscá cómo esto pierde datos, cobra mal,
  deja entrar a quien no debe o se traba». Que devuelva hallazgos con
  archivo, línea y cómo reproducirlos, no opiniones.
- Modelo según la tarea, Opus o Sonnet; Fable no se usa para subagentes
  (Emi, 03/10). Sonnet aporta otros puntos ciegos que los de la PM y la Dev;
  Opus, más profundidad. El veredicto dice cuál se usó.
- La revisión de la Dev con su propio subagente, antes de entregar, es
  autorrevisión: suma, pero no reemplaza este paso.
- Lo que encuentra es una hipótesis. La PM lo reproduce o lo descarta con
  evidencia antes de llevarlo a `PARA-DEV.md`.

## Hablar con Emi

Emi no programa: cada punto que se le cuenta lleva qué es.

- **Rompe:** algo deja de funcionar, se pierde o se cobra mal. Bloquea.
- **Riesgo:** puede pasar en un caso borde; se dice cuándo y cuánto cuesta
  arreglarlo.
- **Prueba:** el sitio está bien; lo que falla es una prueba. No se ve.
- **Se ve:** estética o texto. Lo decide Emi por gusto.

## Publicar

1. Suite completa y puertas sobre el SHA exacto. El SHA publicado puede ser
   un commit PM posterior, si `git diff` fuera de `docs/pm` da vacío.
2. Comprobar que se pueda subir sin reescribir `main` (fast-forward desde el
   `main` remoto), que no estén `PRE_FIRMA.md` ni `.env`, y que no haya
   secretos en el diff.
3. **Autorización explícita de Emi para esa publicación.** Recién entonces:
   `git push origin <SHA>:refs/heads/main`.
4. Railway tarda unos 10 minutos. La red de PM bloquea `railway.app`: verifica
   Emi, en una pestaña de incógnito. El Mercado guarda las categorías mientras
   la pestaña está abierta, así que una pestaña vieja muestra filtros viejos.
   Sitio: `https://yneratopgreen-production.up.railway.app`. El dominio
   `ynerav.up.railway.app` es histórico.
5. Registrar en `NOW.md` qué se publicó y qué verificó Emi.

**Estimaciones.** La Dev entrega una pieza en horas y la revisión PM lleva
1 a 2 horas. Los plazos los fijan lo que depende de Emi (correo, cuentas de
prueba de Mercado Pago, decisiones) y las pruebas contra terceros, no la
programación.

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
