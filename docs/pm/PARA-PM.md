# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-10.

## 1. Resultado

**Gate A entregado en parte, y con un hallazgo que valía el ensayo.**

Lo que no pude: **construir las dos imágenes ni levantarlas**. La política de
egreso de mi entorno sigue bloqueando la descarga de imágenes de Docker Hub.
Es el mismo bloqueo de la vez pasada, con el mismo registro del proxy.

**Gate B tampoco lo puedo ejecutar, y ahora sé por qué con precisión.** Vi tu
autorización de `b99c9f8` mientras terminaba. Acá no hay CLI de Railway, no hay
ninguna credencial en el entorno y —esto es lo decisivo— **la política de
egreso también bloquea `ynerav.up.railway.app`**, así que ni siquiera puedo
mirar el despliegue que ya existe. No intenté iniciar sesión ni pedí ningún
token.

Lo que sí puedo aportar es el diagnóstico de por qué ese `SUCCESS` sirve sólo
el frontend, y está abajo.

## 2. Tabla por criterio

| Gate A | Estado | Cómo |
|---|---|---|
| Sin login, sin recursos, sin tokens | **cumplido** | la CLI ni siquiera está instalada |
| `RAILWAY.md`: fuera las `ADMIN_*` | **cumplido** | y quedó dicho por qué no rompen pero tampoco sirven |
| `RAILWAY.md`: variables de correo | **cumplido** | `outbox`, `/data/outbox`, demo; SMTP para producción |
| Contradicciones entre guía, `railway.toml`, Dockerfiles y entrypoints | **cumplido** | detalle abajo |
| Monorepo conservado | **cumplido** | Frontend `/`, Backend `/backend`, config absoluta por servicio |
| Construir las dos imágenes | **no ejecutado** | egreso bloqueado |
| Docker aislado: PostGIS, migraciones, seed ×2, health, `/verificar-correo`, catálogo, outbox, upload, persistencia | **no ejecutado** | depende de lo anterior |
| `PROJECT_STATUS.md` reemplazado por aviso | **cumplido** | 149 → 29 líneas, historia intacta en Git |
| Sólo configuración, entrypoint o documentación | **cumplido** | cuatro archivos, todos documentación |

| Gate B | Estado |
|---|---|
| Todo | **no ejecutable desde acá**: sin CLI, sin credenciales y con el dominio bloqueado por la política de egreso |

## 3. El hallazgo que sí encontró el ensayo

`RAILWAY.md` mandaba:

```dotenv
PUBLIC_UPLOAD_BASE=https://${{Backend.RAILWAY_PUBLIC_DOMAIN}}/uploads
VITE_IMAGES_URL=https://${{Backend.RAILWAY_PUBLIC_DOMAIN}}
```

`PUBLIC_UPLOAD_BASE` es el prefijo que **se guarda en la base** junto a cada
imagen. Con ese valor la base guarda una URL absoluta, y el panel de
administración vuelve a anteponerle `VITE_IMAGES_URL` porque ese lugar
—a diferencia del catálogo y del panel del usuario— no comprueba si la URL ya
es absoluta.

**No lo razoné: lo reproduje.** Puse esa configuración en local, subí una
imagen y miré el panel. Las dos filas conviven en la misma pantalla:

```text
URL guardada con base absoluta : http://127.0.0.1:8000/uploads/products/…png
  src en el panel : http://127.0.0.1:8000http://127.0.0.1:8000/uploads/…png
  ancho : 0   (ROTA)

Imagen guardada con base relativa
  src en el panel : http://127.0.0.1:8000/uploads/products/…png
  ancho : 1   (se ve)
```

La guía pasa a documentar `PUBLIC_UPLOAD_BASE=/uploads`, que es el valor que ya
traen las dos plantillas y con el que las tres pantallas coinciden. **Es
corrección de configuración, no de producto:** el código no se tocó.

Que el panel de administración concatene sin comprobar sigue siendo una
fragilidad; con el valor relativo no se manifiesta. Queda anotado, no abierto.

## 4. Lo demás que corregí en la guía

- **Faltaban todas las variables de correo.** Sin `EMAIL_OUTBOX_DIR` apuntando
  al volumen, los mensajes se escriben en una carpeta efímera y **se pierden en
  cada despliegue**: en el ensayo no habría enlace que leer. Quedan
  documentadas, con la advertencia de que producción exige SMTP y que esas
  credenciales no van al repositorio.
- **Las `ADMIN_*` afuera.** Aclaro que no tumban el arranque —llegan por
  entorno y `Settings` sólo rechaza extras cuando los lee de un archivo— pero
  que no hacen nada, y de dónde sale realmente la contraseña del admin.
- **El seed no tenía comando.** Ahora está, con la aclaración de que es
  idempotente.
- **Sin volumen se pierde `/data`**: dicho explícitamente.
- **La verificación** pasa a incluir la ruta directa `/verificar-correo`, las
  imágenes del panel de administración, el `.eml` en `/data/outbox` y la
  persistencia de la base.
- **El healthcheck** de Railway actúa al desplegar y no es monitoreo continuo.
  Lo dejé escrito para que nadie lo confunda con una alarma.

## 5. Por qué el despliegue actual sirve sólo el frontend

Tu observación encaja con la configuración, y la causa es de una sola línea.

`strong-playfulness` tiene **un** servicio, `yneratopgreen`, con raíz `/`. Con
esa raíz, Railway toma el `railway.toml` de la raíz, que apunta a
`Dockerfile.railway` **del frontend**: build de Vite y nginx. Ese nginx sirve
estáticos y tiene

```nginx
location / { try_files $uri $uri/ /index.html; }
```

que es lo que hace funcionar `/verificar-correo`… y lo que se traga `/api/*`.
No hay backend en ese servicio: `/api/health` devuelve el `index.html` con
`text/html`, que es exactamente lo que viste. El `SUCCESS` es honesto —el
healthcheck del frontend es `/health` y nginx lo responde—, pero mide sólo el
frontend.

**No falta código ni configuración en el repositorio: falta el despliegue que
`RAILWAY.md` describe.** Hacen falta tres servicios, y el actual sirve como el
`Frontend`:

| Servicio | Root Directory | Config File | Falta |
|---|---|---|---|
| `Frontend` | `/` | `/railway.toml` | ya existe; revisar que `VITE_API_URL` apunte al dominio del backend nuevo |
| `Backend` | `/backend` | `/backend/railway.toml` | crear, con volumen en `/data` |
| `PostGIS` | plantilla del marketplace | — | crear, privado |

Con los tres, `/api/*` deja de pasar por nginx porque el navegador llama al
dominio del backend directamente, que es para lo que están `VITE_API_URL` y
`CORS_ORIGINS`.

Dos cosas para mirar cuando alguien pueda ejecutarlo: que el `Frontend` se
redespliegue **después** de que exista el dominio del backend —las dos `VITE_*`
se hornean en el bundle— y que el volumen esté montado antes del primer
registro, o el `.eml` se pierde.

## 6. Lo que sí pude verificar sin Docker

| Comprobación | Resultado |
|---|---|
| Los dos `railway.toml` parsean, con el Dockerfile, health y pre-deploy esperados | OK |
| `railway-entrypoint.sh`: sintaxis y reescritura de `postgres://`, `postgresql://` y `postgresql+psycopg://` | las tres terminan en `postgresql+psycopg://` |
| Plantilla de nginx renderizada con `PORT`: `try_files … /index.html` | **`/verificar-correo` no daría 404** |
| Build del frontend con las dos variables de Railway | verde, y las dos URLs quedan incrustadas en el bundle |
| `Settings` con exactamente el conjunto de variables de la guía, sin archivo `.env`, como en Railway | carga; `UPLOAD_DIR=/data/uploads`, `EMAIL_OUTBOX_DIR=/data/outbox`, imagen guardada como `/uploads/products/…` |
| `npm run build`, caso 32 de plantillas, `diff --check` | verdes |

No repetí 37/37: no toqué producto, correo ni seed.

## 7. Los bloqueos, con su registro

```text
$ docker pull python:3.11-slim
failed to copy: … Get "https://production.cloudfront.docker.com/…": Forbidden
proxy: connect_rejected  production.cloudfront.docker.com:443

$ curl https://ynerav.up.railway.app/health
curl: (56) CONNECT tunnel failed, response 403
proxy: connect_rejected  ynerav.up.railway.app:443
```

El demonio sale por el proxy autorizado. El instructivo del proxy dice que un
403 se reporta y no se reintenta ni se rodea: **no probé espejos, ni túneles,
ni bajar la verificación de TLS.** Sin `python:3.11-slim`, `node:20-alpine`,
`nginx:alpine` ni `postgis/postgis:16-3.4`, y sin caché local, no hay imagen
que construir.

## 8. Desvío

**Dos archivos fuera de tu lista.** `DELIVERY_CHECKLIST.md` y
`docs/SETUP_PAYMENTS.md` mandaban rotar `ADMIN_PASSWORD` antes de producción,
una clave que **yo mismo eliminé** hace dos piezas. Dejar una instrucción falsa
en una lista de entrega me pareció peor que el desvío: ahora nombran las
credenciales SMTP y aclaran de dónde sale la contraseña del admin. Si preferís
que vuelvan como estaban, lo revierto.

**Anotado para la auditoría, no tocado:** `backend/Dockerfile.railway` corre
como **root**; el Dockerfile local crea `appuser` y lo usa. Cambiarlo sin poder
probar el volumen sería a ciegas.

## 9. DECISIÓN SOLICITADA

**Cómo cerramos la parte Docker de Gate A.** Tres caminos.

**a) La corrés vos**, como la vez pasada, con las comprobaciones de tu lista.
Te paso el override temporal ya armado. **Es lo que recomiendo:** el bloqueo es
de mi entorno, no del producto, y ya demostró que sabés ejecutarlo.

**b) Se habilita el egreso a Docker Hub para mi sesión** —al menos
`production.cloudfront.docker.com`, `registry-1.docker.io` y `auth.docker.io`—
y la corro completa dentro de la jornada.

**c) Se da por suficiente la verificación estática** y la parte Docker se
absorbe en Gate B, donde Railway construye las imágenes de todos modos.

**Y una segunda, ahora que Gate B está autorizado: quién lo ejecuta.** Yo no
puedo: sin CLI, sin credenciales y con el dominio bloqueado, cualquier cosa que
informara sería inventada. O lo corrés vos con la sesión ya autenticada, o hay
que habilitar el egreso a Railway y darme una forma de autenticación que no
pase por GitHub. **Recomiendo lo primero**, y que yo quede para diagnosticar lo
que aparezca: el paso siguiente concreto es crear los servicios `Backend` y
`PostGIS` con las raíces de la tabla del punto 5.

**Sigue abierto el `float` del checkout**, obligatorio antes de Fase 4.

El entorno local sigue levantado.
