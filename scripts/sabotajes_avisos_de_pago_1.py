#!/usr/bin/env python3
"""Los rojos discriminantes de AVISOS-DE-PAGO-1.

    python3 scripts/sabotajes_avisos_de_pago_1.py                      # todos
    python3 scripts/sabotajes_avisos_de_pago_1.py aviso-duplicado      # uno

Cada uno rompe un solo lugar de la API, la reinicia, corre su caso y deja el
archivo como estaba, con otro reinicio. Tiene que dar rojo por su motivo, y
sólo por él.

  sin-aviso-de-rechazo      Rechazar la transferencia deja de avisar. El 211
                            tiene que echar de menos «Transferencia rechazada»,
                            en la API y en los dos anchos, y nada de la
                            aprobada.
  aviso-duplicado           El aviso de Mercado Pago sale cada vez que se
                            aplica un cobro, no sólo en la transición a
                            pagada. El 212 tiene que contar avisos de más en
                            las órdenes que se volvieron a consultar, y la
                            orden igual pagada.
  sin-aviso-de-mercado-pago El pago acreditado deja de avisar. El 212 tiene que
                            echar de menos los dos avisos en las tres órdenes.
  aviso-que-falla           Escribir el aviso de Mercado Pago falla (un
                            usuario que no existe). El pago tiene que quedar
                            igual: el 212 echa de menos los avisos y no dice que
                            alguna orden no quedó pagada.

El reinicio de la API sale de REINICIAR_API; por omisión,
`./scripts/entorno_nativo.sh --reiniciar-api`. En el entorno Docker, por
ejemplo, REINICIAR_API="docker restart topgreen-api".

Necesita la API en 8000, el frontend de desarrollo en 5173 y la siembra demo.
"""
import os
import shlex
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ORDENES = RAIZ / "backend/app/api/orders.py"
COBRO = RAIZ / "backend/app/services/cobro.py"
AVISOS = RAIZ / "backend/app/api/notifications.py"
REINICIAR_API = os.environ.get("REINICIAR_API", "./scripts/entorno_nativo.sh --reiniciar-api")

# nombre: (archivo, [(viejo, nuevo), …], caso, lo que tiene que decir, lo que no)
SABOTAJES = {
    "sin-aviso-de-rechazo": (
        ORDENES,
        [("        if order.status == OrderStatus.REJECTED:\n"
          "            notify_transfer_rejected(db, order)\n",
          "        if order.status == OrderStatus.REJECTED:\n"
          "            pass\n")],
        211,
        ["Transferencia rechazada", "escritorio: quien compra no lee «El vendedor rechazó la transferencia",
         "celular: quien compra no lee «El vendedor rechazó la transferencia"],
        ["quien vende, pedido", "Venta pagada | ", "motivo del rechazo", "HTTP", "Confirmar Pedido", "quedaron"],
    ),
    "aviso-duplicado": (
        COBRO,
        [("            db.add(orden)\n"
          "            # El aviso va con la transición y no con cada noticia: cinco\n"
          "            # avisos del mismo pago pasan por acá una sola vez, porque desde\n"
          "            # la segunda la orden ya no está «colocada».\n"
          "            notify_payment_approved(db, orden)\n",
          "            db.add(orden)\n"
          "        notify_payment_approved(db, orden)\n")],
        212,
        ["el aviso repetido, quien compra: tiene", "el aviso repetido, quien vende: tiene"],
        ["no quedó pagada", "reconciliador dijo", "no lee", "Confirmar Pedido"],
    ),
    "sin-aviso-de-mercado-pago": (
        COBRO,
        [("            notify_payment_approved(db, orden)\n",
          "            pass\n")],
        212,
        ["el aviso repetido, quien compra: tiene", "la vuelta primero, quien vende: tiene",
         "el reconciliador, quien compra: tiene", "escritorio: quien compra no lee", "celular: quien vende no lee"],
        ["no quedó pagada", "reconciliador dijo", "Confirmar Pedido"],
    ),
    "aviso-que-falla": (
        AVISOS,
        [("                user_id=order.buyer_id,\n"
          "                notification_type=NotificationType.PAYMENT_APPROVED,\n",
          "                user_id=\"00000000-0000-0000-0000-000000000000\",\n"
          "                notification_type=NotificationType.PAYMENT_APPROVED,\n")],
        212,
        ["el aviso repetido, quien compra: tiene", "el aviso repetido, quien vende: tiene",
         "el reconciliador, quien vende: tiene"],
        ["no quedó pagada", "reconciliador dijo", "Confirmar Pedido", "el primer aviso devolvió"],
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
