# Estado actual

Actualizado: 2026-09-23.

`NOW.md` contiene sólo estado vigente, restricciones vivas, bloqueos y próxima acción. La historia anterior permanece en Git; la instantánea previa a esta poda está en `ab4165fc`.

## Resumen ejecutivo

- **Fase contractual:** Fase 2 — Desarrollo base, semana 5. Ventana contractual: 04/09–24/09. Su puerta funcional quedó verificada el 23/09 sobre la composición aceptada `1e4a63c`; la evidencia está en `REPRODUCCION-FASE-2-2026-09-23.md`. Las fechas y las puertas posteriores no cambian.
- **`main`:** `0bd7fbc`; `RISK-REC-1` integrada y publicada con autorización de Emi. GitHub, Frontend y Backend convergieron en ese SHA y los dos servicios quedaron saludables. El entorno `strong-playfulness` sigue siendo demostrativo y no equivale al despliegue productivo contractual.
- **Rama Dev:** `claude/dev-role-repo-3l0kp3`; `FICHA-MOBILE-WIDTH-1` en `78b682b`, informe `4a0dca2`. PM aceptó la pieza en rama; aún no integrada ni desplegada.
- **Última decisión PM:** `FICHA-MOBILE-WIDTH-1` **ACEPTADA EN RAMA**. PM reprodujo el caso 185 en 1/1, el negativo rojo y la auditoría en **12/12** recorridos sin desbordes. Evidencia en `REPRODUCCION-FICHA-MOBILE-WIDTH-1-2026-09-23.md`.
- **Tarea activa:** `PRODUCT-DETAIL-BACK-SEARCH-1`, asignada a Dev en `PARA-DEV.md`: conservar la búsqueda tras abrir y recargar una ficha y usar «Atrás».

## Última aceptación PM — FICHA-MOBILE-WIDTH-1

PM verificó la candidata `78b682b` sobre base aislada: caso 185 **1/1** en
360/390/768 px, sin contenido fuera de la ficha. El negativo que repone la
geometría anterior dio rojo específico por desborde a 360 px. La auditoría
móvil completó **12/12** recorridos y 39 pantallas con cero desbordes, cero
recortes del checkout y salida 0. Build, lint, tipos y diff-check verdes. El
QA responsive de geometría queda verde en rama; sigue pendiente el foco de
teclado en filtros cerrados.

Dev informó además una pérdida intermitente de `q` al volver desde una ficha
recargada (8/20 intentos suyos). PM no la reprodujo durante esta revisión; se
asigna `PRODUCT-DETAIL-BACK-SEARCH-1` para reproducirla y resolverla antes
del foco de filtros. Sin integración ni despliegue.

## Última aceptación PM — MOBILE-CHECKOUT-1

PM verificó la candidata `f820146` sobre base aislada. El caso 184 pasó en
360/390/768 px: envío y pago caben exactamente en la capa y la compra llega
al medio de pago sin crear orden. El negativo con el CSS original dio rojo
específico por recorte. La auditoría completó 12/12 recorridos, 39 pantallas,
sin recortes del checkout ni cortes del arnés. Salió con 1 por la ficha de
«Campo Agrícola de 120 Hectáreas» a 360 px: 368 px de documento. El QA
responsive sigue abierto; `FICHA-MOBILE-WIDTH-1` es la siguiente pieza.

## Última aceptación PM — MOBILE-AUDIT-FLOW-1

PM ejecutó la auditoría en base aislada sobre `8e4f7c6`: el recorrido público
alcanzó la ficha con URL propia en **360, 390 y 768 px**; el total fue **9/12**
porque los tres recorridos de compra esperan el pago sin elegir traslado.
El arnés anterior falló en «Limpiar filtros» antes de la ficha, rojo esperado.
Las capturas históricas quedaron intactas. El arnés se acepta por el alcance
asignado; no se declara cerrado el QA responsive.

La misma corrida encontró **un desborde horizontal real en la ficha a 360 px**
con «Campo Agrícola de 120 Hectáreas» (368 px de contenido en 360). PM confirmó
además que Tab desde «Filtros» cerrado entra en cuatro controles invisibles.
El recorte del checkout quedó corregido y aceptado en rama en
`MOBILE-CHECKOUT-1`. Siguen abiertos la ficha a 360 px y el foco de filtros
cerrados; se priorizan por separado.

## Última aceptación PM — PRODUCT-DETAIL-PAGE-1

Producto y caso 183 `087fa2c`; informe `9110bcc`. PM corrió la suite completa
sobre base aislada: **183/183**, incluidos 123, 131, 147, 148, 155 y 183.
El sabotaje que devuelve el modal dio rojo por falta de URL propia; restaurada
la candidata, el caso 183 pasó **1/1**. Build, lint, tipos y diff-check verdes.
Dev informó a11y **74/74** y contraste **82/82**. La nueva consulta del
detalle suma una vista en `views_count` por apertura o recarga; se acepta ese
efecto de la API existente. Sin integración ni despliegue.

La auditoría móvil heredada se corta en «Limpiar filtros»: el script opera
selectores dentro del panel aún plegado y después intenta pulsar un control
oculto. PM reprodujo el rojo y confirmó con clic real en 360 px que abrir
«Filtros» permite limpiar normalmente. Se asigna corregir el recorrido del
arnés, no un cambio de producto sin defecto demostrado.

## Última aceptación PM — ADMIN-MOBILE-ACCESS-1

Producto, caso 182 y sabotajes `b2a3ba4`; informe `a11b52a`. PM reprodujo
14/14 casos focales y relacionados desde una base aislada; el caso 182 pasó
en 360, 390 y 768 px. Al reponer el desplazamiento horizontal anterior, el
caso 182 falló con tres secciones fuera de vista; restaurado el candidato,
pasó 1/1. Build, lint, tipos y diff-check verdes. Dev informó cuatro sabotajes
rojos, a11y 74/74 y contraste 82/82. La aceptación cubre la navegación de
siete secciones y Cerrar del panel admin; otros controles pequeños siguen
pendientes del QA general. No se integró ni desplegó.

## Última aceptación PM — CART-PRODUCT-QUERY-1

Producto, caso 181 y tres sabotajes `1e4a63c`; informe `e0fd76b`. PM reprodujo
el caso 181 en **1/1**: GET, sync con carrito y sync que lo crea leen `products`
1/1/1 veces con 1/3/6 ítems. Los tres sabotajes dieron rojo por crecimiento.
La suite completa desde base Docker limpia terminó **180/181**: el único rojo
fue el caso 157 porque la copia temporal no tenía metadatos Git. Repetido con
Git disponible, el 157 pasó **1/1**; los 181 casos quedan cubiertos, sin
atribuir 181/181 a una sola corrida. Build, lint, tipos, sintaxis, dependencias,
migraciones y diff-check quedaron verdes.

PM acepta que el sync de un carrito nuevo guarde el nombre y precio recién
validados antes del commit que crea el carrito. Evita guardar, ante una edición
concurrente, un precio posterior que no pasó por el control de importes; coincide
con el camino donde el carrito ya existía. No modifica el contrato observable
fuera de esa carrera. La pieza no habilita integración ni despliegue.

## Última aceptación PM — CART-IMG-QUERY-1

Producto, caso 180 y sabotajes `112eee0`; informe `6b91aa8`. PM reprodujo el
focal en 1/1: GET y sync leen `product_images` 1/1/1 veces con 1/3/6 ítems y
conservan principal o `null`. Los tres sabotajes dieron rojo —N+1 en cada
endpoint y secundaria usada como portada—. La suite completa desde base Docker
limpia terminó **180/180**; build, lint, tipos, sintaxis, dependencias,
migraciones y diff-check quedaron verdes.

La medición reveló que `products` todavía crece 1/3/6 en ambos endpoints. Ese
hallazgo no reabre la pieza aceptada: pasa a `CART-PRODUCT-QUERY-1`.

## Última aceptación PM — PRIMARY-IMAGE-INTEGRITY-1

Producto, migración y regresión `cfeff88`; informe `19e6327`, corregido por
`6a6e36e`. PM comprobó independientemente el caso 179, cuatro sabotajes rojos,
la limpieza previa al índice, el rechazo real de una segunda principal y los
recorridos concurrentes. La suite limpia dio 178/179 porque el host no tenía
`npx`; repetido el único caso afectado con el lanzador disponible, el 136 pasó
1/1. Los 179 casos quedan cubiertos y el caso 131 pasó. Build, análisis
estático, dependencias, migraciones y diff-check quedaron verdes.

La pieza no se integra ni despliega todavía: contiene una migración y requiere
una puerta operativa explícita antes de tocar `main`/Railway.

## Última aceptación PM — RISK-REC-1

Producto y arnés `2d18d55`; informe final `d518f40`. PM comprobó de forma
independiente:

- casos 176, 177 y 178 juntos: **3/3**;
- sabotaje de la venta atómica: caso 176 **rojo** en la ronda 2, con dos
  órdenes pagadas por una sola unidad;
- candidata restaurada y suite completa desde base Docker limpia: **178/178**,
  incluido el caso 131;
- a11y: **74/74** superficies, sin violaciones bloqueantes;
- contraste: **82/82** mediciones, sin incumplimientos;
- build, lint, `tsc --noEmit`, `node --check`, `compileall`, `pip check`,
  `alembic check` y `diff-check` compatibles con CRLF: verdes.

R1 y R5 quedan cerrados como defectos reales. R4 queda cerrado como falso para
el comportamiento vigente: el reenvío sí se ofrece. La dependencia de la frase
del rechazo no se corrige en esta pieza porque separar cuenta inactiva de cuenta
sin confirmar requiere una señal estable nueva de Auth; permanece vigilada por
el caso 177 y su sabotaje. La devolución concurrente de stock en cancelación o
rechazo queda registrada como riesgo adyacente, no como defecto reproducido.

## Última aceptación PM — CAT-PAGE-1

Producto inicial `a521631`, corrección R1 `575f757`, informe final `b1cc77f` e
integración local `fafa5cb`; quedó incluida en `4c8569d`. La PM comprobó de forma independiente:

- caso 171 sobre la candidata, con 115 publicaciones y cinco páginas: **1/1**;
- sabotaje temporal omitiendo `pagina` de `consultaVigente`: **0/1**, con la
  página anterior presentada bajo «Página 2 de 5» y sin estado de carga;
- candidata restaurada y limpia: caso 171 nuevamente **1/1**;
- build, lint, `tsc --noEmit`, sintaxis del arnés y `diff-check`: verdes.

Dev obtuvo 170/171 en la suite completa desde base limpia; el único rojo fue el
caso 131 ambiental, heredado y sin relación con esta pieza. También obtuvo
a11y 72/72 y contraste 80/80. Evidencia durable:
`REPRODUCCION-CAT-PAGE-1-2026-09-14.md`.

## Última aceptación PM — POST-INTEGRATION-CLEAR-1

La candidata de producto `eb62d3d`, con ajuste de arnés `a7ed544` e informe
`48bae67`, mantiene el alcance mínimo. PM comprobó de forma independiente:

- caso 170 sobre la candidata: **1/1**;
- el mismo caso sobre la base `2d8ecfd`: **0/1**, rojo exacto por carrito
  guardado sin acceso desde la cabecera;
- caso 169 sobre `a7ed544`: **1/1**, con reinicio real de `topgreen-api` y
  cambio de identidad del contenedor;
- build, lint y `git diff --check`: verdes;
- accesibilidad: **70/70** superficies, sin violaciones bloqueantes;
- contraste: **78/78** mediciones, sin incumplimientos.

Dev ejecutó la suite completa desde base limpia sobre `a7ed544`: **169/170**,
con único rojo ambiental en el caso 131. Ese caso no cambió y ya había pasado
en la corrida Docker real anterior de PM; el delta nuevo queda cubierto por
los focales y puertas anteriores. PM no repitió el borrado completo porque el
lanzador elimina volúmenes Docker locales y Emi no autorizó esa destrucción.

La pieza quedó aceptada e incluida en la composición publicada `4c8569d` y en
el runtime convergente `0bd7fbc`. Evidencia durable:
`REPRODUCCION-POST-INTEGRATION-CLEAR-1-2026-09-14.md`.

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

1. Dev trabaja `PRODUCT-DETAIL-BACK-SEARCH-1`; PM verificará el mismo recorrido búsqueda → ficha → recarga → Atrás, con negativo discriminante. Luego sigue `FILTER-COLLAPSE-FOCUS-1`. Las ocho piezas aceptadas en rama desde `0bd7fbc` siguen sin integración ni despliegue.
2. `PRIMARY-IMAGE-INTEGRITY-1` permanece fuera de `main` hasta una puerta operativa explícita para su migración. La propuesta de recuperación pre-migración espera decisión de Emi y verificación autenticada de Railway.
3. Resolver SMTP del entorno antes de pedir otra revisión a la clienta: hoy no pudo registrarse y sólo revisó superficies públicas.
4. Emi decide la opción de backup administrado/costo antes de cualquier operación remota; no se usan datos reales nuevos sin recuperación demostrada.
5. Los atributos por rubro esperan los datos prometidos por la clienta; Inicio, Servicios y la identidad de AgroMarket esperan decisión de producto.
6. Mercado Pago, red-team y producción contractual permanecen en la secuencia acordada; no se habilitan por esta tarea.
