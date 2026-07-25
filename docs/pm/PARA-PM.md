# Dev → PM

## Estado

**Las dos tareas están terminadas, verificadas y publicadas en `main`.**

- Tarea 1: `29eb6fb` — `fix: mostrar fallos al subir imagenes`
- Tarea 2: `17d18c1` — `feat: ampliar catalogo demo`

Pushes confirmados:

```text
To https://github.com/Memu007/yneratopgreen
   ec781c7..29eb6fb  main -> main
ok main

To https://github.com/Memu007/yneratopgreen
   29eb6fb..17d18c1  main -> main
ok main
```

## Tarea 1 — fallo visible al subir imágenes

### Qué cambié

`AddProductModal.tsx` ahora revisa `response.ok` en cada subida.

- El producto se crea antes, sin cambiar el orden existente.
- Si una imagen falla, se intentan las demás.
- Se toma `detail` de la respuesta JSON; si no existe, se usa el cuerpo o el
  estado HTTP.
- Si hubo fallos, el toast es `warning`: informa que la publicación salió,
  cuántas imágenes fallaron y el motivo.
- Si todas suben, conserva el toast de éxito anterior.
- Un fallo de red también queda informado y no convierte en fallida la
  creación ya confirmada.

Agregué a `npm run smoke` un caso permanente de regresión. Playwright
intercepta `POST **/api/products/*/images` y responde:

```json
{"detail":"Archivo demasiado grande (prueba controlada)"}
```

El caso exige las tres cosas:

1. Toast visible con “publicado, pero no se pudo subir la imagen” y el motivo.
2. Producto visible en el catálogo.
3. Producto presente en DB con cero imágenes.

El caso normal previo sigue exigiendo publicación por UI, presencia en API/DB
y una imagen guardada.

### Primera corrida: fallo del test, no del flujo

La primera corrida completa devolvió `exit 1`:

```text
[PASS] 09 Publicar producto como vendedor desde la interfaz — UI + API + DB, product_id=6a783e38-7890-4723-af31-6fa36b8e170f, imágenes=1 (2385 ms)
[FAIL] 10 Fallo de imagen visible sin perder la publicación — locator.waitFor: Timeout 20000ms exceeded.
Call log:
  - waiting for getByText(/publicado, pero no se pudo subir la imagen.*Archivo demasiado grande (prueba controlada)/i) to be visible
[PASS] 11 Ver mis compras y mis ventas — compras HTTP 200 (1), ventas HTTP 200 (1) (42 ms)
[PASS] 12 Administración: usuarios, productos y órdenes — usuarios HTTP 200, API=SQL=4; productos HTTP 200, API=SQL=14; órdenes HTTP 200, API=SQL=1 (895 ms)
11/12 pasaron; 1 fallaron
```

Causa: el regex del test interpretaba los paréntesis del motivo como un grupo,
por lo que no coincidía con los paréntesis literales del toast. El total de
productos ya había subido a 14, confirmando que la publicación sí se creó.

Corrección: localizar el comienzo estable del aviso y comprobar el motivo
literal con `textContent().includes(...)`. También actualicé el rótulo fijo del
runner de 11 a 12 casos.

### Verificación verde de la tarea 1

Segunda corrida limpia: `npm run smoke`, **exit 0**.

```text
[PASS] 09 Publicar producto como vendedor desde la interfaz — UI + API + DB, product_id=4c237a1e-ef23-4b3c-b6fc-0785b2a8db61, imágenes=1 (1872 ms)
[PASS] 10 Fallo de imagen visible sin perder la publicación — UI + DB, producto visible, aviso="Archivo demasiado grande (prueba controlada)", imágenes=0 (1837 ms)
12/12 pasaron; 0 fallaron
```

## Tarea 2 — catálogo de demostración

### Qué cambié

Todo quedó en `backend/app/seed.py`; no toqué modelos, migraciones ni esquema.

- Pasé de 12 a **24 productos**.
- Las 12 categorías quedaron con **dos productos cada una**.
- Las cinco categorías de servicios tienen publicaciones verosímiles y con
  sus campos de servicio.
- Cada publicación tiene `locality_id`.
- Pasé de tres a **nueve provincias**.

Las nuevas localidades se buscaron en la copia versionada de Georef y usé
estos IDs reales:

| Localidad | Provincia | ID Georef |
|---|---|---:|
| Paraná | Entre Ríos | `30084160` |
| General Pico | La Pampa | `42105030` |
| Resistencia | Chaco | `22140060` |
| Salta | Salta | `66028050` |
| Mendoza | Mendoza | `50007010` |
| San Miguel de Tucumán | Tucumán | `90084010` |

### Arranque limpio y primer seed

Comandos:

```text
docker compose down -v
./scripts/init_local_db.sh
```

Resultado relevante:

```text
Volume yneratopgreen_uploads_data  Removed
Volume yneratopgreen_db_data  Removed
Network yneratopgreen_topgreen-network  Removed

Container topgreen-db  Healthy
Container topgreen-api  Started
INFO  [alembic.runtime.migration] Running upgrade  -> 766eee72137f, esquema inicial postgresql
INFO  [alembic.runtime.migration] Running upgrade 766eee72137f -> 06e1be636327, agregar localidades y ubicación de publicaciones
✅ 4028 localidades Georef sembradas (sha256: 7743fd6a6af96fce138696680afe297e71fc41f37f8d1986b3763913d0c86197)
✅ Producto creado: Instalación y Reparación de Alambrados Rurales
✨ Seed completado exitosamente!
📦 24 productos de ejemplo disponibles
```

### Segundo seed: idempotencia

Comando:

```text
docker exec topgreen-api python -m app.seed
```

Resultado: **exit 0**. Las 12 categorías y los 24 productos informaron
`ya existe`; no se creó ninguno.

```text
⏭️  Categoría 'Otros Servicios' ya existe
...
⏭️  Producto 'Semillas de Maíz DK Premium' ya existe
...
⏭️  Producto 'Instalación y Reparación de Alambrados Rurales' ya existe
✨ Seed completado exitosamente!
📦 24 productos de ejemplo disponibles
```

Confirmación SQL posterior:

```text
 productos | slugs_unicos | provincias
-----------+--------------+------------
        24 |           24 |          9
(1 row)
```

### Conteo por provincia

```text
  provincia   | productos
--------------+-----------
 Buenos Aires |         7
 Chaco        |         2
 Córdoba      |         3
 Entre Ríos   |         1
 La Pampa     |         2
 Mendoza      |         2
 Salta        |         2
 Santa Fe     |         4
 Tucumán      |         1
(9 rows)
```

### Conteo por categoría

```text
         categoria          | productos
----------------------------+-----------
 Agroquímicos               |         2
 Asesoramiento              |         2
 Bienes y Ganado            |         2
 Fertilizantes              |         2
 Herramientas               |         2
 Laboreo                    |         2
 Mantenimiento              |         2
 Maquinaria                 |         2
 Otros Servicios            |         2
 Semillas                   |         2
 Tecnología para el Cultivo |         2
 Transporte y Logística     |         2
(12 rows)
```

### Suite final contra el seed ampliado

Comando: `npm run smoke`. Resultado: **exit 0**.

```text
[PASS] 01 Salud del servicio — HTTP 200, status=ok (65 ms)
[PASS] 02 Registro de usuario — HTTP 201, user_id=4915713e-8748-4e2e-826a-dfcc981dac4c (562 ms)
[PASS] 03 Ingreso y obtención del token — HTTP 200, JWT recibido (365 ms)
[PASS] 04 Catálogo con categoría y precio — HTTP 200, API=1, SQL=1, max_price=45000.00 (392 ms)
[PASS] 05 Catálogo con provincia y localidad — provincia HTTP 200, API=7, SQL=7; localidad HTTP 200, API=3, SQL=3 (498 ms)
[PASS] 06 Detalle de producto — HTTP 200, product_id=6eb5d70b-1e0f-412a-8131-f32e4b32810c, "Insecticida Lambda Cihalotrina 1L" (414 ms)
[PASS] 07 Agregar al carrito y verlo — POST 200, GET 200, total_items=1 (69 ms)
[PASS] 08 Crear orden desde el carrito — HTTP 200, order_id=27eeafee-8acc-4b64-aa4e-6a973cb481ca, status=placed (53 ms)
[PASS] 09 Publicar producto como vendedor desde la interfaz — UI + API + DB, product_id=37efae98-ed3e-4598-9023-f5d314869989, imágenes=1 (2563 ms)
[PASS] 10 Fallo de imagen visible sin perder la publicación — UI + DB, producto visible, aviso="Archivo demasiado grande (prueba controlada)", imágenes=0 (2031 ms)
[PASS] 11 Ver mis compras y mis ventas — compras HTTP 200 (1), ventas HTTP 200 (1) (42 ms)
[PASS] 12 Administración: usuarios, productos y órdenes — usuarios HTTP 200, API=SQL=4; productos HTTP 200, API=SQL=26; órdenes HTTP 200, API=SQL=1 (1051 ms)
12/12 pasaron; 0 fallaron
```

El total admin es 26 porque la suite parte de los 24 del seed y publica dos
productos por UI: uno con imagen exitosa y uno con subida interceptada.

## Otros errores observados

Antes de la prueba manual de idempotencia:

```text
error while interpolating services.db.environment.POSTGRES_DB: required variable DB_NAME is missing a value: DB_NAME no está definido en .env
```

No se eliminó nada en ese intento: Compose falló durante la interpolación.
El `.env` local conservaba sólo las variables de Vite. Para la prueba usé
temporalmente `.env.example`, igual que `scripts/smoke.sh`, y restauré el
archivo original antes de la suite. No cambié ni publiqué `.env`.

Advertencia preexistente, sin efecto en el build:

```text
FromPlatformFlagConstDisallowed: FROM --platform flag should not use constant value "linux/amd64"
```

No la corregí porque está fuera de estas tareas.

## Qué no hice

- No configuré ni probé Mercado Pago.
- No toqué esquema, modelos ni migraciones.
- No ejecuté Firefox ni WebKit; la prueba UI usa Chromium.
- No corrí `npm run lint`; el TypeScript y el build de producción sí corrieron
  dentro de cada pasada de `npm run smoke`.
