# Estado actual

Actualizado: 2026-09-12.

`NOW.md` contiene sólo estado vigente, restricciones vivas, bloqueos y próxima acción. La historia anterior permanece en Git; la instantánea previa a esta poda está en `ab4165fc`.

## Resumen ejecutivo

- **Fase contractual:** Fase 2 — Desarrollo base, semana 4. Ventana contractual: 04/09–24/09. El proyecto está funcionalmente adelantado en varias áreas; las fechas son ventanas/puertas contractuales, no una prohibición de terminar piezas antes.
- **`main`:** `a5daf44` al comenzar esta revisión; contiene la poda documental de 2026-09-11 y no cambia la composición de producto.
- **Rama Dev:** `claude/dev-role-repo-3l0kp3`, HEAD `ee166b4`; entrega de producto/regresión `9f25d59`, todavía no integrada ni desplegada.
- **Última decisión PM:** `COPY-CLEAR-1` **ACEPTADA** en rama Dev.
- **Tarea activa:** `INTEGRATION-CANDIDATE-1`, responsable Dev. Debe componer `main` vigente con el trabajo aceptado, corregir las dos deudas de puerta y entregar un único SHA para suite completa Dev y PM; no autoriza despliegue.

## Aceptación vigente — COPY-CLEAR-1

Producto/regresión `9f25d59`; informe Dev `ee166b4`. La PM revisó el diff exacto del commit: 14 archivos, sin Backend, schema, pagos, Railway ni dependencias. Los seis puntos quedan dentro del alcance: búsqueda por acción, FAQ sin planes/comisiones inventadas, salida honesta para contraseña olvidada, voseo es-AR, estados visibles traducidos con tokens API intactos y conservación de marca→Inicio.

Evidencia independiente PM sobre checkouts temporales aislados:

- 156 + 160 + 168 desde base Docker limpia: **3/3**;
- 134 + 167 + 168 desde otra base limpia: **3/3**;
- 165 + 166 desde otra base limpia: **2/2**;
- suite completa PM: **163/168**; rojos 114, 165, 166, 167 y 168, todos clasificados fuera de la pieza por reproducciones focales o por el mecanismo del arnés;
- a11y en entrega y en su padre `fe822d0`: mismo resultado, 64/64 pantallas y las mismas seis violaciones `serious` de contraste en paneles;
- lint, TypeScript, sintaxis y `diff-check`: verdes.

Los 165/166 de la suite completa fallaron con token vencido tras la corrida larga y pasaron 2/2 aislados. El 167/168 heredó el presupuesto de intentos consumido por la suite; ambos pasan aislados junto al 134. No se cambió ni se debe debilitar el límite antifuerza-bruta de producción. El 114 es intermitencia heredada del arnés y no toca ningún archivo de la entrega.

Logs persistentes: `/private/tmp/topgreen-pm-copy-focal.log`, `/private/tmp/topgreen-pm-copy-a11y-delivery.log`, `/private/tmp/topgreen-pm-copy-a11y-base.log`, `/private/tmp/topgreen-pm-copy-ratelimit-134-167-168.log`, `/private/tmp/topgreen-pm-copy-suite.log` y `/private/tmp/topgreen-pm-copy-165-166.log`.

Hallazgos vivos separados: corregir el contraste heredado de los paneles y aislar el presupuesto temporal/antifuerza-bruta del arnés antes de exigir una doble suite 168/168 sobre la composición candidata. Ninguno invalida `COPY-CLEAR-1`; ambos sí bloquean declarar verde integral.

## Última aceptación PM relevante

`COPY-CLEAR-1` quedó aceptada en rama Dev: producto/regresión `9f25d59`, informe `ee166b4`. No está integrada ni desplegada.

Las aceptaciones anteriores y sus reproducciones son historia consultable en Git y en los documentos de evidencia; no se vuelven a transcribir en este archivo.

## Estado de integración

La rama Dev acumuló trabajo aceptado y pendiente sin integrar porque históricamente `main` también se usó como fuente de despliegue. El resultado es una divergencia grande y una composición que debe tratarse explícitamente.

Reglas para cerrar esa deuda:

- no integrar la rama Dev completa “porque sí”;
- construir una **composición candidata** que incorpore `main` actual y el trabajo Dev aceptado;
- un commit documental nuevo en `main` no invalida por sí solo una composición de producto previamente probada; un cambio de producto sí exige recomposición/retest;
- Dev corre suite completa sobre el SHA candidato desde base limpia;
- PM corre suite completa independiente sobre **el mismo SHA** desde otra base limpia;
- si un rojo aparece sólo en un entorno, reproducirlo aislado en ambos antes de clasificarlo;
- hasta resolver diferencias, el candidato no está aceptado.

El inventario confirmó que `main` es hoy la rama de producción de ambos servicios y que el auto-deploy está activo sin esperar CI. Por eso **no se adopta todavía** `main = integración`: la composición candidata se prepara y prueba en la rama Dev. La migración recomendada a `main = integración aceptada` / `release = producción` queda retenida hasta resolver backups y ejecutar un cambio operativo controlado; si se adopta, `release` sólo puede avanzar a un SHA ya contenido en `main` y no lleva commits exclusivos.

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

## Alcance contractual vivo

Fuente vinculante: `CONTRATO.md`. Guardas: `ALCANCE-Y-LIMITES.md`.

Puntos que no deben volver a inferirse desde roadmaps históricos:

- comprador y vendedor/prestador son los roles contractuales; transportista es un tipo especial de proveedor;
- búsqueda por categoría y ubicación;
- logística por cercanía, con cobertura/capacidad y selección o contacto directo;
- Mercado Pago checkout básico como resultado contractual;
- transferencia directa al vendedor con CBU/Alias, comprobante y validación manual;
- TopGreen/AgroBoeda no recibe, retiene, divide ni gira fondos de terceros;
- OAuth de vendedor con comisión marketplace cero es mecanismo técnico, no una feature comercial adicional;
- PostgreSQL + PostGIS;
- QA, despliegue, accesos administrativos, capacitación y documentación de despliegue forman parte del cierre contractual.

Suscripciones, planes, mensajería interna, tierras/parcelas, chatbot/IA y otras ampliaciones no bloquean el MVP salvo que código ya existente introduzca riesgo real.

## Producción — puertas pendientes

Antes de una publicación final deben quedar demostrados, como mínimo:

- composición candidata integrada y doble suite independiente sobre el mismo SHA;
- inventario Railway y política de ramas/deploy resuelta;
- backups y persistencia;
- SMTP real para el flujo de validación por correo; `outbox` no satisface producción;
- secretos/configuración revisados;
- homologación Mercado Pago real;
- auditoría general + red-team de seguridad final;
- datos/demo/credenciales públicas retirados o rotados;
- documentación de despliegue, capacitación y accesos administrativos;
- propiedad/pago de Railway y dominio acordados para el cierre.

Después de una migración de esquema no se hace rollback ciego sólo de código. La recuperación normal es forward-fix; un downgrade necesita procedimiento probado y backup recuperable.

## Restricciones operativas

- PM sólo modifica `docs/pm/` durante el flujo normal; no implementa producto.
- Dev no integra ni despliega sin tarea explícita.
- Auditorías externas son consultivas; la PM decide qué adopta.
- Un documento de auditoría no se convierte en una fuente de verdad paralela.
- `docs/PROJECT_STATUS.md` es histórico y no se usa como estado.
- Los fósiles `docs/PM_ROADMAP.md` y `docs/PM_DEV_GUIDE.md` se retiraron en la poda documental; su historia sigue en Git.
- No copiar secretos ni credenciales a documentación.

## Próxima secuencia

1. Dev prepara `INTEGRATION-CANDIDATE-1` en su rama, sin tocar `main` ni Railway.
2. En la candidata corrige el contraste heredado y el aislamiento/caducidad del arnés, sin debilitar seguridad.
3. Dev corre suite completa desde base limpia sobre el SHA candidato.
4. PM corre otra suite completa independiente sobre **el mismo SHA**.
5. Resolver backups y después ejecutar de forma controlada la separación `main`/`release`; hasta entonces no desplegar la candidata.
6. Después de converger integración, continuar el roadmap contractual; Mercado Pago/red-team/producción permanecen al final de la secuencia acordada, sin esperar artificialmente a una fecha si las dependencias ya están listas.
