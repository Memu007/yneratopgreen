#!/usr/bin/env python3
"""Los rojos discriminantes de FICHA-MOBILE-WIDTH-1.

La ficha tiene que entrar en el celular con la publicación que desbordaba
—«Campo Agrícola de 120 Hectáreas», de la siembra demo—, con una cifra más
larga, con un enlace sin cortes y sin foto. Este script rompe una cosa por
vez, corre el caso 185 y comprueba que falle por lo que corresponde.

    python3 scripts/sabotajes_ficha_mobile_width_1.py                       # los cuatro
    python3 scripts/sabotajes_ficha_mobile_width_1.py geometria-anterior    # uno solo

Los cuatro:

  geometria-anterior  la ficha vuelve a la base de la tarea, CSS y componente.
                      El caso tiene que fallar por el desborde de «Campo
                      Agrícola de 120 Hectáreas» a 360 px. Es el negativo que
                      pidió PM.
  cifra-fija          sólo el precio vuelve a 40 px fijos. La cifra de «Campo
                      Agrícola» se sale del resumen a 360 px.
  placa-recortada     el marco sin foto vuelve a tomar sólo la proporción. La
                      placa queda más alta que su marco y se corta la leyenda.
  enlace-sin-cortes   la descripción vuelve a no partir lo que no tiene dónde
                      partirse. El código pegado de la publicación larga no
                      entra.

Necesita la API en 8000, el frontend de desarrollo en 5173 y la siembra demo.
No toca la base: la publicación larga la crea y la retira el propio caso.
Todo lo que cambia lo deja como estaba.
"""
import os
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
CSS = RAIZ / "src/components/ProductDetail/ProductDetailPage.module.css"
TSX = RAIZ / "src/components/ProductDetail/ProductDetailPage.tsx"
# La base de la tarea: el commit de PM que la asignó.
BASE = "95f3d8d"
CAMPO = "Campo Agrícola de 120 Hectáreas"


def git(*argumentos):
    return subprocess.run(["git", *argumentos], cwd=RAIZ, capture_output=True, check=True).stdout


def quitar(texto, pedazo):
    assert texto.count(pedazo) == 1, f"el CSS ya no tiene exactamente una vez: {pedazo[:60]!r}"
    return texto.replace(pedazo, "")


def en_el_css(cambiar):
    def aplicar():
        original = CSS.read_bytes()
        CSS.write_text(cambiar(original.decode()))
        return {CSS: original}
    return aplicar


def geometria_anterior():
    guardado = {CSS: CSS.read_bytes(), TSX: TSX.read_bytes()}
    for ruta in (CSS, TSX):
        ruta.write_bytes(git("show", f"{BASE}:{ruta.relative_to(RAIZ).as_posix()}"))
    return guardado


SABOTAJES = {
    "geometria-anterior": (
        geometria_anterior,
        lambda v: v.startswith("[FAIL]") and f"360x800 «{CAMPO}»" in v and "el documento mide" in v,
        f"falla por el documento de «{CAMPO}» a 360 px",
    ),
    "cifra-fija": (
        en_el_css(lambda t: t.replace(
            "  .cifra { font-size: min(40px, calc(100cqi / (var(--cifras, 10) * 0.6))); }",
            "  .cifra { font-size: 40px; }")),
        lambda v: v.startswith("[FAIL]") and f"360x800 «{CAMPO}»" in v and "$ 950.000.000" in v,
        f"falla porque la cifra de «{CAMPO}» no entra a 360 px",
    ),
    "placa-recortada": (
        en_el_css(lambda t: quitar(quitar(t, "  min-height: 88px;\n"), "  max-width: 100%;\n")),
        lambda v: v.startswith("[FAIL]") and "la placa sin foto mide" in v,
        "falla porque la placa sin foto no entra en su marco",
    ),
    "enlace-sin-cortes": (
        en_el_css(lambda t: quitar(
            t, "  /* Un enlace o una referencia larga que pega el vendedor no tiene dónde\n"
               "     partirse, y ensanchaba la ficha entera. */\n  overflow-wrap: anywhere;\n")),
        lambda v: v.startswith("[FAIL]") and "la larga sin foto" in v and "Ficha técnica" in v,
        "falla porque la descripción con un código pegado no entra",
    ),
}


def caso_185():
    proceso = subprocess.run(
        ["node", "scripts/smoke.mjs"], cwd=RAIZ, capture_output=True, text=True,
        env={**os.environ, "SMOKE_CASOS": "185"}, timeout=600,
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
        vigilados = [CSS, TSX] if nombre == "geometria-anterior" else [CSS]
        antes = {r: servido(r) for r in vigilados}
        guardado, durante = {}, {}
        veredicto = "(el caso no llegó a correr)"
        try:
            guardado = aplicar()
            cambiados = [r for r in vigilados if r.read_bytes() != guardado.get(r, r.read_bytes())]
            esperar_a_que_cambie(cambiados, {r: antes[r] for r in cambiados})
            durante = {r: servido(r) for r in cambiados}
            veredicto = caso_185()
        finally:
            for ruta, datos in guardado.items():
                ruta.write_bytes(datos)
            if durante:
                esperar_a_que_deje(durante)
        dio = esperado(veredicto)
        print(("[ROJO ESPERADO] " if dio else "[NO DISCRIMINA] ") + veredicto[:420], flush=True)
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
