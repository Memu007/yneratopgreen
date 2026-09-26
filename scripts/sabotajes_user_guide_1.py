#!/usr/bin/env python3
"""Los rojos discriminantes de USER-GUIDE-1.

    python3 scripts/sabotajes_user_guide_1.py                        # todos
    python3 scripts/sabotajes_user_guide_1.py modelo-fuera-del-buscador

El buscador (caso 205):

  modelo-fuera-del-buscador  El catálogo deja de buscar en el modelo: una
                             publicación cuyo modelo no está en el nombre ni
                             en la descripción ya no se encuentra.

Las órdenes después de una acción (caso 206). Cada uno rompe sólo la recarga
de «Mis Compras» y «Mis Ventas»; al abrir la pestaña todo sigue bien.

  recarga-sin-traslado       La recarga arma la orden sin el traslado.
  recarga-sin-transferencia  La recarga arma la orden sin los datos de la
                             transferencia.
  recarga-sin-calificar      La recarga no pregunta si se puede calificar.

La guía de uso (scripts/guia-usuario.mjs), sobre una COPIA de la guía: el
producto no se toca. Cada uno recorre en escritorio hasta el paso que cambia
(`--hasta`), y tiene que dar exactamente una falla, con su motivo.

  frase-falsa         El paso 16 dice que una publicación pausada se sigue
                      viendo en el Mercado. Tiene que fallar el paso 16,
                      citando la frase que la comprobación esperaba.
  cita-ausente        El paso 1 dice «Te enviamos un correo a …», un texto que
                      la pantalla no muestra. Tiene que fallar el paso 1,
                      nombrándolo.
  control-sin-nombrar El paso 3 deja de nombrar «Quiénes somos», que la
                      cabecera muestra. Tiene que fallar el inventario del
                      paso 3.

Necesita la API en 8000, el frontend de desarrollo en 5173 y la siembra demo.
El del buscador reinicia la API antes y después, con REINICIAR_API (por
omisión, `./scripts/entorno_nativo.sh --reiniciar-api`). Todo lo que cambia
lo deja como estaba.
"""
import os
import shlex
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from sabotajes_product_detail_page_1 import (  # noqa: E402
    esperar_a_que_cambie, esperar_a_que_deje, servido)

RAIZ = Path(__file__).resolve().parent.parent
CATALOGO = RAIZ / "backend/app/api/catalog.py"
TABLERO = RAIZ / "src/components/UserDashboard/UserDashboard.tsx"
GUIA = RAIZ / "docs/USER_MANUAL.md"
REINICIAR_API = os.environ.get("REINICIAR_API", "./scripts/entorno_nativo.sh --reiniciar-api")
SALUD = os.environ.get("API_SALUD", "http://localhost:8000/api/health")


def reemplazar(texto, viejo, nuevo):
    for fin in ("\r\n", "\n"):
        v, n = viejo.replace("\n", fin), nuevo.replace("\n", fin)
        if texto.count(v) == 1:
            return texto.replace(v, n)
    raise AssertionError(f"no encontré «{viejo[:70]}»")


def reiniciar_la_api():
    subprocess.run(shlex.split(REINICIAR_API), cwd=RAIZ, capture_output=True, text=True, check=True)
    for _ in range(60):
        try:
            with urllib.request.urlopen(SALUD, timeout=2) as respuesta:
                if respuesta.status == 200:
                    return
        except OSError:
            pass
        time.sleep(1)
    raise RuntimeError(f"la API no respondió en {SALUD} después de reiniciarla")


def correr(comando, entorno=None):
    proceso = subprocess.run(comando, cwd=RAIZ, capture_output=True, text=True,
                             env={**os.environ, **(entorno or {})}, timeout=3600)
    return proceso.returncode, proceso.stdout + proceso.stderr


def veredicto_del_caso(numero, salida):
    """Las líneas del veredicto del caso, con sus problemas."""
    lineas = salida.splitlines()
    desde = next((i for i, l in enumerate(lineas)
                  if l.startswith((f"[PASS] {numero}", f"[FAIL] {numero}"))), None)
    if desde is None:
        return ["(el caso no imprimió su veredicto)"] + lineas[-5:]
    hasta = next((i for i in range(desde + 1, len(lineas))
                  if lineas[i].startswith(("[PASS]", "[FAIL]", "Resumen smoke"))), len(lineas))
    return [l for l in lineas[desde:hasta] if l.strip()]


# --- El buscador --------------------------------------------------------------

def modelo_fuera_del_buscador():
    original = CATALOGO.read_bytes()
    try:
        CATALOGO.write_bytes(reemplazar(original.decode("utf-8"),
                                        "                Product.model.ilike(search_filter),\n", "").encode("utf-8"))
        reiniciar_la_api()
        _, salida = correr(["node", "scripts/smoke.mjs"], {"SMOKE_CASOS": "205"})
    finally:
        CATALOGO.write_bytes(original)
        reiniciar_la_api()
    lineas = [l for l in salida.splitlines() if l.startswith(("[PASS] 205", "[FAIL] 205"))]
    return lineas[0] if lineas else "(el caso no imprimió su veredicto)"


# --- Las órdenes después de una acción ---------------------------------------
# (reemplazo en la recarga, lo que el 206 tiene que decir, lo que no tiene que
# decir). Lo que no tiene que decir es lo de los otros dos: cada rojo, por su
# propia razón.

RECARGA = "      const mappedOrders: Order[] = response.map((o) => armarOrden(o, role));\n"
SIN_TRASLADO = "dice «Traslado no definido.»"
SIN_TRANSFERENCIA = "ya no muestra el alias a donde transferir"
SIN_CALIFICAR = "no aparece «Calificar Vendedor»"

SABOTAJES_DE_LAS_ORDENES = {
    "recarga-sin-traslado": (
        (RECARGA, "      const mappedOrders: Order[] = response.map((o) => ({ ...armarOrden(o, role), "
                  "shipping: undefined }));\n"),
        [SIN_TRASLADO, "después de «Aprobar comprobante»", "después de «Confirmar recepción»"],
        [SIN_TRANSFERENCIA, SIN_CALIFICAR],
    ),
    "recarga-sin-transferencia": (
        (RECARGA, "      const mappedOrders: Order[] = response.map((o) => ({ ...armarOrden(o, role), "
                  "transferencia: undefined }));\n"),
        [SIN_TRANSFERENCIA],
        [SIN_TRASLADO, SIN_CALIFICAR],
    ),
    "recarga-sin-calificar": (
        ("        void preguntarSiSePuedeCalificar(mappedOrders);\n      } else {\n",
         "      } else {\n"),
        [SIN_CALIFICAR],
        [SIN_TRASLADO, SIN_TRANSFERENCIA],
    ),
}


def romper_la_recarga(nombre):
    (viejo, nuevo), deben, no_deben = SABOTAJES_DE_LAS_ORDENES[nombre]
    original = TABLERO.read_bytes()
    roto = reemplazar(original.decode("utf-8"), viejo, nuevo).encode("utf-8")
    antes = {TABLERO: servido(TABLERO)}
    durante = {}
    try:
        TABLERO.write_bytes(roto)
        esperar_a_que_cambie([TABLERO], antes)
        durante = {TABLERO: servido(TABLERO)}
        _, salida = correr(["node", "scripts/smoke.mjs"], {"SMOKE_CASOS": "206"})
    finally:
        TABLERO.write_bytes(original)
        if durante:
            esperar_a_que_deje(durante)
    veredicto = veredicto_del_caso(206, salida)
    todo = "\n".join(veredicto)
    faltan = [t for t in deben if t not in todo]
    sobran = [t for t in no_deben if t in todo]
    dio = veredicto[0].startswith("[FAIL] 206") and not faltan and not sobran
    return dio, veredicto, faltan, sobran


# --- La guía ------------------------------------------------------------------
# Cada uno escribe una copia de la guía con un cambio y la recorre con
# `--guia`. Se pide un solo ancho: el defecto está en el texto, no en el ancho.

def recorrer_una_copia(cambiar, hasta):
    texto = GUIA.read_text(encoding="utf-8")
    with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False, encoding="utf-8",
                                     dir=GUIA.parent) as copia:
        copia.write(cambiar(texto))
    try:
        codigo, salida = correr(["node", "scripts/guia-usuario.mjs", "--guia", copia.name,
                                 "--anchos", "escritorio", "--hasta", str(hasta)])
    finally:
        os.unlink(copia.name)
    fallas = [l.strip() for l in salida.splitlines() if l.strip().startswith("- ")]
    return codigo, fallas, salida


SABOTAJES_DE_LA_GUIA = {
    "frase-falsa": (
        lambda t: reemplazar(t, "Una publicación pausada no se ve en el Mercado.",
                             "Una publicación pausada se sigue viendo en el Mercado."),
        16,
        "Paso 16. Editar, pausar y eliminar: la guía ya no dice “Una publicación pausada no se ve en el Mercado.”",
    ),
    "cita-ausente": (
        lambda t: reemplazar(t, "La ventana dice «Te mandamos un correo a …»",
                             "La ventana dice «Te enviamos un correo a …»"),
        1,
        "Paso 1. Crear la cuenta: la guía nombra «Te enviamos un correo a …» y el sitio no lo mostró en este paso",
    ),
    "control-sin-nombrar": (
        lambda t: reemplazar(t, "- «Quiénes somos» y «Contacto» son las páginas de la empresa.",
                             "- «Contacto» es la página de la empresa."),
        3,
        "Paso 3. Moverte por el sitio: la cabecera muestra «Quiénes somos» y la sección «Tu cuenta» de la guía no lo nombra",
    ),
}


def main(pedidos):
    todos = True
    for nombre in pedidos:
        print(f"\n=== {nombre} ===", flush=True)
        if nombre == "modelo-fuera-del-buscador":
            veredicto = modelo_fuera_del_buscador()
            dio = veredicto.startswith("[FAIL] 205") and "no mostró sólo la publicación de ese modelo" in veredicto \
                or veredicto.startswith("[FAIL] 205") and "y no la del modelo" in veredicto
            print("[ROJO ESPERADO]" if dio else "[NO DISCRIMINA]", flush=True)
            print(f"  {veredicto[:400]}")
        elif nombre in SABOTAJES_DE_LAS_ORDENES:
            dio, veredicto, faltan, sobran = romper_la_recarga(nombre)
            print("[ROJO ESPERADO]" if dio else "[NO DISCRIMINA]", flush=True)
            for linea in veredicto:
                print(f"  {linea[:400]}")
            if faltan:
                print(f"  (faltó que dijera: {faltan})")
            if sobran:
                print(f"  (dijo lo de otro sabotaje: {sobran})")
        else:
            cambiar, hasta, debe = SABOTAJES_DE_LA_GUIA[nombre]
            codigo, fallas, salida = recorrer_una_copia(cambiar, hasta)
            dio = codigo == 1 and any(debe in f for f in fallas) and len(fallas) == 1
            print("[ROJO ESPERADO]" if dio else "[NO DISCRIMINA]", flush=True)
            if not dio:
                print(f"  (salida {codigo}; {len(fallas)} falla(s); tenía que ser una sola y decir «{debe}»)")
            for falla in fallas or salida.splitlines()[-5:]:
                print(f"  {falla[:400]}")
        todos = todos and dio
    estado = subprocess.run(["git", "status", "--porcelain", "--", "src", "backend", "docs/USER_MANUAL.md"],
                            cwd=RAIZ, capture_output=True, text=True, check=True).stdout.strip()
    print(f"\nsrc, backend y la guía después: {estado or 'como estaban'}")
    print("todos dieron el rojo esperado" if todos else "ATENCION: alguno no discriminó")
    return 0 if todos else 1


if __name__ == "__main__":
    todos = ["modelo-fuera-del-buscador", *SABOTAJES_DE_LAS_ORDENES, *SABOTAJES_DE_LA_GUIA]
    pedidos = sys.argv[1:] or todos
    desconocidos = [p for p in pedidos if p not in todos]
    if desconocidos:
        print(f"sabotajes desconocidos: {desconocidos}; hay {todos}")
        raise SystemExit(2)
    raise SystemExit(main(pedidos))
