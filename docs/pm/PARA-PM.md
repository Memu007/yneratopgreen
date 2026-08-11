# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-11.

## 1. Resultado

**Corregido.** El commit es **`db85ff4`**, sobre `1ec7082`; este informe va
aparte y encima. La suite pasa de 44 a **46 casos**; el barrido sigue en 52
pantallas.

**Las dos carreras eran reales**, y una de las dos era peor de lo que decía tu
descripción. Va primero eso, y al final una cosa que **no** puedo demostrar y
te la digo sin adornos.

## 2. La primera carrera: peor de lo que parecía

Tu punto era el número de consulta, que evita que una promesa vieja actualice
React pero no que su `POST` escriba después. Correcto. Pero al buscar de dónde
podía salir esa segunda escritura encontré algo más concreto:

**El paso de pago sincronizaba el carrito por su cuenta.** `selectBankTransfer`
y el envío del pedido llamaban directo a la sincronización, fuera de todo
control. Entonces alcanzaba con esto, sin tocar nada raro:

1. la persona elige destino y sale la escritura A;
2. con A en vuelo, toca «Continuar al Pago» y sale la escritura B;
3. si A termina última, el servidor queda con el carrito anterior;
4. y **las opciones de transferencia y la orden se calculan sobre ese carrito**.

O sea: no era sólo un listado equivocado, era una orden equivocada.

**Todas las sincronizaciones pasan ahora por una sola cola encadenada.** La
última en salir es la última en escribir, y nadie —ni los fletes ni el pago—
lee nada hasta que la cola se vacía. Dos detalles que hacen falta para que eso
sea cierto:

- el retrato que decide si hay que sincronizar es el **último encolado**, no el
  último terminado: con una escritura en vuelo el servidor todavía no
  representa lo que se ve;
- una sincronización fallida limpia ese retrato **haya quedado vigente o no**,
  para que el intento siguiente vuelva a mandar el carrito en vez de suponer
  que ya está.

## 3. La segunda: generación siempre

Un renglón: el número se incrementa **antes** de cualquier retorno, también
cuando no hay destino. Antes, cambiar de provincia vaciaba la localidad y salía
sin mover la generación, así que la respuesta en vuelo de la anterior seguía
pasando por vigente.

## 4. Las regresiones

Caso **45**, con la escritura retenida a voluntad —no con tiempos de red—:

```text
[PASS] 45 … con una escritura en vuelo: 0 escrituras encima, 0 consultas de
  fletes y 0 de pago; liberada, el servidor queda con el carrito visible y el
  pago describe al vendedor correcto
```

Servidor con el producto de un vendedor, interfaz con el de otro, la primera
escritura del carrito retenida por la prueba, y en el medio la persona avanza
al pago. Se exige que **nadie escriba ni lea por encima** mientras la escritura
está sin confirmar, y que al liberarla el servidor quede con el carrito visible
y el pago hable del vendedor correcto.

**Rojo forzado.** Devolví el pago a sincronizar por su cuenta y el caso lo
nombró:

```text
[FAIL] 45 — el pago escribió el carrito por encima de una escritura en vuelo
  (2 en total)
```

## 5. Lo que el caso 46 no prueba

Acá te debo una y prefiero decirla yo.

El caso **46** hace lo que pediste: retiene la respuesta del destino anterior,
vacía la localidad cambiando de provincia, libera la respuesta y comprueba que
no reaparezca ningún listado. Pasa.

**Pero también pasa con la carrera puesta.** Lo corrí a propósito con la
generación devuelta a su lugar viejo y siguió verde. El motivo es que la
sección de fletes no se dibuja cuando no hay destino: aunque la respuesta
tardía escriba el estado, no hay nada en pantalla que lo muestre, y al elegir
un destino nuevo el estado se limpia antes de consultar.

O sea: **la segunda carrera no es observable desde la interfaz hoy**. La
corrección es correcta y barata, y deja de depender de que la sección siga
ocultándose; pero el caso 46 documenta el comportamiento, no demuestra el
arreglo. No quiero anotarlo como prueba de algo que no prueba.

Si querés una prueba que sí discrimine, la única forma honesta que veo es hacer
observable el estado —por ejemplo que la sección muestre «elegí un destino» en
vez de desaparecer—, y eso es un cambio de interfaz que no voy a hacer sin que
lo pidas.

## 6. Estado final

| Comprobación | Resultado |
|---|---|
| Suite completa, base recreada | **46/46** |
| Caso 45 con el pago escribiendo por su cuenta | rojo, nombrando la causa |
| Caso 46 con la generación vieja | **verde igual** — ver punto 5 |
| `npm run a11y -- --todas` | **52/52**, 0 violaciones de cualquier impacto |
| `npm run build` | verde |
| `git -c core.whitespace=cr-at-eol diff --cached --check` | sin avisos |

No repetí contraste: no toqué colores ni estilos. No reescribí el caso A/B, no
amplié el módulo y no toqué migración, regla geográfica, declaración,
persistencia de órdenes ni Railway.

## 7. Riesgo

**Uno.** El paso de pago ahora reutiliza la sincronización de la búsqueda de
fletes cuando el carrito no cambió, en vez de mandar la suya. Es una escritura
menos y el resultado es el mismo, pero si mañana aparece una forma de cambiar
el carrito desde el checkout —el botón «quitar» que quedó fuera del MVP—, hay
que comprobar que el retrato la refleje. Está escrito así justamente para que
ese cambio dispare una sincronización nueva, pero conviene mirarlo cuando pase.

**Sigue abierto el `float` del checkout**, obligatorio antes de Fase 4.

El entorno local sigue levantado: API en `:8000`, Vite en `:5173`, base
recreada y con seed.
