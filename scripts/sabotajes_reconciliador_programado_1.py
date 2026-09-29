#!/usr/bin/env python3
"""Los rojos discriminantes de RECONCILIADOR-PROGRAMADO-1.

    python3 scripts/sabotajes_reconciliador_programado_1.py              # todos
    python3 scripts/sabotajes_reconciliador_programado_1.py otro-comando # uno

Cada uno rompe un solo lugar, reinicia la API, corre su caso y deja el archivo
como estaba, con otro reinicio. Tiene que dar rojo por su motivo, y sólo por él.

  no-termina                El reconciliador barre y después se queda
                            esperando. El 223 da rojo por tiempo.
  corre-migraciones         El entrypoint corre las migraciones antes de
                            cualquier comando. El 223 las ve en la salida.
  otro-comando              RAILWAY.md le da al servicio otro comando. El 223
                            no ve la línea «RECONCILIACION» y la orden vencida
                            no se cierra.
  sin-comprobar-la-clave    Con otra MP_TOKEN_KEY el servicio barre igual. El
                            224 ve a la vendedora marcada para reconectar.
  sin-exigir-la-clave       Sin MP_TOKEN_KEY el servicio barre igual. El 224
                            ve lo mismo.
  mensaje-con-traza         Sin una variable que pide la configuración, el
                            servicio sale con la traza de pydantic en vez de
                            una línea. El 224.

El reinicio de la API sale de REINICIAR_API; por omisión,
`./scripts/entorno_nativo.sh --reiniciar-api`. El caso copia `app/` del entorno
de la API y lee el entrypoint y RAILWAY.md del repositorio.

Necesita la API en 8000, el frontend de desarrollo en 5173 y la siembra demo.
"""
import os
import shlex
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
RECONCILIADOR = RAIZ / "backend/app/reconciliar.py"
ENTRYPOINT = RAIZ / "backend/railway-entrypoint.sh"
RAILWAY_MD = RAIZ / "RAILWAY.md"
REINICIAR_API = os.environ.get("REINICIAR_API", "./scripts/entorno_nativo.sh --reiniciar-api")

NO_BARRE = ["no barrió", "barrió igual", "marcó", "tocó la orden", "salió con 0"]

# nombre: (archivo, [(viejo, nuevo), …], caso, lo que tiene que decir, lo que no)
SABOTAJES = {
    "no-termina": (
        RECONCILIADOR,
        [("    print(f\"RECONCILIACION {json.dumps(resumen, sort_keys=True)}\")\n",
          "    print(f\"RECONCILIACION {json.dumps(resumen, sort_keys=True)}\")\n"
          "    import threading\n"
          "    threading.Event().wait()\n")],
        223,
        ["no terminó en 90 s"],
        ["corrió migraciones", "salió con"],
    ),
    "corre-migraciones": (
        ENTRYPOINT,
        [("  *)\n    exec \"$@\"\n", "  *)\n    alembic upgrade head\n    exec \"$@\"\n")],
        223,
        ["el servicio corrió migraciones"],
        ["no terminó", "no imprimió", "no cerró la orden vencida"],
    ),
    "otro-comando": (
        RAILWAY_MD,
        [("   - **Comando de inicio (Custom Start Command):** `railway-entrypoint python -m app.reconciliar`\n",
          "   - **Comando de inicio (Custom Start Command):** `railway-entrypoint python -V`\n")],
        223,
        ["no imprimió «RECONCILIACION {…}»", "la orden vencida quedó «placed»"],
        ["no terminó", "corrió migraciones"],
    ),
    "sin-comprobar-la-clave": (
        RECONCILIADOR,
        [("    if guardadas:\n        return (f\"MP_TOKEN_KEY no abre ninguna",
          "    if guardadas and False:\n        return (f\"MP_TOKEN_KEY no abre ninguna")],
        224,
        ["con otra MP_TOKEN_KEY: marcó 1 vendedor(es) para reconectar", "con otra MP_TOKEN_KEY: salió con 0",
         "la vendedora de la orden quedó marcada para reconectar"],
        ["sin JWT_SECRET:", "sin MP_TOKEN_KEY:"],
    ),
    "sin-exigir-la-clave": (
        RECONCILIADOR,
        [("        motivo = por_que_no_puede_barrer(db)\n",
          "        motivo = por_que_no_puede_barrer(db) if settings.MP_TOKEN_KEY else None\n")],
        224,
        ["sin MP_TOKEN_KEY: marcó 1 vendedor(es) para reconectar", "sin MP_TOKEN_KEY: salió con 0"],
        ["sin JWT_SECRET:", "con otra MP_TOKEN_KEY: salió", "con otra MP_TOKEN_KEY: marcó"],
    ),
    "mensaje-con-traza": (
        RECONCILIADOR,
        [("    if __name__ != \"__main__\":\n        raise\n",
          "    raise\n")],
        224,
        ["sin JWT_SECRET: no dijo por qué en una línea", "sin JWT_SECRET: salió con una traza"],
        ["sin MP_TOKEN_KEY:", "con otra MP_TOKEN_KEY:", "marcó"],
    ),
}


def reemplazar(texto, viejo, nuevo):
    """Una sola vez, con el final de línea que tenga la zona."""
    for fin in ("\r\n", "\n"):
        v, n = viejo.replace("\n", fin), nuevo.replace("\n", fin)
        if texto.count(v) == 1:
            return texto.replace(v, n)
    raise AssertionError(f"no encontré «{viejo[:70]}»")


def reiniciar_la_api():
    subprocess.run(shlex.split(REINICIAR_API), cwd=RAIZ, capture_output=True, text=True, check=True)


def veredicto_del_caso(numero):
    proceso = subprocess.run(["node", "scripts/smoke.mjs"], cwd=RAIZ, capture_output=True, text=True,
                             env={**os.environ, "SMOKE_CASOS": str(numero)}, timeout=1500)
    lineas = proceso.stdout.splitlines()
    desde = next((i for i, l in enumerate(lineas)
                  if l.startswith((f"[PASS] {numero}", f"[FAIL] {numero}"))), None)
    if desde is None:
        return ["(el caso no imprimió su veredicto)"] + lineas[-5:]
    hasta = next((i for i in range(desde + 1, len(lineas))
                  if lineas[i].startswith(("[PASS]", "[FAIL]", "Resumen smoke"))), len(lineas))
    return [l for l in lineas[desde:hasta] if l.strip()]


def sabotear(nombre):
    ruta, cambios, caso, deben, no_deben = SABOTAJES[nombre]
    original = ruta.read_bytes()
    texto = original.decode("utf-8")
    for viejo, nuevo in cambios:
        texto = reemplazar(texto, viejo, nuevo)
    try:
        ruta.write_bytes(texto.encode("utf-8"))
        reiniciar_la_api()
        veredicto = veredicto_del_caso(caso)
    finally:
        ruta.write_bytes(original)
        reiniciar_la_api()
    # Los problemas que encontró, sin el título del caso.
    todo = "\n".join([veredicto[0].split(" — ", 1)[-1], *veredicto[1:]])
    faltan = [t for t in deben if t not in todo]
    sobran = [t for t in no_deben if t in todo]
    dio = veredicto[0].startswith(f"[FAIL] {caso}") and not faltan and not sobran
    return dio, veredicto, faltan, sobran


def main(pedidos):
    todos = True
    for nombre in pedidos:
        print(f"\n=== {nombre} ===", flush=True)
        dio, veredicto, faltan, sobran = sabotear(nombre)
        print("[ROJO ESPERADO]" if dio else "[NO DISCRIMINA]", flush=True)
        for linea in veredicto:
            print(f"  {linea[:500]}")
        if faltan:
            print(f"  (faltó que dijera: {faltan})")
        if sobran:
            print(f"  (dijo algo de otro motivo: {sobran})")
        todos = todos and dio
    estado = subprocess.run(["git", "status", "--porcelain", "--", "src", "backend", "RAILWAY.md"],
                            cwd=RAIZ, capture_output=True, text=True, check=True).stdout.strip()
    print(f"\nsrc, backend y RAILWAY.md después: {estado or 'como estaban'}")
    print("todos dieron el rojo esperado" if todos else "ATENCION: alguno no discriminó")
    return 0 if todos else 1


if __name__ == "__main__":
    pedidos = sys.argv[1:] or list(SABOTAJES)
    desconocidos = [p for p in pedidos if p not in SABOTAJES]
    if desconocidos:
        print(f"sabotajes desconocidos: {desconocidos}; hay {list(SABOTAJES)}")
        raise SystemExit(2)
    raise SystemExit(main(pedidos))
