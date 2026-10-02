#!/usr/bin/env python3
"""Los rojos discriminantes de FILTROS-DE-PUBLICACIONES-1.

    python3 scripts/sabotajes_filtros_de_publicaciones_1.py                    # todos
    python3 scripts/sabotajes_filtros_de_publicaciones_1.py marca-con-ceros    # uno

Cada uno rompe un solo lugar, corre su caso (237 o 238) y deja el archivo como
estaba. Tiene que dar rojo por su motivo, y sólo por él.

Los tres que pidió la PM:

  marca-con-ceros           El filtro de marca vuelve a ofrecer todas las
                            activas, también las que están en cero (la regla
                            del 25/09).
  marca-nueva-fuera         Una marca escrita entra a la lista dada de baja:
                            no aparece en el filtro.
  agromec-segunda           La marca escrita se compara tal cual, sin la
                            clave: «AGROMEC » crea una segunda marca.

Y los demás:

  listas-con-ceros          La pantalla deja de quitar las opciones en cero de
                            la potencia, la condición, el origen y el tipo.
  elegida-se-cae            La API deja de ofrecer la marca elegida cuando
                            queda en cero.
  elegida-se-cae-pantalla   La pantalla deja de mostrar la opción elegida
                            cuando queda en cero (el tipo).
  contar-con-su-filtro      Cada faceta se cuenta con su propio filtro puesto:
                            elegir una marca borra a las demás.
  sin-candado               Dos altas a la vez con la misma marca nueva no se
                            esperan: pueden crear dos.
  marca-antes-de-validar    La marca escrita se guarda antes de validar el
                            tipo: una alta rechazada deja su marca.
  detalle-sin-rotulo        El detalle no devuelve el nombre de la marca.
  sin-minimo                La API acepta una marca de 1 carácter.
  alta-sin-otra-marca       El alta no manda la marca escrita.
  alta-manda-vacia          El alta manda «Otra marca» vacía sin decir qué
                            falta.
  editar-sin-otra-marca     «Editar» no manda la marca escrita.

Los del backend reinician la API antes y después con REINICIAR_API (por
omisión, `./scripts/entorno_nativo.sh --reiniciar-api`). Los de pantalla
esperan a que el servidor de desarrollo sirva el archivo roto, y después el
sano.

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
CATALOGO = RAIZ / "backend/app/api/catalog.py"
MARCAS = RAIZ / "backend/app/services/marcas.py"
ESQUEMAS = RAIZ / "backend/app/schemas/products.py"
PUBLICAR = RAIZ / "backend/app/api/products.py"
FILTROS = RAIZ / "src/components/FilterSidebar/FilterSidebar.tsx"
ALTA = RAIZ / "src/components/AddProduct/AddProductModal.tsx"
EDITAR = RAIZ / "src/components/UserDashboard/UserDashboard.tsx"
DEL_FRONTEND = {FILTROS, ALTA, EDITAR}
REINICIAR_API = os.environ.get("REINICIAR_API", "./scripts/entorno_nativo.sh --reiniciar-api")

FACETAS = 237
OTRA_MARCA = 238
# Lo que dice el 238 cuando falla algo que no tiene que ver con la marca escrita.
AJENOS_A_LA_MARCA = ["un insumo con «Otra marca»", "una de 40 caracteres", "la lista y «Otra marca» a la vez"]

# nombre: (caso, archivo, [(viejo, nuevo), …], lo que tiene que decir, lo que no)
SABOTAJES = {
    "marca-con-ceros": (
        FACETAS, CATALOGO,
        [("    for valor, cantidad in marcas_contadas.items():\n",
          "    for valor, cantidad in {**{o: 0 for o in opciones_de_marca}, **marcas_contadas}.items():\n")],
        ["escritorio, con Tractores: «marca» ofrece", "celular, con Tractores: «marca» ofrece"],
        ["«potencia» ofrece", "«condicion» ofrece", "«origen» ofrece", "«tipo» ofrece", "no está a la vista"],
    ),
    "marca-nueva-fuera": (
        OTRA_MARCA, MARCAS,
        [("        display_order=orden,\n        is_active=True,\n",
          "        display_order=orden,\n        is_active=False,\n")],
        ["API: el filtro de Tractores ofrece «Agromec» como undefined",
         "pantalla: el filtro no ofrece «Agromec (1)»"],
        ["con «Otra marca» vacía", *AJENOS_A_LA_MARCA],
    ),
    "agromec-segunda": (
        OTRA_MARCA, MARCAS,
        [("        if clave in (clave_de_marca(opcion.label), clave_de_marca(opcion.value)):\n",
          "        if nombre in (opcion.label, opcion.value):\n")],
        ["«AGROMEC » creó otra marca"],
        ["el filtro de Tractores ofrece «Agromec» como", "pantalla: el filtro no ofrece «Agromec (1)»",
         "con «Otra marca» vacía", *AJENOS_A_LA_MARCA],
    ),
    "listas-con-ceros": (
        FACETAS, FILTROS,
        [("      .filter((opcion) => (cuantas.get(valorDe(opcion)) ?? 0) > 0 || valorDe(opcion) === elegida)\n",
          "      .filter(() => true)\n")],
        ["«potencia» ofrece", "«condicion» ofrece"],
        ["«marca» ofrece", "no está a la vista en marca"],
    ),
    "elegida-se-cae": (
        FACETAS, CATALOGO,
        [("    if brand and brand not in marcas_contadas:\n",
          "    if False:\n")],
        ["no está a la vista en marca"],
        ["no está a la vista en tipo", "«potencia» ofrece", "«condicion» ofrece", "«origen» ofrece",
         "con Tractores: «marca» ofrece"],
    ),
    "elegida-se-cae-pantalla": (
        FACETAS, FILTROS,
        [("      .filter((opcion) => (cuantas.get(valorDe(opcion)) ?? 0) > 0 || valorDe(opcion) === elegida)\n",
          "      .filter((opcion) => (cuantas.get(valorDe(opcion)) ?? 0) > 0)\n")],
        ["no está a la vista en tipo"],
        ["no está a la vista en marca", "«marca» ofrece", "con Tractores: «potencia» ofrece"],
    ),
    "contar-con-su-filtro": (
        FACETAS, CATALOGO,
        [("            con_filtros(query, sin)\n",
          "            con_filtros(query)\n")],
        ["escritorio, con «", "celular, con «"],
        ["con Tractores: «", "Tractores ofrece un filtro de tipo"],
    ),
    "sin-candado": (
        OTRA_MARCA, MARCAS,
        [('        db.execute(text("SELECT pg_advisory_xact_lock(:candado)"), {"candado": CANDADO_DE_MARCAS})\n',
          "")],
        ["ocho hilos a la vez con la misma marca nueva devolvieron"],
        ["«AGROMEC »", "el filtro de Tractores ofrece «Agromec» como", "con «Otra marca» vacía",
         "dos altas con «Otra marca» que fallan", *AJENOS_A_LA_MARCA],
    ),
    "marca-antes-de-validar": (
        OTRA_MARCA, PUBLICAR,
        [("    # El tipo y la potencia los decide el SUBRUBRO, que es donde vive la lista.\n"
          "    subrubro = subrubro_de(db, product_data.subcategory_id)\n",
          "    marca_declarada(db, category, product_data.brand, product_data.otra_marca)\n"
          "    subrubro = subrubro_de(db, product_data.subcategory_id)\n")],
        ["una alta rechazada por el tipo dejó creada su marca"],
        ["«AGROMEC »", "el filtro de Tractores ofrece «Agromec» como", "ocho hilos", "/health respondió",
         *AJENOS_A_LA_MARCA],
    ),
    "detalle-sin-rotulo": (
        OTRA_MARCA, CATALOGO,
        [('        "brand_label": (\n', '        "brand_label": None and (\n')],
        ["API: el detalle dice brand_label «null»"],
        ["la ficha dice", "«AGROMEC »", "el filtro de Tractores ofrece", "cuatro altas", *AJENOS_A_LA_MARCA],
    ),
    "sin-minimo": (
        OTRA_MARCA, ESQUEMAS,
        [("    if len(limpio) < marcas.MARCA_MINIMO:\n", "    if False:\n")],
        ["«A» respondió 200"],
        ["41 caracteres respondió", "«--» respondió", "«AGROMEC »", "el filtro de Tractores ofrece",
         "cuatro altas", *AJENOS_A_LA_MARCA],
    ),
    "alta-sin-otra-marca": (
        OTRA_MARCA, ALTA,
        [("        otra_marca: selectedCategory?.usaMarca && brand === OTRA_MARCA ? otraMarca.trim() : undefined,\n",
          "        otra_marca: undefined,\n")],
        ["después del alta, la lista tiene []", "la publicación guardó la marca «(sin marca)»"],
        ["con «Otra marca» vacía", "la API rechaza", "cuatro altas", *AJENOS_A_LA_MARCA],
    ),
    "alta-manda-vacia": (
        OTRA_MARCA, ALTA,
        [("    if (selectedCategory?.usaMarca && brand === OTRA_MARCA && !otraMarca.trim()) {\n",
          "    if (false) {\n")],
        ["con «Otra marca» vacía, el alta mandó la publicación igual"],
        ["después del alta", "«AGROMEC »", "el filtro de Tractores ofrece", "cuatro altas", *AJENOS_A_LA_MARCA],
    ),
    "editar-sin-otra-marca": (
        OTRA_MARCA, EDITAR,
        [("          payload.otra_marca = editingProduct.otraMarca.trim();\n",
          "          void editingProduct.otraMarca;\n")],
        ["«Editar» con «Agrómec» guardó «john-deere»"],
        ["después del alta", "«AGROMEC »", "con «Otra marca» vacía", "cuatro altas", *AJENOS_A_LA_MARCA],
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
    caso, ruta, cambios, deben, no_deben = SABOTAJES[nombre]
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
        veredicto = veredicto_del_caso(caso)
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
    dio = veredicto[0].startswith(f"[FAIL] {caso}") and not faltan and not sobran
    return dio, veredicto, faltan, sobran


def main(pedidos):
    todos = True
    for nombre in pedidos:
        print(f"\n=== {nombre} (caso {SABOTAJES[nombre][0]}) ===", flush=True)
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
