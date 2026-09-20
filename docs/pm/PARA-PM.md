# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## POST-INTEGRATION-CLEAR-1 — entregada, para tu revisión

| | |
|---|---|
| rama | `main` |
| SHA base | `96edc87` |
| SHA candidato (producto + arnés) | `cb3a4a7` |
| informe | este commit |
| diff | `scripts/smoke.mjs`, `src/components/Header/Header.tsx`, `src/components/Pages/ContactPage.tsx` — 375 líneas agregadas, 9 quitadas, de las cuales 338 son el caso nuevo |

Nada de backend, nada de routing, ninguna dependencia nueva, ningún estado
paralelo. No desplegué, no toqué Railway, credenciales, datos remotos ni
configuración de Mercado Pago.

### Lo que cambió, en dos frases

La cabecera ofrece ahora la celda **Carrito** también sin sesión, y sólo
cuando hay algo adentro: es el mismo botón y el mismo estado de siempre. Y la
respuesta «¿Cuáles son las formas de pago?» dice las dos formas —transferencia
directa al vendedor y Mercado Pago **cuando ese vendedor lo tiene
habilitado**— en vez de nombrar sólo la transferencia.

### El rojo primero, que es lo que pediste

El caso **170** falla contra `96edc87` y pasa con la corrección. Éste es el
rojo, literal:

```
[FAIL] 170 … con lo elegido guardado y sin sesión la cabecera no ofrece
«Carrito»: lo que la persona eligió quedó sin puerta, y el botón de la
tarjeta dice «Ingresar para continuar». La cabecera dice
["AgroBoeda","Ingresar","Inicio","Mercado","Servicios","Quiénes somos",
"Contacto","Buscar"]
```

Eso lo corrí dos veces contra la base: una con el caso a medio escribir y otra
con el caso final, guardando la corrección aparte. Las dos veces el rojo llegó
en el mismo punto y por el mismo motivo, después de que todo lo anterior
—identidad abajo, carrito conservado, cancelar el ingreso— pasara.

El caso mide los cuatro puntos de tu alcance y tres más que no pediste y que
hacían falta para no entregarte una media verdad:

1. carrito con ítems + sesión confirmada inválida → identidad fuera, carrito
   conservado y **accesible desde la cabecera** después de cerrarlo;
2. cerrar el Login → mismos ítems y carrito reabierto;
3. salida explícita → carrito vacío **y** la celda desaparece;
4. la FAQ nombra transferencia y Mercado Pago con su condición por vendedor;
5. recargar sin sesión conserva lo elegido y la celda: lo que la cabecera
   reabre es la copia local de siempre, no algo vivo en memoria;
6. la cabecera sin sesión en **1440×900 y 390×844**: sin desborde horizontal,
   sin ninguna celda fuera de la ventana, con las cinco secciones, con el
   monograma en su proporción exacta (1,624 dibujado contra 1,624 natural) y
   con el foco de teclado visible en la celda nueva;
7. quien nunca eligió nada tampoco ve la celda.

### Comandos y resultados exactos

```
SMOKE_CASOS=170 (contra 96edc87)                FAIL 170     ← el rojo
SMOKE_CASOS=170 (con la corrección)             1/1
SMOKE_CASOS=170 (base recreada, focal limpio)   1/1
suite completa desde base limpia                168/170      ← dos rojos, abajo
npm run build                                   ✓ built in 1.92s
npm run lint (--max-warnings 0)                 sin salida
npx tsc --noEmit                                sin salida
node --check scripts/smoke.mjs                  ok
python -m compileall backend/app                ok
python -m pip check                             No broken requirements found
git -c core.whitespace=cr-at-eol diff --check   sin avisos
npm run a11y -- --todas                         68/68 pantallas, 0 bloqueantes
npm run contraste                               76/76 mediciones, 0 incumplimientos
```

### Los dos rojos de la suite completa, sin maquillar

**131 — de entorno, conocido.** Este contenedor no tiene demonio de Docker ni
la imagen `alpine:3`, y el caso los necesita. Es el mismo rojo que ya conocés
de las corridas nativas.

**169 — preexistente, y acusa de algo que no pasó.** Éste no lo esperaba, así
que lo diagnostiqué antes de escribirte, y el resultado importa:

- **es reproducible y acotado**: `SMOKE_CASOS=168,169` da rojo; el 169 solo, en
  cambio, pasó **cuatro de cuatro veces**;
- **no es mío**: reproduje exactamente el mismo rojo sobre `96edc87`, con mi
  diff fuera del árbol;
- **y la API nunca se cayó.** El caso dice «el escenario del suplantado se
  llevó puesta la API de verdad». Puse un vigía afuera del arnés midiendo
  `/api/health` con `curl` cada segundo durante todo el escenario: devolvió
  **200 siempre**, y `uvicorn` conservó **el mismo PID** de punta a punta;
- **la causa exacta**: instrumenté la comprobación del propio caso y el error
  es `UND_ERR_SOCKET`. `laApiContesta()` hace un único `fetch` sin reintento,
  y después del caso 168 —que deja el pool de conexiones caliente contra
  `127.0.0.1:8000`— toma una conexión que el servidor ya cerró y la trata como
  «no contesta».

O sea: el 169 tiene un falso rojo propio que aparece cuando corre detrás de un
caso de navegador pesado. **No lo toqué**: es otro caso y otra tarea, y
arreglarlo por mi cuenta sería meter en esta entrega un cambio que no pediste.
Lo dejo propuesto abajo.

### Lo que no hice, y por qué

- **No toqué la regla de vaciado en la salida explícita.** Sigue vaciando, y
  el caso lo mide.
- **No hay checkout anónimo.** Sin sesión, «Continuar compra» abre el Login de
  siempre; el caso comprueba que el Checkout **no** se abre en ese momento, y
  que autenticarse reanuda la compra sin volver a apretar nada.
- **No rediseñé nada.** La celda nueva entra por la regla que la cabecera ya
  tenía —cada acción que suma el rol es una celda más con su propio
  separador—, así que no hubo una sola línea de CSS.
- **Con sesión y carrito vacío la celda sigue estando**, como siempre. Tu
  regla de «no agregues un botón de carrito vacío» la apliqué donde la
  escribiste: sin sesión.

### Una cosa que tenés que saber sobre la FAQ

El interruptor `MP_CHECKOUT_HABILITADO` viene en **`false`** en las dos
plantillas de entorno versionadas. O sea: hoy, con la configuración del
repositorio, **ningún** vendedor puede cobrar por Mercado Pago, aunque el
producto sepa resolverlo por vendedor.

Por eso la respuesta quedó redactada en condicional —«cuando ese vendedor lo
tiene habilitado»— y no como un anuncio: así no promete nada falso ni con el
interruptor apagado ni con él prendido. Lo que **no** hice es que el texto se
prenda y se apague solo según el servidor: eso es estado y backend para
resolver una frase, y lo pusiste fuera de alcance. Si querés que la FAQ
esconda la mención cuando el medio está apagado, es una tarea aparte y chica.

### Lo que propongo, y no ejecuto

1. **Arreglar el falso rojo del 169**: que `laApiContesta()` reintente una vez
   antes de declarar caída la API. Es de dos líneas y saca un rojo que hoy
   ensucia cualquier corrida completa donde el 169 va detrás del 168.
2. **Decidir si la FAQ tiene que seguir el interruptor** de Mercado Pago, o si
   alcanza con la condición escrita.

Freno acá para tu revisión.
