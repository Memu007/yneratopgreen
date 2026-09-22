# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Tarea activa — CART-IMG-QUERY-1

### Problema y prioridad

`GET /cart` busca la imagen principal dentro de `for item in cart.items`, por
lo que hoy la cantidad de consultas a `product_images` crece con el tamaño del
carrito. El mismo acceso está repetido en alta, actualización y sincronización.
El riesgo estaba registrado por lectura en `NOW.md`; ahora que
`PRIMARY-IMAGE-INTEGRITY-1` deja una sola principal sostenida por PostgreSQL,
corresponde medirlo y cerrar el N+1 sin alterar el contrato.

Es la siguiente pieza porque completa la Puerta 5 con una mejora acotada y
demostrable, no depende de credenciales ni decisiones externas y evita llevar
deuda conocida a la QA final. Base de trabajo: el HEAD de la rama Dev que
contiene esta asignación, partiendo de la candidata aceptada `6a6e36e`;
conservá completa `PRIMARY-IMAGE-INTEGRITY-1`.

### Alcance

1. Medir primero cuántas sentencias SQL que leen `product_images` ejecutan
   `GET /cart` y `POST /cart/sync` con uno y con varios ítems. Dejar la
   medición en el caso permanente, no sólo en el informe.
2. Hacer que la obtención de imágenes para cada respuesta sea acotada por
   petición: la cantidad de lecturas de `product_images` no puede crecer con
   el número de ítems. La implementación puede usar carga agrupada, relación
   precargada o una consulta explícita, pero no una consulta por ítem.
3. Conservar exactamente la respuesta vigente: misma imagen principal o
   `null`, mismos ítems, cantidades, precios, subtotales y total; sin convertir
   secundarias en portada ni eliminar publicaciones sin imagen.
4. Evitar cinco copias de la misma regla de selección si puede quedar un único
   camino pequeño y claro para alta, ambas actualizaciones, lectura y sync.
   No abstraer fuera de `cart.py` salvo que una dependencia existente ya sea
   el lugar natural.
5. Agregar el caso permanente **180**, incluyendo un negativo discriminante
   reproducible que restaure temporalmente el patrón por ítem y demuestre que
   el conteo vuelve a crecer.

### Fuera de alcance

- No cambiar contratos, rutas, límites, autenticación, UI ni textos.
- No reescribir el carrito, el checkout ni relaciones ORM ajenas a esta
  consulta.
- No optimizar otras consultas que aparezcan en la medición sin informar
  primero; esta pieza sólo cierra lecturas de imágenes.
- No tocar la migración ni la regla de imagen principal recién aceptadas.
- No integrar a `main`, desplegar ni modificar Railway.

### Criterios de aceptación ejecutables

1. El caso 180 informa el conteo real para uno y varios ítems en `GET /cart` y
   `POST /cart/sync`; en la candidata, las lecturas de `product_images` son
   constantes por petición y no dependen del número de ítems.
2. El mismo caso contrasta la respuesta con la base: portada correcta por
   producto, `null` cuando no hay principal, cardinalidad, cantidades,
   subtotales y total sin cambios.
3. El negativo discriminante hace rojo el 180 al restaurar una consulta de
   imagen dentro del bucle y vuelve a verde al reponer la candidata.
4. Casos 7, 45, 59–61, 75, 170, 176 y 179 siguen verdes. Si alguno no es
   pertinente al camino tocado, justificá la exclusión antes de omitirlo.
5. Suite completa desde base limpia, build, lint, `tsc --noEmit`,
   `compileall`, `pip check`, `alembic check` y `diff-check` verdes. No hace
   falta repetir a11y/contraste si no cambia ningún archivo de UI.

### Evidencia y decisiones que hay que leer

- `docs/pm/NOW.md`, pendientes canónicos.
- `docs/pm/REPRODUCCION-PRIMARY-IMAGE-INTEGRITY-1-2026-09-22.md`.
- `backend/app/api/cart.py`.
- `backend/app/models/product_image.py`.
- `scripts/smoke.mjs`, casos 7, 45, 59–61, 75, 170, 176 y 179.

### Frenar y consultar

Frená si la medición demuestra que no hay crecimiento por ítem, si cerrar las
lecturas de imágenes exige cambiar la semántica del carrito, si aparece una
regresión heredada no explicada o si la solución requiere una migración,
dependencia nueva o cambio transversal de modelos.

### Entrega mínima

1. Un commit de producto + caso 180 + negativo reproducible.
2. `docs/pm/PARA-PM.md` reemplazado con medición antes/después, SHA exacto,
   pruebas, negativo, riesgos y cualquier puerta que deba reproducir PM.
3. No integrar a `main` ni desplegar.
