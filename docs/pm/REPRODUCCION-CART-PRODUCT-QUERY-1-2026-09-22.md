# Reproducción PM — CART-PRODUCT-QUERY-1

Fecha: 2026-09-22.

## Decisión

**ACEPTADA EN RAMA, NO INTEGRADA Y NO DESPLEGADA.**

- Base y tarea PM: `6e64c19`.
- Producto, caso 181 y tres sabotajes: `1e4a63c`.
- Informe Dev: `e0fd76b`. Su delta respecto del producto es sólo `docs/pm/PARA-PM.md`.
- `main` permanece en `0bd7fbc`; no se tocó Railway ni ningún dato remoto.

## Qué comprobó PM

- `GET /cart` carga las publicaciones de los ítems con `selectinload`, una
  lectura de `products` por petición.
- `POST /cart/sync` carga en grupo las publicaciones pedidas y valida en el
  orden del pedido. Un identificador repetido conserva una línea y suma su
  cantidad; el primer rechazo y su texto permanecen iguales.
- El sync que crea un carrito toma nombre y precio antes del commit que crea
  esa fila. PM acepta esta precisión: guarda el precio que pasó por el control
  de importes. Una relectura posterior podía guardar otro precio si el
  vendedor lo editaba durante la petición; con un carrito ya existente se
  guardaba el valor validado. No cambia el contrato ordinario del carrito.
- `product_images` sigue en cero lecturas para carrito vacío y una por
  petición con ítems. No hay migración, UI, dependencia ni cambio de contrato.

## Evidencia independiente

- Caso 181 focal sobre `1e4a63c`: **1/1**. GET, sync con carrito y sync que
  lo crea leen `products` **1/1/1** veces para **1/3/6** ítems. El caso
  contrasta ids, orden, cantidades, precios, subtotales, total, portada o
  `null`, duplicados y siete rechazos contra respuestas y base.
- Sabotajes sobre una copia temporal, restaurada después de cada uno:
  **3/3 rojos**. Lectura por ítem en GET: **1/3/6**; en sync: **1/3/6**;
  relectura tras crear carrito: **2/4/7**. El caso 181 volvió a pasar en la
  suite posterior.
- Suite completa desde una base Docker limpia: **180/181**. El único rojo,
  caso 157, fue ambiental: la copia temporal usada para la prueba no tenía
  `.git` y el caso ejecuta `git ls-files` para hallar guías locales. Agregados
  los metadatos Git de esa misma candidata, el caso 157 pasó **1/1**. Los
  **181 casos están cubiertos**, sin afirmar una corrida única 181/181.
  El caso 131 pasó dentro de la suite. También pasaron 176 y 179–181.
- Build, lint, `tsc --noEmit`, `node --check`, `compileall`, `pip check`,
  `alembic check` y `git -c core.whitespace=cr-at-eol diff --check`:
  verdes. No se repitieron a11y ni contraste: no cambió la UI.

La prueba corrió en un checkout temporal aislado. El checkout de trabajo de
Emi y sus `backups/` sin seguimiento se preservaron.

## Límite de la aceptación

No se integran ni publican esta pieza ni las otras dos aceptadas en rama. La
migración de `PRIMARY-IMAGE-INTEGRITY-1` sigue requiriendo su puerta operativa
antes de tocar `main`, que conserva auto-deploy de Railway.
