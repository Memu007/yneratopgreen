# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## UX-COH-1S — la espera fija, afuera

Hecho. Producto e informe en commits separados. **No desplegué.**

- Producto: `aadecb5` — «UX-COH-1S: el caso 139 espera la condición, no el reloj»
- Suite: **139/139**, dos corridas completas desde base limpia.

---

### 0. Primero, la corrección del informe

Tenés razón y la afirmación era falsa. En el informe de UX-COH-1R escribí:

> «No usé esperas ni selectores frágiles para forzar el verde.»

Y el caso 139 tenía `await page.waitForTimeout(1200)`. **La retiro.** Lo correcto
era: «no usé selectores frágiles; sí dejé una espera fija de 1200 ms en el paso
final del recorrido». Escribí una afirmación general cuando tenía que mirar el
archivo, y el archivo la desmentía.

Que no vuelva a pasar con un número en vez de una promesa: en `scripts/smoke.mjs`
quedan **29** esperas fijas. **26** son anteriores a UX-COH-1. Las otras **3** son
mías, de UX-COH-1, y están las tres en el **caso 137** —líneas 14547, 14554 y
14557—, no en el 139. Las dejo porque tu alcance de hoy autoriza una sola
corrección; te las señalo para que decidas vos, no para que aparezcan después.

---

### 1. El rojo contra `ee14047`, con el producto sano

El punto no es que 1200 ms sea poco: es que **no afirma nada sobre el carrito**.
Afirma que a esta máquina le alcanzó ese rato.

Para mostrarlo hacía falta una máquina más lenta, así que fabriqué una. Retrasé
tres segundos la persistencia del carrito en `src/contexts/CartContext.tsx` —**un
parche local que nunca se versionó**; el archivo terminó byte a byte igual que en
`HEAD`, `c48cee4433c4dd97` en disco y en el árbol— y corrí el **caso 139 real**,
de la suite real, contra el producto real, que en ese estado agrega bien: sólo
tarda.

```
A) caso 139 tal cual ee14047, carrito a los 3 s
[FAIL] 139 … — en Inicio el clic con sesion no agrego nada (carrito=0)  (3093 ms)

B) caso 139 corregido, misma máquina lenta
[PASS] 139 …                                                            (verde)
```

Ese `[FAIL]` es una acusación falsa: el producto **sí** agregó. La prueba mintió
porque medía el reloj.

### 2. Y el 1200 no salía de ninguna medición

Antes de tocar nada medí cuánto tarda de verdad el carrito en pasar de 0 a 1
después del segundo gesto, en las tres pantallas:

| | Inicio | Mercado | Servicios |
|---|---|---|---|
| latencia observada | 44 ms | 39 ms | 32 ms |

Y esos números son casi todos ida y vuelta de mi propio sondeo: bajando el
presupuesto de reloj, el caso queda **verde con 20 ms, con 5 ms y con 1 ms**. O
sea que acá la escritura es prácticamente sincrónica con el clic y 1200 no era un
margen: era un número que sobró, mil veces más grande que el hecho que cubría.

Probé además frenar la CPU de la pestaña de verdad —`Emulation.setCPUThrottlingRate`,
el mismo control del panel de rendimiento— a 20x, 60x y 100x: **ni a 100x** el
carrito tarda 1200 ms. Por eso el rojo de arriba tuve que producirlo retrasando
la escritura, y lo digo en vez de dejarlo sonar más fácil de lo que fue.

### 3. Qué quedó en su lugar

```js
try {
  await esperarA(async () => await enElCarrito(page) === 1,
    `el carrito de ${seccion}`, 20_000);
} catch {
  const quedo = await enElCarrito(page).catch(() => 'ilegible');
  throw new Error(
    `en ${seccion} el clic en «${rotulo}» con la sesion abierta no agrego `
    + `nada: el carrito quedo en ${quedo} despues de 20s `
    + '(antes del clic estaba en 0)');
}
```

`esperarA` no es nueva: vive en `scripts/smoke.mjs:7012` y ya la usa el resto de
la suite. Pregunta cada 50 ms y se rinde a los 20 s. **No agregué ninguna
dependencia.**

El mensaje dice las cinco cosas que hacen falta para arreglar: en qué pantalla,
qué botón se apretó, que había sesión, en cuánto quedó el carrito y cuánto se
esperó. El `catch` sobre la lectura evita que una página cerrada tape el motivo
verdadero con un error de otra cosa.

### 4. Que siga poniéndose rojo cuando tiene que ponerse

Una espera larga puede tapar una rotura si nadie comprueba lo contrario. Rompí el
producto de verdad —quité la persistencia del carrito, otra vez con un parche
local que no se versionó— y corrí el **caso 139 real**:

```
C) caso 139 corregido, producto realmente roto
[FAIL] 139 … — en Inicio el clic en «Agregar al carrito» con la sesion abierta
              no agrego nada: el carrito quedo en 0 despues de 20s
              (antes del clic estaba en 0)                        (21967 ms)
```

Rojo, a los 20 s, y el mensaje alcanza para ir directo a `CartContext`.

### 5. Los tres estados, juntos

| | forma de `ee14047` | forma nueva |
|---|---|---|
| producto sano, esta máquina | verde | verde |
| producto sano, carrito a los 3 s | **rojo falso** | verde |
| producto roto | rojo | rojo, con el mensaje de arriba |

La fila del medio es toda la tarea.

### 6. Lo que además dejó de costar

El caso regalaba 1,2 s por pantalla:

```
caso 139 solo, forma de ee14047        12345 ms
caso 139 solo, forma nueva              9343 ms      (-3002 ms)
caso 139 dentro de la suite completa    8295 ms y 9642 ms
```

### 7. Puertas, desde base limpia

```
base limpia (drop/create + PostGIS + alembic upgrade head + seed)
node scripts/smoke.mjs                          139/139   (0 fallaron)
base limpia otra vez
node scripts/smoke.mjs                          139/139   (0 fallaron)
npm run build                                   ok
npm run lint                                    ok (--max-warnings 0)
python -m compileall backend/app                ok
python -m pip check                             No broken requirements found
git -c core.whitespace=cr-at-eol diff --check   limpio
npm run a11y -- --todas                         sin violaciones bloqueantes
npm run contraste                               TODO OK, cobertura completa
npm run hito                                    6/6 pasos
```

Diff, entero:

```
 scripts/smoke.mjs | 25 ++++++++++++++++++++++---
 1 file changed, 22 insertions(+), 3 deletions(-)
```

Un solo archivo, y es de pruebas. Sin tocar comportamiento, copy, componentes,
Backend, datos, seed, pagos, Mercado Pago, Railway ni ningún otro hallazgo UX.
Los dos parches de `CartContext.tsx` de las secciones 1 y 4 fueron experimentos
locales, se revirtieron y el archivo quedó idéntico a `HEAD`.

### 8. Hashes

```
scripts/smoke.mjs             9cfd41d155f5e172
src/contexts/CartContext.tsx  c48cee4433c4dd97   (sin cambios, para que se vea)
```

(SHA-256 truncado a 16, del árbol en el commit de producto.)

### 9. Riesgos residuales

1. **Las 29 esperas fijas que quedan**, contadas en la sección 0. Tres son mías.
   No las toqué porque no estaban autorizadas; están todas en el mismo archivo y
   se pueden convertir de a una con el mismo patrón.
2. **20 s es un presupuesto, no una verdad.** Es el que ya usa `esperarA` en toda
   la suite, así que no inventé un número nuevo; pero si algún día el carrito
   tardara más que eso, el caso diría «no agregó nada» cuando en realidad tardó.
   La diferencia con lo de antes es de tres órdenes de magnitud y el mensaje dice
   cuánto esperó, así que se distingue.
3. **Sigue abierto B2**: una persona puede agregar su propia publicación al
   carrito. Es lo que anunciaste para el bloque siguiente y **no lo abrí**.

### 10. Frenos

No cambié comportamiento, ni copy, ni componentes, ni Backend, ni datos, ni seed,
ni pagos, ni Mercado Pago, ni Railway. No agregué dependencias. No desplegué. No
abrí el bloque siguiente. Los dos experimentos que tocaron producto fueron
locales y se revirtieron con verificación de hash. `PRE_FIRMA.md` sigue fuera del
versionado y lo confirmé antes de empujar.
