#!/usr/bin/env python3
"""Los rojos discriminantes de LINK-ABIERTO-DEVUELTO-1.

    python3 scripts/sabotajes_link_abierto_devuelto_1.py                        # todos
    python3 scripts/sabotajes_link_abierto_devuelto_1.py reconciliador-cambia-el-estado

Cada uno rompe un solo lugar, reinicia la API, corre su caso y deja el archivo
como estaba, con otro reinicio. Tiene que dar rojo por su motivo, y sólo por él.

  criterio-sin-los-estados-nuevos
                            El link abierto vuelve a mirar sólo el pago aprobado
                            y el que está en revisión. El 231: desvincular pasa
                            y el reconciliador no apaga los links.
  reconciliador-cambia-el-estado
                            El reconciliador, al apagar el link de un pago con
                            cobro, lo deja aprobado. El 231: el pago devuelto y
                            el del contracargo cambian de estado.

El reinicio de la API sale de REINICIAR_API; por omisión,
`./scripts/entorno_nativo.sh --reiniciar-api`.

Necesita la API en 8000, el frontend de desarrollo en 5173 y la siembra demo.
"""
import os
import shlex
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
COBRO = RAIZ / "backend/app/services/cobro.py"
RECONCILIADOR = RAIZ / "backend/app/reconciliar.py"
REINICIAR_API = os.environ.get("REINICIAR_API", "./scripts/entorno_nativo.sh --reiniciar-api")

# nombre: (archivo, [(viejo, nuevo), …], caso, lo que tiene que decir, lo que no)
SABOTAJES = {
    "criterio-sin-los-estados-nuevos": (
        COBRO,
        [("    link_abierto = Payment.link_cerrado.is_(False) & Payment.status.in_(CON_COBRO)\n",
          "    link_abierto = Payment.link_cerrado.is_(False) & Payment.status.in_(\n"
          "        [PaymentStatus.APPROVED, PaymentStatus.EN_REVISION]\n"
          "    )\n")],
        231,
        ["con los dos links abiertos: desvincular respondió 200 y no 409",
         "devolución: el reconciliador no apagó el link", "contracargo: el reconciliador no apagó el link"],
        ["cambió:", "el stock se movió", "no quedó"],
    ),
    "reconciliador-cambia-el-estado": (
        RECONCILIADOR,
        [("        db.commit()\n        return COBRADA\n    if cobro.hay_intento_en_curso(db, orden):\n",
          "        pago = cobro.mp_preferencia.pago_de(db, orden)\n"
          "        pago.status = type(pago.status).APPROVED\n"
          "        db.commit()\n        return COBRADA\n    if cobro.hay_intento_en_curso(db, orden):\n")],
        231,
        ["devolución: pago cambió: REFUNDED → APPROVED", "contracargo: pago cambió: CHARGED_BACK → APPROVED"],
        ["desvincular respondió", "no apagó el link", "el stock se movió", "no quedó"],
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
