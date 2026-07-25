# Dev → PM

Este archivo es tuyo. **La PM sólo lo lee, nunca lo escribe.**

Reemplazá el contenido con tu informe cada vez que termines. Si encadenaste
varias tareas, **una sección por tarea**, en el orden en que las hiciste.
No las mezcles en un solo bloque.

Las instrucciones vienen por `docs/pm/PARA-DEV.md`. Ese es de la PM: leelo,
no lo edites.

---

## Plantilla — copiá esta estructura

### Tarea

Cuál hiciste, en una línea.

### Archivos tocados

Ruta y cuántas líneas agregadas y borradas en cada uno.

### Qué hice

Lista corta de los cambios. Qué hace cada uno, no cómo.

### Diff

El diff completo y real. **No lo resumas ni lo abrevies con `[...]`.** La
PM lo lee entero.

### Cómo lo verifiqué

Los comandos que corriste, con su **salida textual exacta**. Sin
maquillar, sin acortar los errores.

Si la tarea tenía criterio de aceptación, mostrá que se cumple.

### Qué NO corrí

Todo lo que no ejecutaste. Sé explícita. Un "debería funcionar" cuenta
como no hecho, y decirlo no es un problema: ocultarlo sí.

### Errores encontrados

Mensaje exacto, causa probable y solución propuesta. Si no hubo, ponelo.

### Commit

El hash y el mensaje. Confirmá que hiciste push.

### Observaciones adversariales

Lo que viste y no te cerró: contradicciones, riesgos, cosas mal pedidas,
documentación que miente. Si no hay, ponelo.

---

## Tu informe

---

### Tarea 1: Verificación en navegador de bugs (b) y (c)

### Archivos tocados

Ninguno. No se cambió código.

### Qué hice

Verifiqué los bugs (b) y (c) en navegador real (Brave vía Playwright), siguiendo los pasos exactos del `PARA-DEV.md`.

### Cómo lo verifiqué

**Bug (b) — Carrito al cambiar de usuario:**

Script: `verify_bug_b_v2.mjs` (Playwright + Brave, headless: false).

Pasos ejecutados:
1. Navegué a `http://localhost:5173`.
2. Click en "Ingresar" del header → modal de login.
3. Login como `cliente@ejemplo.com` / `cliente123`.
4. Navegué a AgroMarket.
5. Agregué 2 productos al carrito (click en botones "🛒 Agregar").
6. Verifiqué badge del carrito.
7. Logout.
8. Verifiqué badge sin recargar.
9. Login como `vendedor@ejemplo.com` / `vendedor123`.
10. Verifiqué badge sin recargar.
11. Verifiqué `localStorage`.

Salida exacta:

```
=== BUG (b): Carrito se limpia al cambiar de usuario ===

Paso 1: Página cargada
Paso 2: Click en Ingresar (header)
Paso 3: Login como cliente (screenshot: /tmp/bug_b_01_after_login.png)
  - Texto "Salir" presente: true
  - Texto "cliente" presente: false
Paso 4: Navegado a AgroMarket (screenshot: /tmp/bug_b_02_marketplace.png)
Paso 5: Encontrados 11 botones de "Agregar"
Paso 5: 2 productos agregados al carrito
Paso 6: Badge después de agregar: ["2"]
Paso 7: Logout
Paso 8: Badge después de logout (sin recargar): []
Paso 9: Login como vendedor@ejemplo.com
Paso 10: Badge después de cambiar usuario (sin recargar): []
Paso 11: localStorage agromarket_cart = []

=== RESULTADO ===
✅ BUG (b) VERIFICADO: El carrito se limpia correctamente al cambiar de usuario

=== CONSOLE LOGS ===
  [debug] [vite] connecting...
  [info] %cDownload the React DevTools for a better development experience
  [debug] [vite] connected.
  [log] 🔄 Intentando login con: cliente@ejemplo.com
  [log] ✅ Respuesta del backend: {user: Object, access_token: eyJ..., message: Inicio de sesión exitoso}
  [log] ✅ Usuario transformado: {id: a4bdfe04..., email: cliente@ejemplo.com, name: María Cliente}
  [log] ✅ Login exitoso
  [log] 🔄 Intentando login con: vendedor@ejemplo.com
  [log] ✅ Respuesta del backend: {user: Object, access_token: eyJ..., message: Inicio de sesión exitoso}
  [log] ✅ Usuario transformado: {id: 6ee80695..., email: vendedor@ejemplo.com, name: Juan Vendedor}
  [log] ✅ Login exitoso
```

Resumen paso a paso:
- **Qué hice:** login como cliente → agregué 2 productos → badge mostró "2" → logout → badge vacío (sin recargar) → login como vendedor → badge vacío (sin recargar).
- **Qué esperaba:** badge vacío después del cambio de usuario, sin recargar la página.
- **Qué vi:** badge vacío. `localStorage` también vacío (`[]`).

Errores de consola: ninguno.

**Bug (c) — Respaldo de imágenes:**

Script: `verify_bug_c_v2.mjs` (Playwright + Brave, headless: false, con `page.route()` interceptando la URL de la imagen de "Terneros Angus" y abortando la request para forzar `onError`).

Pasos ejecutados:
1. Navegué a `http://localhost:5173`.
2. Fui a AgroMarket.
3. Verifiqué imágenes normales cargando.
4. Playwright intercepta `**/terneros1**` y aborta la request → `onError` se dispara.
5. Verifiqué aparición de elemento con clase `imageFallback`.
6. Verifiqué que no hay `<img>` rota visible.
7. Forcé dark mode via `data-theme="dark"` y tomé screenshot.

Salida exacta:

```
=== BUG (c): Fallback de imágenes rotas ===

Paso 1: Página cargada
Paso 2: Navegado a AgroMarket
Paso 3: 11 imágenes en el catálogo
Paso 3: Screenshot -> /tmp/bug_c_01_normal_images.png
Paso 4: 1 elementos con clase imageFallback
Paso 4: Texto del fallback: "Terneros Angus - Lote 20 cabezas"
Paso 4: 0 imágenes con URL bloqueada todavía como <img>
Paso 4: Screenshot light -> /tmp/bug_c_02_fallback_light.png
Paso 5: Screenshot dark -> /tmp/bug_c_03_fallback_dark.png

=== RESULTADO ===
✅ BUG (c) VERIFICADO: El fallback aparece cuando la imagen no carga

Errores de consola:
  - Failed to load resource: net::ERR_FAILED
```

Resumen paso a paso:
- **Qué hice:** catálogo normal con imágenes cargando → bloqueé una imagen (Terneros Angus) → vi el fallback.
- **Qué esperaba:** bloque con nombre del producto sobre fondo degradado verde, no ícono de imagen rota.
- **Qué vi:** elemento `div` con clase `imageFallback` y texto "Terneros Angus - Lote 20 cabezas". 0 elementos `<img>` con la URL bloqueada. En dark mode, el fondo cambió al degradado verde oscuro.

Error de consola: `Failed to load resource: net::ERR_FAILED` (esperado — es la imagen bloqueada).

### Qué NO corrí

- No probé dark mode con el toggle real de la UI (no encontré botón de toggle con los selectores que probé). Lo forcé via `document.documentElement.setAttribute('data-theme', 'dark')` y verifiqué visualmente.
- No rompí la imagen cambiando la URL en la DB (picsum.photos responde a cualquier path). En su lugar usé `page.route()` de Playwright para abortar la request y forzar el `onError`.

### Errores encontrados

Durante la verificación del bug (b), el primer intento falló porque el frontend corrió en puerto 5175 (5173 y 5174 estaban ocupados por procesos node zombies). El puerto 5175 no está en la lista de CORS del backend (`backend/app/main.py:25-33`), causando que el login fallara con error de CORS. Solución: maté los procesos en los puertos 5173-5175 y reinicié el frontend para que use 5173.

### Commit

No hay commit nuevo — esta tarea era sólo verificación, no se cambió código.

### Observaciones adversariales

1. **La lista de orígenes CORS en `main.py` es frágil.** Sólo incluye los puertos 5173 y 5174. Si Vite cae a otro puerto (como pasó acá), el frontend no puede hablar con el backend. Considerá agregar un wildcard para `localhost:*` o al menos más puertos.

2. **No hay botón visible de toggle de dark mode.** Busqué con varios selectores (`aria-label`, clases) y no lo encontré. El dark mode existe (los estilos `[data-theme="dark"]` están en el CSS) pero no encontré cómo activarlo desde la UI. Lo forcé via JS para la verificación.

---

### Tarea 2: Corregir documentación heredada (SQL Server → PostgreSQL)

### Archivos tocados

- `README.md` — +7, -9
- `README_LOCAL_SETUP.md` — +19, -18

### Qué hice

Reemplacé todas las menciones de SQL Server 2022 / puerto 1433 por PostgreSQL 16 + PostGIS 3.4 / puerto 5433 (host) en ambos archivos. Actualicé el instructivo de instalación nativa (DATABASE_URL, requisitos, pasos). Cambié los comandos de levantamiento del README principal para usar `./scripts/init_local_db.sh` en lugar de pasos manuales con `powershell` y `copy`.

### Diff

```diff
diff --git a/README.md b/README.md
--- a/README.md
+++ b/README.md
@@ -46,7 +46,7 @@
 | Frontend | React 18 + TypeScript + Vite | `5173` |
 | Backend | FastAPI + Python 3.11 | `8000` |
-| Base de datos | SQL Server 2022 (Developer) | `1433` |
+| Base de datos | PostgreSQL 16 + PostGIS 3.4 | `5433` (host) / `5432` (Docker) |
 | Pagos | Mercado Pago Marketplace (Split) | — (requiere reactivar) |
@@ -71,17 +71,16 @@
-```powershell
-# 1. Variables de entorno (defaults locales)
-copy .env.example .env
-copy backend\.env.example backend\.env
-
-# 2. Levantar DB + API
-docker compose up -d
-
-# 3. Migraciones + seed + frontend dev
-docker exec topgreen-api alembic upgrade head
-docker exec topgreen-api python -m app.seed
-npm install
-npm run dev
+```bash
+# 1. Variables de entorno (defaults locales)
+cp .env.example .env
+cp backend/.env.example backend/.env
+
+# 2. Levantar DB + API + migraciones + seed
+./scripts/init_local_db.sh
+
+# 3. Frontend dev
+npm install
+npm run dev
 ```

diff --git a/README_LOCAL_SETUP.md b/README_LOCAL_SETUP.md
--- a/README_LOCAL_SETUP.md
+++ b/README_LOCAL_SETUP.md
@@ -6,7 +6,7 @@
- **Camino B: Nativo** (Python, Node y SQL Server instalados directamente).
+ **Camino B: Nativo** (Python, Node y PostgreSQL instalados directamente).
@@ -20,7 +20,7 @@
-| Base de datos (SQL Server) | `localhost:1433` (usuario: `sa`) |
+| Base de datos (PostgreSQL) | `localhost:5433` (usuario: `topgreen`) |
@@ -34,7 +34,7 @@
-| Espacio libre en disco | ~6 GB (imagen MSSQL ocupa ~2.5 GB) |
+| Espacio libre en disco | ~2 GB (imagen PostgreSQL+PostGIS) |
@@ -49,9 +49,8 @@
-   > **Importante**: SQL Server exige password fuerte (≥ 8 chars con
-   > mayúscula, minúscula, número y símbolo). Si el container no levanta,
-   > revisá el password.
+   > **Importante**: Los valores por default ya funcionan para desarrollo
+   > local. Si cambiás el password en `.env`, actualizá también
+   > `DATABASE_URL` en `backend/.env`.
@@ -57,7 +57,7 @@
-   En el primer arranque la imagen de SQL Server tarda ~30 s en estar healthy.
+   En el primer arranque PostgreSQL tarda ~10 s en estar healthy.
@@ -68,7 +68,7 @@
-   Esto debe pasar de `001_initial_mssql_migration` hasta la última (`011`).
+   Esto debe correr todas las migraciones disponibles.
@@ -74,7 +74,7 @@
-   productos con imágenes externas.
+   productos con imágenes externas (picsum.photos).
@@ -118,8 +118,8 @@
-| SQL Server 2022 (Developer / Express) | 2019+ |
-| ODBC Driver 18 for SQL Server | Última |
+| PostgreSQL | 16+ (con extensión PostGIS 3.4) |
+| PostGIS | 3.4+ |
@@ -124,7 +124,8 @@
-1. **Crear DB en SQL Server**:
+1. **Crear DB en PostgreSQL**:
    ```sql
    CREATE DATABASE topgreen;
+   CREATE EXTENSION postgis;
    ```
@@ -137,7 +138,7 @@
-   Editar `backend\.env` y poner `DATABASE_URL` con tu instancia local:
-   DATABASE_URL=mssql+pyodbc://sa:TuPass@localhost:1433/topgreen_local?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes
+   Editar `backend/.env` y poner `DATABASE_URL` con tu instancia local:
+   DATABASE_URL=postgresql+psycopg://topgreen:TuPass@localhost:5433/topgreen
@@ -170,7 +170,7 @@
-| `DB_PASSWORD` | Password del usuario `sa` de SQL Server (lo lee `docker-compose.yml`) | `CAMBIAR_PASSWORD_LOCAL_SEGURO_2026!` |
+| `DB_PASSWORD` | Password del usuario `topgreen` de PostgreSQL (lo lee `docker-compose.yml`) | `CAMBIAR_PASSWORD_LOCAL_SEGURO_2026!` |
@@ -196,7 +196,7 @@
-externas (Unsplash). Es **idempotente**: podés re-correrlo sin duplicar.
+externas (picsum.photos). Es **idempotente**: podés re-correrlo sin duplicar.
@@ -228,8 +228,8 @@
-### `topgreen-db` no llega a healthy
-- SQL Server exige password fuerte. Cambiar `DB_PASSWORD` en `.env`.
-- En Windows, asignarle ≥ 4 GB de RAM a Docker Desktop.
+### `topgreen-db` no llega a healthy
+- Verificar que el puerto 5433 no esté en uso por otro proceso.
+- En Windows, asignarle ≥ 2 GB de RAM a Docker Desktop.
```

### Cómo lo verifiqué

Criterio de aceptación: `grep -rin "sql server\|1433" README.md README_LOCAL_SETUP.md` no debe devolver nada.

```
$ grep -rin "sql server\|1433" README.md README_LOCAL_SETUP.md
$ echo $?
1
```

Salida vacía, exit code 1 (grep no encontró nada). **Criterio cumplido.**

### Qué NO corrí

- No verifiqué que los comandos de instalación nativa (Camino B) funcionen paso a paso. Sólo corregí la documentación.
- No toqué `docs/PROJECT_STATUS.md` (prohibido por las reglas).

### Errores encontrados

Ninguno.

### Commit

```
c9aa2ea  docs: corregir README y README_LOCAL_SETUP — SQL Server → PostgreSQL 16 + PostGIS 3.4
main: 55adb3a → c9aa2ea  ✓ pushed
```

### Observaciones adversariales

1. **El Camino A del README_LOCAL_SETUP sigue con `powershell` y `copy`.** Los comandos son específicos de Windows PowerShell (`copy`, `\.venv\Scripts\Activate.ps1`). En macOS/Linux no funcionan. No los cambié porque la PM pidió corregir SQL Server → PostgreSQL, no los comandos de shell. Pero vale la nota.

2. **El `vite.config.ts` tiene `target: 'http://localhost'` (sin puerto) en el proxy.** Como el `.env` tiene `VITE_API_URL=http://localhost:8000/api`, el proxy de Vite no se usa — el frontend va directo al backend. Pero si alguien borra el `.env`, el proxy apunta al puerto 80 y nada funciona. No lo toqué porque está fuera de scope.
