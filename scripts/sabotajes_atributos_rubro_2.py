#!/usr/bin/env python3
"""Los rojos discriminantes de ATRIBUTOS-RUBRO-1, parte 2.

Cada negativo rompe una pieza de una manera y comprueba que su caso falle por
ESE motivo:

    python3 scripts/sabotajes_atributos_rubro_2.py                  # los seis
    python3 scripts/sabotajes_atributos_rubro_2.py acepta-nulos     # uno solo

El filtro de año y de origen (caso 200):

  despues-de-contar     El servidor los aplica DESPUÉS de contar: la lista sale
                        bien y el total no.
  en-el-navegador       El servidor los ignora y el Mercado filtra la página
                        que bajó: la pantalla cuenta otra cosa que la base.
  acepta-nulos          El servidor suma las publicaciones que no declararon el
                        año o el origen.

Los tres P2:

  marca-sin-limpiar     `limpiarFormulario` no suelta la marca (caso 202).
  falta-en-la-barra     Falta `condition` en PARAMETROS_DEL_MERCADO (caso 203).
  mas-filtros-escondido «Más filtros» arranca plegado y no dice cuántos tiene
                        puestos (caso 204).

Necesita la API en 8000, el frontend de desarrollo en 5173 y la siembra demo.
Los que tocan el backend reinician la API antes y después, con el comando de
REINICIAR_API (por omisión, `./scripts/entorno_nativo.sh --reiniciar-api`).
Todo lo que cambia lo deja como estaba.
"""
import os
import shlex
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from sabotajes_product_detail_page_1 import (  # noqa: E402
    esperar_a_que_cambie, esperar_a_que_deje, servido)

RAIZ = Path(__file__).resolve().parent.parent
CATALOGO = RAIZ / "backend/app/api/catalog.py"
APP = RAIZ / "src/App.tsx"
ALTA = RAIZ / "src/components/AddProduct/AddProductModal.tsx"
POLITICA = RAIZ / "src/navegacion/politica.ts"
PANEL = RAIZ / "src/components/FilterSidebar/FilterSidebar.tsx"
REINICIAR_API = os.environ.get("REINICIAR_API", "./scripts/entorno_nativo.sh --reiniciar-api")
SALUD = os.environ.get("API_SALUD", "http://localhost:8000/api/health")

# Los dos filtros, tal como están en el catálogo.
FILTROS = """    if year_from is not None:
        query = query.filter(Product.year >= year_from)
    if year_to is not None:
        query = query.filter(Product.year <= year_to)
    if origin:
        query = query.filter(Product.origin == origin)
"""
CONTAR = "    total = query.count()\n"


def reemplazar(ruta, pares):
    """Aplica los reemplazos respetando el final de línea de cada zona."""
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


def despues_de_contar():
    return {CATALOGO: reemplazar(CATALOGO, [(FILTROS, ""), (CONTAR, CONTAR + "\n" + FILTROS)])}


def en_el_navegador():
    return {
        CATALOGO: reemplazar(CATALOGO, [(FILTROS, "")]),
        APP: reemplazar(APP, [(
            "        setProducts(response.items.map(convertBackendProductToFrontend));\n",
            "        setProducts(response.items.map(convertBackendProductToFrontend)\n"
            "          .filter((p) => anioDesde === null || (p.year != null && p.year >= anioDesde))\n"
            "          .filter((p) => anioHasta === null || (p.year != null && p.year <= anioHasta))\n"
            "          .filter((p) => !origen || p.origin === origen));\n",
        )]),
    }


def acepta_nulos():
    return {CATALOGO: reemplazar(CATALOGO, [
        ("        query = query.filter(Product.year >= year_from)\n",
         "        query = query.filter(or_(Product.year >= year_from, Product.year.is_(None)))\n"),
        ("        query = query.filter(Product.year <= year_to)\n",
         "        query = query.filter(or_(Product.year <= year_to, Product.year.is_(None)))\n"),
        ("        query = query.filter(Product.origin == origin)\n",
         "        query = query.filter(or_(Product.origin == origin, Product.origin.is_(None)))\n"),
    ])}


def marca_sin_limpiar():
    return {ALTA: reemplazar(ALTA, [("    setBrand('');\n", "")])}


def falta_en_la_barra():
    return {POLITICA: reemplazar(POLITICA, [("  'condition',\n", "")])}


def mas_filtros_escondido():
    return {PANEL: reemplazar(PANEL, [
        ("useState(activosEnMas > 0)", "useState(false)"),
        ("{activosEnMas > 0 && (", "{false && ("),
    ])}


SABOTAJES = {
    "despues-de-contar": (despues_de_contar, 200,
                          ["API, año desde 2010: el total dice", "API, origen «dueño directo»: el total dice"],
                          ["que no declararon"],
                          "el 200 dice que el total de la API no es el de la base"),
    "en-el-navegador": (en_el_navegador, 200,
                        ["pantalla, desde 2010: dice"], [],
                        "el 200 dice que la pantalla cuenta otra cosa que la base"),
    "acepta-nulos": (acepta_nulos, 200,
                     ["API, año desde 2010: trajo", "API, origen «dueño directo»: trajo"], [],
                     "el 200 dice que el filtro trajo las que no declararon el dato"),
    "marca-sin-limpiar": (marca_sin_limpiar, 202,
                          ["marca «john-deere»"], ["modelo «", "origen «"],
                          "el 202 dice que el alta siguiente abrió con la marca de la anterior"),
    "falta-en-la-barra": (falta_en_la_barra, 203,
                          ["tras «Mercado»: sacó condition de la barra"], ["sacó brand", "sacó sort"],
                          "el 203 nombra el parámetro que «Mercado» sacó de la barra"),
    "mas-filtros-escondido": (mas_filtros_escondido, 204,
                              ["al recargar arranca plegado", "esconde dos filtros"], [],
                              "el 204 dice que «Más filtros» esconde filtros puestos"),
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
                             env={**os.environ, "SMOKE_CASOS": str(numero)}, timeout=1200)
    lineas = proceso.stdout.splitlines()
    desde = next((i for i, l in enumerate(lineas)
                  if l.startswith((f"[PASS] {numero}", f"[FAIL] {numero}"))), None)
    if desde is None:
        return ["(el caso no imprimió su veredicto)"] + lineas[-5:]
    hasta = next((i for i in range(desde + 1, len(lineas))
                  if lineas[i].startswith(("[PASS]", "[FAIL]", "Resumen smoke"))), len(lineas))
    return [l for l in lineas[desde:hasta] if l.strip()]


def main(pedidos):
    todos = True
    for nombre in pedidos:
        aplicar, numero, deben, no_deben, que = SABOTAJES[nombre]
        print(f"\n=== {nombre}: {que} ===", flush=True)
        nuevos = aplicar()
        originales = {ruta: ruta.read_bytes() for ruta in nuevos}
        del_backend = any(ruta.suffix == ".py" for ruta in nuevos)
        del_frontend = [ruta for ruta in nuevos if ruta.suffix in (".tsx", ".ts")]
        antes = {ruta: servido(ruta) for ruta in del_frontend}
        durante = {}
        veredicto = ["(no llegó a correr)"]
        try:
            for ruta, contenido in nuevos.items():
                ruta.write_bytes(contenido)
            if del_backend:
                reiniciar_la_api()
            if del_frontend:
                esperar_a_que_cambie(del_frontend, antes)
                durante = {ruta: servido(ruta) for ruta in del_frontend}
            veredicto = correr_el_caso(numero)
        finally:
            for ruta, contenido in originales.items():
                ruta.write_bytes(contenido)
            if del_backend:
                reiniciar_la_api()
            if durante:
                esperar_a_que_deje(durante)
        todo = "\n".join(veredicto)
        faltan = [t for t in deben if t not in todo]
        sobran = [t for t in no_deben if t in todo]
        dio = veredicto[0].startswith(f"[FAIL] {numero}") and not faltan and not sobran
        print("[ROJO ESPERADO]" if dio else "[NO DISCRIMINA]", flush=True)
        if faltan:
            print(f"  no dijo: {faltan}")
        if sobran:
            print(f"  dijo lo que no correspondía: {sobran}")
        for linea in veredicto:
            print(f"  {linea[:300]}")
        todos = todos and dio
    estado = subprocess.run(["git", "status", "--porcelain", "--", "src", "backend"], cwd=RAIZ,
                            capture_output=True, text=True, check=True).stdout.strip()
    print(f"\nsrc y backend después: {estado or 'como estaban'}")
    print("todos dieron el rojo esperado" if todos else "ATENCION: alguno no discriminó")
    return 0 if todos else 1


if __name__ == "__main__":
    pedidos = sys.argv[1:] or list(SABOTAJES)
    desconocidos = [p for p in pedidos if p not in SABOTAJES]
    if desconocidos:
        print(f"sabotajes desconocidos: {desconocidos}; hay {list(SABOTAJES)}")
        raise SystemExit(2)
    raise SystemExit(main(pedidos))
