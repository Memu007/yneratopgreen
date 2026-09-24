#!/usr/bin/env python3
"""Los rojos discriminantes de LOCALITY-DEDUP-1.

Cada localidad se ofrece una vez, las homónimas llevan su departamento y lo
guardado sobre una entidad anidada sigue valiendo. Este script rompe una cosa
por vez, corre el caso 188 y comprueba que falle por lo que corresponde.

    python3 scripts/sabotajes_locality_dedup_1.py                       # los cuatro
    python3 scripts/sabotajes_locality_dedup_1.py codigo-de-la-base     # uno solo

Los cuatro:

  codigo-de-la-base        catálogo y selectores vuelven a la base de la tarea.
                           El caso tiene que fallar nombrando un par repetido:
                           «Mar del Plata» (Buenos Aires) dos veces. Es el
                           negativo que pidió PM.
  filtro-sin-anidadas      el filtro por localidad vuelve a mirar sólo el
                           identificador pedido. La publicación guardada en la
                           «Mar del Plata» anidada no aparece al filtrar por
                           Mar del Plata.
  editor-sin-absorber      el editor de la publicación vuelve a buscar lo
                           guardado sólo entre las opciones. Lo guardado en
                           la anidada no está entre ellas y el selector queda
                           vacío.
  rotulo-sin-departamento  el filtro del Mercado vuelve a mostrar sólo el
                           nombre. Las cuatro «San Pedro» de Santiago del
                           Estero no se distinguen.

Necesita la API en 8000, el frontend de desarrollo en 5173 y la siembra demo.
Cuando rompe el catálogo reinicia la API, antes y después. No toca la base:
la publicación del caso la crea y la retira el propio caso. Todo lo que
cambia lo deja como estaba.
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
CATALOGO = RAIZ / "backend/app/api/catalog.py"
SERVICIO = RAIZ / "src/utils/catalogService.ts"
FILTROS = RAIZ / "src/components/FilterSidebar/FilterSidebar.tsx"
PANEL = RAIZ / "src/components/UserDashboard/UserDashboard.tsx"
REGISTRO = RAIZ / "src/components/Auth/RegisterModal.tsx"
CHECKOUT = RAIZ / "src/components/Checkout/CheckoutModal.tsx"
ALTA = RAIZ / "src/components/AddProduct/AddProductModal.tsx"
FRONT = [SERVICIO, FILTROS, PANEL, REGISTRO, CHECKOUT, ALTA]
# La base de la tarea: el commit de PM que la asignó.
BASE = "c6e0f4a"


def git(*argumentos):
    return subprocess.run(["git", *argumentos], cwd=RAIZ, capture_output=True, check=True).stdout


def cambiar(ruta, viejo, nuevo):
    """Un reemplazo de una sola línea, a nivel de bytes: los archivos mezclan
    finales de línea y no se tocan los que no son del sabotaje."""
    def aplicar():
        original = ruta.read_bytes()
        assert original.count(viejo) == 1, f"{ruta.name} ya no tiene exactamente una vez: {viejo[:70]!r}"
        ruta.write_bytes(original.replace(viejo, nuevo))
        return {ruta: original}
    return aplicar


def codigo_de_la_base():
    guardado = {}
    for ruta in [CATALOGO, *FRONT]:
        guardado[ruta] = ruta.read_bytes()
        ruta.write_bytes(git("show", f"{BASE}:{ruta.relative_to(RAIZ).as_posix()}"))
    return guardado


SABOTAJES = {
    "codigo-de-la-base": (
        codigo_de_la_base,
        lambda v: v.startswith("[FAIL]") and "«Mar del Plata» (Buenos Aires) aparece 2 veces" in v,
        "falla nombrando «Mar del Plata» (Buenos Aires) repetida",
    ),
    "filtro-sin-anidadas": (
        cambiar(CATALOGO,
                b"query = query.filter(Product.locality_id.in_(padron.ids_del_filtro(db, locality_id)))",
                b"query = query.filter(Product.locality_id == locality_id)"),
        lambda v: v.startswith("[FAIL]") and "no trae la publicación guardada en 0635711003" in v,
        "falla porque filtrar por Mar del Plata no trae lo guardado en la anidada",
    ),
    "editor-sin-absorber": (
        cambiar(PANEL,
                b"value={opcionDeLocalidad(localidadesDeLaEdicion, editingProduct.locality_id)}",
                b"value={editingProduct.locality_id}"),
        lambda v: v.startswith("[FAIL]") and "el editor muestra la localidad" in v,
        "falla porque el editor no muestra Mar del Plata",
    ),
    "rotulo-sin-departamento": (
        cambiar(FILTROS, b"{locality.label}", b"{locality.name}"),
        lambda v: v.startswith("[FAIL]") and "el filtro del Mercado: Santiago del Estero ofrece" in v,
        "falla porque las cuatro «San Pedro» no dicen su departamento",
    ),
}


def caso_188():
    proceso = subprocess.run(
        ["node", "scripts/smoke.mjs"], cwd=RAIZ, capture_output=True, text=True,
        env={**os.environ, "SMOKE_CASOS": "188"}, timeout=600,
    )
    for linea in proceso.stdout.splitlines():
        if linea.startswith("[PASS]") or linea.startswith("[FAIL]"):
            return linea
    return f"(sin veredicto; salida: {proceso.stdout[-300:]})"


def reiniciar_la_api():
    subprocess.run(["./scripts/entorno_nativo.sh", "--reiniciar-api"],
                   cwd=RAIZ, capture_output=True, text=True, check=True)


def main(pedidos):
    todos = True
    for nombre in pedidos:
        aplicar, esperado, que = SABOTAJES[nombre]
        print(f"\n=== {nombre}: {que} ===", flush=True)
        antes = {r: servido(r) for r in FRONT}
        guardado, durante = {}, {}
        veredicto = "(el caso no llegó a correr)"
        try:
            guardado = aplicar()
            if CATALOGO in guardado:
                reiniciar_la_api()
            cambiados = [r for r in FRONT if r in guardado and r.read_bytes() != guardado[r]]
            if cambiados:
                esperar_a_que_cambie(cambiados, {r: antes[r] for r in cambiados})
                durante = {r: servido(r) for r in cambiados}
            veredicto = caso_188()
        finally:
            for ruta, datos in guardado.items():
                ruta.write_bytes(datos)
            if CATALOGO in guardado:
                reiniciar_la_api()
            if durante:
                esperar_a_que_deje(durante)
        dio = esperado(veredicto)
        print(("[ROJO ESPERADO] " if dio else "[NO DISCRIMINA] ") + veredicto[:600], flush=True)
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
