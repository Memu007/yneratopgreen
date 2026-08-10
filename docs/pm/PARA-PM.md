# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-10.

## 1. Resultado

**Terminado.** Seguí el Camino B al pie de la letra sobre una copia limpia de
los 246 archivos versionados, sin `.env`, sin Docker y con entorno de Python
nuevo. Llega hasta el catálogo, el ingreso y una imagen subida.

## 2. Commit y alcance real

`82c1df8`, este informe aparte. Once archivos.

| Archivo | Qué |
|---|---|
| `backend/.env.example` | fuera las seis claves; `DATABASE_URL` nativa; `UPLOAD_DIR=uploads` |
| `.env.example` | las `DB_*` quedan sólo para Docker; se van `DB_HOST`, `DB_PORT` y la `DATABASE_URL` que no leía nadie |
| `docker-compose.yml` | el contenedor recibe `DATABASE_URL` y `UPLOAD_DIR` por `environment` |
| `backend/app/core/config.py` | el `.env` se busca en `backend/`; `UPLOAD_DIR` relativo se resuelve ahí |
| `backend/app/main.py` | la carpeta de subidas se crea antes de montarla |
| `vite.config.ts` | proxy a `:8000`, `/uploads` incluido; `VITE_API_URL` manda |
| `scripts/init_local_db.sh`, `.ps1` | `DB_NAME` y `DB_USER` del `.env` de la raíz |
| `README_LOCAL_SETUP.md` | Camino B reescrito, POSIX y PowerShell |
| `backend/.env.production.example`, `backend/.gitignore` | mismas seis claves; `uploads/` ignorada |

Sin cambios de producto, checkout, pagos, logística, interfaz ni esquema.

## 3. Evidencia

### El punto de partida, reproducido

Copiando `backend/.env.example` tal cual, `Settings()` moría con **seis**
`extra_forbidden`: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` y
`BASE_URL`. Las cinco primeras no las lee nadie en el backend; `BASE_URL`
tampoco, en ningún lado.

### Quién es dueño de qué

| Archivo | Lo lee | Conflicto anterior |
|---|---|---|
| `.env` (raíz) | `docker-compose.yml` y Vite | tenía una `DATABASE_URL` que no leía nadie |
| `backend/.env` | `Settings` | repetía las credenciales y rompía la carga |

Para que no vuelvan a duplicarse, **Docker pisa lo que importa**: el servicio
de la API define `DATABASE_URL` —armada con `DB_USER`, `DB_PASSWORD` y
`DB_NAME` de la raíz— y `UPLOAD_DIR=/data/uploads`. Así el ejemplo del backend
puede apuntar al PostgreSQL nativo sin romper Docker, y cambiar la contraseña
en un solo archivo alcanza. `Settings` no se debilitó: sigue rechazando claves
que no declara.

### La corrida nativa, comando por comando

| Paso | Resultado |
|---|---|
| `CREATE ROLE` + `createdb` + `CREATE EXTENSION` con `-d topgreen` | PostGIS quedó **en `topgreen`**; en `postgres` sólo `plpgsql` |
| venv nuevo + `pip install -r requirements.txt` | verde |
| `cp .env.example .env` + sustituir 2 placeholders | **58 líneas antes y 58 después: no hay que borrar ninguna** |
| `Settings()` | carga; `UPLOAD_DIR` resuelto a `<copia>/backend/uploads` |
| `alembic upgrade head` | 6 migraciones, de `766eee72137f` a `a1c4f7e9b2d3` |
| `python -m app.seed` ×2 | `3/30/12/4028` usuarios/productos/categorías/localidades las dos veces |
| `uvicorn app.main:app --reload --port 8000` | health 200; `backend/uploads` creada sola |
| `npm install` + `npm run dev`, **sin `.env`** | `:5173` arriba |

El paso 1 es el que estaba mal escrito: la guía vieja hacía `CREATE DATABASE`
y `CREATE EXTENSION postgis` seguidos, así que PostGIS terminaba en la base
desde la que uno estaba conectado y las migraciones fallaban después.

### El navegador, sin `.env`

```text
tarjetas de catálogo   : 30
ingreso admin          : sí
imagen subida          : /uploads/products/20260810_122055_ea80d607.png
pedidos totales        : 90
  al :80               : 0
errores de CORS        : 0
pedidos fallidos al propio origen : 0
```

La imagen se sube por la API, se guarda en `backend/uploads` y se pide desde
`localhost:5173`: se muestra con ancho propio, así que el proxy de `/uploads`
la resuelve. Sin ese proxy Vite devolvía el `index.html` y la imagen quedaba
sin ancho.

### `VITE_API_URL` sigue mandando

| `.env` | Qué pasa |
|---|---|
| sin archivo | `/api` y `/uploads` salen por el proxy a `:8000` |
| copiado tal cual del ejemplo | igual: las `VITE_*` vienen comentadas, `/api/health` responde 200 |
| `VITE_API_URL=http://127.0.0.1:8000/api` | 4 llamadas **directas**, 0 por el proxy, 0 errores de CORS |
| `VITE_API_URL=http://127.0.0.1:9999/api` | el proxy va al 9999: `ECONNREFUSED 127.0.0.1:9999` |

El caso del 9999 es el que prueba la precedencia. Con el 8000 no se distingue
nada, porque el default también es 8000.

### Docker y Railway

`docker compose config` renderiza `DATABASE_URL=…@db:5432/topgreen`,
`UPLOAD_DIR=/data/uploads`, el volumen `uploads_data → /data/uploads` y el
puerto `5433:5432`. Si falta `DB_USER` en la raíz, corta con el mensaje
esperado. **No pude levantar los contenedores: en esta máquina no hay demonio
de Docker.** Esa parte queda sin correr y la separo del resto.

Railway no cambia de contrato: el default de `UPLOAD_DIR` sigue siendo
`/data/uploads`, en la imagen no hay `.env` y `Settings` carga igual con todo
por variables de entorno. Comprobé además que **un `backend/.env` viejo, con
las seis claves, sigue funcionando bajo Docker**: llegan como variables de
entorno y ésas se ignoran, no se rechazan.

### Estado final

| Comprobación | Resultado |
|---|---|
| Suite oficial, base recreada desde cero | **31/31** |
| `npm run build` | verde |
| `npm run a11y -- --todas` | **40 de 40**, 0 de cualquier impacto |
| `git -c core.whitespace=cr-at-eol diff --cached --check` | sin avisos |

**No corrido:** `npm run smoke` tal cual y la inicialización Docker, las dos
por falta de demonio. Tampoco `npm run contraste`: no toqué nada de `src/`.

## 4. Desvíos, riesgos y hallazgos

**Un desvío deliberado, y quiero que lo confirmes.** En `.env.example` dejé
`VITE_API_URL` y `VITE_IMAGES_URL` **comentadas** en vez de apuntando a
`http://localhost:8000`. Sin ellas el navegador pide rutas relativas y las
resuelve el mismo origen: el proxy en desarrollo, nginx en el perfil
fullstack. Gana dos cosas —no hay CORS en el camino por defecto, y el build
del perfil fullstack deja de tener `localhost:8000` incrustado, así que se
puede abrir desde otra máquina de la red—. Ambos modos quedaron probados.

**Tres cosas que encontré siguiendo la guía y no arreglé:**

- `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `ADMIN_NAME` **no las lee nadie**. El seed
  escribe `admin@topgreen.com` / `admin123` en el código. La guía decía que
  eran las credenciales del admin; lo corregí en el texto, pero las claves
  siguen ahí sugiriendo algo que no hacen.
- `GET /api/products` devuelve **405**. El listado está en otra ruta y en ese
  path sólo hay `POST`. No lo toqué: es producto.
- Fuentes de Google, la foto de Unsplash del inicio y las imágenes de
  `picsum.photos` fallan en mi máquina porque la salida a internet está
  filtrada. Son dependencias externas previas, ninguna en mi diff.

**Aparte de la tarea:** `backend/.env.production.example` tenía las mismas seis
claves. Lo corregí con el mismo criterio; si preferís que quede como estaba,
lo revierto.

**La prueba de instalación nativa no quedó versionada.** Es un guión de mi
carpeta de trabajo. Sin versionarla, la guía puede volver a pudrirse sin que
nada avise.

**Sigue abierto el `float` del checkout**, obligatorio antes de Fase 4.

## 5. DECISIÓN SOLICITADA

**a) Versionar el control de instalación nativa.** Beneficio: la guía deja de
poder romperse en silencio, que es exactamente lo que pasó acá. Esfuerzo:
chico. Riesgo: necesita copia limpia, base propia y puertos libres, así que no
entra en la suite de 31; sería un comando aparte. Fase: ahora o al cierre de
Fase 5. **Recomiendo hacerlo ahora**, mientras el recorrido está fresco.

**b) El desvío de las `VITE_*` comentadas** (punto 4). Confirmalo o pedime que
las deje apuntando a `http://localhost:8000` como antes.

**c) Las tres claves `ADMIN_*` muertas.** O se borran de `Settings` y de los
ejemplos, o se deja el seed leyéndolas. Lo segundo es un cambio de producto y
no lo abro sin que lo pidas. **Recomiendo borrarlas**, que es lo barato.

El entorno local sigue levantado.
