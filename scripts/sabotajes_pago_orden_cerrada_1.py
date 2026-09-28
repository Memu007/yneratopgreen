#!/usr/bin/env python3
"""Los rojos discriminantes de PAGO-ORDEN-CERRADA-1.

    python3 scripts/sabotajes_pago_orden_cerrada_1.py                       # todos
    python3 scripts/sabotajes_pago_orden_cerrada_1.py aviso-dos-veces       # uno

Cada uno rompe un solo lugar, reinicia la API, corre su caso y deja el archivo
como estaba, con otro reinicio. Tiene que dar rojo por su motivo, y sólo por él.

  orden-cerrada-dice-pago-aprobado
                            El pago a una orden cerrada avisa «Pago aprobado» y
                            «Venta pagada» en vez de su aviso. El 220.
  api-dice-mas-de-un-pago   La API vuelve a decir «en revisión» para la orden
                            cerrada. El 220: las dos partes, la vuelta y el
                            panel dicen «más de un pago».
  panel-dice-mas-de-un-pago El panel muestra, para la orden cerrada, el texto de
                            «más de un pago». El 220, sólo en el panel.
  vuelta-dice-mas-de-un-pago
                            La pantalla de vuelta de Mercado Pago dice «Hay más
                            de un pago» para la orden cerrada. El 220, sólo ahí.
  aviso-dos-veces           Los avisos de un pago a revisar salen cada vez que
                            se aplica el pago. El 220 y el 221 los cuentan de
                            más; acá corre el 220.
  sin-aviso-de-mas-de-un-pago
                            Dos cobros dejan de avisar. El 221.
  aviso-que-falla           Escribir el aviso de la orden cerrada falla (un
                            usuario que no existe). El 220 echa de menos los
                            avisos, y la orden igual queda pagada y en revisión.
  reconciliador-reintenta   El reconciliador vuelve a reintentar apagar el link
                            en el mismo barrido, con la publicación tomada. El
                            222: la otra compra no se confirma y la API se
                            cuelga.

El reinicio de la API sale de REINICIAR_API; por omisión,
`./scripts/entorno_nativo.sh --reiniciar-api`. Los sabotajes de pantalla los
toma el servidor de desarrollo de Vite solo.

Necesita la API en 8000, el frontend de desarrollo en 5173 y la siembra demo.
"""
import os
import shlex
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
COBRO = RAIZ / "backend/app/services/cobro.py"
AVISOS = RAIZ / "backend/app/api/notifications.py"
RECONCILIADOR = RAIZ / "backend/app/reconciliar.py"
PANEL = RAIZ / "src/components/UserDashboard/UserDashboard.tsx"
VUELTA = RAIZ / "src/components/Pages/PaymentResultPage.tsx"
REINICIAR_API = os.environ.get("REINICIAR_API", "./scripts/entorno_nativo.sh --reiniciar-api")

ESTADO = ["la orden quedó", "la reserva quedó", "la intención quedó", "el stock se volvió a tomar"]

# nombre: (archivo, [(viejo, nuevo), …], caso, lo que tiene que decir, lo que no)
SABOTAJES = {
    "orden-cerrada-dice-pago-aprobado": (
        COBRO,
        [("            notify_payment_on_closed_order(db, orden)\n",
          "            notify_payment_approved(db, orden)\n")],
        220,
        ["tiene 0 veces el aviso del pago en un pedido cerrado", "además tiene", "Pago aprobado |", "Venta pagada |"],
        ESTADO + ["ve «en_revision»", "dice «más de un pago»"],
    ),
    "api-dice-mas-de-un-pago": (
        COBRO,
        [("        if orden.stock_reserva == stock.LIBERADA:\n"
          "            return VISIBLE_PAGO_TRAS_CIERRE\n",
          "")],
        220,
        ["la vuelta dijo «en_revision»", "quien compra ve «en_revision»", "quien vende ve «en_revision»",
         "Mis Compras: dice «más de un pago»", "Mis Ventas: dice «más de un pago»",
         "la vuelta de Mercado Pago dice «más de un pago»"],
        ESTADO + ["veces el aviso"],
    ),
    "panel-dice-mas-de-un-pago": (
        PANEL,
        [("      'Mercado Pago acreditó un pago cuando esta orden ya estaba cerrada. La '\n",
          "      'Mercado Pago registró más de un pago aprobado para esta orden. La '\n")],
        220,
        ["escritorio, Mis Compras: dice «más de un pago»", "celular, Mis Ventas: dice «más de un pago»"],
        ESTADO + ["veces el aviso", "ve «en_revision»", "la vuelta de Mercado Pago"],
    ),
    "vuelta-dice-mas-de-un-pago": (
        VUELTA,
        [("    titulo: 'Tu pago llegó con la orden ya cerrada',\n",
          "    titulo: 'Hay más de un pago para esta orden',\n")],
        220,
        ["la vuelta de Mercado Pago no dice «Tu pago llegó con la orden ya cerrada»"],
        ESTADO + ["veces el aviso", "ve «en_revision»", "Mis Compras: dice", "Mis Ventas: dice"],
    ),
    "aviso-dos-veces": (
        AVISOS,
        [("            if ya is not None:\n                return\n",
          "            if ya is not None and False:\n                return\n")],
        220,
        ["quien compra: tiene 3 veces el aviso del pago en un pedido cerrado",
         "quien vende: tiene 3 veces el aviso del pago en un pedido cerrado"],
        ESTADO + ["ve «en_revision»", "dice «más de un pago»", "Pago aprobado |"],
    ),
    "sin-aviso-de-mas-de-un-pago": (
        COBRO,
        [("            notify_payment_approved(db, orden)\n"
          "        # Más de un pago: quien vende tiene que devolver el de más, y las dos\n"
          "        # partes se enteran. Una vez por orden, lo decide el aviso ya escrito.\n"
          "        if resumen == PaymentStatus.EN_REVISION:\n"
          "            notify_payment_duplicated(db, orden)\n",
          "            notify_payment_approved(db, orden)\n")],
        221,
        ["quien compra: tiene 0 veces el aviso de más de un pago", "quien vende: tiene 0 veces el aviso de más de un pago"],
        ["ve «", "el stock se descontó", "avisos del primer pago", "orden cerrada"],
    ),
    "aviso-que-falla": (
        AVISOS,
        [("            for user_id, title, message in avisos:\n"
          "                create_notification(\n"
          "                    db=db,\n"
          "                    user_id=user_id,\n",
          "            for user_id, title, message in avisos:\n"
          "                create_notification(\n"
          "                    db=db,\n"
          "                    user_id=\"00000000-0000-0000-0000-000000000000\",\n")],
        220,
        ["quien compra: tiene 0 veces el aviso del pago en un pedido cerrado",
         "quien vende: tiene 0 veces el aviso del pago en un pedido cerrado"],
        ESTADO + ["ve «en_revision»", "dice «más de un pago»", "el aviso respondió", "Pago aprobado |"],
    ),
    "reconciliador-reintenta": (
        RECONCILIADOR,
        [("        # en la API esperaba esa fila frenando el proceso, hasta 15 s.\n"
          "        db.commit()\n"
          "        return COBRADA\n",
          "        # en la API esperaba esa fila frenando el proceso, hasta 15 s.\n"
          "        from app.models.user import User\n"
          "        from app.services import mp_preferencia, mp_vinculo\n"
          "        pago = mp_preferencia.pago_de(db, orden)\n"
          "        if pago is not None and not pago.link_cerrado:\n"
          "            vendedor = db.query(User).filter(User.id == orden.seller_id).first()\n"
          "            token = mp_vinculo.access_token_de(db, vendedor) if vendedor else None\n"
          "            await cobro.apagar_link(db, orden, pago, token)\n"
          "        db.commit()\n"
          "        return COBRADA\n")],
        222,
        ["el reconciliador intentó apagar el link 2 veces en el mismo barrido",
         "la API dejó de responder", "la otra compra de la publicación no se confirmó"],
        ["la cobrada no quedó pagada", "el barrido siguiente no apagó"],
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
