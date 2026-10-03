# uso: python3 negativos-dev.py <script de negativos de la Dev> [sabotaje ...]
# Para los scripts viejos que reinician la API con `entorno_nativo.sh`: les
# cambia el reinicio por el de PM. Los nuevos aceptan REINICIAR_API y no lo
# necesitan: REINICIAR_API=docs/pm/herramientas/reiniciar-api.sh python3 scripts/<script>.
import os, sys, subprocess, importlib.util
CAND = os.environ["CAND"]; HERR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, CAND + "/scripts")
spec = importlib.util.spec_from_file_location("sab", CAND + "/scripts/" + sys.argv[1])
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
m.reiniciar_la_api = lambda: subprocess.run([HERR + "/reiniciar-api.sh"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
raise SystemExit(m.main(sys.argv[2:] or list(m.SABOTAJES)))
