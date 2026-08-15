#!/usr/bin/env bash
# Suite integral de smoke tests de TopGreen.
# ADVERTENCIA: elimina los volúmenes locales de Docker antes de ejecutarse.

set -Eeuo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

vite_pid=""
smoke_tmp="$(mktemp -d "${TMPDIR:-/tmp}/topgreen-smoke.XXXXXX")"
vite_log="$smoke_tmp/vite.log"
root_env_existed=false
backend_env_existed=false

cleanup() {
  exit_code=$?
  trap - EXIT INT TERM

  if [ -n "$vite_pid" ] && kill -0 "$vite_pid" 2>/dev/null; then
    kill "$vite_pid" 2>/dev/null || true
    wait "$vite_pid" 2>/dev/null || true
  fi

  if [ "$root_env_existed" = "true" ]; then
    cp "$smoke_tmp/root.env" .env
  else
    rm -f .env
  fi

  if [ "$backend_env_existed" = "true" ]; then
    cp "$smoke_tmp/backend.env" backend/.env
  else
    rm -f backend/.env
  fi

  rm -f "$vite_log" "$smoke_tmp/root.env" "$smoke_tmp/backend.env"
  rmdir "$smoke_tmp"
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

echo "===> Preparando variables locales"
if [ -f .env ]; then
  root_env_existed=true
  cp .env "$smoke_tmp/root.env"
fi
if [ -f backend/.env ]; then
  backend_env_existed=true
  cp backend/.env "$smoke_tmp/backend.env"
fi
cp .env.example .env
cp backend/.env.example backend/.env

echo "===> Configurando el vinculo de Mercado Pago contra el doble local"
# La suite prueba el vinculo OAuth de punta a punta y por eso necesita la
# integracion configurada. Estos valores son INVENTADOS y apuntan al doble que
# levanta la propia suite (scripts/lib/mp-doble.mjs): no hay credenciales
# reales de Mercado Pago en este repositorio y no las va a haber.
#
# La clave de cifrado se genera nueva en cada corrida. Fernet pide 32 bytes al
# azar en base64 urlsafe, que es exactamente lo que produce esta linea; se usa
# openssl y no Python para no depender de que el host tenga `cryptography`.
{
  echo "MP_APP_ID=app-local-de-prueba"
  echo "MP_CLIENT_SECRET=secreto-local-inventado"
  echo "MP_REDIRECT_URI=http://localhost:5173/api/mp-oauth/callback"
  echo "MP_TOKEN_KEY=$(openssl rand -base64 32 | tr '+/' '-_')"
  echo "MP_AUTH_BASE_URL=http://127.0.0.1:8099"
  echo "MP_API_BASE_URL=http://127.0.0.1:8099"
  # El cobro por Mercado Pago se enciende SOLO para la suite y SOLO
  # contra el doble. En produccion la bandera queda apagada: que el webhook
  # firmado, la consulta de estado y la reserva de stock existan y esten
  # probados no es lo mismo que haberlos operado con plata real.
  echo "MP_CHECKOUT_HABILITADO=true"
  # El secreto con el que el doble firma los avisos. Es inventado, igual que
  # todo lo de arriba, y tiene que coincidir con el que usa scripts/smoke.mjs.
  echo "MP_WEBHOOK_SECRET=secreto-local-de-prueba-no-es-real"
  echo "MP_MINUTOS_DE_VIGENCIA=30"
  echo "MP_MINUTOS_DE_GRACIA=10"
} >> backend/.env

echo "===> Compilando frontend"
npm run build

echo "===> Verificando Chromium de Playwright"
npx playwright install chromium

echo "===> Eliminando contenedores y volúmenes locales"
docker compose down -v --remove-orphans
docker rm -f topgreen-db topgreen-api >/dev/null 2>&1 || true

echo "===> Inicializando DB, migraciones, seed y API"
./scripts/init_local_db.sh

echo "===> Iniciando frontend para la prueba de publicación"
npm run dev -- --host 127.0.0.1 >"$vite_log" 2>&1 &
vite_pid=$!

frontend_ready=false
for attempt in $(seq 1 30); do
  if curl --fail --silent http://localhost:5173/ >/dev/null; then
    frontend_ready=true
    break
  fi
  sleep 1
  echo "    intento $attempt/30 - frontend todavía no responde"
done

if [ "$frontend_ready" != "true" ]; then
  echo "ERROR: el frontend no respondió en 30 segundos" >&2
  cat "$vite_log" >&2
  exit 1
fi

echo "===> Ejecutando 108 smoke tests"
set +e
node scripts/smoke.mjs "$@"
smoke_exit=$?
set -e

if [ "$smoke_exit" -ne 0 ]; then
  echo
  echo "===> Log de Vite (la suite falló)"
  cat "$vite_log"
fi

exit "$smoke_exit"
