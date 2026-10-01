#!/usr/bin/env python3
"""Los rojos discriminantes de CAMBIAR-CONTRASENA-1.

    python3 scripts/sabotajes_cambiar_contrasena_1.py                    # todos
    python3 scripts/sabotajes_cambiar_contrasena_1.py api-sin-validar    # uno

Cada uno rompe un solo lugar, corre el caso 235 y deja el archivo como estaba.
Tiene que dar rojo por su motivo, y sólo por él.

  api-sin-validar       El cambio de contraseña acepta cualquier nueva: sin la
                        regla en la API. El 235 tiene que ver que una de 3
                        caracteres y una de 73 bytes no se rechazan.
  pantalla-sin-actual   «Cambiar contraseña» deja de pedir la contraseña
                        actual. El 235 tiene que decir que no la pide.
  ingreso-con-500       El ingreso vuelve a pasarle a bcrypt más de 72 bytes.
                        El 235 tiene que ver el 500 del ingreso.
  devuelve-la-clave     Un 422 vuelve a devolver la contraseña escrita. El 235
                        tiene que verla en la respuesta.

Los de la API la reinician antes y después con REINICIAR_API (por omisión,
`./scripts/entorno_nativo.sh --reiniciar-api`). El de pantalla espera a que el
servidor de desarrollo sirva el archivo roto, y después el sano.

Necesita la API en 8000, el frontend de desarrollo en 5173 y la siembra demo.
"""
import os
import shlex
import subprocess
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from sabotajes_product_detail_page_1 import (  # noqa: E402
    esperar_a_que_cambie, esperar_a_que_deje, servido)

RAIZ = Path(__file__).resolve().parent.parent
ESQUEMAS = RAIZ / "backend/app/schemas/auth.py"
SEGURIDAD = RAIZ / "backend/app/core/security.py"
PRINCIPAL = RAIZ / "backend/app/main.py"
PANTALLA = RAIZ / "src/components/UserDashboard/CambiarClave.tsx"
REINICIAR_API = os.environ.get("REINICIAR_API", "./scripts/entorno_nativo.sh --reiniciar-api")
CASO = 235

# nombre: (archivo, [(viejo, nuevo), …], lo que tiene que decir, lo que no)
SABOTAJES = {
    "api-sin-validar": (
        ESQUEMAS,
        [("    current_password: str\n"
          "    new_password: ClaveNueva\n",
          "    current_password: str\n"
          "    new_password: str\n")],
        ["API, cambio a una de 3 caracteres: HTTP 200", "API, cambio a una de 73 bytes: HTTP 500"],
        ["registro", "alta desde el panel", "restablecer", "ingreso", "escritorio", "celular"],
    ),
    "pantalla-sin-actual": (
        PANTALLA,
        [("    if (!actual || !nueva || !repetida) {\n",
          "    if (!nueva || !repetida) {\n"),
         ("          <div className={styles.formGroup}>\n"
          "            <label htmlFor=\"clave-actual\">Contraseña actual</label>\n"
          "            <input\n"
          "              id=\"clave-actual\"\n"
          "              type=\"password\"\n"
          "              autoComplete=\"current-password\"\n"
          "              value={actual}\n"
          "              onChange={(e) => setActual(e.target.value)}\n"
          "            />\n"
          "          </div>\n",
          "")],
        ["escritorio: la sección no pide «Contraseña actual»", "celular: la sección no pide «Contraseña actual»"],
        ["  API, "],
    ),
    "ingreso-con-500": (
        SEGURIDAD,
        [("    if len(password_bytes) > 72:\n"
          "        return False\n",
          "")],
        ["API, ingreso con 73 bytes: HTTP 500"],
        ["registro con", "alta desde el panel", "restablecer", "escritorio", "celular"],
    ),
    "devuelve-la-clave": (
        PRINCIPAL,
        [("        {clave: valor for clave, valor in error.items() if clave != \"input\"}\n",
          "        error\n")],
        ["API, registro con 73 bytes: la respuesta devuelve la contraseña escrita",
         "API, restablecer desde el panel con 3 caracteres: la respuesta devuelve la contraseña escrita"],
        ["HTTP", "el motivo es", "escritorio", "celular"],
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
    ruta, cambios, deben, no_deben = SABOTAJES[nombre]
    del_frontend = ruta == PANTALLA
    original = ruta.read_bytes()
    texto = original.decode("utf-8")
    for viejo, nuevo in cambios:
        texto = reemplazar(texto, viejo, nuevo)
    antes = {ruta: servido(ruta)} if del_frontend else {}
    durante = {}
    try:
        ruta.write_bytes(texto.encode("utf-8"))
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
