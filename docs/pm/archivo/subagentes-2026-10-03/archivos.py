"""Reproducción PM del barrido de archivos y registro, contra la API local (e5d592e).
Corre desde backend/ con .venv/bin/python archivos.py <caso>."""
import glob, os, re, subprocess, sys, time, urllib.parse
import httpx

API = "http://localhost:8000/api"
c = httpx.Client(timeout=60)
sello = str(int(time.time()))


def sql(q):
    return subprocess.run(["/usr/bin/docker", "exec", "topgreen-db", "psql", "-U", "topgreen", "-d", "topgreen",
                           "-Atc", q], capture_output=True, text=True).stdout.strip()


def ultimo_token(email):
    for f in sorted(glob.glob("outbox/*.eml"), key=os.path.getmtime, reverse=True):
        t = open(f, encoding="utf-8", errors="replace").read()
        if email in t:
            m = re.search(r"verificar-correo#token=([A-Za-z0-9%_\-=]+)", t.replace("=\n", ""))
            if m:
                return urllib.parse.unquote(m.group(1).replace("=3D", "="))
    return None


caso = sys.argv[1]
if caso == "3":
    v = f"victima.{sello}@example.com"
    print("el atacante registra el correo de la víctima ->",
          c.post(f"{API}/auth/register", json={"email": v, "password": "Atacante123", "full_name": "Atacante"}).status_code)
    print("la víctima intenta registrarse ->",
          c.post(f"{API}/auth/register", json={"email": v, "password": "Victima123", "full_name": "Víctima"}).text[:80])
    print("la víctima pide el enlace ->", c.post(f"{API}/auth/resend-verification", json={"email": v}).status_code)
    tok = ultimo_token(v)
    print("la víctima confirma su correo ->", c.post(f"{API}/auth/verify-email", json={"token": tok}).status_code if tok else "sin token en el outbox")
    print("el atacante entra con SU contraseña ->",
          c.post(f"{API}/auth/login", json={"email": v, "password": "Atacante123"}).status_code)
elif caso == "4":
    a = f"Ana.{sello}@Example.com"
    print("registro con mayúsculas ->", c.post(f"{API}/auth/register", json={"email": a, "password": "Clave1234", "full_name": "Ana"}).status_code)
    sql(f"update users set is_verified=true where email='{a}'")
    print("login con la misma casilla en minúsculas ->", c.post(f"{API}/auth/login", json={"email": a.lower(), "password": "Clave1234"}).status_code)
    print("segunda cuenta con la misma casilla en minúsculas ->",
          c.post(f"{API}/auth/register", json={"email": a.lower(), "password": "Clave1234", "full_name": "Ana 2"}).status_code)
elif caso == "6":
    t = c.post(f"{API}/auth/login", json={"email": "vendedor@ejemplo.com", "password": "vendedor123"}).json()["access_token"]
    vid = sql("select id from users where email='vendedor@ejemplo.com'")
    pid = sql(f"select p.id from products p where seller_id='{vid}' and status='ACTIVE' and "
              "(select count(*) from product_images i where i.product_id=p.id)=0 limit 1")
    png = bytes.fromhex("89504e470d0a1a0a0000000d4948445200000001000000010804000000b51c0c020000000b4944415478da63fc"
                        "ff1f0005fe02fe3a9ae6af0000000049454e44ae426082")
    antes = set(glob.glob("uploads/**/*", recursive=True))
    r = c.post(f"{API}/products/{pid}/images", headers={"Authorization": f"Bearer {t}"},
               files=[("files", ("a.png", png, "image/png")), ("files", ("b.png", png, "image/png")),
                      ("files", ("c.gif", b"GIF89a", "image/gif"))])
    nuevos = [f for f in set(glob.glob("uploads/**/*", recursive=True)) - antes if os.path.isfile(f)]
    print("2 imágenes buenas y un .gif ->", r.status_code, r.text[:90])
    print("archivos nuevos en disco:", len(nuevos), "| filas en product_images de esa publicación:",
          sql(f"select count(*) from product_images where product_id='{pid}'"))
