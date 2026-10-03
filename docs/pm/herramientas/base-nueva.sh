#!/bin/bash
# Base PostGIS recién creada, migraciones, siembra y API.
source "$(dirname "$0")/comun.sh"
docker rm -f topgreen-db >/dev/null 2>&1
docker run -d --name topgreen-db -e POSTGRES_DB=topgreen -e POSTGRES_USER=topgreen -e POSTGRES_PASSWORD=pm_local_inventado_1 -p 5433:5432 -v "$CAND/infra/postgres/init/99_topgreen_postgis_only.sh:/docker-entrypoint-initdb.d/99_topgreen_postgis_only.sh:ro" postgis/postgis:16-3.4 >/dev/null
for i in $(seq 1 60); do docker exec topgreen-db pg_isready -U topgreen -h 127.0.0.1 >/dev/null 2>&1 && break; sleep 1; done; sleep 5
cd "$CAND/backend" && .venv/bin/alembic upgrade head >/dev/null 2>&1 && .venv/bin/python -m app.seed >/dev/null 2>&1 && echo "base nueva"; rm -rf outbox
"$HERR/reiniciar-api.sh"
