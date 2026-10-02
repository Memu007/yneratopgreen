#!/usr/bin/env python3
"""Los rojos discriminantes de MARCAS-PANEL-1.

    python3 scripts/sabotajes_marcas_panel_1.py                    # todos
    python3 scripts/sabotajes_marcas_panel_1.py unir-sin-mover     # uno

Cada uno rompe un solo lugar, corre el caso 239 y deja el archivo como estaba.
Tiene que dar rojo por su motivo, y sólo por él.

Los dos que pidió la PM:

  unir-sin-mover        Unir borra la marca que se va sin mover sus
                        publicaciones: quedan apuntando a una que no existe.
  unir-sin-rol          Unir no pide administración: cualquiera con sesión
                        une marcas.

Y los demás:

  baja-borra            Dar de baja borra la marca en vez de dejarla
                        desactivada: la ficha la pierde y no se puede dar de
                        alta.
  corregir-pisa         Corregir no mira si el nombre es el de otra marca.
  consigo-misma         Unir una marca consigo misma la borra.
  unir-a-dada-de-baja   Unir a una marca dada de baja se acepta.
  configuracion-borra   Configuración borra una marca por la ruta genérica.
  panel-no-recarga      La pantalla no vuelve a pedir la lista después de
                        unir: la que se fue sigue a la vista.

Los del backend reinician la API antes y después con REINICIAR_API (por
omisión, `./scripts/entorno_nativo.sh --reiniciar-api`). Los de pantalla
esperan a que el servidor de desarrollo sirva el archivo roto, y después el
sano. Ninguno toca John Deere ni otra marca de la lista: el caso prueba las
reglas que borran sobre marcas que crea y retira él mismo.

Necesita la API en 8000 y el frontend de desarrollo en 5173.
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
MARCAS = RAIZ / "backend/app/services/marcas.py"
ADMIN = RAIZ / "backend/app/api/admin.py"
PANEL = RAIZ / "src/components/AdminPanel/AdminPanel.tsx"
DEL_FRONTEND = {PANEL}
REINICIAR_API = os.environ.get("REINICIAR_API", "./scripts/entorno_nativo.sh --reiniciar-api")
CASO = 239

# Lo que dice el 239 cuando falla la parte de pantalla de un ancho.
PANTALLA = ["escritorio:", "celular:"]

# nombre: (archivo, [(viejo, nuevo), …], lo que tiene que decir, lo que no)
SABOTAJES = {
    "unir-sin-mover": (
        MARCAS,
        [("        db.query(Product).filter(Product.brand == origen.value).update(\n"
          "            {Product.brand: destino.value}, synchronize_session=False,\n"
          "        )\n", "")],
        ["escritorio: unida, la publicación quedó con «jhon-deer»",
         "celular: unida, la publicación quedó con «jhon-deer»"],
        ["quien vende pide", "corregida,", "dada de baja,", "dada de alta,"],
    ),
    "unir-sin-rol": (
        ADMIN,
        [("    pedido: UnirMarcas,\n"
          "    db: Session = Depends(get_db),\n"
          "    admin: User = Depends(require_admin),\n",
          "    pedido: UnirMarcas,\n"
          "    db: Session = Depends(get_db),\n"
          "    admin: User = Depends(get_current_user),\n")],
        ["API: quien vende pide unir y recibe 200 y no 403"],
        ["pide listar", "pide corregir", "pide dar de baja", *PANTALLA],
    ),
    "baja-borra": (
        MARCAS,
        [("        opcion.is_active = activa\n",
          "        if activa:\n"
          "            opcion.is_active = True\n"
          "        else:\n"
          "            db.delete(opcion)\n")],
        ["escritorio: dada de baja, la ficha dice «Marca: agromec»"],
        ["quien vende pide", "unida,", "corregida,"],
    ),
    "corregir-pisa": (
        MARCAS,
        [("        if otra is not None:\n", "        if False:\n")],
        ["API: corregir al nombre de John Deere respondió 200"],
        ["quien vende pide", "unir dos veces", *PANTALLA],
    ),
    "consigo-misma": (
        MARCAS,
        [("    if origen_id == destino_id:\n", "    if False:\n")],
        ["API: unir una marca consigo misma respondió 200"],
        ["quien vende pide", "unir dos veces", *PANTALLA],
    ),
    "unir-a-dada-de-baja": (
        MARCAS,
        [("        if not destino.is_active:\n", "        if False:\n")],
        ["API: unir a una dada de baja respondió 200"],
        ["quien vende pide", "unir dos veces", "consigo misma", *PANTALLA],
    ),
    "configuracion-borra": (
        ADMIN,
        [("        raise HTTPException(status_code=404, detail=\"Opción no encontrada\")\n"
          "    solo_las_de_configuracion(option)\n"
          "    \n"
          "    label = option.label\n",
          "        raise HTTPException(status_code=404, detail=\"Opción no encontrada\")\n"
          "    \n"
          "    label = option.label\n")],
        ["API: Configuración borró una marca por la ruta genérica (HTTP 200)"],
        ["quien vende pide", "unir dos veces", "consigo misma", *PANTALLA],
    ),
    "panel-no-recarga": (
        PANEL,
        [("        // Unida o no, la lista se vuelve a pedir: si otra persona ya la había\n"
          "        // unido, lo que se ve tiene que dejar de ofrecerla.\n"
          "        dejarDeEditarMarcas();\n"
          "        loadMarcas();\n",
          "        dejarDeEditarMarcas();\n")],
        ["escritorio: unida, «Jhon Deer» sigue en la lista del panel",
         "celular: unida, «Jhon Deer» sigue en la lista del panel"],
        ["la publicación quedó", "quien vende pide", "API:"],
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
    del_frontend = ruta in DEL_FRONTEND
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
