#!/usr/bin/env python3
"""Los rojos discriminantes de ADMIN-PANEL-DEFECTS-1.

Cada negativo devuelve un archivo corregido a la base de la tarea y comprueba
que falle lo que lo vigila, nombrando por qué:

    python3 scripts/sabotajes_admin_panel_defects_1.py                        # los seis
    python3 scripts/sabotajes_admin_panel_defects_1.py p1-endpoint-de-la-base # uno solo

  p1-endpoint-de-la-base    `backend/app/api/products.py` de la base. El caso
                            190 tiene que fallar y nombrar los caminos
                            abiertos, empezando por el PATCH que la reactiva.
  detalle-de-la-base        `backend/app/api/admin.py` de la base: el detalle
                            de la orden vuelve a salir sin artículos, correo,
                            dirección ni montos. La guía tiene que fallar en
                            el paso 14.
  panel-de-la-base          `AdminPanel.tsx` de la base: el aviso de «Agotada»
                            vuelve a decir que sigue visible y el error de la
                            cuenta propia vuelve a ser genérico. La guía tiene
                            que fallar en los pasos 8, 12 y 13.
  mis-publicaciones-de-la-base  `UserDashboard.tsx` de la base: quien vende
                            vuelve a ver «Activo» una agotada. La guía tiene
                            que fallar en el paso 12.
  tabla-de-la-base          `AdminPanel.module.css` de la base: la tabla de
                            artículos del detalle no entra en el celular. La
                            guía, en celular, tiene que fallar en el paso 14.
  checkout-de-la-base       `backend/app/services/checkout.py` de la base: el
                            checkout vuelve a vender lo que no está activo.
                            El caso 191 tiene que fallar y nombrar el estado
                            que dejó pasar.

Necesita la API en 8000, el frontend de desarrollo en 5173 y la siembra demo.
Cuando toca el backend reinicia la API, antes y después. Todo lo que cambia lo
deja como estaba.
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
# La base de la tarea: el commit de PM que la asignó.
BASE = "ad5f07d"
PRODUCTOS = RAIZ / "backend/app/api/products.py"
ADMIN = RAIZ / "backend/app/api/admin.py"
PANEL = RAIZ / "src/components/AdminPanel/AdminPanel.tsx"
MIS_PUBLICACIONES = RAIZ / "src/components/UserDashboard/UserDashboard.tsx"
ESTILOS = RAIZ / "src/components/AdminPanel/AdminPanel.module.css"
CHECKOUT = RAIZ / "backend/app/services/checkout.py"
BACK = {PRODUCTOS, ADMIN, CHECKOUT}

PASO_8 = "Paso 8. Lo que no se puede hacer con tu propia cuenta"
PASO_12 = "Paso 12. Marcarla como agotada"
PASO_13 = "Paso 13. Eliminar una publicación"
PASO_14 = "Paso 14. Mirar una orden"


def git(*argumentos):
    return subprocess.run(["git", *argumentos], cwd=RAIZ, capture_output=True, check=True).stdout


def un_caso(numero):
    proceso = subprocess.run(["node", "scripts/smoke.mjs"], cwd=RAIZ, capture_output=True, text=True,
                             env={**os.environ, "SMOKE_CASOS": str(numero)}, timeout=600)
    return [linea for linea in proceso.stdout.splitlines() if linea.startswith(("[PASS]", "[FAIL]"))][:1]


def caso_190():
    return un_caso(190)


def la_guia(ancho="escritorio"):
    proceso = subprocess.run(["node", "scripts/guia-admin.mjs", "--anchos", ancho], cwd=RAIZ,
                             capture_output=True, text=True, timeout=900)
    return [linea for linea in proceso.stdout.splitlines() if linea.startswith("[FALLA]")]


def fallo(lineas, paso, *textos):
    return any(linea.startswith(f"[FALLA] {paso}") and all(t in linea for t in textos) for linea in lineas)


SABOTAJES = {
    "p1-endpoint-de-la-base": (
        PRODUCTOS, caso_190,
        lambda v: (bool(v) and v[0].startswith("[FAIL] 190")
                   and 'PATCH {"status":"active"} respondió 200' in v[0]),
        "el caso 190 falla y nombra el PATCH que reactiva",
    ),
    "detalle-de-la-base": (
        ADMIN, la_guia,
        lambda v: (fallo(v, PASO_14, "el detalle no dice el correo de quien compra")
                   or fallo(v, PASO_14, "el correo y la dirección de entrega")),
        "la guía falla en el paso 14",
    ),
    "panel-de-la-base": (
        PANEL, la_guia,
        lambda v: (fallo(v, PASO_8, "«No puedes desactivar tu propia cuenta»")
                   and fallo(v, PASO_12, "«Deja de aparecer en el catálogo y su enlace no abre")
                   and fallo(v, PASO_13, "Quien vende ya no la ve ni la puede volver a activar")),
        "la guía falla en los pasos 8, 12 y 13",
    ),
    "mis-publicaciones-de-la-base": (
        MIS_PUBLICACIONES, la_guia,
        lambda v: fallo(v, PASO_12, "“Quien vende la ve en «Mis publicaciones» como «Agotado».”"),
        "la guía falla en el paso 12, por lo que ve quien vende",
    ),
    "tabla-de-la-base": (
        ESTILOS, lambda: la_guia("celular"),
        lambda v: fallo(v, PASO_14, "“En el celular el detalle se lee de arriba abajo, sin desplazarse de costado.”"),
        "la guía, en celular, falla en el paso 14 porque el detalle se desplaza de costado",
    ),
    "checkout-de-la-base": (
        CHECKOUT, lambda: un_caso(191),
        lambda v: (bool(v) and v[0].startswith("[FAIL] 191")
                   and "deleted por /orders/checkout/transfer respondió 200" in v[0]),
        "el caso 191 falla y nombra el estado que el checkout dejó pasar",
    ),
}


def reiniciar_la_api():
    subprocess.run(["./scripts/entorno_nativo.sh", "--reiniciar-api"],
                   cwd=RAIZ, capture_output=True, text=True, check=True)


def main(pedidos):
    todos = True
    for nombre in pedidos:
        ruta, correr, esperado, que = SABOTAJES[nombre]
        print(f"\n=== {nombre}: {que} ===", flush=True)
        original = ruta.read_bytes()
        del_frontend = ruta not in BACK
        antes = {ruta: servido(ruta)} if del_frontend else {}
        durante = {}
        veredicto = ["(no llegó a correr)"]
        try:
            ruta.write_bytes(git("show", f"{BASE}:{ruta.relative_to(RAIZ).as_posix()}"))
            if del_frontend:
                esperar_a_que_cambie([ruta], antes)
                durante = {ruta: servido(ruta)}
            else:
                reiniciar_la_api()
            veredicto = correr()
        finally:
            ruta.write_bytes(original)
            if del_frontend:
                if durante:
                    esperar_a_que_deje(durante)
            else:
                reiniciar_la_api()
        dio = esperado(veredicto)
        print(("[ROJO ESPERADO]" if dio else "[NO DISCRIMINA]"), flush=True)
        for linea in veredicto:
            print(f"  {linea[:400]}")
        todos = todos and dio
    estado = git("status", "--porcelain", "--", "src", "backend").decode().strip()
    print(f"\nsrc y backend despues: {estado or 'como estaban'}")
    print("todos dieron el rojo esperado" if todos else "ATENCION: alguno no discriminó")
    return 0 if todos else 1


if __name__ == "__main__":
    pedidos = sys.argv[1:] or list(SABOTAJES)
    desconocidos = [p for p in pedidos if p not in SABOTAJES]
    if desconocidos:
        print(f"sabotajes desconocidos: {desconocidos}; hay {list(SABOTAJES)}")
        raise SystemExit(2)
    raise SystemExit(main(pedidos))
