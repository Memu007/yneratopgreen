"""Reproducción PM del barrido de permisos y datos personales, contra la API local (e5d592e).
Corre con el python del venv del backend: .venv/bin/python permisos.py <caso>."""
import subprocess, sys, threading
import httpx

API = "http://localhost:8000/api"
c = httpx.Client(timeout=60)


def sql(q):
    return subprocess.run(["/usr/bin/docker", "exec", "topgreen-db", "psql", "-U", "topgreen", "-d", "topgreen",
                           "-Atc", q], capture_output=True, text=True).stdout.strip()


def tok(email, pw):
    r = c.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, (email, r.status_code, r.text[:200])
    return r.json()["access_token"]


H = lambda t: {"Authorization": f"Bearer {t}"}
VEND, COMP, TRANS, ADM = (tok("vendedor@ejemplo.com", "vendedor123"), tok("cliente@ejemplo.com", "cliente123"),
                          tok("transportista@ejemplo.com", "transportista123"), tok("admin@topgreen.com", "admin123"))
VID = sql("select id from users where email='vendedor@ejemplo.com'")
CID = sql("select id from users where email='transportista@ejemplo.com'")
LOC = sql("select id from localities where name='Pergamino' and province_name='Buenos Aires' limit 1")
PROD = sql(f"select id from products where seller_id='{VID}' and status='ACTIVE' and publication_type='producto' "
           "and stock >= 5 order by created_at limit 1")
if len(sys.argv) > 2 and sys.argv[2] == "cerca":  # sólo en la base local: el origen dentro del radio del transportista
    sql(f"update products set locality_id='{LOC}' where id='{PROD}'")
stock = lambda: int(sql(f"select stock from products where id='{PROD}'"))


def carrito():
    c.delete(f"{API}/cart", headers=H(COMP))
    r = c.post(f"{API}/cart/sync", headers=H(COMP), json={"items": [{"product_id": PROD, "quantity": 1}]})
    assert r.status_code == 200, r.text[:200]


def checkout_transferencia(modo="self"):
    carrito()
    dec = {"seller_id": VID, "mode": modo, **({"carrier_id": CID} if modo == "carrier" else {})}
    r = c.post(f"{API}/orders/checkout/transfer", headers=H(COMP), json={
        "shipping_address": "Ruta 8 km 220", "shipping_locality_id": LOC, "shipping_postal_code": "2700",
        "shipping_decisions": [dec]})
    return r


def orden_pagada():
    r = checkout_transferencia()
    assert r.status_code in (200, 201), r.text[:300]
    oid = r.json()["orders"][0]["order_id"]
    png = bytes.fromhex("89504e470d0a1a0a0000000d4948445200000001000000010804000000b51c0c020000000b4944415478da63fc"
                        "ff1f0005fe02fe3a9ae6af0000000049454e44ae426082")
    up = c.post(f"{API}/orders/{oid}/transfer-receipt", headers=H(COMP), files={"file": ("comp.png", png, "image/png")})
    ap = c.patch(f"{API}/orders/{oid}/transfer-receipt", headers=H(VEND), json={"decision": "approve"})
    return oid, up, ap


caso = sys.argv[1]
if caso == "1":
    carrito()
    r = c.get(f"{API}/orders/payment-options", headers=H(COMP))
    print("payment-options ->", r.status_code, "| trae CBU del vendedor sin orden:",
          any(o.get("cbu") for o in (r.json() if isinstance(r.json(), list) else r.json().get("opciones", r.json().get("options", [])))) if r.status_code == 200 else r.text[:200])
    print("   (respuesta, recortada):", r.text[:300])
elif caso == "2":
    print("admin suspende ->", c.patch(f"{API}/admin/products/{PROD}/status", headers=H(ADM), json={"status": "paused"}).status_code)
    print("vendedor la reactiva ->", c.patch(f"{API}/products/{PROD}", headers=H(VEND), json={"status": "active"}).status_code)
    print("ficha pública sin sesión ->", c.get(f"{API}/catalog/products/{PROD}").status_code,
          "| estado en la base:", sql(f"select status from products where id='{PROD}'"))
elif caso == "3":
    s0 = stock()
    oid, up, ap = orden_pagada()
    print("comprobante", up.status_code, "| aprobar", ap.status_code, "| estado", sql(f"select status from orders where id='{oid}'"), "| stock", s0, "->", stock())
    print("vendedor confirma ->", c.patch(f"{API}/orders/{oid}/status", headers=H(VEND), json={"status": "confirmed"}).status_code)
    r = c.post(f"{API}/orders/{oid}/cancel", headers=H(COMP), json={"reason": "x"})
    print("COMPRADOR cancela orden pagada y confirmada ->", r.status_code, r.text[:80], "| estado", sql(f"select status from orders where id='{oid}'"), "| stock", stock())
    url = up.json().get("transfer_receipt_url") if up.status_code == 200 else None
    if url:
        full = url if url.startswith("http") else "http://localhost:8000" + url
        print("caso 5: comprobante sin sesión", url, "->", httpx.get(full).status_code)
elif caso == "4":
    print("admin desactiva al vendedor ->", c.post(f"{API}/admin/users/{VID}/toggle-active", headers=H(ADM)).status_code,
          "| is_active:", sql(f"select is_active from users where id='{VID}'"))
    try:
        r = c.get(f"{API}/catalog/products", params={"seller_id": VID, "page_size": 3})
        print("catálogo público con sus publicaciones ->", r.status_code, "total", r.json().get("total"))
        print("ficha ->", c.get(f"{API}/catalog/products/{PROD}").status_code)
        r = checkout_transferencia()
        print("comprar al vendedor desactivado ->", r.status_code, r.text[:120])
    finally:
        c.post(f"{API}/admin/users/{VID}/toggle-active", headers=H(ADM))
        print("restaurado, is_active:", sql(f"select is_active from users where id='{VID}'"))
elif caso == "6":
    carrito()
    r = c.get(f"{API}/logistics/compatible-carriers", headers=H(COMP), params={"destination_locality_id": LOC})
    print("compatibles ->", r.status_code, r.text[:200])
    r = c.post(f"{API}/logistics/select-carrier", headers=H(COMP), json={"destination_locality_id": LOC, "seller_id": VID, "carrier_id": CID})
    print("elegir (sin comprar) ->", r.status_code, {k: v for k, v in (r.json().get("carrier", r.json()) if r.status_code == 200 else {}).items() if k in ("email", "phone", "whatsapp", "plate")})
elif caso == "7":
    r = checkout_transferencia("carrier")
    print("checkout con transportista ->", r.status_code, r.text[:150])
    if r.status_code in (200, 201):
        oid = r.json()["orders"][0]["order_id"]
        ve = lambda: oid in c.get(f"{API}/logistics/my-operations", headers=H(TRANS)).text
        print("el transportista la ve sin pagar:", ve())
        print("comprador cancela ->", c.post(f"{API}/orders/{oid}/cancel", headers=H(COMP), json={"reason": "x"}).status_code,
              "| estado", sql(f"select status from orders where id='{oid}'"), "| el transportista la sigue viendo:", ve())
elif caso == "8":
    oid, up, ap = orden_pagada()
    for st, quien in (("confirmed", VEND), ("shipped", VEND), ("delivered", COMP)):
        print(st, c.patch(f"{API}/orders/{oid}/status", headers=H(quien), json={"status": st}).status_code, end="; ")
    print()
    res = []
    barrera = threading.Barrier(4)

    def calificar(i):
        barrera.wait()
        res.append(httpx.post(f"{API}/ratings/", headers=H(COMP), json={"order_id": oid, "score": 1, "comment": f"PM {i}"}, timeout=60).status_code)
    hilos = [threading.Thread(target=calificar, args=(i,)) for i in range(4)]
    [h.start() for h in hilos]; [h.join() for h in hilos]
    print("4 calificaciones simultáneas ->", res, "| filas en la base para esa orden y ese comprador:",
          sql(f"select count(*) from ratings where order_id='{oid}'"))
