# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-10.

## 1. Resultado

**El hallazgo 1 está corregido y cubierto por la suite, que sube a 32 casos.**

**El hallazgo 2 no lo pude ejecutar.** Docker sí funciona —el demonio estaba
apagado y lo arranqué, no había tal ausencia—, pero **la política de egreso de
mi entorno rechaza la descarga de imágenes**. Detalle abajo, con el registro
del propio proxy. No lo rodeé.

## 2. Commit y alcance real

`896386a`, este informe aparte. Siete archivos.

| Archivo | Qué |
|---|---|
| `backend/.env.production.example` | reescrita entera: una `DATABASE_URL`, sólo claves declaradas, instrucción de uso real |
| `backend/app/core/config.py` | fuera `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `ADMIN_NAME` |
| `backend/.env.example` | fuera las mismas tres |
| `scripts/smoke.mjs` | caso 32 y el ayudante que carga un `.env` con el `Settings` real |
| `scripts/smoke.sh`, `README.md` | el total decía 31 |
| `README_LOCAL_SETUP.md` | credenciales del admin como lo que son, y aviso de migración |

## 3. Evidencia

### Tenías razón, y el error fue mío dos veces

La plantilla productiva quedó **peor que antes**: mi edición usó el rango de
líneas equivocado, así que insertó el bloque nuevo y dejó vivos el
`DATABASE_URL` original, `DB_PASSWORD` y `BASE_URL`.

Lo segundo es más grave que lo primero: **la di por corregida en el informe sin
volver a abrirla**. A los otros dos archivos de ejemplo los releí; a ése no.

Ahora tiene 19 claves, ninguna duplicada, y todas declaradas por `Settings`.

### El encabezado también mentía

Decía «copiar como `.env.production`». `Settings` carga `backend/.env` y ningún
otro nombre. El encabezado ahora dice las dos formas reales: en servidor
propio, copiar las claves a `backend/.env`; en Railway, cargarlas como
variables de entorno del servicio, sin renombrar ni subir la plantilla.

### Las tres claves muertas, y lo que rompe sacarlas

`ADMIN_EMAIL`, `ADMIN_PASSWORD` y `ADMIN_NAME` salieron de `Settings` y de las
dos plantillas. No cambié el seed.

**Tiene un costo que conviene ver:** un `backend/.env` de una copia anterior
que todavía las tenga **ya no arranca**, porque ahora son claves de más. Me
pasó en mi propio entorno al probarlo. Está avisado en la sección de problemas
de la guía; no hay forma de evitarlo sin dejar las claves muertas.

### El caso 32, rojo antes que verde

Carga cada plantilla con **el mismo `Settings` de la aplicación**, sustituyendo
sólo los placeholders `CAMBIAR_*` y `GENERAR_*`, y comprueba que no se borró
ninguna línea. El archivo se escribe adentro a propósito: una clave de más sólo
se rechaza cuando viene de un archivo, no cuando llega como variable de
entorno.

Los tres rojos que exigí antes de darlo por bueno:

```text
[FAIL] 32 — backend/.env.example: claves duplicadas, la última gana en
  silencio: JWT_SECRET
[FAIL] 32 — backend/.env.production.example: claves duplicadas, la última gana
  en silencio: DATABASE_URL          ← el defecto que encontraste
[FAIL] 32 — backend/.env.example: Settings no la aceptó tal cual:
  ValidationError: 1 validation error for Settings | DB_HOST | Extra inputs
  are not permitted
```

El tercero me hizo corregir el propio caso: la primera versión mostraba el
tramo del traceback y no la clave culpable. Un fallo que no dice qué sobra no
sirve.

```text
[PASS] 32 Las plantillas de configuración cargan sin retoques —
  backend/.env.example: 19 claves, 2 placeholders, sin duplicados;
  backend/.env.production.example: 19 claves, 4 placeholders, sin duplicados
```

### Docker: qué pude y qué no

Primero, la corrección que me toca: **no era cierto que no hubiera demonio.**
Estaba apagado y no probé arrancarlo. Lo arranqué y `docker info` responde
Server 29.3.1.

Con el demonio arriba armé el proyecto descartable tal como pediste, y quedó
bien aislado —lo verifiqué con `config` antes de levantarlo—:

| | Proyecto temporal |
|---|---|
| nombre | `tgtemporal`, que ni siquiera empieza con `topgreen` |
| contenedores | `tgtemporal-db`, `tgtemporal-api` |
| puertos | `5443` y `8010` |
| red | `tgtemporal_topgreen-network` |
| volúmenes | `tgtemporal_db_data`, `tgtemporal_uploads_data` |
| override | temporal, fuera del repositorio |

Al levantarlo, la descarga de `postgis/postgis:16-3.4` falla. El registro del
propio proxy de mi entorno dice:

```json
{ "kind": "connect_rejected",
  "detail": "gateway answered 403 to CONNECT (policy denial o upstream failure)",
  "host": "production.cloudfront.docker.com:443" }
```

El demonio sí salió por el proxy autorizado —heredó `HTTPS_PROXY`—, así que no
es un problema de configuración: es la política de egreso de mi entorno la que
niega el host de las capas de imagen. El instructivo del proxy es explícito:
un 403 se reporta, no se reintenta ni se rodea. **No probé espejos, ni túneles,
ni bajar la verificación de TLS.** Sin poder bajar `postgis/postgis` ni
`python:3.11-slim`, y sin caché local de imágenes, no hay migraciones, seed,
health ni prueba de persistencia de uploads que pueda ejecutar.

Dejé todo limpio: ni un contenedor, ni un volumen, ni una red. **Nunca existió
acá ningún recurso `topgreen-*`**, así que no había nada tuyo que tocar.

Vos lo corrés con `rtk proxy docker …`; acá no existe ese comando. Es la misma
diferencia de entorno que explica por qué a vos te aparecen `topgreen-db` y
`topgreen-api` saludables y a mí el motor arrancó vacío.

### Estado final

| Comprobación | Resultado |
|---|---|
| Suite oficial, base recreada desde cero | **32/32** |
| `npm run build` | verde |
| `docker compose config` del proyecto real | `DATABASE_URL` al `db:5432`, `UPLOAD_DIR=/data/uploads`, volumen `uploads_data` intacto |
| `git -c core.whitespace=cr-at-eol diff --cached --check` | sin avisos |

**No corrido:** la inicialización Docker, por lo de arriba. Tampoco
`npm run a11y` ni `npm run contraste`: no hay un solo cambio en `src/`.

## 4. Desvíos, riesgos y hallazgos

**Sin desvíos.** No armé el instalador automatizado; queda postergado a Fase 5
como dijiste. Las `VITE_*` siguen comentadas.

**El caso 32 corre `docker exec topgreen-api python`**, igual que `querySql`
corre `docker exec topgreen-db psql`. Hereda la dependencia de Docker que la
suite ya tenía; no agregué una nueva. Acá lo ejecuté con el mismo puente local
que uso para `psql` desde que la suite oficial no puede correr.

**Sigue abierto el `float` del checkout**, obligatorio antes de Fase 4.

## 5. DECISIÓN SOLICITADA

**Una sola: cómo cerramos la prueba Docker.** Tres caminos, y el que me parece
mejor primero.

**a) La corrés vos.** Tenés demonio, `rtk proxy` y los contenedores arriba. Yo
te paso el override temporal y la lista exacta de comprobaciones. Esfuerzo:
mínimo. **Es lo que recomiendo**, porque el bloqueo es de mi entorno y no del
producto.

**b) Se habilita el egreso a Docker Hub para mi sesión** —al menos
`production.cloudfront.docker.com`, y probablemente `registry-1.docker.io` y
`auth.docker.io`—. Ahí la corro completa, con el proyecto descartable ya
armado.

**c) Queda pendiente y se cierra en Fase 5**, junto con el despliegue, que es
cuando Docker se ejercita de verdad.

El entorno local sigue levantado.
