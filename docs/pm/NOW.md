# Estado actual

Actualizado: 2026-09-13.

`NOW.md` contiene sólo estado vigente, restricciones vivas, bloqueos y próxima acción. La historia anterior permanece en Git; la instantánea previa a esta poda está en `ab4165fc`.

## Resumen ejecutivo

- **Fase contractual:** Fase 2 — Desarrollo base, semana 4. Ventana contractual: 04/09–24/09. El proyecto está funcionalmente adelantado en varias áreas; las fechas son ventanas/puertas contractuales, no una prohibición de terminar piezas antes.
- **`main`:** sin cambios de producto desde `3064f10`; el delta actual es sólo documentación PM. Sigue conectado al auto-deploy de Railway, por lo que no se integra producto ahí todavía.
- **Rama Dev:** `claude/dev-role-repo-3l0kp3`, HEAD de informe `ad914a3`; candidata de producto/arnés `c565e6e`, aceptada en rama y no integrada ni desplegada.
- **Última decisión PM:** `INTEGRATION-CANDIDATE-1` **ACEPTADA** en revisión 3. La composición queda congelada en `c565e6e`; no autoriza integración ni despliegue.
- **Tarea activa:** `AGENTS-CONSOLIDATION-1`, responsable Dev. Debe preparar desde `main` una pieza exclusivamente documental que lleve el disparador consolidado de `c565e6e` y preserve la sección local de eficiencia de chats. No autoriza producto, integración de la candidata ni despliegue.

## Última aceptación PM relevante

`INTEGRATION-CANDIDATE-1` quedó aceptada en rama Dev: producto/arnés `c565e6e`, informe `ad914a3`. No está integrada ni desplegada.

Las aceptaciones anteriores y sus reproducciones son historia consultable en Git y en los documentos de evidencia; no se vuelven a transcribir en este archivo.

## Estado de integración

La composición candidata queda **aceptada** en `c565e6e`. La evidencia independiente PM se compone sin ocultar los SHA:

- suite completa desde base Docker limpia sobre `e0cdfe9`: **168/169**; 114, 131, 167 y 168 pasaron, y el único rojo fue el caso 169 por exigir una API nativa simultánea;
- durante esa suite, después del 134, `topgreen-api` cambió de PID `65908` a `89335` y de `StartedAt=2026-09-13T12:49:48.468708656Z` a `2026-09-13T13:02:32.238270514Z`; el reinicio Docker fue real;
- Git demuestra que `c565e6e` sólo cambia el caso 169 respecto de `e0cdfe9`; no toca producto ni los casos 1–168. `ad914a3` agrega únicamente el informe;
- focal 169 PM sobre `c565e6e`, desde otra base Docker limpia: **1/1**. Los tres negativos rechazaron identidad sin cambio, servicio no identificable y puerto servido por otro proceso; el camino real cambió `topgreen-api` de PID `45076` a `45360` y también cambió `StartedAt`;
- sintaxis de `smoke.mjs` y `diff-check`: verdes. A11y y contraste ya habían quedado verdes en `e0cdfe9` y no se repitieron porque el delta R3 sólo toca el caso 169.

La suma de la corrida completa y el focal sobre el único delta cubre los **169
casos** de la candidata final. La evidencia durable son los SHA, resultados y
negativos anteriores; los logs locales fueron apoyo de revisión y no son una
dependencia recuperable del cierre.

La deuda de composición quedó cerrada: `c565e6e` incorpora `main` y el trabajo
aceptado, y ya no hay diferencias de prueba sin clasificar. El SHA queda
congelado; un commit documental nuevo en `main` no lo invalida, pero cualquier
cambio de producto exige recomposición y prueba antes de integrar.

El inventario confirmó que `main` es hoy la rama de producción de ambos servicios y que el auto-deploy está activo sin esperar CI. Por eso **no se adopta todavía** `main = integración`: la composición candidata se prepara y prueba en la rama Dev. La migración recomendada a `main = integración aceptada` / `release = producción` queda retenida hasta resolver backups y ejecutar un cambio operativo controlado; si se adopta, `release` sólo puede avanzar a un SHA ya contenido en `main` y no lleva commits exclusivos.

## Pendientes canónicos adoptados

- **Relevo:** `main` todavía conserva el `AGENTS.md` anterior y la consolidación
  vive sólo en `c565e6e`. Además, el árbol de Emi tiene una sección local sin
  commit sobre eficiencia de chats. `AGENTS-CONSOLIDATION-1` debe producir desde
  `main` un archivo único que combine ambos cambios sin tocar producto.
- **Carrito conservado:** si una sesión inválida deja ítems locales, la persona
  debe poder reabrir el carrito sin sesión; continuar compra abre el Login y
  conserva la intención. Decisión registrada en `DECISIONS.md` y ejecución en
  `POST-INTEGRATION-CLEAR-1`, después de integrar la candidata.
- **FAQ de pagos:** «¿Cuáles son las formas de pago?» debe mencionar
  transferencia directa y Mercado Pago cuando el vendedor lo tenga habilitado.
  Se corrige en la misma pieza posterior, sin reabrir `c565e6e`.
- **Backup/restauración:** `BACKUP-RESTORE-1` queda en cola inmediatamente
  después de la consolidación de `AGENTS.md`.

## Railway — inventario 2026-09-12 y deuda viva

Inventario de sólo lectura del proyecto `strong-playfulness`, entorno `production`:

- servicios en línea: Frontend `yneratopgreen`, Backend `Backend` y base `PostGIS`;
- Frontend y Backend toman `Memu007/yneratopgreen`, rama `main`, con auto-deploy activo y `Wait for CI` apagado;
- Frontend público `https://yneratopgreen-production.up.railway.app`, desplegado desde `b26d8ad`; Backend público `https://backend-production-ba84.up.railway.app`, desplegado y reportado por `/api/health` en `2877d2a`;
- los watch paths son separados (`src/public/...` para Frontend y `backend/**` para Backend), por lo que Railway publica composiciones parciales: el entorno actual **no converge en un único SHA**;
- `VITE_API_URL` y `VITE_IMAGES_URL` apuntan al Backend vigente;
- CORS contiene el dominio histórico y el dominio público actual, pero `FRONTEND_URL` todavía apunta al dominio histórico `ynerav.up.railway.app`; queda como deuda de configuración, sin corregir en este inventario;
- Backend usa almacenamiento local con volumen `backend-volume` de 5 GB montado en `/data`; `UPLOAD_DIR=/data/uploads` y `EMAIL_OUTBOX_DIR=/data/outbox` quedan persistentes allí;
- PostGIS tiene `postgis-volume` de 5 GB montado en `/var/lib/postgresql/data`;
- no hay backups/PITR activos ni restauración ejercitada. Railway los presenta como función de plan superior; esto bloquea tratar el entorno como producción aceptada y cualquier migración riesgosa;
- `MP_CHECKOUT_HABILITADO=false`, verificado sin exponer secretos.

El 2026-09-11 se corrigió el incidente CORS que producía `Failed to fetch`; el inventario confirma que el dominio actual sigue permitido. No se cambió Railway, código, datos ni pagos durante esta revisión.

Runtime no es sólo SHA: CORS, SMTP, dominios y variables pueden romper una composición correcta. Todo cambio operativo debe quedar registrado sin secretos.

## Mercado Pago — pendiente externo

El código de checkout existe, pero la homologación real no está cerrada.

Dos intentos controlados anteriores no demostraron el flujo porque el OAuth enlazó un usuario real de Emi en lugar de un vendedor de prueba. No se ejecutó pago.

Falta demostrar, con **vendedor de prueba correcto + comprador de prueba**:

- pago aprobado;
- webhook firmado;
- decremento de stock exactamente una vez;
- rechazo/cancelación segura;
- reconciliación/expiración según el flujo definido.

Adquirir las cuentas/credenciales de prueba es dependencia humana. No enlazar OAuth, habilitar la bandera ni ejecutar pagos hasta que la PM abra formalmente esa ejecución y Emi autorice el paso correspondiente.

## Producción — puertas pendientes

De la puerta contractual completa, hoy siguen vivos estos bloqueos:

- política de ramas/deploy resuelta e integración controlada de la candidata ya aceptada `c565e6e`;
- backups con restauración ensayada; la persistencia ya existe pero no sustituye backup;
- SMTP real para el flujo de validación por correo; `outbox` no satisface producción;
- configuración y secretos revisados sin exponer valores;
- homologación Mercado Pago con cuentas de prueba correctas;
- red-team final, retiro/rotación de datos y credenciales demo, y convergencia de Frontend/Backend en el SHA de release;
- documentación de despliegue, capacitación, accesos administrativos y propiedad/pago de Railway y dominio acordados.

Después de una migración de esquema no se hace rollback ciego sólo de código. La recuperación normal es forward-fix; un downgrade necesita procedimiento probado y backup recuperable.

## Restricciones operativas

- PM sólo modifica `docs/pm/` durante el flujo normal; no implementa producto.
- Dev no integra ni despliega sin tarea explícita.
- El alcance y sus límites se consultan en `CONTRATO.md`, `ALCANCE-Y-LIMITES.md` y `DECISIONS.md`; no se duplican en este estado vivo.
- Auditorías externas son consultivas; la PM decide qué adopta.
- Un documento de auditoría no se convierte en una fuente de verdad paralela.
- `docs/PROJECT_STATUS.md` es histórico y no se usa como estado.
- Los fósiles `docs/PM_ROADMAP.md` y `docs/PM_DEV_GUIDE.md` se retiraron en la poda documental; su historia sigue en Git.
- No copiar secretos ni credenciales a documentación.

## Próxima secuencia

1. Dev entrega `AGENTS-CONSOLIDATION-1` desde `main`; PM revisa el diff y recién entonces autoriza su integración documental.
2. Mantener congelada `c565e6e`: no integrar ni desplegar mientras `main` siga conectado al auto-deploy sin backups.
3. Dev entrega `BACKUP-RESTORE-1`; PM reproduce una restauración local completa y clasifica cualquier dependencia externa.
4. Emi autoriza la opción de backup administrado/costo y la operación remota; se ensaya una restauración recuperable antes de usar datos reales.
5. Ejecutar de forma controlada la separación `main`/`release` e integrar exactamente la candidata aceptada; cualquier cambio de producto exige recomposición y prueba.
6. Ejecutar `POST-INTEGRATION-CLEAR-1` y después abrir `CAT-PAGE-1` para continuar el roadmap contractual.
7. Mercado Pago, red-team y producción permanecen al final de la secuencia acordada, sin esperar artificialmente a una fecha si las dependencias ya están listas.
