#!/usr/bin/env bash
# Respaldo y restauración verificada del estado local.
#
# Persistencia no es respaldo. `topgreen-db` y el volumen de `/data` conservan
# el estado mientras nada los rompa, pero eso no es una copia: no hay nada que
# devolver si el volumen se pierde, si una migración sale mal o si alguien borra
# una fila. Esta pieza hace lo que falta: saca una copia restaurable, la deja
# con manifiesto y checksums, la RESTAURA en un destino nuevo y aislado, y
# COMPARA origen contra destino. Si la comparación no cierra, falla.
#
#   ./scripts/respaldo.sh respaldar              copia base + almacenamiento
#   ./scripts/respaldo.sh restaurar  <bundle>    lo recupera en un destino nuevo
#   ./scripts/respaldo.sh verificar  <bundle>    compara el destino con el bundle
#   ./scripts/respaldo.sh limpiar    <destino>   borra SÓLO ese destino de prueba
#   ./scripts/respaldo.sh huella                 imprime la huella del origen
#
# Lo que esta pieza NO hace, a propósito: no toca Railway, no baja datos
# remotos, no contrata backups administrados y no escribe ni un secreto en el
# manifiesto. Tampoco toca el origen: el respaldo es de sólo lectura y la
# restauración va siempre a nombres nuevos.
#
# Dos entornos, un solo procedimiento. Con demonio de Docker usa los
# contenedores y volúmenes del lanzador oficial; sin él usa el PostgreSQL nativo
# y los directorios del backend. La diferencia son tres funciones; el resto
# —manifiesto, huella, comparación, negativo, limpieza— es el mismo código.
set -euo pipefail

# `xargs` no puede llamar a una función del guión, así que la huella lo invoca a
# él con este modo interno. Va ANTES del `cd` de abajo: las rutas que le pasa
# `xargs` son relativas a la carpeta que se está midiendo, no a la raíz del
# repositorio. No es un comando de la pieza y no se usa a mano.
if [ "${1:-}" = "--sha256" ]; then
  shift
  if command -v sha256sum >/dev/null 2>&1; then exec sha256sum "$@"; fi
  exec shasum -a 256 "$@"
fi

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

# --------------------------------------------------------------------------
# Nombres. Todo lo que crea esta pieza lleva un prefijo inequívoco, y la
# limpieza no acepta nada que no lo tenga: es lo único que separa «borrar mi
# destino de prueba» de «borrarle la base a alguien».
# --------------------------------------------------------------------------
DIR_RESPALDOS="${TOPGREEN_RESPALDOS:-respaldos}"
PREFIJO_BASE="topgreen_restore_"
PREFIJO_DIR="destino-"
PATRON_BASE="^${PREFIJO_BASE}[0-9]{8}_[0-9]{6}$"

# La marca de propiedad. El prefijo del nombre NO demuestra nada: cualquiera
# puede crear una base o una carpeta que se llame igual, y borrar por patrón es
# borrar lo que otro dejó ahí. Cada recurso que crea esta pieza queda firmado
# con un identificador de ejecución, y `limpiar` no borra nada que no lleve su
# firma. La firma vive en un esquema aparte —`respaldo_meta`— para no ensuciar
# los datos restaurados ni la comparación, que sólo mira `public`.
ESQUEMA_MARCA="respaldo_meta"
ARCHIVO_MARCA=".propiedad"

# Etiquetas de los recursos Docker que crea la pieza. Van en el contenedor y en
# el volumen de destino, y `limpiar` las exige antes de cada borrado: un nombre
# que coincide no prueba nada, una etiqueta puesta por esta ejecución sí.
ETIQUETA_PIEZA="topgreen.respaldo=pieza"
ETIQUETA_EJECUCION="topgreen.respaldo.ejecucion"

# El origen, que nunca se toca.
BASE_ORIGEN="${TOPGREEN_DB_NOMBRE:-topgreen}"
USUARIO_ORIGEN="${TOPGREEN_DB_USUARIO:-topgreen}"
CLAVE_ORIGEN="${TOPGREEN_DB_PASSWORD:-topgreen_local}"
HOST_ORIGEN="${TOPGREEN_DB_HOST:-127.0.0.1}"
CONTENEDOR_DB="topgreen-db"
CONTENEDOR_API="topgreen-api"
IMAGEN_DESTINO=""   # se descubre del contenedor real, no se elige acá

# Coordenadas del destino para un sello dado. Con Docker el destino es un
# contenedor y un volumen propios, y la base adentro se llama como la de origen
# porque es una copia; sin Docker es una base nueva en el clúster local.
contenedor_de() { echo "topgreen-restore-$1-db"; }
volumen_de() { echo "topgreen-restore-$1-datos"; }
base_de() {
  if [ "$ENTORNO" = docker ]; then echo "$BASE_ORIGEN"; else echo "${PREFIJO_BASE}$1"; fi
}

paso() { printf '\n===> %s\n' "$1"; }
nota() { printf '     %s\n' "$1"; }
fatal() { printf 'ERROR: %s\n' "$1" >&2; exit 1; }

hay_docker() { docker info >/dev/null 2>&1; }
ENTORNO="nativo"; hay_docker && ENTORNO="docker"

# --------------------------------------------------------------------------
# Con Docker, NADA se adivina: usuario, base, imagen y rutas del almacenamiento
# salen de los contenedores que están corriendo.
#
# Adivinarlos fue el defecto de la entrega anterior: los volúmenes se llamaban
# `uploads_data` en el compose, pero Compose les pone el prefijo del proyecto,
# así que ese nombre NO existe. Montarlo habría creado un volumen vacío y lo
# habría respaldado como si fuera el origen. Y el usuario no es `postgres`: es
# el que diga `POSTGRES_USER` del contenedor.
# --------------------------------------------------------------------------
variable_del_contenedor() {  # variable_del_contenedor <contenedor> <nombre>
  docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$1" 2>/dev/null \
    | sed -n "s/^$2=//p" | head -1
}

descubrir_el_origen_docker() {
  docker inspect -f '{{.State.Running}}' "$CONTENEDOR_DB" 2>/dev/null | grep -q true \
    || fatal "el contenedor $CONTENEDOR_DB no está en marcha"
  docker inspect -f '{{.State.Running}}' "$CONTENEDOR_API" 2>/dev/null | grep -q true \
    || fatal "el contenedor $CONTENEDOR_API no está en marcha"

  USUARIO_ORIGEN="$(variable_del_contenedor "$CONTENEDOR_DB" POSTGRES_USER)"
  BASE_ORIGEN="$(variable_del_contenedor "$CONTENEDOR_DB" POSTGRES_DB)"
  IMAGEN_DESTINO="$(docker inspect -f '{{.Config.Image}}' "$CONTENEDOR_DB")"
  [ -n "$USUARIO_ORIGEN" ] || fatal "$CONTENEDOR_DB no declara POSTGRES_USER"
  [ -n "$BASE_ORIGEN" ] || fatal "$CONTENEDOR_DB no declara POSTGRES_DB"
  [ -n "$IMAGEN_DESTINO" ] || fatal "no pude leer la imagen de $CONTENEDOR_DB"

  # Las rutas del almacenamiento, tal como las ve la aplicación. Una ruta
  # relativa se resuelve contra el directorio de trabajo del contenedor, que es
  # el caso del outbox: `EMAIL_OUTBOX_DIR=outbox` sobre `/app`.
  local trabajo; trabajo="$(docker inspect -f '{{.Config.WorkingDir}}' "$CONTENEDOR_API")"
  [ -n "$trabajo" ] || trabajo="/"
  RAICES_DOCKER=""
  local par nombre variable ruta
  for par in "uploads:UPLOAD_DIR" "documentos:DOCUMENTOS_DIR" "outbox:EMAIL_OUTBOX_DIR"; do
    nombre="${par%%:*}"; variable="${par##*:}"
    ruta="$(variable_del_contenedor "$CONTENEDOR_API" "$variable")"
    [ -n "$ruta" ] || fatal "$CONTENEDOR_API no declara $variable: no sé de dónde copiar «$nombre»"
    case "$ruta" in /*) ;; *) ruta="$trabajo/$ruta" ;; esac
    RAICES_DOCKER="$RAICES_DOCKER$nombre:$ruta
"
  done
}
[ "$ENTORNO" = docker ] && descubrir_el_origen_docker

# Herramientas que no se llaman igual en todas partes. La PM corre macOS y el
# lanzador oficial usa Docker desde ese anfitrión: ahí `sha256sum` no existe
# —es `shasum -a 256`—, y `find -printf`, `stat -c` y `xargs -r` son de GNU. Se
# resuelve una sola vez acá y el resto del guión no se entera.
GUION="$RAIZ/scripts/respaldo.sh"
if command -v sha256sum >/dev/null 2>&1; then
  sha256() { sha256sum "$@"; }
  verificar_sha256() { sha256sum --quiet -c "$1"; }
elif command -v shasum >/dev/null 2>&1; then
  sha256() { shasum -a 256 "$@"; }
  verificar_sha256() { shasum -a 256 -c "$1" > /dev/null; }
else
  echo "ERROR: no hay sha256sum ni shasum; sin checksums esta pieza no sirve" >&2
  exit 1
fi

# Archivos intermedios de la huella, y el rescate de una restauración a medias.
#
# Si `restaurar` se cae después de crear el contenedor y el volumen —o la base—
# esos recursos quedan colgados y el próximo intento choca con ellos. Se anotan
# apenas se crean y se retiran solos si la restauración no llega al final. Acá
# no hace falta comprobar etiquetas: se borra exactamente lo que ESTA ejecución
# acaba de crear, anotado por ella misma.
TMP_HUELLA="$(mktemp -u)"
DESTINO_INCOMPLETO=""
limpiar_temporales() {
  rm -f "$TMP_HUELLA".* 2>/dev/null || true
  [ -n "$DESTINO_INCOMPLETO" ] || return 0
  local sello="$DESTINO_INCOMPLETO"; DESTINO_INCOMPLETO=""
  printf 'AVISO: la restauración quedó a medias; se retira lo que había creado (%s)\n' \
    "$sello" >&2
  if [ "$ENTORNO" = docker ]; then
    docker rm -f "$(contenedor_de "$sello")" >/dev/null 2>&1 || true
    docker volume rm "$(volumen_de "$sello")" >/dev/null 2>&1 || true
  else
    sudo -u postgres psql -tAc \
      "DROP DATABASE IF EXISTS \"${PREFIJO_BASE}${sello}\"" >/dev/null 2>&1 || true
  fi
  rm -rf "${DIR_RESPALDOS:?}/${PREFIJO_DIR}${sello}"
}
trap limpiar_temporales EXIT

# --------------------------------------------------------------------------
# Las tres funciones que dependen del entorno.
# --------------------------------------------------------------------------

# 1. Consultar la base de origen o un destino, siempre en UTC y sin
#    redondeos de coma flotante: la huella tiene que dar lo mismo en las dos
#    máquinas y en las dos corridas.
#    Los ajustes viajan por `PGOPTIONS` y no como `SET` adelante de la
#    consulta: psql imprime el rótulo «SET» de cada sentencia que no devuelve
#    filas, y esa línea se colaba en la lista de tablas.
OPCIONES_PG="-c timezone=UTC -c extra_float_digits=3"
#    Con Docker hay DOS clústeres: el de origen y el del destino, que es otro
#    contenedor. `$3` dice a cuál se le pregunta; sin él, al de origen.
sql() {  # sql <base> <consulta> [contenedor]
  local base="$1" consulta="$2" donde="${3:-$CONTENEDOR_DB}"
  if [ "$ENTORNO" = docker ]; then
    docker exec -e PGOPTIONS="$OPCIONES_PG" -i "$donde" \
      psql -U "$USUARIO_ORIGEN" -d "$base" -tAc "$consulta"
  else
    PGPASSWORD="$CLAVE_ORIGEN" PGOPTIONS="$OPCIONES_PG" \
      psql -h "$HOST_ORIGEN" -U "$USUARIO_ORIGEN" -d "$base" -tAc "$consulta"
  fi
}

# 2. El volcado lógico. `-Fc` para poder restaurar selectivamente y para que
#    `pg_restore` valide el formato en vez de ejecutar SQL a ciegas.
volcar_la_base() {  # volcar_la_base <archivo>
  if [ "$ENTORNO" = docker ]; then
    docker exec -i "$CONTENEDOR_DB" \
      pg_dump -U "$USUARIO_ORIGEN" -d "$BASE_ORIGEN" -Fc > "$1"
  else
    PGPASSWORD="$CLAVE_ORIGEN" pg_dump -h "$HOST_ORIGEN" -U "$USUARIO_ORIGEN" \
      -d "$BASE_ORIGEN" -Fc > "$1"
  fi
}

# 3. Dónde vive el almacenamiento persistente. Con Docker son volúmenes
#    nombrados; sin Docker, directorios del backend. En los dos casos se copia
#    a un árbol con la misma forma, así que el bundle es intercambiable.
#
#    `outbox` entra porque es lo que hoy sustituye al correo real: perderlo es
#    perder la evidencia de qué se mandó.
declare -a CARPETAS_NATIVAS=(backend/uploads backend/documentos backend/outbox)

copiar_el_almacenamiento() {  # copiar_el_almacenamiento <directorio destino>
  local destino="$1"
  mkdir -p "$destino"
  if [ "$ENTORNO" = docker ]; then
    # `docker cp` y nada más: no monta volúmenes, no necesita herramientas
    # adentro del contenedor y NO baja ninguna imagen auxiliar. Las rutas son
    # las que declara la aplicación, descubiertas al arrancar; los nombres de
    # los volúmenes no se usan ni se adivinan.
    local linea nombre ruta
    while IFS= read -r linea; do
      [ -n "$linea" ] || continue
      nombre="${linea%%:*}"; ruta="${linea#*:}"
      mkdir -p "$destino/$nombre"
      docker cp -a "$CONTENEDOR_API:$ruta/." "$destino/$nombre/" 2>/dev/null \
        || docker cp "$CONTENEDOR_API:$ruta/." "$destino/$nombre/" \
        || fatal "no pude copiar $ruta desde $CONTENEDOR_API"
    done <<< "$RAICES_DOCKER"
  else
    local carpeta nombre
    for carpeta in "${CARPETAS_NATIVAS[@]}"; do
      nombre="$(basename "$carpeta")"
      mkdir -p "$destino/$nombre"
      [ -d "$carpeta" ] && cp -a "$carpeta/." "$destino/$nombre/"
    done
  fi
}

# --------------------------------------------------------------------------
# La huella: qué se compara, exactamente.
#
# De la base, por tabla, la cantidad de filas Y un resumen del contenido
# ordenado. Contar filas sola no distingue una fila cambiada de una intacta, y
# esta pieza existe para demostrar que la recuperación conserva los datos, no
# para demostrar que conserva la cantidad.
#
# Del almacenamiento, ruta relativa, tamaño y sha256 de cada archivo.
# --------------------------------------------------------------------------
huella_de_la_base() {  # huella_de_la_base <base> [contenedor]
  local base="$1" donde="${2:-}"
  sql "$base" "select coalesce(extversion,'-') from pg_extension where extname='postgis'" "$donde" \
    | sed 's/^/extension\tpostgis\t/'
  local tablas; tablas="$(sql "$base" \
    "select tablename from pg_tables where schemaname='public' order by 1" "$donde")"
  local tabla
  for tabla in $tablas; do
    local fila
    fila="$(sql "$base" "select count(*)::text || E'\t' ||
      coalesce(md5(string_agg(x, '|' order by x)), 'sin-filas')
      from (select t::text as x from public.\"$tabla\" t) s" "$donde")"
    printf 'tabla\t%s\t%s\n' "$tabla" "$fila"
  done
}

huella_de_los_archivos() {  # huella_de_los_archivos <directorio>
  local raiz="$1"
  [ -d "$raiz" ] || return 0
  # Un `sha256sum` por archivo son miles de procesos con el outbox lleno; se
  # hace en una sola pasada y se pega con los tamaños por ruta. Las rutas con
  # tabulador romperían ese pegado, así que se comprueba que no haya.
  ( cd "$raiz"
    if find . -type f -name '*	*' -print | head -1 | grep -q .; then
      echo "ERROR: hay rutas con tabulador; la huella no las puede representar" >&2
      return 1
    fi
    # Sin `-printf` y sin `stat`, que son de GNU: `wc -c` en lotes da tamaño y
    # ruta, y es POSIX. Las líneas «total» que agrega cada lote se descartan.
    find . -type f -print0 | xargs -0 wc -c 2>/dev/null \
      | awk '{ tam=$1; $1=""; sub(/^ +/, ""); if ($0 != "total" && $0 != "") \
               { sub(/^\.\//, ""); print $0 "\t" tam } }' \
      | LC_ALL=C sort > "$TMP_HUELLA.tam"
    find . -type f -print0 | xargs -0 "$GUION" --sha256 \
      | sed 's|^\([0-9a-f]*\)  *\./|\1	|' \
      | awk -F'\t' '{print $2 "\t" $1}' | LC_ALL=C sort > "$TMP_HUELLA.sha"
    LC_ALL=C join -t"$(printf '\t')" "$TMP_HUELLA.tam" "$TMP_HUELLA.sha" \
      | awk -F'\t' '{print "archivo\t" $1 "\t" $2 "\t" $3}' )
}

# --------------------------------------------------------------------------
# respaldar
# --------------------------------------------------------------------------
comando_respaldar() {
  local sello; sello="$(date -u +%Y%m%d_%H%M%S)"
  local bundle="$DIR_RESPALDOS/$sello"
  [ -e "$bundle" ] && fatal "ya existe $bundle"
  mkdir -p "$bundle/datos"

  paso "Respaldo desde el origen ($ENTORNO)"
  nota "base $BASE_ORIGEN, bundle $bundle"

  volcar_la_base "$bundle/base.dump"
  [ -s "$bundle/base.dump" ] || fatal "el volcado salió vacío"
  # Que `pg_restore` pueda LEER el índice del volcado es la prueba barata de
  # que el archivo es un volcado y no medio archivo: un tar cortado a la mitad
  # también pesa.
  pg_restore --list "$bundle/base.dump" > "$bundle/base.indice.txt" \
    || fatal "el volcado no es un archivo de pg_restore válido"

  copiar_el_almacenamiento "$bundle/datos"
  huella_de_la_base "$BASE_ORIGEN" > "$bundle/huella-base.tsv"
  huella_de_los_archivos "$bundle/datos" > "$bundle/huella-archivos.tsv"
  tar -C "$bundle" -czf "$bundle/datos.tar.gz" datos
  rm -rf "$bundle/datos"

  local archivos bytes
  archivos="$(wc -l < "$bundle/huella-archivos.tsv")"
  bytes="$(awk -F'\t' '{s+=$3} END {print s+0}' "$bundle/huella-archivos.tsv")"

  # El manifiesto no lleva ni una credencial: nombre de base y versiones, nada
  # más. Lo que hace falta para restaurar está en el procedimiento, no acá.
  cat > "$bundle/manifiesto.json" <<FIN
{
  "formato": 1,
  "creado": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "entorno_de_origen": "$ENTORNO",
  "base": {
    "nombre": "$BASE_ORIGEN",
    "servidor": "$(sql "$BASE_ORIGEN" "select current_setting('server_version')")",
    "postgis": "$(sql "$BASE_ORIGEN" "select coalesce(extversion,'-') from pg_extension where extname='postgis'")",
    "formato_del_volcado": "pg_dump -Fc",
    "tablas": $(grep -c '^tabla' "$bundle/huella-base.tsv")
  },
  "almacenamiento": { "archivos": $archivos, "bytes": $bytes },
  "herramientas": { "pg_dump": "$(pg_dump --version | awk "{print \$3}")" }
}
FIN

  ( cd "$bundle" && sha256 base.dump datos.tar.gz huella-base.tsv \
      huella-archivos.tsv manifiesto.json > SHA256SUMS )
  nota "base: $(du -h "$bundle/base.dump" | cut -f1) · datos: $(du -h "$bundle/datos.tar.gz" | cut -f1)"
  nota "$archivos archivos y $(grep -c '^tabla' "$bundle/huella-base.tsv") tablas en la huella"
  echo "$bundle"
}

# --------------------------------------------------------------------------
# restaurar — SIEMPRE a un destino nuevo
# --------------------------------------------------------------------------
comando_restaurar() {
  local bundle="${1:-}"
  [ -d "$bundle" ] || fatal "no encuentro el bundle «$bundle»"
  ( cd "$bundle" && verificar_sha256 SHA256SUMS ) \
    || fatal "el bundle no coincide con sus checksums: no se restaura"

  local sello; sello="$(date -u +%Y%m%d_%H%M%S)"
  local base_destino="${PREFIJO_BASE}${sello}"
  local dir_destino="$DIR_RESPALDOS/${PREFIJO_DIR}${sello}"
  [[ "$base_destino" =~ $PATRON_BASE ]] || fatal "nombre de destino inesperado"
  [ "$base_destino" = "$BASE_ORIGEN" ] && fatal "el destino no puede ser el origen"

  paso "Restauración en un destino nuevo ($ENTORNO)"
  if [ "$ENTORNO" = docker ]; then
    nota "contenedor $(contenedor_de "$sello") · volumen $(volumen_de "$sello") · archivos $dir_destino"
  else
    nota "base $base_destino · archivos $dir_destino"
  fi

  # El destino se crea de cero. Si ya existiera, se frena: no se pisa nada.
  if [ -e "$dir_destino" ]; then fatal "$dir_destino ya existe"; fi
  mkdir -p "$dir_destino"
  tar -C "$dir_destino" -xzf "$bundle/datos.tar.gz"

  # La firma de esta ejecución. Se genera acá porque en Docker también etiqueta
  # el contenedor y el volumen que se crean.
  local ejecucion; ejecucion="$(head -c 12 /dev/urandom | od -An -tx1 | tr -d ' \n')"

  if [ "$ENTORNO" = docker ]; then
    # Otro contenedor y otro volumen. NO se toca el clúster de origen: crear la
    # base de destino adentro de `topgreen-db` modificaba su volumen, que es
    # justo lo que este aislamiento tiene que evitar.
    local contenedor_destino="topgreen-restore-${sello}-db"
    local volumen_destino="topgreen-restore-${sello}-datos"
    docker inspect "$contenedor_destino" >/dev/null 2>&1 \
      && fatal "ya existe el contenedor $contenedor_destino"
    docker volume inspect "$volumen_destino" >/dev/null 2>&1 \
      && fatal "ya existe el volumen $volumen_destino"

    # Credencial del destino: local, efímera y de esta corrida. No se escribe
    # en el bundle, ni en el manifiesto, ni en el informe.
    local clave_efimera; clave_efimera="$(head -c 18 /dev/urandom | od -An -tx1 | tr -d ' \n')"

    DESTINO_INCOMPLETO="$sello"
    docker volume create --label "$ETIQUETA_PIEZA" \
      --label "$ETIQUETA_EJECUCION=$ejecucion" "$volumen_destino" >/dev/null \
      || fatal "no pude crear el volumen de destino"
    # La imagen es la MISMA que sirve el origen, leída del contenedor real: ya
    # está en la máquina, así que esto no dispara ninguna descarga.
    docker run -d --name "$contenedor_destino" \
      --label "$ETIQUETA_PIEZA" --label "$ETIQUETA_EJECUCION=$ejecucion" \
      -e POSTGRES_USER="$USUARIO_ORIGEN" -e POSTGRES_DB="$BASE_ORIGEN" \
      -e POSTGRES_PASSWORD="$clave_efimera" \
      -v "$volumen_destino":/var/lib/postgresql/data \
      "$IMAGEN_DESTINO" >/dev/null \
      || fatal "no pude levantar el contenedor de destino con $IMAGEN_DESTINO"

    local intento=0
    until docker exec "$contenedor_destino" \
        pg_isready -U "$USUARIO_ORIGEN" -d "$BASE_ORIGEN" >/dev/null 2>&1; do
      intento=$((intento + 1))
      [ "$intento" -gt 60 ] && fatal "el contenedor de destino no llegó a estar listo"
      sleep 1
    done

    docker exec -i "$contenedor_destino" psql -U "$USUARIO_ORIGEN" -d "$BASE_ORIGEN" \
      -qtAc "CREATE EXTENSION IF NOT EXISTS postgis" >/dev/null
    docker exec -i "$contenedor_destino" pg_restore -U "$USUARIO_ORIGEN" \
      -d "$BASE_ORIGEN" --no-owner --no-privileges < "$bundle/base.dump" \
      || nota "pg_restore informó avisos; se verifican abajo"
    nota "destino: contenedor $contenedor_destino sobre el volumen $volumen_destino"
  else
    DESTINO_INCOMPLETO="$sello"
    sudo -u postgres psql -tAc "CREATE DATABASE \"$base_destino\" OWNER \"$USUARIO_ORIGEN\"" \
      >/dev/null || fatal "no se pudo crear la base de destino"
    sudo -u postgres psql -d "$base_destino" -tAc "CREATE EXTENSION IF NOT EXISTS postgis" \
      >/dev/null
    sudo -u postgres pg_restore -d "$base_destino" --no-owner --no-privileges \
      "$bundle/base.dump" || nota "pg_restore informó avisos; se verifican abajo"
    sudo -u postgres psql -d "$base_destino" -tAc \
      "GRANT ALL ON ALL TABLES IN SCHEMA public TO \"$USUARIO_ORIGEN\"" >/dev/null
  fi

  # La firma dentro de la base restaurada, en su propio esquema para no
  # ensuciar los datos ni la comparación, que sólo mira `public`.
  local marca_sql="
    CREATE SCHEMA IF NOT EXISTS $ESQUEMA_MARCA;
    CREATE TABLE IF NOT EXISTS $ESQUEMA_MARCA.propiedad (
      ejecucion text primary key, creado timestamptz not null, bundle text not null);
    INSERT INTO $ESQUEMA_MARCA.propiedad VALUES
      ('$ejecucion', now(), '$(basename "$bundle")');"
  if [ "$ENTORNO" = docker ]; then
    docker exec -i "$(contenedor_de "$sello")" psql -U "$USUARIO_ORIGEN" \
      -d "$BASE_ORIGEN" -qtAc "$marca_sql" >/dev/null
  else
    sudo -u postgres psql -d "$base_destino" -qtAc "$marca_sql" >/dev/null
  fi
  printf 'ejecucion=%s\nsello=%s\nbundle=%s\nentorno=%s\n' \
    "$ejecucion" "$sello" "$(basename "$bundle")" "$ENTORNO" > "$dir_destino/$ARCHIVO_MARCA"

  DESTINO_INCOMPLETO=""   # llegó al final: el destino ya es responsabilidad de `limpiar`
  nota "restaurado sin tocar $BASE_ORIGEN ni $CONTENEDOR_DB"
  nota "firmado con la ejecución $ejecucion; sin esa firma no se borra"
  echo "$sello"
}

# --------------------------------------------------------------------------
# verificar — el corazón de la pieza
# --------------------------------------------------------------------------
comando_verificar() {
  local bundle="${1:-}" sello="${2:-}"
  [ -d "$bundle" ] || fatal "no encuentro el bundle «$bundle»"
  [ -n "$sello" ] || fatal "falta el sello del destino"
  local base_destino; base_destino="$(base_de "$sello")"
  local contenedor_destino=""
  [ "$ENTORNO" = docker ] && contenedor_destino="$(contenedor_de "$sello")"
  local dir_destino="$DIR_RESPALDOS/${PREFIJO_DIR}${sello}/datos"
  local fallos=0
  local tmp; tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' RETURN

  paso "Verificación"

  comparar() {  # comparar <qué> <esperado> <obtenido>
    if diff -u "$2" "$3" > "$tmp/dif" 2>&1; then
      printf '  ✓ %s\n' "$1"
    else
      printf '  ✗ %s\n' "$1"
      sed -n '3,12p' "$tmp/dif" | sed 's/^/      /'
      local n; n="$(grep -c '^[+-][^+-]' "$tmp/dif" || true)"
      printf '      %s línea(s) de diferencia en total\n' "$n"
      fallos=$((fallos + 1))
    fi
  }

  # 1. El bundle es el que se escribió.
  if ( cd "$bundle" && verificar_sha256 SHA256SUMS ); then
    printf '  ✓ el bundle coincide con sus checksums\n'
  else
    printf '  ✗ el bundle NO coincide con sus checksums\n'; fallos=$((fallos + 1))
  fi

  # 2. El destino tiene lo que decía el bundle.
  huella_de_la_base "$base_destino" "$contenedor_destino" > "$tmp/base-destino.tsv" 2>/dev/null \
    || fatal "no pude leer la base de destino $base_destino"
  comparar "la base restaurada coincide con la del respaldo" \
    "$bundle/huella-base.tsv" "$tmp/base-destino.tsv"

  huella_de_los_archivos "$dir_destino" > "$tmp/archivos-destino.tsv"
  comparar "los archivos restaurados coinciden con los del respaldo" \
    "$bundle/huella-archivos.tsv" "$tmp/archivos-destino.tsv"

  # 3. El origen sigue siendo el mismo. Un respaldo que altera lo que copia no
  #    es un respaldo, y una verificación que no lo mira no lo notaría.
  huella_de_la_base "$BASE_ORIGEN" > "$tmp/base-origen.tsv"
  comparar "el origen conserva la identidad que tenía al respaldar" \
    "$bundle/huella-base.tsv" "$tmp/base-origen.tsv"

  # 4. Y sigue arriba.
  if [ "$ENTORNO" = docker ]; then
    local vivos; vivos="$(docker inspect -f '{{.State.Running}}' "$CONTENEDOR_DB" "$CONTENEDOR_API" 2>/dev/null | tr '\n' ' ')"
    if [ "$vivos" = "true true " ]; then printf '  ✓ %s y %s siguen en marcha\n' "$CONTENEDOR_DB" "$CONTENEDOR_API"
    else printf '  ✗ los contenedores de origen no están los dos en marcha: %s\n' "$vivos"; fallos=$((fallos + 1)); fi
    # Y el clúster de origen no ganó ninguna base: la restauración va a otro
    # contenedor, así que acá no puede aparecer nada nuevo.
    local intrusas; intrusas="$(sql "$BASE_ORIGEN" \
      "select count(*) from pg_database where datname like '${PREFIJO_BASE}%'")"
    if [ "${intrusas:-0}" = "0" ]; then printf '  ✓ %s no tiene ninguna base de restauración adentro\n' "$CONTENEDOR_DB"
    else printf '  ✗ %s tiene %s base(s) %s* adentro: el destino no estuvo aislado\n' "$CONTENEDOR_DB" "$intrusas" "$PREFIJO_BASE"; fallos=$((fallos + 1)); fi
  else
    if curl --fail --silent --noproxy '*' http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
      printf '  ✓ la API de origen sigue contestando\n'
    else printf '  ✗ la API de origen no contesta\n'; fallos=$((fallos + 1)); fi
  fi

  if [ "$fallos" -eq 0 ]; then
    printf '\nRECUPERACIÓN VERIFICADA: base y archivos coinciden y el origen no se movió\n'
  else
    printf '\n%s VERIFICACIÓN(ES) FALLIDA(S)\n' "$fallos"
    return 1
  fi
}

# --------------------------------------------------------------------------
# limpiar — sólo lo que creó esta pieza
# --------------------------------------------------------------------------
comando_limpiar() {
  local sello="${1:-}"
  [ -n "$sello" ] || fatal "falta el sello del destino"
  local base_destino; base_destino="$(base_de "$sello")"
  local dir_destino="$DIR_RESPALDOS/${PREFIJO_DIR}${sello}"

  # La forma del nombre es la primera guarda, no la única.
  [[ "${PREFIJO_BASE}${sello}" =~ $PATRON_BASE ]] \
    || fatal "«$sello» no tiene la forma de un destino de esta pieza"
  [ "$base_destino" = "$BASE_ORIGEN" ] && [ "$ENTORNO" != docker ] \
    && fatal "eso es el origen, no un destino"

  paso "Limpieza del destino $sello"

  # La firma del directorio manda: dice qué ejecución creó este destino.
  [ -f "$dir_destino/$ARCHIVO_MARCA" ] \
    || fatal "$dir_destino no lleva la firma de esta pieza. No se borra nada."
  local ejecucion; ejecucion="$(sed -n 's/^ejecucion=//p' "$dir_destino/$ARCHIVO_MARCA")"
  [ -n "$ejecucion" ] || fatal "la firma de $dir_destino está vacía. No se borra nada."

  if [ "$ENTORNO" = docker ]; then
    # Cada recurso se borra sólo si LLEVA LA ETIQUETA de esta ejecución. Un
    # contenedor o un volumen homónimo que la pieza no creó no la tiene, y ahí
    # se frena: el nombre no prueba propiedad.
    local contenedor_destino volumen_destino etiqueta
    contenedor_destino="$(contenedor_de "$sello")"; volumen_destino="$(volumen_de "$sello")"

    etiqueta="$(docker inspect -f "{{index .Config.Labels \"$ETIQUETA_EJECUCION\"}}" \
      "$contenedor_destino" 2>/dev/null || true)"
    [ "$etiqueta" = "$ejecucion" ] \
      || fatal "el contenedor $contenedor_destino no lleva la etiqueta $ETIQUETA_EJECUCION=$ejecucion (dice «${etiqueta:-nada}»). No se borra nada."

    etiqueta="$(docker volume inspect -f "{{index .Labels \"$ETIQUETA_EJECUCION\"}}" \
      "$volumen_destino" 2>/dev/null || true)"
    [ "$etiqueta" = "$ejecucion" ] \
      || fatal "el volumen $volumen_destino no lleva la etiqueta $ETIQUETA_EJECUCION=$ejecucion (dice «${etiqueta:-nada}»). No se borra nada."

    docker rm -f "$contenedor_destino" >/dev/null
    docker volume rm "$volumen_destino" >/dev/null
    nota "borrados el contenedor $contenedor_destino y el volumen $volumen_destino,"
    nota "los dos etiquetados con $ejecucion"
  else
    # Sin Docker el destino es una base del clúster local, y la firma vive
    # adentro de esa base.
    local firmada
    firmada="$(sudo -u postgres psql -d "$base_destino" -tAc \
      "select count(*) from $ESQUEMA_MARCA.propiedad where ejecucion='$ejecucion'" 2>/dev/null || echo 0)"
    [ "${firmada:-0}" = "1" ] \
      || fatal "la base $base_destino no lleva la firma $ejecucion: no la creó esta ejecución. No se borra nada."
    sudo -u postgres psql -tAc "DROP DATABASE IF EXISTS \"$base_destino\"" >/dev/null
    nota "borrada la base $base_destino, firmada con $ejecucion"
  fi

  rm -rf "$dir_destino"
  nota "borrado $dir_destino; nada más se tocó"
}

# --------------------------------------------------------------------------
case "${1:-}" in
  respaldar) shift; comando_respaldar "$@" ;;
  restaurar) shift; comando_restaurar "$@" ;;
  verificar) shift; comando_verificar "$@" ;;
  limpiar)   shift; comando_limpiar "$@" ;;
  huella)    huella_de_la_base "$BASE_ORIGEN" ;;
  -h|--help|"") sed -n '2,25p' "${BASH_SOURCE[0]}" | sed 's/^# \?//' ;;
  *) fatal "comando desconocido: $1" ;;
esac
