# Estado actual

Actualizado: 2026-09-25.

`NOW.md` contiene sólo estado vigente, restricciones vivas, bloqueos y próxima acción. La historia anterior permanece en Git; la instantánea previa a esta poda está en `ab4165fc`.

## Resumen ejecutivo

- **Fase contractual:** Fase 2 — Desarrollo base, semana 5, último día (ventana 04/09–24/09). Su puerta funcional quedó verificada el 23/09 sobre `1e4a63c` (`REPRODUCCION-FASE-2-2026-09-23.md`). Desde el **25/09** corre la **Fase 3**, semanas 6–8, hasta el 15/10. Su puerta y el hito intermedio ya quedaron aceptados por adelantado con `npm run hito` (cierre `3580faa`, ver `MATRIZ.md`). Presentarlo a la clienta y facturarlo es decisión comercial de Emi. Las fechas no cambian.
- **`main`:** `238d113`, publicado el 26/09 con autorización explícita de Emi, por fast-forward desde `792d709`. Suma `PROD-LISTS-1`: la migración `01ff14043124` carga las 44 marcas y las localidades, y el filtro de marca completo. Verificación previa sobre el mismo código (`cdda2d9`, que difiere sólo en `docs/pm`): suite desde base limpia 197/198 (el 169 es de entorno), migración probada en modo producción, puertas verdes, sin secretos ni archivos prohibidos. **Pendiente: Emi verifica que la marca ofrezca la lista en el alta y en el Mercado.** Antes, el 25/09, se publicó `792d709` y Emi verificó Mercado único, «Tipo» y «Potencia».
- **Rama Dev:** `claude/dev-role-repo-3l0kp3`. Todo lo aceptado hasta la parte 1 de `ATRIBUTOS-RUBRO-1` está en `main` (`792d709`); la parte 2 está en curso.
- **Última decisión PM:** `PROD-LISTS-1` **ACEPTADA EN RAMA** (`cdda2d9`): la migración `01ff14043124` trae a producción las 44 marcas y las 4028 localidades, y el filtro de marca ofrece las 44 con Maquinaria elegida (decisión de Emi). 3/3 focales, seis negativos en rojo, migración probada en modo producción, suite 197/198 (169 de entorno), puertas verdes. Evidencia en `REPRODUCCION-PROD-LISTS-1-2026-09-26.md`. Publicada en `238d113`.
- **Publicación 25/09:** con autorización explícita de Emi y sin backup previo (decisión del 25/09 para el entorno demostrativo), PM subió `e9cf4c6` a `main` por fast-forward desde `0bd7fbc`. La verificación previa fue desde base recién creada: 190 de 191 casos cubiertos (el 169 es de entorno); a11y 76/76, contraste 84/84, auditoría 12/12, guía 26/26, build, tipos, lint y `alembic check` verdes; sin secretos ni archivos prohibidos. Railway corre `alembic upgrade head` como `preDeployCommand`. La red del entorno de PM bloquea `railway.app`, así que la verificación la hizo Emi: el 25/09 revisó el sitio publicado y **se ve bien**. `COPY-AGRO-1` no está incluida.
- **Tarea activa:** `ATRIBUTOS-RUBRO-1` parte 2: modelo y año en maquinaria, origen declarado y tres P2 (la marca queda cargada en el alta siguiente; «Mercado» saca filtros de la barra; dos filtros se llaman «Tipo»). Después, `USER-GUIDE-1`.
- **Corrección de método PM (25/09):** las aceptaciones de la marca no verificaron la carga de datos en producción. Desde ahora, toda pieza que agrega una lista o un catálogo tiene que decir cómo llega a producción, y PM lo comprueba con un caso sobre una base sin siembra.
- **#9, atributos por rubro: absorbido (decisión de Emi, 25/09).** Tercer nivel de la taxonomía de la clienta como filtro en todos los rubros, potencia de tractores, modelo y año en maquinaria, y origen declarado por quien vende. «Inversores» queda afuera. Va después de `MERCADO-UNICO-1` y antes de las guías de uso.
- **Escalado a Emi:** la regla «el teléfono no sale de la API sin suscripción activa» choca con la decisión del 05/08, que pasó suscripciones y candados por plan a Fase 6. Hoy el teléfono no se publica en el Mercado ni en las fichas, pero sí lo ven las dos partes de una orden y quien compra al elegir transportista, sin suscripción. El transportista no recibe el de quien compra.

## Última aceptación PM — ATRIBUTOS-RUBRO-1, parte 1

Devolución de la clienta #9. Quien publica elige el tipo de la lista de su
subrubro, y en Tractores carga la potencia en HP. El Mercado filtra por los
dos en el servidor, y lo no declarado no entra. En producción las listas
llegan con la migración `c8e41f2a7d90`, porque la siembra no corre. **Control
después de publicar:** un subrubro por rubro tiene que ofrecer «Tipo», y
Tractores, «Potencia». Publicada en `792d709`.

## Aceptaciones anteriores

Cada pieza tiene su evidencia en `docs/pm/REPRODUCCION-<PIEZA>-<fecha>.md` y
su fila en `ROADMAP-CIERRE-MVP-2026-08-31.md`. No se transcriben acá. Los
riesgos que dejaron abiertos están en «Pendientes canónicos adoptados».

| Pieza | Estado | Evidencia |
|---|---|---|
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

1. Dev trabaja `ATRIBUTOS-RUBRO-1` (#9, absorbido), en dos partes. Después: `USER-GUIDE-1`, las guías de comprador, vendedor y transportista. Sigue, sin depender de Emi, la documentación del despliegue cuando la infraestructura quede fija. Dependen de Emi: la regla del teléfono, SMTP (la clienta no pudo registrarse), cuentas de prueba de Mercado Pago, backups e integración, y las decisiones #5, #7 y #10 de la clienta.
2. `main` está en `792d709` (25/09): todo lo aceptado hasta la parte 1 de `ATRIBUTOS-RUBRO-1`. Lo que venga se publica en la próxima tanda, con suite completa desde base limpia sobre el SHA exacto y autorización explícita de Emi. Después de publicar, Emi carga tres publicaciones de prueba (dos tractores de marcas distintas, con HP, y una máquina sin marca; fotos propias o genéricas, rotuladas «publicación de prueba»).
3. Backup: no se exige mientras Railway sea demostrativo (decisión del 25/09). Es condición del lanzamiento real.
4. Resolver SMTP del entorno antes de pedir otra revisión a la clienta: hoy no pudo registrarse y sólo revisó superficies públicas.
5. Antes de cargar datos reales o de lanzar, Emi elige el backup administrado y su costo.
6. Los atributos por rubro ya tienen datos y decisión (25/09); Inicio (#5) y la identidad de AgroMarket (#10) esperan decisión de producto; Servicios (#7) quedó decidido el 25/09.
7. Mercado Pago, red-team y producción contractual permanecen en la secuencia acordada; no se habilitan por esta tarea.
