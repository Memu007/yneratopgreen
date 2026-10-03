#!/bin/bash
# uso: levantar.sh <SHA>
# Worktree en el SHA, .env inventados, venv, npm, base nueva, API nativa y frontend.
source "$(dirname "$0")/comun.sh"; SHA=$1
docker ps >/dev/null 2>&1 || { rm -f /run/docker/containerd/containerd.pid /var/run/docker.pid; (setsid dockerd > $PM_DIR/dockerd.log 2>&1 < /dev/null &); for i in $(seq 1 30); do docker ps >/dev/null 2>&1 && break; sleep 1; done; }
cd "$REPO" && git worktree remove --force "$CAND" 2>/dev/null; git worktree prune; git worktree add --detach "$CAND" "$SHA" >/dev/null 2>&1; cd "$CAND" && git log --oneline -1
printf 'DB_NAME=topgreen\nDB_USER=topgreen\nDB_PASSWORD=pm_local_inventado_1\nDB_EXPOSED_PORT=5433\n' > .env
cd backend && python3 -m venv .venv && .venv/bin/pip install -q -r requirements.txt 2>&1 | grep -v notice | tail -2
cp .env.example .env
sed -i 's#^DATABASE_URL=.*#DATABASE_URL=postgresql+psycopg://topgreen:pm_local_inventado_1@localhost:5433/topgreen#' .env
JS=$(.venv/bin/python -c "import secrets;print(secrets.token_urlsafe(48))"); sed -i "s#^JWT_SECRET=.*#JWT_SECRET=$JS#" .env
for k in ENV FRONTEND_URL MP_APP_ID MP_CLIENT_SECRET MP_REDIRECT_URI MP_AUTH_BASE_URL MP_API_BASE_URL MP_CHECKOUT_HABILITADO MP_WEBHOOK_SECRET MP_MINUTOS_DE_VIGENCIA MP_MINUTOS_DE_GRACIA MP_TOKEN_KEY; do sed -i "/^$k=/d" .env; done
FK=$(.venv/bin/python -c "from cryptography.fernet import Fernet;print(Fernet.generate_key().decode())")
cat >> .env <<EOT
ENV=local
FRONTEND_URL=http://localhost:5173
MP_APP_ID=app-local-de-prueba
MP_CLIENT_SECRET=secreto-local-inventado
MP_REDIRECT_URI=http://localhost:5173/api/mp-oauth/callback
MP_AUTH_BASE_URL=http://127.0.0.1:8099
MP_API_BASE_URL=http://127.0.0.1:8099
MP_CHECKOUT_HABILITADO=true
MP_WEBHOOK_SECRET=secreto-local-de-prueba-no-es-real
MP_MINUTOS_DE_VIGENCIA=30
MP_MINUTOS_DE_GRACIA=10
MP_TOKEN_KEY=$FK
EOT
cd .. && npm ci --silent >/dev/null 2>&1; echo npm=$?
"$HERR/preparar-navegador.sh"
"$HERR/base-nueva.sh"
(cd "$CAND" && exec setsid npm run dev > $PM_DIR/vite.log 2>&1 < /dev/null) > /dev/null 2>&1 & sleep 8
curl -s -o /dev/null -w "front %{http_code}\n" http://localhost:5173/
