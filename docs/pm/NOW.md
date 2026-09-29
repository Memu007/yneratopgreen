# Estado actual

Actualizado: 2026-09-29.

`NOW.md` contiene sólo estado vigente, restricciones vivas, bloqueos y próxima acción. La historia anterior permanece en Git; la instantánea previa a esta poda está en `ab4165fc`.

## Resumen ejecutivo

- **Fase contractual:** Fase 3 — Buscador y catálogo, semanas 6–8 (25/09–15/10). La puerta de la Fase 2 quedó verificada el 23/09 (`REPRODUCCION-FASE-2-2026-09-23.md`). La puerta de la Fase 3 y el hito intermedio ya se aceptaron por adelantado con `npm run hito` (cierre `3580faa`, ver `MATRIZ.md`). Presentarlo a la clienta y facturarlo es decisión comercial de Emi. Las fechas no cambian.
- **`main`:** `65457cc`, publicado el 29/09 con autorización de Emi («publicá y A»), por fast-forward desde `58bb62b`. Suma `PAGO-ORDEN-CERRADA-1` y documentos de PM. Sin migraciones. La verificación previa fue sobre el mismo código (`b3b5f3c`, que difiere sólo en `docs/pm`): suite 221/222 (131 de entorno), puertas, auditorías y las dos guías verdes, sin secretos ni archivos prohibidos. La red de PM no llega a `railway.app`. **Mientras Mercado Pago no esté habilitado, no cambia nada visible:** Emi comprueba en incógnito que el sitio sigue andando (Inicio, el Mercado, una ficha e ingresar). Antes: `58bb62b` (28/09, `COBRO-CONCURRENTE-1`), que la Dev vio en producción.
- **Rama Dev:** `claude/dev-role-repo-3l0kp3`. `main` (`65457cc`) no tiene todavía `RECONCILIADOR-PROGRAMADO-1`, aceptada en rama el 29/09 (`8170d8b`). La Dev no tiene tarea activa.
- **Última decisión PM:** `RECONCILIADOR-PROGRAMADO-1` **ACEPTADA EN RAMA** (29/09, `8170d8b`, producto en `d351306` y `1241b48`), después de una devolución el mismo día. Antes de barrer, el reconciliador comprueba que puede hacerlo sin daño: con una clave equivocada o sin clave no barre, no marca a ningún vendedor, lo dice en una línea que nombra la variable (nunca su valor) y sale con 2. `RAILWAY.md` tiene los pasos para Emi: se crea el día que se habilita Mercado Pago, mirando antes que el Backend tenga `MP_TOKEN_KEY`, con un tope de 9 minutos por corrida. Suite 223/224 (131 de entorno) sobre ese código; 12 negativos en rojo, 4 de PM; el comando corrido a mano como en producción; puertas verdes. Sin migraciones ni cambios visibles. Evidencia en `REPRODUCCION-RECONCILIADOR-PROGRAMADO-1-2026-09-29.md`.
- **Tarea activa:** ninguna. `RECONCILIADOR-PROGRAMADO-1` espera que Emi autorice publicarla. Publicarla no cambia nada visible: Railway vuelve a desplegar sólo el Backend. **El servicio del reconciliador lo crea Emi el día que se habilite Mercado Pago**, con los pasos de `RAILWAY.md`, sección 5, y antes de encender el cobro. Emi aprobó su costo el 29/09 («Ok el costo»). Es la última condición para habilitar Mercado Pago.
- **Corrección de método PM (25/09):** las aceptaciones de la marca no verificaron la carga de datos en producción. Desde ahora, toda pieza que agrega una lista o un catálogo tiene que decir cómo llega a producción, y PM lo comprueba con un caso sobre una base sin siembra.
- **#9, atributos por rubro: absorbido (decisión de Emi, 25/09).** Tercer nivel de la taxonomía de la clienta como filtro en todos los rubros, potencia de tractores, modelo y año en maquinaria, y origen declarado por quien vende. «Inversores» queda afuera. Va después de `MERCADO-UNICO-1` y antes de las guías de uso.
- **Devolución de la clienta del 20/09 — estado (27/09):**
  - publicados: #1, #7, #8 y #9; y el 27/09 (`a7e2237`), #2, #3, #4, #6, #11a, #13, #14 y sin «comisión» visible;
  - **respuestas de Emi (27/09, en `DECISIONS.md`):** #5 lo habla Emi con la clienta; #10 no se trabaja por ahora; #12 espera el texto de la clienta; #11b, retener fondos no se hace y ya se le explicó. Cómo se explica que AgroBoeda cobra sigue sin decidir; hoy el sitio no lo menciona;
  - **logística en los filtros:** Emi quiere mejorarla; la pieza está por definir. **Publicaciones de prueba (opción 1, Emi, 27/09):** se cargan a mano en el sitio publicado, sin fotos, con cuentas creadas desde el panel. La lista y lo que tiene que mostrar cada filtro están en `PUBLICACIONES-DE-PRUEBA-2026-09-27.md`. La parte del transportista espera el correo, porque un transportista sólo se crea registrándose. Hoy la logística vive en dos lugares que no se conectan: la publicación de logística y la cuenta de transportista que se elige al comprar;
  - **#15, el correo:** Emi propone empezar con una cuenta de Gmail propia mientras la clienta arma la casilla en DonWeb. El código lo admite sin cambios (SMTP con STARTTLS en el 587). Dos trabas de Railway, que valen también para DonWeb: según su documentación, el SMTP saliente sólo está habilitado en el plan Pro (PM no pudo abrir la página: lo vio en el buscador y en el foro de Railway). Emi dice que su plan es el de unos 20 USD, que es el Pro; la prueba de registro lo confirma, y el 13/09 `FRONTEND_URL` apuntaba al dominio viejo, así que el enlace no llevaría al sitio. Según ese inventario el sitio usa `outbox`: dice que mandó el correo y no lo manda. Mientras tanto, una cuenta creada desde el panel entra sin confirmar el correo.

  El #3 quedó sin asignar entre el 20/09 y el 27/09 por un descuido de PM.
- **Escalado a Emi:** la regla «el teléfono no sale de la API sin suscripción activa» choca con la decisión del 05/08, que pasó suscripciones y candados por plan a Fase 6. Hoy el teléfono no se publica en el Mercado ni en las fichas, pero sí lo ven las dos partes de una orden y quien compra al elegir transportista, sin suscripción. El transportista no recibe el de quien compra.

## Última aceptación PM — COBRO-CONCURRENTE-1

Ninguna confirmación de Mercado Pago, «Cancelar», «Rechazar», edición de una
publicación, foto o documentación espera una fila tomada frenando la API.
Si la fila no se suelta en 10 s, cada camino contesta algo que se puede
reintentar. El link se apaga antes de consolidar el stock, siempre con la fila
de la orden tomada. Aceptada sobre `599dded` y publicada en `58bb62b`.

## Aceptación anterior — AVISOS-DE-PAGO-1

Quien compra se entera cuando le rechazan o le aprueban la transferencia, y
las dos partes cuando Mercado Pago acredita el pago, una sola vez por orden.
Publicada en `a7e2237`.

## Aceptaciones anteriores

Cada pieza tiene su evidencia en `docs/pm/REPRODUCCION-<PIEZA>-<fecha>.md` y
su fila en `ROADMAP-CIERRE-MVP-2026-08-31.md`. No se transcriben acá. Los
riesgos que dejaron abiertos están en «Pendientes canónicos adoptados».

| Pieza | Estado | Evidencia |
|---|---|---|
| `PAGO-ORDEN-CERRADA-1` | publicada en `65457cc` | `REPRODUCCION-PAGO-ORDEN-CERRADA-1-2026-09-28.md` |
| `COBRO-CONCURRENTE-1` | publicada en `58bb62b` | `REPRODUCCION-COBRO-CONCURRENTE-1-2026-09-28.md` |
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
  (caso 213). **Resuelto por `COBRO-CONCURRENTE-1`, publicado en
  `58bb62b` el 28/09.** Queda un P2: si Mercado Pago falla dos veces en el
  mismo barrido, el reconciliador reintenta apagar el link con la fila de la
  publicación tomada, y una compra de esa publicación puede frenar la API
  hasta 15 s. Va con la pieza del pago a una orden cerrada.
- **Seguridad — contraseñas escritas en chats (28/09):** la de administración
  de Emi y la de `prueba@example.com` quedaron en el chat de PM y en el de la
  Dev. Cambiarlas queda pendiente por decisión de Emi: la suya con el programa
  de la consola que PM probó en local, y la de prueba desde el panel con
  «Restablecer contraseña».
- **Railway — Config as Code en desuso, con corte el 01/12/2026:** según la
  documentación de Railway (confirmado por el buscador, sin que PM ni la Dev
  lleguen a la página), `/railway.toml` (Frontend) y `/backend/railway.toml`
  (Backend) dejan de aplicarse el 01/12/2026. Ahí están el Dockerfile, la
  migración antes de desplegar, el chequeo de salud y las rutas vigiladas. El
  reemplazo es `.railway/railway.ts` (`railway config migrate`) o cargarlo en
  el panel. **Pieza propia antes de esa fecha**, y alguien que llegue a
  `docs.railway.com` la confirma. El buscador suma (29/09, de issues de
  terceros, no de la documentación): un servicio nuevo ignora el archivo y
  Railway rechaza fijarle la ruta; sin migrar, en el despliegue siguiente al
  corte se pierden el comando de inicio, el chequeo de salud y la política
  de reinicio. El reconciliador ya va sin archivo.
- **Antes de habilitar Mercado Pago — orden de un vendedor desvinculado
  (PM, 29/09):** si un vendedor desvincula su cuenta con una orden de
  Mercado Pago abierta, la orden queda reservada hasta que vuelva a
  vincular. El reconciliador no puede preguntarle a Mercado Pago sin el
  token, y `/mp-oauth/unlink` no pregunta por órdenes abiertas. Viene de
  antes; en la base local quedaron 7 así. Se decide antes de encender el
  cobro.
- **P3 — contraseñas (PM, 28/09):**
  - ingresar con una contraseña de más de 72 bytes da un error 500 en vez de
    «contraseña incorrecta», porque bcrypt no acepta más;
  - nadie puede cambiar su propia contraseña desde la pantalla. La API tiene
    `/auth/change-password`, pero ninguna pantalla lo usa, y el panel no deja
    restablecer la propia.
- **Pago que llega a una orden ya cerrada:** resuelto por
  `PAGO-ORDEN-CERRADA-1`, publicado en `65457cc` el 29/09.
- **P1 para habilitar Mercado Pago — el reconciliador no está programado:**
  lo dice `reconciliar.py`, y no figura en `RAILWAY.md`. Sin barridos, las
  reservas de las órdenes que nadie paga no vencen. Además, el link que no se
  pudo apagar queda abierto: desde `PAGO-ORDEN-CERRADA-1`, apagarlo se
  reintenta sólo en el barrido siguiente. Programarlo es un cambio de Railway:
  pide tarea explícita y autorización de Emi.
- **Devolución concurrente de stock:** cancelar o rechazar una orden pagada aún
  usa lectura y escritura en Python. Dev no reprodujo pérdida en 6 rondas porque
  esos endpoints hoy se ejecutan sin intercalarse; queda como riesgo de diseño,
  no como bug confirmado ni tarea abierta.

## Producción — cuentas (28/09)

- La primera cuenta de administración la creó Emi el 28/09, con un programa en
  la consola del Backend que PM probó antes en local. En la misma pasada creó
  la cuenta de prueba `prueba@example.com`, rol usuario y ya confirmada.
- Con la cuenta de administración, Emi puede crear cuentas desde el panel, y
  esas cuentas entran sin confirmar el correo. Así la clienta puede hacer su
  segunda revisión sin esperar al #15.
- La Dev vio producción respondiendo `revision 58bb62b` el 28/09: el
  despliegue de `COBRO-CONCURRENTE-1` llegó.

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

1. **Emi verifica en incógnito** la ficha de la 1 (`https://yneratopgreen-production.up.railway.app/?section=product&id=5553bdcd-3804-4dd7-937a-97f7c9876ab0`): marca John Deere, modelo 5090E, año 2018, 90 HP, usado y origen «Dueño directo». En el Mercado, con «prueba» en el buscador, aparecen las 16, y con «Servicios», 5. Eso verifica también lo publicado el 26 y el 27/09 (modelo, año, origen y marca en la ficha). Queda la lista de la devolución de la clienta del 27/09.
2. **Emi decide si se publica `RECONCILIADOR-PROGRAMADO-1`** (PM recomienda publicarla: no cambia nada visible y deja los pasos de Railway en `main`). El servicio lo crea Emi con esos pasos el día que se habilite Mercado Pago. Dependen de Emi: cambiar las dos contraseñas, crearle la cuenta a la clienta desde el panel, la regla del teléfono, el correo (#15), cuentas de prueba de Mercado Pago, backups y la charla de Inicio (#5) con la clienta. Después de cada publicación, Emi verifica en el sitio lo que la pieza cambió.
3. Backup: no se exige mientras Railway sea demostrativo (decisión del 25/09). Es condición del lanzamiento real.
4. Resolver SMTP del entorno antes de pedir otra revisión a la clienta: hoy no pudo registrarse y sólo revisó superficies públicas.
5. Antes de cargar datos reales o de lanzar, Emi elige el backup administrado y su costo.
6. Los atributos por rubro ya tienen datos y decisión (25/09); Inicio (#5) espera la charla de Emi con la clienta; AgroMarket como módulo (#10) no se trabaja por ahora (27/09); Servicios (#7) quedó decidido el 25/09. La mejora de logística está por definir.
7. Mercado Pago, red-team y producción contractual permanecen en la secuencia acordada. Mercado Pago no se habilita sin programar el reconciliador; `PAGO-ORDEN-CERRADA-1` ya está publicado.
