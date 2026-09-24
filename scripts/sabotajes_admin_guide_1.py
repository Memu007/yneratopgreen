#!/usr/bin/env python3
"""Los rojos discriminantes de ADMIN-GUIDE-1.

La guía del panel se comprueba con `scripts/guia-admin.mjs`. Este script
comprueba que ese control de verdad falla: cuando la guía miente y cuando el
panel cambia. Corre la guía en escritorio, que alcanza para ver el rojo.

    python3 scripts/sabotajes_admin_guide_1.py                  # todos
    python3 scripts/sabotajes_admin_guide_1.py boton-inventado  # uno solo

Los de la guía cambian una copia en una carpeta temporal; la guía de verdad no
se toca:

  boton-inventado    el paso 5 dice que hay un botón «Suspender cuenta». El
                     panel no lo tiene: tiene que fallar el paso 5,
                     nombrándolo.
  paso-10-al-reves   el cambio exacto de la PM: el paso 10 dice que la
                     publicación pausada «sigue viéndose» en vez de «deja de
                     verse». Tiene que fallar el paso 10, citando la frase.
  sesion-que-sigue   el paso 5 dice que la sesión abierta se conserva, en vez
                     de que se corta. Tiene que fallar el paso 5, citando la
                     frase.
  tres-de-la-pm      los tres cambios de la PM juntos: el del paso 10, veinte
                     cuentas por página que pasan a cincuenta, y que la
                     persona recibe un correo con cada cambio. Tienen que
                     fallar los pasos 3, 5 y 10, cada uno por su frase.
  frase-declarada    el paso 6 dice que la contraseña nueva vence a las 24
                     horas. Esa frase no la puede comprobar el recorrido: está
                     en la lista de lo que no se comprueba. Tiene que fallar
                     el paso 6, antes de abrir el navegador.

Los del panel cambian el código y lo dejan como estaba:

  panel-cambiado     el botón «Restablecer contraseña» pasa a decir «Nueva
                     contraseña». Tiene que fallar el paso 6, y el inventario
                     tiene que avisar que la pestaña «Usuarios» muestra algo
                     que la guía no nombra.
  cincuenta-por-pagina  el panel pasa a mostrar cincuenta cuentas por página.
                     Tiene que fallar el paso 3, por la frase de las veinte.

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

PASO_3 = "Paso 3. Buscar y filtrar cuentas"
PASO_5 = "Paso 5. Desactivar y volver a activar una cuenta"
PASO_6 = "Paso 6. Restablecer una contraseña"
PASO_10 = "Paso 10. Pausar una publicación"

# Los cambios de la guía, cada uno como está escrito y como queda.
BOTON_INVENTADO = ("1. En la fila de la cuenta, tocá «Desactivar».\n",
                   "1. En la fila de la cuenta, tocá «Desactivar».\n"
                   "   Si preferís, tocá «Suspender cuenta», que hace lo mismo.\n")
PASO_10_AL_REVES = ("- La publicación deja de verse en el Mercado, en las búsquedas y en su",
                    "- La publicación sigue viéndose en el Mercado, en las búsquedas y en su")
CINCUENTA = ("Muestra veinte cuentas por página.", "Muestra cincuenta cuentas por página.")
CORREO = ("Nadie recibe un aviso de lo que se cambia desde el panel.",
          "La persona recibe un correo con cada cambio que hagas desde el panel.")
SESION = ("- Si tenía la sesión abierta, se le corta.",
          "- Si tenía la sesión abierta, la conserva hasta que salga.")
VENCE = ("- La nueva no vence sola: queda hasta que se restablezca otra vez.",
         "- La nueva vence a las 24 horas: después hay que restablecerla otra vez.")


def correr_la_guia(guia=None):
    orden = ["node", "scripts/guia-admin.mjs", "--anchos", "escritorio"]
    if guia:
        orden += ["--guia", str(guia)]
    proceso = subprocess.run(orden, cwd=RAIZ, capture_output=True, text=True, timeout=900)
    return proceso.returncode, proceso.stdout


def con_la_guia_cambiada(*cambios):
    texto = GUIA.read_text(encoding="utf-8")
    for viejo, nuevo in cambios:
        assert texto.count(viejo) == 1, f"la guía ya no tiene «{viejo}» una sola vez"
        texto = texto.replace(viejo, nuevo)
    with tempfile.TemporaryDirectory() as carpeta:
        copia = Path(carpeta) / "GUIA-PANEL-ADMIN.md"
        copia.write_text(texto, encoding="utf-8")
        return correr_la_guia(copia)


def con_el_panel_cambiado(viejo, nuevo):
    original = PANEL.read_bytes()
    assert original.count(viejo.encode()) == 1, f"el panel ya no tiene «{viejo}» una sola vez"
    antes = {PANEL: servido(PANEL)}
    durante = {}
    try:
        PANEL.write_bytes(original.replace(viejo.encode(), nuevo.encode()))
        esperar_a_que_cambie([PANEL], antes)
        durante = {PANEL: servido(PANEL)}
        return correr_la_guia()
    finally:
        PANEL.write_bytes(original)
        if durante:
            esperar_a_que_deje(durante)


def fallo(salida, paso, *textos):
    """Una línea [FALLA] de ese paso dice todos esos textos."""
    return any(linea.startswith(f"[FALLA] {paso}") and all(t in linea for t in textos)
               for linea in salida.splitlines())


def boton_inventado():
    codigo, salida = con_la_guia_cambiada(BOTON_INVENTADO)
    return codigo == 1 and fallo(salida, PASO_5, "«Suspender cuenta»"), codigo, salida


def paso_10_al_reves():
    codigo, salida = con_la_guia_cambiada(PASO_10_AL_REVES)
    dio = codigo == 1 and fallo(salida, PASO_10, "ya no dice “La publicación deja de verse en el Mercado")
    return dio, codigo, salida


def sesion_que_sigue():
    codigo, salida = con_la_guia_cambiada(SESION)
    dio = codigo == 1 and fallo(salida, PASO_5, "ya no dice “Si tenía la sesión abierta, se le corta.”")
    return dio, codigo, salida


def tres_de_la_pm():
    codigo, salida = con_la_guia_cambiada(PASO_10_AL_REVES, CINCUENTA, CORREO)
    dio = (codigo == 1
           and fallo(salida, PASO_10, "ya no dice “La publicación deja de verse en el Mercado")
           and fallo(salida, PASO_3, "ya no dice “Muestra veinte cuentas por página.”")
           and fallo(salida, PASO_5, "«Antes de empezar» ya no dice “Nadie recibe un aviso")
           and fallo(salida, PASO_10, "«Antes de empezar» ya no dice “Nadie recibe un aviso"))
    return dio, codigo, salida


def frase_declarada():
    codigo, salida = con_la_guia_cambiada(VENCE)
    dio = codigo == 1 and fallo(salida, PASO_6, "no se comprueba cita “La nueva no vence sola")
    return dio, codigo, salida


def panel_cambiado():
    codigo, salida = con_el_panel_cambiado("Restablecer contraseña", "Nueva contraseña")
    dio = (codigo == 1 and fallo(salida, PASO_6, "«Restablecer contraseña»")
           and "la pestaña «Usuarios» muestra «Nueva contraseña»" in salida)
    return dio, codigo, salida


def cincuenta_por_pagina():
    codigo, salida = con_el_panel_cambiado("const FILAS_POR_PAGINA = 20;", "const FILAS_POR_PAGINA = 50;")
    dio = codigo == 1 and fallo(salida, PASO_3, "“Muestra veinte cuentas por página.”", "pide 50")
    return dio, codigo, salida


SABOTAJES = {
    "boton-inventado": (boton_inventado, "la guía nombra un botón que el panel no tiene"),
    "paso-10-al-reves": (paso_10_al_reves, "la guía dice lo contrario de lo que pasa al pausar"),
    "sesion-que-sigue": (sesion_que_sigue, "la guía dice que la sesión no se corta"),
    "tres-de-la-pm": (tres_de_la_pm, "las tres afirmaciones falsas de la PM, juntas"),
    "frase-declarada": (frase_declarada, "cambia una frase que el programa declara no comprobar"),
    "panel-cambiado": (panel_cambiado, "el panel cambia un botón que la guía nombra"),
    "cincuenta-por-pagina": (cincuenta_por_pagina, "el panel cambia cuántas cuentas muestra por página"),
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
