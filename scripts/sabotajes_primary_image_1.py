#!/usr/bin/env python3
"""Los rojos discriminantes de PRIMARY-IMAGE-INTEGRITY-1.

Un caso que sólo pasa no prueba nada: hay que verlo fallar por cada defecto que
dice cuidar. Este script rompe el producto de a una cosa por vez, corre el caso
179 contra la rotura y deja el árbol —y la base— como estaban.

    python3 scripts/sabotajes_primary_image_1.py            # los cuatro
    python3 scripts/sabotajes_primary_image_1.py indice     # uno solo

Los cuatro:

  indice      la migración deduplica pero NO crea el índice único parcial. La
              regla vuelve a depender de que ningún camino se olvide, y una
              segunda principal escrita desde la base entra sin problema. Es el
              negativo que pidió PM.
  dedupe      la migración crea el índice SIN limpiar antes lo que ya estaba
              sucio. Es el motivo por el que los dos pasos van en ese orden:
              `alembic upgrade head` falla sobre datos con duplicados.
  promocion   borrar la principal vuelve a promover «la primera fila que
              devuelva la base», sin orden. La tapa de la publicación queda a
              criterio del planificador de consultas.
  carga       toda imagen subida se marca principal. La segunda carga choca
              contra el índice y la persona recibe un 500 por subir una foto.

Los tres primeros tocan la base: el script baja y vuelve a subir la migración
para que el esquema refleje la versión saboteada, y hace lo mismo al restaurar.
La base local es descartable y se rehace con `./scripts/entorno_nativo.sh
--recrear`; aun así, todo lo que este script toca lo devuelve.
"""
import os
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
MIGRACION = RAIZ / "backend/alembic/versions/20260921_0100_b6d3f12a8e94_una_sola_imagen_principal.py"
PRODUCTOS = RAIZ / "backend/app/api/products.py"


def bloque(texto, fin):
    """Un bloque de lineas con el terminador que use el archivo."""
    return fin.join(texto.split("\n")).encode("utf-8")


def reemplazar_una(datos, viejo, nuevo):
    """Reemplaza el bloque, con CRLF o con LF: el repositorio mezcla los dos."""
    for fin in ("\r\n", "\n"):
        objetivo = bloque(viejo, fin)
        if datos.count(objetivo) == 1:
            return datos.replace(objetivo, bloque(nuevo, fin))
    raise AssertionError(
        f"el ancla no aparece exactamente una vez con ningun terminador: {viejo[:70]!r}")


CREA_EL_INDICE = """    op.create_index(
        INDICE,
        'product_images',
        ['product_id'],
        unique=True,
        postgresql_where=sa.text('is_primary'),
    )
"""

LIMPIA_ANTES = """    conexion.execute(sa.text(\"\"\"
        UPDATE product_images
        SET is_primary = false
        WHERE is_primary
          AND id NOT IN (
              SELECT DISTINCT ON (product_id) id
              FROM product_images
              WHERE is_primary
              ORDER BY product_id, display_order, id
          )
    \"\"\"))
"""


def sabotaje_indice(datos):
    """La migracion limpia pero no deja la restriccion."""
    return reemplazar_una(datos, CREA_EL_INDICE, "")


def sabotaje_dedupe(datos):
    """La migracion crea el indice sin limpiar antes."""
    return reemplazar_una(datos, LIMPIA_ANTES, "")


def sabotaje_promocion(datos):
    """Borrar la principal vuelve a promover cualquiera."""
    return reemplazar_una(
        datos,
        """        siguiente = db.query(ProductImage).filter(
            ProductImage.product_id == product_id
        ).order_by(
            ProductImage.display_order,
            ProductImage.id,
        ).first()
""",
        """        siguiente = db.query(ProductImage).filter(
            ProductImage.product_id == product_id
        ).first()
""",
    )


def sabotaje_carga(datos):
    """Toda imagen subida se declara principal."""
    return reemplazar_una(
        datos,
        "        is_primary = falta_principal and posicion == 0\n",
        "        is_primary = True\n",
    )


SABOTAJES = {
    "indice": (MIGRACION, sabotaje_indice, True,
               "la migracion no crea el indice unico parcial"),
    "dedupe": (MIGRACION, sabotaje_dedupe, True,
               "la migracion crea el indice sin limpiar los duplicados"),
    "promocion": (PRODUCTOS, sabotaje_promocion, True,
                  "borrar la principal promueve cualquiera, sin orden"),
    "carga": (PRODUCTOS, sabotaje_carga, False,
              "toda imagen subida se declara principal"),
}

CASO = 179


def alembic(*argumentos):
    return subprocess.run(
        ["docker", "exec", "topgreen-api", "alembic", *argumentos],
        cwd=RAIZ, capture_output=True, text=True, check=False,
    )


ANTERIOR = "e4a72c9b1f35"
INDICE = "uq_product_images_primaria_unica"


def psql(sentencia):
    return subprocess.run(
        ["docker", "exec", "topgreen-db", "psql", "-U", "topgreen", "-d", "topgreen",
         "-v", "ON_ERROR_STOP=1", "-c", sentencia],
        cwd=RAIZ, capture_output=True, text=True, check=False,
    )


def rehacer_el_esquema():
    """Deja la base en la version del archivo que esta en el arbol AHORA.

    No alcanza con `downgrade` + `upgrade`: la version saboteada `indice` deja
    la base marcada como migrada y sin el indice, asi que el `downgrade` falla
    al intentar retirar algo que no esta y nada se vuelve a crear. Medido: los
    tres sabotajes siguientes corrian sin indice y daban todos el mismo rojo.

    Asi que se lleva la base a un estado conocido y recien despues se corre la
    migracion de verdad:

    1. se retira el indice exista o no;
    2. se deduplica, porque el `create_index` de la version buena necesita
       datos limpios y la saboteada `dedupe` no los deja;
    3. se marca la version anterior SIN ejecutar DDL (`stamp`);
    4. se sube, que es lo unico que se quiere medir.
    """
    psql(f"DROP INDEX IF EXISTS {INDICE}")
    psql(
        "UPDATE product_images SET is_primary = false WHERE is_primary AND id NOT IN ("
        "SELECT DISTINCT ON (product_id) id FROM product_images WHERE is_primary "
        "ORDER BY product_id, display_order, id)"
    )
    alembic("stamp", ANTERIOR)
    return alembic("upgrade", "head")


def reiniciar_la_api():
    subprocess.run(["./scripts/entorno_nativo.sh", "--reiniciar-api"],
                   cwd=RAIZ, capture_output=True, text=True, check=False)


def correr_el_caso():
    proceso = subprocess.run(
        ["node", "scripts/smoke.mjs"],
        cwd=RAIZ, env={**os.environ, "SMOKE_CASOS": str(CASO)},
        capture_output=True, text=True,
    )
    for linea in proceso.stdout.splitlines():
        if linea.startswith("[PASS]") or linea.startswith("[FAIL]"):
            return linea
    return f"(sin veredicto; salida: {proceso.stdout[-300:]})"


def main(pedidos):
    fallaron_todos = True
    for nombre in pedidos:
        ruta, romper, toca_el_esquema, que = SABOTAJES[nombre]
        original = ruta.read_bytes()
        print(f"\n=== sabotaje «{nombre}» (caso {CASO}): {que} ===")
        try:
            ruta.write_bytes(romper(original))
            reiniciar_la_api()
            if toca_el_esquema and ruta == MIGRACION:
                subida = rehacer_el_esquema()
                if subida.returncode != 0:
                    print("  (la migracion saboteada no pudo subir; eso ya es el defecto)")
            veredicto = correr_el_caso()
        finally:
            ruta.write_bytes(original)
            reiniciar_la_api()
            if toca_el_esquema and ruta == MIGRACION:
                rehacer_el_esquema()
        print(veredicto[:400])
        if not veredicto.startswith("[FAIL]"):
            fallaron_todos = False
            print(f"  !! el caso {CASO} NO cazo el sabotaje «{nombre}»")
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
