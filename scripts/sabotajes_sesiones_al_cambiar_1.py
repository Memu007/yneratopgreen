#!/usr/bin/env python3
"""Los rojos discriminantes de SESIONES-AL-CAMBIAR-1.

    python3 scripts/sabotajes_sesiones_al_cambiar_1.py                         # todos
    python3 scripts/sabotajes_sesiones_al_cambiar_1.py acceso-sin-comprobar    # uno

Cada uno rompe un solo lugar, corre el caso 236 y deja el archivo como estaba.
Tiene que dar rojo por su motivo, y sólo por él.

  acceso-sin-comprobar      Las rutas protegidas dejan de mirar la versión de
                            sesiones. Con un token de acceso viejo, la otra
                            sesión sigue entrando.
  renovacion-sin-comprobar  La renovación deja de mirarla. Con un token de
                            renovación viejo, la otra sesión saca tokens nuevos.
  restablecer-no-cierra     Restablecer desde el panel no cierra las sesiones.
  reactivar-revive          Cambiar el estado no las cierra: reactivada la
                            cuenta, la sesión de antes vuelve a servir.
  solo-al-desactivar        Cierra al desactivar y no al reactivar, como en el
                            primer borrador: una cuenta que ya estaba inactiva
                            al desplegar recupera sus sesiones de antes.
  cambio-sin-condicion      El cambio propio cierra aunque su sesión ya no
                            esté vigente: en el choque, le gana al panel.
  suma-en-python            La versión se suma en Python y no en la base, como
                            en el primer borrador: en el choque, los dos
                            escriben el mismo número y el panel pierde.
  token-viejo-afuera        Un token sin la versión deja de servir: al
                            desplegar, todas las cuentas quedarían afuera.
  migracion-sin-valor       La columna nueva no tiene valor por omisión: la
                            migración no puede subir sobre cuentas que ya
                            existen.
  tira-la-nueva             El navegador tira la sesión ante el rechazo del
                            token viejo aunque ya haya guardado la nueva.
  cambio-sin-sesion-nueva   La pantalla no guarda los tokens que devuelve el
                            cambio: quien cambió la contraseña queda afuera.

Los del backend reinician la API antes y después con REINICIAR_API (por
omisión, `./scripts/entorno_nativo.sh --reiniciar-api`). Los de pantalla
esperan a que el servidor de desarrollo sirva el archivo roto, y después el
sano.

Necesita la API en 8000 y el frontend de desarrollo en 5173. El caso crea sus
propias cuentas.
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
DEPENDENCIAS = RAIZ / "backend/app/core/dependencies.py"
AUTH = RAIZ / "backend/app/api/auth.py"
ADMIN = RAIZ / "backend/app/api/admin.py"
MIGRACION = RAIZ / "backend/alembic/versions/20261001_0100_ba10450712c6_version_de_las_sesiones.py"
API_TS = RAIZ / "src/utils/api.ts"
PANTALLA = RAIZ / "src/components/UserDashboard/CambiarClave.tsx"
DEL_FRONTEND = {API_TS, PANTALLA}
REINICIAR_API = os.environ.get("REINICIAR_API", "./scripts/entorno_nativo.sh --reiniciar-api")
CASO = 236

ACCESO = "con el token de acceso, /auth/me responde 200"
RENOVACION = "con el token de renovación, /auth/refresh responde 200"

# nombre: (archivo, [(viejo, nuevo), …], lo que tiene que decir, lo que no)
SABOTAJES = {
    "acceso-sin-comprobar": (
        DEPENDENCIAS,
        [("    if not sesion_vigente(payload, user):\n",
          "    if False and not sesion_vigente(payload, user):\n")],
        [f"A, la otra sesión: {ACCESO}", f"B, una sesión abierta antes de restablecer: {ACCESO}"],
        [RENOVACION, "D, un token", "G:"],
    ),
    "renovacion-sin-comprobar": (
        AUTH,
        [("    # Una renovación de una sesión que la cuenta ya cerró no emite otra.\n"
          "    if not sesion_vigente(payload, user):\n",
          "    # Una renovación de una sesión que la cuenta ya cerró no emite otra.\n"
          "    if False and not sesion_vigente(payload, user):\n")],
        [f"A, la otra sesión: {RENOVACION}", f"B, una sesión abierta antes de restablecer: {RENOVACION}"],
        [ACCESO, "D, un token", "G:"],
    ),
    "restablecer-no-cierra": (
        ADMIN,
        [("    user.password_hash = hash_password(new_password.password)\n"
          "    cerrar_las_sesiones(db, user)\n",
          "    user.password_hash = hash_password(new_password.password)\n")],
        [f"B, una sesión abierta antes de restablecer: {ACCESO}"],
        ["A, ", "C, ", "D, ", "D:", "G:"],
    ),
    "reactivar-revive": (
        ADMIN,
        [("    user.is_active = not user.is_active\n"
          "    # Cambiar el estado cierra sus sesiones: las de antes de desactivarla no\n"
          "    # vuelven a servir cuando se reactiva. También al reactivar, por las\n"
          "    # cuentas que ya estaban inactivas antes de que existiera el cierre.\n"
          "    cerrar_las_sesiones(db, user)\n",
          "    user.is_active = not user.is_active\n")],
        [f"C, con el botón: reactivada, la sesión de antes de desactivarla: {ACCESO}",
         f"D, una cuenta inactiva desde antes de esta pieza, reactivada: su token de antes: {ACCESO}"],
        ["C, con la edición", "A, ", "B, ", "D, el token", "D:", "E, ", "G:"],
    ),
    "solo-al-desactivar": (
        ADMIN,
        [("    # cuentas que ya estaban inactivas antes de que existiera el cierre.\n"
          "    cerrar_las_sesiones(db, user)\n",
          "    # cuentas que ya estaban inactivas antes de que existiera el cierre.\n"
          "    if not user.is_active:\n"
          "        cerrar_las_sesiones(db, user)\n")],
        [f"D, una cuenta inactiva desde antes de esta pieza, reactivada: su token de antes: {ACCESO}"],
        ["C, ", "A, ", "B, ", "D, el token", "D:", "E, ", "G:"],
    ),
    "cambio-sin-condicion": (
        AUTH,
        [("    version = cerrar_las_sesiones(\n"
          "        db, current_user, si_sigue_en=current_user.sesion_version or 0\n"
          "    )\n",
          "    version = cerrar_las_sesiones(db, current_user)\n")],
        ["quedó la contraseña del cambio y no la del panel"],
        ["A, ", "B, ", "C, ", "D, ", "D:", "F:", "G:"],
    ),
    "suma-en-python": (
        DEPENDENCIAS,
        [("    consulta = update(User).where(User.id == user.id)\n"
          "    if si_sigue_en is not None:\n"
          "        consulta = consulta.where(User.sesion_version == si_sigue_en)\n"
          "    version = db.execute(\n"
          "        consulta.values(sesion_version=User.sesion_version + 1)\n"
          "        .returning(User.sesion_version)\n"
          "        .execution_options(synchronize_session=False)\n"
          "    ).scalar_one_or_none()\n"
          "    if version is not None:\n"
          "        set_committed_value(user, \"sesion_version\", version)\n"
          "    return version\n",
          "    user.sesion_version = (user.sesion_version or 0) + 1\n"
          "    return user.sesion_version\n")],
        ["quedó la contraseña del cambio y no la del panel"],
        ["A, ", "B, ", "C, ", "D, ", "D:", "F:", "G:"],
    ),
    "token-viejo-afuera": (
        DEPENDENCIAS,
        [("    return payload.get(\"sv\", 0) == (user.sesion_version or 0)\n",
          "    return payload.get(\"sv\") == (user.sesion_version or 0)\n")],
        ["D, un token de antes de la versión: /auth/me responde 401",
         "D: un token de renovación de antes no renueva: HTTP 401"],
        ["A, ", "B, ", "C, ", "E, ", "F:", "G:"],
    ),
    "migracion-sin-valor": (
        MIGRACION,
        [("        sa.Column('sesion_version', sa.Integer(), nullable=False, server_default='0'),\n",
          "        sa.Column('sesion_version', sa.Integer(), nullable=False),\n")],
        ["G: «railway-entrypoint migrate» salió con 1"],
        ["A, ", "B, ", "C, ", "D, ", "D:", "E, ", "F:"],
    ),
    "tira-la-nueva": (
        API_TS,
        [("    if (tokenStorage.getRefreshToken() !== refreshToken) {\n"
          "      return 'renovado';\n"
          "    }\n",
          "")],
        ["F: después de recargar, la pestaña que cambió la contraseña quedó afuera"],
        ["A, ", "B, ", "C, ", "D, ", "D:", "E, ", "G:", "el otro dispositivo"],
    ),
    "cambio-sin-sesion-nueva": (
        PANTALLA,
        [("      if (sesion.access_token) tokenStorage.setTokens(sesion.access_token, sesion.refresh_token);\n",
          "      void sesion;\n")],
        ["F: después de recargar, la pestaña que cambió la contraseña quedó afuera"],
        ["A, ", "B, ", "C, ", "D, ", "D:", "E, ", "G:", "el otro dispositivo"],
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
