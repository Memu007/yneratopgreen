# Estado actual

Actualizado: 2026-09-27.

`NOW.md` contiene sólo estado vigente, restricciones vivas, bloqueos y próxima acción. La historia anterior permanece en Git; la instantánea previa a esta poda está en `ab4165fc`.

## Resumen ejecutivo

- **Fase contractual:** Fase 3 — Buscador y catálogo, semanas 6–8 (25/09–15/10). La puerta de la Fase 2 quedó verificada el 23/09 (`REPRODUCCION-FASE-2-2026-09-23.md`). La puerta de la Fase 3 y el hito intermedio ya se aceptaron por adelantado con `npm run hito` (cierre `3580faa`, ver `MATRIZ.md`). Presentarlo a la clienta y facturarlo es decisión comercial de Emi. Las fechas no cambian.
- **`main`:** `a7e2237`, publicado el 27/09 con autorización de Emi («dale 1 y publicá»), por fast-forward desde `c92c0d7`. Suma `PUBLISH-FIELDS-1`, `REV1-PENDIENTES-1`, `NOTIF-TEXTOS-1` y `AVISOS-DE-PAGO-1`. Sin migraciones. La verificación previa fue sobre el mismo código (`c6792ff`, que difiere sólo en `docs/pm`): suite 211/212 (131 de entorno), puertas y las dos guías verdes, sin secretos ni archivos prohibidos. La red de PM no llega a `railway.app`. **Pendiente: Emi verifica en incógnito** Inicio sin publicaciones ni «Mercado activo», «publicaciones» en vez de «operaciones», Quiénes somos sin «Nuestro equipo» ni «¿Listo para transformar…?», Contacto sin preguntas frecuentes, el alta sin «Características» ni «Etiquetas» y la marca en la ficha y en «Editar». Sigue pendiente de la publicación anterior (`c92c0d7`): modelo, año y origen en el alta y el panel nuevo.
- **Rama Dev:** `claude/dev-role-repo-3l0kp3`. Todo lo aceptado está en `main` (`a7e2237`). `COBRO-CONCURRENTE-1` está asignada.
- **Última decisión PM:** `AVISOS-DE-PAGO-1` **ACEPTADA EN RAMA** (`c6792ff`, producto en `a97911b`). Rechazar una transferencia avisa a quien compra; aprobarla, o que Mercado Pago acredite, avisa a las dos partes, una sola vez por orden. Seis negativos en rojo, dos de PM. Suite 211/212 (131 de entorno), puertas y guías verdes. **P1 confirmado por PM y previo a la pieza:** tres confirmaciones a la vez del mismo pago de Mercado Pago cuelgan la API. Bloquea habilitar Mercado Pago. Evidencia en `REPRODUCCION-AVISOS-DE-PAGO-1-2026-09-27.md`.
- **Tarea activa:** `COBRO-CONCURRENTE-1`: que confirmaciones de Mercado Pago a la vez no cuelguen la API (el P1). Asignada el 27/09 por decisión de Emi («dale 1»).
- **Corrección de método PM (25/09):** las aceptaciones de la marca no verificaron la carga de datos en producción. Desde ahora, toda pieza que agrega una lista o un catálogo tiene que decir cómo llega a producción, y PM lo comprueba con un caso sobre una base sin siembra.
- **#9, atributos por rubro: absorbido (decisión de Emi, 25/09).** Tercer nivel de la taxonomía de la clienta como filtro en todos los rubros, potencia de tractores, modelo y año en maquinaria, y origen declarado por quien vende. «Inversores» queda afuera. Va después de `MERCADO-UNICO-1` y antes de las guías de uso.
- **Devolución de la clienta del 20/09 — estado (27/09):**
  - publicados: #1, #7, #8 y #9; y el 27/09 (`a7e2237`), #2, #3, #4, #6, #11a, #13, #14 y sin «comisión» visible;
  - **respuestas de Emi (27/09, en `DECISIONS.md`):** #5 lo habla Emi con la clienta; #10 no se trabaja por ahora; #12 espera el texto de la clienta; #11b, retener fondos no se hace y ya se le explicó. Cómo se explica que AgroBoeda cobra sigue sin decidir; hoy el sitio no lo menciona;
  - **logística en los filtros:** Emi quiere mejorarla; la pieza está por definir. **Publicaciones de prueba (opción 1, Emi, 27/09):** se cargan a mano en el sitio publicado, sin fotos, con cuentas creadas desde el panel. La lista y lo que tiene que mostrar cada filtro están en `PUBLICACIONES-DE-PRUEBA-2026-09-27.md`. La parte del transportista espera el correo, porque un transportista sólo se crea registrándose. Hoy la logística vive en dos lugares que no se conectan: la publicación de logística y la cuenta de transportista que se elige al comprar;
  - **#15, el correo:** Emi propone empezar con una cuenta de Gmail propia mientras la clienta arma la casilla en DonWeb. El código lo admite sin cambios (SMTP con STARTTLS en el 587). Dos trabas de Railway, que valen también para DonWeb: según su documentación, el SMTP saliente sólo está habilitado en el plan Pro (PM no pudo abrir la página: lo vio en el buscador y en el foro de Railway). Emi dice que su plan es el de unos 20 USD, que es el Pro; la prueba de registro lo confirma, y el 13/09 `FRONTEND_URL` apuntaba al dominio viejo, así que el enlace no llevaría al sitio. Según ese inventario el sitio usa `outbox`: dice que mandó el correo y no lo manda. Mientras tanto, una cuenta creada desde el panel entra sin confirmar el correo.

  El #3 quedó sin asignar entre el 20/09 y el 27/09 por un descuido de PM.
- **Escalado a Emi:** la regla «el teléfono no sale de la API sin suscripción activa» choca con la decisión del 05/08, que pasó suscripciones y candados por plan a Fase 6. Hoy el teléfono no se publica en el Mercado ni en las fichas, pero sí lo ven las dos partes de una orden y quien compra al elegir transportista, sin suscripción. El transportista no recibe el de quien compra.

## Última aceptación PM — AVISOS-DE-PAGO-1

Quien compra se entera cuando le rechazan o le aprueban la transferencia, y
las dos partes cuando Mercado Pago acredita el pago, una sola vez por orden.
«¡Venta confirmada!» pasa a «Venta pagada». Si escribir el aviso falla, se
pierde el aviso y no el pago. Aceptada en rama sobre `c6792ff`, **sin
publicar**.

## Aceptación anterior — PUBLISH-FIELDS-1 y REV1-PENDIENTES-1

El alta ya no ofrece lo que no se guardaba, y la marca se ve en la ficha y se
cambia en «Editar». El sitio dice «publicaciones» en vez de «operaciones».
Además, se resuelve lo que la devolución de la clienta del 20/09 pedía sin
decisiones pendientes:

- Inicio sin publicaciones;
- «Precio y modalidad»;
- el radio del transportista;
- una sola invitación;
- sin preguntas frecuentes, sin «Nuestro equipo» y sin «comisión».

Aceptadas en rama sobre `4d5e409`, **sin publicar**.

## Aceptaciones anteriores

Cada pieza tiene su evidencia en `docs/pm/REPRODUCCION-<PIEZA>-<fecha>.md` y
su fila en `ROADMAP-CIERRE-MVP-2026-08-31.md`. No se transcriben acá. Los
riesgos que dejaron abiertos están en «Pendientes canónicos adoptados».

| Pieza | Estado | Evidencia |
|---|---|---|
| `AVISOS-DE-PAGO-1` | publicada en `a7e2237` | `REPRODUCCION-AVISOS-DE-PAGO-1-2026-09-27.md` |
| `NOTIF-TEXTOS-1` | publicada en `a7e2237` | `REPRODUCCION-NOTIF-TEXTOS-1-2026-09-27.md` |
| `PUBLISH-FIELDS-1` y `REV1-PENDIENTES-1` | publicadas en `a7e2237` | `REPRODUCCION-PUBLISH-FIELDS-1-Y-REV1-PENDIENTES-1-2026-09-27.md` |
| `USER-GUIDE-1` | publicada en `c92c0d7` | `REPRODUCCION-USER-GUIDE-1-2026-09-26.md` |
| `ATRIBUTOS-RUBRO-1` parte 2 | publicada en `c92c0d7` | `REPRODUCCION-ATRIBUTOS-RUBRO-1-P2-2026-09-26.md` |
| `PROD-LISTS-1` | publicada en `238d113` | `REPRODUCCION-PROD-LISTS-1-2026-09-26.md` |
| `ATRIBUTOS-RUBRO-1` parte 1 | publicada en `792d709` | `REPRODUCCION-ATRIBUTOS-RUBRO-1-P1-2026-09-25.md` |
| `MERCADO-UNICO-1` | publicada en `792d709` | `REPRODUCCION-MERCADO-UNICO-1-2026-09-25.md` |
| `COPY-AGRO-1` | publicada en `792d709` | `REPRODUCCION-COPY-AGRO-1-2026-09-25.md` |
| `BRAND-LOSS-1` | publicada en `e9cf4c6` | `REPRODUCCION-BRAND-LOSS-1-2026-09-25.md` |
| `ADMIN-PANEL-DEFECTS-1` | aceptada en rama | `REPRODUCCION-ADMIN-PANEL-DEFECTS-1-2026-09-24.md` |
| `ADMIN-GUIDE-1` | aceptada en rama | `REPRODUCCION-ADMIN-GUIDE-1-2026-09-24.md` |
| `LOCALITY-LABEL-DISPLAY-1` | aceptada en rama | `REPRODUCCION-LOCALITY-LABEL-DISPLAY-1-2026-09-24.md` |
| `LOCALITY-DEDUP-1` | aceptada en rama | `REPRODUCCION-LOCALITY-DEDUP-1-2026-09-24.md` |
| `FILTER-COLLAPSE-FOCUS-1` | aceptada en rama | `REPRODUCCION-FILTER-COLLAPSE-FOCUS-1-2026-09-24.md` |
| `PRODUCT-DETAIL-BACK-SEARCH-1` | aceptada en rama | `REPRODUCCION-PRODUCT-DETAIL-BACK-SEARCH-1-2026-09-23.md` |
| `FICHA-MOBILE-WIDTH-1` | aceptada en rama | `REPRODUCCION-FICHA-MOBILE-WIDTH-1-2026-09-23.md` |
| `MOBILE-CHECKOUT-1` | aceptada en rama | `REPRODUCCION-MOBILE-CHECKOUT-1-2026-09-23.md` |
| `MOBILE-AUDIT-FLOW-1` | aceptada en rama | `REPRODUCCION-MOBILE-AUDIT-FLOW-1-2026-09-23.md` |
| `PRODUCT-DETAIL-PAGE-1` | aceptada en rama | `REPRODUCCION-PRODUCT-DETAIL-PAGE-1-2026-09-23.md` |
| `ADMIN-MOBILE-ACCESS-1` | aceptada en rama | `REPRODUCCION-ADMIN-MOBILE-ACCESS-1-2026-09-23.md` |
| `CART-PRODUCT-QUERY-1` | aceptada en rama | `REPRODUCCION-CART-PRODUCT-QUERY-1-2026-09-22.md` |
| `CART-IMG-QUERY-1` | aceptada en rama | `REPRODUCCION-CART-IMG-QUERY-1-2026-09-22.md` |
| `PRIMARY-IMAGE-INTEGRITY-1` | aceptada en rama; trae migración, espera la puerta de recuperación | `REPRODUCCION-PRIMARY-IMAGE-INTEGRITY-1-2026-09-22.md` |
| `RISK-REC-1` | publicada en `0bd7fbc` | `REPRODUCCION-RISK-REC-1-2026-09-21.md` |
| `CAT-PAGE-1` | publicada | `REPRODUCCION-CAT-PAGE-1-2026-09-14.md` |
| `POST-INTEGRATION-CLEAR-1` | publicada | `REPRODUCCION-POST-INTEGRATION-CLEAR-1-2026-09-14.md` |
| `INTEGRATION-CANDIDATE-1` | integrada por `b8447a3` con autorización de Emi del 13/09 | la sección siguiente |

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

La composición aceptada quedó cerrada en `4c8569d`, que combina `main` `615619c`
con la candidata `8e20b06` sin abrir alcance nuevo. El `diff-check` y el build de
producción quedaron verdes antes del push.

`main` continúa conectado al auto-deploy de ambos servicios sin esperar CI. Emi
autorizó la publicación de `0bd7fbc` el 2026-09-21 y Frontend/Backend
convergieron saludables en esa revisión. Esto acepta el despliegue demostrativo,
no el lanzamiento contractual: siguen pendientes la separación
`main = integración aceptada` / `release = producción`, backups, SMTP,
secretos, pagos y recuperación.

## Operación de marcas y filtros — estado

Las decisiones están firmadas en `PROPUESTA-BUSQUEDA-FACETADA.md`. PM reprodujo
la composición `34e7ebf` en Docker y cerró la revisión independiente:

- **Etapa 1** (condición nuevo/usado): `da69fe4`/`e798c85`, **aceptada**.
- **Etapa 2** (la marca como dato, con migración): `ed3e39f`/`4bdfc71`,
  **aceptada**.
- **Lista de marcas:** decidida por PM en 44. Se fusionan Fiat/Fiat
  Someca/Someca y Chery/Chery Bylion; Case/Case IH y Deutz/Deutz-Fahr quedan
  separadas. `chery` es el superviviente decidido por Emi. Implementada en
  `89b20aa`/`020e907` y aceptada.
- **Etapa 3** (la marca como filtro y faceta): aceptada en `8e20b06`; caso 175 PM **1/1** y tres negativos discriminantes rojos. Jacto no se agregó porque no existe entre las 44 marcas decididas; el seed declara sólo John Deere y Pauny.

Evidencia: `REPRODUCCION-FILTROS-MARCAS-2026-09-20.md`.

## Pendientes canónicos adoptados

- **Relevo:** cerrado en `b8447a3`; `main` contiene el disparador consolidado y
  la regla local de eficiencia de chats.
- **Carrito conservado y FAQ de pagos:** cerrados en `eb62d3d`/`a7ed544`,
  integración local `c973c6f`, incluidos en `4c8569d` y presentes en el runtime
  convergente `0bd7fbc`.
- **Backup/restauración local:** `BACKUP-RESTORE-1` quedó aceptada en
  `52ba294`/`b8223b1` e integrada por `fbd6caf`. El ensayo Docker real recuperó
  base, `uploads`, `documentos` y `outbox` en un destino aislado; una alteración
  fue detectada y recursos homónimos sin las dos etiquetas sobrevivieron. Esto
  cierra el procedimiento local, no crea todavía una copia administrada o
  externa de producción ni habilita migraciones riesgosas.
  Evidencia: `REPRODUCCION-BACKUP-RESTORE-1-2026-09-13.md`.
- **Índice único parcial sobre la imagen primaria:** aceptado en rama con
  `PRIMARY-IMAGE-INTEGRITY-1`; no integrado ni desplegado. La migración limpia
  duplicados de forma determinista y PostgreSQL impide recrearlos.
- **N+1 de imágenes del carrito:** aceptado en rama con
  `CART-IMG-QUERY-1`; GET y sync leen `product_images` una vez por petición.
- **N+1 de publicaciones del carrito:** `CART-PRODUCT-QUERY-1` aceptada en
  rama; el caso 181 comprueba una lectura de `products` por petición en GET,
  sync con carrito y sync que lo crea. No integrada ni desplegada.
- **`categories.usa_marca` no se edita desde el panel:** viaja sólo de salida.
  Ampliar la marca a otra categoría es hoy SQL o migración, no una acción de la
  clienta, y el encabezado de `marcas.py` afirma lo contrario. Además el panel
  deja cambiar `is_service` sin apagar `usa_marca`, y la guarda que lo impide
  es de semilla, no de runtime. Sin bloqueo; queda registrado.
- **Señal estable de cuenta sin confirmar:** el Login ofrece el reenvío hoy,
  pero reconoce una frase del rechazo. No se amplía Auth dentro de
  `RISK-REC-1`; el caso 177 vigila la dependencia hasta que se abra una decisión
  propia.
- **P1 — Mercado Pago cuelga la API con tres confirmaciones a la vez:** el
  webhook y la vuelta de quien compra toman la fila de la orden con
  `FOR UPDATE` y esperan a Mercado Pago con la fila tomada; otra confirmación
  pide la misma fila con una llamada síncrona y frena el único proceso de la
  API. PM lo reprodujo sobre `c6792ff` y sobre el producto de `2e86854`
  (caso 213, fuera de la suite). **Bloquea habilitar Mercado Pago.** Puede
  pasar también en «Rechazar» o «Cancelar» una orden de Mercado Pago (sin
  reproducir). **Tarea activa: `COBRO-CONCURRENTE-1`.**
- **Pago que llega a una orden ya cerrada:** no avisa (decisión PM del
  27/09), porque «Pago aprobado» sería falso. Hoy sólo queda en el registro
  del servidor y nadie se entera. Pieza propia después del P1, también antes
  de habilitar Mercado Pago.
- **Devolución concurrente de stock:** cancelar o rechazar una orden pagada aún
  usa lectura y escritura en Python. Dev no reprodujo pérdida en 6 rondas porque
  esos endpoints hoy se ejecutan sin intercalarse; queda como riesgo de diseño,
  no como bug confirmado ni tarea abierta.

## Railway — inventario actualizado 2026-09-13 y deuda viva

Inventario de sólo lectura del proyecto `strong-playfulness`, entorno `production`:

- servicios en línea: Frontend `yneratopgreen`, Backend `Backend` y base `PostGIS`;
- Frontend y Backend toman `Memu007/yneratopgreen`, rama `main`, con auto-deploy activo y `Wait for CI` apagado;
- Frontend público `https://yneratopgreen-production.up.railway.app` y Backend público `https://backend-production-ba84.up.railway.app` convergieron en `0bd7fbc` el 2026-09-21; ambos respondieron saludables después del recambio;
- los watch paths siguen separados (`src/public/...` para Frontend y `backend/**` para Backend), por lo que Railway puede publicar composiciones parciales en cambios futuros aunque esta publicación haya convergido;
- `VITE_API_URL` y `VITE_IMAGES_URL` apuntan al Backend vigente;
- CORS contiene el dominio histórico y el dominio público actual, pero `FRONTEND_URL` todavía apunta al dominio histórico `ynerav.up.railway.app`; queda como deuda de configuración, sin corregir en este inventario;
- Backend usa almacenamiento local con volumen `backend-volume` de 5 GB montado en `/data`; `UPLOAD_DIR=/data/uploads` y `EMAIL_OUTBOX_DIR=/data/outbox` quedan persistentes allí;
- PostGIS tiene `postgis-volume` de 5 GB montado en `/var/lib/postgresql/data`;
- no hay backups/PITR activos sobre la base productiva. La restauración local ya fue ejercitada con datos sintéticos mediante `BACKUP-RESTORE-1`; falta elegir y activar una copia externa o administrada antes de tratar el entorno como producción aceptada o hacer una migración riesgosa;
- `MP_CHECKOUT_HABILITADO=false`, verificado sin exponer secretos.

Este inventario de configuración es del 13/09; el runtime se verificó por
última vez el 21/09. El 23/09, el CLI de Railway respondió `Unauthorized`, así
que los backups y ajustes actuales requieren una nueva lectura autenticada.
La propuesta PM para la migración aceptada está en
`PROPUESTA-RECUPERACION-PRE-MIGRACION-2026-09-23.md`, pendiente de decisión de
Emi. No se infiere el costo real desde el tamaño nominal de los volúmenes.

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
- una copia externa o administrada de producción y su política de retención; el procedimiento de restauración local ya fue ensayado, pero persistencia y un script sin copias programadas no sustituyen backup;
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

1. **Emi verifica la publicación del 27/09** (`a7e2237`) en incógnito, con la lista del resumen. Railway tarda unos 10 minutos.
2. Dev trabaja `COBRO-CONCURRENTE-1` (el P1 de Mercado Pago), condición para habilitarlo en la Fase 4. Dependen de Emi: la regla del teléfono, el correo (#15: primero el plan de Railway), cuentas de prueba de Mercado Pago, backups, la charla de Inicio (#5) con la clienta y cargar las publicaciones de prueba (`PUBLICACIONES-DE-PRUEBA-2026-09-27.md`). Después de cada publicación, Emi verifica en el sitio lo que la pieza cambió.
3. Backup: no se exige mientras Railway sea demostrativo (decisión del 25/09). Es condición del lanzamiento real.
4. Resolver SMTP del entorno antes de pedir otra revisión a la clienta: hoy no pudo registrarse y sólo revisó superficies públicas.
5. Antes de cargar datos reales o de lanzar, Emi elige el backup administrado y su costo.
6. Los atributos por rubro ya tienen datos y decisión (25/09); Inicio (#5) espera la charla de Emi con la clienta; AgroMarket como módulo (#10) no se trabaja por ahora (27/09); Servicios (#7) quedó decidido el 25/09. La mejora de logística está por definir; mientras, la Dev sigue con el P1.
7. Mercado Pago, red-team y producción contractual permanecen en la secuencia acordada. Mercado Pago no se habilita sin resolver antes el P1.
