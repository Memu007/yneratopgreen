#!/bin/bash
# Reinicia la API nativa del worktree y comprueba que quede UN solo proceso.
# Nunca uses pkill -f: el patrón puede coincidir con tu propia terminal.
source "$(dirname "$0")/comun.sh"
VPY="$CAND/backend/.venv/bin/python"
for p in /proc/[0-9]*; do c=$(tr '\0' ' ' < $p/cmdline 2>/dev/null); case "$c" in "$VPY"*uvicorn*) kill ${p#/proc/};; esac; done
for i in $(seq 1 20); do curl -s -o /dev/null localhost:8000/api/health || break; sleep 0.5; done
(cd "$CAND/backend" && exec setsid .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 >> $PM_DIR/api.log 2>&1 < /dev/null) > /dev/null 2>&1 &
for i in $(seq 1 30); do curl -s -o /dev/null localhost:8000/api/health && break; sleep 0.5; done
n=0; for p in /proc/[0-9]*; do c=$(tr '\0' ' ' < $p/cmdline 2>/dev/null); case "$c" in "$VPY"*uvicorn*) n=$((n+1));; esac; done
curl -s -o /dev/null -w "api %{http_code} procesos=$n\n" localhost:8000/api/catalog/categories
