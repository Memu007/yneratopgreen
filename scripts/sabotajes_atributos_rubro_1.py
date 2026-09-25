#!/usr/bin/env python3
"""Los rojos discriminantes de ATRIBUTOS-RUBRO-1, parte 1.

Cada negativo rompe el filtro de tipo y potencia de una de las tres formas
que la PM pidió probar, y comprueba que el caso 195 falle por ESE motivo:

    python3 scripts/sabotajes_atributos_rubro_1.py                  # los tres
    python3 scripts/sabotajes_atributos_rubro_1.py acepta-nulos     # uno solo

  despues-de-contar  El servidor aplica los dos filtros DESPUÉS de contar. La
                     lista sale bien y el total no: el 195 tiene que decir que
                     el total de la API no es el de la base.
  en-el-navegador    El servidor ignora los dos filtros y el Mercado filtra la
                     página que bajó. El 195 tiene que decir que la PANTALLA
                     cuenta otra cosa que la base.
  acepta-nulos       El servidor suma las publicaciones que no declararon el
                     dato. El 195 tiene que decir que el filtro trajo las que
                     no lo declararon.

Necesita la API en 8000, el frontend de desarrollo en 5173 y la siembra demo.
Reinicia la API antes y después de cada negativo. Todo lo que cambia lo deja
como estaba.
"""
import os
import subprocess
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from sabotajes_product_detail_page_1 import (  # noqa: E402
    esperar_a_que_cambie, esperar_a_que_deje, servido)

RAIZ = Path(__file__).resolve().parent.parent
CATALOGO = RAIZ / "backend/app/api/catalog.py"
APP = RAIZ / "src/App.tsx"

# El bloque de los dos filtros, tal como está en el catálogo.
FILTROS = """    if subcategory_type:
        tipos_pedidos = db.query(SubcategoryType.id).filter(
            SubcategoryType.slug == subcategory_type
        )
        if subcategory:
            tipos_pedidos = tipos_pedidos.filter(SubcategoryType.subcategory_id == subcategory)
        query = query.filter(Product.subcategory_type_id.in_(tipos_pedidos))

    if power_range:
        desde, hasta = tipos.rango(power_range)
        if desde is not None:
            query = query.filter(Product.power_hp >= desde)
        if hasta is not None:
            query = query.filter(Product.power_hp <= hasta)
"""
CONTAR = "    total = query.count()\n"


def con_fin(texto, fin):
    return texto.replace("\n", fin)


def reemplazar(ruta, pares):
    """Aplica los reemplazos respetando el final de línea del archivo."""
    datos = ruta.read_bytes().decode("utf-8")
    fin = "\r\n" if datos.count("\r\n") > datos.count("\n") / 2 else "\n"
    for viejo, nuevo in pares:
        v, n = con_fin(viejo, fin), con_fin(nuevo, fin)
        if datos.count(v) != 1:
            # Archivo mixto: se prueba con el otro final.
            v, n = viejo, nuevo
        assert datos.count(v) == 1, f"{ruta.name}: no encontré «{viejo[:60]}»"
        datos = datos.replace(v, n)
    return datos.encode("utf-8")


def despues_de_contar():
    return {CATALOGO: reemplazar(CATALOGO, [(FILTROS, ""), (CONTAR, CONTAR + "\n" + FILTROS)])}


def en_el_navegador():
    return {
        CATALOGO: reemplazar(CATALOGO, [(FILTROS, "")]),
        APP: reemplazar(APP, [(
            "        setProducts(response.items.map(convertBackendProductToFrontend));\n",
            "        setProducts(response.items.map(convertBackendProductToFrontend)\n"
            "          .filter((p) => !tipo || p.subcategoryType?.value === tipo)\n"
            "          .filter((p) => !potencia || (p.powerHp != null && (potencia === 'compacto'\n"
            "            ? p.powerHp < 60 : potencia === 'estandar' ? p.powerHp >= 60 && p.powerHp <= 120\n"
            "              : p.powerHp > 120))));\n",
        )]),
    }


def acepta_nulos():
    return {CATALOGO: reemplazar(CATALOGO, [
        ("        query = query.filter(Product.subcategory_type_id.in_(tipos_pedidos))\n",
         "        query = query.filter(or_(Product.subcategory_type_id.in_(tipos_pedidos),\n"
         "                                 Product.subcategory_type_id.is_(None)))\n"),
        ("            query = query.filter(Product.power_hp >= desde)\n",
         "            query = query.filter(or_(Product.power_hp >= desde, Product.power_hp.is_(None)))\n"),
        ("            query = query.filter(Product.power_hp <= hasta)\n",
         "            query = query.filter(or_(Product.power_hp <= hasta, Product.power_hp.is_(None)))\n"),
    ])}


SABOTAJES = {
    "despues-de-contar": (
        despues_de_contar,
        ["API, tipo «arados»: el total dice", "API, potencia «estandar»: el total dice"],
        ["que no declararon"],
        "el 195 dice que el total de la API no es el de la base",
    ),
    "en-el-navegador": (
        en_el_navegador,
        ["pantalla, con «Arados»: dice", "pantalla, con potencia «Estándar»: dice"],
        [],
        "el 195 dice que la pantalla cuenta otra cosa que la base",
    ),
    "acepta-nulos": (
        acepta_nulos,
        ["API, tipo «arados»: trajo", "API, potencia «compacto»: trajo"],
        [],
        "el 195 dice que el filtro trajo las que no declararon el dato",
    ),
}


def git(*argumentos):
    return subprocess.run(["git", *argumentos], cwd=RAIZ, capture_output=True, check=True).stdout


def reiniciar_la_api():
    subprocess.run(["./scripts/entorno_nativo.sh", "--reiniciar-api"],
                   cwd=RAIZ, capture_output=True, text=True, check=True)


def caso_195():
    """El bloque del caso: la línea de [FAIL]/[PASS] y lo que imprime debajo."""
    proceso = subprocess.run(["node", "scripts/smoke.mjs"], cwd=RAIZ, capture_output=True, text=True,
                             env={**os.environ, "SMOKE_CASOS": "195"}, timeout=900)
    lineas = proceso.stdout.splitlines()
    desde = next((i for i, l in enumerate(lineas) if l.startswith(("[PASS] 195", "[FAIL] 195"))), None)
    if desde is None:
        return ["(el caso no imprimió su veredicto)"] + lineas[-5:]
    hasta = next((i for i in range(desde + 1, len(lineas))
                  if lineas[i].startswith(("[PASS]", "[FAIL]", "Resumen smoke"))), len(lineas))
    return [l for l in lineas[desde:hasta] if l.strip()]


def main(pedidos):
    todos = True
    for nombre in pedidos:
        aplicar, deben, no_deben, que = SABOTAJES[nombre]
        print(f"\n=== {nombre}: {que} ===", flush=True)
        nuevos = aplicar()
        originales = {ruta: ruta.read_bytes() for ruta in nuevos}
        del_frontend = [ruta for ruta in nuevos if ruta.suffix in (".tsx", ".ts")]
        antes = {ruta: servido(ruta) for ruta in del_frontend}
        durante = {}
        veredicto = ["(no llegó a correr)"]
        try:
            for ruta, contenido in nuevos.items():
                ruta.write_bytes(contenido)
            reiniciar_la_api()
            if del_frontend:
                esperar_a_que_cambie(del_frontend, antes)
                durante = {ruta: servido(ruta) for ruta in del_frontend}
            veredicto = caso_195()
        finally:
            for ruta, contenido in originales.items():
                ruta.write_bytes(contenido)
            reiniciar_la_api()
            if durante:
                esperar_a_que_deje(durante)
        todo = "\n".join(veredicto)
        faltan = [t for t in deben if t not in todo]
        sobran = [t for t in no_deben if t in todo]
        dio = veredicto[0].startswith("[FAIL] 195") and not faltan and not sobran
        print(("[ROJO ESPERADO]" if dio else "[NO DISCRIMINA]"), flush=True)
        if faltan:
            print(f"  no dijo: {faltan}")
        if sobran:
            print(f"  dijo lo que no correspondía: {sobran}")
        for linea in veredicto:
            print(f"  {linea[:300]}")
        todos = todos and dio
    estado = git("status", "--porcelain", "--", "src", "backend").decode().strip()
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
