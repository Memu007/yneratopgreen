#!/usr/bin/env python3
"""Los rojos discriminantes de COBRO-CONCURRENTE-1.

    python3 scripts/sabotajes_cobro_concurrente_1.py                    # todos
    python3 scripts/sabotajes_cobro_concurrente_1.py aviso-sin-espera   # uno

Cada uno rompe un solo lugar de la API, la reinicia, corre su caso y deja el
archivo como estaba, con otro reinicio. Tiene que dar rojo por su motivo, y
sólo por él. Si la API queda colgada, el caso la destraba antes de irse.

  aviso-sin-espera          El aviso de Mercado Pago vuelve a esperar la fila
                            de la orden con el bloqueo síncrono. El 213 tiene
                            que ver la API sin responder.
  aviso-contra-el-reconciliador
                            Lo mismo, contra el reconciliador que sostiene la
                            fila. El 216 tiene que ver la API sin responder.
  vuelta-sin-espera         La vuelta de quien compra, igual. El 214.
  cancelar-sin-espera       «Cancelar» (POST /cancel), igual. El 215, en la
                            escena en la que llega mientras el aviso espera.
  rechazar-sin-espera       «Rechazar» por estado (PATCH /status), igual. El
                            215, en la escena en la que llega mientras la vuelta
                            espera.
  link-con-la-fila-suelta   La fila de la orden se suelta antes de apagar el
                            link. El 214 tiene que verla suelta mientras se
                            apaga.
  stock-tomado-en-la-espera Se vuelve al orden de antes: primero se consolida el
                            stock y después se espera a Mercado Pago. El 218
                            tiene que ver que otra compra de la misma
                            publicación no se confirma y la API se cuelga.
  intencion-vieja           Después de tomar la fila no se relee la intención
                            de pago. El 214 tiene que contar el link apagado más
                            de una vez.
  orden-vieja               La fila se toma sin releer la orden. El 214 tiene
                            que contar avisos de pago de más.
  sin-tope                  La espera tiene un tope de una hora, que es no tener
                            tope. El 217 tiene que ver que los que esperan pasan
                            el tope y no reciben lo que se puede reintentar.
  editar-sin-espera         Editar la publicación vuelve al bloqueo síncrono.
                            El 218, en su segunda parte.
  subir-foto-sin-espera     Subir fotos, igual. El 218.
  borrar-foto-sin-espera    Borrar una foto, igual. El 218.
  documentacion-sin-espera  Presentar la documentación, igual. El 218, en su
                            tercera parte.
  inventario-ve-el-bloqueo  Editar la publicación vuelve al bloqueo síncrono, y
                            el inventario por código lo tiene que nombrar. El
                            219.

El reinicio de la API sale de REINICIAR_API; por omisión,
`./scripts/entorno_nativo.sh --reiniciar-api`. En el entorno Docker, por
ejemplo, REINICIAR_API="docker restart topgreen-api". El mismo valor usa el
caso para reiniciarla si no la pudo destrabar desde la base.

Necesita la API en 8000, el frontend de desarrollo en 5173 y la siembra demo.
"""
import os
import shlex
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
COBRO = RAIZ / "backend/app/services/cobro.py"
CANDADO = RAIZ / "backend/app/services/candado.py"
ORDENES = RAIZ / "backend/app/api/orders.py"
PUBLICACIONES = RAIZ / "backend/app/api/products.py"
DOCUMENTACION = RAIZ / "backend/app/api/documentacion.py"
REINICIAR_API = os.environ.get("REINICIAR_API", "./scripts/entorno_nativo.sh --reiniciar-api")

CONGELADA = "la API dejó de responder"

# El bloqueo de antes, para devolverle a un camino la espera que frena.
ORDEN_SINCRONICA = (
    "    db.query(Order).filter(Order.id == orden.id).with_for_update().first()\n"
    "    db.refresh(pago)\n"
)

# nombre: (archivo, [(viejo, nuevo), …], caso, lo que tiene que decir, lo que no)
SABOTAJES = {
    "aviso-sin-espera": (
        COBRO,
        [("    # cancelación y reconciliación no se pisan sobre la misma compra.\n"
          "    await _tomar_la_orden(db, orden, pago)\n",
          "    # cancelación y reconciliación no se pisan sobre la misma compra.\n"
          + ORDEN_SINCRONICA)],
        213,
        ["con una confirmación esperando a Mercado Pago, " + CONGELADA],
        ["no quedó pagada", "respondieron"],
    ),
    "aviso-contra-el-reconciliador": (
        COBRO,
        [("    # cancelación y reconciliación no se pisan sobre la misma compra.\n"
          "    await _tomar_la_orden(db, orden, pago)\n",
          "    # cancelación y reconciliación no se pisan sobre la misma compra.\n"
          + ORDEN_SINCRONICA)],
        216,
        ["con el reconciliador sosteniendo la fila, " + CONGELADA, "el catálogo respondió nada en 2 s"],
        ["el aviso respondió", "cerró una orden", "no terminó"],
    ),
    "vuelta-sin-espera": (
        COBRO,
        [("    )\n\n    await _tomar_la_orden(db, orden, pago)\n\n    hubo = False\n",
          "    )\n\n" + ORDEN_SINCRONICA + "\n    hubo = False\n")],
        214,
        [CONGELADA + " durante la ráfaga"],
        ["la fila de la orden estaba suelta", "el link se apagó"],
    ),
    "cancelar-sin-espera": (
        ORDENES,
        [("    # cancelaciones simultáneas no dejen estados incompatibles.\n"
          "    order = await _tomar_la_orden(db, order_id)\n",
          "    # cancelaciones simultáneas no dejen estados incompatibles.\n"
          "    order = db.query(Order).filter(\n"
          "        (Order.id == order_id) | (Order.order_number == order_id)\n"
          "    ).with_for_update().first()\n")],
        215,
        ["el aviso, y llega «Rechazar» (la cancelación de quien vende): " + CONGELADA],
        ["«Cancelar» de quien compra, y llega el aviso:", "«Rechazar» de quien vende, y llega la vuelta:",
         "la vuelta, y llega «Rechazar» por estado:"],
    ),
    "rechazar-sin-espera": (
        ORDENES,
        [("    # Pago y con el reconciliador sobre la misma orden.\n"
          "    order = await _tomar_la_orden(db, order_id)\n",
          "    # Pago y con el reconciliador sobre la misma orden.\n"
          "    order = db.query(Order).filter(\n"
          "        (Order.id == order_id) | (Order.order_number == order_id)\n"
          "    ).with_for_update().first()\n")],
        215,
        ["la vuelta, y llega «Rechazar» por estado: " + CONGELADA],
        ["«Cancelar» de quien compra, y llega el aviso:", "«Rechazar» de quien vende, y llega la vuelta:",
         "la cancelación de quien vende):"],
    ),
    "link-con-la-fila-suelta": (
        COBRO,
        [("    if hay_cobro(db, orden):\n"
          "        await apagar_link(db, orden, pago, token)\n"
          "    return aplicar(db, orden, pago)\n",
          "    if hay_cobro(db, orden):\n"
          "        db.commit()\n"
          "        await apagar_link(db, orden, pago, token)\n"
          "    return aplicar(db, orden, pago)\n")],
        214,
        ["mientras se apagaba el link, la fila de la orden estaba suelta"],
        [CONGELADA],
    ),
    "stock-tomado-en-la-espera": (
        COBRO,
        [("    if hay_cobro(db, orden):\n"
          "        await apagar_link(db, orden, pago, token)\n"
          "    return aplicar(db, orden, pago)\n",
          "    resumen = aplicar(db, orden, pago)\n"
          "    if hay_cobro(db, orden):\n"
          "        await apagar_link(db, orden, pago, token)\n"
          "    return resumen\n")],
        218,
        ["la segunda compra de la misma publicación no se confirmó mientras la primera esperaba",
         "la fila de la publicación estaba tomada", "con la primera compra esperando a Mercado Pago, " + CONGELADA],
        ["editar la publicación", "subirle una foto", "presentarla de nuevo"],
    ),
    "intencion-vieja": (
        COBRO,
        [("    await candado.tomar(db, db.query(Order).filter(Order.id == orden.id))\n"
          "    db.refresh(pago)\n",
          "    await candado.tomar(db, db.query(Order).filter(Order.id == orden.id))\n")],
        214,
        ["el link se apagó"],
        [CONGELADA, "la fila de la orden estaba suelta", "los avisos de pago son", "el stock pasó"],
    ),
    "orden-vieja": (
        CANDADO,
        [("                return consulta.with_for_update(nowait=True).populate_existing().first()\n",
          "                return consulta.with_for_update(nowait=True).first()\n")],
        214,
        ["los avisos de pago son"],
        [CONGELADA, "la fila de la orden estaba suelta", "el stock pasó", "lo reservado pasó"],
    ),
    "sin-tope": (
        CANDADO,
        [("SEGUNDOS_DE_TOPE = 10.0\n", "SEGUNDOS_DE_TOPE = 3600.0\n")],
        217,
        ["más que el tope de 10000 ms", "el aviso respondió 200 repetido: tenía que ser 503"],
        [CONGELADA, "no esperaron el tope"],
    ),
    "editar-sin-espera": (
        PUBLICACIONES,
        [("    product = await _tomar_la_publicacion(db, product_id)\n",
          "    product = db.query(Product).filter(Product.id == product_id).with_for_update().first()\n")],
        218,
        ["con la publicación tomada por otro proceso, editar la publicación congeló la API"],
        ["subirle una foto congeló", "borrarle una foto congeló", "segunda compra", "presentarla de nuevo"],
    ),
    "subir-foto-sin-espera": (
        PUBLICACIONES,
        [("    # un 500 en la cara de quien sube una foto.\n"
          "    await _tomar_la_publicacion(db, product_id)\n",
          "    # un 500 en la cara de quien sube una foto.\n"
          "    db.query(Product).filter(Product.id == product_id).with_for_update().first()\n")],
        218,
        ["con la publicación tomada por otro proceso, subirle una foto congeló la API"],
        ["editar la publicación congeló", "borrarle una foto congeló", "segunda compra", "presentarla de nuevo"],
    ),
    "borrar-foto-sin-espera": (
        PUBLICACIONES,
        [("    # un solo acto sobre las imagenes de esta publicacion.\n"
          "    await _tomar_la_publicacion(db, product_id)\n",
          "    # un solo acto sobre las imagenes de esta publicacion.\n"
          "    db.query(Product).filter(Product.id == product_id).with_for_update().first()\n")],
        218,
        ["con la publicación tomada por otro proceso, borrarle una foto congeló la API"],
        ["editar la publicación congeló", "subirle una foto congeló", "segunda compra", "presentarla de nuevo"],
    ),
    "documentacion-sin-espera": (
        DOCUMENTACION,
        [("        documentacion = await candado.tomar(\n"
          "            db,\n"
          "            db.query(DocumentacionDeVendedor)\n"
          "            .filter(DocumentacionDeVendedor.user_id == current_user.id),\n"
          "        )\n",
          "        documentacion = (\n"
          "            db.query(DocumentacionDeVendedor)\n"
          "            .filter(DocumentacionDeVendedor.user_id == current_user.id)\n"
          "            .with_for_update()\n"
          "            .first()\n"
          "        )\n")],
        218,
        ["con la documentación tomada por otro proceso, presentarla de nuevo congeló la API"],
        ["editar la publicación", "subirle una foto", "borrarle una foto", "segunda compra"],
    ),
    "inventario-ve-el-bloqueo": (
        PUBLICACIONES,
        [("    product = await _tomar_la_publicacion(db, product_id)\n",
          "    product = db.query(Product).filter(Product.id == product_id).with_for_update().first()\n")],
        219,
        ["1 lugar(es) esperan la fila con el bloqueo que frena la API", "api/products.py:", "async update_product"],
        ["api/orders.py", "services/cobro.py", "api/documentacion.py"],
    ),
}


def reemplazar(texto, viejo, nuevo):
    """Una sola vez, con el final de línea que tenga la zona."""
    for fin in ("\r\n", "\n"):
        v, n = viejo.replace("\n", fin), nuevo.replace("\n", fin)
        if texto.count(v) == 1:
            return texto.replace(v, n)
    raise AssertionError(f"no encontré «{viejo[:70]}»")


def reiniciar_la_api():
    subprocess.run(shlex.split(REINICIAR_API), cwd=RAIZ, capture_output=True, text=True, check=True)


def veredicto_del_caso(numero):
    proceso = subprocess.run(["node", "scripts/smoke.mjs"], cwd=RAIZ, capture_output=True, text=True,
                             env={**os.environ, "SMOKE_CASOS": str(numero)}, timeout=1500)
    lineas = proceso.stdout.splitlines()
    desde = next((i for i, l in enumerate(lineas)
                  if l.startswith((f"[PASS] {numero}", f"[FAIL] {numero}"))), None)
    if desde is None:
        return ["(el caso no imprimió su veredicto)"] + lineas[-5:]
    hasta = next((i for i in range(desde + 1, len(lineas))
                  if lineas[i].startswith(("[PASS]", "[FAIL]", "Resumen smoke"))), len(lineas))
    return [l for l in lineas[desde:hasta] if l.strip()]


def sabotear(nombre):
    ruta, cambios, caso, deben, no_deben = SABOTAJES[nombre]
    original = ruta.read_bytes()
    texto = original.decode("utf-8")
    for viejo, nuevo in cambios:
        texto = reemplazar(texto, viejo, nuevo)
    try:
        ruta.write_bytes(texto.encode("utf-8"))
        reiniciar_la_api()
        veredicto = veredicto_del_caso(caso)
    finally:
        ruta.write_bytes(original)
        reiniciar_la_api()
    # Los problemas que encontró, sin el título del caso.
    todo = "\n".join([veredicto[0].split(" — ", 1)[-1], *veredicto[1:]])
    faltan = [t for t in deben if t not in todo]
    sobran = [t for t in no_deben if t in todo]
    dio = veredicto[0].startswith(f"[FAIL] {caso}") and not faltan and not sobran
    return dio, veredicto, faltan, sobran


def main(pedidos):
    todos = True
    for nombre in pedidos:
        print(f"\n=== {nombre} ===", flush=True)
        dio, veredicto, faltan, sobran = sabotear(nombre)
        print("[ROJO ESPERADO]" if dio else "[NO DISCRIMINA]", flush=True)
        for linea in veredicto:
            print(f"  {linea[:500]}")
        if faltan:
            print(f"  (faltó que dijera: {faltan})")
        if sobran:
            print(f"  (dijo algo de otro motivo: {sobran})")
        todos = todos and dio
    estado = subprocess.run(["git", "status", "--porcelain", "--", "src", "backend"],
                            cwd=RAIZ, capture_output=True, text=True, check=True).stdout.strip()
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
