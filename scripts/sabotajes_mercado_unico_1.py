#!/usr/bin/env python3
"""Los rojos discriminantes de MERCADO-UNICO-1.

Cada negativo devuelve un archivo corregido a la base de la tarea y comprueba
que el caso 193 falle nombrando por qué:

    python3 scripts/sabotajes_mercado_unico_1.py                         # los tres
    python3 scripts/sabotajes_mercado_unico_1.py cabecera-de-la-base     # uno solo

  cabecera-de-la-base      `Header.tsx` de la base: la cabecera vuelve a
                           ofrecer «Servicios». El 193 tiene que fallar en la
                           cabecera.
  enlace-viejo-de-la-base  `navegacion.ts` de la base: la barra ya no reescribe
                           `?section=services`. El 193 tiene que fallar en la
                           URL vieja, porque abre otra cosa que el Mercado de
                           servicios.
  pie-de-la-base           `Footer.tsx` de la base: «Servicios» del pie vuelve a
                           pedir la sección vieja. El 193 tiene que fallar en el
                           pie.

Los tres archivos de la base compilan contra el resto del código de hoy: el
rojo es del comportamiento, no de una aplicación rota.

Necesita la API en 8000, el frontend de desarrollo en 5173 y la siembra demo.
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
# La base de la tarea: el último commit de PM antes de empezarla.
BASE = "c37ce91"
CABECERA = RAIZ / "src/components/Header/Header.tsx"
NAVEGACION = RAIZ / "src/navegacion/navegacion.ts"
PIE = RAIZ / "src/components/Footer/Footer.tsx"


def git(*argumentos):
    return subprocess.run(["git", *argumentos], cwd=RAIZ, capture_output=True, check=True).stdout


def caso_193():
    """La línea de [FAIL]/[PASS] del caso."""
    proceso = subprocess.run(["node", "scripts/smoke.mjs"], cwd=RAIZ, capture_output=True, text=True,
                             env={**os.environ, "SMOKE_CASOS": "193"}, timeout=600)
    return [linea for linea in proceso.stdout.splitlines()
            if linea.startswith(("[PASS] 193", "[FAIL] 193"))][:1]


def fallo_nombrando(veredicto, *textos):
    return bool(veredicto) and veredicto[0].startswith("[FAIL] 193") and all(t in veredicto[0] for t in textos)


SABOTAJES = {
    "cabecera-de-la-base": (
        CABECERA,
        lambda v: fallo_nombrando(v, "escritorio: la cabecera ofrece",
                                  '"Inicio","Mercado","Servicios","Quiénes somos","Contacto"'),
        "el 193 falla porque la cabecera ofrece Servicios",
    ),
    "enlace-viejo-de-la-base": (
        NAVEGACION,
        lambda v: fallo_nombrando(v, "la URL vieja: la barra dice «/?section=services»"),
        "el 193 falla porque la URL vieja no lleva al Mercado de servicios",
    ),
    "pie-de-la-base": (
        PIE,
        lambda v: fallo_nombrando(v, "«Servicios» del pie, desde Inicio: la barra dice"),
        "el 193 falla porque «Servicios» del pie no lleva al Mercado de servicios",
    ),
}


def main(pedidos):
    todos = True
    for nombre in pedidos:
        ruta, esperado, que = SABOTAJES[nombre]
        print(f"\n=== {nombre}: {que} ===", flush=True)
        original = ruta.read_bytes()
        antes = {ruta: servido(ruta)}
        durante = {}
        veredicto = ["(no llegó a correr)"]
        try:
            ruta.write_bytes(git("show", f"{BASE}:{ruta.relative_to(RAIZ).as_posix()}"))
            esperar_a_que_cambie([ruta], antes)
            durante = {ruta: servido(ruta)}
            veredicto = caso_193()
        finally:
            ruta.write_bytes(original)
            if durante:
                esperar_a_que_deje(durante)
        dio = esperado(veredicto)
        print(("[ROJO ESPERADO]" if dio else "[NO DISCRIMINA]"), flush=True)
        for linea in veredicto:
            print(f"  {linea[:900]}")
        todos = todos and dio
    estado = git("status", "--porcelain", "--", "src").decode().strip()
    print(f"\nsrc después: {estado or 'como estaba'}")
    print("todos dieron el rojo esperado" if todos else "ATENCION: alguno no discriminó")
    return 0 if todos else 1


if __name__ == "__main__":
    pedidos = sys.argv[1:] or list(SABOTAJES)
    desconocidos = [p for p in pedidos if p not in SABOTAJES]
    if desconocidos:
        print(f"sabotajes desconocidos: {desconocidos}; hay {list(SABOTAJES)}")
        raise SystemExit(2)
    raise SystemExit(main(pedidos))
