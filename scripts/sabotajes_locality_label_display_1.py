#!/usr/bin/env python3
"""Los rojos discriminantes de LOCALITY-LABEL-DISPLAY-1.

Una localidad homónima tiene que mostrar su departamento en la tarjeta, en la
ficha y en la base del transportista del checkout. Este script rompe una cosa
por vez, corre el caso 189 y comprueba que falle nombrando dónde falta.

    python3 scripts/sabotajes_locality_label_display_1.py                      # los cuatro
    python3 scripts/sabotajes_locality_label_display_1.py codigo-de-la-base    # uno solo

Los cuatro:

  codigo-de-la-base       backend y pantalla vuelven a la base de la tarea. El
                          caso tiene que fallar en la tarjeta, que dice «San
                          Pedro, Santiago del Estero». Es el negativo que pidió
                          PM.
  ficha-sin-rotulo        la ficha deja de recibir el rótulo. La tarjeta sigue
                          bien y la ficha dice «San Pedro, Santiago del
                          Estero».
  checkout-con-el-nombre  el checkout vuelve a mostrar el nombre de la base.
                          Dice «Base: San Pedro, Santiago del Estero».
  rotulo-sin-cortes       la ubicación de la tarjeta no se parte en renglones.
                          El rótulo más largo del padrón no entra a 360 px.

Necesita la API en 8000, el frontend de desarrollo en 5173 y la siembra demo.
Cuando rompe el backend reinicia la API, antes y después. No toca la base: las
publicaciones del caso las crea y las retira el propio caso, y el
transportista que registra es una cuenta nueva. Todo lo que cambia lo deja
como estaba.
"""
import os
import subprocess
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
# Esperar a que el frontend de desarrollo sirva un archivo cambiado, y a que
# deje de servirlo, es lo mismo que en las piezas anteriores.
from sabotajes_product_detail_page_1 import (  # noqa: E402
    esperar_a_que_cambie, esperar_a_que_deje, servido)

RAIZ = Path(__file__).resolve().parent.parent
BACK = [RAIZ / f"backend/app/{r}" for r in (
    "services/padron.py", "api/catalog.py", "schemas/catalog.py",
    "api/logistics.py", "schemas/logistics.py", "models/user.py", "schemas/auth.py",
    "api/orders.py")]
FRONT = [RAIZ / f"src/{r}" for r in (
    "utils/catalogService.ts", "components/Checkout/CheckoutModal.tsx",
    "components/UserDashboard/UserDashboard.tsx", "types/index.ts", "contexts/AuthContext.tsx",
    "components/ProductCard/ProductCard.module.css")]
# Sólo tipos: lo que sirve el frontend de desarrollo no cambia, así que no hay
# cambio que esperar. Se restaura igual que los demás.
SOLO_TIPOS = RAIZ / "src/types/index.ts"
CATALOGO = RAIZ / "backend/app/api/catalog.py"
CHECKOUT = RAIZ / "src/components/Checkout/CheckoutModal.tsx"
TARJETA = RAIZ / "src/components/ProductCard/ProductCard.module.css"
# La base de la tarea: el commit de PM que la asignó.
BASE = "d6c19f4"


def git(*argumentos):
    return subprocess.run(["git", *argumentos], cwd=RAIZ, capture_output=True, check=True).stdout


def cambiar(ruta, viejo, nuevo):
    """A nivel de bytes: los archivos mezclan finales de línea y no se tocan
    los que no son del sabotaje."""
    def aplicar():
        original = ruta.read_bytes()
        assert original.count(viejo) == 1, f"{ruta.name} ya no tiene exactamente una vez: {viejo[:70]!r}"
        ruta.write_bytes(original.replace(viejo, nuevo))
        return {ruta: original}
    return aplicar


def codigo_de_la_base():
    guardado = {}
    for ruta in [*BACK, *FRONT]:
        guardado[ruta] = ruta.read_bytes()
        ruta.write_bytes(git("show", f"{BASE}:{ruta.relative_to(RAIZ).as_posix()}"))
    return guardado


SABOTAJES = {
    "codigo-de-la-base": (
        codigo_de_la_base,
        lambda v: (v.startswith("[FAIL]") and "la tarjeta de «Homonima189 Choya" in v
                   and "falta el departamento" in v),
        "falla en la tarjeta, que no dice el departamento",
    ),
    "ficha-sin-rotulo": (
        cambiar(CATALOGO,
                b"            locality_label=padron.rotulos(db, [product.locality.id]).get(\r\n"
                b"                product.locality.id, product.locality.name),\r\n",
                b""),
        lambda v: (v.startswith("[FAIL]") and "la ficha de «Homonima189 Choya" in v
                   and "falta el departamento" in v),
        "falla en la ficha, que no dice el departamento",
    ),
    "checkout-con-el-nombre": (
        cambiar(CHECKOUT, b"Base: {carrier.base_locality_label}", b"Base: {carrier.base_locality_name}"),
        lambda v: (v.startswith("[FAIL]") and "la base del transportista en el checkout" in v
                   and "falta el departamento" in v),
        "falla en la base del transportista del checkout",
    ),
    "rotulo-sin-cortes": (
        cambiar(TARJETA,
                b".ubicacion {\n  color: var(--tg-color-text-secondary);\n  font-size: 13px;\n}",
                b".ubicacion {\n  color: var(--tg-color-text-secondary);\n  font-size: 13px;\n  white-space: nowrap;\n}"),
        lambda v: v.startswith("[FAIL]") and "la tarjeta a 360 px" in v,
        "falla porque el rótulo más largo no entra en la tarjeta a 360 px",
    ),
}


def caso_189():
    proceso = subprocess.run(
        ["node", "scripts/smoke.mjs"], cwd=RAIZ, capture_output=True, text=True,
        env={**os.environ, "SMOKE_CASOS": "189"}, timeout=600,
    )
    for linea in proceso.stdout.splitlines():
        if linea.startswith("[PASS]") or linea.startswith("[FAIL]"):
            return linea
    return f"(sin veredicto; salida: {proceso.stdout[-300:]})"


def reiniciar_la_api():
    subprocess.run(["./scripts/entorno_nativo.sh", "--reiniciar-api"],
                   cwd=RAIZ, capture_output=True, text=True, check=True)


def main(pedidos):
    todos = True
    for nombre in pedidos:
        aplicar, esperado, que = SABOTAJES[nombre]
        print(f"\n=== {nombre}: {que} ===", flush=True)
        antes = {r: servido(r) for r in FRONT if r != SOLO_TIPOS}
        guardado, durante = {}, {}
        veredicto = "(el caso no llegó a correr)"
        try:
            guardado = aplicar()
            toca_el_backend = any(r in guardado and r.read_bytes() != guardado[r] for r in BACK)
            if toca_el_backend:
                reiniciar_la_api()
            cambiados = [r for r in FRONT if r in guardado and r != SOLO_TIPOS
                         and r.read_bytes() != guardado[r]]
            if cambiados:
                esperar_a_que_cambie(cambiados, {r: antes[r] for r in cambiados})
                durante = {r: servido(r) for r in cambiados}
            veredicto = caso_189()
        finally:
            for ruta, datos in guardado.items():
                ruta.write_bytes(datos)
            if any(r in guardado for r in BACK):
                reiniciar_la_api()
            if durante:
                esperar_a_que_deje(durante)
        dio = esperado(veredicto)
        print(("[ROJO ESPERADO] " if dio else "[NO DISCRIMINA] ") + veredicto[:600], flush=True)
        todos = todos and dio
    estado = git("status", "--porcelain", "--", "src", "backend").decode().strip()
    print(f"\nsrc y backend despues: {estado or 'como estaban'}")
    print("todos dieron el rojo esperado" if todos else "ATENCION: alguno no discriminó")
    return 0 if todos else 1


if __name__ == "__main__":
    pedidos = sys.argv[1:] or list(SABOTAJES)
    desconocidos = [p for p in pedidos if p not in SABOTAJES]
    if desconocidos:
        print(f"sabotajes desconocidos: {desconocidos}; hay {list(SABOTAJES)}")
        raise SystemExit(2)
    raise SystemExit(main(pedidos))
