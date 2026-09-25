#!/usr/bin/env python3
"""Los rojos discriminantes de COPY-AGRO-1.

Cada negativo vuelve a poner «agro» donde la pieza la sacó, o donde uno solo
de los dos lados del caso 192 la puede ver, y comprueba que el caso falle
nombrándola:

    python3 scripts/sabotajes_copy_agro_1.py                   # los tres
    python3 scripts/sabotajes_copy_agro_1.py textos-de-la-base # uno solo

  textos-de-la-base   Los archivos que cambiaron, como estaban en la base. El
                      caso 192 tiene que nombrar las diez apariciones del
                      inventario en la fuente, y verlas en la pantalla:
                      pestaña y metadatos, Inicio, el pie y Quiénes somos, en
                      escritorio y en celular. La undécima estaba en la página
                      Servicios, que se retiró con MERCADO-UNICO-1.
  solo-en-la-pantalla El pie arma «agro» en tiempo de ejecución, así que la
                      fuente no la escribe. Tiene que verla la pantalla.
  solo-en-el-correo   El asunto del correo de verificación dice «agro». No hay
                      pantalla que lo muestre: tiene que verlo la fuente.

Necesita la API en 8000, el frontend de desarrollo en 5173 y la siembra demo.
El correo no necesita reiniciar la API: el caso lee el archivo, y ningún lado
del caso manda correos. Todo lo que cambia lo deja como estaba.
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
BASE = "e9cf4c6"
PORTADA = RAIZ / "src/components/Pages/HomePage.tsx"
PIE = RAIZ / "src/components/Footer/Footer.tsx"
NOSOTROS = RAIZ / "src/components/Pages/AboutPage.tsx"
CABECERA = RAIZ / "index.html"
CORREO = RAIZ / "backend/app/services/verificacion.py"

# Las diez del inventario que siguen existiendo, como las nombra la fuente.
EN_LA_FUENTE = [(f"fuente, {lugar}", "agro") for lugar in (
    "src/components/Pages/HomePage.tsx:83", "src/components/Pages/HomePage.tsx:86",
    "src/components/Footer/Footer.tsx:45",
    "src/components/Pages/AboutPage.tsx:148", "index.html:14", "index.html:16",
    "index.html:24", "index.html:25", "index.html:29", "index.html:30")]
# Y como las ve el navegador, en los dos anchos. En escritorio, Inicio las
# muestra dos veces seguidas: el margen vertical y la bajada.
EN_LA_PANTALLA = [
    (f"pantalla, {ancho}, {lugar}", texto)
    for ancho in ("escritorio 1440 px", "celular 360 px")
    for lugar, texto in (
        ("pestaña", "AgroBoeda — Mercado agro"),
        ("meta description", "mercado agro argentino"),
        ("meta og:title", "AgroBoeda — Mercado agro"),
        ("meta og:description", "mercado agro argentino"),
        ("meta twitter:title", "AgroBoeda — Mercado agro"),
        ("meta twitter:description", "mercado agro argentino"),
        ("Inicio", "Mercado agro · Argentina"),
        ("Inicio", "Mercado agro: productos, servicios y logística."),
        ("Quiénes somos", "soluciones tecnológicas para el agro"),
    )
] + [("pantalla, escritorio 1440 px, Inicio", "Mercado agro · Argentina | Mercado agro · Argentina")]


def git(*argumentos):
    return subprocess.run(["git", *argumentos], cwd=RAIZ, capture_output=True, check=True).stdout


def de_la_base(ruta):
    return git("show", f"{BASE}:{ruta.relative_to(RAIZ).as_posix()}")


def reemplazar(ruta, viejo, nuevo):
    contenido = ruta.read_bytes()
    assert contenido.count(viejo.encode()) == 1, f"{viejo!r} no está una vez en {ruta}"
    return contenido.replace(viejo.encode(), nuevo.encode())


def caso_192():
    """El bloque del caso: la línea de [FAIL]/[PASS] y lo que imprime debajo."""
    proceso = subprocess.run(["node", "scripts/smoke.mjs"], cwd=RAIZ, capture_output=True, text=True,
                             env={**os.environ, "SMOKE_CASOS": "192"}, timeout=600)
    lineas = proceso.stdout.splitlines()
    desde = next((i for i, l in enumerate(lineas) if l.startswith(("[PASS] 192", "[FAIL] 192"))), None)
    if desde is None:
        return ["(el caso no imprimió su veredicto)"] + lineas[-5:]
    hasta = next((i for i in range(desde + 1, len(lineas))
                  if lineas[i].startswith(("[PASS]", "[FAIL]", "Resumen smoke"))), len(lineas))
    return [l for l in lineas[desde:hasta] if l.strip()]


def fallo_nombrando(veredicto, esperados, prohibido=None):
    """Falló, nombró cada (lugar, texto) esperado, y ningún hallazgo empieza
    con lo prohibido: así se sabe qué lado del caso lo vio."""
    hallazgos = [l.strip() for l in veredicto[1:]]
    faltan = [f"{lugar}: {texto}" for lugar, texto in esperados
              if not any(h.startswith(lugar) and texto.lower() in h.lower() for h in hallazgos)]
    sobran = [h for h in hallazgos if prohibido and h.startswith(prohibido)]
    return (bool(veredicto) and veredicto[0].startswith("[FAIL] 192") and not faltan and not sobran,
            faltan + [f"no tenía que aparecer: {h}" for h in sobran])


SABOTAJES = {
    "textos-de-la-base": (
        lambda: {ruta: de_la_base(ruta) for ruta in (PORTADA, PIE, NOSOTROS, CABECERA)},
        lambda v: fallo_nombrando(v, EN_LA_FUENTE + EN_LA_PANTALLA),
        "el 192 nombra las diez del inventario en la fuente y las ve en la pantalla",
    ),
    "solo-en-la-pantalla": (
        lambda: {PIE: reemplazar(PIE, "Mercado agropecuario: productos",
                                 "Mercado {'ag' + 'ro'}: productos")},
        lambda v: fallo_nombrando(v, [
            (f"pantalla, {ancho}, {lugar}", "Mercado agro: productos, servicios y logística.")
            for ancho in ("escritorio 1440 px", "celular 360 px")
            for lugar in ("Inicio", "Mercado", "Quiénes somos", "Contacto")],
            prohibido="fuente,"),
        "el 192 la ve en la pantalla aunque la fuente no la escriba",
    ),
    "solo-en-el-correo": (
        lambda: {CORREO: reemplazar(CORREO, 'asunto="Confirmá tu correo en AgroBoeda"',
                                    'asunto="Confirmá tu correo en AgroBoeda, el mercado del agro"')},
        lambda v: fallo_nombrando(v, [("fuente, backend/app/services/verificacion.py:105",
                                       "el mercado del agro")], prohibido="pantalla,"),
        "el 192 la ve en la fuente de un correo que ninguna pantalla muestra",
    ),
}


def main(pedidos):
    todos = True
    for nombre in pedidos:
        aplicar, esperado, que = SABOTAJES[nombre]
        print(f"\n=== {nombre}: {que} ===", flush=True)
        nuevos = aplicar()
        originales = {ruta: ruta.read_bytes() for ruta in nuevos}
        del_frontend = [ruta for ruta in nuevos if ruta != CORREO]
        antes = {ruta: servido(ruta) for ruta in del_frontend}
        durante = {}
        veredicto = ["(no llegó a correr)"]
        try:
            for ruta, contenido in nuevos.items():
                ruta.write_bytes(contenido)
            if del_frontend:
                esperar_a_que_cambie(del_frontend, antes)
                durante = {ruta: servido(ruta) for ruta in del_frontend}
            veredicto = caso_192()
        finally:
            for ruta, contenido in originales.items():
                ruta.write_bytes(contenido)
            if durante:
                esperar_a_que_deje(durante)
        dio, faltan = esperado(veredicto)
        print(("[ROJO ESPERADO]" if dio else "[NO DISCRIMINA]"), flush=True)
        if faltan:
            print(f"  no nombró: {faltan}")
        for linea in veredicto:
            print(f"  {linea[:400]}")
        todos = todos and dio
    estado = git("status", "--porcelain", "--", "src", "backend", "index.html").decode().strip()
    print(f"\nsrc, backend e index.html después: {estado or 'como estaban'}")
    print("todos dieron el rojo esperado" if todos else "ATENCION: alguno no discriminó")
    return 0 if todos else 1


if __name__ == "__main__":
    pedidos = sys.argv[1:] or list(SABOTAJES)
    desconocidos = [p for p in pedidos if p not in SABOTAJES]
    if desconocidos:
        print(f"sabotajes desconocidos: {desconocidos}; hay {list(SABOTAJES)}")
        raise SystemExit(2)
    raise SystemExit(main(pedidos))
