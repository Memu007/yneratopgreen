#!/usr/bin/env python3
"""Los rojos discriminantes de MOBILE-AUDIT-FLOW-1.

La auditoría móvil tiene que llegar a la ficha operando el panel de filtros
como una persona, decir si lo que la cortó es del script o de la interfaz, y
no escribir sobre la evidencia de otra corrida. Este script la hace fallar de
a una cosa por vez y comprueba que falle por lo que corresponde.

    python3 scripts/sabotajes_mobile_audit_flow_1.py                      # los cuatro
    python3 scripts/sabotajes_mobile_audit_flow_1.py recorrido-anterior   # uno solo

Los cuatro:

  recorrido-anterior  la auditoría de la base de la tarea, que elige filtros con
                      el panel plegado. Tiene que cortarse en «Limpiar filtros»,
                      antes de la ficha. Es el negativo que pidió PM. Se le
                      cambia sólo la carpeta de evidencia, para que no pise las
                      capturas versionadas.
  panel-cerrado       la auditoría corregida sin abrir el panel. Tiene que
                      informarlo como falla del script, no como hallazgo de UI,
                      y no llegar a la ficha.
  limpiar-tapado      el producto con «Limpiar filtros» sin recibir el toque. Es
                      un defecto de la interfaz y así tiene que informarlo.
  sobrescribir        la carpeta de evidencia apunta a las capturas versionadas.
                      Tiene que negarse sin tocar ninguna.

Necesita la API en 8000 y el frontend de desarrollo en 5173. Las carpetas de
evidencia de cada corrida quedan en una carpeta temporal y se borran al final.
No toca la base. Todo lo que cambia lo deja como estaba.
"""
import hashlib
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
# Esperar a que el frontend de desarrollo sirva un archivo cambiado —y a que
# deje de servirlo— es lo mismo que en la pieza anterior.
from sabotajes_product_detail_page_1 import (  # noqa: E402
    esperar_a_que_cambie, esperar_a_que_deje, servido)

RAIZ = Path(__file__).resolve().parent.parent
AUDITORIA = RAIZ / "scripts/mobile-audit.mjs"
# La base de la tarea: el commit de PM que la asignó.
BASE = "624fac2"
HISTORICAS = RAIZ / "docs/pm/evidence/mobile-2026-07-26"
FILTROS_CSS = RAIZ / "src/components/FilterSidebar/FilterSidebar.module.css"


def git(*argumentos):
    return subprocess.run(["git", *argumentos], cwd=RAIZ, capture_output=True, check=True).stdout


def huellas(carpeta):
    return {r.name: hashlib.sha256(r.read_bytes()).hexdigest() for r in sorted(carpeta.iterdir())}


def correr(script, evidencia, entorno=None):
    """Corre una versión de la auditoría. Tiene que estar en `scripts/` para
    encontrar playwright; la copia se borra al terminar."""
    copia = None
    if script != AUDITORIA:
        copia = RAIZ / "scripts/.auditoria-sabotaje.mjs"
        copia.write_bytes(script)
    try:
        proceso = subprocess.run(
            ["node", str(copia or AUDITORIA)], cwd=RAIZ, capture_output=True, text=True,
            env={**os.environ, "MOBILE_AUDIT_EVIDENCE_DIR": str(evidencia), **(entorno or {})},
            timeout=900,
        )
    finally:
        if copia:
            copia.unlink()
    return proceso.returncode, proceso.stdout + proceso.stderr


def capturas_de_la_ficha(evidencia):
    return sorted(p.name for p in evidencia.glob("*-04-detail.png")) if evidencia.exists() else []


def sin_escape(texto):
    return re.sub(r"\x1b\[[0-9;]*m", "", texto)


def recorrido_anterior(temporal):
    viejo = git("show", f"{BASE}:scripts/mobile-audit.mjs").decode()
    linea = "const EVIDENCE_DIR = path.resolve('docs/pm/evidence/mobile-2026-07-26');"
    assert viejo.count(linea) == 1, "la auditoría de la base ya no tiene la carpeta fija"
    evidencia = temporal / "anterior"
    viejo = viejo.replace(linea, f"const EVIDENCE_DIR = {str(evidencia)!r};")
    salida, texto = correr(viejo.encode(), evidencia)
    texto = sin_escape(texto)
    ficha = capturas_de_la_ficha(evidencia)
    cortada = "Limpiar filtros" in texto and "intercepts pointer events" in texto
    return (salida != 0 and cortada and not ficha,
            f"salida {salida}; se cortó en «Limpiar filtros» con el clic interceptado: "
            f"{'sí' if cortada else 'no'}; capturas de la ficha: {ficha or 'ninguna'}")


def panel_cerrado(temporal):
    actual = AUDITORIA.read_text()
    llamada = "    await abrirFiltros(page);\n"
    assert actual.count(llamada) == 2, "la auditoría ya no abre el panel en dos lugares"
    evidencia = temporal / "panel-cerrado"
    salida, texto = correr(actual.replace(llamada, "").encode(), evidencia)
    ficha = capturas_de_la_ficha(evidencia)
    de_script = re.search(r"catálogo público, en 02-filters: falla del script: quiso operar «Categoría» "
                          r"con el panel de filtros plegado", texto)
    tapados = re.search(r"Controles que se ven y no reciben el toque: (\d+)", texto)
    return (salida == 2 and bool(de_script) and tapados and tapados.group(1) == "0" and not ficha,
            f"salida {salida}; informado como falla del script: {'sí' if de_script else 'no'}; "
            f"controles tapados: {tapados.group(1) if tapados else '?'}; capturas de la ficha: {ficha or 'ninguna'}")


def limpiar_tapado(temporal):
    original = FILTROS_CSS.read_bytes()
    antes = {FILTROS_CSS: servido(FILTROS_CSS)}
    durante = {}
    try:
        FILTROS_CSS.write_bytes(original + b"\n.limpiar { pointer-events: none; }\n")
        esperar_a_que_cambie([FILTROS_CSS], antes)
        durante = {FILTROS_CSS: servido(FILTROS_CSS)}
        evidencia = temporal / "limpiar-tapado"
        salida, texto = correr(AUDITORIA, evidencia)
    finally:
        FILTROS_CSS.write_bytes(original)
        if durante:
            esperar_a_que_deje(durante)
    tapados = re.findall(r"- (\S+) 03-catalog: «Limpiar filtros» se ve pero no recibe el toque", texto)
    culpa_al_script = re.search(r"falla del script[^\n]*Limpiar", texto)
    return (salida != 0 and len(tapados) == 3 and not culpa_al_script,
            f"salida {salida}; «Limpiar filtros» informado como hallazgo de UI en {tapados or 'ningún ancho'}; "
            f"atribuido al script: {'sí' if culpa_al_script else 'no'}")


def sobrescribir(temporal):
    antes = huellas(HISTORICAS)
    salida, texto = correr(AUDITORIA, HISTORICAS)
    intactas = huellas(HISTORICAS) == antes
    nego = "no se sobrescribe" in texto
    return (salida == 2 and nego and intactas,
            f"salida {salida}; se negó: {'sí' if nego else 'no'}; "
            f"las {len(antes)} capturas versionadas quedaron idénticas: {'sí' if intactas else 'NO'}")


SABOTAJES = {
    "recorrido-anterior": recorrido_anterior,
    "panel-cerrado": panel_cerrado,
    "limpiar-tapado": limpiar_tapado,
    "sobrescribir": sobrescribir,
}


def main(pedidos):
    todos = True
    with tempfile.TemporaryDirectory(prefix="auditoria-movil-") as carpeta:
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
