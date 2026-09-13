# Estado actual

Actualizado: 2026-09-13.

`NOW.md` contiene sólo estado vigente, restricciones vivas, bloqueos y próxima acción. La historia anterior permanece en Git; la instantánea previa a esta poda está en `ab4165fc`.

## Resumen ejecutivo

- **Fase contractual:** Fase 2 — Desarrollo base, semana 4. Ventana contractual: 04/09–24/09. El proyecto está funcionalmente adelantado en varias áreas; las fechas son ventanas/puertas contractuales, no una prohibición de terminar piezas antes.
- **`main`:** `24dcca8`; producto integrado en `b8447a3` y cierre PM documental posterior. Incluye el `AGENTS.md` consolidado y preserva la regla local de eficiencia de chats.
- **Rama Dev:** `claude/dev-role-repo-3l0kp3`, informe R3 `5e84385`; candidata `f3e9d54`, devuelta y no integrada. La rama paralela `codex/backup-restore-1` queda descartada por duplicación.
- **Última decisión PM:** `BACKUP-RESTORE-1` R3 **DEVUELTA**. La arquitectura Docker ya aísla el destino, pero la corrida real falla porque valida un dump PostgreSQL 16 con `pg_restore` 14 del anfitrión; faltan además las guardas finales de servidor definitivo y etiquetas en todo borrado.
- **Tarea activa:** `BACKUP-RESTORE-1` R4, responsable Dev. Debe cerrar compatibilidad PostgreSQL y guardas de limpieza, y dejar lista la misma ruta para reproducción Docker real, sin tocar Railway ni datos remotos.

## Última aceptación PM relevante

`INTEGRATION-CANDIDATE-1` quedó aceptada en rama Dev y se integró a `main` mediante `b8447a3`: producto/arnés `c565e6e`, informe `ad914a3`. El despliegue automático fue autorizado expresamente por Emi el 2026-09-13; Frontend y Backend ya fueron verificados en esa misma revisión.

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

La deuda de composición quedó cerrada: `c565e6e` incorpora el trabajo aceptado y
`b8447a3` lo combina con la documentación PM vigente sin cambiar ese producto.
El `diff-check` y el build de producción quedaron verdes antes del push.

`main` continúa conectado al auto-deploy de ambos servicios sin esperar CI. Emi
autorizó esta publicación como excepción consciente aun sin backup ensayado. La
migración recomendada a `main = integración aceptada` / `release = producción`
sigue pendiente: publicar no equivale a aceptar la operación productiva ni
resuelve backups, SMTP, secretos, pagos o recuperación.

## Pendientes canónicos adoptados

- **Relevo:** cerrado en `b8447a3`; `main` contiene el disparador consolidado y
  la regla local de eficiencia de chats.
- **Carrito conservado:** si una sesión inválida deja ítems locales, la persona
  debe poder reabrir el carrito sin sesión; continuar compra abre el Login y
  conserva la intención. Decisión registrada en `DECISIONS.md` y ejecución en
  `POST-INTEGRATION-CLEAR-1`, después de integrar la candidata.
- **FAQ de pagos:** «¿Cuáles son las formas de pago?» debe mencionar
  transferencia directa y Mercado Pago cuando el vendedor lo tenga habilitado.
  Se corrige en la misma pieza posterior, sin reabrir `c565e6e`.
- **Backup/restauración:** `BACKUP-RESTORE-1` es la tarea activa. La publicación
  autorizada no reduce esta deuda ni habilita migraciones riesgosas.

## Railway — inventario actualizado 2026-09-13 y deuda viva

Inventario de sólo lectura del proyecto `strong-playfulness`, entorno `production`:

- servicios en línea: Frontend `yneratopgreen`, Backend `Backend` y base `PostGIS`;
- Frontend y Backend toman `Memu007/yneratopgreen`, rama `main`, con auto-deploy activo y `Wait for CI` apagado;
- Frontend público `https://yneratopgreen-production.up.railway.app` y Backend público `https://backend-production-ba84.up.railway.app` convergen en `b8447a3`; se verificaron el metadato HTML y `/api/health` después del despliegue;
- los watch paths siguen separados (`src/public/...` para Frontend y `backend/**` para Backend), por lo que Railway puede publicar composiciones parciales en cambios futuros aunque esta publicación haya convergido;
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

- política de ramas/deploy que separe integración aceptada de producción;
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

1. Dev entrega `BACKUP-RESTORE-1`; PM reproduce una restauración local completa y clasifica cualquier dependencia externa.
2. Emi decide la opción de backup administrado/costo antes de cualquier operación remota; no se usan datos reales nuevos sin recuperación demostrada.
3. Ejecutar `POST-INTEGRATION-CLEAR-1` sobre `main` y después abrir `CAT-PAGE-1` para continuar el roadmap contractual.
4. Separar de forma controlada integración y producción; cualquier cambio de producto exige nueva aceptación antes de publicar.
5. Mercado Pago, SMTP, red-team y producción aceptada permanecen al final de la secuencia acordada, sin esperar artificialmente a una fecha si las dependencias ya están listas.
