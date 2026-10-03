"""Reproducción PM de los hallazgos del subagente de sesiones, contra la API local (e5d592e).
Corre con el python del venv del backend, desde backend/ (PYTHONPATH=.)."""
import base64, json, sys, threading, time, urllib.request, urllib.error
import psycopg
from app.core.security import hash_password

API = "http://localhost:8000/api"
DB = "postgresql://topgreen:pm_local_inventado_1@localhost:5433/topgreen"
EMAIL, VIEJA = "cliente@ejemplo.com", "cliente123"


def pedir(ruta, method="GET", body=None, token=None):
    req = urllib.request.Request(API + ruta, method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json",
                                          **({"Authorization": f"Bearer {token}"} if token else {})})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        t = e.read().decode(errors="replace")
        try:
            return e.code, json.loads(t)
        except Exception:
            return e.code, t[:150]


def sv(tok):
    p = tok.split(".")[1]
    return json.loads(base64.urlsafe_b64decode(p + "=" * (-len(p) % 4))).get("sv")


def poner_clave(clave):
    with psycopg.connect(DB) as c:
        c.execute("update users set password_hash=%s where email=%s", (hash_password(clave), EMAIL))


caso = sys.argv[1]
if caso == "1":
    poner_clave(VIEJA)
    resultado = {}
    a = psycopg.connect(DB)
    v0 = a.execute("select sesion_version from users where email=%s for update", (EMAIL,)).fetchone()[0]
    hilo = threading.Thread(target=lambda: resultado.update(r=pedir("/auth/login", "POST", {"email": EMAIL, "password": VIEJA})))
    hilo.start()
    time.sleep(3)  # el login ya verificó la clave vieja y espera la fila
    print("login todavía en curso (esperando la fila):", hilo.is_alive())
    # Lo mismo que confirma change_password / reset-password: versión +1 y hash nuevo.
    a.execute("update users set sesion_version=sesion_version+1, password_hash=%s where email=%s",
              (hash_password("NuevaClavePM1"), EMAIL))
    a.commit()
    hilo.join()
    s, d = resultado["r"]
    print(f"versión antes {v0}; login con la clave VIEJA -> {s}; el token firma sv={sv(d['access_token'])}")
    print("/auth/me con ese token, DESPUÉS del cambio ->", pedir("/auth/me", token=d["access_token"])[0])
    s2, d2 = pedir("/auth/refresh", "POST", token=d["refresh_token"])
    print("/auth/refresh con su refresh ->", s2, "| y el renovado sirve:", pedir("/auth/me", token=d2["access_token"])[0] if s2 == 200 else "-")
    print("login nuevo con la clave vieja ->", pedir("/auth/login", "POST", {"email": EMAIL, "password": VIEJA})[0])
    poner_clave(VIEJA)
elif caso == "2":
    poner_clave(VIEJA)
    tok = pedir("/auth/login", "POST", {"email": EMAIL, "password": VIEJA})[1]["access_token"]
    codigos = [pedir("/auth/change-password", "POST", {"current_password": f"mala{i}", "new_password": "xxxxxxxx"}, tok)[0]
               for i in range(50)]
    print("50 intentos con la clave actual equivocada ->", {c: codigos.count(c) for c in set(codigos)})
    s, _ = pedir("/auth/change-password", "POST", {"current_password": VIEJA, "new_password": "AdivinadaPM1"}, tok)
    print("intento 51, con la correcta ->", s)
    poner_clave(VIEJA)
elif caso == "3":
    poner_clave(VIEJA)
    d = pedir("/auth/login", "POST", {"email": EMAIL, "password": VIEJA})[1]
    r1 = d["refresh_token"]
    s, d2 = pedir("/auth/refresh", "POST", token=r1)
    print("refresh con R1 ->", s)
    print("refresh OTRA VEZ con R1 (ya rotado) ->", pedir("/auth/refresh", "POST", token=r1)[0])
    print("logout ->", pedir("/auth/logout", "POST", token=d2["access_token"])[0])
    print("después del logout: /auth/me con el access ->", pedir("/auth/me", token=d2["access_token"])[0],
          "| refresh con R2 ->", pedir("/auth/refresh", "POST", token=d2["refresh_token"])[0])
elif caso == "4":
    d = pedir("/auth/login", "POST", {"email": "admin@topgreen.com", "password": "admin123"})[1]
    yo = pedir("/auth/me", token=d["access_token"])[1]["id"]
    s, _ = pedir(f"/admin/users/{yo}/reset-password", "POST", {"password": "NuevaAdminPM1"}, d["access_token"])
    print("admin restablece SU PROPIA clave sin dar la actual ->", s)
    print("/auth/me con su token ->", pedir("/auth/me", token=d["access_token"])[0])
    print("login con la clave nueva ->", pedir("/auth/login", "POST", {"email": "admin@topgreen.com", "password": "NuevaAdminPM1"})[0])
    with psycopg.connect(DB) as c:
        c.execute("update users set password_hash=%s where email='admin@topgreen.com'", (hash_password("admin123"),))
