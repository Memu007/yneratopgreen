# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-12.

## 1. Resultado

**La puerta del hito está hecha.** El commit es **`cc08aa2`**, sobre `24719cb`;
este informe va aparte y encima.

```bash
npm run hito
```

Un solo comando, un solo navegador, un solo viaje. No corre ningún caso ajeno.

```text
=== Puerta del hito intermedio ===

  ✓ catálogo filtrado por categoría y ubicación oficial
      Insumos agrícolas · Pergamino, Buenos Aires: 1 de 30 publicaciones, y las
      mismas que devuelve SQL
  ✓ detalle, carrito y destino del padrón
      «Fertilizante Triple 15 - NPK» en el carrito; destino Pergamino; el
      servidor derivó el envío de Juan Vendedor desde Pergamino, Buenos Aires
  ✓ transportistas compatibles por PostGIS, sin contacto
      1 transportista(s) que cubren el tramo, iguales a PostGIS (Carlos
      Transportista), y ni un dato de contacto a la vista
  ✓ selección, contacto revelado y orden creada
      Carlos Transportista elegido, contacto visible
      (transportista@ejemplo.com · +54 2477 55-0101) y orden ORD-…-57AF77AA creada
  ✓ contraste por SQL de la orden
      destino Pergamino, origen congelado Pergamino, traslado «carrier» con
      Carlos Transportista, vendedor Juan Vendedor
  ✓ la operación como transportista
      transportista@ejemplo.com ve la operación con recorrido y cantidades, sin
      importes ni contacto del comprador

  6 de 6 pasos del recorrido, encadenados en un solo viaje

HITO DEMOSTRADO: catálogo, búsqueda filtrada y geolocalización funcional,
encadenados de punta a punta
```

## 2. Lo que la hace una demostración y no una escenografía

**Están encadenados.** No son seis comprobaciones que casualmente van seguidas:
lo que el filtro deja es lo que se compra, y lo que se compra es lo que el
transportista termina viendo. El nombre de la publicación sale del paso 1 y
viaja hasta el 6; el número de orden sale del 4 y se contrasta en el 5 y en el
6. Si el encadenamiento se rompiera en el medio, no habría paso siguiente que
mirar.

**No fabrica nada.** Antes de abrir el navegador no hay una sola llamada a la
API ni una sola escritura en SQL. Cuentas, publicaciones, categorías, orígenes
y el transportista salen del seed. SQL aparece **después** de cada paso, y sólo
para contrastar.

**Los contrastes no tienen números escritos a mano.** El paso 1 compara el
conjunto de publicaciones visibles contra el conjunto que devuelve SQL, y
además exige que sin filtrar haya estrictamente más —si no, el filtro no
filtró—. El paso 3 compara el listado visible contra la misma regla resuelta en
PostGIS, no contra una cantidad esperada.

## 3. El seed no hizo falta tocarlo

Me lo autorizabas y no fue necesario. El seed ya deja el tramo completo:

| Qué | Del seed |
|---|---|
| Publicación | «Fertilizante Triple 15 - NPK», categoría *Insumos agrícolas* |
| Origen oficial | Pergamino, Buenos Aires |
| Transportista | Carlos Transportista, base en Pergamino, radio 250 km |
| Destino | Pergamino: las dos puntas del viaje a 0 km de su base |

Como no cambié el seed, tampoco hacía falta volver a probar alta y repetición:
el caso 41 ya exige que repetirlo no duplique ni altere las cuentas demo, y
sigue verde.

## 4. Rojo cuando falta un paso

No alcanza con que falle: la puerta también tiene que darse cuenta de que un
paso **no corrió**. Lo probé sacando el paso 3 y dejando el resto igual:

```text
  ✓ catálogo filtrado por categoría y ubicación oficial
  ✓ detalle, carrito y destino del padrón
  — transportistas compatibles por PostGIS, sin contacto: NO SE CORRIÓ
  ✗ selección, contacto revelado y orden creada
  — contraste por SQL de la orden: NO SE CORRIÓ
  — la operación como transportista: NO SE CORRIÓ

  2 de 6 pasos del recorrido
HITO NO DEMOSTRADO        (salida 1)
```

El recorrido exigido es una lista fija en el script: si falta uno, sobra uno o
se repite, la puerta falla. Es la misma idea del inventario de accesibilidad.

## 5. Reproducibilidad

- Base recreada desde cero y sembrada: **verde**.
- Segunda corrida seguida, sin recrear nada: **verde**. No depende de arrancar
  con la base intacta, sólo de que el seed esté.

## 6. Lo único que toqué del código existente

`scripts/lib/sql.mjs`. La suite ya tenía su acceso SQL adentro; la puerta nueva
necesitaba el mismo. Lo saqué a un módulo y la suite lo importa, en vez de
dejar dos copias que se separen con el tiempo. Es un movimiento mecánico: la
suite entera sigue en 58/58.

No hay una línea de producto en el diff. No toqué Railway, Mercado Pago,
estilos, migraciones, privacidad ni reglas de compatibilidad. Sin dependencias
nuevas y sin segundo framework: es el mismo Playwright.

## 7. Estado final

| Comprobación | Resultado |
|---|---|
| `npm run hito`, base recreada desde cero | **6/6 pasos** |
| `npm run hito` con un paso sacado | rojo, nombrando cuáles no corrieron |
| Suite completa, base recreada desde cero | **58/58** |
| `npm run a11y -- --todas` | **56/56**, 0 violaciones |
| `npm run contraste` | **40/40**, 0 incumplimientos |
| `npm run build` (incluye `tsc`) | verde |
| `git -c core.whitespace=cr-at-eol diff --check` | sin avisos |

Corrí las dos puertas visuales aunque el diff no toca interfaz. No hacía falta;
las corrí porque de esta puerta depende una decisión de cobro y prefiero que
los seis números estén todos frescos.

## 8. Riesgos y deudas

**Uno, y es el de siempre con esta clase de puerta.** El recorrido depende de
datos concretos del seed: una categoría, una localidad, una publicación y el
transportista demo. Están escritos como constantes arriba del script, con el
motivo al lado. Si el seed cambia, la puerta **falla en vez de medir de menos**,
que es lo que quiero; pero es una dependencia real y hay que acordarse de ella
al tocar el seed.

**Una observación sobre lo que la puerta NO demuestra**, para que no la
presentes de más: el tramo del seed tiene origen y destino en la misma
localidad, así que las dos distancias son 0 km. Que la regla geográfica
discrimine de verdad —radios que alcanzan y radios que no— lo prueban los casos
43 y 53 de la suite, no ésta. Esta puerta demuestra que las tres capacidades
están conectadas, no que el cálculo sea fino.

**Sigue abierto el `float` del checkout**, obligatorio antes de Fase 4.

Nota de reproducibilidad, la de siempre: Docker no está disponible en mi entorno
—demonio caído y registry 403—, así que todo corre nativo con un puente que
traduce sólo lo que las puertas piden por `docker exec`: `psql`, `python` y
`alembic`. `./scripts/init_local_db.sh` sigue siendo el camino con contenedores
y no lo cambié.

El entorno local quedó levantado: API en `:8000`, Vite en `:5173`, base recreada
y con seed.
