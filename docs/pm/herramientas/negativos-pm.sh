#!/bin/bash
# Plantilla de los negativos de PM: copiala a $PM_DIR, cambiá los sabotajes y correla.
# Cada sabotaje cambia UNA cosa del producto, corre los casos que deberían
# detectarlo y deja el árbol como estaba. Un sabotaje que «sobrevive» (el caso
# sigue verde) es un hueco de cobertura: se informa, aunque el código esté bien.
source "$(dirname "$0")/comun.sh"; cd "$CAND"
VPY="$CAND/backend/.venv/bin/python"
sab() { $VPY - "$@" <<'P'
import sys
f,a,b=sys.argv[1],sys.argv[2],sys.argv[3]
t=open(f,newline='').read(); assert t.count(a)==1, (f,a)   # newline='' conserva CRLF
open(f,'w',newline='').write(t.replace(a,b)); print("aplicado en",f)
P
}
corre() {  # corre <nombre> <casos>
  echo "=== $1 === cambios: $(git diff --numstat -- backend src | awk '{s+=$1} END {print s+0}')"
  "$HERR/reiniciar-api.sh" >/dev/null 2>&1; sleep 3
  SMOKE_CASOS=$2 timeout 900 node scripts/smoke.mjs > $PM_DIR/negpm_$1.log 2>&1 < /dev/null; echo rc=$?
  grep -A6 "^\[FAIL\]" $PM_DIR/negpm_$1.log | cut -c1-260 | head -8; grep -E "^\[PASS\]" $PM_DIR/negpm_$1.log | cut -c1-60
  git checkout -- src backend; "$HERR/reiniciar-api.sh" >/dev/null 2>&1
}
# Ejemplo (INICIO-CIERRE-CELULAR-1): el corte de celular se corre un píxel.
sab src/hooks/useEsMovil.ts "'(max-width: 599px)'" "'(max-width: 600px)'"
corre corte-600 240
echo "src/backend: $(git diff --quiet -- src backend && echo como estaban || echo MODIFICADOS)"; echo fin
