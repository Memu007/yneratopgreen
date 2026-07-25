# Dev → PM

Fecha: 2026-07-25

## Estado: bloqueada después de implementar Tarea 1 parcialmente

Implementé dos publicaciones de servicio para **Acopio** en
`backend/app/seed.py`:

- `Recepción, Secado y Acopio de Granos` — Rosario, Santa Fe
- `Guarda de Granos en Silo Bolsa` — Pergamino, Buenos Aires

Ambas usan la categoría `acopio`, se incorporaron a los mapas explícitos
de taxonomía y localidad, tienen slugs propios y quedan cubiertas por la
idempotencia existente del seed (búsqueda por `Product.slug`). No toqué
esquema, modelos ni migraciones. El commit de implementación ya está
subido: `814f66b seed: agregar publicaciones de acopio`.

## Qué corrí

### Chequeo estático del seed

```text
$ python3 -c "import ast, pathlib; ast.parse(pathlib.Path('backend/app/seed.py').read_text()); print('seed.py: sintaxis Python válida')"
seed.py: sintaxis Python válida
```

### Instalación de dependencias frontend

```text
$ npm install
added 205 packages in 4s
42 packages are looking for funding
npm warn deprecated inflight@1.0.6
npm warn deprecated rimraf@3.0.2
npm warn deprecated glob@7.2.3
npm warn deprecated eslint@8.57.1
```

### `npm run smoke`

La suite llegó a compilar el frontend correctamente y falló antes de
migraciones, seed o tests por un contenedor ya existente:

```text
$ npm run smoke
===> Preparando variables locales
===> Compilando frontend
> tsc && vite build
vite v5.4.21 building for production...
transforming...
✓ 78 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.97 kB │ gzip:   0.51 kB
dist/assets/index-DgJ3Nz_2.css  129.06 kB │ gzip:  23.24 kB
dist/assets/index-t25D7gNu.js   348.87 kB │ gzip: 103.67 kB
✓ built in 1.93s
===> Verificando Chromium de Playwright
===> Eliminando contenedores y volúmenes locales
===> Inicializando DB, migraciones, seed y API
===> Verificando .env
===> Levantando contenedores (db + api)
...
Container topgreen-db  Creating
Error response from daemon: Conflict. The container name "/topgreen-db" is already in use by container "d5265fe6c4f9ff3a757ec0587ef24343c38311c98d649ee3ff5b91342ac9cf95". You have to remove (or rename) that container to be able to reuse that name.
```

## Qué no corrí

Por ese bloqueo, no pude correr ni obtener evidencia de:

1. El seed dos veces seguidas y la salida de la segunda ejecución.
2. Las tres consultas SQL pedidas: subcategorías por categoría,
   publicaciones por categoría y publicaciones sin categoría.
3. Los 12 smoke tests en verde: la suite no alcanzó `alembic`, el seed ni
   los casos de Playwright.
4. La comprobación en interfaz de que el filtro muestra la taxonomía
   nueva.
5. La Tarea 2 (vista móvil) ni la Tarea 3 (puerto estricto). La PM pidió
   frenar si la evidencia de Tarea 1 fallaba, por lo que no avancé.

## Hallazgo inesperado

Docker Desktop **sí está encendido**. El contenedor que bloquea el smoke
está saludable y pertenece al mismo proyecto, pero a otro checkout de
Codex:

```text
ID: d5265fe6c4f9
Nombre: topgreen-db
Estado: Up (healthy)
Proyecto Compose: yneratopgreen
Working dir: /Users/Emi/.codex/.chatgpt-projects/g-p-6a5c0432126c8191875cf0ffeeed7118/yneratopgreen
```

El `docker compose down -v` de este checkout no lo administra. No lo
detuve ni eliminé: hacerlo podría borrar la base de otro trabajo activo.

Además, `docs/pm/REPO_MAP.md` afirma que no hay geolocalización, pero el
código actual sí tiene `products.locality_id` y el onboarding describe el
padrón oficial. No lo edité porque no es parte de esta tarea.

## Necesito de la PM / dueño

Confirmación sobre el contenedor `topgreen-db` del otro checkout: que se
detenga/elimine allí o autorización explícita para hacerlo. Con el nombre
liberado vuelvo a correr el smoke desde cero, ejecuto el seed una segunda
vez, tomo las consultas SQL y verifico el filtro antes de continuar con
la Tarea 2.
