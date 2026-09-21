#!/usr/bin/env python3
"""Los rojos discriminantes de RISK-REC-1, aplicados y revertidos.

Un caso que sólo pasa no prueba nada: hay que verlo fallar por cada defecto que
dice cuidar. Este script rompe el producto de a una cosa por vez, corre el caso
focal contra la rotura y deja el árbol como estaba.

    python3 scripts/sabotajes_risk_rec_1.py            # los cinco
    python3 scripts/sabotajes_risk_rec_1.py venta      # uno solo

Los cinco:

  venta     el descuento de la transferencia vuelve a ser leer-y-escribir en
            Python, así que dos aceptaciones simultáneas de órdenes distintas
            por la misma última unidad ganan las dos;
  quitar    el resumen del checkout pierde el botón que retira una línea, y la
            única salida vuelve a ser cerrar y descartar lo escrito;
  mudo      el paso de envío deja de dibujar su motivo, así que la acción
            primaria no hace nada y tampoco dice por qué;
  reenvio   el fallo del reenvío vuelve a la caja verde, presentado como si
            hubiera salido;
  frase     el Backend cambia la redacción del motivo de «falta confirmar» —una
            corrección editorial cualquiera— y el ingreso deja de ofrecer el
            reenvío. Es el riesgo R4 hecho ejecutable: no hay defecto hoy, pero
            la pantalla está atada a un texto y esto lo demuestra.

No toca la base ni el entorno: sólo cuatro archivos versionados, y los restaura
en un `finally`. Si algo lo interrumpe, `git checkout -- <archivos>` alcanza.
"""
import os
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ORDENES = RAIZ / "backend/app/api/orders.py"
AUTH = RAIZ / "backend/app/api/auth.py"
CHECKOUT = RAIZ / "src/components/Checkout/CheckoutModal.tsx"
LOGIN = RAIZ / "src/components/Auth/LoginModal.tsx"


def bloque(texto, fin):
    """Un bloque de lineas con el terminador que use el archivo."""
    return fin.join(texto.split("\n")).encode("utf-8")


def reemplazar_una(datos, viejo, nuevo):
    """Reemplaza el bloque, con CRLF o con LF: el repositorio mezcla los dos.

    Se prueban los dos terminadores y se exige que el bloque aparezca UNA vez
    con exactamente uno de ellos. Un sabotaje que no encuentra su ancla no es
    un sabotaje: es un caso que pasa por casualidad.
    """
    for fin in ("\r\n", "\n"):
        objetivo = bloque(viejo, fin)
        if datos.count(objetivo) == 1:
            return datos.replace(objetivo, bloque(nuevo, fin))
    raise AssertionError(
        f"el ancla no aparece exactamente una vez con ningun terminador: {viejo[:70]!r}")


def sabotaje_venta(datos):
    """El descuento vuelve a ser dos pasos: leer y despues escribir."""
    return reemplazar_una(
        datos,
        """        try:
            stock.vender(db, order)
        except HTTPException:
            db.rollback()
            raise
""",
        """        for item in order.items:
            if item.product and not stock.hay_para(item.product, item.quantity):
                raise HTTPException(
                    status_code=400,
                    detail=f"Stock insuficiente para {item.product.name}",
                )
        for item in order.items:
            product = item.product
            is_service = product.category.is_service if product and product.category else False
            if product and not is_service:
                product.stock = (product.stock or 0) - item.quantity
                product.sales_count = (product.sales_count or 0) + item.quantity
""",
    )


def sabotaje_quitar(datos):
    """El resumen pierde el verbo: se puede mirar, no corregir."""
    return reemplazar_una(
        datos,
        """              <button
                type="button"
                className={styles.summaryItemQuitar}
                onClick={() => quitarDelCarrito(item.product.id)}
              >
                Quitar del carrito
              </button>
""",
        "",
    )


def sabotaje_mudo(datos):
    """El paso de envio vuelve a comerse su propio motivo."""
    return reemplazar_una(
        datos,
        """          existía; le faltaba el lugar. */}
      {error && (
        <div className={styles.errorMessage} role="alert">
          {error}
        </div>
      )}
""",
        """          existía; le faltaba el lugar. */}
""",
    )


def sabotaje_reenvio(datos):
    """El fallo del reenvio vuelve a la caja del exito."""
    return reemplazar_una(
        datos,
        """            <div
              className={elReenvioFallo ? styles.error : styles.success}
              role={elReenvioFallo ? 'alert' : 'status'}
            >
""",
        """            <div className={styles.success} role="status">
""",
    )


def sabotaje_frase(datos):
    """El Backend mejora la redaccion del motivo. Nada mas que eso."""
    return reemplazar_una(
        datos,
        '    "Tu cuenta todavía no está confirmada. Buscá el correo que te enviamos o "\n',
        '    "Todavía falta confirmar tu cuenta. Buscá el correo que te enviamos o "\n',
    )


SABOTAJES = {
    "venta": (ORDENES, sabotaje_venta, 176,
              "el descuento de la transferencia vuelve a leer y escribir en dos pasos"),
    "quitar": (CHECKOUT, sabotaje_quitar, 178,
               "el resumen del checkout pierde el boton que retira una linea"),
    "mudo": (CHECKOUT, sabotaje_mudo, 176,
             "el paso de envio deja de dibujar su motivo"),
    "reenvio": (LOGIN, sabotaje_reenvio, 177,
                "el fallo del reenvio vuelve a presentarse como exito"),
    "frase": (AUTH, sabotaje_frase, 177,
              "el Backend cambia la redaccion del motivo de falta de confirmacion"),
}

DEL_BACKEND = {ORDENES, AUTH}


def correr_el_caso(numero):
    proceso = subprocess.run(
        ["node", "scripts/smoke.mjs"],
        cwd=RAIZ, env={**os.environ, "SMOKE_CASOS": str(numero)},
        capture_output=True, text=True,
    )
    for linea in proceso.stdout.splitlines():
        if linea.startswith("[PASS]") or linea.startswith("[FAIL]"):
            return linea
    return f"(sin veredicto; salida: {proceso.stdout[-300:]})"


def reiniciar_la_api():
    subprocess.run(["./scripts/entorno_nativo.sh", "--reiniciar-api"],
                   cwd=RAIZ, capture_output=True, text=True, check=False)


def main(pedidos):
    fallaron_todos = True
    for nombre in pedidos:
        ruta, romper, caso, que = SABOTAJES[nombre]
        original = ruta.read_bytes()
        print(f"\n=== sabotaje «{nombre}» (caso {caso}): {que} ===")
        try:
            ruta.write_bytes(romper(original))
            if ruta in DEL_BACKEND:
                reiniciar_la_api()
            veredicto = correr_el_caso(caso)
        finally:
            ruta.write_bytes(original)
            if ruta in DEL_BACKEND:
                reiniciar_la_api()
        print(veredicto[:400])
        if not veredicto.startswith("[FAIL]"):
            fallaron_todos = False
            print(f"  !! el caso {caso} NO cazo el sabotaje «{nombre}»")
    print("\n" + ("todos los sabotajes dieron rojo" if fallaron_todos
                  else "ATENCION: algun sabotaje paso sin rojo"))
    return 0 if fallaron_todos else 1


if __name__ == "__main__":
    pedidos = sys.argv[1:] or list(SABOTAJES)
    desconocidos = [p for p in pedidos if p not in SABOTAJES]
    if desconocidos:
        print(f"sabotajes desconocidos: {desconocidos}; hay {list(SABOTAJES)}")
        raise SystemExit(2)
    raise SystemExit(main(pedidos))
