#!/usr/bin/env python3
"""Los rojos discriminantes de NOTIF-TEXTOS-1.

    python3 scripts/sabotajes_notif_textos_1.py                        # todos
    python3 scripts/sabotajes_notif_textos_1.py reembolso-de-vuelta    # uno

Cada uno rompe un solo lugar, corre el caso 210 y deja el archivo como estaba.
Tiene que dar rojo por su motivo, y sólo por él.

  reembolso-de-vuelta       El rechazo vuelve a decir «El monto total será
                            reembolsado.». El 210 tiene que decir que promete
                            un reembolso, en la API y en los dos anchos.
  tuteo-de-vuelta           La venta nueva vuelve a decir «Tienes». El 210
                            tiene que decir que trata de «tú».
  aviso-de-vuelta           El envío vuelve a decir «Te avisaremos cuando
                            llegue.». El 210 tiene que decir que promete un
                            aviso que no existe.
  sin-confirmar-recepcion   «Mis Compras» deja de ofrecer «Confirmar
                            Recepción», el paso que nombra el aviso de envío.
                            El 210 tiene que decirlo, en los dos anchos.

Los tres primeros tocan la API, y la reinician antes y después. Necesita la API
en 8000, el frontend de desarrollo en 5173 y la siembra demo.
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
AVISOS = RAIZ / "backend/app/api/notifications.py"
TABLERO = RAIZ / "src/components/UserDashboard/UserDashboard.tsx"
CASO = 210

# nombre: (archivo, [(viejo, nuevo), …], lo que tiene que decir, lo que no)
SABOTAJES = {
    "reembolso-de-vuelta": (
        AVISOS,
        [('            message=f"El vendedor rechazó tu pedido #{order.order_number}.",\n',
          '            message=f"El vendedor rechazó tu pedido #{order.order_number}. El monto total será reembolsado.",\n')],
        ["API, quien compra: promete un reembolso", "escritorio: la pestaña de quien compra promete un reembolso",
         "celular: la pestaña de quien compra promete un reembolso"],
        ["«tú»", "aviso que no existe", "marketplace", "Confirmar Recepción", "cómo pagarlo", "quien vende"],
    ),
    "tuteo-de-vuelta": (
        AVISOS,
        [('        message=f"Tenés un nuevo pedido #{order.order_number} pendiente de pago.",\n',
          '        message=f"Tienes un nuevo pedido #{order.order_number} pendiente de pago.",\n')],
        ["API, quien vende: trata de «tú»", "escritorio: la pestaña de quien vende trata de «tú»",
         "celular: la pestaña de quien vende trata de «tú»"],
        ["reembolso", "aviso que no existe", "marketplace", "Confirmar Recepción", "cómo pagarlo", "quien compra"],
    ),
    "aviso-de-vuelta": (
        AVISOS,
        [('            "Cuando lo recibas, confirmá la recepción en Mis Compras."\n',
          '            "Te avisaremos cuando llegue."\n')],
        ["API, quien compra: promete un aviso que no existe",
         "escritorio: la pestaña de quien compra promete un aviso que no existe",
         "celular: la pestaña de quien compra promete un aviso que no existe"],
        ["reembolso", "«tú»", "marketplace", "Confirmar Recepción", "cómo pagarlo", "quien vende"],
    ),
    "sin-confirmar-recepcion": (
        TABLERO,
        [("                  {order.status === 'in-transit' && (\n"
          "                    <button \n"
          "                      className={styles.confirmButton}\n"
          "                      onClick={() => handleConfirmDelivery(order.id)}\n",
          "                  {false && (\n"
          "                    <button \n"
          "                      className={styles.confirmButton}\n"
          "                      onClick={() => handleConfirmDelivery(order.id)}\n")],
        ["escritorio: el pedido enviado no ofrece «Confirmar Recepción»",
         "celular: el pedido enviado no ofrece «Confirmar Recepción»"],
        ["API", "reembolso", "«tú»", "aviso que no existe", "cómo pagarlo", "no lee"],
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
    subprocess.run(["./scripts/entorno_nativo.sh", "--reiniciar-api"],
                   cwd=RAIZ, capture_output=True, text=True, check=True)


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
    ruta, cambios, deben, no_deben = SABOTAJES[nombre]
    del_frontend = ruta == TABLERO
    original = ruta.read_bytes()
    texto = original.decode("utf-8")
    for viejo, nuevo in cambios:
        texto = reemplazar(texto, viejo, nuevo)
    roto = texto.encode("utf-8")
    antes = {ruta: servido(ruta)} if del_frontend else {}
    durante = {}
    try:
        ruta.write_bytes(roto)
        if del_frontend:
            esperar_a_que_cambie([ruta], antes)
            durante = {ruta: servido(ruta)}
        else:
            reiniciar_la_api()
        veredicto = veredicto_del_caso(CASO)
    finally:
        ruta.write_bytes(original)
        if del_frontend:
            if durante:
                esperar_a_que_deje(durante)
        else:
            reiniciar_la_api()
    # Los problemas que encontró, sin el título ni el resumen del caso, que
    # nombran «reembolsos», «vos» y «avisos que no existen».
    problemas = [l for l in veredicto[1:]]
    todo = "\n".join(problemas)
    faltan = [t for t in deben if t not in todo]
    sobran = [t for t in no_deben if t in todo]
    dio = veredicto[0].startswith(f"[FAIL] {CASO}") and not faltan and not sobran
    return dio, veredicto, faltan, sobran


def main(pedidos):
    todos = True
    for nombre in pedidos:
        print(f"\n=== {nombre} ===", flush=True)
        dio, veredicto, faltan, sobran = sabotear(nombre)
        print("[ROJO ESPERADO]" if dio else "[NO DISCRIMINA]", flush=True)
        for linea in veredicto:
            print(f"  {linea[:400]}")
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
