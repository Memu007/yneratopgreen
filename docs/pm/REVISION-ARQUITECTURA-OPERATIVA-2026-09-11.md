# Revisión adversarial de arquitectura operativa — 2026-09-11

Estado: **diagnóstico y decisiones provisionales; no implementar todavía**.

Objetivo: corregir la arquitectura operativa PM/Dev/Deploy sin romper el flujo actual, reducir deuda de contexto y separar claramente integración de producción.

## Hallazgos confirmados

1. `main` y `claude/dev-role-repo-3l0kp3` están fuertemente divergidos. La rama Dev contiene muchas entregas aceptadas que no están en `main`.
2. `main` hoy cumple dos funciones incompatibles: fuente de verdad del proyecto y contenido publicado. Eso incentiva retener cambios aceptados fuera de `main` para no desplegar.
3. Railway usa dos servicios del mismo repo:
   - Frontend: raíz `/`, `railway.toml`, watch sobre `src/**`, `public/**`, etc.
   - Backend: raíz `/backend`, `backend/railway.toml`, watch sobre `/backend/**`.
4. El Backend ejecuta `railway-entrypoint migrate` en `preDeployCommand`; desplegar Backend puede ejecutar migraciones.
5. `RAILWAY.md` hoy compara `origin/main` con los SHA publicados de Frontend y Backend, por lo que documenta de hecho `main = producción`.
6. Falta inventario inequívoco de los entornos Railway vigentes: dominios, proyecto, servicio, rama conectada, auto-deploy, backend consumido por cada frontend, PostGIS asociada y estado de backups.
7. Hay deuda fuerte de contexto en `NOW.md`, `PARA-DEV.md` y canales históricos. El Second Brain no tiene este problema: su diseño es pequeño y deliberadamente evita duplicar operación de los proyectos.
8. El Second Brain existe y es privado: `Memu007/ynerasecondbrain`. TopGreen ya lo referencia desde su onboarding, aunque `docs/PROJECTS.md` del Second Brain todavía figura como conexión pendiente.

## Decisiones provisionales para última ronda adversarial

### A. Separar integración de producción

Propuesta preferida:

- `main` = **integración**: todo lo aceptado por PM vive ahí.
- `release` = **producción**: única rama conectada a Railway.
- `release` nunca recibe commits propios; sólo puede avanzar a un SHA que ya exista en `main`.
- Publicar = adelantar `release` a un commit aprobado de `main`.

Flujo esperado:

```text
rama Dev/tarea → revisión PM → main → decisión de release → release → Railway
```

No implementar esta separación hasta cerrar el inventario Railway real.

### B. Regla para evitar un `main` no probado como conjunto

Una entrega sólo puede aceptarse contra el `main` vigente:

1. la rama candidata incorpora el último `main`;
2. Dev/PM prueban la tarea sobre esa composición;
3. si pasa, esa misma composición entra a `main`.

Ejemplo:

```text
main=A
B se prueba sobre A       → main=A+B
C se prueba sobre A+B     → main=A+B+C
D se prueba sobre A+B+C   → main=A+B+C+D
```

No se exige suite completa para cada cambio trivial. Los focales prueban la entrega contra la composición actual y la suite completa sigue una cadencia por riesgo, cambios transversales y pre-release.

Para sanear la divergencia acumulada actual sí corresponde una **integración excepcional + suite completa** antes de declararla cerrada.

### C. CI inicial sólo determinista

Crear, si se aprueba, un único workflow de puertas estáticas.

Entrarían inicialmente:

- `npm run build`
- `python -m compileall backend/app`
- `python -m pip check`
- `git -c core.whitespace=cr-at-eol diff --check`

No entrarían inicialmente:

- smoke completo
- a11y
- contraste
- lint mientras arrastre deuda y no esté verde

El job debe decir explícitamente que **NO corre suite, a11y ni contraste**. Un verde no debe interpretarse como QA completo.

### D. Seguridad sensible dentro de la tarea

Cuando una tarea toque auth/sesiones, permisos, identidad, dinero, datos sensibles, uploads, migraciones, borrado o infraestructura, el criterio de aceptación debe incluir el comportamiento prohibido que tiene que fallar, con rojo previo y verde posterior.

Astra no se convierte en gate rutinario. Queda para:

- ambigüedades de seguridad difíciles;
- auditorías específicas;
- red-team final / chequeo crítico.

### E. Política de modelos

Mantener en TopGreen la asignación concreta actual, pero no promover nombres de modelos al Second Brain como política institucional permanente.

Conceptualmente:

- PM residente: modelo eficiente de alto nivel.
- Dev principal: modelo fuerte de implementación.
- Extra High: sólo cuando riesgo/ambigüedad lo justifiquen.
- Auditor independiente caro: sólo para casos críticos.

Antes de escalar a Astra, la PM debe preparar un handoff compacto con problema, archivos relevantes, decisiones cerradas, evidencia, riesgo y pregunta exacta.

## NOW.md: criterio de poda

No usar un límite arbitrario de líneas.

Cada línea de `NOW.md` debe pasar esta pregunta:

> ¿Una sesión nueva que no lea esto puede tomar hoy una decisión equivocada?

Pertenece:

- tarea/entrega en curso con rama y SHA;
- bloqueos abiertos;
- decisiones pendientes de Emi;
- deuda técnica vigente sin resolver;
- restricciones que afectan hoy;
- inventario de entornos y SHA publicados;
- fase contractual y próximo hito.

Se archiva:

- entregas cerradas;
- relevos viejos;
- ensayos ya concluidos;
- historia que ya vive en commits, `REPRODUCCION-*.md` o decisiones.

Debe existir una sola sección de relevo vigente.

## Second Brain

No duplicar allí estado operativo de TopGreen.

El Second Brain debe seguir guardando sólo reglas y contexto transversal. No corresponde moverle cronograma, tareas o historial de TopGreen.

Corrección futura mínima: actualizar la conexión de TopGreen de `pendiente` a `instalado` cuando se confirme el puente actual.

## Bloqueo obligatorio antes de implementar

Cerrar primero el inventario Railway real:

```text
Frontend publicado → proyecto Railway → branch → SHA
Backend consumido  → proyecto Railway → branch → SHA
PostGIS asociada
Backups: sí/no
Auto-deploy: sí/no
Último deploy: push o redeploy manual
```

Especialmente resolver la relación entre `strong-playfulness`, `ynerav.up.railway.app` y `yneratopgreen-production.up.railway.app`.

## Última ronda adversarial pedida a PM + Dev

Ataquen especialmente A y B.

Buscar una forma concreta en que puedan producir:

- pérdida de trazabilidad;
- estado integrado pero no probado;
- deploy ambiguo;
- migración accidental;
- divergencia nueva entre `main` y `release`;
- burocracia que supere el beneficio.

Si pasan esa revisión, devolver un plan final de migración ordenado.

**No modificar ramas, Railway ni producto hasta terminar esta última revisión y tener autorización explícita de Emi.**
