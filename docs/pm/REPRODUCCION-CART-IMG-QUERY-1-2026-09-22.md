# Reproducción PM — CART-IMG-QUERY-1

Fecha: 2026-09-22.

## Decisión

**ACEPTADA EN RAMA, NO INTEGRADA Y NO DESPLEGADA.**

- Producto, caso 180 y sabotajes: `112eee0`.
- Regla de entrega pedida por Emi: `a050be3`.
- Informe Dev: `6b91aa8`.
- Base: aceptación PM `c4f1a42`; `main` continúa en `0bd7fbc`.

## Qué comprobó PM

- `portadas_de` hace una sola consulta agrupada para las publicaciones de la
  petición y devuelve únicamente la imagen marcada como principal.
- `GET /cart` y `POST /cart/sync` pasan de 1/3/6 lecturas de
  `product_images` a 1/1/1 con 1/3/6 ítems.
- Alta y las dos actualizaciones conservan la portada correcta con una lectura;
  una publicación sin principal devuelve `null` y una secundaria nunca ocupa
  su lugar.
- El helper queda local a `cart.py`, sin dependencia, migración, contrato ni UI
  nuevos. Es el cambio mínimo que elimina las cinco copias de la selección.
- La regla añadida a `CLAUDE.md` acorta las futuras entregas sin reemplazar la
  revisión independiente de PM; se acepta como cambio procedural separado.

## Evidencia independiente

- Caso 180 focal: **1/1**. Lecturas de imágenes: GET 1/1/1 y sync 1/1/1 para
  1/3/6 ítems; seis respuestas contrastadas con la base, cuatro con principal
  y dos en `null`.
- Sabotajes: **3/3 rojos**. Volver a consultar dentro de GET produjo 1/3/6;
  hacerlo en sync produjo 1/3/6; quitar el filtro de principal hizo visible una
  secundaria donde la base exigía `null`.
- Suite completa desde base Docker limpia: **180/180**. Incluye los focales de
  carrito, dinero, stock, concurrencia, migración de imagen y el caso 131.
- Build, lint, `tsc --noEmit`, `node --check`, `compileall`, `pip check`,
  `alembic check` y `diff-check` compatible con CRLF: verdes.

No se repitieron puertas visuales separadas porque no cambió ningún archivo de
UI; la suite completa sí recorrió todas sus superficies vigentes.

## Hallazgo adoptado

El mismo instrumento midió otro N+1: las lecturas de `products` crecen 1/3/6
en GET y sync. No bloquea esta aceptación porque estaba fuera de alcance y no
afecta el cierre de `product_images`. Se abre como `CART-PRODUCT-QUERY-1`.
