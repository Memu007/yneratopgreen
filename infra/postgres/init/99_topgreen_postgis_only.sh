#!/usr/bin/env bash
set -euo pipefail

# La imagen postgis/postgis habilita geocoder y topology en ambas bases.
# TopGreen sólo necesita la extensión postgis.
for database_name in template_postgis "$POSTGRES_DB"; do
  echo "Removing unused PostGIS extensions from $database_name"
  psql \
    -v ON_ERROR_STOP=1 \
    --username "$POSTGRES_USER" \
    --dbname "$database_name" <<'SQL'
DROP EXTENSION IF EXISTS postgis_tiger_geocoder CASCADE;
DROP EXTENSION IF EXISTS postgis_topology CASCADE;
DROP EXTENSION IF EXISTS fuzzystrmatch CASCADE;
DROP SCHEMA IF EXISTS tiger_data CASCADE;
DROP SCHEMA IF EXISTS tiger CASCADE;
DROP SCHEMA IF EXISTS topology CASCADE;
SQL
done
