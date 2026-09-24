# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Tarea activa — LOCALITY-LABEL-DISPLAY-1

**Decisión sobre la entrega anterior.** `LOCALITY-DEDUP-1` quedó **aceptada
en rama** sobre `34bab15`.

- PM midió por su cuenta en SQL: 105 anidadas y **51** pares homónimos (108
  localidades), todos distinguibles. Tu corrección de 49 a 51 es correcta.
- Caso 188 en 1/1 y los cuatro negativos en rojo. El 188 dio 1/1 otra vez
  después de restaurar.
- 45/45 casos de localidad, transportista, fletes, PostGIS y filtros.
- a11y 76/76, contraste 84/84 y auditoría 12/12.
- Se acepta tu recomendación: filtrar por el id de una anidada cuenta como su
  localidad.

Evidencia en `REPRODUCCION-LOCALITY-DEDUP-1-2026-09-24.md`.

**Prioridad y problema.** Lo que dejaste «visto y no tocado» es la otra mitad
del mismo requisito (contrato 3.1, publicación con ubicación). El selector ya
distingue las cuatro «San Pedro» de Santiago del Estero, pero la tarjeta y la
ficha dicen «San Pedro, Santiago del Estero». Quien compra no sabe cuál es, y
la ubicación es un dato de la decisión de compra y del flete.

**Alcance.**

- Donde se le muestra a una persona la localidad de una publicación o la
  base de un transportista, las homónimas llevan el departamento con la misma
  regla del selector.
- Al menos la tarjeta del Mercado, la ficha y la base del transportista en
  el checkout. Inventariá el resto y decí dónde aplicaste la regla y dónde no.
- Las no homónimas se ven como hoy.
- Una publicación sobre una entidad anidada muestra el nombre de su
  localidad, como ya hace la ficha.

**Fuera de alcance.** Reescribir datos guardados, reimportar el padrón,
cambiar selectores, filtros o búsqueda, copy general, integración y
despliegue. No avances a otra pieza.

**Aceptación verificable.**

1. Caso nuevo 189:
   - una publicación en una «San Pedro» homónima muestra el departamento en
     la tarjeta y en la ficha;
   - una publicación en una localidad no homónima se ve sin cambios;
   - un transportista con base homónima muestra su departamento en el
     checkout.
2. Negativo discriminante: con el código de la base, el 189 da rojo y nombra
   dónde falta el departamento.
3. Sin regresiones: 183, 185, 186, 188 y los casos de transportista que
   elijas, con justificación. También auditoría móvil, porque un rótulo más
   largo no puede ensanchar la tarjeta ni la ficha a 360 px, además de a11y
   y contraste. Build, lint, tipos y diff-check verdes.

**Frená y consultá antes** si hace falta una migración, reescribir el texto
de ubicación guardado en las publicaciones o cambiar el contrato de una
respuesta de la API más allá de agregar campos.

**Leé antes:**

- `backend/app/services/padron.py`;
- cómo arman la ubicación la tarjeta, la ficha y `base_locality_name` en
  `backend/app/schemas/logistics.py`;
- `REPRODUCCION-LOCALITY-DEDUP-1-2026-09-24.md`.

**Entrega** en `PARA-PM.md`:

- SHA e inventario de lugares, con dónde aplicaste la regla y dónde no;
- rojo y verde, pruebas exactas y riesgos.

No integres ni despliegues.
