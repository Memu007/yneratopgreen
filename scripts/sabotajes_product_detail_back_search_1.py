#!/usr/bin/env python3
"""El rojo discriminante de PRODUCT-DETAIL-BACK-SEARCH-1.

Volver de una ficha recargada tiene que devolver la búsqueda sin un solo
cuadro sin ella. Este script repone la relectura de la barra como estaba en
la base —en un efecto, después de la escritura—, corre el caso 186 y
comprueba que falle por la búsqueda perdida. Después deja el árbol como
estaba.

    python3 scripts/sabotajes_product_detail_back_search_1.py

Necesita la API en 8000, el frontend de desarrollo en 5173 y la siembra demo.
No toca la base.
"""
import os
import re
import subprocess
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
# Esperar a que el frontend de desarrollo sirva un archivo cambiado, y a que
# deje de servirlo, es lo mismo que en las piezas anteriores.
from sabotajes_product_detail_page_1 import (  # noqa: E402
    esperar_a_que_cambie, esperar_a_que_deje, servido)

RAIZ = Path(__file__).resolve().parent.parent
FILTROS = RAIZ / "src/hooks/useProductFilters.ts"
# La base de la tarea: el commit de PM que la asignó.
BASE = "f42c760"


def git(*argumentos):
    return subprocess.run(["git", *argumentos], cwd=RAIZ, capture_output=True, check=True).stdout


def caso_186():
    proceso = subprocess.run(
        ["node", "scripts/smoke.mjs"], cwd=RAIZ, capture_output=True, text=True,
        env={**os.environ, "SMOKE_CASOS": "186"}, timeout=900,
    )
    for linea in proceso.stdout.splitlines():
        if linea.startswith("[PASS]") or linea.startswith("[FAIL]"):
            return linea
    return f"(sin veredicto; salida: {proceso.stdout[-300:]})"


def main():
    print("\n=== relectura-en-efecto: el hook de filtros como en la base ===", flush=True)
    original = FILTROS.read_bytes()
    antes = {FILTROS: servido(FILTROS)}
    durante = {}
    veredicto = "(el caso no llegó a correr)"
    try:
        FILTROS.write_bytes(git("show", f"{BASE}:{FILTROS.relative_to(RAIZ).as_posix()}"))
        esperar_a_que_cambie([FILTROS], antes)
        durante = {FILTROS: servido(FILTROS)}
        veredicto = caso_186()
    finally:
        FILTROS.write_bytes(original)
        if durante:
            esperar_a_que_deje(durante)
    cuantas = re.search(r"(\d+) de (\d+) vueltas perdieron la búsqueda", veredicto)
    dio = veredicto.startswith("[FAIL]") and bool(cuantas)
    print(("[ROJO ESPERADO] " if dio else "[NO DISCRIMINA] ") + veredicto[:700], flush=True)
    if cuantas:
        print(f"vueltas rojas con el código anterior: {cuantas.group(1)} de {cuantas.group(2)}")
    estado = git("status", "--porcelain", "--", "src").decode().strip()
    print(f"\nsrc despues: {estado or 'como estaba'}")
    return 0 if dio else 1


if __name__ == "__main__":
    raise SystemExit(main())
