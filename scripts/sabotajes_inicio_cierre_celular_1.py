#!/usr/bin/env python3
"""Los rojos discriminantes de INICIO-CIERRE-CELULAR-1.

    python3 scripts/sabotajes_inicio_cierre_celular_1.py                # todos
    python3 scripts/sabotajes_inicio_cierre_celular_1.py en-el-medio    # uno

Cada uno rompe un solo lugar, corre el caso 240 y deja el archivo como estaba.
Tiene que dar rojo por su motivo, y sólo por él.

El que pidió la PM:

  en-el-medio           En celular, «¿Te interesa alguno?» vuelve a la grilla,
                        después de la tarjeta 07.

Y los demás:

  dos-veces             El bloque se dibuja en la grilla y al final: se ve y se
                        lee dos veces.
  en-todos-los-anchos   El bloque va al final también en la tableta y en la
                        computadora.
  sin-escuchar          El ancho se lee al abrir y no se escucha: al girar el
                        celular o achicar la ventana, el bloque no se muda.
  foco-perdido          Al mudarse, el bloque no devuelve el foco: quien estaba
                        en «Escribinos» queda en ninguna parte.
  titulo-h3             Al final, el título sigue siendo de nivel 3 y queda
                        dentro de «Cómo funciona» en el índice de títulos.

Son todos de pantalla: esperan a que el servidor de desarrollo sirva el
archivo roto, y después el sano. Necesita la API en 8000 y el frontend de
desarrollo en 5173.
"""
import subprocess
import sys
import os
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from sabotajes_product_detail_page_1 import (  # noqa: E402
    esperar_a_que_cambie, esperar_a_que_deje, servido)

RAIZ = Path(__file__).resolve().parent.parent
INICIO = RAIZ / "src/components/Pages/HomePage.tsx"
HOOK = RAIZ / "src/hooks/useEsMovil.ts"
CASO = 240

ANCHOS_DE_CELULAR = ["390:", "599:"]
ANCHOS_DE_GRILLA = ["600:", "768:", "1440:"]

# nombre: (archivo, [(viejo, nuevo), …], lo que tiene que decir, lo que no)
SABOTAJES = {
    "en-el-medio": (
        INICIO,
        [("            {!cierreAlFinal && porEtapas}\n", "            {porEtapas}\n"),
         ("      {cierreAlFinal && <div className=", "      {false && <div className=")],
        ["390: «¿Te interesa alguno?» no está después de «Principio de AgroBoeda»: es la 8.ª de la grilla",
         "599: «¿Te interesa alguno?» no está después de «Principio de AgroBoeda»: es la 8.ª de la grilla",
         "390: después de la tarjeta 07 viene el cierre, y no el crédito"],
        [*ANCHOS_DE_GRILLA, "más de una vez", "el foco quedó"],
    ),
    "dos-veces": (
        INICIO,
        [("            {!cierreAlFinal && porEtapas}\n", "            {porEtapas}\n")],
        ["390: el cierre está más de una vez o falta en el documento: 2 título(s)",
         "599: el cierre está más de una vez o falta en el documento: 2 título(s)"],
        ANCHOS_DE_GRILLA,
    ),
    "en-todos-los-anchos": (
        INICIO,
        [("  const cierreAlFinal = useEsMovil(() => {\n", "  const cierreAlFinal = true || useEsMovil(() => {\n")],
        ["1440: «¿Te interesa alguno?» no es la octava de la grilla: está al final de Inicio",
         "768: «¿Te interesa alguno?» no es la octava de la grilla: está al final de Inicio",
         "600: «¿Te interesa alguno?» no es la octava de la grilla: está al final de Inicio"],
        ANCHOS_DE_CELULAR,
    ),
    "sin-escuchar": (
        HOOK,
        [("    consulta.addEventListener('change', alCambiar);\n", "")],
        ["al pasar de 1440 a 390, el cierre no fue al final"],
        [*ANCHOS_DE_CELULAR, *ANCHOS_DE_GRILLA],
    ),
    "foco-perdido": (
        INICIO,
        [("    escribinos.current?.focus();\n", "")],
        ["al pasar de 1440 a 390 con el foco en «Escribinos», el foco quedó en BODY"],
        [*ANCHOS_DE_CELULAR, *ANCHOS_DE_GRILLA, "el cierre no fue"],
    ),
    "titulo-h3": (
        INICIO,
        [("  const TituloDelCierre = cierreAlFinal ? 'h2' : 'h3';\n", "  const TituloDelCierre = 'h3';\n")],
        ["390: al final, el cierre es un H3", "599: al final, el cierre es un H3"],
        [*ANCHOS_DE_GRILLA, "no está después", "el foco quedó"],
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
    original = ruta.read_bytes()
    texto = original.decode("utf-8")
    for viejo, nuevo in cambios:
        texto = reemplazar(texto, viejo, nuevo)
    antes = {ruta: servido(ruta)}
    durante = {}
    try:
        ruta.write_bytes(texto.encode("utf-8"))
        esperar_a_que_cambie([ruta], antes)
        durante = {ruta: servido(ruta)}
        veredicto = veredicto_del_caso(CASO)
    finally:
        ruta.write_bytes(original)
        if durante:
            esperar_a_que_deje(durante)
    # Los problemas que encontró, sin el título del caso.
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
