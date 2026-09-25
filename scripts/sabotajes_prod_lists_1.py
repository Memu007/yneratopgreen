#!/usr/bin/env python3
"""Los rojos discriminantes de PROD-LISTS-1.

Cada negativo rompe una pieza de una manera y comprueba que su caso falle por
ESE motivo:

    python3 scripts/sabotajes_prod_lists_1.py                   # los cuatro
    python3 scripts/sabotajes_prod_lists_1.py sin-marcas        # uno solo

La migración `01ff14043124` (caso 197):

  sin-marcas        No carga las marcas: producción sigue ofreciendo sólo
                    «Sin declarar».
  sin-localidades   No carga las localidades: en producción nadie podría
                    publicar.
  pisa-el-panel     Vuelve a escribir las marcas que ya existen, activas y con
                    el rótulo de la siembra: deshace lo que la clienta cambió
                    desde el panel.

El filtro de marca con una categoría que usa marca (caso 198):

  oculta-las-cero   El servidor ofrece sólo las marcas que tienen
                    publicaciones, como antes de la decisión de Emi.

Los de la migración no reinician la API: el caso corre la migración con
alembic sobre una copia de la base. El del filtro sí, antes y después. El
reinicio se hace con `./scripts/entorno_nativo.sh --reiniciar-api`, y se
cambia con la variable REINICIAR_API (por ejemplo, REINICIAR_API="docker
restart topgreen-api"). Todo lo que cambia lo deja como estaba.
"""
import os
import shlex
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

sys.dont_write_bytecode = True

RAIZ = Path(__file__).resolve().parent.parent
MIGRACION = RAIZ / "backend/alembic/versions/20260925_0300_01ff14043124_listas_que_produccion_necesita.py"
CATALOGO = RAIZ / "backend/app/api/catalog.py"
REINICIAR_API = os.environ.get("REINICIAR_API", "./scripts/entorno_nativo.sh --reiniciar-api")
SALUD = os.environ.get("API_SALUD", "http://localhost:8000/api/health")


def reemplazar(ruta, pares):
    """Aplica los reemplazos respetando el final de línea del archivo."""
    datos = ruta.read_bytes().decode("utf-8")
    for viejo, nuevo in pares:
        for fin in ("\r\n", "\n"):
            v, n = viejo.replace("\n", fin), nuevo.replace("\n", fin)
            if datos.count(v) == 1:
                datos = datos.replace(v, n)
                break
        else:
            raise AssertionError(f"{ruta.name}: no encontré «{viejo[:60]}»")
    return datos.encode("utf-8")


SABOTAJES = {
    "sin-marcas": (
        MIGRACION, 197,
        lambda: reemplazar(MIGRACION, [("    cargar_marcas(conexion)\n", "    pass\n")]),
        ["tras subir: faltan 44 marcas"],
        "el 197 dice que faltan las 44 marcas",
    ),
    "sin-localidades": (
        MIGRACION, 197,
        lambda: reemplazar(MIGRACION, [("    cargar_localidades(conexion)\n", "    pass\n")]),
        ["las localidades no quedaron como las de la siembra"],
        "el 197 dice que faltan localidades",
    ),
    "pisa-el-panel": (
        MIGRACION, 197,
        lambda: reemplazar(MIGRACION, [(
            "    existentes = {\n",
            "    conexion.execute(sa.text(\"DELETE FROM form_options WHERE option_type = 'brand'\"))\n"
            "    existentes = {\n",
        )]),
        ["la migración reactivó «pauny»"],
        "el 197 dice que la migración deshizo lo que se cambió en el panel",
    ),
    "oculta-las-cero": (
        CATALOGO, 198,
        lambda: reemplazar(CATALOGO, [("    if lista_completa:\n        ofrecidas = ",
                                       "    if False:\n        ofrecidas = ")]),
        ["ofrece 2 marcas y hay 44 activas", "tenía que ofrecer 44"],
        "el 198 dice que faltan las marcas en cero, en la API y en la pantalla",
    ),
}


def reiniciar_la_api():
    subprocess.run(shlex.split(REINICIAR_API), cwd=RAIZ, capture_output=True, text=True, check=True)
    for _ in range(60):
        try:
            with urllib.request.urlopen(SALUD, timeout=2) as respuesta:
                if respuesta.status == 200:
                    return
        except OSError:
            pass
        time.sleep(1)
    raise RuntimeError(f"la API no respondió en {SALUD} después de reiniciarla")


def correr_el_caso(numero):
    proceso = subprocess.run(["node", "scripts/smoke.mjs"], cwd=RAIZ, capture_output=True, text=True,
                             env={**os.environ, "SMOKE_CASOS": str(numero)}, timeout=900)
    lineas = proceso.stdout.splitlines()
    desde = next((i for i, l in enumerate(lineas)
                  if l.startswith((f"[PASS] {numero}", f"[FAIL] {numero}"))), None)
    if desde is None:
        return "(el caso no imprimió su veredicto)"
    hasta = next((i for i in range(desde + 1, len(lineas))
                  if lineas[i].startswith(("[PASS]", "[FAIL]", "Resumen smoke"))), len(lineas))
    return "\n".join(l for l in lineas[desde:hasta] if l.strip())


def main(pedidos):
    originales = {ruta: ruta.read_bytes() for ruta in (MIGRACION, CATALOGO)}
    todos = True
    for nombre in pedidos:
        ruta, numero, aplicar, deben, que = SABOTAJES[nombre]
        print(f"\n=== {nombre}: {que} ===", flush=True)
        del_backend = ruta != MIGRACION
        try:
            ruta.write_bytes(aplicar())
            if del_backend:
                reiniciar_la_api()
            veredicto = correr_el_caso(numero)
        finally:
            ruta.write_bytes(originales[ruta])
            if del_backend:
                reiniciar_la_api()
        faltan = [t for t in deben if t not in veredicto]
        dio = veredicto.startswith(f"[FAIL] {numero}") and not faltan
        print("[ROJO ESPERADO]" if dio else "[NO DISCRIMINA]", flush=True)
        if faltan:
            print(f"  no dijo: {faltan}")
        for linea in veredicto.splitlines():
            print(f"  {linea[:300]}")
        todos = todos and dio
    iguales = all(ruta.read_bytes() == datos for ruta, datos in originales.items())
    print(f"\nla migración y el catálogo después: {'como estaban' if iguales else 'CAMBIADOS'}")
    todos = todos and iguales
    print("todos dieron el rojo esperado" if todos else "ATENCION: alguno no discriminó")
    return 0 if todos else 1


if __name__ == "__main__":
    pedidos = sys.argv[1:] or list(SABOTAJES)
    desconocidos = [p for p in pedidos if p not in SABOTAJES]
    if desconocidos:
        print(f"sabotajes desconocidos: {desconocidos}; hay {list(SABOTAJES)}")
        raise SystemExit(2)
    raise SystemExit(main(pedidos))
