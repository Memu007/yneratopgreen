"""Hallazgo 1 de marcas: unir una marca justo mientras alguien publica con ella.

Corre la API real en proceso (TestClient) contra la base local. El único
cambio es un envoltorio sobre `marca_declarada`: después de validar la marca,
un administrador la une a otra en OTRA sesión, que es lo que pasa cuando las
dos peticiones se cruzan. No toca el código del producto.
"""
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app
from app.api import products
from app.db.base import SessionLocal
from app.services import marcas

CAT, SUB, LOC = "451a7fca-986f-4f7b-bb78-f7d1494086c2", "08ff462f-0220-4fd8-bb0d-1a36289d779c", "66098050"
c = TestClient(app)
tok = c.post("/api/auth/login", json={"email": "vendedor@ejemplo.com", "password": "vendedor123"}).json()["access_token"]

with SessionLocal() as s:
    s.execute(text("insert into form_options (id, option_type, value, label, is_active, display_order) "
                   "values (gen_random_uuid()::text, 'brand', 'carrera-pm', 'Carrera PM', true, 999) "
                   "on conflict do nothing"))
    s.commit()
    ids = dict(s.execute(text("select value, id from form_options where option_type='brand' "
                              "and value in ('carrera-pm','pauny')")).all())

original = products.marca_declarada


def con_union_cruzada(db, category, pedida, otra):
    valor = original(db, category, pedida, otra)
    with SessionLocal() as admin:  # el administrador, en su propia petición
        marcas.unir(admin, ids["carrera-pm"], ids["pauny"])
        admin.commit()
    return valor


products.marca_declarada = con_union_cruzada
r = c.post("/api/products", headers={"Authorization": f"Bearer {tok}"}, json={
    "name": "REPRO carrera", "description": "Reproducción de PM, no es real.", "price": 1000, "stock": 1,
    "unit": "unidad", "locality_id": LOC, "publication_type": "producto", "operation_kind": "activo",
    "category_id": CAT, "subcategory_id": SUB, "condition": "usado", "brand": "carrera-pm"})
print("alta ->", r.status_code)
with SessionLocal() as s:
    print("marca guardada:", s.execute(text("select brand from products where id=:i"), {"i": r.json()["id"]}).scalar())
    print("¿existe la marca 'carrera-pm'?:", s.execute(text(
        "select count(*) from form_options where option_type='brand' and value='carrera-pm'")).scalar())
    print("brand_label en el detalle:", c.get(f"/api/catalog/products/{r.json()['id']}").json().get("brand_label"))
