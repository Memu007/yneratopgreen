#!/usr/bin/env python3
"""Los rojos discriminantes de REV1-PENDIENTES-1.

    python3 scripts/sabotajes_rev1_pendientes_1.py                      # todos
    python3 scripts/sabotajes_rev1_pendientes_1.py faq-de-vuelta        # uno

Cada uno rompe el frontend de desarrollo en un solo lugar, corre el caso 209 y
deja el archivo como estaba. Tiene que dar rojo por su motivo, y sólo por él.

  inicio-con-publicaciones  Inicio vuelve a dibujar las publicaciones de la
                            vista previa. El 209 tiene que decir que Inicio
                            muestra publicaciones, y nada de Contacto ni de
                            Mercado Pago.
  faq-de-vuelta             Contacto vuelve a tener «Preguntas Frecuentes». El
                            209 tiene que nombrarlas, y nada de Inicio ni de
                            Mercado Pago.
  comision-visible          La vinculación de Mercado Pago vuelve a decir «no te
                            cobra comisión por vender». El 209 tiene que
                            nombrar la comisión en Mercado Pago vinculado, y
                            nada de Inicio ni de Contacto.

Necesita la API en 8000, el frontend de desarrollo en 5173 y la siembra demo.
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
INICIO = RAIZ / "src/components/Pages/HomePage.tsx"
CONTACTO = RAIZ / "src/components/Pages/ContactPage.tsx"
TABLERO = RAIZ / "src/components/UserDashboard/UserDashboard.tsx"
CASO = 209

# nombre: (archivo, [(viejo, nuevo), …], lo que tiene que decir, lo que no)
SABOTAJES = {
    "inicio-con-publicaciones": (
        INICIO,
        [
            ("import type { VistaPrevia } from '../../hooks/useVistaPrevia';\n",
             "import type { VistaPrevia } from '../../hooks/useVistaPrevia';\n"
             "import { ProductCard } from '../ProductCard/ProductCard';\n"),
            ("  const { total } = vistaPrevia;\n",
             "  const { total, operaciones } = vistaPrevia;\n"),
            ("      <section className={styles.decision} aria-labelledby=\"titulo-datos\">\n",
             "      <section className=\"tg-container\">\n"
             "        {operaciones.map((operacion) => (\n"
             "          <ProductCard key={operacion.id} product={operacion} variante=\"compacta\" />\n"
             "        ))}\n"
             "      </section>\n\n"
             "      <section className={styles.decision} aria-labelledby=\"titulo-datos\">\n"),
        ],
        ["escritorio: Inicio muestra 1 publicación(es)", "celular: Inicio muestra 1 publicación(es)"],
        ["Preguntas Frecuentes", "comisión", "Nuestro equipo", "invitación"],
    ),
    "faq-de-vuelta": (
        CONTACTO,
        [
            ("      {/* Las preguntas frecuentes salieron (la clienta, 20/09): vuelven cuando\n"
             "          se conozcan las preguntas reales. */}\n",
             "      <section>\n"
             "        <h2>Preguntas Frecuentes</h2>\n"
             "        <h3>¿Cómo empiezo a vender?</h3>\n"
             "        <p>Registrate y publicá.</p>\n"
             "      </section>\n"),
        ],
        ["escritorio: Contacto vuelve a tener «Preguntas Frecuentes»",
         "celular: Contacto vuelve a tener «Preguntas Frecuentes»"],
        ["Inicio", "comisión", "Mercado Pago", "Nuestro equipo"],
    ),
    "comision-visible": (
        TABLERO,
        [
            ("                ni los reparte. Mercado Pago descuenta lo que cobra por cada venta,\n"
             "                como en cualquier venta tuya.\n",
             "                ni los reparte, y no te cobra comisión por vender; Mercado Pago te\n"
             "                descuenta la suya, como en cualquier venta tuya.\n"),
        ],
        ["escritorio: Mercado Pago vinculado dice «comisión»", "celular: Mercado Pago vinculado dice «comisión»"],
        ["Inicio", "Contacto", "Preguntas Frecuentes", "sin vincular", "Nuestro equipo"],
    ),
}


def reemplazar(texto, viejo, nuevo):
    """Una sola vez, con el final de línea que tenga la zona."""
    for fin in ("\r\n", "\n"):
        v, n = viejo.replace("\n", fin), nuevo.replace("\n", fin)
        if texto.count(v) == 1:
            return texto.replace(v, n)
    raise AssertionError(f"no encontré «{viejo[:70]}»")


def veredicto_del_caso(numero):
    proceso = subprocess.run(["node", "scripts/smoke.mjs"], cwd=RAIZ, capture_output=True, text=True,
                             env={**os.environ, "SMOKE_CASOS": str(numero)}, timeout=1200)
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
    original = ruta.read_bytes()
    texto = original.decode("utf-8")
    for viejo, nuevo in cambios:
        texto = reemplazar(texto, viejo, nuevo)
    roto = texto.encode("utf-8")
    antes = {ruta: servido(ruta)}
    durante = {}
    try:
        ruta.write_bytes(roto)
        esperar_a_que_cambie([ruta], antes)
        durante = {ruta: servido(ruta)}
        veredicto = veredicto_del_caso(CASO)
    finally:
        ruta.write_bytes(original)
        if durante:
            esperar_a_que_deje(durante)
    # Lo que dijo el caso, sin su título: el título nombra «preguntas
    # frecuentes», «equipo» y «comisión», y lo que interesa es qué problemas
    # encontró.
    todo = "\n".join([veredicto[0].split(" — ", 1)[-1], *veredicto[1:]])
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
    estado = subprocess.run(["git", "status", "--porcelain", "--", "src"],
                            cwd=RAIZ, capture_output=True, text=True, check=True).stdout.strip()
    print(f"\nsrc después: {estado or 'como estaba'}")
    print("todos dieron el rojo esperado" if todos else "ATENCION: alguno no discriminó")
    return 0 if todos else 1


if __name__ == "__main__":
    pedidos = sys.argv[1:] or list(SABOTAJES)
    desconocidos = [p for p in pedidos if p not in SABOTAJES]
    if desconocidos:
        print(f"sabotajes desconocidos: {desconocidos}; hay {list(SABOTAJES)}")
        raise SystemExit(2)
    raise SystemExit(main(pedidos))
