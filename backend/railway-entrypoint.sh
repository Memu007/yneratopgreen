#!/bin/sh
set -eu

case "${DATABASE_URL:-}" in
  postgres://*)
    DATABASE_URL="postgresql+psycopg://${DATABASE_URL#postgres://}"
    ;;
  postgresql://*)
    DATABASE_URL="postgresql+psycopg://${DATABASE_URL#postgresql://}"
    ;;
esac
export DATABASE_URL

case "${1:-serve}" in
  migrate)
    exec alembic upgrade head
    ;;
  serve)
    mkdir -p "${UPLOAD_DIR:-/data/uploads}"
    exec uvicorn app.main:app \
      --host 0.0.0.0 \
      --port "${PORT:-8000}" \
      --proxy-headers \
      --forwarded-allow-ips="*"
    ;;
  *)
    exec "$@"
    ;;
esac
