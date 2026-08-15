# Arranque para la PM

Leé este archivo entero **una vez**, hoy. Después tu día a día pasa por
`NOW.md`, `CRONOGRAMA.md` y los dos canales.

Escrito el **2026-08-06** por la dev, para la PM entrante. Es el segundo
cambio de PM del proyecto: la primera fue quien hoy escribe el código, la
segunda fue Sol, y ahora sos vos.

## Cuando Emi diga “ponete al día”

Es el disparador formal de un relevo. No uses como fuente el chat anterior.

1. Revisá estado y commit local; si no hay cambios, actualizá `main` desde
   GitHub. Si los hay, preservalos y avisá.
2. Leé este archivo completo y después `NOW.md`, `CRONOGRAMA.md`, el último
   `PARA-PM.md`, la tarea vigente en `PARA-DEV.md` y las decisiones que esa
   tarea cite.
3. Contrastá las afirmaciones importantes con Git, código o pruebas antes de
   darlas por ciertas.
4. Devolvé un parte breve con: commit, semana/fase, tarea y responsable,
   última aceptación, bloqueo/decisión pendiente y siguiente acción.
5. Recién después revisá una entrega o escribí una nueva tarea.

Este procedimiento también está resumido en el `AGENTS.md` de la raíz para que
una sesión nueva lo encuentre antes de conocer la estructura del proyecto.

### Contexto institucional de Inera

El contexto compartido de la consultora vive en
<https://github.com/Memu007/ynerasecondbrain>, integrado en `main` el
2026-08-15 mediante el commit `f34627e`. Sirve para identidad, proyectos y
reglas transversales; **no reemplaza este onboarding, el contrato, Git ni las
decisiones locales de TopGreen**.

- Si Emi dice solamente **“ponete al día”**, seguí primero este procedimiento
  local.
- Si dice **“ponete al día con Inera”** o pide contexto transversal, leé además
  `AGENTS.md` y `docs/ONBOARDING.md` del Second Brain mediante un acceso
  autorizado a GitHub.
- El puente automático desde el `AGENTS.md` raíz de TopGreen sigue pendiente.
  Una PM no lo instala: este rol sólo edita `docs/pm/`. Hasta entonces, no
  afirmes que las reglas de Inera se cargan solas.

---

## 0. Lo primero, porque es lo que más cuesta caro

Este proyecto ya lleva **tres semanas de decisiones tomadas y registradas**.
La forma más rápida de perder tiempo acá es reabrirlas.

**Tres cosas no se mueven, y ninguna es opinión mía:**

1. **El calendario sale del PDF que la clienta aprobó.** No es una
   estimación interna. Ver sección 4.
2. **El alcance está cerrado y es a precio fijo.** Lo que se construya de
   más lo pagamos nosotros. `CONTRATO.md` es la única fuente: si algo no
   está ahí, no es requisito.
3. **Lo que figura en `DECISIONS.md` está decidido.** Podés discutirlo —te
   invito a hacerlo— pero cambiarlo es una decisión de Emi, no tuya ni mía.

**El reloj contractual arranca con la firma programada para el viernes
21/08.** La clienta dio el OK comercial el 14/08; el trabajo anterior es
adelanto y no consume semanas.

---

## 1. Quién es quién

**Vos sos la PM.** Definís qué se construye y por qué, escribís los
criterios de aceptación, priorizás y revisás lo que se entrega.

**No escribís código de producto.** Sólo editás archivos dentro de
`docs/pm/`. Si la PM toca el código, el proyecto pierde la única revisión
independiente que tiene.

**Yo soy la dev.** Escribo el código, corro las pruebas y te informo.

**Emi es el dueño del proyecto.** Habla con la clienta y toma las decisiones
comerciales. Todo lo que dependa de la clienta va por él.

---

## 2. Somos adversariales, en las dos direcciones

Esto es cómo trabajamos, no una advertencia.

**Si me pedís algo técnicamente mal, te lo voy a decir antes de hacerlo.**
No lo voy a implementar porque lo pidió la PM. Y espero lo mismo al revés.

Pasó en las dos direcciones, y por eso funciona:

- Una PM mandó a cargar *"las 43 subcategorías tal como figuran en el
  análisis"* cuando el análisis sólo tenía las cantidades. La dev frenó en
  vez de inventarlas. **Tenía razón y el error era de la PM.**
- Una PM afirmó por escrito que *"la plataforma no toca fondos"*. La dev
  demostró que era falso. **Ganó la dev**, y por eso hoy los pagos heredados
  están desmontados.
- **Sol rechazó una entrega mía por contraste** y midió el número que yo no
  había medido: 3,77:1 donde hacían falta 4,5:1. **Tenía razón.** Ese
  rechazo mejoró el producto.
- La dev dejó su informe desactualizado dos veces y la PM se enteró leyendo
  el código.

**La regla operativa: se verifica contra el código, no contra el informe.**
Este repositorio llegó con ocho afirmaciones falsas en su propia
documentación. Si te digo que algo funciona y no pegué la salida del
comando, **tratalo como no hecho**.

---

## 3. El proyecto, en un minuto

**TopGreen** es un marketplace agrícola argentino, para una clienta real, a
**precio cerrado**. Junta productores, proveedores y transportistas.

La diferencia con un marketplace común son dos cosas: **filtrado por
ubicación real** —con el padrón oficial del Estado argentino, 4.028
localidades cargadas— y un **módulo de logística** que conecta compradores y
vendedores con transportistas de la zona.

La clienta aprobó el proyecto el **martes 2026-07-28**. Viene de una
experiencia mala con otro estudio: heredamos un repositorio donde la base de
datos no se podía crear y cuya documentación afirmaba cosas falsas. Eso
explica por qué acá todo se verifica.

---

## 4. El calendario manda, y sale del PDF

**Fuente: la sección 5 del PDF** *Documento de Especificación Funcional y
Propuesta Comercial*, el que armó el socio de Emi y que **la clienta
aprobó**. Las fases y las semanas de abajo **no son una estimación nuestra:
son lo que se prometió por escrito**.

**Dónde está el PDF:** el original lo tiene Emi, **fuera del repositorio**,
porque incluye montos y forma de pago y este repositorio se le entrega a la
clienta al final. Pedíselo a él si querés leerlo entero.

**Lo que sí está versionado, y te alcanza para trabajar:**

- **`CONTRATO.md`** — transcripción de las secciones funcionales 1 a 5,
  incluida la tabla de fases tal cual figura en el PDF.
- **`CRONOGRAMA.md`** — esa misma tabla anclada a fechas reales, más las
  puertas de cierre de cada fase y los tres hitos de cobro con su
  disparador textual.

**Si el plan interno y `CRONOGRAMA.md` se contradicen, gana
`CRONOGRAMA.md`**, y hay que corregir el plan interno.

### Las cinco fases, con fechas

| Fase | Contenido según el PDF | Semanas | Desde | Hasta |
|---|---|---|---|---|
| 1 — Diseño y UX/UI | Pantallas y flujos de comprador, vendedor y logística | 1–2 | **21/08** | **03/09** |
| 2 — Desarrollo base | Arquitectura, base, registro de roles y perfiles | 3–5 | 04/09 | 24/09 |
| 3 — Buscador y catálogo | Motor de búsqueda y **geolocalización de fletes** | 6–8 | 25/09 | 15/10 |
| 4 — Pagos y checkout | Mercado Pago y validación de transferencias | 9–10 | 16/10 | 29/10 |
| 5 — QA y lanzamiento | Pruebas, carga inicial y **despliegue en producción** | 11–12 | 30/10 | 12/11 |

**Ancla:** Emi confirmó el 2026-08-14 el OK comercial y la firma programada: la
**semana 1 empieza el viernes 2026-08-21**. Cada semana corre de viernes a
jueves. Reemplaza el ancla provisoria del 07/08.

**Plazo: 12 a 14 semanas.** Las doce cierran el **12/11**; el colchón que el
propio PDF concede llega al **26/11**. Ese colchón es la única holgura que
existe: **gastarlo es una decisión, no un accidente**, y cada corrimiento se
anota en `CRONOGRAMA.md` con su motivo.

**Garantía:** 90 días desde el lanzamiento. Sobre la fecha de doce semanas,
hasta el **2027-02-10**.

### Los tres hitos de cobro

No están atados a fechas: **están atados a entregables**, con el texto
literal del PDF en `CRONOGRAMA.md`. El intermedio exige demostrar catálogo,
búsquedas **y geolocalización de fletes** funcionando juntas. Los montos no
se versionan.

### Dos cosas del calendario que vas a querer saber ya

**El PDF supone que se arranca de cero, y no se arrancó de cero.** Se heredó
un repositorio a medias y se trabajó tres semanas antes de la aprobación.
Por eso el estado real no sigue el orden de las fases. El contraste fase por
fase está en la sección 4 de `CRONOGRAMA.md`.

**Hacia afuera se reporta con estas cinco fases**, aunque internamente se
trabaje en otro orden. Eso no es cosmético: es lo que la clienta firmó.

---

## 5. Lo que ya está decidido y no se reabre

Esta sección existe para que no derives. Todo esto está en `DECISIONS.md`
con su fecha y su motivo.

| Decisión | Cuándo | En una línea |
|---|---|---|
| Inicio del plazo | 14/08 | Semana 1 desde la firma programada para el viernes 21/08 |
| Suscripciones, planes, mensajería y tierras | 05/08 | **Van a Fase 6, después del lanzamiento.** No compiten con las fases 1 a 5 |
| "Registro con validación" | 05/08 | Es **por correo**: enlace de un solo uso, 24 h, reenvío, login bloqueado hasta verificar |
| Hosting | 05/08 | **Railway**, aprobado. Configuración no cuenta como despliegue |
| Logística | 07/25 | **Directorio por geolocalización, no motor de ruteo.** Lo dice el contrato |
| Cobertura del transportista | 07/26 | **Radio en km**, no zonas declaradas. Lo dice el contrato |
| La plataforma y el dinero | 07/26 | **No recibe, retiene ni administra fondos de terceros** |
| Mercado Pago heredado | 07/26 y 12/08 | **Desmontado.** No se reutiliza como autoridad. Emi confirmó Checkout Pro con OAuth por vendedor, cobro directo y comisión de marketplace cero |
| Transferencia bancaria | 05/08 | Cerrada y aceptada. Sin órdenes inmortales |
| Nombre comercial del transportista | 05/08 | **Rechazado para el MVP.** Se usa `full_name` |
| Revisión de seguridad | 07/25 | **Al final, como condición para desplegar.** No se adelanta y no se saltea |
| Vista en celular | 07/26 | **Aparcada** hasta el final, con relevamiento hecho |

**Si querés cambiar alguna, el camino es Emi.** Lo que no sirve es
empezar a trabajar como si no estuviera decidida.

---

## 6. Cómo nos comunicamos

**No hay chat entre vos y yo. Hablamos por archivos, en el repositorio.**

| Archivo | Quién escribe | Para qué |
|---|---|---|
| `docs/pm/PARA-DEV.md` | **Sólo vos** | Mi tarea actual y sus criterios |
| `docs/pm/PARA-PM.md` | **Sólo yo** | Mis informes |

Ninguna de las dos edita el archivo de la otra. `PARA-DEV.md` es tuyo:
reescribilo entero cuando quieras.

**Antes de escribirme:**

```bash
git pull origin main
cat docs/pm/PARA-PM.md
```

### Qué tiene que tener una tarea que me escribas

1. **Qué problema resuelve.**
2. **Los criterios de aceptación**, escritos como abajo.
3. **Qué está explícitamente fuera de alcance.** Con precio cerrado, esto
   vale tanto como lo que está dentro.
4. **Cuándo freno y te escribo** en vez de improvisar. Por defecto, freno.

### Cómo se escriben los criterios acá

**Relacionales, no absolutos.** En vez de *"tiene que devolver 4 productos"*,
va *"el resultado de la API tiene que coincidir con el de la consulta SQL
equivalente"*. Los números fijos envejecen mal: ya se le pasaron a una dev
números viejos y ella reportó los reales en lugar de acomodarse.

Cuando el número **es** la especificación —como *"43 subcategorías"*— va
fijo, y se aclara que es fijo.

**Un criterio que sólo se puede verificar leyendo código no es un criterio.**
Tiene que haber un comando que corra y una salida que se pegue.

Sol subió la vara acá y conviene mantenerla: pedía **la corrida en rojo antes
del arreglo y la verde después**. Un caso que pasa antes de la corrección no
prueba nada.

### Cómo escribirle a esta dev — regla permanente del rol PM

La dev trabaja con **Opus 5 en razonamiento alto**. Tratala como una ingeniera
senior con autonomía de implementación: la PM decide **qué problema**, **por
qué ahora**, **qué límites** y **cómo se demuestra**; la dev decide el cómo
técnico. No le dictes una solución salvo que sea una restricción ya decidida.

Cada encargo en `PARA-DEV.md` debe ser corto, autosuficiente y tener, en este
orden:

1. resultado esperado y motivo de prioridad;
2. archivos, evidencia o decisiones que debe leer antes de tocar código;
3. alcance y fuera de alcance;
4. criterios de aceptación ejecutables;
5. condición concreta para frenar y consultar;
6. formato mínimo del informe: cambio, evidencia, riesgos y commit.

Reglas para aprovechar el modelo sin gastar de más:

- una sola tarea activa; no mezclar piezas independientes;
- por defecto, esa tarea es un **bloque vertical de 1–2 días de trabajo** con
  un resultado funcional demostrable de punta a punta. No mandar microtareas
  por mensaje ni una semana entera sin control;
- el bloque puede incluir backend, frontend, migración y pruebas cuando todos
  son necesarios para el mismo resultado. Pagos, seguridad, datos y otra área
  de riesgo independiente se separan;
- la dev ejecuta e integra el bloque completo. La PM revisa al cierre y sólo
  profundiza antes si aparece un freno, una decisión de alcance o riesgo para
  dinero, seguridad, datos, cronograma o un hito;
- se pueden dejar bosquejados los 2–3 bloques siguientes en `NOW.md`, pero en
  `PARA-DEV.md` hay uno solo activo. Un bloque semanal sólo se autoriza si tiene
  cortes demostrables y bajo riesgo; en caso contrario se divide;
- contexto relevante por ruta o commit, sin repetir todo el proyecto;
- pedir que inspeccione el flujo real antes de editar y que verifique después;
- pedir evidencia reproducible, no una declaración de que funciona;
- no pedir planes extensos, razonamiento transcripto ni multiagente por defecto;
- reservar una revisión independiente para dinero, seguridad, datos o cambios
  transversales; la PM sigue siendo la revisión adversarial final;
- si detecta una mejora no solicitada, la propone con beneficio, esfuerzo,
  riesgo y fase, pero no la implementa;
- si contradice a PM con evidencia, se evalúa la evidencia: no se fuerza la
  orden original por jerarquía.

No usar elogios, personajes ni frases vagas como “mejoralo”, “pensalo bien” o
“hacelo completo”. Opus responde mejor a una tarea específica con contexto y
criterios verificables. El razonamiento alto ya está habilitado; no hace falta
consumir mensajes pidiéndoselo otra vez.

Este protocolo se basa en las recomendaciones oficiales de Anthropic sobre
instrucciones específicas, contexto enfocado, exploración antes de implementar,
verificación y corrección temprana:
[Claude Code: best practices](https://www.anthropic.com/engineering/claude-code-best-practices)
y [Agentic coding and persistent returns to expertise](https://www.anthropic.com/research/claude-code-expertise).

---

## 7. Las reglas que no se negocian

1. **La plataforma no recibe, retiene ni administra fondos de terceros.** El
   caso 19 de la suite verifica que las rutas de pago heredadas devuelvan
   `404`: es una propiedad del código, no de la configuración.
2. **Nunca se configuran credenciales reales de Mercado Pago** ni se sube
   ningún secreto. Para local, valores inventados.
3. **Nada copiado de Agrofy ni de ningún otro sitio**: ni código, ni textos,
   ni diseño, ni marcas.
4. **La revisión de seguridad completa va al final, como condición para
   desplegar.** No se adelanta y no se saltea.

   **Matiz:** posponer la auditoría no es posponer un agujero encontrado.
   Apareció un endpoint que dejaba a un comprador marcar su propia orden
   como pagada sin pagar; se encontró en una revisión de alcance y se
   eliminó el mismo día.
5. **Una política de seguridad del entorno de la dev no se rodea nunca.** Se
   reporta.
6. **Los datos de contacto son de personas reales.** Cualquier candado se
   hace en el backend, no escondiendo cosas en la interfaz.
7. **`docs/PROJECT_STATUS.md` no se lee ni se edita.** Ocho afirmaciones
   verificadas como falsas.
8. **Los términos comerciales no se versionan** —montos, porcentajes,
   participación—. Este repositorio se le entrega a la clienta.

---

## 8. Dónde está todo

| Archivo | Cuándo abrirlo |
|---|---|
| `NOW.md` | **Siempre primero.** Estado y prioridades |
| `CRONOGRAMA.md` | **Segundo.** Fases, fechas, puertas e hitos |
| `ALCANCE-Y-LIMITES.md` | Los límites operativos por bloque |
| `PARA-DEV.md` | Lo que le dejás escrito a la dev |
| `PARA-PM.md` | Mis informes |
| `CONTRATO.md` | El alcance. Si algo no está ahí, no es requisito |
| `DECISIONS.md` | Por qué se decidió cada cosa |
| `MATRIZ.md` | Qué está verificado y con qué evidencia |
| `PROJECT.md` | Qué se construye y qué queda afuera |
| `TAXONOMIA-CLIENTE.md` | Las 7 categorías y las 43 subcategorías |
| `PAGOS-TRANSFERENCIA.md` | El análisis de la transferencia |
| `REPO_MAP.md` | Dónde está cada cosa en el código |
| `ONBOARDING-DEV.md` | Lo que leo yo el primer día |
| `docs/ux/logistica/` | El prototipo navegable de logística |
| `archivo/PARA-DEV-historico.md` | Todo el canal de julio, verbatim |

---

## 9. El estado real, sin maquillar

**No hay un porcentaje único vigente.** La última medición heredada fue
~53 %, pero mezclaba alcance contractual con alcance nuevo y no incluía la
Pieza A de transportistas. **El control se hace por las puertas de
`CRONOGRAMA.md`**, no por un número.

**Funciona y tiene evidencia de ejecución:**

- Arranque desde cero: PostgreSQL 16 + PostGIS 3.4.3, migraciones, seed
  idempotente, build en verde.
- Recorrido de compra completo en navegador real, con tres perfiles.
- Geolocalización con 4.028 localidades, `Geography(POINT,4326)` con índice
  GIST y `ST_Distance` contrastado.
- Filtro por provincia y localidad de punta a punta, con estado en la URL.
- Taxonomía de la clienta cargada y verificada por SQL: 7/6/7/5/6/4/8.
- **Suite de 25 casos de humo**, corrida desde base limpia el 05/08.
- **Transferencia bancaria sin órdenes inmortales**, aceptada el 05/08.
- **Prototipo navegable del flujo de logística**, en `docs/ux/logistica/`,
  con la corrección de Sol aplicada.

**Falta, y es lo grande:**

- **Transportistas, Piezas B y C**: el listado por cercanía y la inclusión en
  la operación. Es Fase 3 y es el diferencial del producto.
- **Validación por correo** — Fase 2.
- **Perfil de transportista editable** — Fase 2, con dos objeciones abiertas.
- **Mercado Pago para compras**, OAuth por vendedor y comisión de marketplace
  cero — Fase 4. Una orden y un pago por vendedor.
- **Despliegue real**, revisión de seguridad y correcciones de celular —
  Fase 5.

**Roto de lo ya entregado, sin arreglar:**

- El seed no carga CBU ni alias, así que en instalación limpia la
  transferencia no se puede usar.
- El camino de instalación sin Docker no funciona siguiendo la guía.

---

## 10. Lo que está en el aire ahora mismo

Tres cosas esperan respuesta de la PM. Las dejo tal cual se las dejé a Sol:

1. **¿Aceptás la corrección del prototipo?** Está en `PARA-PM.md`, commit
   `f7fd2a2`. Si la aceptás, **cierra la puerta de la Fase 1**.
2. **El contraste de `src/index.css`.** Corregí el gradiente en el
   prototipo, pero **la aplicación real sigue con el mismo 3,77:1 en todos
   sus botones primarios**. Es una falla de accesibilidad que existe hoy, no
   sólo en el prototipo. Media hora de trabajo. Decidí si entra como pieza
   chica o va a la revisión de Fase 5.
3. **La pieza chica del reembolso heredado.** `orders.py` importa
   `process_refund` desde el módulo de pagos desmontado. Hoy no llega a
   ejecutarse, pero el camino está vivo. Sol lo dejó para Fase 4; si querés
   adelantarlo, es chico.

---

## 11. Tu primera tarea

1. Leé `NOW.md` y `CRONOGRAMA.md`, en ese orden.
2. Leé mi último informe en `PARA-PM.md`.
3. Contestá el punto 1 de la sección anterior: **aceptar o rechazar la
   corrección del prototipo**, porque de eso depende que la Fase 1 cierre en
   fecha.
4. Escribime la tarea siguiente en `PARA-DEV.md` y pusheá.

**Empezar no necesita permiso de mi parte.** Lo que esté en `PARA-DEV.md` lo
tomo como aprobado y arranco.
