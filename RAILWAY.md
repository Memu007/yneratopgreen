# TopGreen en Railway

Esta configuración agrega Railway sin cambiar el desarrollo local. El proyecto
se despliega como tres servicios separados:

1. `Frontend`: este repositorio, directorio raíz `/`.
2. `Backend`: este repositorio, directorio raíz `/backend`.
3. `PostGIS`: plantilla PostGIS del marketplace de Railway.

No uses el PostgreSQL estándar: las migraciones y las consultas geográficas de
TopGreen requieren la extensión PostGIS.

## 1. Base PostGIS

Creá el servicio desde la plantilla PostGIS y llamalo `PostGIS`. No hace falta
exponerlo públicamente. Activá backups antes de cargar datos reales.

## 2. Backend

Conectá el repositorio al servicio `Backend` y configurá:

- Root Directory: `/backend`
- Config File: `/backend/railway.toml`
- Public Networking: generar dominio

Variables mínimas:

```dotenv
DATABASE_URL=${{PostGIS.DATABASE_URL}}
ENV=production
JWT_SECRET=GENERAR_UN_SECRETO_LARGO_Y_ALEATORIO
API_PREFIX=/api
CORS_ORIGINS=["https://${{Frontend.RAILWAY_PUBLIC_DOMAIN}}"]
FRONTEND_URL=https://${{Frontend.RAILWAY_PUBLIC_DOMAIN}}
UPLOAD_DIR=/data/uploads
PUBLIC_UPLOAD_BASE=/uploads
STORAGE_BACKEND=local
EMAIL_TRANSPORT=outbox
EMAIL_OUTBOX_DIR=/data/outbox
EMAIL_FROM=TopGreen <no-responder@topgreen.local>
```

Tres advertencias sobre esa lista.

**`PUBLIC_UPLOAD_BASE` va relativo, no como URL completa.** Es el prefijo que
se guarda en la base junto a cada imagen. Si fuera
`https://<backend>/uploads`, el panel de administración compondría
`https://<backend>https://<backend>/uploads/...` y mostraría las imágenes
rotas: ese lugar concatena `VITE_IMAGES_URL` sin comprobar si la URL ya es
absoluta. Con el valor relativo, el frontend arma la URL completa y las tres
pantallas que muestran imágenes coinciden.

**`FRONTEND_URL` arma el enlace de confirmación de correo.** Si apunta al
dominio equivocado, el enlace que recibe la gente no lleva a ninguna parte.

**El correo sale por `outbox`, que no envía nada.** Escribe cada mensaje como
un `.eml` dentro del volumen. Sirve para un ensayo con datos de demostración,
donde el enlace se lee del archivo. **Para producción con gente real hay que
poner `EMAIL_TRANSPORT=smtp`** y sus credenciales —`SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASSWORD`, `SMTP_TLS`—, que son secretos y van en el
entorno del servicio, nunca en el repositorio. Ver
`backend/.env.production.example`.

`Settings` **rechaza toda clave que no declara** cuando la lee de un archivo.
Las variables de Railway llegan por entorno, así que una clave de más no
tumba el arranque, pero tampoco hace nada: no agregues `ADMIN_EMAIL`,
`ADMIN_PASSWORD` ni `ADMIN_NAME`, que ya no existen. Tampoco hay administrador
preexistente: las cuentas de demostración con contraseña escrita en el
repositorio son del seed, y el seed no corre en producción —ver más abajo—. El
primer administrador se crea a mano sobre la base ya migrada.

El entrypoint acepta tanto `postgresql://` como `postgres://` de Railway y los
adapta al driver `psycopg` instalado. Antes de cada despliegue Railway ejecuta
`alembic upgrade head`; el seed no se ejecuta automáticamente.

Para conservar publicaciones, comprobantes y la carpeta de correo entre
despliegues, agregá un volumen al servicio `Backend` montado en `/data`. Sin
ese volumen, cada despliegue empieza con `/data` vacío: se pierden las
imágenes subidas y los mensajes del outbox.

**El seed de demostración no corre acá, y ya no puede.** `python -m app.seed`
crea cuatro cuentas cuyos correos y contraseñas están escritos en
`backend/app/seed.py`, o sea en el repositorio: sobre una base de verdad serían
accesos públicos y predecibles. Desde la consola del servicio `Backend`, con
`ENV=production`, el comando termina con estado 2 y este mensaje, sin abrir
ninguna conexión ni escribir ninguna fila:

```
⛔ El seed de demostración no corre con ENV='production'. Sólo corre con ENV en: local.
```

El freno mira `ENV` y sólo deja pasar `local`. No hay variable para saltearlo:
una de esas se enciende «un momentito» y queda encendida. Si hace falta una base
con datos de demostración, se siembra donde los datos son descartables —una base
local con `ENV=local`— y no acá.

Un despliegue con datos reales no necesita ese seed: las migraciones crean el
esquema y la primera cuenta se registra desde la aplicación. El padrón oficial
de localidades, que no trae ninguna credencial, sigue disponible aparte con
`python -m app.seed_localities`.

## 3. Frontend

Conectá el mismo repositorio al servicio `Frontend` y configurá:

- Root Directory: `/`
- Config File: `/railway.toml`
- Public Networking: generar dominio

Variables de compilación:

```dotenv
VITE_API_URL=https://${{Backend.RAILWAY_PUBLIC_DOMAIN}}/api
VITE_IMAGES_URL=https://${{Backend.RAILWAY_PUBLIC_DOMAIN}}
```

Vite incorpora esas dos variables al bundle durante el build. Si cambia el
dominio del backend, hay que redesplegar el frontend.

## 4. Verificación

Después del primer despliegue:

```text
GET https://<backend>/api/health  -> {"status":"ok", ...}
GET https://<frontend>/health     -> ok
GET https://<frontend>/           -> aplicación React
```

Revisá además:

- que una ruta directa del frontend no devuelva `404` —probá
  `https://<frontend>/verificar-correo`, que es la del enlace de correo—;
- que el catálogo cargue y las imágenes se vean, **incluidas las del panel de
  administración**;
- que una imagen subida siga disponible después de redesplegar el backend;
- que un registro deje su `.eml` en `/data/outbox` y que el enlace de ese
  archivo confirme la cuenta;
- que la base conserve usuarios y catálogo entre despliegues.

El healthcheck de Railway se usa **al desplegar**, para decidir si la versión
nueva reemplaza a la anterior. No es monitoreo continuo: no avisa si el
servicio se cae más tarde.
