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
docker compose up -d

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
