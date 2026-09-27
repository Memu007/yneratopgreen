#!/usr/bin/env python3
"""Los rojos discriminantes de PUBLISH-FIELDS-1.

    python3 scripts/sabotajes_publish_fields_1.py                    # todos
    python3 scripts/sabotajes_publish_fields_1.py ficha-sin-marca    # uno

Cada uno rompe el frontend de desarrollo en un solo lugar, corre su caso y
deja el archivo como estaba. Tiene que dar rojo por su motivo, y sólo por él.

  ficha-sin-marca        La ficha deja de dibujar la fila «Marca». El 207
                         tiene que decir que la ficha no dice «Marca: John
                         Deere», y nada de «Editar».
  editar-sin-marca       «Editar» deja de ofrecer el selector de marca. El 207
                         tiene que decir que «Editar» no ofrece la marca, y
                         nada de la ficha.
  conteo-con-operaciones El contador del Mercado vuelve a decir
                         «operaciones». El 208 tiene que nombrar el conteo, y
                         nada de Inicio.

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
FICHA = RAIZ / "src/components/ProductDetail/ProductDetailPage.tsx"
TABLERO = RAIZ / "src/components/UserDashboard/UserDashboard.tsx"
GRILLA = RAIZ / "src/components/ProductGrid/ProductGrid.tsx"

SELECTOR_DE_MARCA = """                  <div className={styles.editFormGroup}>
                    <label htmlFor="edit-marca">Marca</label>
                    <select
                      id="edit-marca"
                      value={editingProduct.marca}
                      onChange={(e) => setEditingProduct({ ...editingProduct, marca: e.target.value })}
                    >
                      <option value="">Sin declarar</option>
                      {marcas.map(opcion => (
                        <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
                      ))}
                      {/* La que tiene y ya no está en la lista se sigue viendo:
                          si no, el selector diría «Sin declarar» sin serlo. */}
                      {editingProduct.marca && !marcas.some(opcion => opcion.value === editingProduct.marca) && (
                        <option value={editingProduct.marca}>{editingProduct.marca}</option>
                      )}
                    </select>
                  </div>
"""

# nombre: (archivo, viejo, nuevo, caso, lo que tiene que decir, lo que no)
SABOTAJES = {
    "ficha-sin-marca": (
        FICHA,
        """          {product.brandName && (
            <div>
              <dt>Marca</dt>
              <dd>{product.brandName}</dd>
            </div>
          )}
""",
        "",
        207,
        ["la ficha con marca dice «Marca: undefined» y no «Marca: John Deere»"],
        ["«Editar» no ofrece la marca", "Características", "Etiquetas"],
    ),
    "editar-sin-marca": (
        TABLERO,
        SELECTOR_DE_MARCA,
        "",
        207,
        ["«Editar» no ofrece la marca"],
        ["la ficha con marca dice", "la ficha sin marca", "Características", "Etiquetas"],
    ),
    "conteo-con-operaciones": (
        GRILLA,
        "<span>{disponibles === 1 ? 'publicación' : 'publicaciones'}</span>",
        "<span>{disponibles === 1 ? 'operación' : 'operaciones'}</span>",
        208,
        ["escritorio: el conteo del Mercado dice", "celular: el conteo del Mercado dice", "OPERACIONES"],
        ["Inicio", "la ficha"],
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
    ruta, viejo, nuevo, caso, deben, no_deben = SABOTAJES[nombre]
    original = ruta.read_bytes()
    roto = reemplazar(original.decode("utf-8"), viejo, nuevo).encode("utf-8")
    antes = {ruta: servido(ruta)}
    durante = {}
    try:
        ruta.write_bytes(roto)
        esperar_a_que_cambie([ruta], antes)
        durante = {ruta: servido(ruta)}
        veredicto = veredicto_del_caso(caso)
    finally:
        ruta.write_bytes(original)
        if durante:
            esperar_a_que_deje(durante)
    # Lo que dijo el caso, sin su título: el título nombra «Inicio» y «la
    # ficha», y lo que interesa es qué problemas encontró.
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
