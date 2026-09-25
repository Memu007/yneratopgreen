#!/usr/bin/env python3
"""Los rojos discriminantes de PROD-LISTS-1.

Cada negativo rompe la migración `01ff14043124` de una manera y comprueba que
el caso 197 falle por ESE motivo:

    python3 scripts/sabotajes_prod_lists_1.py                   # los tres
    python3 scripts/sabotajes_prod_lists_1.py sin-marcas        # uno solo

  sin-marcas        La migración no carga las marcas: producción sigue
                    ofreciendo sólo «Sin declarar».
  sin-localidades   La migración no carga las localidades: en producción nadie
                    podría publicar.
  pisa-el-panel     La migración vuelve a escribir las marcas que ya existen,
                    activas y con el rótulo de la siembra: deshace lo que la
                    clienta cambió desde el panel.

Necesita la API y la base locales con la siembra demo. No reinicia la API: el
caso corre la migración con alembic sobre una copia de la base. Deja la
migración como estaba.
"""
import os
import subprocess
import sys
from pathlib import Path

sys.dont_write_bytecode = True

RAIZ = Path(__file__).resolve().parent.parent
MIGRACION = RAIZ / "backend/alembic/versions/20260925_0300_01ff14043124_listas_que_produccion_necesita.py"


def reemplazar(pares):
    datos = MIGRACION.read_text(encoding="utf-8")
    for viejo, nuevo in pares:
        assert datos.count(viejo) == 1, f"no encontré «{viejo[:60]}»"
        datos = datos.replace(viejo, nuevo)
    return datos


SABOTAJES = {
    "sin-marcas": (
        lambda: reemplazar([("    cargar_marcas(conexion)\n", "    pass\n")]),
        ["tras subir: faltan 44 marcas"],
        "el 197 dice que faltan las 44 marcas",
    ),
    "sin-localidades": (
        lambda: reemplazar([("    cargar_localidades(conexion)\n", "    pass\n")]),
        ["las localidades no quedaron como las de la siembra"],
        "el 197 dice que faltan localidades",
    ),
    "pisa-el-panel": (
        lambda: reemplazar([
            ("    existentes = {\n", "    conexion.execute(sa.text(\"DELETE FROM form_options WHERE option_type = 'brand'\"))\n"
                                   "    existentes = {\n"),
        ]),
        ["la migración reactivó «pauny»"],
        "el 197 dice que la migración deshizo lo que se cambió en el panel",
    ),
}


def caso_197():
    proceso = subprocess.run(["node", "scripts/smoke.mjs"], cwd=RAIZ, capture_output=True, text=True,
                             env={**os.environ, "SMOKE_CASOS": "197"}, timeout=900)
    lineas = [l for l in proceso.stdout.splitlines() if l.startswith(("[PASS] 197", "[FAIL] 197"))]
    return lineas[0] if lineas else "(el caso no imprimió su veredicto)"


def main(pedidos):
    original = MIGRACION.read_bytes()
    todos = True
    for nombre in pedidos:
        aplicar, deben, que = SABOTAJES[nombre]
        print(f"\n=== {nombre}: {que} ===", flush=True)
        try:
            MIGRACION.write_text(aplicar(), encoding="utf-8")
            veredicto = caso_197()
        finally:
            MIGRACION.write_bytes(original)
        faltan = [t for t in deben if t not in veredicto]
        dio = veredicto.startswith("[FAIL] 197") and not faltan
        print("[ROJO ESPERADO]" if dio else "[NO DISCRIMINA]", flush=True)
        if faltan:
            print(f"  no dijo: {faltan}")
        print(f"  {veredicto[:400]}")
        todos = todos and dio
    igual = MIGRACION.read_bytes() == original
    print(f"\nla migración después: {'como estaba' if igual else 'CAMBIADA'}")
    todos = todos and igual
    print("todos dieron el rojo esperado" if todos else "ATENCION: alguno no discriminó")
    return 0 if todos else 1


if __name__ == "__main__":
    pedidos = sys.argv[1:] or list(SABOTAJES)
    desconocidos = [p for p in pedidos if p not in SABOTAJES]
    if desconocidos:
        print(f"sabotajes desconocidos: {desconocidos}; hay {list(SABOTAJES)}")
        raise SystemExit(2)
    raise SystemExit(main(pedidos))
