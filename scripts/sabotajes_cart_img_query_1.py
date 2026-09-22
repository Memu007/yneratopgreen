#!/usr/bin/env python3
"""Los rojos discriminantes de CART-IMG-QUERY-1.

Un caso que sólo pasa no prueba nada: hay que verlo fallar por cada defecto que
dice cuidar. Este script rompe `cart.py` de a una cosa por vez, corre el caso
180 contra la rotura y deja el árbol como estaba.

    python3 scripts/sabotajes_cart_img_query_1.py            # los tres
    python3 scripts/sabotajes_cart_img_query_1.py lectura    # uno solo

Los tres:

  lectura     `GET /cart` vuelve a preguntar la portada dentro del bucle, una
              consulta por ítem. Es el negativo que pidió PM: la regla es la
              misma, sólo cambia cuántas veces se consulta, y el conteo tiene
              que volver a crecer.
  sync        lo mismo en `POST /cart/sync`, el otro camino que arma un carrito
              entero.
  secundaria  la consulta agrupada deja de filtrar por principal: una
              secundaria pasa a ser portada. Las lecturas no cambian —sigue
              siendo una—, así que esto sólo lo caza el contraste con la base.

No toca la base: el caso fabrica y retira lo suyo.
"""
import os
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CARRITO = RAIZ / "backend/app/api/cart.py"
CASO = 180


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


def sabotaje_lectura(datos):
    """GET /cart pregunta la portada una vez por item."""
    datos = reemplazar_una(
        datos,
        "    portadas = portadas_de(db, [item.product_id for item in cart.items])\n",
        "",
    )
    return reemplazar_una(
        datos,
        "            product_image=portadas.get(item.product_id),",
        "            product_image=portadas_de(db, [item.product_id]).get(item.product_id),",
    )


def sabotaje_sync(datos):
    """POST /cart/sync pregunta la portada una vez por item."""
    datos = reemplazar_una(datos, "    portadas = portadas_de(db, orden)\n", "")
    return reemplazar_una(
        datos,
        "            product_image=portadas.get(product.id),",
        "            product_image=portadas_de(db, [product.id]).get(product.id),",
    )


def sabotaje_secundaria(datos):
    """La consulta agrupada toma cualquier imagen como portada."""
    return reemplazar_una(
        datos,
        "        ProductImage.product_id.in_(ids),\n"
        "        ProductImage.is_primary == True,\n",
        "        ProductImage.product_id.in_(ids),\n",
    )


SABOTAJES = {
    "lectura": (sabotaje_lectura, "GET /cart vuelve a consultar la portada por item"),
    "sync": (sabotaje_sync, "POST /cart/sync vuelve a consultar la portada por item"),
    "secundaria": (sabotaje_secundaria, "una secundaria puede ser portada"),
}


def reiniciar_la_api():
    subprocess.run(["./scripts/entorno_nativo.sh", "--reiniciar-api"],
                   cwd=RAIZ, capture_output=True, text=True, check=False)


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
        original = CARRITO.read_bytes()
        print(f"\n=== sabotaje «{nombre}» (caso {CASO}): {que} ===")
        try:
            CARRITO.write_bytes(romper(original))
            reiniciar_la_api()
            veredicto = correr_el_caso()
        finally:
            CARRITO.write_bytes(original)
            reiniciar_la_api()
        print(veredicto[:500])
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
