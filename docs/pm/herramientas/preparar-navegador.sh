#!/bin/bash
# El contenedor trae Chromium en /opt/pw-browsers, pero quizás de otra versión
# que la que pide el Playwright del proyecto. No se descarga nada: se arma la
# carpeta que Playwright espera con enlaces al Chromium instalado.
source "$(dirname "$0")/comun.sh"
J="$CAND/node_modules/playwright-core/browsers.json"
[ -f "$J" ] || { echo "sin $J: corré npm ci primero"; exit 1; }
REV=$(python3 -c "import json;print(next(b['revision'] for b in json.load(open('$J'))['browsers'] if b['name']=='chromium'))")
OPT=$(ls -d /opt/pw-browsers/chromium-[0-9]* | head -1); HS=$(ls -d /opt/pw-browsers/chromium_headless_shell-[0-9]* | head -1)
mkdir -p "$PM_DIR/pw/chromium-$REV/chrome-linux64" "$PM_DIR/pw/chromium_headless_shell-$REV/chrome-headless-shell-linux64"
ln -sf "$OPT/chrome-linux/chrome" "$PM_DIR/pw/chromium-$REV/chrome-linux64/chrome"
ln -sf "$HS/chrome-linux/headless_shell" "$PM_DIR/pw/chromium_headless_shell-$REV/chrome-headless-shell-linux64/chrome-headless-shell"
touch "$PM_DIR/pw/chromium-$REV/INSTALLATION_COMPLETE" "$PM_DIR/pw/chromium_headless_shell-$REV/INSTALLATION_COMPLETE"
echo "navegador: chromium $REV -> $OPT"
