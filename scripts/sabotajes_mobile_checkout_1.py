#!/usr/bin/env python3
"""Los rojos discriminantes de MOBILE-CHECKOUT-1.

El checkout en celular no puede dejar nada fuera de su capa, y la auditoría
móvil tiene que llegar al medio de pago eligiendo cómo se traslada cada
pedido. Este script rompe una cosa por vez y comprueba que el rojo sea el que
corresponde.

    python3 scripts/sabotajes_mobile_checkout_1.py                        # los tres
    python3 scripts/sabotajes_mobile_checkout_1.py recorte-original       # uno solo

Los tres:

  recorte-original      el CSS del checkout vuelve a la base de la tarea. El
                        caso 184 tiene que fallar por el recorte a 360 px, y
                        la auditoría tiene que contarlo como recorte dentro de
                        la capa a 360 y 390, no a 768, y como hallazgo de UI,
                        no como corte del script.
  recorrido-anterior    la auditoría de la base de la tarea. Tiene que cortar
                        las tres compras esperando «Medio de pago».
  sin-decidir-traslado  la auditoría corregida sin elegir el traslado. Tiene
                        que cortar las tres compras, y decir por qué: la
                        pantalla pide decidir cómo se traslada el pedido.

Necesita la API en 8000, el frontend de desarrollo en 5173 y la siembra demo.
La evidencia de cada corrida va a una carpeta temporal que se borra al final.
No toca la base. Todo lo que cambia lo deja como estaba.
"""
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
# Esperar a que el frontend de desarrollo sirva un archivo cambiado, y a que
# deje de servirlo, es lo mismo que en las piezas anteriores.
from sabotajes_product_detail_page_1 import (  # noqa: E402
    esperar_a_que_cambie, esperar_a_que_deje, servido)

RAIZ = Path(__file__).resolve().parent.parent
AUDITORIA = RAIZ / "scripts/mobile-audit.mjs"
CHECKOUT_CSS = RAIZ / "src/components/Checkout/CheckoutModal.module.css"
# La base de la tarea: el commit de PM que la asignó.
BASE = "32560c6"


def git(*argumentos):
    return subprocess.run(["git", *argumentos], cwd=RAIZ, capture_output=True, check=True).stdout


def auditar(script, evidencia):
    """Corre una versión de la auditoría. Tiene que estar en `scripts/` para
    encontrar playwright; la copia se borra al terminar."""
    copia = None
    if script != AUDITORIA:
        copia = RAIZ / "scripts/.auditoria-sabotaje.mjs"
        copia.write_bytes(script)
    try:
        proceso = subprocess.run(
            ["node", str(copia or AUDITORIA)], cwd=RAIZ, capture_output=True, text=True,
            env={**os.environ, "MOBILE_AUDIT_EVIDENCE_DIR": str(evidencia)}, timeout=900,
        )
    finally:
        if copia:
            copia.unlink()
    return proceso.returncode, proceso.stdout + proceso.stderr


def caso_184():
    proceso = subprocess.run(
        ["node", "scripts/smoke.mjs"], cwd=RAIZ, capture_output=True, text=True,
        env={**os.environ, "SMOKE_CASOS": "184"}, timeout=600,
    )
    for linea in proceso.stdout.splitlines():
        if linea.startswith("[PASS]") or linea.startswith("[FAIL]"):
            return linea
    return f"(sin veredicto; salida: {proceso.stdout[-300:]})"


def compras_cortadas(texto):
    return re.findall(r"- (\S+) compra, en ([\w-]+): ([^\n]*)", texto)


def recorte_original(temporal):
    actual = CHECKOUT_CSS.read_bytes()
    antes = {CHECKOUT_CSS: servido(CHECKOUT_CSS)}
    durante = {}
    try:
        CHECKOUT_CSS.write_bytes(git("show", f"{BASE}:{CHECKOUT_CSS.relative_to(RAIZ).as_posix()}"))
        esperar_a_que_cambie([CHECKOUT_CSS], antes)
        durante = {CHECKOUT_CSS: servido(CHECKOUT_CSS)}
        veredicto = caso_184()
        salida, texto = auditar(AUDITORIA, temporal / "recorte-original")
    finally:
        CHECKOUT_CSS.write_bytes(actual)
        if durante:
            esperar_a_que_deje(durante)
    caso_rojo = veredicto.startswith("[FAIL]") and "la capa del checkout mide 320 px" in veredicto
    recortadas = sorted(set(re.findall(r"- (\S+) (05-checkout-\w+): la capa mide", texto)))
    esperadas = [(ancho, paso) for ancho in ("360x800", "390x844")
                 for paso in ("05-checkout-payment", "05-checkout-shipping")]
    sin_cortes = not compras_cortadas(texto)
    return (caso_rojo and recortadas == esperadas and sin_cortes and salida == 1,
            f"caso 184: {veredicto[:260]}\n    auditoría: salida {salida}; recortes en la capa en "
            f"{recortadas or 'ninguna pantalla'}; compras cortadas: {len(compras_cortadas(texto))}")


def recorrido_anterior(temporal):
    viejo = git("show", f"{BASE}:scripts/mobile-audit.mjs")
    salida, texto = auditar(viejo, temporal / "anterior")
    cortes = compras_cortadas(texto)
    esperando = [c for c in cortes if c[1] == "05-checkout-payment" and "Medio de pago" in c[2]]
    return (salida == 2 and len(cortes) == 3 and len(esperando) == 3,
            f"salida {salida}; compras cortadas: {len(cortes)}, esperando «Medio de pago» en "
            f"05-checkout-payment: {len(esperando)}")


def sin_decidir_traslado(temporal):
    actual = AUDITORIA.read_text()
    eleccion = re.search(
        r"    const porMiCuenta = .*?\n    }\n", actual, re.S)
    assert eleccion, "la auditoría ya no elige el traslado como este script espera"
    salida, texto = auditar(actual.replace(eleccion.group(0), "").encode(), temporal / "sin-decidir")
    cortes = compras_cortadas(texto)
    con_motivo = [c for c in cortes if "Falta decidir cómo se traslada un pedido" in c[2]]
    return (salida == 2 and len(cortes) == 3 and len(con_motivo) == 3,
            f"salida {salida}; compras cortadas: {len(cortes)}, con «Falta decidir cómo se "
            f"traslada un pedido» en el motivo: {len(con_motivo)}"
            + (f"\n    ejemplo: {cortes[0][2][:220]}" if cortes else ""))


SABOTAJES = {
    "recorte-original": recorte_original,
    "recorrido-anterior": recorrido_anterior,
    "sin-decidir-traslado": sin_decidir_traslado,
}


def main(pedidos):
    todos = True
    with tempfile.TemporaryDirectory(prefix="checkout-movil-") as carpeta:
        for nombre in pedidos:
            print(f"\n=== {nombre} ===", flush=True)
            dio_rojo, detalle = SABOTAJES[nombre](Path(carpeta))
            print(("[ROJO ESPERADO] " if dio_rojo else "[NO DISCRIMINA] ") + detalle, flush=True)
            todos = todos and dio_rojo
    estado = git("status", "--porcelain", "--", "src", "scripts", "docs/pm/evidence").decode().strip()
    print(f"\narbol despues: {estado or 'como estaba'}")
    print("todos dieron el rojo esperado" if todos else "ATENCION: alguno no discriminó")
    return 0 if todos else 1


if __name__ == "__main__":
    pedidos = sys.argv[1:] or list(SABOTAJES)
    desconocidos = [p for p in pedidos if p not in SABOTAJES]
    if desconocidos:
        print(f"sabotajes desconocidos: {desconocidos}; hay {list(SABOTAJES)}")
        raise SystemExit(2)
    raise SystemExit(main(pedidos))
