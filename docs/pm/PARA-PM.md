# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-12.

## 0. Primero, el hash que te di mal

La entrega inicial de la puerta es **`1e8822d`**, no `cc08aa2`. Escribí el
informe con el hash de antes de enmendar el commit: había convertido sin querer
todo `package.json` a LF —lo lee Python en modo texto y lo escribe igual—, lo
volví a dejar como estaba y el hash cambió. Reporté el viejo. Es la segunda vez
que me pasa con hashes; a partir de ahora el número lo saco de `git log`
después del último toque, no de mi memoria.

Cierre de esta pieza: **`3580faa`**, sobre `8f7e67f`. Este informe va aparte y
encima.

## 1. Los dos falsos positivos

Tenías razón en los dos, y los dos eran del mismo tipo: la comprobación podía
pasar sin que lo comprobado fuera cierto.

### El catálogo se medía por reloj

`waitForTimeout(1200)` entre elegir la localidad y comparar. Una consulta más
lenta que ese número y la puerta comparaba el catálogo anterior contra el SQL
nuevo —o pasaba de casualidad, que es peor—.

Ahora sincroniza por señal: espera la **respuesta** de la consulta que lleva las
tres condiciones juntas —categoría, provincia y localidad— y después que la
grilla haya terminado de pintar exactamente esa respuesta, contando tarjetas
contra el tamaño del cuerpo recibido.

Y agregué algo que no me pediste pero hace la puerta honesta sola: **la puerta
retrasa esa consulta 2,5 s a propósito**. Cada corrida demuestra, con el
retraso puesto, que no está esperando un reloj. El contraste pasó a ser de tres
puntas: pantalla, API y SQL.

Un detalle que encontré al implementarlo: la categoría viaja en la URL como
**id**, no como nombre. El predicado la exige presente y no vacía, junto con la
provincia y el id de localidad —que sale del propio selector, no de una
constante—.

### La vista del transportista se medía sobre la página entera

El recorrido, el producto y la ausencia de importes se buscaban en todo el
`body`. Un texto de otra operación podía hacer pasar el caso.

Ahora todo se mira dentro de la tarjeta de esa operación, y esa tarjeta tiene
que ser **exactamente una**. Aproveché para agregar la cantidad, contrastada
contra el ítem de la orden: antes se afirmaba «cantidades» sin mirar ninguna.

## 2. Las dos fallas forzadas

Con la misma convención que la suite (`--force-failure=`), fuera de la puerta y
a pedido:

```bash
npm run hito -- --force-failure=catalogo-sin-senal
```
```text
  ✗ catálogo filtrado por categoría y ubicación oficial
      la pantalla y SQL no coinciden:
      pantalla:
      SQL:      Fertilizante Triple 15 - NPK
HITO NO DEMOSTRADO        (salida 1)
```
Vuelve a la espera por reloj. Con la consulta retrasada, la pantalla todavía
está vacía y SQL ya tiene la publicación: exactamente el falso positivo que
señalaste, ahora visible.

```bash
npm run hito -- --force-failure=tarjeta-suplantada
```
```text
  ✗ la operación como transportista
      esperaba una sola tarjeta de la operación ORD-…-80BE2179, encontré 0
HITO NO DEMOSTRADO        (salida 1)
```
Inyecta en la página los mismos textos de la tarjeta —número de operación,
producto y recorrido— **fuera** de ella, y borra la tarjeta real. Una
comprobación de página entera pasaría con el señuelo; la de tarjeta encuentra
cero. Es la demostración exacta de que la presencia de esos textos en otro lado
no alcanza.

## 3. Estado final

| Comprobación | Resultado |
|---|---|
| `npm run hito`, base recreada desde cero | **6/6 pasos** |
| `--force-failure=catalogo-sin-senal` | rojo, salida 1 |
| `--force-failure=tarjeta-suplantada` | rojo, salida 1 |
| Suite completa, base recreada desde cero | **58/58** |
| `npm run build` (incluye `tsc`) | verde |
| `git -c core.whitespace=cr-at-eol diff --check` | sin avisos |

Conservé el comando, los seis pasos, el helper SQL y la suite. No agregué casos
ni framework: las dos fallas forzadas son dos ramas del mismo script. No hay
una línea de producto en el diff —el único archivo tocado es `scripts/hito.mjs`—
así que no volví a correr accesibilidad ni contraste; sus últimos verdes son de
la corrida anterior, 56/56 y 40/40, y nada de lo que miden cambió.

## 4. Sobre tu Docker apagado

Lo anoto porque nos va a seguir pasando: vos no pudiste correr la ruta oficial
y yo tampoco tengo Docker en mi entorno. Los dos estamos verificando por
caminos nativos distintos. Si querés que eso deje de ser una nota al pie, lo
más barato es que las puertas acepten una variable con el comando de acceso a
la base en vez de asumir `docker exec` —hoy está escrito ahí adentro—. No lo
hice porque no me lo pediste y toca los tres scripts; queda propuesto.

## 5. Riesgos y deudas

Los mismos de la entrega anterior, sin cambios:

- el recorrido depende de datos concretos del seed, escritos como constantes
  arriba del script; si el seed cambia, la puerta falla en vez de medir de
  menos;
- el tramo del seed tiene origen y destino en la misma localidad, así que las
  distancias son 0 km: que la regla geográfica **discrimine** lo prueban los
  casos 43 y 53, no esta puerta;
- sigue abierto el **`float` del checkout**, obligatorio antes de Fase 4.

El entorno local quedó levantado: API en `:8000`, Vite en `:5173`, base recreada
y con seed.
