#!/bin/bash
# El contenedor de PM se reinicia entre turnos: Docker y los procesos mueren.
# Esto los vuelve a levantar sobre el worktree que ya está: base nueva, API y frontend.
source "$(dirname "$0")/comun.sh"
docker ps >/dev/null 2>&1 || { rm -f /run/docker/containerd/containerd.pid /var/run/docker.pid; (setsid dockerd > $PM_DIR/dockerd.log 2>&1 < /dev/null &); for i in $(seq 1 40); do docker ps >/dev/null 2>&1 && break; sleep 1; done; }
docker ps >/dev/null && echo docker-ok
timeout 300 "$HERR/base-nueva.sh"
curl -s -o /dev/null localhost:5173/ || { (cd "$CAND" && exec setsid npm run dev > $PM_DIR/vite.log 2>&1 < /dev/null) > /dev/null 2>&1 & sleep 8; }
curl -s -o /dev/null -w "front %{http_code}\n" http://localhost:5173/
