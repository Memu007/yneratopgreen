# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Tarea activa — CART-PRODUCT-QUERY-1

### Problema y prioridad

El caso 180 dejó una segunda medición concreta: `GET /cart` y
`POST /cart/sync` leen `products` 1, 3 y 6 veces para 1, 3 y 6 ítems. Las
portadas ya quedaron acotadas por petición; las publicaciones todavía se
resuelven una por una.

Es la siguiente pieza porque el defecto está medido en los mismos recorridos,
su cierre es chico y evita arrastrar otro N+1 conocido a la QA final. No habilita
una reescritura del carrito ni optimizaciones especulativas. Base de trabajo:
el HEAD de la rama Dev que contiene esta asignación, partiendo de la entrega
aceptada `6b91aa8`.

### Alcance

1. Medir con el oyente SQL ya validado cuántas sentencias que leen `products`
   ejecutan `GET /cart` y `POST /cart/sync` con 1, 3 y 6 ítems.
2. Hacer que esas lecturas sean acotadas por petición y no crezcan con el
   número de ítems. Reutilizá carga ORM o una consulta agrupada existente antes
   de agregar una abstracción nueva.
3. Conservar exactamente la semántica del carrito y del sync: mismo orden,
   normalización de duplicados, cantidades, precios, subtotales, total,
   portadas, errores y atomicidad ante publicación inexistente, inactiva,
   propia o sin stock.
4. Mantener el cierre anterior: las lecturas de `product_images` siguen en
   cero para carrito vacío y como máximo una por petición con ítems.
5. Agregar el caso permanente **181** y negativos discriminantes separados para
   `GET /cart` y `POST /cart/sync` que repongan la lectura por ítem y hagan
   crecer el conteo.

### Fuera de alcance

- No optimizar otras tablas o consultas que aparezcan en el conteo total.
- No cambiar contratos, rutas, autenticación, límites, mensajes, UI ni textos.
- No tocar checkout, pagos, stock, migraciones ni la regla de imagen principal.
- No agregar dependencia, caché ni infraestructura.
- No integrar a `main`, desplegar ni modificar Railway.

### Criterios de aceptación ejecutables

1. El caso 181 demuestra el antes 1/3/6 y, en la candidata, una cantidad
   constante de lecturas de `products` para 1/3/6 ítems en ambos endpoints,
   con una sola lectura como máximo por petición.
2. El caso contrasta respuestas y base: ids, orden, cantidades, precios,
   subtotales, total y portada/`null` coinciden; un mismo `product_id`
   repetido en sync conserva la normalización vigente.
3. Inexistente, inactiva, propia y cantidad sin stock conservan su código y
   motivo vigentes, sin reemplazo parcial del carrito.
4. Las lecturas de `product_images` continúan acotadas como las acepta el caso
   180.
5. Los dos sabotajes hacen rojo el 181 por crecimiento 1/3/6 y la candidata
   restaurada vuelve a verde.
6. Casos 7, 29, 45, 59–61, 75, 140, 170, 176, 179 y 180 siguen verdes.
7. Suite completa desde base limpia, build, lint, `tsc --noEmit`,
   `node --check`, `compileall`, `pip check`, `alembic check` y
   `diff-check` verdes. No hace falta repetir a11y/contraste si no cambia UI.

### Evidencia y decisiones que hay que leer

- `docs/pm/REPRODUCCION-CART-IMG-QUERY-1-2026-09-22.md`.
- `backend/app/api/cart.py`.
- `backend/app/models/cart.py` y `backend/app/models/product.py`.
- `scripts/smoke.mjs`, casos 29, 45, 140, 176, 180.

### Frenar y consultar

Frená si las lecturas no crecen al medir la candidata base, si la corrección
exige cambiar mensajes o atomicidad del sync, si aparece una regresión heredada
no explicada o si la solución requiere tocar modelos, migraciones o endpoints
fuera del carrito.

### Entrega mínima

1. Un commit de producto + caso 181 + negativos reproducibles.
2. `docs/pm/PARA-PM.md` reemplazado con medición antes/después, SHA exacto,
   pruebas, negativos, riesgos y cualquier puerta que deba reproducir PM.
3. No integrar a `main` ni desplegar.
