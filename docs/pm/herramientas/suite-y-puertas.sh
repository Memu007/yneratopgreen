#!/bin/bash
# uso: suite-y-puertas.sh <BASE> <SHA>   (BASE y SHA para el diff-check)
# Suite completa desde base nueva, repetición de los rojos, auditorías, guías y puertas.
# Tarda ~45 min: correla separada y consultá el registro (ver ONBOARDING-PM.md).
source "$(dirname "$0")/comun.sh"; BASE=$1; SHA=$2; cd "$CAND"
"$HERR/base-nueva.sh"
echo "## suite completa, base nueva"; t0=$(date +%s); node scripts/smoke.mjs > $PM_DIR/suite.log 2>&1; echo "suite=$? en $(( $(date +%s)-t0 ))s"; grep pasaron $PM_DIR/suite.log | tail -1; grep "^\[FAIL\]" $PM_DIR/suite.log | cut -c1-140
F=$(grep "^\[FAIL\]" $PM_DIR/suite.log | sed -E 's/^\[FAIL\] ([0-9]+).*/\1/' | grep -v '^169$' | paste -sd, -)
if [ -n "$F" ]; then "$HERR/reiniciar-api.sh" >/dev/null 2>&1; echo "## repetidos: $F"; SMOKE_CASOS=$F node scripts/smoke.mjs > $PM_DIR/repetidos.log 2>&1; grep pasaron $PM_DIR/repetidos.log; grep "^\[FAIL\]" $PM_DIR/repetidos.log | cut -c1-250; fi
"$HERR/reiniciar-api.sh" >/dev/null 2>&1
echo "## a11y"; node scripts/a11y.mjs --todas > $PM_DIR/a11y.log 2>&1; echo a11y=$?; tail -1 $PM_DIR/a11y.log
echo "## contraste"; node scripts/contraste.mjs > $PM_DIR/contraste.log 2>&1; echo con=$?; tail -1 $PM_DIR/contraste.log
echo "## movil"; node scripts/mobile-audit.mjs > $PM_DIR/movil.log 2>&1; echo mob=$?; grep -E "Recorridos completos|Desbordes" $PM_DIR/movil.log | tail -2
echo "## guia del panel"; node scripts/guia-admin.mjs > $PM_DIR/guia-admin.log 2>&1; echo guia=$?; tail -1 $PM_DIR/guia-admin.log
echo "## guia de uso"; node scripts/guia-usuario.mjs > $PM_DIR/guia-usuario.log 2>&1 < /dev/null; echo gu=$?; tail -1 $PM_DIR/guia-usuario.log
npm run build >/dev/null 2>&1; echo build=$?; npx tsc --noEmit >/dev/null 2>&1; echo tsc=$?; npm run lint >/dev/null 2>&1; echo lint=$?
(cd backend && .venv/bin/python -m compileall -q app alembic >/dev/null; echo compileall=$?; .venv/bin/alembic check 2>&1 | tail -1)
git -c core.whitespace=cr-at-eol diff --check "$BASE" "$SHA"; echo diffcheck=$?
git status --short | grep -v "^??"; echo fin
