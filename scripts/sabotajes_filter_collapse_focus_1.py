#!/usr/bin/env python3
"""Los rojos discriminantes de FILTER-COLLAPSE-FOCUS-1.

Con el panel de filtros plegado, el teclado no puede entrar en sus controles,
y «Ver N resultados» tiene que dejar el foco en «Filtros», a la vista. Este
script rompe una cosa por vez, corre el caso 187 y comprueba que falle por lo
que corresponde.

    python3 scripts/sabotajes_filter_collapse_focus_1.py                          # los tres
    python3 scripts/sabotajes_filter_collapse_focus_1.py componente-de-la-base    # uno solo

Los tres:

  componente-de-la-base      el panel vuelve a la base de la tarea, componente
                             y CSS. El caso tiene que fallar por foco en
                             controles invisibles, nombrándolos. Es el
                             negativo que pidió PM.
  foco-sin-volver            «Ver N resultados» sólo pliega el panel. El foco
                             se queda en un botón que ya no se ve.
  desplazamiento-sin-cortar  «Ver N resultados» devuelve el foco y centra
                             «Filtros», pero no corta el desplazamiento suave
                             que trajo el botón. Ese desplazamiento termina
                             después de plegar y se lleva «Filtros» fuera de
                             la pantalla.

Necesita la API en 8000, el frontend de desarrollo en 5173 y la siembra demo.
No toca la base. Todo lo que cambia lo deja como estaba.
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
CSS = RAIZ / "src/components/FilterSidebar/FilterSidebar.module.css"
TSX = RAIZ / "src/components/FilterSidebar/FilterSidebar.tsx"
# La base de la tarea: el commit de PM que la asignó.
BASE = "d468a8b"

# El componente mezcla finales de línea; se cambia a nivel de bytes para no
# tocar los que no son del sabotaje.
CORTAR = b"                    window.scrollTo({ top: window.scrollY, behavior: 'instant' });\n"
ENFOCAR = b"                    resumen.current?.focus({ preventScroll: true });\n"
CENTRAR = b"                    resumen.current?.scrollIntoView({ block: 'center' });\n"


def git(*argumentos):
    return subprocess.run(["git", *argumentos], cwd=RAIZ, capture_output=True, check=True).stdout


def sin(*pedazos):
    def aplicar():
        original = TSX.read_bytes()
        texto = original
        for pedazo in pedazos:
            assert texto.count(pedazo) == 1, f"el componente ya no tiene exactamente una vez: {pedazo[:70]!r}"
            texto = texto.replace(pedazo, b"")
        TSX.write_bytes(texto)
        return {TSX: original}
    return aplicar


def componente_de_la_base():
    guardado = {CSS: CSS.read_bytes(), TSX: TSX.read_bytes()}
    for ruta in (CSS, TSX):
        ruta.write_bytes(git("show", f"{BASE}:{ruta.relative_to(RAIZ).as_posix()}"))
    return guardado


SABOTAJES = {
    "componente-de-la-base": (
        componente_de_la_base,
        lambda v: (v.startswith("[FAIL]") and "con «Filtros» cerrado, Tab cayó en 11 controles que no se ven" in v
                   and "«Tipo» (#catalog-type)" in v and re.search(r"«Ver \d+ resultados»", v) is not None),
        "falla porque Tab cae en los 11 controles invisibles, nombrados",
    ),
    "foco-sin-volver": (
        sin(CORTAR, ENFOCAR, CENTRAR),
        lambda v: v.startswith("[FAIL]") and "cerró el panel y el foco quedó en" in v and "no en «Filtros»" in v,
        "falla porque el foco se queda en «Ver N resultados», que ya no se ve",
    ),
    "desplazamiento-sin-cortar": (
        sin(CORTAR),
        lambda v: v.startswith("[FAIL]") and "el foco está en «Filtros» pero no se ve" in v,
        "falla porque el desplazamiento suave se lleva «Filtros» fuera de la pantalla",
    ),
}


def caso_187():
    proceso = subprocess.run(
        ["node", "scripts/smoke.mjs"], cwd=RAIZ, capture_output=True, text=True,
        env={**os.environ, "SMOKE_CASOS": "187"}, timeout=600,
    )
    for linea in proceso.stdout.splitlines():
        if linea.startswith("[PASS]") or linea.startswith("[FAIL]"):
            return linea
    return f"(sin veredicto; salida: {proceso.stdout[-300:]})"


def main(pedidos):
    todos = True
    for nombre in pedidos:
        aplicar, esperado, que = SABOTAJES[nombre]
        print(f"\n=== {nombre}: {que} ===", flush=True)
        vigilados = [CSS, TSX]
        antes = {r: servido(r) for r in vigilados}
        guardado, durante = {}, {}
        veredicto = "(el caso no llegó a correr)"
        try:
            guardado = aplicar()
            cambiados = [r for r in vigilados if r.read_bytes() != guardado.get(r, r.read_bytes())]
            esperar_a_que_cambie(cambiados, {r: antes[r] for r in cambiados})
            durante = {r: servido(r) for r in cambiados}
            veredicto = caso_187()
        finally:
            for ruta, datos in guardado.items():
                ruta.write_bytes(datos)
            if durante:
                esperar_a_que_deje(durante)
        dio = esperado(veredicto)
        print(("[ROJO ESPERADO] " if dio else "[NO DISCRIMINA] ") + veredicto[:700], flush=True)
        todos = todos and dio
    estado = git("status", "--porcelain", "--", "src").decode().strip()
    print(f"\nsrc despues: {estado or 'como estaba'}")
    print("todos dieron el rojo esperado" if todos else "ATENCION: alguno no discriminó")
    return 0 if todos else 1


if __name__ == "__main__":
    pedidos = sys.argv[1:] or list(SABOTAJES)
    desconocidos = [p for p in pedidos if p not in SABOTAJES]
    if desconocidos:
        print(f"sabotajes desconocidos: {desconocidos}; hay {list(SABOTAJES)}")
        raise SystemExit(2)
    raise SystemExit(main(pedidos))
