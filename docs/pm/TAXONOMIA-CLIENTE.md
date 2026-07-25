# Taxonomía enviada por la clienta

Recibida el 2026-07-25, en un prototipo HTML de buscador. **Se toman los
datos, no el diseño ni el código.**

Es el insumo más valioso que llegó del lado del cliente: dice qué quiere
vender de verdad, en lugar de que lo adivinemos nosotros.

Pero **no todo es dato: parte es alcance nuevo.** Este documento separa
las dos cosas.

---

## Lo que trae

- **7 categorías**, con **43 subcategorías** y unos 200 ítems de tercer
  nivel.
- **48 marcas**, casi todas de tractores y maquinaria.
- **5 servicios**: Asesoramiento, Contratistas, Logística, Acopio,
  Inversores.
- Dos filtros nuevos: **condición** (nuevo/usado) y **origen** (agencia o
  dueño directo).

### Las siete categorías

| Categoría | Subcategorías |
|-----------|---------------|
| Maquinaria agrícola | 7 |
| Riego y drenaje | 6 |
| Insumos agrícolas | 7 |
| Ganadería y forrajes | 5 |
| Repuestos y mantenimiento | 6 |
| Agricultura de precisión y tecnología | 4 |
| Tierras y parcelas | 8 |

---

## Cotejo contra el contrato

`CONTRATO.md` sección 2 define **cinco** categorías. Así mapean:

| Categoría de la clienta | Contrato |
|-------------------------|----------|
| Maquinaria agrícola | Maquinaria y Servicios ✓ |
| Insumos agrícolas | Insumos y Materia Prima ✓ |
| Agricultura de precisión | Tecnología para el Cultivo ✓ |
| Riego y drenaje | No figura, pero encaja como insumo o maquinaria |
| Repuestos y mantenimiento | **No figura** |
| Ganadería y forrajes | Ver discrepancia abajo |
| **Tierras y parcelas** | **No figura, y es otro modelo de negocio** |

### Discrepancia sobre ganado

El contrato dice **"Bienes y Ganado: animales de cría y comerciales"** —
es decir, **vender animales**.

La taxonomía de la clienta llama "Ganadería y forrajes" a **equipamiento**:
cercas, bebederos, mangas, balanzas, ordeñadoras, comederos. No hay
ninguna subcategoría para vender hacienda.

**Hay que preguntarle cuál de las dos vale.** Son productos distintos con
flujos distintos.

### Tierras y parcelas no es una categoría más

Compraventa de campos, alquiler por campaña, alquiler transitorio y
leasing de tierra **es otro negocio**, no un producto de catálogo:

- No tiene stock ni carrito ni envío.
- No se compra en línea: se consulta y se negocia.
- Necesita superficie, régimen de tenencia, mejoras, y probablemente
  documentación.

Meterlo dentro del mismo flujo de "agregar al carrito" no funciona.

---

## Qué es dato barato y qué es funcionalidad nueva

### Dato: se puede incorporar ya

Cargar las categorías y subcategorías en el seed. Es trabajo mecánico y
mejora mucho la demostración, porque el catálogo pasa a hablar el idioma
del cliente en lugar del nuestro.

### Funcionalidad nueva: no está en el contrato

| Ítem | Por qué es nuevo |
|------|------------------|
| **Marcas** como entidad con filtro | El contrato pide filtros "por categoría y ubicación". Son 48 marcas, tabla propia, filtro y selector |
| **Tercer nivel** de jerarquía | Hoy hay categoría y subcategoría. Los ítems son un nivel más |
| **Condición** nuevo/usado | Campo nuevo en la publicación y filtro |
| **Origen** agencia/dueño directo | Campo nuevo en la publicación y filtro |
| **Tierras y parcelas** | Modelo de negocio distinto, con flujo de consulta en lugar de compra |

---

## Recomendación

**Al MVP:**

1. **Las categorías y subcategorías, sí.** Es el idioma del cliente y
   cuesta poco. Reemplazan a las que improvisamos nosotros.
2. **Condición nuevo/usado, sí.** Es un campo y un filtro; barato, y en
   maquinaria agrícola es información esencial.

**Fuera del MVP, a cotizar aparte:**

3. **Marcas con filtro.** Útil y probablemente lo quieran, pero es una
   entidad nueva completa y no está contratado.
4. **Tercer nivel de jerarquía.** Se puede resolver más barato dejando los
   ítems como atributo de la publicación en vez de un nivel navegable.
5. **Tierras y parcelas.** Es otro producto. Merece su propia
   conversación y su propio presupuesto.

**A preguntar antes de firmar:**

- ¿"Bienes y Ganado" es vender animales, como dice el contrato, o
  equipamiento ganadero, como dice la taxonomía?
- ¿Tierras y parcelas entra en esta etapa o es una fase siguiente?

---

## Observación aparte

El prototipo trae al final una integración contra
`http://localhost:8000/api/search/`, que devuelve campos que **no
existen en este sistema**: `codigo_lote`, `productor_nombre`,
`certificaciones`, `unidad_medida`.

Eso pertenece a otro modelo de datos, más parecido a trazabilidad de lotes
que a un marketplace. **Conviene preguntar si existe otro sistema o
prototipo en paralelo**, porque si el cliente espera que ambos se
integren, eso tampoco está contratado.
