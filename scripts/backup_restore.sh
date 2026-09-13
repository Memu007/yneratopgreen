#!/bin/sh
set -eu

FORMATO=1
DB_ORIGEN=${TOPGREEN_DB_CONTAINER:-topgreen-db}
DATOS_ORIGEN=${TOPGREEN_DATA_CONTAINER:-topgreen-api}

fallar() {
  echo "ERROR: $*" >&2
  exit 1
}

requerir() {
  command -v "$1" >/dev/null 2>&1 || fallar "falta la utilidad '$1'"
}

sha256_archivo() {
  if command -v shasum >/dev/null 2>&1; then
    LC_ALL=C shasum -a 256 "$1" | awk '{print $1}'
  else
    sha256sum "$1" | awk '{print $1}'
  fi
}

verificar_checksums() {
  bundle=$1
  while read -r hash archivo; do
    [ -n "$hash" ] || continue
    [ "$(sha256_archivo "$bundle/$archivo")" = "$hash" ] || \
      fallar "checksum inválido: $archivo"
  done < "$bundle/checksums.sha256"
}

valor_manifiesto() {
  clave=$1
  archivo=$2
  awk -F= -v clave="$clave" '$1 == clave {sub(/^[^=]*=/, ""); print; exit}' "$archivo"
}

validar_prefijo() {
  case "$1" in
    topgreen-restore-[a-z0-9]* ) ;;
    * ) fallar "el prefijo debe comenzar con topgreen-restore- y usar minúsculas, números o guiones" ;;
  esac
  case "$1" in
    *[!a-z0-9-]* ) fallar "prefijo de restore inválido" ;;
  esac
}

contenedor_en_marcha() {
  [ "$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null || true)" = true ] || \
    fallar "el contenedor '$1' no está en marcha"
}

inventario_db() {
  contenedor=$1
  salida=$2
  docker exec -i "$contenedor" sh -eu -c '
    exec psql -X --no-psqlrc --set ON_ERROR_STOP=1 \
      --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" \
      --tuples-only --no-align --field-separator="	"
  ' > "$salida" <<'SQL'
SELECT 'server_version', current_setting('server_version');
SELECT 'extension', extname, extversion FROM pg_extension ORDER BY extname;
SELECT format(
  'SELECT %L, %L, count(*)::text, md5(COALESCE(string_agg(to_jsonb(t)::text, E''\n'' ORDER BY to_jsonb(t)::text), '''')) FROM %I.%I t;',
  'table', schemaname || '.' || tablename, schemaname, tablename
)
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schemaname, tablename;
\gexec
SELECT 'sequence', schemaname || '.' || sequencename,
       COALESCE(last_value::text, 'null')
FROM pg_sequences
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schemaname, sequencename;
SQL
}

esquema_db() {
  contenedor=$1
  salida=$2
  docker exec "$contenedor" sh -eu -c '
    exec pg_dump --schema-only --no-owner --no-acl \
      --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"
  ' > "$salida"
}

inventario_datos() {
  contenedor=$1
  salida=$2
  docker exec "$contenedor" python -c '
from hashlib import sha256
from pathlib import Path

base = Path("/data")
for raiz in ("uploads", "documentos"):
    for ruta in sorted((base / raiz).rglob("*")):
        if ruta.is_symlink():
            raise SystemExit(f"enlace simbólico no soportado: {ruta}")
        if ruta.is_file():
            digest = sha256()
            with ruta.open("rb") as archivo:
                for bloque in iter(lambda: archivo.read(1024 * 1024), b""):
                    digest.update(bloque)
            print(f"file\t{ruta.relative_to(base).as_posix()}\t{ruta.stat().st_size}\t{digest.hexdigest()}")
' > "$salida"
}

backup() (
  bundle=$1
  requerir docker
  requerir awk
  requerir tar
  [ ! -e "$bundle" ] || fallar "el destino ya existe: $bundle"
  contenedor_en_marcha "$DB_ORIGEN"
  contenedor_en_marcha "$DATOS_ORIGEN"

  mkdir -p "$bundle"
  trap 'rm -rf "$bundle"' INT TERM HUP EXIT

  db_usuario=$(docker exec "$DB_ORIGEN" printenv POSTGRES_USER)
  db_nombre=$(docker exec "$DB_ORIGEN" printenv POSTGRES_DB)
  db_imagen=$(docker inspect -f '{{.Config.Image}}' "$DB_ORIGEN")
  api_imagen=$(docker inspect -f '{{.Config.Image}}' "$DATOS_ORIGEN")
  creado=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

  docker exec "$DB_ORIGEN" sh -eu -c '
    exec pg_dump --format=custom --no-owner --no-acl \
      --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"
  ' > "$bundle/database.dump"
  esquema_db "$DB_ORIGEN" "$bundle/schema.sql"
  inventario_db "$DB_ORIGEN" "$bundle/database.tsv"
  inventario_datos "$DATOS_ORIGEN" "$bundle/data.tsv"
  docker exec "$DATOS_ORIGEN" tar -C /data -czf - uploads documentos > "$bundle/data.tar.gz"

  {
    echo "format_version=$FORMATO"
    echo "created_at_utc=$creado"
    echo "database_format=pg_dump_custom"
    echo "data_format=tar_gzip"
    echo "database_name=$db_nombre"
    echo "database_user=$db_usuario"
    echo "database_image=$db_imagen"
    echo "data_image=$api_imagen"
    echo "data_roots=uploads,documentos"
  } > "$bundle/manifest.txt"

  : > "$bundle/checksums.sha256"
  for archivo in manifest.txt database.dump schema.sql database.tsv data.tar.gz data.tsv; do
    echo "$(sha256_archivo "$bundle/$archivo")  $archivo" >> "$bundle/checksums.sha256"
  done

  trap - INT TERM HUP EXIT
  echo "Backup creado: $bundle"
)

recurso_existe() {
  docker inspect "$1" >/dev/null 2>&1 || docker volume inspect "$1" >/dev/null 2>&1
}

restore() {
  bundle=$1
  prefijo=$2
  validar_prefijo "$prefijo"
  [ -f "$bundle/manifest.txt" ] || fallar "bundle inválido: falta manifest.txt"
  [ -f "$bundle/checksums.sha256" ] || fallar "bundle inválido: faltan checksums"
  verificar_checksums "$bundle"
  [ "$(valor_manifiesto format_version "$bundle/manifest.txt")" = "$FORMATO" ] || \
    fallar "versión de bundle no soportada"

  db_contenedor="$prefijo-db"
  datos_contenedor="$prefijo-data"
  db_volumen="$prefijo-db"
  uploads_volumen="$prefijo-uploads"
  documentos_volumen="$prefijo-documentos"
  for recurso in "$db_contenedor" "$datos_contenedor" "$db_volumen" "$uploads_volumen" "$documentos_volumen"; do
    recurso_existe "$recurso" && fallar "el recurso de destino ya existe: $recurso"
  done

  db_nombre=$(valor_manifiesto database_name "$bundle/manifest.txt")
  db_usuario=$(valor_manifiesto database_user "$bundle/manifest.txt")
  db_imagen=$(valor_manifiesto database_image "$bundle/manifest.txt")
  api_imagen=$(valor_manifiesto data_image "$bundle/manifest.txt")
  case "$db_nombre" in *[!A-Za-z0-9_-]*|'') fallar "nombre de base inválido en manifiesto";; esac
  case "$db_usuario" in *[!A-Za-z0-9_-]*|'') fallar "usuario de base inválido en manifiesto";; esac

  docker image inspect "$db_imagen" >/dev/null 2>&1 || fallar "imagen local ausente: $db_imagen"
  docker image inspect "$api_imagen" >/dev/null 2>&1 || fallar "imagen local ausente: $api_imagen"
  docker volume create "$db_volumen" >/dev/null
  docker volume create "$uploads_volumen" >/dev/null
  docker volume create "$documentos_volumen" >/dev/null

  docker run -d --pull=never --name "$db_contenedor" \
    --mount "source=$db_volumen,target=/var/lib/postgresql/data" \
    -e "POSTGRES_DB=$db_nombre" -e "POSTGRES_USER=$db_usuario" \
    -e POSTGRES_PASSWORD=restore-local-only "$db_imagen" >/dev/null
  docker run -d --pull=never --name "$datos_contenedor" \
    --mount "source=$uploads_volumen,target=/data/uploads" \
    --mount "source=$documentos_volumen,target=/data/documentos" \
    --entrypoint sh "$api_imagen" -c 'while :; do sleep 3600; done' >/dev/null

  listo=false
  intentos=0
  while [ "$intentos" -lt 60 ]; do
    # El entrypoint oficial abre primero un PostgreSQL temporal y luego lo
    # apaga. Esperar a que PID 1 sea postgres evita restaurar en esa ventana.
    if docker exec "$db_contenedor" sh -c \
      '[ "$(cat /proc/1/comm)" = postgres ] && pg_isready -U "$1" -d "$2"' \
      sh "$db_usuario" "$db_nombre" >/dev/null 2>&1; then
      listo=true
      break
    fi
    intentos=$((intentos + 1))
    sleep 1
  done
  [ "$listo" = true ] || fallar "la base de destino no llegó a estar disponible"

  # La imagen PostGIS crea extensiones auxiliares en su base inicial. El dump
  # lógico debe decidir el esquema exacto, por eso restauramos sobre template0.
  docker exec "$db_contenedor" dropdb --if-exists \
    --username="$db_usuario" --maintenance-db=postgres "$db_nombre"
  docker exec "$db_contenedor" createdb --template=template0 \
    --owner="$db_usuario" --username="$db_usuario" "$db_nombre"
  docker exec -i "$db_contenedor" pg_restore --exit-on-error --no-owner --no-acl \
    --username="$db_usuario" --dbname="$db_nombre" < "$bundle/database.dump"
  docker exec -i "$datos_contenedor" tar -C /data -xzf - < "$bundle/data.tar.gz"
  echo "Restore creado con prefijo: $prefijo"
}

verify() (
  bundle=$1
  prefijo=$2
  validar_prefijo "$prefijo"
  verificar_checksums "$bundle"
  db_contenedor="$prefijo-db"
  datos_contenedor="$prefijo-data"
  contenedor_en_marcha "$db_contenedor"
  contenedor_en_marcha "$datos_contenedor"

  temporal=$(mktemp -d "${TMPDIR:-/tmp}/topgreen-verify.XXXXXX")
  trap 'rm -rf "$temporal"' INT TERM HUP EXIT
  esquema_db "$db_contenedor" "$temporal/schema.sql"
  inventario_db "$db_contenedor" "$temporal/database.tsv"
  inventario_datos "$datos_contenedor" "$temporal/data.tsv"

  cmp -s "$bundle/schema.sql" "$temporal/schema.sql" || fallar "el esquema restaurado no coincide"
  cmp -s "$bundle/database.tsv" "$temporal/database.tsv" || fallar "los datos restaurados no coinciden"
  cmp -s "$bundle/data.tsv" "$temporal/data.tsv" || fallar "los archivos restaurados no coinciden"
  trap - INT TERM HUP EXIT
  rm -rf "$temporal"
  echo "Verificación íntegra: esquema, extensiones, tablas, filas y archivos coinciden"
)

cleanup() {
  prefijo=$1
  validar_prefijo "$prefijo"
  for contenedor in "$prefijo-db" "$prefijo-data"; do
    if docker inspect "$contenedor" >/dev/null 2>&1; then
      docker rm -f "$contenedor" >/dev/null || fallar "no se pudo eliminar $contenedor"
    fi
  done
  for volumen in "$prefijo-db" "$prefijo-uploads" "$prefijo-documentos"; do
    if docker volume inspect "$volumen" >/dev/null 2>&1; then
      docker volume rm "$volumen" >/dev/null || fallar "no se pudo eliminar $volumen"
    fi
  done
  echo "Destino aislado eliminado: $prefijo"
}

self_test() {
  salida=${1:-backups}
  ejecucion=$(date -u '+%Y%m%d%H%M%S')-$$
  prefijo="topgreen-restore-test-$ejecucion"
  bundle="$salida/self-test-$ejecucion"
  esquema_probe="backup_restore_probe_${ejecucion%%-*}"
  archivo_probe=".backup-restore-probe-$ejecucion.txt"
  temporal=$(mktemp -d "${TMPDIR:-/tmp}/topgreen-self-test.XXXXXX")
  db_id=$(docker inspect -f '{{.Id}}' "$DB_ORIGEN")
  api_id=$(docker inspect -f '{{.Id}}' "$DATOS_ORIGEN")

  limpiar_pruebas() {
    cleanup "$prefijo" >/dev/null 2>&1 || echo "ADVERTENCIA: revisar recursos $prefijo" >&2
    docker exec "$DATOS_ORIGEN" rm -f "/data/uploads/$archivo_probe" >/dev/null 2>&1 || true
    docker exec "$DB_ORIGEN" sh -c \
      'psql -X --no-psqlrc --set ON_ERROR_STOP=1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" -c "DROP SCHEMA IF EXISTS '$esquema_probe' CASCADE"' \
      >/dev/null 2>&1 || true
    rm -rf "$temporal"
  }
  trap limpiar_pruebas INT TERM HUP EXIT

  contenedor_en_marcha "$DB_ORIGEN"
  contenedor_en_marcha "$DATOS_ORIGEN"
  [ "$(docker inspect -f '{{.State.Health.Status}}' "$DB_ORIGEN")" = healthy ] || fallar "origen DB no saludable"
  [ "$(docker inspect -f '{{.State.Health.Status}}' "$DATOS_ORIGEN")" = healthy ] || fallar "origen API no saludable"
  inventario_db "$DB_ORIGEN" "$temporal/db-antes.tsv"
  inventario_datos "$DATOS_ORIGEN" "$temporal/data-antes.tsv"

  docker exec "$DB_ORIGEN" sh -c \
    'psql -X --no-psqlrc --set ON_ERROR_STOP=1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" -c "CREATE SCHEMA '$esquema_probe'; CREATE TABLE '$esquema_probe'.marker (value text PRIMARY KEY); INSERT INTO '$esquema_probe'.marker VALUES ('\''backup-restore-marker'\'');"' \
    >/dev/null
  docker exec "$DATOS_ORIGEN" sh -c 'printf "%s\n" backup-restore-marker > "$1"' sh "/data/uploads/$archivo_probe"

  backup "$bundle"
  restore "$bundle" "$prefijo"
  verify "$bundle" "$prefijo"
  echo "Positivo: marcador DB y archivo incluidos en fingerprints restaurados"

  docker exec "$prefijo-data" sh -c 'printf tampered >> "$1"' sh "/data/uploads/$archivo_probe"
  if verify "$bundle" "$prefijo" >"$temporal/negativo.log" 2>&1; then
    fallar "el negativo no detectó el archivo alterado"
  fi
  echo "Negativo: archivo alterado rechazado por la verificación"

  cleanup "$prefijo"
  docker exec "$DATOS_ORIGEN" rm -f "/data/uploads/$archivo_probe"
  docker exec "$DB_ORIGEN" sh -c \
    'psql -X --no-psqlrc --set ON_ERROR_STOP=1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" -c "DROP SCHEMA '$esquema_probe' CASCADE"' \
    >/dev/null
  inventario_db "$DB_ORIGEN" "$temporal/db-despues.tsv"
  inventario_datos "$DATOS_ORIGEN" "$temporal/data-despues.tsv"
  cmp -s "$temporal/db-antes.tsv" "$temporal/db-despues.tsv" || fallar "el origen DB cambió durante la prueba"
  cmp -s "$temporal/data-antes.tsv" "$temporal/data-despues.tsv" || fallar "el almacenamiento origen cambió durante la prueba"
  [ "$(docker inspect -f '{{.Id}}' "$DB_ORIGEN")" = "$db_id" ] || fallar "cambió la identidad de DB origen"
  [ "$(docker inspect -f '{{.Id}}' "$DATOS_ORIGEN")" = "$api_id" ] || fallar "cambió la identidad de API origen"
  [ "$(docker inspect -f '{{.State.Health.Status}}' "$DB_ORIGEN")" = healthy ] || fallar "DB origen terminó no saludable"
  [ "$(docker inspect -f '{{.State.Health.Status}}' "$DATOS_ORIGEN")" = healthy ] || fallar "API origen terminó no saludable"
  echo "Origen intacto: identidades, fingerprints y salud coinciden antes/después"

  trap - INT TERM HUP EXIT
  rm -rf "$temporal"
  echo "Self-test completo. Bundle conservado: $bundle"
}

uso() {
  cat <<'EOF'
Uso:
  scripts/backup_restore.sh backup BUNDLE
  scripts/backup_restore.sh restore BUNDLE PREFIJO
  scripts/backup_restore.sh verify BUNDLE PREFIJO
  scripts/backup_restore.sh cleanup PREFIJO
  scripts/backup_restore.sh self-test [DIRECTORIO]

PREFIJO debe comenzar con topgreen-restore-. El script nunca limpia recursos
que no respeten ese prefijo.
EOF
}

comando=${1:-}
case "$comando" in
  backup) [ "$#" -eq 2 ] || { uso; exit 2; }; backup "$2" ;;
  restore) [ "$#" -eq 3 ] || { uso; exit 2; }; restore "$2" "$3" ;;
  verify) [ "$#" -eq 3 ] || { uso; exit 2; }; verify "$2" "$3" ;;
  cleanup) [ "$#" -eq 2 ] || { uso; exit 2; }; cleanup "$2" ;;
  self-test) [ "$#" -le 2 ] || { uso; exit 2; }; self_test "${2:-backups}" ;;
  *) uso; exit 2 ;;
esac
