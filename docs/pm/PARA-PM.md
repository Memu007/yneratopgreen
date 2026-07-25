# Dev → PM

## Tarea

Suite automatizada de smoke tests integral, ejecutable con un solo comando
contra un arranque limpio.

## Estado

**Terminada y publicada en `main`.**

- Commit de código:
  `32f1eace7d8050ae85121fb01ae323bc75f52abf`
- Push confirmado:

```text
To https://github.com/Memu007/yneratopgreen
   5f6f1fc..32f1eac  main -> main
ok main
```

## Archivos

```text
32f1eac test: automatizar smoke tests integrales
 README.md         |  24 ++-
 package-lock.json |  48 +++++
 package.json      |  10 +-
 scripts/smoke.mjs | 509 ++++++++++++++++++++++++++++++++++++++++++++++++++++++
 scripts/smoke.sh  |  99 +++++++++++
 5 files changed, 680 insertions(+), 10 deletions(-)
 create mode 100644 scripts/smoke.mjs
 create mode 100755 scripts/smoke.sh
```

## Qué hace

`npm run smoke`:

1. Guarda temporalmente `.env` y `backend/.env`, si existen.
2. Usa los `.env.example` sanitizados durante la suite.
3. Compila el frontend.
4. Verifica/instala Chromium de Playwright.
5. Ejecuta `docker compose down -v --remove-orphans`.
6. Ejecuta `scripts/init_local_db.sh`: DB, API, migraciones y seed.
7. Levanta Vite temporalmente.
8. Ejecuta los once casos en orden.
9. Devuelve `1` si falla uno o más casos.
10. Detiene Vite y restaura exactamente los `.env` originales, también ante
    un fallo.

Los casos 1–8 y 10–11 usan requests directos. El caso 9 usa Chromium real,
completa el modal, adjunta una imagen y publica desde la interfaz.

Los filtros de catálogo y las tres vistas de administración se contrastan con
consultas SQL. No hay cantidades fijas de productos, usuarios u órdenes.

## Cómo se corre

Quedó documentado en dos líneas en `README.md`:

```bash
npm install
npm run smoke
```

El README avisa antes que el segundo comando borra los volúmenes Docker
locales.

## Evidencia verde final

Comando:

```text
npm run smoke
```

Resultado del proceso: **exit 0**.

Build ejecutado por el propio comando:

```text
> tsc && vite build
vite v5.4.21 building for production...
transforming...
✓ 78 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.97 kB │ gzip:   0.51 kB
dist/assets/index-DgJ3Nz_2.css  129.06 kB │ gzip:  23.24 kB
dist/assets/index-D7-7yRLC.js   348.42 kB │ gzip: 103.46 kB
✓ built in 1.99s
```

Arranque limpio:

```text
===> Eliminando contenedores y volúmenes locales
===> Inicializando DB, migraciones, seed y API
===> Verificando .env
===> Levantando contenedores (db + api)
===> Esperando healthcheck de la DB (puede tardar ~30s)
===> Creando la base topgreen si no existe
===> Aplicando migraciones (alembic upgrade head)
===> Cargando datos demo (seed)
  ✅ 4028 localidades Georef sembradas (sha256: 7743fd6a6af96fce138696680afe297e71fc41f37f8d1986b3763913d0c86197)
✨ Seed completado exitosamente!
📦 12 productos de ejemplo disponibles
```

Migraciones del arranque:

```text
INFO  [alembic.runtime.migration] Running upgrade  -> 766eee72137f, esquema inicial postgresql
INFO  [alembic.runtime.migration] Running upgrade 766eee72137f -> 06e1be636327, agregar localidades y ubicación de publicaciones
```

Salida exacta de los once casos de la última pasada:

```text
[PASS] 01 Salud del servicio — HTTP 200, status=ok (57 ms)
[PASS] 02 Registro de usuario — HTTP 201, user_id=6242fdb2-c9ca-477c-85a5-46600c31de4d (540 ms)
[PASS] 03 Ingreso y obtención del token — HTTP 200, JWT recibido (355 ms)
[PASS] 04 Catálogo con categoría y precio — HTTP 200, API=1, SQL=1, max_price=1850000.00 (364 ms)
[PASS] 05 Catálogo con provincia y localidad — provincia HTTP 200, API=6, SQL=6; localidad HTTP 200, API=2, SQL=2 (366 ms)
[PASS] 06 Detalle de producto — HTTP 200, product_id=818a8677-d3c0-4623-8d54-a1515624df13, "Dron Pulverizador Agrícola 20L" (357 ms)
[PASS] 07 Agregar al carrito y verlo — POST 200, GET 200, total_items=1 (63 ms)
[PASS] 08 Crear orden desde el carrito — HTTP 200, order_id=f15dd157-6a58-43c6-932c-8fc14364d013, status=placed (62 ms)
[PASS] 09 Publicar producto como vendedor desde la interfaz — UI + API + DB, product_id=e9090deb-8a14-4452-8c46-0a58ea26caa4, imágenes=1 (2313 ms)
[PASS] 10 Ver mis compras y mis ventas — compras HTTP 200 (1), ventas HTTP 200 (1) (35 ms)
[PASS] 11 Administración: usuarios, productos y órdenes — usuarios HTTP 200, API=SQL=4; productos HTTP 200, API=SQL=13; órdenes HTTP 200, API=SQL=1 (813 ms)

Resumen smoke tests
-------------------
PASS 01 Salud del servicio
PASS 02 Registro de usuario
PASS 03 Ingreso y obtención del token
PASS 04 Catálogo con categoría y precio
PASS 05 Catálogo con provincia y localidad
PASS 06 Detalle de producto
PASS 07 Agregar al carrito y verlo
PASS 08 Crear orden desde el carrito
PASS 09 Publicar producto como vendedor desde la interfaz
PASS 10 Ver mis compras y mis ventas
PASS 11 Administración: usuarios, productos y órdenes
-------------------
11/11 pasaron; 0 fallaron
```

## Qué verifica cada caso

| Caso | Evidencia |
|---:|---|
| 1 | `GET /api/health`, HTTP 200 y `status=ok`. |
| 2 | Registro HTTP 201, usuario y JWT recibidos. |
| 3 | Login HTTP 200, access y refresh token presentes. |
| 4 | Categoría + rango de precio; `total` de API igual a SQL y cada ítem dentro del filtro. |
| 5 | Provincia y localidad elegidas desde datos existentes; ambos totales API iguales a SQL. |
| 6 | Producto activo del vendedor demo con stock; detalle e ID coinciden. |
| 7 | POST al carrito y GET posterior; producto y cantidad coinciden. |
| 8 | Orden real desde el carrito, sin llamar pagos ni Mercado Pago. |
| 9 | Playwright abre la UI autenticada, completa formulario, adjunta PNG, selecciona provincia/localidad y publica. Después valida el producto por API y por DB, incluida una imagen persistida. |
| 10 | La orden creada aparece tanto en “mis compras” como en “mis ventas”. |
| 11 | Admin lista usuarios, productos y órdenes; los tres totales coinciden con SQL. |

## Evidencia de que la suite falla

El runner acepta una falla controlada sólo para esta demostración:

```text
npm run smoke -- --force-failure=health
```

La ejecución volvió a hacer `down -v`, init, migraciones, seed, build y los
once casos.

Resultado del proceso: **exit 1**.

Salida exacta relevante:

```text
[FAIL] 01 Salud del servicio — GET /health__forced_failure respondió HTTP 404: Not Found (40 ms)
[PASS] 02 Registro de usuario — HTTP 201, user_id=aba50746-d46f-4f05-9663-44c7d1437227 (561 ms)
[PASS] 03 Ingreso y obtención del token — HTTP 200, JWT recibido (348 ms)
[PASS] 04 Catálogo con categoría y precio — HTTP 200, API=1, SQL=1, max_price=1850000.00 (394 ms)
[PASS] 05 Catálogo con provincia y localidad — provincia HTTP 200, API=6, SQL=6; localidad HTTP 200, API=2, SQL=2 (396 ms)
[PASS] 06 Detalle de producto — HTTP 200, product_id=dc478ce6-a2c6-4df6-af15-230e87912ed4, "Dron Pulverizador Agrícola 20L" (370 ms)
[PASS] 07 Agregar al carrito y verlo — POST 200, GET 200, total_items=1 (60 ms)
[PASS] 08 Crear orden desde el carrito — HTTP 200, order_id=60c1ee41-d16a-4f93-96b3-f5e4c2ac2abc, status=placed (46 ms)
[PASS] 09 Publicar producto como vendedor desde la interfaz — UI + API + DB, product_id=36ae41ec-198f-441d-b93c-a76667ba9ddc, imágenes=1 (2418 ms)
[PASS] 10 Ver mis compras y mis ventas — compras HTTP 200 (1), ventas HTTP 200 (1) (35 ms)
[PASS] 11 Administración: usuarios, productos y órdenes — usuarios HTTP 200, API=SQL=4; productos HTTP 200, API=SQL=13; órdenes HTTP 200, API=SQL=1 (861 ms)

Resumen smoke tests
-------------------
FAIL 01 Salud del servicio
PASS 02 Registro de usuario
PASS 03 Ingreso y obtención del token
PASS 04 Catálogo con categoría y precio
PASS 05 Catálogo con provincia y localidad
PASS 06 Detalle de producto
PASS 07 Agregar al carrito y verlo
PASS 08 Crear orden desde el carrito
PASS 09 Publicar producto como vendedor desde la interfaz
PASS 10 Ver mis compras y mis ventas
PASS 11 Administración: usuarios, productos y órdenes
-------------------
10/11 pasaron; 1 fallaron
```

La suite no se detuvo al primer fallo: dejó el mapa completo y devolvió código
distinto de cero.

## Fallos encontrados durante la construcción

### 1. Compose necesitaba `.env` antes del init

Primer intento:

```text
error while interpolating services.db.environment.POSTGRES_DB: required variable DB_NAME is missing a value: DB_NAME no está definido en .env
```

Causa: `docker compose down -v` interpola variables antes de que
`init_local_db.sh` cree los archivos. Además, un `.env` existente pero parcial
no se corrige con “copiar sólo si falta”.

Solución: la suite respalda ambos `.env`, instala temporalmente los ejemplos y
restaura los originales mediante `trap`.

### 2. Email reservado en el usuario de prueba

Primer payload usaba `smoke.comprador@topgreen.test`.

Respuesta exacta:

```json
{"detail":[{"type":"value_error","loc":["body","email"],"msg":"value is not a valid email address: The part after the @-sign is a special-use or reserved name that cannot be used with email.","input":"smoke.comprador@topgreen.test","ctx":{"reason":"The part after the @-sign is a special-use or reserved name that cannot be used with email."}}]}
```

Solución: `smoke.comprador@example.com`. La DB se recrea en cada pasada, por
lo que el email fijo no colisiona.

### 3. Selector ambiguo en publicación

Mensaje exacto:

```text
strict mode violation: getByRole('button', { name: /Publicar Producto/i }) resolved to 2 elements
```

Había un botón de acceso “Publicar Producto” y el submit del modal. Solución:
seleccionar `form button[type="submit"]`.

### 4. Forma real de `/products/my`

Primer error:

```text
myProducts.data.find is not a function
```

El código devuelve `{ products, total }`, no un array plano. Ajusté el test al
contrato real y mantuve la segunda validación directa en DB.

## Validaciones estáticas

```text
$ bash -n scripts/smoke.sh
(sin salida; exit 0)

$ node --check scripts/smoke.mjs
(sin salida; exit 0)

$ git -c core.whitespace=blank-at-eof,space-before-tab,cr-at-eol diff --cached --check
(sin salida; exit 0)
```

## Qué no corrí

- No corrí `npm run lint`. No se tocó TypeScript de la aplicación y el lint
  global ya tiene 25 hallazgos preexistentes registrados. El build TypeScript
  sí corrió dentro de cada pasada completa.
- No ejecuté pagos ni configuré `MP_*`; la orden se crea sin pagar, como pidió
  el criterio.
- No probé Firefox ni WebKit. El caso UI corre con Chromium.
- No agregué cobertura, unit tests ni CI.

## Observaciones adversariales

1. El comando es deliberadamente destructivo para la DB local. Está advertido
   en README y sólo toca los volúmenes del compose de este proyecto.
2. La primera ejecución puede necesitar red para descargar Chromium. Las
   siguientes reutilizan el caché de Playwright.
3. Las credenciales demo siguen acopladas al seed. Si se cambian, la suite
   falla con el caso exacto; no las copia a otra fuente para evitar duplicar
   configuración sensible.
4. La publicación UI se comprueba en tres capas: interacción, API y DB. No
   considero suficiente que aparezca sólo el toast porque el frontend no
   valida explícitamente `response.ok` al subir la imagen.
5. En Docker aparece la advertencia preexistente:
   `FromPlatformFlagConstDisallowed: FROM --platform flag should not use constant value "linux/amd64"`.
   No la corregí: está fuera de la tarea y el build termina bien.
