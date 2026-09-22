#!/usr/bin/env python3
"""Los rojos discriminantes de CART-PRODUCT-QUERY-1.

Un caso que sólo pasa no prueba nada: hay que verlo fallar por cada defecto que
dice cuidar. Este script rompe `cart.py` de a una cosa por vez, corre el caso
181 contra la rotura y deja el árbol como estaba.

    python3 scripts/sabotajes_cart_product_query_1.py            # los tres
    python3 scripts/sabotajes_cart_product_query_1.py lectura    # uno solo

Los tres:

  lectura     `GET /cart` vuelve a recorrer `cart.items` y a tocar
              `item.product` ítem por ítem: una lectura de `products` por
              línea. Es uno de los dos negativos que pidió PM.
  sync        la primera pasada del sync vuelve a buscar cada publicación con
              su propia consulta. Es el otro.
  creacion    el sync toma nombre y precio DESPUÉS de obtener el carrito. Si
              no existía, el commit que lo crea vence las publicaciones y cada
              una se vuelve a leer. Sólo se ve en el camino que crea el
              carrito, que es el que el 181 agrega.

No toca la base: el caso fabrica y retira lo suyo.
"""
import os
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CARRITO = RAIZ / "backend/app/api/cart.py"
CASO = 181


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
    """GET /cart lee cada publicacion por separado."""
    return reemplazar_una(
        datos,
        "    items = db.query(CartItem).options(selectinload(CartItem.product)).filter(\n"
        "        CartItem.cart_id == cart.id\n"
        "    ).all()\n",
        "    items = cart.items\n",
    )


def sabotaje_sync(datos):
    """La primera pasada del sync consulta cada publicacion por separado."""
    datos = reemplazar_una(
        datos,
        "    pedidas = {item_data.product_id for item_data in sync_data.items}\n"
        "    publicaciones = {\n"
        "        producto.id: producto\n"
        "        for producto in db.query(Product).filter(Product.id.in_(pedidas))\n"
        "    } if pedidas else {}\n",
        "",
    )
    return reemplazar_una(
        datos,
        "        product = publicaciones.get(item_data.product_id)\n",
        "        product = db.query(Product).filter(Product.id == item_data.product_id).first()\n",
    )


def sabotaje_creacion(datos):
    """El sync toma nombre y precio despues del commit que crea el carrito."""
    lineas = (
        "    lineas = [\n"
        "        (product_id, efectivos[product_id][\"producto\"].name,\n"
        "         efectivos[product_id][\"producto\"].price, efectivos[product_id][\"cantidad\"])\n"
        "        for product_id in orden\n"
        "    ]\n"
    )
    carrito = "    cart = get_or_create_cart(db, current_user.id)\n\n    db.query(CartItem)"
    datos = reemplazar_una(datos, lineas + carrito, carrito.replace("\n\n    db.query", "\n" + lineas + "\n    db.query"))
    return datos


SABOTAJES = {
    "lectura": (sabotaje_lectura, "GET /cart vuelve a leer cada publicacion por separado"),
    "sync": (sabotaje_sync, "el sync vuelve a consultar cada publicacion por separado"),
    "creacion": (sabotaje_creacion, "el sync relee cada publicacion despues de crear el carrito"),
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
