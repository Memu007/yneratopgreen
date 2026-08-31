#!/usr/bin/env bash
# Deja el entorno local listo SIN Docker: el «Camino B» de
# README_LOCAL_SETUP.md, automatizado.
#
# `scripts/init_local_db.sh` hace lo mismo con Docker. Este es el hermano para
# las máquinas donde no hay demonio de Docker —entre ellas los contenedores
# efímeros de Claude Code en la web, donde todo lo que no esté versionado se
# pierde entre sesión y sesión—.
#
#   ./scripts/entorno_nativo.sh              prepara lo que falte y nada más
#   ./scripts/entorno_nativo.sh --recrear    ADEMÁS borra y rehace la base
#
# Sin `--recrear` es idempotente y NO destruye nada: crea lo que no está y deja
# como está lo que ya estaba. Correrlo dos veces seguidas da el mismo resultado.
#
# `--recrear` sí borra la base entera. Es lo que hace falta antes de la suite,
# porque «139/139 desde base limpia» no significa nada sobre una base con
# residuos de la corrida anterior. Se niega a correr si `ENV` no es `local`.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

RECREAR=false
for argumento in "$@"; do
  case "$argumento" in
    --recrear) RECREAR=true ;;
    -h|--help) sed -n '2,17p' "${BASH_SOURCE[0]}" | sed 's/^# \?//'; exit 0 ;;
    *) echo "argumento desconocido: $argumento" >&2; exit 2 ;;
  esac
done

paso() { printf '\n===> %s\n' "$1"; }
nota() { printf '     %s\n' "$1"; }

# Puerto de la API y del frontend. Son los que esperan la suite y las puertas.
PUERTO_API=8000
PUERTO_FRONT=5173

# --------------------------------------------------------------------------
# 1. El puente de `docker exec`
# --------------------------------------------------------------------------
# La suite y las puertas hablan con la base y con la aplicación por
# `docker exec topgreen-db psql` y `docker exec topgreen-api python`. Sin
# demonio de Docker eso no existe, así que se traduce a la base nativa y al
# venv del backend.
#
# Se instala SÓLO si no hay un Docker que funcione: si la máquina tiene Docker
# de verdad, el camino normal del repositorio anda y acá no se toca nada.
paso "Puente de docker exec"
PUENTE="$HOME/.local/bin/docker"
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  nota "hay un Docker que funciona: no se instala el puente"
elif [ -x "$PUENTE" ] && grep -q 'Puente local de TopGreen' "$PUENTE" 2>/dev/null; then
  nota "el puente ya estaba instalado"
else
  mkdir -p "$HOME/.local/bin"
  cat > "$PUENTE" <<'PUENTE_FIN'
#!/usr/bin/env bash
# Puente local de TopGreen: esta máquina no tiene demonio de Docker, pero las
# puertas del repositorio hablan con la base y con la aplicación por
# `docker exec`. Se traducen SÓLO los tres casos que el repositorio usa;
# cualquier otra cosa falla a la vista en vez de fingir que anduvo.
set -uo pipefail
RAIZ="${TOPGREEN_RAIZ:-__RAIZ__}"

if [ "${1:-}" = "exec" ]; then
  shift
  # Las banderas de `exec` no aplican fuera de un contenedor, salvo -e, que sí
  # define una variable de entorno.
  while [[ "${1:-}" == -* ]]; do
    if [ "${1}" = "-e" ]; then export "${2?}"; shift 2; else shift; fi
  done
  contenedor="${1:-}"; shift
  programa="${1:-}"; shift
  case "$contenedor:$programa" in
    topgreen-db:psql)
      export PGPASSWORD="${TOPGREEN_DB_PASSWORD:-topgreen_local}"
      exec psql -h 127.0.0.1 "$@"
      ;;
    topgreen-api:python|topgreen-api:python3)
      cd "$RAIZ/backend" && exec ./.venv/bin/python "$@"
      ;;
    topgreen-api:alembic)
      cd "$RAIZ/backend" && exec ./.venv/bin/alembic "$@"
      ;;
    *)
      echo "puente docker: no se traduce '$contenedor $programa'" >&2
      exit 127
      ;;
  esac
fi

echo "puente docker: sólo se traduce 'docker exec'; '$*' no tiene equivalente" >&2
exit 127
PUENTE_FIN
  sed -i "s#__RAIZ__#$RAIZ#" "$PUENTE"
  chmod +x "$PUENTE"
  nota "instalado en $PUENTE"
fi
case ":$PATH:" in
  *":$HOME/.local/bin:"*) ;;
  *) export PATH="$HOME/.local/bin:$PATH"
     [ -n "${CLAUDE_ENV_FILE:-}" ] && echo "export PATH=\"\$HOME/.local/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
     ;;
esac

# --------------------------------------------------------------------------
# 2. Los dos .env
# --------------------------------------------------------------------------
# Ninguno se versiona. Los valores que se escriben acá son **inventados y
# locales**: no son credenciales de nadie y no valen en ningún lado. Las de
# Mercado Pago quedan apuntando al doble local, que es lo que usa la suite.
#
# Si el archivo ya existe NO se toca: puede tener ajustes de quien trabaja acá.
paso "Archivos .env"
DB_NOMBRE=topgreen
DB_USUARIO=topgreen
DB_CLAVE=topgreen_local

if [ -f .env ]; then
  nota ".env ya existía: no se toca"
else
  cp .env.example .env
  cat >> .env <<EOF

# --- Valores locales, escritos por scripts/entorno_nativo.sh -----------------
# Sólo los lee docker-compose.yml y las puertas que preguntan el nombre de la
# base. Son inventados: no son credenciales de nadie.
DB_NAME=$DB_NOMBRE
DB_USER=$DB_USUARIO
DB_PASSWORD=$DB_CLAVE
EOF
  nota ".env creado desde .env.example"
fi

if [ -f backend/.env ]; then
  nota "backend/.env ya existía: no se toca"
else
  cp backend/.env.example backend/.env
  # El JWT nace distinto en cada máquina; los de Mercado Pago apuntan al doble
  # local y llevan escrito en el nombre que no son reales.
  SECRETO_JWT="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  cat >> backend/.env <<EOF

# --- Valores locales, escritos por scripts/entorno_nativo.sh -----------------
# Todo lo de abajo es inventado y sólo sirve en esta máquina. Mercado Pago
# apunta al doble local que levanta la suite, no a Mercado Pago.
ENV=local
DATABASE_URL=postgresql+psycopg://$DB_USUARIO:$DB_CLAVE@localhost:5432/$DB_NOMBRE
JWT_SECRET=$SECRETO_JWT
FRONTEND_URL=http://localhost:$PUERTO_FRONT
MP_APP_ID=app-local-de-prueba
MP_CLIENT_SECRET=secreto-local-inventado
MP_REDIRECT_URI=http://localhost:$PUERTO_FRONT/api/mp-oauth/callback
MP_AUTH_BASE_URL=http://127.0.0.1:8099
MP_API_BASE_URL=http://127.0.0.1:8099
MP_CHECKOUT_HABILITADO=true
MP_WEBHOOK_SECRET=secreto-local-de-prueba-no-es-real
MP_MINUTOS_DE_VIGENCIA=30
MP_MINUTOS_DE_GRACIA=10
EOF
  nota "backend/.env creado desde backend/.env.example"
fi

# La clave con la que se cifran los tokens del vendedor tiene que ser una clave
# Fernet válida, así que se genera con la biblioteca y recién cuando el venv
# existe. Se hace más abajo, después de instalar dependencias.

# --------------------------------------------------------------------------
# 3. Dependencias
# --------------------------------------------------------------------------
paso "Dependencias de Python"
if [ ! -x backend/.venv/bin/python ]; then
  python3 -m venv backend/.venv
  nota "venv creado en backend/.venv"
fi
backend/.venv/bin/python -m pip install --quiet --upgrade pip
backend/.venv/bin/python -m pip install --quiet -r backend/requirements.txt
nota "$(backend/.venv/bin/python -m pip check || true)"

# Ahora sí, la clave Fernet, si todavía no está.
#
# El valor se lee sin el retorno de carro: `backend/.env.example` viene con
# CRLF y un `grep '^MP_TOKEN_KEY=.+'` daba positivo sobre la línea VACÍA de la
# plantilla, porque el `.+` matcheaba el `\r`. La clave no se generaba nunca y
# la integración quedaba «no configurada»: 37 casos en rojo, medidos.
valor_de() { sed -n "s/^$1=//p" backend/.env | tr -d '\r' | tail -n 1; }
if [ -z "$(valor_de MP_TOKEN_KEY)" ]; then
  CLAVE_FERNET="$(backend/.venv/bin/python -c \
    'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())')"
  printf 'MP_TOKEN_KEY=%s\n' "$CLAVE_FERNET" >> backend/.env
  nota "MP_TOKEN_KEY generada (cifra sólo datos locales)"
fi

paso "Dependencias de Node"
if [ -d node_modules ]; then
  nota "node_modules ya estaba"
else
  npm install --no-audit --no-fund
fi
# Chromium ya viene con la imagen; que Playwright no intente bajarse otro.
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
if [ -d /opt/pw-browsers ]; then
  export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    echo 'export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers' >> "$CLAUDE_ENV_FILE"
    echo 'export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1' >> "$CLAUDE_ENV_FILE"
  fi
  nota "Playwright usa el Chromium de /opt/pw-browsers"
fi

# --------------------------------------------------------------------------
# 4. PostgreSQL con PostGIS
# --------------------------------------------------------------------------
paso "PostgreSQL"
psql_admin() { sudo -u postgres psql -q -v ON_ERROR_STOP=1 "$@"; }

if ! pg_isready -q 2>/dev/null; then
  sudo service postgresql start >/dev/null 2>&1 || true
  for _ in $(seq 1 20); do pg_isready -q 2>/dev/null && break; sleep 1; done
fi
if ! pg_isready -q 2>/dev/null; then
  echo "ERROR: PostgreSQL no acepta conexiones. Instalalo o arrancalo a mano." >&2
  exit 1
fi
nota "aceptando conexiones"

if [ "$(psql_admin -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USUARIO'")" != "1" ]; then
  psql_admin -c "CREATE ROLE $DB_USUARIO LOGIN PASSWORD '$DB_CLAVE' CREATEDB"
  nota "rol $DB_USUARIO creado"
fi

if [ "$RECREAR" = true ]; then
  # Antes de borrar: que sea de verdad la base local y de nadie más.
  entorno="$(sed -n 's/^ENV=//p' backend/.env | tr -d '\r' | tail -n 1)"
  if [ "$entorno" != "local" ]; then
    echo "ERROR: --recrear sólo corre con ENV=local en backend/.env (dice '$entorno')." >&2
    exit 1
  fi
  paso "Recreando la base (--recrear)"
  # La API tiene que soltar la conexión. Se miran sólo procesos de Python:
  # cualquier shell que tenga esta misma cadena en su línea de comandos —esta,
  # sin ir más lejos— no es un servidor.
  uvicorns() { ps -eo pid,comm,args | awk '$2 ~ /python/ && /uvicorn app.main:app/ {print $1}'; }
  for pid in $(uvicorns); do kill "$pid" 2>/dev/null || true; done
  sleep 2
  for pid in $(uvicorns); do kill -9 "$pid" 2>/dev/null || true; done
  sleep 1
  if [ -n "$(uvicorns)" ]; then
    echo "ERROR: quedó un uvicorn vivo; la base limpia no estaría limpia." >&2
    exit 1
  fi
  psql_admin -c "DROP DATABASE IF EXISTS $DB_NOMBRE WITH (FORCE)"
fi

if [ "$(psql_admin -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NOMBRE'")" != "1" ]; then
  psql_admin -c "CREATE DATABASE $DB_NOMBRE OWNER $DB_USUARIO"
  nota "base $DB_NOMBRE creada"
fi
# PostGIS no es opcional: las migraciones y las consultas geográficas la usan.
psql_admin -d "$DB_NOMBRE" -c "CREATE EXTENSION IF NOT EXISTS postgis" >/dev/null
nota "PostGIS lista"

paso "Migraciones"
(cd backend && ./.venv/bin/alembic upgrade head)

paso "Datos de demostración"
# Sólo si la base está vacía: repetir el seed sobre datos existentes no es lo
# que quiere quien vuelve a una sesión con trabajo a medio hacer.
cuentas="$(PGPASSWORD="$DB_CLAVE" psql -h 127.0.0.1 -U "$DB_USUARIO" -d "$DB_NOMBRE" -tAc \
  'SELECT COUNT(*) FROM users' 2>/dev/null || echo 0)"
if [ "${cuentas:-0}" = "0" ]; then
  (cd backend && ./.venv/bin/python -m app.seed)
else
  nota "la base ya tiene $cuentas cuentas: no se siembra encima"
fi

# --------------------------------------------------------------------------
# 5. API y frontend
# --------------------------------------------------------------------------
escuchando() { (exec 3<>"/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1; }

paso "API"
if escuchando "$PUERTO_API"; then
  nota "ya había algo escuchando en $PUERTO_API"
else
  mkdir -p logs
  # `setsid --fork` y no sólo `&`: el servidor tiene que quedar fuera del árbol
  # de este guion. Con `&` a secas el guion se queda esperándolo y el arranque
  # no termina nunca —medido: colgado a los diez minutos con la API ya
  # respondiendo—. Y `--fork` es obligatorio: sin él, `setsid` no forka cuando
  # el proceso no es líder de grupo, así que hace `exec` en el MISMO proceso y
  # el servidor sigue colgando del guion. Volvió a colgarse por eso.
  (cd backend && setsid --fork ./.venv/bin/python -m uvicorn app.main:app \
    --host 127.0.0.1 --port "$PUERTO_API" \
    > "$RAIZ/logs/api.log" 2>&1 < /dev/null &) ; disown -a 2>/dev/null || true
  for _ in $(seq 1 30); do
    curl --fail --silent --noproxy '*' \
      "http://127.0.0.1:$PUERTO_API/api/health" >/dev/null 2>&1 && break
    sleep 1
  done
  if curl --fail --silent --noproxy '*' \
       "http://127.0.0.1:$PUERTO_API/api/health" >/dev/null 2>&1; then
    nota "arriba en http://localhost:$PUERTO_API/api/docs"
  else
    echo "ERROR: la API no respondió; mirá logs/api.log" >&2
    exit 1
  fi
fi

paso "Frontend"
if escuchando "$PUERTO_FRONT"; then
  nota "ya había algo escuchando en $PUERTO_FRONT"
else
  mkdir -p logs
  # Lo mismo que la API: fuera del árbol del guion.
  setsid --fork npx vite --host 127.0.0.1 --port "$PUERTO_FRONT" --strictPort \
    > "$RAIZ/logs/vite.log" 2>&1 < /dev/null &
  disown -a 2>/dev/null || true
  for _ in $(seq 1 30); do escuchando "$PUERTO_FRONT" && break; sleep 1; done
  if escuchando "$PUERTO_FRONT"; then
    nota "arriba en http://localhost:$PUERTO_FRONT"
  else
    echo "ERROR: Vite no levantó; mirá logs/vite.log" >&2
    exit 1
  fi
fi

cat <<EOF

===> Entorno listo.

  API       http://localhost:$PUERTO_API/api/docs
  Frontend  http://localhost:$PUERTO_FRONT
  Registros logs/api.log y logs/vite.log

  Cuentas de demostración (del seed, escritas en el repositorio):
    admin@topgreen.com    / admin123
    vendedor@ejemplo.com  / vendedor123
    cliente@ejemplo.com   / cliente123

  Antes de la suite, base limpia:
    ./scripts/entorno_nativo.sh --recrear && node scripts/smoke.mjs
EOF
