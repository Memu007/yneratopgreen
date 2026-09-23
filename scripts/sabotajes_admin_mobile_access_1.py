#!/usr/bin/env python3
"""Los rojos discriminantes de ADMIN-MOBILE-ACCESS-1.

Un caso que sólo pasa no prueba nada: hay que verlo fallar por cada defecto que
dice cuidar. Este script rompe el CSS del panel de a una cosa por vez, corre el
caso 182 contra la rotura y deja el árbol como estaba.

    python3 scripts/sabotajes_admin_mobile_access_1.py                  # los cuatro
    python3 scripts/sabotajes_admin_mobile_access_1.py desplazamiento   # uno solo

Los cuatro:

  desplazamiento  la barra vuelve a desplazarse de costado en vez de pasar a
                  otro renglón: tres secciones quedan fuera de la vista.
  altura          las secciones pierden el alto mínimo: vuelven a medir 38 px.
  cerrar          Cerrar pierde sus 44 px en pantallas chicas.
  apretado        Cerrar vuelve a poder encogerse: al lado del título largo
                  del detalle de una orden queda en 37,7 px de ancho.

No toca la base ni la API: el frontend de desarrollo sirve el CSS nuevo, y el
script espera a que lo sirva —una condición, no un tiempo fijo— antes de
correr el caso.
"""
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
HOJA = RAIZ / "src/components/AdminPanel/AdminPanel.module.css"
SERVIDA = "http://localhost:5173/src/components/AdminPanel/AdminPanel.module.css"
CASO = 182


def bloque(texto, fin):
    """Un bloque de lineas con el terminador que use el archivo."""
    return fin.join(texto.split("\n")).encode("utf-8")


def reemplazar_una(datos, viejo, nuevo):
    """Reemplaza el bloque, con CRLF o con LF: el repositorio mezcla los dos."""
    for fin in ("\r\n", "\n"):
        objetivo = bloque(viejo, fin)
        if datos.count(objetivo) == 1:
            return datos.replace(objetivo, bloque(nuevo, fin))
    raise AssertionError(
        f"el ancla no aparece exactamente una vez con ningun terminador: {viejo[:70]!r}")


def sabotaje_desplazamiento(datos):
    return reemplazar_una(
        datos,
        "  .tabs {\n    flex-wrap: wrap;\n",
        "  .tabs {\n    /* sabotaje:desplazamiento */\n    overflow-x: auto;\n",
    )


def sabotaje_altura(datos):
    return reemplazar_una(
        datos,
        "    flex: 1 1 auto;\n    min-height: 44px;\n",
        "    flex: 1 1 auto;\n    /* sabotaje:altura */\n",
    )


def sabotaje_cerrar(datos):
    return reemplazar_una(
        datos,
        "  .closeButton {\n    width: 44px;\n    height: 44px;\n    flex-shrink: 0;\n",
        "  .closeButton {\n    /* sabotaje:cerrar */\n    flex-shrink: 0;\n",
    )


def sabotaje_apretado(datos):
    return reemplazar_una(
        datos,
        "    height: 44px;\n    flex-shrink: 0;\n",
        "    height: 44px;\n    /* sabotaje:apretado */\n",
    )


SABOTAJES = {
    "desplazamiento": (sabotaje_desplazamiento, "la barra se desplaza de costado"),
    "altura": (sabotaje_altura, "las secciones pierden el alto minimo"),
    "cerrar": (sabotaje_cerrar, "Cerrar pierde sus 44 px"),
    "apretado": (sabotaje_apretado, "Cerrar se puede encoger al lado de un titulo largo"),
}


def servida_contiene(marca):
    try:
        with urllib.request.urlopen(SERVIDA, timeout=5) as respuesta:
            return marca in respuesta.read().decode("utf-8", "replace")
    except OSError:
        return False


def esperar_a_que_sirva(marca, presente):
    """Hasta que el frontend sirva (o deje de servir) la marca del sabotaje."""
    for _ in range(100):
        if servida_contiene(marca) == presente:
            return
        time.sleep(0.2)
    raise SystemExit(f"el frontend no {'tomo' if presente else 'solto'} «{marca}» en 20 s")


def correr_el_caso():
    proceso = subprocess.run(
        ["node", "scripts/smoke.mjs"],
        cwd=RAIZ, env={**os.environ, "SMOKE_CASOS": str(CASO)},
        capture_output=True, text=True,
    )
    for linea in proceso.stdout.splitlines():
        if linea.startswith("[PASS]") or linea.startswith("[FAIL]"):
            return linea
    return f"(sin veredicto; salida: {proceso.stdout[-300:]})"


def main(pedidos):
    fallaron_todos = True
    for nombre in pedidos:
        romper, que = SABOTAJES[nombre]
        marca = f"sabotaje:{nombre}"
        original = HOJA.read_bytes()
        print(f"\n=== sabotaje «{nombre}» (caso {CASO}): {que} ===")
        try:
            HOJA.write_bytes(romper(original))
            esperar_a_que_sirva(marca, True)
            veredicto = correr_el_caso()
        finally:
            HOJA.write_bytes(original)
            esperar_a_que_sirva(marca, False)
        print(veredicto[:400])
        if not veredicto.startswith("[FAIL]"):
            fallaron_todos = False
            print(f"  !! el caso {CASO} NO cazo el sabotaje «{nombre}»")
    print("\n" + ("todos los sabotajes dieron rojo" if fallaron_todos
                  else "ATENCION: algun sabotaje paso sin rojo"))
    return 0 if fallaron_todos else 1


if __name__ == "__main__":
    pedidos = sys.argv[1:] or list(SABOTAJES)
    desconocidos = [p for p in pedidos if p not in SABOTAJES]
    if desconocidos:
        print(f"sabotajes desconocidos: {desconocidos}; hay {list(SABOTAJES)}")
        raise SystemExit(2)
    raise SystemExit(main(pedidos))
