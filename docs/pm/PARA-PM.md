# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## FORM-CONSISTENCY-1R — el mismo error también tiene que volver a la vista

Hecho. Producto/regresión e informe en commits separados. **No desplegué.**

- Producto/regresión: `042a3e3` — «FORM-CONSISTENCY-1R: el mismo error también
  tiene que volver a la vista»
- La suite sigue en **151 casos**: extendí el bloque B, no agregué un caso.

Tenías razón y el diagnóstico que trajiste era exacto. Lo confirmé antes de
tocar nada.

---

### 1. El rojo, contra `6837af1`

Con el segundo envío puesto en el caso, sobre el producto devuelto:

```
[FAIL] 151 … — el segundo intento con el mismo error dejo la alerta fuera de
             la ventana
```

Coincide con tu medición: en 1200 × 400, el segundo intento sin cambiar valores
dejaba la alerta en `top=-381` y el foco en «Crear cuenta».

La causa es la que dijiste, y conviene dejarla escrita porque es fácil de
volver a cometer: `handleSubmit` hace `setError('')` y enseguida
`setError('Las contraseñas no coinciden')` **dentro del mismo evento**. React
agrupa los dos, el estado final es idéntico al anterior, no hay re-render por
ese cambio y el efecto —que dependía sólo de `error`— no vuelve a correr. El
aviso seguía ahí, escrito y correcto; lo que no volvía era la vista ni el foco.

### 2. La corrección

Un contador de avisos, y nada más:

```
const [avisoDelError, setAvisoDelError] = useState(0);
const avisarDelError = (mensaje: string) => {
  setError(mensaje);
  setAvisoDelError((n) => n + 1);
};
...
}, [error, avisoDelError]);
```

Todos los caminos que informan un error real pasan por `avisarDelError`: las
dos validaciones propias, el fallo de la API del alta y los dos fallos de
catálogo. El `setError('')` que limpia al empezar el envío **no** cuenta como
aviso, así que limpiar no mueve el foco.

Son once líneas en `RegisterModal.tsx`. No agregué otro sistema de alertas, no
reescribí el formulario y no toqué los otros cuatro bordes.

### 3. El bloque B del caso 151

Extendido, no duplicado. El segundo envío no se limita a repetir la aserción
—eso pasaría solo, porque la alerta ya estaba visible—: primero **la saca de la
vista a propósito** y comprueba que efectivamente quedó afuera y que el foco
está en «Crear cuenta». Recién entonces vuelve a enviar, sin cambiar un solo
valor, y exige alerta única, dentro de la ventana, enfocada, con el nombre y la
contraseña intactos. Sin esperas fijas.

Ese paso previo es lo que hace que el caso sea rojo contra `6837af1` en vez de
verde por inercia.

### 4. Puertas

```
base limpia + SMOKE_CASOS=151                   1/1
base limpia + suite completa                    150/151   (131 rojo)
  controles                                     10, 22 y 113 en verde
npm run build                                   ok
npm run lint                                    ok (--max-warnings 0)
node --check scripts/smoke.mjs                  ok
python -m compileall backend/app                ok
python -m pip check                             ok
npm run a11y -- --todas                         64/64 pantallas, 0 bloqueantes
git -c core.whitespace=cr-at-eol diff --check   limpio
```

Contraste no lo corrí: no toqué estilos, como acordamos.

El **131** es el ambiental de siempre —mi puente traduce `docker exec` y esa
receta necesita `docker run --rm -v … alpine:3`—, así que **151/151 es lo que
tiene que dar en tu máquina**; yo no lo declaro.

### 5. Hashes

```
src/components/Auth/RegisterModal.tsx           1d549392f0bc1088
scripts/smoke.mjs                               a583ed78125091a5
```

(SHA-256 truncado a 16, del árbol en `042a3e3`.)

### 6. Riesgos residuales

1. **El contador también aplica a los fallos de catálogo.** Si el padrón de
   localidades falla dos veces seguidas, el foco vuelve a la alerta las dos
   veces. Es coherente con la regla, pero ahí la persona no pidió nada: puede
   sentirse intrusivo. Si preferís que sólo los errores de envío muevan el
   foco, es una línea y te lo mido.
2. **El contador no tiene techo.** Es un entero que sube por aviso; en una
   sesión real no llega a nada, pero es estado que nunca se reinicia mientras
   el modal está abierto.
3. Sigue en pie lo del informe anterior: el foco va a la alerta y no al campo
   responsable, la matriz de precio no valida moneda ni máximos, el Backend no
   está atado a esa matriz y el reintento de cargas es manual.
4. El caso 151 deja las mismas tres publicaciones del vendedor que ya dejaba.

### 7. Frenos

No amplié el agregado de borrado de imágenes, no abrí bordes nuevos de precio,
carga ni Login, y no toqué Backend, API, modelos, migraciones, seed, pagos,
BOEDA, Railway ni datos remotos. No desplegué. `PRE_FIRMA.md` sigue fuera del
versionado y lo confirmé antes de empujar.

Freno acá y te pido revisión.
