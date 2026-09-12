# Arranque para una dev nueva

Leé este archivo completo una vez. Después tu día a día pasa por `PARA-DEV.md` y, cuando haga falta, `NOW.md` y los documentos que la tarea cite.

El chat no es fuente de verdad. La tarea activa, Git y la evidencia reproducible sí.

## Rol

- **Dev:** implementa la tarea activa, prueba y entrega evidencia. No amplía alcance ni decide prioridades por iniciativa propia.
- **PM:** define qué problema se resuelve, prioridad, límites y aceptación. No escribe código de producto.
- **Owner — Emi:** resuelve decisiones reservadas, comerciales, producción y excepciones fuera del proceso normal.
- **QA/auditor:** revisión independiente; descubre y recomienda, no asigna trabajo por sí sola.

Si una instrucción contradice contrato, una decisión vigente o evidencia actual, frená y reportá la contradicción antes de construir sobre ella.

## Antes de cada tarea

```bash
git pull origin main
cat docs/pm/PARA-DEV.md
```

Luego:

1. confirmá rama y SHA base;
2. leé sólo las rutas/decisiones citadas por la tarea;
3. inspeccioná el flujo real antes de editar;
4. si el árbol no está limpio, no pises cambios ajenos;
5. no empieces otra tarea en paralelo.

## Desarrollo local

La guía canónica es `README_LOCAL_SETUP.md`.

Stack actual:

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Backend | FastAPI + Python |
| Base | PostgreSQL + PostGIS |
| Migraciones | Alembic |
| Pruebas end-to-end | Playwright/Chromium mediante `scripts/smoke.mjs` |

No copies números fijos de casos desde este onboarding: la suite crece. Usá la tarea y el estado actual del repo.

## Calidad mínima de una entrega

Para una pieza de producto:

1. reproducí el defecto o propiedad discriminante cuando corresponda;
2. implementá sólo el alcance pedido;
3. auto-revisá el diff completo contra el SHA base;
4. corré focales y puertas proporcionales;
5. cuando la tarea lo pida o el riesgo lo justifique, corré una suite completa desde base limpia;
6. informá SHA exacto, qué corriste, resultado, únicos rojos, qué no corriste y riesgos.

No repitas una prueba hasta obtener verde sin explicar por qué falló antes. Un rojo de entorno se diagnostica y se declara; no se oculta.

## Canal PM ↔ Dev

| Archivo | Quién escribe | Uso |
|---|---|---|
| `docs/pm/PARA-DEV.md` | PM | tarea activa y devoluciones de esa misma pieza |
| `docs/pm/PARA-PM.md` | Dev | entrega pendiente y evidencia |

Al terminar una pieza: commit, push y después informe. No dejes producto terminado sólo en local.

### Informe Dev → PM

Debe ser breve y autosuficiente:

1. resultado: terminado, parcial o bloqueado;
2. commit exacto y alcance real;
3. evidencia reproducible y resultado;
4. qué no se corrió;
5. desvíos o riesgos;
6. decisión concreta que necesitás, si existe, con recomendación y alternativa.

No copies historia del proyecto ni archivos enteros. Citá rutas, commits y decisiones.

## Cuándo frenar

Frená y entregá el estado actual si:

- un criterio no se puede cumplir sin cambiar alcance;
- aparece un error que exige tocar algo fuera de la tarea;
- haría falta decidir arquitectura, datos, permisos, dinero o una migración no autorizizada;
- una regresión previa aparece roja;
- la tarea es ambigua de una forma que cambia el resultado;
- necesitarías un secreto, credencial real o acción externa no autorizada.

No improvises para “destrabar”.

## Reglas permanentes

- Si no lo corriste, decí que no lo corriste.
- Una tarea activa a la vez.
- No agregar features no pedidas.
- No subir secretos ni credenciales reales.
- No copiar código, textos, marca o diseño distintivo de terceros.
- El contrato es a precio fijo: una mejora opcional se propone, no se implementa sola.
- `docs/PROJECT_STATUS.md` es histórico y no se usa como estado.
- Cuando documentación y código se contradicen, reportá la discrepancia; para comportamiento técnico manda la evidencia actual, y para alcance manda el contrato/decisiones vigentes.

## Particularidades del repo

- No hay que asumir un router tradicional: verificá la navegación real antes de tocarla.
- Los filtros geográficos, catálogo, estados y permisos tienen contratos de datos específicos; no adivines ids/nombres/tokens: inspeccioná Backend y pruebas.
- No debilites controles de producción para hacer pasar una prueba. Si un test contamina otro —por ejemplo rate-limit—, primero corregí aislamiento/reset del arnés.
- Cambios de schema, dinero, autenticación, permisos, órdenes, stock, datos o seguridad necesitan revisión mayor y evidencia más fuerte.

## Producción y Railway

La Dev no despliega ni cambia Railway salvo tarea explícita. Antes de una publicación deben conocerse rama/SHA por servicio, auto-deploy, PostGIS, backups, volumen persistente y configuración relevante.

Runtime no es sólo código: CORS, SMTP, variables y dominios pueden romper una composición con SHA correcto. No copies valores secretos a documentación.

Después de una migración de esquema no se hace rollback ciego sólo de código; un downgrade requiere procedimiento probado y backup recuperable.

## Alcance y fuentes

Abrí bajo demanda:

| Archivo | Uso |
|---|---|
| `PARA-DEV.md` | tarea actual |
| `NOW.md` | estado/bloqueos si la tarea depende de ellos |
| `CONTRATO.md` | alcance contractual |
| `ALCANCE-Y-LIMITES.md` | guardas de alcance |
| `DECISIONS.md` | decisión citada por la tarea |
| `CRONOGRAMA.md` | sólo si la pieza depende de fase/hito |
| `MATRIZ.md` | trazabilidad de requisitos |
| `REPO_MAP.md` | mapa técnico |
| `TAXONOMIA-CLIENTE.md` | categorías/subcategorías |
| `PAGOS-TRANSFERENCIA.md` | transferencia bancaria |
| `RAILWAY.md` | despliegue, sólo cuando corresponda |

La primera tarea siempre está en `docs/pm/PARA-DEV.md`.
