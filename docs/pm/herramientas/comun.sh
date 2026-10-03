# Variables comunes de las herramientas de PM. Se incluye con `source`.
# PM_DIR: carpeta de trabajo de PM, fuera del repositorio (no se versiona).
# REPO: el clon de yneratopgreen. CAND: el worktree en el SHA que se revisa.
HERR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="${REPO:-$(cd "$HERR/../../.." && pwd)}"
PM_DIR="${PM_DIR:-$HOME/pm-entorno}"
CAND="$PM_DIR/cand"
mkdir -p "$PM_DIR"
export PATH="$HERR/bin:$PATH" PLAYWRIGHT_BROWSERS_PATH="$PM_DIR/pw" CAND PM_DIR
