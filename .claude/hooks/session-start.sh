#!/usr/bin/env bash
# Deja el entorno listo al empezar la sesión.
#
# Corre SÓLO en los contenedores remotos de Claude Code, que son efímeros: ahí
# se pierde entre sesión y sesión todo lo que no esté versionado —el puente de
# `docker exec`, los dos .env, el venv, la base—, y sin eso ni la suite ni las
# puertas pueden correr. En una máquina de escritorio no se toca nada: el
# entorno es de quien la usa, y arrancarle servicios o crearle archivos sin
# pedirlo sería decidir por ella.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

exec "${CLAUDE_PROJECT_DIR:-.}/scripts/entorno_nativo.sh"
