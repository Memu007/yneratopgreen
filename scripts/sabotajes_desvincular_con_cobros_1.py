#!/usr/bin/env python3
"""Los rojos discriminantes de DESVINCULAR-CON-COBROS-1.

    python3 scripts/sabotajes_desvincular_con_cobros_1.py                     # todos
    python3 scripts/sabotajes_desvincular_con_cobros_1.py sin-cierre-pendiente # uno

Cada uno rompe un solo lugar, reinicia la API, corre su caso y deja el archivo
como estaba, con otro reinicio. Tiene que dar rojo por su motivo, y sólo por él.

  regla-solo-en-la-pantalla La API desvincula aunque haya cobros en curso: la
                            regla queda, a lo sumo, en lo que muestra la
                            pantalla. El 225.
  sin-cierre-pendiente      El criterio no cuenta el cierre pendiente. El 226.
  sin-link-abierto          El criterio no cuenta el pago aprobado con el link
                            abierto. El 227.
  vuelta-acepta-otra-cuenta La vuelta de Mercado Pago guarda otra cuenta con
                            cobros en curso. El 229.
  pantalla-generica         El panel vuelve a «No se pudo desvincular la
                            cuenta.». El 225.
  otro-vendedor-frena       El criterio cuenta las ventas de cualquier vendedor.
                            El 228.
  sin-aviso-en-la-confirmacion
                            La confirmación de desvincular no avisa que una
                            devolución o un contracargo posterior no se van a
                            registrar. El 225.

Los dos del criterio también le cambian lo que mira al reconciliador, que usa
el mismo: por eso el 226 y el 227 dicen además que no cerró.

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
VINCULO = RAIZ / "backend/app/services/mp_vinculo.py"
PANEL = RAIZ / "src/components/UserDashboard/UserDashboard.tsx"
REINICIAR_API = os.environ.get("REINICIAR_API", "./scripts/entorno_nativo.sh --reiniciar-api")

PANTALLA = ["la confirmación no avisa", "el panel dice", "dice «No se pudo desvincular la cuenta.»",
            "antes de vincular dice"]

# nombre: (archivo, [(viejo, nuevo), …], caso, lo que tiene que decir, lo que no)
SABOTAJES = {
    "regla-solo-en-la-pantalla": (
        VINCULO,
        [("        .where(User.id == user.id, _sin_cobros_en_curso(user))\n",
          "        .where(User.id == user.id)\n")],
        225,
        ["con dos reservadas: desvincular respondió 200 y no 409",
         "con una reservada: desvincular respondió 200 y no 409"],
        ["la confirmación no avisa", "antes de vincular dice"],
    ),
    "sin-cierre-pendiente": (
        COBRO,
        [("    reserva_viva = Order.stock_reserva.in_([stock.RESERVADA, stock.CIERRE_PENDIENTE])\n",
          "    reserva_viva = Order.stock_reserva.in_([stock.RESERVADA])\n")],
        226,
        ["en cierre pendiente: desvincular respondió 200 y no 409"],
        ["rechazar con el cierre caído"],
    ),
    "sin-link-abierto": (
        COBRO,
        [("    return (Order.payment_method == MEDIO_MERCADO_PAGO) & (reserva_viva | link_abierto)\n",
          "    return (Order.payment_method == MEDIO_MERCADO_PAGO) & reserva_viva\n")],
        227,
        ["con el link abierto: desvincular respondió 200 y no 409"],
        ["el pago no quedó aprobado con el link abierto"],
    ),
    "vuelta-acepta-otra-cuenta": (
        VINCULO,
        [("        .where(User.id == user.id, (User.mp_user_id == cuenta) | _sin_cobros_en_curso(user))\n",
          "        .where(User.id == user.id)\n")],
        229,
        ["con otra cuenta volvió con «vinculado»", "las credenciales cambiaron"],
        ["la vuelta no dice el motivo", "renovar respondió", "con la misma cuenta volvió"],
    ),
    "pantalla-generica": (
        PANEL,
        [("      if (detalle?.motivo === COBROS_EN_CURSO && typeof detalle.cobros_en_curso === 'number') {\n"
          "        setMpCobrosEnCurso(detalle.cobros_en_curso);\n"
          "      } else {\n"
          "        showToast('No se pudo desvincular la cuenta.', 'error');\n"
          "      }\n",
          "      showToast('No se pudo desvincular la cuenta.', 'error');\n")],
        225,
        ["escritorio: dice «No se pudo desvincular la cuenta.»", "escritorio, con dos: el panel dice «null»",
         "celular: dice «No se pudo desvincular la cuenta.»", "celular, con una: el panel dice «null»"],
        ["desvincular respondió", "la confirmación no avisa", "antes de vincular dice"],
    ),
    "otro-vendedor-frena": (
        COBRO,
        [("        .where(Order.seller_id == vendedor_id, en_curso())\n",
          "        .where(en_curso())\n")],
        228,
        ["con sólo ventas terminadas y una ajena reservada: desvincular respondió 409"],
        ["la otra vendedora: desvincular respondió", "la reserva quedó", "la venta ajena quedó"],
    ),
    "sin-aviso-en-la-confirmacion": (
        PANEL,
        [("        + 'Si después se devuelve un pago o hay un contracargo, AgroBoeda no se va a enterar: '\n"
          "        + 'la compra va a seguir figurando como pagada.\\n\\n'\n",
          "")],
        225,
        ["escritorio: la confirmación no avisa lo de las devoluciones",
         "celular: la confirmación no avisa lo de las devoluciones"],
        ["desvincular respondió", "el panel dice", "antes de vincular dice"],
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
