#!/usr/bin/env python3
"""Los rojos discriminantes de AVISOS-1.

    python3 scripts/sabotajes_avisos_1.py               # todos
    python3 scripts/sabotajes_avisos_1.py error-se-va   # uno

Cada uno rompe un solo lugar, corre su caso (241, 242 o 243) y deja el archivo
como estaba. Tiene que dar rojo por su motivo, y sólo por él.

El que pidió la PM:

  error-se-va           El error se va solo a los 4 s, como lo que salió bien.

Y los demás:

  arriba                Los avisos vuelven arriba, como antes: tapan la
                        cabecera.
  texto-encimado        Los de atrás de la pila dibujan su texto, que queda
                        debajo del de adelante.
  sin-pausa             El mouse encima no pausa: lo que salió bien se va
                        aunque alguien lo esté leyendo. (Lo mide el aviso
                        de adelante de la pila desplegada, que tiene que
                        seguir ahí.)
  foco-perdido          Al cerrar con el teclado, el foco no pasa al aviso
                        siguiente.
  foco-al-cerrar-con-mouse
                        Cerrar con el mouse el de adelante le pasa el foco al
                        siguiente, y la pila queda desplegada y en pausa: el
                        bueno de atrás no se va.
  sin-ver-carrito       Agregar desde la ficha no ofrece «Ver carrito».

Los de la devolución (casos 242 y 243):

  tapa-la-capa          Las capas no les dejan lugar a los avisos: el error
                        vuelve a tapar «Publicar producto».
  el-dedo-pausa         Tocar el aviso con el dedo vuelve a pausarlo, como
                        con el mouse.
  touch-none            Lo vertical sobre el aviso vuelve a no desplazar la
                        página.
  cierra-con-poco       40 px de costado alcanzan para cerrarlo.
  teclado-se-va         Lo que tiene acción se va a los 4 s aunque haya
                        llegado por el teclado.
  foco-al-body          Al cerrar el último aviso con el teclado, el foco se
                        pierde en la página.
  capa-no-arranca       Con una capa abierta, el aviso que esperaba al
                        teclado no empieza a contar: no se va nunca.
  mouse-no-arranca      Después de agregar con el teclado, un clic en la
                        página no hace que el aviso empiece a contar.
  foco-detras           Con una capa abierta, cerrar con el teclado el último
                        aviso manda el foco detrás de la capa.

Son todos de pantalla: esperan a que el servidor de desarrollo sirva el
archivo roto, y después el sano. Necesita la API en 8000 y el frontend de
desarrollo en 5173.
"""
import subprocess
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from sabotajes_product_detail_page_1 import (  # noqa: E402
    esperar_a_que_cambie, esperar_a_que_deje, servido)
from sabotajes_inicio_cierre_celular_1 import reemplazar, veredicto_del_caso  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
AVISOS = RAIZ / "src/components/Toast/Toast.tsx"
ESTILOS = RAIZ / "src/components/Toast/Toast.module.css"
FICHA = RAIZ / "src/components/ProductDetail/ProductDetailPage.tsx"
CASO = 241

ANCHOS = ["escritorio 1440px:", "celular 390px:"]

# nombre: (archivo, [(viejo, nuevo), …], lo que tiene que decir, lo que no[, caso])
SABOTAJES = {
    "error-se-va": (
        AVISOS,
        [("    if (type === 'error') return;\n", "")],
        [f"{a} a los " for a in ANCHOS] + ["quedan 0 errores y tenía que quedar 1"],
        ["no está abajo", "se enciman", "Ver carrito", "lo que salió bien"],
    ),
    "arriba": (
        ESTILOS,
        [("  bottom: calc(var(--tg-space-6) + env(safe-area-inset-bottom, 0px));\n  transform: translateX(-50%);\n",
          "  top: 20px;\n  transform: translateX(-50%);\n")],
        [f"{a} el aviso empieza en" for a in ANCHOS] + ["el aviso no está abajo"],
        # Arriba, la pila desplegada sube por encima de la pantalla: eso es
        # el mismo motivo. Lo que no tiene que aparecer es la pila plegada.
        ["plegada, se enciman", "Ver carrito", "se fue a los"],
    ),
    "texto-encimado": (
        ESTILOS,
        [(".lugar[data-atras] .toast > * { visibility: hidden; }\n", "")],
        [f"{a} plegada, se enciman" for a in ANCHOS],
        ["no está abajo", "Ver carrito", "se fue a los", "con el mouse encima, se enciman"],
    ),
    "sin-pausa": (
        AVISOS,
        [("    if (desplegada) pausar();\n    else reanudar();\n", "    void pausar; void reanudar;\n")],
        [f"{a} con el mouse encima, lo que salió bien se fue" for a in ANCHOS],
        ["no está abajo", "se enciman", "Ver carrito"],
    ),
    "foco-perdido": (
        AVISOS,
        [("      if (destino) destino.focus();\n", "      if (destino) void destino;\n")],
        [f"{a} al cerrar con el teclado, el foco quedó" for a in ANCHOS],
        ["no está abajo", "se enciman", "Ver carrito", "se fue a los"],
    ),
    "foco-al-cerrar-con-mouse": (
        AVISOS,
        [("      if (!conTeclado) {\n", "      if (false) {\n")],
        [f"{a} al cerrar con el mouse el de adelante, el bueno de atrás no se fue solo" for a in ANCHOS],
        ["no está abajo", "se enciman", "Ver carrito", "se fue a los", "el foco quedó"],
    ),
    "sin-ver-carrito": (
        FICHA,
        [("                showToast(`Agregado: ${product.name}`, 'success', {\n",
          "                showToast(`Agregado: ${product.name}`, 'success', void {\n")],
        [f"{a} agregar desde la ficha no ofrece «Ver carrito»" for a in ANCHOS],
        ["no está abajo", "se enciman", "se fue a los", "el foco quedó"],
    ),
    "tapa-la-capa": (
        AVISOS,
        [("      raiz.setAttribute('data-avisos', '');\n", "      void raiz;\n")],
        [f"{a}: con el error a la vista, el aviso tapa" for a in ("1440px", "390px", "320px")],
        ["no siguió a la vista"],
        243,
    ),
    "el-dedo-pausa": (
        AVISOS,
        [("        onPointerEnter={(e) => { if (e.pointerType !== 'touch') setConMouse(true); }}\n"
          "        onPointerLeave={() => setConMouse(false)}\n",
          "        onMouseEnter={() => setConMouse(true)}\n"
          "        onMouseLeave={() => setConMouse(false)}\n")],
        ["celular 390px táctil: tocado con el dedo, lo que salió bien seguía a los"],
        ["de costado", "desplazó", "teclado"],
        242,
    ),
    "touch-none": (
        ESTILOS,
        [("  touch-action: pan-y pinch-zoom;\n", "  touch-action: none;\n")],
        ["celular 390px táctil: deslizar en vertical sobre el aviso no desplazó la página"],
        ["de costado", "tocado con el dedo", "teclado"],
        242,
    ),
    "cierra-con-poco": (
        AVISOS,
        [("const DESLIZAR = 60;\n", "const DESLIZAR = 30;\n")],
        ["celular 390px táctil: deslizar 40 px de costado cerró el aviso"],
        ["desplazó", "tocado con el dedo", "teclado"],
        242,
    ),
    "teclado-se-va": (
        AVISOS,
        [("    if (opciones.accion && conTeclado.current) {\n",
          "    if (false) {\n")],
        ["escritorio 1440px teclado: agregado con el teclado, el aviso se fue antes de los 6 s"],
        ["táctil", "el foco quedó"],
        242,
    ),
    "foco-al-body": (
        AVISOS,
        [("    const destino = [origen, previo].find((e) => e?.isConnected && (!capa || capa.contains(e))) ?? capa;\n",
          "    const destino = null && capa;\n")],
        ["al cerrar el carrito abierto desde el aviso, el foco quedó en «BODY",
         "al cerrar con el teclado el último aviso, el foco quedó en «BODY"],
        ["táctil", "se fue antes"],
        242,
    ),
    "capa-no-arranca": (
        AVISOS,
        [("    document.addEventListener('focusin', alEnfocar);\n", "    void alEnfocar;\n")],
        ["escritorio 1440px teclado: con el carrito abierto, el aviso que esperaba al teclado no se fue solo"],
        ["táctil", "se fue antes"],
        242,
    ),
    "mouse-no-arranca": (
        AVISOS,
        [("    document.addEventListener('pointerdown', alApoyar);\n", "    void alApoyar;\n")],
        ["escritorio 1440px teclado: agregado con el teclado, después de un clic en la página el aviso no se fue solo"],
        ["táctil", "se fue antes", "el foco quedó"],
        242,
    ),
    "foco-detras": (
        AVISOS,
        [("    const capa = capas[capas.length - 1];\n", "    const capa = undefined && capas[capas.length - 1];\n")],
        ["al cerrar con el teclado el último aviso con el carrito abierto, el foco quedó en «BUTTON Agregar al carrito», fuera del carrito"],
        ["táctil", "se fue antes", "no se fue solo"],
        242,
    ),
}


def sabotear(nombre):
    ruta, cambios, deben, no_deben, *resto = SABOTAJES[nombre]
    caso = resto[0] if resto else CASO
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
        veredicto = veredicto_del_caso(caso)
    finally:
        ruta.write_bytes(original)
        if durante:
            esperar_a_que_deje(durante)
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
