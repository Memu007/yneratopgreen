#!/usr/bin/env python3
"""Los tres rojos discriminantes de BRAND-FACET-1, aplicados y revertidos.

Un caso que sólo pasa no prueba nada: hay que verlo fallar por cada defecto
que dice cuidar. Este script rompe el producto de a una cosa por vez, corre el
caso 175 contra la rotura y deja el árbol como estaba.

    python3 scripts/sabotajes_brand_facet_1.py            # los tres
    python3 scripts/sabotajes_brand_facet_1.py conteo     # uno solo

Los tres sabotajes son los que pidió PM:

  conteo   el filtro de marca se aplica DESPUÉS de contar, así que el total y
           las páginas siguen siendo las del conjunto sin filtrar;
  faceta   la faceta se calcula DESPUÉS de aplicar la marca, así que elegir una
           borra a las demás de la lista;
  barra    la marca no se escribe en la URL, así que no se comparte, no vuelve
           con Atrás y no sobrevive a una recarga.

No toca la base ni el entorno: sólo tres archivos versionados, y los restaura
en un `finally`. Si algo lo interrumpe, `git checkout -- <archivos>` alcanza.
"""
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CATALOGO = RAIZ / "backend/app/api/catalog.py"
FILTROS = RAIZ / "src/hooks/useProductFilters.ts"


def leer(ruta):
    return ruta.read_bytes()


def escribir(ruta, datos):
    ruta.write_bytes(datos)


def reemplazar_una(datos, viejo, nuevo):
    """Reemplaza conservando el terminador de linea de cada linea tocada."""
    assert datos.count(viejo) == 1, f"el ancla aparece {datos.count(viejo)} veces: {viejo[:60]!r}"
    return datos.replace(viejo, nuevo)


def sabotaje_conteo(datos):
    """El filtro de marca entra despues de contar."""
    aplicar = (
        b"    if brand:\r\n"
        b"        query = query.filter(Product.brand == brand)\r\n"
    )
    datos = reemplazar_una(datos, aplicar, b"")
    return reemplazar_una(
        datos,
        b"    total = query.count()\r\n",
        b"    total = query.count()\r\n"
        b"    if brand:\r\n"
        b"        query = query.filter(Product.brand == brand)\r\n",
    )


def sabotaje_faceta(datos):
    """La faceta se calcula DESPUES de aplicar la marca.

    Es una sola reubicacion: el filtro de marca sube por encima del conteo de
    la faceta. Sin marca elegida la faceta queda igual -por eso el rojo no lo
    da la primera comprobacion-, y con una marca elegida la lista se reduce a
    esa sola, que es el defecto: ya no se puede cambiar de marca sin limpiar.
    """
    aplicar = (
        b"    if brand:\r\n"
        b"        query = query.filter(Product.brand == brand)\r\n"
    )
    datos = reemplazar_una(datos, aplicar, b"")
    return reemplazar_una(
        datos,
        b"    marcas_contadas = dict(\r\n",
        aplicar + b"    marcas_contadas = dict(\r\n",
    )


def sabotaje_barra(datos):
    """La marca no se escribe en la URL."""
    linea = b"    updateParam('brand', marca || null);"
    for fin in (b"\r\n", b"\n"):
        if datos.count(linea + fin) == 1:
            return datos.replace(linea + fin, b"")
    raise AssertionError("no se encontro la escritura de `brand` en la barra")


SABOTAJES = {
    "conteo": (CATALOGO, sabotaje_conteo,
               "el filtro de marca se aplica DESPUES de contar"),
    "faceta": (CATALOGO, sabotaje_faceta,
               "la faceta se calcula DESPUES de aplicar la marca"),
    "barra": (FILTROS, sabotaje_barra,
              "la marca no se escribe en la URL"),
}


def correr_el_caso():
    proceso = subprocess.run(
        ["node", "scripts/smoke.mjs"],
        cwd=RAIZ, env={**__import__("os").environ, "SMOKE_CASOS": "175"},
        capture_output=True, text=True,
    )
    for linea in proceso.stdout.splitlines():
        if linea.startswith("[PASS]") or linea.startswith("[FAIL]"):
            return linea
    return f"(sin veredicto; salida: {proceso.stdout[-300:]})"


def reiniciar_la_api():
    subprocess.run(["./scripts/entorno_nativo.sh", "--reiniciar-api"],
                   cwd=RAIZ, capture_output=True, text=True, check=False)


def main(pedidos):
    fallaron_todos = True
    for nombre in pedidos:
        ruta, romper, que = SABOTAJES[nombre]
        original = leer(ruta)
        print(f"\n=== sabotaje «{nombre}»: {que} ===")
        try:
            escribir(ruta, romper(original))
            if ruta == CATALOGO:
                reiniciar_la_api()
            veredicto = correr_el_caso()
        finally:
            escribir(ruta, original)
            if ruta == CATALOGO:
                reiniciar_la_api()
        print(veredicto[:400])
        if not veredicto.startswith("[FAIL]"):
            fallaron_todos = False
            print(f"  !! el caso 175 NO cazo el sabotaje «{nombre}»")
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
