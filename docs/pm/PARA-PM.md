# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-12.

## 1. Resultado

**Pieza C entregada.** El commit es **`ecfaa4c`**, sobre `15cb3e8`; este informe
va aparte y encima.

| Puerta | Antes | Ahora |
|---|---|---|
| Suite | 50 | **55/55** |
| Accesibilidad | 52 pantallas | **56/56** (28 rutas × 2) |
| Contraste | 36 mediciones | **40/40** (20 rutas × 2) |

La aritmética del inventario: dos rutas nuevas de accesibilidad —«checkout:
transportista elegido» y «panel: operaciones del transportista»— por dos
medidas, 52 + 4 = **56**. La de fletes cambió de nombre, no de cantidad:
«checkout: fletes compatibles» pasó a «checkout: traslado del pedido», porque
eso es lo que la pantalla hace ahora. En contraste entraron las mismas dos
pantallas: 36 + 4 = **40**.

## 2. La decisión, y dónde se comprueba

Cada futura orden se resuelve con una de dos decisiones y no hay tercera. El
tercer estado —«necesito flete pero no elegí»— no existe: es la ausencia de
decisión, y no deja avanzar.

**La regla de compatibilidad vive en una sola constante SQL** y se pregunta dos
veces, al elegir y al confirmar. No son dos consultas parecidas que puedan
separarse con el tiempo: es la misma. Eso importa porque el enunciado pide
exactamente que un cambio de perfil, radio, origen o destino entre los dos
pasos produzca un error visible, y sólo se puede garantizar si la pregunta es
literalmente una.

**Lo que manda el cliente al elegir es un id y nada más.** El grupo, sus
orígenes y el destino los vuelve a derivar el servidor del carrito. Los
candidatos que el navegador haya visto no son fuente de nada.

**El contacto aparece después de revalidar, no antes.** El listado no trae
email, teléfono ni WhatsApp: la ausencia está en el schema, no en el criterio
de quien arme la pantalla.

## 3. Atomicidad

Las decisiones se resuelven **antes de la primera fila**, en los dos checkouts.
El caso 53 tira ocho formas de romperlo contra cada uno —falta una decisión,
sobra una, vendedor inventado, dos decisiones para el mismo vendedor,
transportista sin elegir, cuenta propia con transportista, transportista que no
cubre el viaje, transportista inexistente— y después de las dieciséis
comprobaciones el conteo de órdenes y el stock están donde estaban.

Un detalle que la prueba deja explícito: el transportista que **no** sirve para
un grupo sí sirve para el otro. La incompatibilidad es del viaje, no de la
persona.

## 4. Los tres límites de privacidad

- **Comprador y vendedor** ven la decisión y, si hubo transportista, su
  contacto. Los dos lo mismo: el vendedor tiene que poder coordinar el retiro.
- **Transportista elegido**: origen, destino, artículos y cantidades. El caso 54
  busca en su JSON `price`, `amount`, `total`, `cbu`, `alias`, `receipt`,
  `phone`, `whatsapp`, `@example.com` y `buyer`, y en su pantalla cualquier
  cosa con signo peso. Nada.
- **Transportista ajeno**: **404**, no 403, y lista vacía. A quien no le
  corresponde tampoco le corresponde saber que la operación existe. Tampoco
  puede entrar por la puerta de las órdenes: ahí recibe 403, porque no es ni
  comprador ni vendedor.

## 5. Tres decisiones que tomé y te tengo que contar

**Saqué el estado de la orden de la vista del transportista.** Lo había puesto
y la prueba lo cazó: hoy ese estado dice cosas como «esperando comprobante»,
que es la etapa del **pago**. No le corresponde. Quedó afuera. Si querés que el
transportista vea algún estado, hay que inventar uno logístico, y eso es
maquinaria que excluiste.

**Le dejé el nombre del vendedor.** Tu enumeración decía «origen, destino,
artículos y cantidades». El nombre no estaba. Se lo puse igual: el origen de un
retiro es un lugar y también una persona, y sin eso la vista no sirve para
coordinar nada. Va sin contacto y sin un solo número. Si preferís que no esté,
es una línea.

**Invalido más de lo que pediste.** Vos pedís invalidar «los grupos
afectados»; yo invalido todos cuando cambia el destino o el carrito. Es un
superconjunto, así que cumple, pero tiene un costo real: en un carrito de dos
vendedores, cambiar una cantidad obliga a volver a elegir en los dos. Lo hice
así porque distinguir el grupo afectado exige un retrato por grupo en el
cliente, y un error ahí deja a la vista un contacto que ya no corresponde.
Prefiero pedir de más que mostrar de más. Si el costo te molesta, se refina.

## 6. Los casos que tuve que tocar

El contrato del checkout cambió: ahora exige una decisión por grupo. Eso rompió
casos que no miran logística, y los adapté sin cambiar lo que afirman.

- **8 llamadas de checkout por API** ahora mandan «coordino por mi cuenta»,
  derivado del carrito, no una lista fija.
- **Tres recorridos de interfaz** resuelven el traslado antes de avanzar.
- **Caso 43**: para ver el directorio hay que decir «necesito flete». El resto
  del caso —contraste con PostGIS, el listado que sigue al carrito de pantalla,
  cero contacto— quedó igual.
- **Caso 45**: resuelve el traslado antes de avanzar al pago.
- **Caso 30** cambió de lugar, y creo que para mejor. Ese caso rompe la
  sincronización a propósito; ahora el checkout ni siquiera puede armar los
  pedidos, así que **el motivo real de la API aparece antes, en el paso de
  envío**, y la pantalla no avanza. El caso comprueba eso: el motivo real, sin
  el mensaje del respaldo viejo, cero llamadas de respaldo y cero órdenes.

## 7. Dos cosas de la suite, no del producto

**Un `fetch failed` intermitente.** Me apareció tres veces en corridas
distintas, siempre a los pocos milisegundos y siempre después de un caso lento:
es una conexión reutilizada que el servidor cerró justo antes. No es la API —no
hubo status, no hubo respuesta, y el log del servidor no registra nada—. Agregué
**un** reintento y **sólo** para cortes de socket: cualquier HTTP, incluido un
500, pasa derecho, porque eso sí es una respuesta y la prueba tiene que verla.

**`correrAlembic` leía de menos.** Alembic escribe sus avisos por stderr;
mirando sólo stdout, una migración correcta parecía no haber corrido. Ahora
junta las dos salidas.

## 8. Estado final

| Comprobación | Resultado |
|---|---|
| Suite completa, base recreada desde cero | **55/55** |
| `npm run a11y -- --todas`, base recién sembrada | **56/56**, 0 violaciones |
| `npm run contraste` | **40/40**, 0 incumplimientos |
| `npm run build` (incluye `tsc`) | verde |
| `alembic downgrade -1` + `upgrade head` + `check` | verde, con datos adentro |
| `eslint` sobre los archivos tocados | 0 errores, 0 avisos nuevos |
| `git -c core.whitespace=cr-at-eol diff --cached --check` | sin avisos |

No agregué dependencias. No hay mapas, ruteo, GPS, peso, capacidad calculada,
precio ni cobro del flete, Carta de Porte, mensajería, planes ni Railway. No
rediseñé el checkout: la pantalla sigue el prototipo aprobado, incluidas las
tres frases que no se negocian.

## 9. Riesgos y deudas

**Uno nuevo.** Las dos pantallas nuevas de accesibilidad y contraste dependen de
una publicación del seed —«Fertilizante Triple 15 - NPK», con origen en
Pergamino— porque sin un transportista compatible no hay a quién elegir y las
pantallas no existirían. Está comentado en los dos scripts: si el seed cambia,
la puerta **falla** en vez de medir de menos. Es la dependencia menos mala que
encontré; la alternativa era que el barrido escribiera en la base.

**Sigue abierto el `float` del checkout**, obligatorio antes de Fase 4. Esta
pieza no lo tocó: los importes siguen viajando como venían.

**Sigue abierto lo del punto 5 del informe anterior** —la precedencia de
credenciales ya está resuelta, pero el cliente sigue mandando header y cookie
juntos—; no es de esta pieza.

Nota de reproducibilidad, la de siempre: Docker no está disponible en mi entorno
—demonio caído y registry 403—, así que todo corre nativo con un puente que
traduce sólo lo que la suite pide por `docker exec`: `psql`, `python` y ahora
`alembic`. `./scripts/init_local_db.sh` sigue siendo el camino con contenedores
y no lo cambié.

El entorno local quedó levantado: API en `:8000`, Vite en `:5173`, base recreada
y con seed.
