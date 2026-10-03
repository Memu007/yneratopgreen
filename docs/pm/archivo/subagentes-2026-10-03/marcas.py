"""Reproducción PM de los hallazgos del subagente de MARCAS-PANEL-1, contra la API local (e5d592e)."""
import json, subprocess, sys, time, urllib.request, urllib.error

API = "http://localhost:8000/api"
CAT, SUB, LOC = "451a7fca-986f-4f7b-bb78-f7d1494086c2", "08ff462f-0220-4fd8-bb0d-1a36289d779c", "66098050"


def pedir(ruta, method="GET", body=None, token=None):
    req = urllib.request.Request(API + ruta, method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json",
                                          **({"Authorization": f"Bearer {token}"} if token else {})})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        txt = e.read().decode(errors="replace")
        try:
            return e.code, json.loads(txt)
        except Exception:
            return e.code, txt[:200]


def sql(q):
    return subprocess.run(["/usr/bin/docker", "exec", "topgreen-db", "psql", "-U", "topgreen", "-d", "topgreen",
                           "-Atc", q], capture_output=True, text=True).stdout.strip()


def login(email, pw):
    s, d = pedir("/auth/login", "POST", {"email": email, "password": pw})
    assert s == 200, (s, d)
    return d["access_token"]


def publicar(tok, nombre, **extra):
    return pedir("/products", "POST", {
        "name": f"REPRO {nombre}", "description": "Reproducción de PM, no es real.", "price": 1000, "stock": 1,
        "unit": "unidad", "locality_id": LOC, "publication_type": "producto", "operation_kind": "activo",
        "category_id": CAT, "subcategory_id": SUB, "condition": "usado", **extra}, tok)


def opciones_publicas():
    return {o["value"]: o["label"] for o in pedir("/catalog/form-options")[1]["brand"]}


vend = login("vendedor@ejemplo.com", "vendedor123")
admin = login("admin@topgreen.com", "admin123")
caso = sys.argv[1]

if caso == "2":
    # Hallazgo 2: nombre que se expande al normalizar.
    for n, texto in [("A ㎒x25", "㎒" * 25), ("B ⅷx40", "ⅷ" * 40), ("C NUL", "Ab\u0000cd")]:
        antes = set(opciones_publicas())
        s, d = publicar(vend, n, otra_marca=texto)
        nuevas = {v: l for v, l in opciones_publicas().items() if v not in antes}
        print(f"{n}: alta -> {s}; marcas nuevas en la lista pública: {[(v, len(v)) for v in nuevas]}")
        for v in nuevas:
            s2, d2 = publicar(vend, n + " elegida", brand=v)
            s3, _ = publicar(vend, n + " otra vez", otra_marca=texto)
            print(f"   elegirla de la lista -> {s2}; escribirla otra vez -> {s3}")
elif caso == "3":
    antes = set(opciones_publicas())
    s, d = publicar(vend, "huerfana", otra_marca="Marca Huerfana PM")
    pid = d["id"]
    print("alta", s)
    print("borrar", pedir(f"/products/{pid}", "DELETE", token=vend)[0])
    nuevas = [l for v, l in opciones_publicas().items() if v not in antes]
    print("después de borrar la única publicación, sigue en la lista pública:", nuevas)
elif caso == "5":
    s, d = publicar(vend, "jhon", otra_marca="Jhon Deere")
    marca = sql(f"select brand from products where id='{d['id']}'")
    ids = dict(x.split("|") for x in sql("select value, id from form_options where option_type='brand' and value in ('john-deere','%s')" % marca).splitlines())
    print("alta con «Jhon Deere» ->", s, "marca", marca)
    s, d2 = pedir(f"/admin/brands/{ids[marca]}/merge", "POST", {"destino_id": ids["john-deere"]}, admin)
    print("unir a John Deere ->", s, d2 if s != 200 else "")
    s, d3 = publicar(vend, "jhon otra vez", otra_marca="Jhon Deere")
    print("escribir «Jhon Deere» otra vez ->", s, "marca guardada:", sql(f"select brand from products where id='{d3['id']}'"),
          "| en la lista:", sql(f"select value||' activa='||is_active from form_options where option_type='brand' and value='{marca}'"))
elif caso == "4":
    antes = opciones_publicas()
    s, d = publicar(vend, "homoglifo", otra_marca="Kubоta")
    nuevas = {v: l for v, l in opciones_publicas().items() if v not in antes}
    print("alta «Kubоta» (o cirílica) ->", s, "| nuevas:", nuevas, "| kubota ya estaba:", {v: l for v, l in antes.items() if 'kubota' in v})
elif caso == "6":
    s, d = pedir("/catalog/products?brand=marca-que-no-existe&page_size=5")
    print("filtro por marca inexistente ->", s, "total:", d.get("total"), "items:", len(d.get("items", d.get("products", []))))
