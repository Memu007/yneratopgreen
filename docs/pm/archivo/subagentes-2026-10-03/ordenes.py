"""Reproducción PM del barrido de órdenes, checkout y stock, contra la API local (e5d592e).
Corre desde backend/ con .venv/bin/python ordenes.py <caso>. Toca sólo la base local."""
import subprocess, sys, time
import httpx

API = "http://localhost:8000/api"
c = httpx.Client(timeout=60)


def sql(q):
    return subprocess.run(["/usr/bin/docker", "exec", "topgreen-db", "psql", "-U", "topgreen", "-d", "topgreen",
                           "-Atc", q], capture_output=True, text=True).stdout.strip()


def tok(email, pw):
    r = c.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, (email, r.text[:200])
    return r.json()["access_token"]


def comprador_nuevo(n):
    email = f"comprador{n}.{int(time.time())}@example.com"
    c.post(f"{API}/auth/register", json={"email": email, "password": "Compra1234", "full_name": f"Comprador {n}"})
    sql(f"update users set is_verified=true where email='{email}'")
    return tok(email, "Compra1234")


H = lambda t: {"Authorization": f"Bearer {t}"}
VEND = tok("vendedor@ejemplo.com", "vendedor123")
VID = sql("select id from users where email='vendedor@ejemplo.com'")
LOC = sql("select id from localities where name='Pergamino' and province_name='Buenos Aires' limit 1")
PROD = sql(f"select id from products where seller_id='{VID}' and status='ACTIVE' and publication_type='producto' "
           "and stock >= 5 order by created_at desc limit 1")
PNG = bytes.fromhex("89504e470d0a1a0a0000000d4948445200000001000000010804000000b51c0c020000000b4944415478da63fc"
                    "ff1f0005fe02fe3a9ae6af0000000049454e44ae426082")


def comprar(t, extra=None, cantidad=1):
    c.delete(f"{API}/cart", headers=H(t))
    s = c.post(f"{API}/cart/sync", headers=H(t), json={"items": [{"product_id": PROD, "quantity": cantidad}]})
    assert s.status_code == 200, s.text[:200]
    return c.post(f"{API}/orders/checkout/transfer", headers=H(t), json={
        "shipping_address": "Ruta 8 km 220", "shipping_locality_id": LOC, "shipping_postal_code": "2700",
        "shipping_decisions": [{"seller_id": VID, "mode": "self"}], **(extra or {})})


caso = sys.argv[1]
if caso == "1":
    sql(f"update products set stock=1, stock_reservado=0 where id='{PROD}'")
    b1, b2 = comprador_nuevo(1), comprador_nuevo(2)
    r1, r2 = comprar(b1), comprar(b2)
    print("stock 1; dos compras por transferencia ->", r1.status_code, r2.status_code)
    o1, o2 = r1.json()["orders"][0]["order_id"], r2.json()["orders"][0]["order_id"]
    for o, b in ((o1, b1), (o2, b2)):
        c.post(f"{API}/orders/{o}/transfer-receipt", headers=H(b), files={"file": ("comp.png", PNG, "image/png")})
    print("los dos transfirieron; el vendedor aprueba al 1 ->",
          c.patch(f"{API}/orders/{o1}/transfer-receipt", headers=H(VEND), json={"decision": "approve"}).status_code,
          "| aprueba al 2 ->", (lambda r: (r.status_code, r.text[:80]))(
              c.patch(f"{API}/orders/{o2}/transfer-receipt", headers=H(VEND), json={"decision": "approve"})))
    sql(f"update products set stock=500 where id='{PROD}'")
elif caso == "4":
    b = comprador_nuevo(4)
    r1, r2 = comprar(b), comprar(b)
    print("la misma compra dos veces (otra pestaña / recarga) ->", r1.status_code, r2.status_code,
          "| órdenes distintas:", r1.json()["orders"][0]["order_id"] != r2.json()["orders"][0]["order_id"])
elif caso == "5":
    sql(f"update products set price=100 where id='{PROD}'")
    b = comprador_nuevo(5)
    c.delete(f"{API}/cart", headers=H(b))
    c.post(f"{API}/cart/sync", headers=H(b), json={"items": [{"product_id": PROD, "quantity": 1}]})
    print("vendedor sube el precio de 100 a 1000 ->", c.patch(f"{API}/products/{PROD}", headers=H(VEND), json={"price": 1000}).status_code)
    r = c.post(f"{API}/orders/checkout/transfer", headers=H(b), json={
        "shipping_address": "x", "shipping_locality_id": LOC, "shipping_postal_code": "2700",
        "shipping_decisions": [{"seller_id": VID, "mode": "self"}]})
    oid = r.json()["orders"][0]["order_id"]
    print("checkout ->", r.status_code, "| total de la orden:", sql(f"select total_amount from orders where id='{oid}'"))
elif caso == "6":
    sql(f"update products set price=0 where id='{PROD}'")
    r = comprar(comprador_nuevo(6))
    print("publicación con precio 0, compra por API ->", r.status_code, "| total:",
          sql(f"select total_amount from orders where id='{r.json()['orders'][0]['order_id']}'") if r.status_code == 200 else r.text[:120])
    sql(f"update products set price=45000 where id='{PROD}'")
elif caso == "7":
    b = comprador_nuevo(7)
    print("cantidad 3000000000 ->", c.post(f"{API}/cart/items", headers=H(b), json={"product_id": PROD, "quantity": 3000000000}).status_code)
    print("notas de 600 caracteres en el checkout ->", comprar(b, {"notes": "x" * 600}).status_code)
