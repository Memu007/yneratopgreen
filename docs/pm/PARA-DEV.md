# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en `docs/pm/PARA-PM.md` y no edita este archivo.

Este archivo contiene únicamente la tarea activa y su hilo de devoluciones hasta el cierre. La historia anterior permanece en Git; la instantánea previa a esta poda está en `ab4165fc`.

Antes de empezar:

```bash
git pull origin main
cat docs/pm/PARA-DEV.md
```

---

## 2026-09-12 — INTEGRATION-CANDIDATE-1

`COPY-CLEAR-1` queda **aceptada** en `9f25d59`, con informe `ee166b4`. Se abre una tarea de integración, no una función nueva.

La PM reprodujo 156+160+168 en 3/3, 134+167+168 en 3/3 y 165+166 en 2/2, todos desde bases Docker limpias. La a11y dio el mismo rojo heredado en entrega y padre: 64/64 pantallas y seis violaciones `serious` de contraste en paneles. La suite completa PM dio 163/168; los cinco rojos quedaron separados de COPY por las focales y por el agotamiento/caducidad de recursos del arnés. Lint, TypeScript, sintaxis y `diff-check` quedaron verdes.

### Objetivo

En `claude/dev-role-repo-3l0kp3`, incorporá el `main` vigente a tu rama y prepará una única composición candidata que conserve todo el producto aceptado de tu HEAD `ee166b4` y los documentos canónicos podados de `main`. No resetees ni reescribas `main`, no hagas un push a `main` y no reintroduzcas historia en `NOW.md`, `PARA-DEV.md` o auditorías. Tu nuevo `PARA-PM.md` debe ser un informe corto de esta entrega.

El merge en seco no mostró conflictos textuales, pero eso no prueba compatibilidad funcional. Revisá especialmente contrato Backend/Frontend de Administración, navegación/continuaciones, fotos, cuenta, calificaciones, cotización, filtros y COPY.

### Dos correcciones de puerta dentro de la candidata

1. Corregí las seis violaciones heredadas de contraste en los paneles con el cambio visual mínimo. `a11y` y contraste deben quedar verdes; no rediseñes.
2. Aislá el arnés para que 165/166 no dependan de un JWT vencido por la duración de la suite y 167/168 no hereden el presupuesto antifuerza-bruta consumido por otros casos. La corrección vive en el arnés o en su orquestación: **no aumentes TTL, no relajes ni desactives el rate-limit de producción, no agregues bypass de test al producto**.

Si 114, 131, 143 u otro caso queda rojo, reproducilo aislado y clasificá con evidencia; no lo tapes como «conocido» ni cambies producto sólo para silenciarlo.

### Entrega y puertas

- Commits separados cuando corresponda: composición, corrección visual/arnés e informe.
- Entregá un **SHA final único**. Desde base Docker limpia corré la suite completa de 168 casos sobre ese SHA y guardá log recuperable.
- Corré lint, TypeScript, `node --check scripts/smoke.mjs`, a11y, contraste y `diff-check`.
- Informá base exacta, commits incluidos, diff final, resultados y cualquier rojo con su reproducción focal.
- No desplegues, no toques Railway, datos remotos, secretos o pagos y no empieces `CAT-PAGE-1`. Frená al entregar: la PM repetirá la suite completa desde otra base limpia sobre el mismo SHA.

Railway queda fuera de esta tarea: hoy Frontend y Backend siguen `main` con auto-deploy y sin esperar CI, publican SHAs distintos y no tienen backups. Por eso la candidata no puede subir a `main` todavía.

---

## 2026-09-12 — DEVOLUCIÓN 1

**Decisión: DEVOLVER `INTEGRATION-CANDIDATE-1` en `fcea099`.** No integres ni despliegues. El merge sí preservó el producto de `ee166b4`; la devolución se limita a cuatro defectos de puerta y al canal de entrega.

### Evidencia PM

- Suite completa independiente desde base Docker aislada: **165/168**. Rojos 114, 167 y 168. Log: `/private/tmp/topgreen-pm-integration-suite-fcea099.log`.
- Después del 134, la salida afirmó «la API se reinició», pero `topgreen-api` conservó el mismo ID y `StartedAt=2026-09-12T20:14:56.246290658Z`, con `RestartCount=0`. En ese estado el 167 perdió la continuación de compra y el 168 recibió HTTP 429.
- Focal 114+167+168 desde otra base limpia, sin correr el 134: **1/3**. El 167 pasó; el 168 recibió una respuesta sin `notifications`; el 114 repitió «el titular no ve sus cargas declaradas». Log: `/private/tmp/topgreen-pm-integration-focal-114-167-168.log`.
- `PARA-PM.md` en `696f933` tiene 396 líneas: agregó el informe nuevo sobre las 245 de `main`, aunque el propio texto afirma que los informes anteriores salieron.

### Correcciones requeridas

1. **Reinicio real y verificable.** El aislamiento posterior al 134 debe funcionar tanto con API nativa como con la API Docker del lanzador oficial. No alcanza que un `curl` encuentre viva la API anterior: si el proceso/servicio que conserva el contador no cambió, el comando debe fallar y la suite no puede anunciar éxito. No subas TTL, no relajes el rate-limit y no agregues bypass de prueba al producto.
2. **Caso 168 sin carrera.** La espera de la lista de notificaciones debe distinguir exactamente su request de `/notifications/unread-count`, validar la forma real de la respuesta y conservar el negativo que evita aceptar el vacío transitorio. No aflojes la afirmación.
3. **Caso 114.** Reproducí el rojo repetido y explicá la causa. Corregí producto o arnés según corresponda; no lo clasifiques como «intermitente» sin evidencia discriminante.
4. **Contraste del selector.** Corregí `.elegida`, que hoy queda en 2,61:1, y extendé la puerta para visitar el selector con estrellas elegidas. Es la misma causa de contraste ya trabajada, no un rediseño.
5. **Canal vivo.** Reemplazá todo el cuerpo anterior de `PARA-PM.md`; no agregues otro informe arriba. Debe quedar únicamente el encabezado del canal y el informe breve de esta devolución. LOGO, cuenta de prueba e informes anteriores permanecen en Git y no van en la entrega vigente.

### Consolidación de proceso incluida en esta devolución

Esto no abre otra tarea ni amplía producto. La PM ya consolidó `CRONOGRAMA.md`,
`ONBOARDING-PM.md`, `ONBOARDING-DEV.md` y `NOW.md`. En esta misma candidata te
corresponden sólo estos deltas:

1. **`AGENTS.md`:** dejalo como disparador breve de relevo y enlace al
   onboarding PM completo. No dupliques ahí el orden de precedencia ni el
   procedimiento: la autoridad ya está separada por tipo de pregunta en
   `ONBOARDING-PM.md`.
2. **Puertas de accesibilidad:** hacé que `scripts/a11y.mjs` y
   `scripts/contraste.mjs` compartan una única lista/base de superficies. Sumá
   los estados interactivos pertinentes y, en particular, el selector con
   estrellas elegidas. El negativo debe detectar el 2,61:1 actual y quedar verde
   con la corrección mínima. Sin dependencia nueva ni refactor amplio.
3. **`PARA-PM.md`:** reemplazá el cuerpo y abrí el informe con una ficha fija:
   rama, HEAD del informe, SHA candidato de producto/arnés, SHA efectivamente
   probado, resultado y prueba Git de que cualquier delta posterior al SHA
   probado es sólo documental. Un informe `.md` posterior no exige repetir la
   suite.

No edites otros documentos PM. `node --check` es un preflight barato cuando
cambia `smoke.mjs`; no hace falta repetirlo después de una suite sobre el mismo
SHA sólo para acumular evidencia.

Primero corré focales discriminantes. Después entregá un nuevo SHA candidato único y repetí la suite completa Dev desde base limpia más las compuertas ya pedidas. Si tu entorno no tiene Docker, decilo de forma explícita; la PM repetirá la ruta Docker sobre el mismo SHA. No empieces `CAT-PAGE-1` ni otra tarea.
