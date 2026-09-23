#!/usr/bin/env python3
"""Los rojos discriminantes de PRODUCT-DETAIL-PAGE-1.

Un caso que sólo pasa no prueba nada: hay que verlo fallar por cada defecto que
dice cuidar. Este script rompe el frontend de a una cosa por vez, corre el caso
183 contra la rotura y deja el árbol como estaba.

    python3 scripts/sabotajes_product_detail_page_1.py           # los cuatro
    python3 scripts/sabotajes_product_detail_page_1.py modal     # uno solo

Los cuatro:

  modal               todo `src/` vuelve a la base de la tarea, con el detalle
                      como capa. Es el negativo que pidió PM: el caso tiene que
                      fallar con el modal anterior.
  sin-url             abrir la ficha no cambia la barra, como hacía la capa: no
                      se puede compartir ni recargar.
  sin-regreso         Atrás deja la ficha pero no devuelve la vista al punto ni
                      el foco al enlace que la abrió.
  recarga-del-origen  mientras la ficha está arriba, el Mercado deja de estar
                      activo: al volver se pide de nuevo y rehace sus tarjetas.

No toca la base ni la API. El frontend de desarrollo toma los archivos al
vuelo, y el script espera a que los sirva cambiados —una condición, no un
tiempo— antes de correr el caso.
"""
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CASO = 183
# La base de la tarea: el commit de PM que la asignó, con el detalle como capa.
BASE = "3508d48"
FRONT = "http://localhost:5173"
NAVEGACION = RAIZ / "src/navegacion/navegacion.ts"
APP = RAIZ / "src/App.tsx"


def bloque(texto, fin):
    return fin.join(texto.split("\n")).encode("utf-8")


def reemplazar_una(datos, viejo, nuevo):
    """Reemplaza el bloque, con CRLF o con LF: el repositorio mezcla los dos."""
    for fin in ("\r\n", "\n"):
        objetivo = bloque(viejo, fin)
        if datos.count(objetivo) == 1:
            return datos.replace(objetivo, bloque(nuevo, fin))
    raise AssertionError(
        f"el ancla no aparece exactamente una vez con ningun terminador: {viejo[:70]!r}")


def servido(ruta):
    """Lo que el frontend de desarrollo sirve para un archivo de `src/`."""
    try:
        url = f"{FRONT}/{ruta.relative_to(RAIZ).as_posix()}"
        with urllib.request.urlopen(url, timeout=5) as respuesta:
            return respuesta.read()
    except OSError:
        return None


def retocar(rutas):
    """Vuelve a escribir los archivos tal como están.

    Medido: con dos escrituras seguidas sobre el mismo archivo —restaurar un
    sabotaje y aplicar el siguiente— el vigilante del frontend de desarrollo
    puede perder la segunda, y el archivo nuevo no se sirve nunca. Escribirlo
    de nuevo dispara otro aviso; no cambia su contenido."""
    for ruta in rutas:
        if ruta.exists():
            ruta.write_bytes(ruta.read_bytes())


def esperar(condicion, rutas, mensaje):
    """Hasta que se cumpla, retocando cada 5 s por si se perdió el aviso."""
    for vuelta in range(150):
        if condicion():
            return
        if vuelta and vuelta % 25 == 0:
            retocar(rutas)
        time.sleep(0.2)
    raise SystemExit(mensaje)


def esperar_a_que_cambie(rutas, antes):
    """Hasta que el frontend sirva cada archivo distinto de como lo servía."""
    esperar(lambda: all(servido(r) != antes[r] for r in rutas), rutas,
            "el frontend no tomo el cambio en 30 s")


def git(*argumentos):
    return subprocess.run(["git", *argumentos], cwd=RAIZ, capture_output=True, check=True).stdout


def cambios_desde_la_base():
    """(estado, ruta) de todo `src/` que difiere de la base, sin renombres."""
    salida = git("diff", "--no-renames", "--name-status", BASE, "--", "src").decode()
    return [(linea.split("\t")[0], RAIZ / linea.split("\t")[1])
            for linea in salida.splitlines() if linea.strip()]


def aplicar_modal():
    """Vuelve `src/` a la base. Devuelve con qué restaurar y qué mirar."""
    guardado = {}
    mirar = []
    for estado, ruta in cambios_desde_la_base():
        guardado[ruta] = ruta.read_bytes() if ruta.exists() else None
        if estado == "A":
            ruta.unlink()
        else:
            ruta.parent.mkdir(parents=True, exist_ok=True)
            ruta.write_bytes(git("show", f"{BASE}:{ruta.relative_to(RAIZ).as_posix()}"))
            if estado == "M":
                mirar.append(ruta)
    return guardado, mirar


def restaurar(guardado):
    for ruta, datos in guardado.items():
        if datos is None:
            if ruta.exists():
                ruta.unlink()
        else:
            ruta.write_bytes(datos)


def un_archivo(ruta, romper):
    def aplicar():
        original = ruta.read_bytes()
        ruta.write_bytes(romper(original))
        return {ruta: original}, [ruta]
    return aplicar


SABOTAJES = {
    "modal": (aplicar_modal, "src/ vuelve a la base, con el detalle como capa"),
    "sin-url": (un_archivo(NAVEGACION, lambda d: reemplazar_una(
        d,
        "    window.history.pushState({ origen: desde }, '', urlDe('product', null, id));",
        "    window.history.pushState({ origen: desde }, '', barraActual());",
    )), "abrir la ficha no cambia la barra"),
    "sin-regreso": (un_archivo(NAVEGACION, lambda d: reemplazar_una(
        d,
        "    volverAlPunto(regreso.desplazamiento, regreso.ficha, regreso.enlace);",
        "    void regreso;",
    )), "Atras no devuelve la vista al punto ni el foco"),
    "recarga-del-origen": (un_archivo(APP, lambda d: reemplazar_una(
        d,
        "  const pantallaDeTrabajo: Seccion = currentSection === 'product' && navegacion.origenDeLaFicha\n"
        "    ? navegacion.origenDeLaFicha\n"
        "    : currentSection;",
        "  const pantallaDeTrabajo: Seccion = currentSection;",
    )), "el Mercado se pide de nuevo al volver de la ficha"),
}


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


def vigilados_de(nombre):
    """Qué archivos mirar en el frontend para saber que tomó el cambio."""
    if nombre == "modal":
        return [r for estado, r in cambios_desde_la_base() if estado == "M"]
    return [APP if nombre == "recarga-del-origen" else NAVEGACION]


def esperar_a_que_deje(durante):
    """Hasta que el frontend deje de servir la versión rota.

    No se compara con lo de antes: después de un cambio el frontend de
    desarrollo marca sus importaciones con la hora (`?t=…`), así que lo
    restaurado no vuelve a ser idéntico byte a byte a lo que servía antes."""
    esperar(lambda: all(servido(r) != durante[r] for r in durante), list(durante),
            "el frontend siguio sirviendo la version rota 30 s despues de restaurar")


def main(pedidos):
    fallaron_todos = True
    for nombre in pedidos:
        aplicar, que = SABOTAJES[nombre]
        print(f"\n=== sabotaje «{nombre}» (caso {CASO}): {que} ===")
        antes = {r: servido(r) for r in vigilados_de(nombre)}
        guardado = {}
        durante = {}
        veredicto = "(el caso no llego a correr)"
        try:
            guardado, mirar = aplicar()
            esperar_a_que_cambie(mirar, antes)
            durante = {r: servido(r) for r in mirar}
            veredicto = correr_el_caso()
        finally:
            restaurar(guardado)
            if durante:
                esperar_a_que_deje(durante)
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
