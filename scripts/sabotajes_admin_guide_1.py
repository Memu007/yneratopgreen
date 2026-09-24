#!/usr/bin/env python3
"""Los rojos discriminantes de ADMIN-GUIDE-1.

La guía del panel se comprueba con `scripts/guia-admin.mjs`. Este script
comprueba que ese control de verdad falla: primero la guía miente, después el
panel cambia. Corre la guía en escritorio, que alcanza para ver el rojo.

    python3 scripts/sabotajes_admin_guide_1.py                  # los dos
    python3 scripts/sabotajes_admin_guide_1.py boton-inventado  # uno solo

Los dos:

  boton-inventado  una copia de la guía dice, en el paso 5, que hay un botón
                   «Suspender cuenta». El panel no lo tiene: tiene que fallar
                   el paso 5, nombrándolo. La guía de verdad no se toca.
  panel-cambiado   el botón «Restablecer contraseña» del panel pasa a decir
                   «Nueva contraseña». Tiene que fallar el paso 6, y el
                   inventario tiene que avisar que la pestaña «Usuarios»
                   muestra algo que la guía no nombra.

Necesita la API en 8000, el frontend de desarrollo en 5173 y la siembra demo.
Todo lo que cambia lo deja como estaba.
"""
import subprocess
import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
# Esperar a que el frontend de desarrollo sirva un archivo cambiado, y a que
# deje de servirlo, es lo mismo que en las piezas anteriores.
from sabotajes_product_detail_page_1 import (  # noqa: E402
    esperar_a_que_cambie, esperar_a_que_deje, servido)

RAIZ = Path(__file__).resolve().parent.parent
GUIA = RAIZ / "docs/GUIA-PANEL-ADMIN.md"
PANEL = RAIZ / "src/components/AdminPanel/AdminPanel.tsx"
PASO_5 = "1. En la fila de la cuenta, tocá «Desactivar».\n"


def correr_la_guia(guia=None):
    orden = ["node", "scripts/guia-admin.mjs", "--anchos", "escritorio"]
    if guia:
        orden += ["--guia", str(guia)]
    proceso = subprocess.run(orden, cwd=RAIZ, capture_output=True, text=True, timeout=900)
    return proceso.returncode, proceso.stdout


def boton_inventado():
    texto = GUIA.read_text(encoding="utf-8")
    assert texto.count(PASO_5) == 1, "la guía ya no tiene el paso 5 como se esperaba"
    mentira = PASO_5 + "   Si preferís, tocá «Suspender cuenta», que hace lo mismo.\n"
    with tempfile.TemporaryDirectory() as carpeta:
        copia = Path(carpeta) / "GUIA-PANEL-ADMIN.md"
        copia.write_text(texto.replace(PASO_5, mentira), encoding="utf-8")
        codigo, salida = correr_la_guia(copia)
    dio = (codigo == 1 and "[FALLA] Paso 5. Desactivar y volver a activar una cuenta" in salida
           and "«Suspender cuenta»" in salida)
    return dio, codigo, salida


def panel_cambiado():
    original = PANEL.read_bytes()
    viejo = "Restablecer contraseña".encode()
    assert original.count(viejo) == 1, "el panel ya no tiene exactamente un «Restablecer contraseña»"
    antes = {PANEL: servido(PANEL)}
    durante = {}
    try:
        PANEL.write_bytes(original.replace(viejo, "Nueva contraseña".encode()))
        esperar_a_que_cambie([PANEL], antes)
        durante = {PANEL: servido(PANEL)}
        codigo, salida = correr_la_guia()
    finally:
        PANEL.write_bytes(original)
        if durante:
            esperar_a_que_deje(durante)
    dio = (codigo == 1 and "[FALLA] Paso 6. Restablecer una contraseña" in salida
           and "la pestaña «Usuarios» muestra «Nueva contraseña»" in salida)
    return dio, codigo, salida


SABOTAJES = {
    "boton-inventado": (boton_inventado, "la guía nombra un botón que el panel no tiene"),
    "panel-cambiado": (panel_cambiado, "el panel cambia un botón que la guía nombra"),
}


def main(pedidos):
    todos = True
    for nombre in pedidos:
        hacer, que = SABOTAJES[nombre]
        print(f"\n=== {nombre}: {que} ===", flush=True)
        dio, codigo, salida = hacer()
        fallas = [linea for linea in salida.splitlines() if linea.startswith("[FALLA]")]
        print(("[ROJO ESPERADO] " if dio else "[NO DISCRIMINA] ") + f"salida {codigo}", flush=True)
        for linea in fallas:
            print(f"  {linea[:300]}")
        todos = todos and dio
    estado = subprocess.run(["git", "status", "--porcelain", "--", "src", "docs/GUIA-PANEL-ADMIN.md"],
                            cwd=RAIZ, capture_output=True, text=True).stdout.strip()
    print(f"\nsrc y guía despues: {estado or 'como estaban'}")
    print("todos dieron el rojo esperado" if todos else "ATENCION: alguno no discriminó")
    return 0 if todos else 1


if __name__ == "__main__":
    pedidos = sys.argv[1:] or list(SABOTAJES)
    desconocidos = [p for p in pedidos if p not in SABOTAJES]
    if desconocidos:
        print(f"sabotajes desconocidos: {desconocidos}; hay {list(SABOTAJES)}")
        raise SystemExit(2)
    raise SystemExit(main(pedidos))
