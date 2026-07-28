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
PUBLIC_UPLOAD_BASE=https://${{Backend.RAILWAY_PUBLIC_DOMAIN}}/uploads
STORAGE_BACKEND=local
ADMIN_EMAIL=admin@topgreen.com
ADMIN_PASSWORD=CAMBIAR_ANTES_DEL_PRIMER_DEPLOY
ADMIN_NAME=Administrador TopGreen
```

El entrypoint acepta tanto `postgresql://` como `postgres://` de Railway y los
adapta al driver `psycopg` instalado. Antes de cada despliegue Railway ejecuta
`alembic upgrade head`; el seed no se ejecuta automáticamente.

Para conservar publicaciones y comprobantes entre despliegues, agregá un
volumen al servicio `Backend` montado en `/data`.

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

Revisá además que una recarga directa del frontend no devuelva `404`, que el
catálogo cargue y que una imagen subida siga disponible después de redesplegar
el backend.
