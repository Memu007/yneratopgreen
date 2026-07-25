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

## Las 43 subcategorías, enumeradas

**Esta es la fuente para el seed.** Transcripción literal del prototipo
que mandó la clienta. El archivo original no está en el repositorio y no
va a estar: tomamos los datos, no el código ni el diseño.

El tercer nivel se registra **sólo para no perderlo**. No se carga: la
decisión de tratarlo como atributo en vez de nivel navegable sigue en pie.

### 1. Maquinaria agrícola (7)

| Subcategoría | Tercer nivel (no se carga) |
|---|---|
| Tractores | compacto (<60 HP), estándar (60-120 HP), alta (>120 HP) |
| Preparación del suelo | arados, rastras, cultivadores, subsoladores, otros |
| Siembra y plantación | sembradoras de precisión, neumáticas, hortalizas, granos gruesos/finos, otros |
| Fertilización y protección | pulverizadoras autopropulsadas, de arrastre, fertilizadoras centrífugas, de disco, aviones, drones, otros |
| Cosecha | cosechadoras de granos, forrajes, algodón, caña, café, frutales, hortalizas, otros |
| Postcosecha | limpiadoras, secadoras, ensacadoras, silos, otros |
| Forrajes y ganadería | picadoras, embolsadoras, enfardadoras, mezcladoras, otros |

### 2. Riego y drenaje (6)

| Subcategoría | Tercer nivel (no se carga) |
|---|---|
| Riego por aspersión | pivotes, cañones, laterales |
| Riego localizado | goteo, microaspersión, cintas |
| Riego superficial y subterráneo | superficial, subterráneo |
| Bombas, motobombas y accesorios hidráulicos | bombas centrífugas, motobombas, accesorios hidráulicos |
| Drenaje y control hídrico | drenaje subsuperficial, canales, control de nivel |
| Otros | accesorios para riego |

### 3. Insumos agrícolas (7)

| Subcategoría | Tercer nivel (no se carga) |
|---|---|
| Semillas y plántulas | cultivos extensivos, hortícolas, forrajeras, forestales |
| Fertilizantes | orgánicos, minerales, líquidos, liberación controlada |
| Correctivos | cal, yeso, enmiendas |
| Agroinsumos biológicos | biofertilizantes, biocontroladores, microorganismos |
| Agroquímicos | herbicidas, insecticidas, fungicidas, acaricidas |
| Sustratos y coberturas | mulch, mallas, films |
| Otros | otros insumos |

### 4. Ganadería y forrajes (5)

| Subcategoría | Tercer nivel (no se carga) |
|---|---|
| Cercas y bebederos | eléctricas, portátiles, hidrantes |
| Manejo animal | corrales, mangas, balanzas, caravanas |
| Ordeño y sanidad | ordeñadoras mecánicas, tanques de leche, equipos de baño |
| Suplementación | comederos, tolvas, silos de grano |
| Otros | equipos varios |

### 5. Repuestos y mantenimiento (6)

| Subcategoría | Tercer nivel (no se carga) |
|---|---|
| Neumáticos y cámaras | neumáticos agrícolas, cámaras |
| Filtros, correas, cuchillas, cadenas | filtros, correas, cuchillas, cadenas |
| Sistemas hidráulicos | mangueras, racores, bombas hidráulicas |
| Sistemas electrónicos y sensores | monitores, GPS, piloto automático |
| Lubricantes y baterías | lubricantes, baterías |
| Otros | accesorios generales |

### 6. Agricultura de precisión y tecnología (4)

| Subcategoría | Tercer nivel (no se carga) |
|---|---|
| Sistemas de guiado y GNSS | antenas, pantallas, corrección por señal |
| Sensores de cultivo | clorofila, humedad, temperatura |
| Drones y VANTs | multiespectrales, térmicos, aplicadores |
| Software y plataformas | gestión de flota, prescripción variable, rendimiento |

### 7. Tierras y parcelas (8)

| Subcategoría | Tercer nivel (no se carga) |
|---|---|
| Compra-venta definitiva | campo agrícola (secano/riego), campo ganadero (pasturas naturales/mejoradas), parcela hortícola/frutícola, campo mixto, otros |
| Mejoras de infraestructura (compra) | alambrados, aguadas, electrificación, molinos, monte, galpones, silos, caminos internos, otros |
| Alquiler por campaña (1-12 meses) | siembra directa, siembra convencional, con/sin mejora de suelos, otros |
| Mejoras infraestructura (alquiler) | agua instalada, energía, infraestructura operativa, otros |
| Alquiler por uso transitorio | pastoreo rotativo, ensayos agrícolas, producción estacional, agricultura regenerativa, agricultura experimental, otros |
| Mejoras (alquiler transitorio) | corrales temporales, bebederos, accesos operativos, otros |
| Alquiler con opción a compra | leasing de tierra |
| Mejoras (leasing) | alambrados, aguadas, electrificación, molinos, monte, galpones, silos, caminos internos, otros |

### Dos cosas que salen de enumerarlas

**Hay cuatro subcategorías llamadas "Otros"**, en Riego, Insumos,
Ganadería y Repuestos. Son cuatro registros distintos, cada uno colgando
de su categoría. Si el seed las trata por nombre en vez de por categoría,
se pisan entre sí.

**En Tierras y parcelas, la mitad no son subcategorías.** Las cuatro que
empiezan con "Mejoras" no son cosas que se vendan: son características
del campo que se ofrece. Alambrados y aguadas no se compran en el
catálogo, describen el lote. La categoría tiene en realidad cuatro tipos
de operación —venta, alquiler por campaña, alquiler transitorio,
leasing— y cuatro listas de mejoras que le corresponden a cada una.

Es un argumento más de que Tierras no entra en el flujo de catálogo, y
conviene tenerlo a mano el lunes.

### 5 servicios

Asesoramiento, Contratistas, Logística, Acopio, Inversores.

**Se cargan los primeros cuatro.** "Inversores" queda afuera hasta que la
clienta explique qué significa.

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

## Solapamiento interno

Los **drones** aparecen en dos lugares de la misma taxonomía:

- Maquinaria agrícola → Fertilización y protección → "drones"
- Agricultura de precisión → Drones y VANTs → multiespectrales, térmicos,
  aplicadores

Hay que preguntarle cuál corresponde, o si son usos distintos que quiere
separar a propósito.

## Marcas — lista limpia y qué preguntar

### Corregido sin consultar

| Original | Queda | Motivo |
|----------|-------|--------|
| `Jhon Deere` | **eliminada** | Está mal escrita. Ya existe `John Deere` en la misma lista |
| `Roland H` | `Roland` | La `H` suelta parece un error de tipeo |

### A confirmar con la clienta

Cinco grupos que parecen la misma marca repetida:

| Entradas | Recomendación |
|----------|---------------|
| `Case`, `Case IH` | Dejar sólo `Case IH`. "Case" a secas es ambiguo: existe Case Construction |
| `Fiat`, `Fiat Someca`, `Someca` | Consolidar. Es el mismo linaje histórico, Fiat Trattori y Someca terminaron siendo la misma línea |
| `Deutz`, `Deutz-Fahr` | Dejar `Deutz-Fahr`, que es la marca de tractores. Deutz a secas es el fabricante de motores. **Puede ser a propósito si venden motores aparte** |
| `Chery`, `Chery Bylion` | Consolidar salvo que sean líneas distintas que quiera separar |

Y dos que no parecen del rubro:

| Marca | Por qué |
|-------|---------|
| `Husqvarna` | Jardinería y forestal, no maquinaria agrícola |
| `Yard Machines` | Jardinería |

Puede ser deliberado si piensa vender equipamiento de parque y jardín.
Conviene preguntarlo.

### Resultado

De **48** originales quedan **47** con las correcciones seguras. Si se
confirman las consolidaciones, la lista final ronda las **42**.

---

## Preguntas para la clienta — lunes 27-07

Todas salen del análisis de arriba y conviene llevarlas juntas.

**Sobre categorías**

1. **¿"Ganadería" es vender animales o equipamiento?** El contrato dice
   "animales de cría y comerciales". Su taxonomía sólo tiene cercas,
   bebederos, mangas y ordeñadoras. Son negocios distintos.
2. **¿Los drones van en Maquinaria o en Agricultura de precisión?**
   Aparecen en las dos.
3. **¿Tierras y parcelas entra en esta etapa?** No tiene stock, ni
   carrito, ni envío: se consulta y se negocia. Es otro producto. Y de
   sus 8 subcategorías, **4 no son cosas que se vendan**: alambrados,
   aguadas y molinos describen el campo, no se compran sueltos. Lo que
   ahí hay son cuatro tipos de operación con sus mejoras asociadas.
4. **¿"Inversores" qué significa exactamente?** Si es conectar productores
   con financiación, es otro negocio y no está contratado.

**Sobre marcas**

5. Los cinco grupos de duplicados de arriba.
6. ¿Husqvarna y Yard Machines son a propósito?
7. **¿Las marcas aplican a todas las categorías o a algunas?** Hoy el
   prototipo ofrece las 48 para cualquier producto, así que al elegir un
   fertilizante propone "John Deere" como marca.

**Sobre el prototipo**

8. **¿Hay otro sistema o desarrollo en paralelo?** El buscador que mandó
   apunta a una API con campos que no existen acá: `codigo_lote`,
   `productor_nombre`, `certificaciones`, `unidad_medida`.

## Observación aparte

El prototipo trae al final una integración contra
`http://localhost:8000/api/search/`, que devuelve campos que **no
existen en este sistema**: `codigo_lote`, `productor_nombre`,
`certificaciones`, `unidad_medida`.

Eso pertenece a otro modelo de datos, más parecido a trazabilidad de lotes
que a un marketplace. **Conviene preguntar si existe otro sistema o
prototipo en paralelo**, porque si el cliente espera que ambos se
integren, eso tampoco está contratado.
