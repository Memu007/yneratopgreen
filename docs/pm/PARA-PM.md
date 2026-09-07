# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## REGISTER-POLISH-1R — la prueba no ensucia el producto

Hecho. Regresión/README e informe en commits separados. **No desplegué.**

- Regresión/README: `7268958` — «REGISTER-POLISH-1R: la prueba no escribe sobre
  archivos rastreados»
- La suite sigue en **154 casos**: corregí el bloque, no creé el 155.

Los dos defectos son míos y son de los que no se ven hasta que alguien corre la
suite en serio. Una regresión que escribe sobre archivos versionados no es
evidencia: es una fuente de ruido en cada entrega siguiente. Y un bloque que
dice «sin espera fija» y después duerme 150 ms miente sobre su propio contrato,
que es peor que no decir nada.

---

### 1. El rojo, contra `7ca4fc7`

Árbol limpio, corrida por defecto del 154, y el caso **pasa**:

```
$ git status --short
(vacío)

$ SMOKE_CASOS=154 node scripts/smoke.mjs
[PASS] 154 …

$ git status --short
 M docs/pm/capturas-registro/alta-base-1440x900.png
 M docs/pm/capturas-registro/alta-base-con-error-390x844.png
 M docs/pm/capturas-registro/transportista-1440x900.png
 M docs/pm/capturas-registro/transportista-390x844.png
```

Es tu punto 1 reproducido: verde y sucio a la vez.

### 2. Lo que encontré midiendo, y que corrige tu diagnóstico del correo

Comparé los cuatro PNG recién generados contra los de `HEAD`:

```
alta-base-1440x900.png              disco 7fb9fe54abe7   HEAD e14d9814f8c6
alta-base-con-error-390x844.png     disco 4025e25da933   HEAD 35e71c31e404
transportista-1440x900.png          disco dde8c6b6f74d   HEAD fdf6e44dce14
transportista-390x844.png           disco d1a5d5d49a6a   HEAD de36e11988d4
```

Los cuatro cambian. Y **`alta-base-1440x900.png` no muestra el correo**: en ese
punto del recorrido lo único escrito es la contraseña. Así que el `Date.now()`
no es la causa, o no la única: el PNG no es reproducible entre dos corridas del
mismo árbol, y punto.

Eso descarta el arreglo que parecía obvio —fijar el correo—, porque no habría
alcanzado. Y confirma tu conclusión por otro camino: si la salida no puede ser
byte a byte igual, no tiene nada que hacer escribiendo sobre un archivo
rastreado.

### 3. La corrección

```
const CAPTURAS = process.env.SMOKE_CAPTURAS
  || mkdtempSync(`${tmpdir()}/topgreen-registro-`);
```

Sin variable, carpeta temporal nueva —el mismo patrón que ya usan los casos
131, 135 y 153— y la ruta viaja en la línea de resultado del caso. Con
variable, el destino explícito se respeta igual que antes.

La rueda deja de dormir:

```js
await page.evaluate(() => new Promise((seguir) => {
  requestAnimationFrame(() => requestAnimationFrame(() => seguir()));
}));
```

El desplazamiento se aplica antes del cuadro siguiente y el segundo garantiza
que ya se pintó. La aserción es la misma y no se aflojó: `window.scrollY` tiene
que valer lo mismo que antes de rodar.

### 4. Las capturas versionadas

Las **conservo**, como evidencia estática de `7ca4fc7`, que es el árbol que vos
inspeccionaste. No tengo una razón mejor para retirarlas: son lo único que deja
ver la pantalla sin levantar el entorno, y ahora ya no se pisan solas.

El README dice las tres cosas que faltaban: que una corrida por defecto no toca
la carpeta, cómo refrescarla a propósito
(`SMOKE_CAPTURAS=docs/pm/capturas-registro`), y que un `git status` sucio ahí
nunca significa que el producto cambió.

### 5. La comprobación que pediste

Base local nueva, árbol limpio salvo los dos archivos de esta entrega, sin
`SMOKE_CAPTURAS`:

```
$ git status --short
 M docs/pm/capturas-registro/README.md
 M scripts/smoke.mjs

$ SMOKE_CASOS=154 node scripts/smoke.mjs
[PASS] 154 …   1/1

$ git status --short
 M docs/pm/capturas-registro/README.md
 M scripts/smoke.mjs        ← idéntico, ningún binario tocado
```

Carpeta temporal y archivos generados:

```
/tmp/topgreen-registro-MBfCGE/
  alta-base-1440x900.png             426281 bytes
  transportista-1440x900.png         433421 bytes
  alta-base-con-error-390x844.png     57511 bytes
  transportista-390x844.png           57470 bytes
```

Y con destino explícito —`SMOKE_CAPTURAS=…/capturas-explicitas`— los cuatro
archivos aparecieron ahí y la carpeta versionada tampoco se movió.

### 6. Puertas

```
base limpia + SMOKE_CASOS=154                   1/1
node --check scripts/smoke.mjs                  ok
git -c core.whitespace=cr-at-eol diff --check   limpio
```

Como indicaste, no repetí suite completa, build, lint, contraste, a11y ni
Backend: el diff son 44 líneas entre el arnés y el README, y no toca producto.

### 7. Hashes

```
scripts/smoke.mjs                               1270bf3e271cc0db
docs/pm/capturas-registro/README.md             cbe8a9145335b652
```

(SHA-256 truncado a 16, del árbol en `7268958`.)

### 8. Riesgos residuales

1. **La carpeta temporal no se borra.** Cada corrida del 154 deja cuatro PNG en
   el temporal del sistema, cerca de 1 MB. Es a propósito: si el caso los
   borrara al terminar, no habría nada para mirar cuando falla. El sistema
   operativo se ocupa. Si preferís que limpie cuando pasa y conserve cuando
   falla, decilo y lo hago.
2. **Las cuatro capturas versionadas van a envejecer.** Quedan pegadas a
   `7ca4fc7` hasta que alguien las refresque a mano. Es el precio de que la
   prueba no escriba sobre lo rastreado, y me parece el precio correcto, pero
   significa que un cambio visual futuro las deja desactualizadas sin que nada
   avise.
3. **Sigue en pie lo del informe anterior**: `Mostrar` gobierna los dos campos
   de contraseña, el ancho del botón está clavado en 92 px, y el copy del Login
   quedó sin tocar —`Iniciar Sesión`, `¿No tienes cuenta?`, `Regístrate aquí`—
   esperando tu decisión sobre si entra acá o en `COPY-CLEAR-1`.

### 9. Frenos

No toqué CSS, React, copy, Login ni las cuatro capturas visuales. No creé el
155. No cambié Backend, API, navegación, Mercado, BOEDA, Railway, pagos ni
datos remotos. No desplegué. `PRE_FIRMA.md` sigue fuera del versionado y lo
confirmé antes de empujar.

Freno acá y te pido revisión.
