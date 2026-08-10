#!/usr/bin/env bash
# Inicializa la base de datos local de TopGreen
# Levanta Docker, espera healthcheck, corre migraciones y seed.
#
# Uso (desde la raíz del proyecto):
#   ./scripts/init_local_db.sh

set -euo pipefail

echo "===> Verificando .env"
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "  .env creado desde .env.example. Revisar/editar antes de continuar."
  else
    echo "ERROR: No existe .env ni .env.example" >&2
    exit 1
  fi
fi

if [ ! -f backend/.env ]; then
  if [ -f backend/.env.example ]; then
    cp backend/.env.example backend/.env
    echo "  backend/.env creado desde backend/.env.example. Revisar/editar antes de continuar."
  else
    echo "ERROR: No existe backend/.env ni backend/.env.example" >&2
    exit 1
  fi
fi

echo "===> Levantando contenedores (db + api)"
docker compose up -d --build

echo "===> Esperando healthcheck de la DB (puede tardar ~30s)"
ok=false
for i in $(seq 1 30); do
  status=$(docker inspect -f '{{.State.Health.Status}}' topgreen-db 2>/dev/null || echo "starting")
  if [ "$status" = "healthy" ]; then
    ok=true
    break
  fi
  sleep 2
  echo "    intento $i/30 - estado: $status"
done

if [ "$ok" != "true" ]; then
  echo "ERROR: topgreen-db no llegó a healthy en 60s" >&2
  exit 1
fi

# DB_NAME y DB_USER son del .env de la raíz, que es el que lee
# docker-compose.yml para crear la base. En backend/.env no existen: ese
# archivo lo lee Settings, que rechaza claves que no declara.
db_name=$(sed -n 's/^DB_NAME=//p' .env | tail -n 1)
db_user=$(sed -n 's/^DB_USER=//p' .env | tail -n 1)

if [ -z "$db_name" ] || [ -z "$db_user" ]; then
  echo "ERROR: DB_NAME y DB_USER deben estar definidos en .env" >&2
  exit 1
fi

if ! [[ "$db_name" =~ ^[A-Za-z0-9_]+$ ]] || ! [[ "$db_user" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo "ERROR: DB_NAME o DB_USER contienen caracteres no permitidos" >&2
  exit 1
fi

echo "===> Creando la base $db_name si no existe"
db_exists=$(docker exec topgreen-db psql -U "$db_user" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$db_name'")
if [ "$db_exists" != "1" ]; then
  docker exec topgreen-db createdb -U "$db_user" "$db_name"
fi

echo "===> Aplicando migraciones (alembic upgrade head)"
docker exec topgreen-api alembic upgrade head

echo "===> Cargando datos demo (seed)"
docker exec topgreen-api python -m app.seed

cat <<EOF

===> OK. Cuentas demo:
       admin@topgreen.com / admin123
       vendedor@ejemplo.com / vendedor123
       cliente@ejemplo.com / cliente123

Backend  : http://localhost:8000/api/docs
Frontend : npm install ; npm run dev    (luego http://localhost:5173)
EOF
