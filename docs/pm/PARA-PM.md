# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## REGISTER-POLISH-1 — el alta tiene que transmitir confianza

Hecho. Producto/regresión e informe en commits separados. **No desplegué.**

- Producto/regresión: `7ca4fc7` — «REGISTER-POLISH-1: un solo ancho para el
  alta y un control en su campo»
- La suite pasa a **154 casos**.

Emi tenía razón y el diagnóstico de tu tarea también, pero la raíz es más
simple y más fea de lo que parecía: **un `input` no llena su contenedor solo**.
Adentro de `.formGroup` —que es `flex column`— los campos se estiraban por el
`align-items: stretch` del flex, y por eso el resto del formulario se veía
prolijo. El campo de contraseña vive adentro de `.passwordGroup`, que es un
bloque común: ahí el `input` volvió a su ancho intrínseco de ~20 caracteres y
se quedó en 255 px mientras todos los demás medían 386. El botón `Mostrar` es
absoluto con `right: 1rem`, y ese `right` mide contra **el grupo**, no contra
el campo: quedó a 38 px a la derecha del campo en escritorio, y en 390 px
encima del texto y 16 px afuera. No era un problema de `passwordGroup`: era el
campo el que estaba corto.

---

### 1. El rojo, contra `b9eddf3`

Con el caso 154 puesto y el producto devuelto:

```
[FAIL] 154 … — escritorio 1440x900, alta base: «registro-clave» en x=527
             de 255px contra el ancho interior x=527 de 386px
```

Es el primer rojo a propósito: el ancho es la causa y todo lo demás es
consecuencia. Aflojando esa aserción aparecen los dos siguientes, en orden:

```
[FAIL] 154 … — escritorio 1440x900: el campo de contraseña no ofrece un botón
             cuyo nombre accesible diga qué controla
[FAIL] 154 … — escritorio 1440x900: Mostrar/Ocultar quedó fuera del campo de
             contraseña — campo 527..782 × 550..597; botón 820..897 × 574..603
```

Ese último renglón es la captura de Emi convertida en números: el botón
empieza 38 px después de que el campo terminó, y además se sale 6 px por
abajo porque `top: 50%` nunca tuvo su `translateY(-50%)`. Medía 77 × 29.

### 2. La corrección

Toda en CSS salvo el rótulo, la agrupación y el copy.

```
.input, .select        width: 100% — el ancho deja de ser un accidente del flex
.passwordGroup         declara --tg-toggle-ancho: 92px
.passwordGroup .input  padding-right: 92px + 12px — el campo reserva el lugar
.togglePassword        width 92 / height 44, right: 4px, translateY(-50%)
```

El botón ahora **vive adentro del campo**, con blanco táctil 92 × 44, y el
texto nunca puede quedar debajo porque el relleno derecho es mayor que el
ancho del control. El nombre accesible pasa a decir qué controla y en qué
estado está: `Mostrar contraseña` / `Ocultar contraseña`, con el rótulo visible
—`Mostrar` / `Ocultar`— contenido en el nombre, como pide la regla de rótulo
en el nombre.

Lo demás es la jerarquía que pediste, con los tokens de B y sin inventar
ninguno: familia de títulos en el título, filete de cereal arriba de la capa,
regla fina en vez del subrayado de 2 px, introducción de dos renglones,
leyenda de obligatorios, `(opcional)` explícito donde corresponde, y la acción
principal del mismo ancho que todo lo que la precede.

El copy que cambié en esta superficie, entero:

```
Crear Cuenta                        → Crear cuenta
¿Ya tienes cuenta?                  → ¿Ya tenés cuenta?
Inicia sesión aquí                  → Iniciá sesión
Repite tu contraseña                → Repetí tu contraseña
Creando cuenta... / Reenviando...   → Creando la cuenta… / Reenviando…
Error al crear la cuenta.           → No pudimos crear la cuenta.
  Intenta nuevamente.                 Probá de nuevo.
```

El último es **el respaldo local**, el que se muestra sólo cuando la API no
manda motivo. Los motivos que sí manda la API siguen subiendo tal cual, como
los dejó `FORM-CONSISTENCY-1`: eso no lo toqué.

### 3. La ampliación de transportista

Pasa de fragmento suelto a **grupo con nombre** (`role="group"` +
`aria-labelledby`), con título, una línea que explica qué son esos datos, y una
regla de cereal que la separa del alta base.

La agrupé **sin encajonarla**: nada de recuadro con relleno propio. Un recuadro
habría creado un segundo ancho interior adentro del primero, que es
exactamente lo que esta pieza vino a terminar. Todo lo de adentro conserva el
mismo margen izquierdo y el mismo ancho que el alta base, y el caso lo mide en
las dos etapas.

Cerrada no deja nada: ni contenedor, ni espacio. Lo medí comparando la altura
del formulario antes de tildar y después de destildar — misma altura, con 1 px
de tolerancia. Y lo escrito sobrevive: al reabrir se conservan los ocho valores
y la carga tildada, porque nunca vivieron en el markup sino en el estado del
formulario. Eso ya funcionaba; ahora está medido y no se puede romper en
silencio.

### 4. El caso 154 y las capturas

Un solo caso, sobre la UI real, sin ruta de prueba ni espera fija: lo
asincrónico —padrón, catálogo de cargas, alerta— se espera por condición. En
1440 × 900 y en 390 × 844 mide:

- que todos los controles que llevan un dato compartan borde izquierdo y ancho,
  con medio pixel de holgura por el redondeo del navegador;
- que ni el documento ni la capa desborden a lo ancho;
- que la acción final sea alcanzable de verdad: dentro de la ventana y con
  `elementFromPoint` devolviendo el propio botón, no algo que lo tape;
- que rodar sobre la capa no mueva el documento de atrás;
- Mostrar/Ocultar: contenido en el campo, 44 × 44, cambia el tipo del input,
  cambia el nombre accesible en los dos estados, y no pierde lo escrito;
- que el campo reserve al menos el ancho del botón;
- el error de validación: anunciado, dentro de la ventana, con el foco, y sin
  borrar nombre, correo ni contraseña;
- la ampliación: cerrada no deja contenedor ni espacio; abierta trae grupo con
  nombre, padrón real, catálogo real de cargas y la ayuda privada del dominio;
  y al cerrar y reabrir conserva los ocho valores, la carga tildada y los tres
  `required`.

Cuatro capturas, en `docs/pm/capturas-registro/`:

```
alta-base-1440x900.png              1440 × 900
transportista-1440x900.png          1440 × 900
alta-base-con-error-390x844.png      390 × 844
transportista-390x844.png            390 × 844
```

Las genera el propio caso y **las sobrescribe en cada corrida**, a propósito:
así la evidencia visual no envejece respecto del código. Con
`SMOKE_CAPTURAS=/tmp/…` se las manda a otro lado. Hay un README al lado que lo
dice. No salen de Railway y no desplegué nada.

### 5. Lo que no entra sin que te lo diga

**En 390 × 844 el alta base necesita 38 px de desplazamiento dentro de la
capa.** Lo medí: el contenido son 848 px y la capa da 810. Con los mismos
tokens no hay forma de llegar a cero sin sacar una de las cosas que vos misma
pediste: la introducción breve (–68 px) o los 44 px de blanco táctil de las
casillas y los campos. Elegí conservarlas y dejar el desplazamiento, que es de
poco más de un renglón, ocurre dentro de la capa, no mueve el fondo y no deja
ningún control cortado. **Si preferís cero desplazamiento ahí, decímelo y saco
la introducción en móvil**: es un cambio de dos líneas.

En 1440 × 900 sí entra entero, sin desplazar: 825 px de contenido en 868
disponibles. Para eso subí el `max-height` de la capa de `90vh` a
`calc(100vh - 32px)`; con `90vh` faltaban 15 px y una pantalla que cabe
obligaba a rodar.

### 6. Lo que agregué de más, declarado

Todo esto está adentro de la superficie que me diste, pero no me lo pediste:

1. **Cerrar pasa a 44 × 44.** Medía 28 × 26. Se recuesta sobre el margen de la
   capa para no empujar el título.
2. **Las casillas pasan a 18 px con `accent-color` de marca y fila de 44 px.**
   Medían 13 px con el cuadro celeste del navegador.
3. **El borde de campos y selects pasa de `--tg-color-success-bg` a
   `--tg-color-border-control`.** El anterior medía 1,15:1 contra el blanco:
   un borde de control necesita 3:1 y ese no se veía. El nuevo mide 3,9:1.
4. **El botón deshabilitado usa sus tokens.** Antes `:disabled` quedaba
   idéntico al habilitado —mismo verde, mismo blanco— y «Creando la cuenta…»
   parecía un botón vivo. Ahora usa `--tg-color-disabled-bg` /
   `--tg-color-disabled-text`, que miden 4,63:1.
5. **`Provincia base` y `Localidad base` tienen `label htmlFor`.** Se apoyaban
   en `aria-label` sobre el `select`; ahora el rótulo visible es el nombre
   accesible y hacerle clic enfoca su control.
6. **Al Login le puse el mismo `aria-label` en su Mostrar/Ocultar.** Es una
   línea. El arreglo de CSS ya lo alcanzaba —el botón también flotaba afuera—,
   y dejarle el nombre peor de los dos habría sido raro.

Si alguna te sobra, decime cuál y la saco.

### 7. Login, que comparte los estilos

Lo verifiqué como pediste, en las dos medidas:

```
1440x900   4 controles en 432px, mismo borde izquierdo
           Mostrar/Ocultar 92x44, «Mostrar contraseña», dentro del campo
           desborde 0/0, body overflow hidden, Escape devuelve el foco a «Ingresar»
390x844    4 controles en 303px; el resto, idéntico
```

Ancho único, Mostrar/Ocultar adentro del campo con 44 de alto y nombre por
estado, sin desborde, el fondo trabado y Escape cerrando con devolución del
foco al disparador. El caso 151-A —los labels del Login enfocan su campo— sigue
verde; el 139 —continuidad del Login en las tres páginas— se cayó por el rótulo
nuevo y volvió a verde con su localizador actualizado, que es lo del punto 9.

**No toqué el copy del Login.** Vos acotaste la corrección a esta superficie,
así que sigue diciendo `Iniciar Sesión`, `¿No tienes cuenta?` y `Regístrate
aquí`. Ahora que Registro dice `Crear cuenta`, `¿Ya tenés cuenta?` e `Iniciá
sesión`, los dos formularios hablan distinto entre sí. **Decime si lo cerramos
acá o si queda para `COPY-CLEAR-1`**; son cuatro cadenas.

### 8. Zoom 200 %

Al 200 % —1440 x 900 pasa a 720 x 450 CSS— el alta conserva el ancho único
(7 controles en 432 px), Mostrar/Ocultar sigue adentro del campo con 92 x 44, y
la acción final es alcanzable con la ampliación cerrada y abierta. Desborde
horizontal 0 en el documento y 0 en la capa en los dos estados.

### 9. Un rojo mío que encontró la suite

La primera corrida completa dio **152/154**: además del 131 ambiental, se cayó
el **139**.

```
[FAIL] 139 … — locator.click: Timeout 30000ms exceeded.
             waiting for getByRole('button', { name: 'Inicia sesión aquí' })
```

Es mío y es exactamente lo que tenía que pasar: el 139 prueba el ida y vuelta
entre Login y Registro, y al cambiar el rótulo a `Iniciá sesión` —que es lo que
me pediste en el punto 5— su localizador dejó de encontrarlo. Lo actualicé al
rótulo nuevo en vez de aflojarlo con una expresión que acepte los dos: una
regresión que tolera el copy viejo deja de medir el copy nuevo. Después volví a
recrear la base y a correr la suite entera.

Reviso también el resto de los rótulos que toqué: `Capacidad de carga` sigue
resolviendo por subcadena en el caso 22 —el perfil del panel, que es otra
pantalla—, y `Crear Cuenta` sigue casando con `Crear cuenta` porque el nombre
accesible se compara sin distinguir mayúsculas. No quedan otros.

### 10. Puertas

```
base limpia + SMOKE_CASOS=154                   1/1
base limpia + SMOKE_CASOS=148,150,151           3/3
base limpia + suite completa                    153/154   (131 rojo)
npm run build                                   ok
npm run lint                                    ok (--max-warnings 0)
npx tsc --noEmit                                ok
node --check scripts/smoke.mjs                  ok
npm run contraste                               ok (52/52, 0 incumplimientos)
npm run a11y -- --todas                         ok (64/64, 0 bloqueantes)
git -c core.whitespace=cr-at-eol diff --check   limpio
```

El **131** es el ambiental de siempre: mi entorno no tiene demonio de Docker.
**154/154 es lo que tiene que dar en tu máquina.**

Backend, `compileall` y `pip check` no corresponden: el diff no toca Backend.

### 11. Hashes

```
src/components/Auth/AuthModal.module.css        7436cd9bdda7de84
src/components/Auth/RegisterModal.tsx           c215e875979aa7d6
src/components/Auth/LoginModal.tsx              a150de10482773a6
scripts/smoke.mjs                               b223eae4f3f849ee
```

(SHA-256 truncado a 16, del árbol en `7ca4fc7`.)

### 12. Riesgos residuales

1. **`Mostrar` sigue gobernando los dos campos de contraseña.** Tocarlo en
   `Contraseña` también revela `Confirmar contraseña`. Es el comportamiento que
   ya había y no lo cambié, pero el nombre accesible dice «contraseña» en
   singular y revela dos. Si querés, le pongo su propio botón al segundo campo.
2. **El ancho del botón está clavado en 92 px.** Alcanza para `Mostrar` y
   `Ocultar` en Inter a 0,85 rem. Si alguna vez el rótulo cambia o alguien
   traduce la pantalla, hay que revisar ese número; está en una sola línea y
   comentado.
3. **La capa sigue sin límite de altura propio en pantallas muy bajas.** En
   1200 × 400 —la ventana que usa el caso 151— el alta desplaza bastante. No es
   una medida real de nadie, pero existe.
4. **Las capturas versionadas cambian en cada corrida de la suite.** Es
   deliberado, pero significa que una corrida deja el árbol sucio en cuatro
   binarios. Si preferís que no se versionen, las saco y las dejo sólo bajo
   `SMOKE_CAPTURAS`.

### 13. Frenos

No cambié Backend, API, modelos, migraciones, contrato de registro, requisitos
de transportista, confirmación por correo, reenvío, errores de API ni la
prohibición de inicio de sesión automático. No agregué OAuth, pasos múltiples,
páginas legales, ilustraciones ni dependencias. No toqué navegación, Mercado,
BOEDA, Railway, pagos ni datos remotos. No mezclé `MARKET-VIEWS-1` ni abrí la
pasada global de `COPY-CLEAR-1`. No desplegué. `PRE_FIRMA.md` sigue fuera del
versionado y lo confirmé antes de empujar.

Freno acá y te pido revisión.
