# Backup y restore local de TopGreen

Este procedimiento copia la base PostgreSQL/PostGIS y los dos almacenamientos
persistentes (`/data/uploads` y `/data/documentos`) sin detener ni reemplazar
los contenedores de origen. Sólo opera con Docker local.

## Requisitos

- `topgreen-db` y `topgreen-api` en marcha y saludables;
- Docker, `tar`, `awk` y `shasum` o `sha256sum` disponibles;
- las imágenes actuales de ambos contenedores presentes localmente;
- espacio suficiente para el dump y los archivos.

Los bundles se guardan bajo `backups/`, que Git ignora porque pueden contener
datos. No incluyen variables de entorno ni contraseñas.

## Procedimiento único

Desde la raíz del repositorio:

```bash
# 1. Backup
./scripts/backup_restore.sh backup backups/topgreen-20260913T120000Z

# 2. Restore aislado; elegí un prefijo nuevo
./scripts/backup_restore.sh restore \
  backups/topgreen-20260913T120000Z topgreen-restore-control-20260913

# 3. Verificación automática
./scripts/backup_restore.sh verify \
  backups/topgreen-20260913T120000Z topgreen-restore-control-20260913

# 4. Limpieza exclusiva del destino de control
./scripts/backup_restore.sh cleanup topgreen-restore-control-20260913
```

El bundle contiene:

- `database.dump`: dump lógico en formato custom de `pg_dump`;
- `data.tar.gz`: copia autocontenida de uploads y documentos;
- `manifest.txt`: fecha UTC, versión/formato e imágenes locales necesarias;
- `schema.sql`, `database.tsv` y `data.tsv`: fingerprints verificables;
- `checksums.sha256`: integridad de todos los archivos anteriores.

`verify` compara el esquema, las extensiones (incluida PostGIS), cada tabla con
su cantidad y huella de filas, las secuencias y cada archivo con ruta, tamaño y
SHA-256. No consulta el origen: el restore y su verificación dependen sólo del
bundle y de las imágenes locales registradas en el manifiesto.

## Ensayo completo

```bash
./scripts/backup_restore.sh self-test
```

El ensayo agrega marcadores no sensibles y transitorios al origen local, toma
el backup, restaura en volúmenes y contenedores nuevos, verifica el positivo,
altera un archivo restaurado y exige que el negativo falle. Finalmente elimina
los marcadores y el destino de control, y comprueba que identidad, fingerprints
y salud de `topgreen-db` y `topgreen-api` coincidan con el inicio. Conserva el
bundle bajo `backups/` para inspección.

## Guardas

- Los destinos siempre usan un prefijo que comienza con `topgreen-restore-`.
- Si cualquier nombre o volumen de destino ya existe, `restore` frena.
- `cleanup` rechaza prefijos distintos y sólo nombra los dos contenedores y los
  tres volúmenes derivados de ese prefijo.
- No se publican puertos y Docker usa `--pull=never`: no hay acceso implícito a
  un registry ni a un entorno remoto.
- Una falla no borra recursos automáticamente; ejecutá `cleanup` con el prefijo
  exacto después de inspeccionarla.
