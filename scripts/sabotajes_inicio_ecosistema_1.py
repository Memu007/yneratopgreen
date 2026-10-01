#!/usr/bin/env python3
"""Los rojos discriminantes de INICIO-ECOSISTEMA-1.

    python3 scripts/sabotajes_inicio_ecosistema_1.py                    # todos
    python3 scripts/sabotajes_inicio_ecosistema_1.py proximamente-con-enlace

Cada uno rompe un solo lugar, corre su caso y deja el archivo como estaba. Son
todos de pantalla: el servidor de desarrollo de Vite los toma solo. La API se
reinicia igual, como en los demás scripts, para correr cada caso desde cero.

  proximamente-con-enlace   Las tarjetas «Próximamente» suman un enlace. El 232.
  quienes-somos-en-el-pie   El pie vuelve a tener «Quiénes somos». El 234.
  sin-credito               Se saca el crédito de las fotos CC BY. El 232.
  numero-provisorio         El Mercado escribe 0 mientras el catálogo no
                            contesta. El 233.
  sin-foco                  «Conocé el ecosistema» baja, pero no deja el foco en
                            el título. El 233.
  about-sin-retirar         «?section=about» deja de estar entre los nombres
                            retirados: dibuja Inicio con la barra vieja. El 234.

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
INICIO = RAIZ / "src/components/Pages/HomePage.tsx"
PIE = RAIZ / "src/components/Footer/Footer.tsx"
POLITICA = RAIZ / "src/navegacion/politica.ts"
REINICIAR_API = os.environ.get("REINICIAR_API", "./scripts/entorno_nativo.sh --reiniciar-api")

# nombre: (archivo, [(viejo, nuevo), …], caso, lo que tiene que decir, lo que no)
SABOTAJES = {
    "proximamente-con-enlace": (
        INICIO,
        [("                  <p>{servicio.texto}</p>\n",
          "                  <p>{servicio.texto}</p>\n"
          "                  {!servicio.disponible && <a href=\"#\">Avisame</a>}\n")],
        232,
        ["1440: Ruta productiva: «Próximamente» tiene 1 enlace(s) o botón(es)",
         "390: Charlas y capacitaciones: «Próximamente» tiene 1 enlace(s) o botón(es)"],
        ["no está el crédito", "el estado no es", "los servicios son"],
    ),
    "quienes-somos-en-el-pie": (
        PIE,
        [("            <li><a href=\"#\" onClick={handleNavigate('home')}>Inicio</a></li>\n",
          "            <li><a href=\"#\" onClick={handleNavigate('home')}>Inicio</a></li>\n"
          "            <li><a href=\"#\" onClick={handleNavigate('home')}>Quiénes somos</a></li>\n")],
        234,
        ["1440: el pie tiene «Quiénes somos»", "390: el pie tiene «Quiénes somos»"],
        ["la cabecera tiene", "el enlace viejo"],
    ),
    "sin-credito": (
        INICIO,
        [("          <p className={styles.credito}>\n", "          {false && <p className={styles.credito}>\n"),
         ("            <a href=\"https://creativecommons.org/licenses/by/2.0/\">CC BY 2.0</a>. Recortadas.\n          </p>\n",
          "            <a href=\"https://creativecommons.org/licenses/by/2.0/\">CC BY 2.0</a>. Recortadas.\n          </p>}\n")],
        232,
        ["1440: no está el crédito de las fotos", "390: no está el crédito de las fotos"],
        ["«Próximamente» tiene", "los servicios son"],
    ),
    "numero-provisorio": (
        INICIO,
        [("                      {total !== null && (\n", "                      {(\n"),
         ("                          <b className=\"tg-data\">{total}</b>{' '}\n",
          "                          <b className=\"tg-data\">{total ?? 0}</b>{' '}\n")],
        233,
        ["con el catálogo sin contestar, el Mercado ya dice un número"],
        ["deja el foco", "dejó la barra", "no está"],
    ),
    "sin-foco": (
        INICIO,
        [("    titulo.focus({ preventScroll: true });\n", "")],
        233,
        ["1440: «Conocé el ecosistema» deja el foco en", "390: «Conocé el ecosistema» deja el foco en"],
        ["dejó la barra", "ya dice un número", "no está"],
    ),
    "about-sin-retirar": (
        POLITICA,
        [("  about: () => urlDe('home'),\n", "")],
        234,
        ["el enlace viejo: la barra dice", "?section=about"],
        ["la cabecera tiene", "el pie tiene"],
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
