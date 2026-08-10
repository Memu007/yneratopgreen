# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-10.

## 1. Resultado

**Terminado.** Los seis criterios se cumplen. La suite pasa de 25 a **26 casos**.

Dos cosas que tenés que leer aunque el resultado sea verde: **encontré un error
mío en el propio seed** que sólo aparecía en base verdaderamente limpia, y **el
caso nuevo destapó un defecto real del producto** que no puedo arreglar dentro
de este alcance.

## 2. Commit y alcance real

`652bc34`, este informe aparte. Cuatro archivos:

| Archivo | Qué |
|---|---|
| `backend/app/seed.py` | +33 líneas: datos bancarios demo, idempotentes campo por campo |
| `scripts/smoke.mjs` | caso 13 nuevo, caso 14 aislado, renumerado 13→14 … 25→26 |
| `scripts/smoke.sh` | el cartel decía 25 |
| `README.md` | decía 25 |

Sin esquema, migraciones, modelos, endpoints, interfaz ni reglas de checkout.

Los valores, inventados: prefijo `000`, que no es un código de banco existente.

```text
admin@topgreen.com      0000009000000000000017   demo.topgreen.admin
vendedor@ejemplo.com    0000009000000000000024   demo.topgreen.juanv
```

## 3. Evidencia

### El error mío, que sólo se veía desde cero

Escribí el bloque consultando `db.query(User).filter(...)`. **La sesión no tiene
`autoflush`**, así que sobre una base recién creada los tres usuarios todavía
están pendientes de volcado y la consulta no los encuentra: se saltaba el bloque
en silencio. El **primer** seed quedaba sin datos bancarios —el caso exacto que
esta pieza tiene que resolver— y recién el segundo los cargaba.

Lo vi porque la primera corrida no imprimió nada y SQL vino vacío. Ahora usa los
objetos ya en memoria.

### Cuatro corridas del seed

| # | Estado previo | Salida del seed | SQL después |
|---|---|---|---|
| 1 | base recreada desde cero | `🏦` en los dos usuarios: CBU y alias | ambos con sus valores demo; el comprador sigue en nulo |
| 2 | la del punto 1 | `⏭️` en los dos: ya tenían | idénticos; 3 usuarios, sin duplicados |
| 3 | vendedor con `9999…9999` / `mi.alias.propio` | `⏭️` en los dos | **se conservó lo personalizado** |
| 4 | vendedor con CBU propio y **alias en nulo** | `🏦 alias demo` sólo para el vendedor | CBU propio intacto, alias completado |

La cuarta no la pediste explícitamente. La corrí porque "completá únicamente
campos bancarios vacíos" se puede leer por usuario o por campo, y quería que
fuera **por campo**.

### Los dos casos

**13 — nuevo, desde el seed limpio.** No hay ningún `PATCH` antes en toda la
suite; si el seed no cargara, el caso falla, y esa es su razón de ser.

```text
[PASS] 13 Desde el seed, los dos vendedores ya cobran por transferencia —
  HTTP 200, sin PATCH previo;
  vendedor CBU=0000009000000000000024 alias=demo.topgreen.juanv API=SQL;
  admin    CBU=0000009000000000000017 alias=demo.topgreen.admin API=SQL
```

**14 — negativo, ya no depende de un seed incompleto.** Guarda el estado, lo
vacía por API, comprueba el 400 con su motivo, y **restaura en un `finally`**
para no dejar la base peor de lo que estaba. Después verifica contra SQL que la
restauración ocurrió. Empieza afirmando que el vendedor **sí** tenía datos: si
mañana el seed dejara de cargarlos, este caso también avisa.

### Estado final

| Comprobación | Resultado |
|---|---|
| Suite oficial, base recreada desde cero | **26/26** |
| `npm run build` | verde |
| `git -c core.whitespace=cr-at-eol diff --check` | sin avisos |

**No corrido:** `npm run smoke` tal cual, que exige Docker; corrí la misma suite
contra la base recreada a mano. Tampoco volví a correr `a11y` ni `contraste`: no
toqué `src/` ni los guiones de esas puertas.

## 4. Desvíos, riesgos y hallazgos fuera de la tarea

**El caso nuevo destapó un defecto real del producto.** Al agregar al carrito la
primera publicación del admin, la API devuelve **HTTP 500**:

```text
psycopg.errors.NumericValueOutOfRange: numeric field overflow
DETAIL: A field with precision 10, scale 2 must round to an absolute value
        less than 10^8.
```

La causa, medida:

| Columna | Tipo | Techo |
|---|---|---|
| `products.price` | `NUMERIC(12,2)` | 9.999.999.999,99 |
| `cart_items.unit_price_snapshot` | `NUMERIC(10,2)` | **99.999.999,99** |
| `order_items.unit_price_snapshot`, `total_price` | `NUMERIC(10,2)` | 99.999.999,99 |
| `orders.subtotal`, `total_amount` | `NUMERIC(10,2)` | 99.999.999,99 |

**El catálogo puede publicar un precio que el carrito no puede contener.** El
seed publica dos artículos por encima de ese techo: "Campo Agrícola de 120
Hectáreas" a 950.000.000 y "Cosechadora John Deere 9750" a 125.000.000. Ninguno
de los dos se puede comprar: la aplicación responde 500, no un mensaje.

Para un marketplace agrícola argentino, campos y cosechadoras por encima de cien
millones no son un caso raro. **Arreglarlo pide una migración, que está fuera de
este alcance**, así que no lo toqué.

**Lo que hice en su lugar, y lo digo porque es un rodeo:** el caso 13 elige la
publicación **más barata** de cada vendedor en vez de la primera. Es determinista
y esquiva el techo. Está comentado en el código con el motivo, para que nadie lo
lea como una preferencia arbitraria.

**Desvío menor:** renumeré los casos 13 a 25 para insertar el nuevo antes de
cualquier `PATCH`. Trece literales `runCase(n, …)`; ninguna otra cosa cambió.

## 5. DECISIÓN SOLICITADA

**a) El techo de 100 millones.** Beneficio: hoy dos publicaciones del catálogo
demo devuelven 500 al agregarlas al carrito, y en producción cualquier campo o
maquinaria cara hace lo mismo. Esfuerzo: una migración que lleve las cinco
columnas a `NUMERIC(14,2)`, más una prueba que compre algo caro. Riesgo: toca
esquema y hay que revisar si algo redondea o formatea asumiendo el tipo actual.
Fase: **2**, y **antes de cualquier demostración con la clienta**, porque el
"Campo Agrícola de 120 Hectáreas" es la publicación más vistosa del catálogo.
**Recomiendo abrirla como pieza siguiente.** Alternativa: bajar los precios del
seed por debajo del techo, que esconde el problema en vez de resolverlo.

**b) La próxima pieza.** Anticipaste el mensaje genérico que la interfaz muestra
cuando la API rechaza el pago. Si preferís ese antes que el techo, decímelo:
los dos apuntan a lo mismo, que un error del backend no llegue como pantalla
rota. Quedo a la espera.

El entorno local sigue levantado.
