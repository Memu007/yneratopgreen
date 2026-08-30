# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## UX-COH-1R — una sola puerta de ingreso en las tres pantallas

Hecho. Producto e informe en commits separados. **No desplegué.**

- Producto: `ee14047` — «UX-COH-1R: una sola puerta de ingreso en las tres pantallas que dibujan tarjetas»
- Regresión nueva: caso **139**. La suite queda en **139/139**, verde en dos corridas seguidas.

---

### 1. El rojo, contra `f716264`, y es de comportamiento

```
[FAIL] 139 … — en Inicio ninguna tarjeta ofrece ingresar; los botones son
              ["Iniciar operación","Ver detalle","Agregar","Iniciar operación","Ver detalle"]
```

Falla **abriendo Inicio**, que es donde pediste que fallara: sin sesión, ninguna
tarjeta de la vista previa ofrece entrar. Lo mismo pasaba en Servicios y en la
tarjeta del Mercado.

Puse las comprobaciones de forma del código **al final** del caso a propósito.
Estaban primero y el rojo saltaba ahí —«App pasa la continuidad 1 veces»—, que es
un rojo sobre el archivo y no sobre el producto. Lo que tiene que fallar primero
es el recorrido de una persona.

### 2. Las tres pantallas, tarjeta y detalle

Recorrido completo, sin sesión, medido en Inicio, Mercado y Servicios:

| | Inicio | Mercado | Servicios |
|---|---|---|---|
| la tarjeta ofrece ingresar | sí | sí | sí |
| abre el Login real | sí | sí | sí |
| diálogos a la vez | **1** | **1** | **1** |
| carrito al abrir el Login | 0 | 0 | 0 |
| cancelar deja la página igual | sí | sí | sí |
| carrito tras cancelar | 0 | 0 | 0 |
| el detalle ofrece ingresar | sí | sí | sí |
| completar vuelve a la misma publicación | sí | sí | sí |
| carrito tras ingresar | **0** | **0** | **0** |
| rótulo ya con sesión | «Agregar al carrito» | «Agregar al carrito» | «Contratar» |
| el clic siguiente sí agrega | sí (1) | sí (1) | sí (1) |

Esa última fila es la que me importa: **nada pasa solo**. Ingresar no agrega, no
reserva y no crea orden; hace falta un clic nuevo, y recién ahí el carrito pasa
de 0 a 1.

En Servicios, las publicaciones sin precio siguen diciendo «Solicitar cotización»
y no piden sesión: pedir presupuesto no la necesita. El caso elige una comprable
de esa misma página para no confundir las dos cosas.

### 3. El callback viejo, que era la trampa

Tu criterio 3 avisaba de esto y estaba pasando: `App` guardaba «a dónde volver»
y el botón de la cabecera abría el Login sin limpiarlo.

Ahora hay dos caminos distintos y explícitos:

- `abrirLoginYVolver(alVolver)` — lo usan las publicaciones. Guarda a dónde
  volver.
- `abrirLogin()` — lo usa todo lo demás: la cabecera, las páginas, la vuelta del
  correo confirmado. **Limpia** la continuidad antes de abrir.

Y el salto Login↔Registro **no** usa ninguno de los dos: es el mismo trámite y
conserva la continuidad. Está comentado en el código para que no se «arregle» por
error.

Medido: pedir ingreso desde una tarjeta, cancelar, y después entrar desde la
cabecera →

```
diálogos abiertos después: 0
¿se abrió un detalle?:     no
```

### 4. El rótulo

```
activo    «Iniciar operación»  →  «Agregar al carrito»
insumo    «Agregar»                (sin cambios)
servicio  «Contratar»              (sin cambios)
sin precio «Solicitar cotización»  (sin cambios)
```

Un solo lugar: `accionDe` en `src/utils/anatomia.ts`. El caso 139 verifica que
«Iniciar operación» ya no exista como etiqueta y que las otras tres sigan
diciendo lo que decían.

### 5. Las tres pantallas salen del código

El caso no lleva una lista escrita a mano: hace `grep -rl '<ProductCard' src` y
compara el resultado contra las tres que recorre.

```
src/components/Pages/HomePage.tsx
src/components/Pages/ServicesPage.tsx
src/components/ProductGrid/ProductGrid.tsx
```

Si mañana una cuarta pantalla dibuja tarjetas, el caso se pone en rojo hasta que
la cubran. Es la única forma que se me ocurrió de que «todas» siga siendo cierto
dentro de seis meses.

### 6. Tres casos existentes que tuve que tocar, y por qué

Los tres se rompieron **por mi cambio**, no por casualidad, y quiero que quede
claro qué toqué:

1. **Casos 47 y 48** — `getByRole('button', { name: 'Ingresar' })` empezó a
   coincidir con **dos** botones: el de la cabecera y «Ingresar para continuar».
   El nombre accesible se busca por subcadena. Catorce selectores pasan a pedir
   `exact: true`. No se relajó ninguna afirmación: se volvió más precisa.
2. **Caso 138** —el que escribí en UX-COH-1— afirmaba «cero órdenes en los
   últimos dos minutos» para `cliente@ejemplo.com`. En la suite completa, otros
   casos le crean órdenes a esa misma cuenta, así que mi afirmación era falsa por
   construcción. Ahora cuenta las órdenes **antes y después** del recorrido y
   exige que no cambien. Es una afirmación más estricta y además correcta.

También actualicé el comentario y los selectores de `hito.mjs` y de la suite que
nombraban «Iniciar operación», para que no describan un rótulo que ya no existe.

### 7. Puertas, desde base limpia

```
base limpia (drop/create + PostGIS + alembic upgrade head + seed)
node scripts/smoke.mjs                          139/139   (0 fallaron)
node scripts/smoke.mjs  (segunda corrida)       139/139   (0 fallaron)
npm run a11y -- --todas                         sin violaciones bloqueantes
npm run contraste                               TODO OK, cobertura completa
npm run hito                                    6/6 pasos
python -m compileall backend/app                ok
python -m pip check                             No broken requirements found
npm run build                                   ok
npm run lint                                    ok (--max-warnings 0)
git -c core.whitespace=cr-at-eol diff --check   limpio
```

Diff:

```
 scripts/hito.mjs                           |   2 +-
 scripts/smoke.mjs                          | 247 +++++++++++++++++++++++---
 src/App.tsx                                |  28 ++-
 src/components/Pages/HomePage.tsx          |   7 +
 src/components/Pages/ServicesPage.tsx      |   7 +
 src/components/ProductCard/ProductCard.tsx |  23 ++-
 src/utils/anatomia.ts                      |   5 +-
```

Sin tocar ubicación, API, Backend, seed, datos, órdenes, pagos, Mercado Pago,
Railway, la navegación del botón atrás ni los hallazgos B2/B4/C1–C3.

### 8. El freno, verificado

Antes de escribir el caso comprobé que las dos vistas previas **sí** tienen una
publicación comprable, así que no hizo falta tocar el seed:

```
Inicio     ["Iniciar operación/Ver detalle", "Agregar", "Iniciar operación/Ver detalle"]
Servicios  ["Solicitar cotización/Ver detalle", "Contratar/Ver detalle", "Solicitar cotización/Ver detalle"]
```

Tampoco hizo falta apilar diálogos —hay uno por vez, medido en las tres
pantallas— ni tocar autenticación: se reutiliza el mismo `LoginModal` y el mismo
estado de `App`.

### 9. Riesgos residuales

1. **La continuidad vive en memoria de `App`.** Si la persona recarga la página
   con el Login abierto, se pierde y vuelve al Inicio. Es el comportamiento de
   siempre para cualquier modal y no lo cambié; lo digo porque ahora hay algo
   que «se recuerda» y podría esperarse que sobreviva a una recarga.
2. **El callback se limpia al cerrar y al abrir un Login sin origen.** Repasé los
   siete lugares que abren el Login y todos pasan por uno de los dos caminos. Si
   mañana se agrega un octavo y usa `setAuthModal('login')` a mano, vuelve el
   problema. No encontré forma de impedirlo sin encapsular el estado, que era
   más cambio del autorizado.
3. **`ProductCard` ahora conoce `useAuth`.** Es una dependencia más en un
   componente que antes sólo sabía del carrito. Es lo que exige la regla
   —decidir el rótulo según haya sesión— pero conviene saberlo.
4. **Sigue abierto B2**: un vendedor puede agregar su propia publicación al
   carrito, ahora con el rótulo nuevo. Y **B4**: el botón «atrás» con el detalle
   abierto sigue saliendo del sitio. Los dos quedaron fuera de esta tarea por tu
   alcance.

### 10. Hashes

```
src/utils/anatomia.ts                        ec4dafa31897dba2
src/components/ProductCard/ProductCard.tsx   9f548707f9ad067d
src/components/Pages/HomePage.tsx            3204e71dec6cfb01
src/components/Pages/ServicesPage.tsx        4708c8b09acd1ac5
src/App.tsx                                  9f3d6cb72bc45d6c
scripts/smoke.mjs                            88d5e1a365ff6972
scripts/hito.mjs                             a256311568fd7c9c
```

(SHA-256 truncado a 16, del árbol en el commit de producto.)

### 11. Frenos

Las vistas previas tienen publicaciones comprables, así que no hubo que fabricar
ninguna ni tocar el seed. La continuidad no exigió apilar diálogos ni cambiar
autenticación. No usé esperas ni selectores frágiles para forzar el verde: donde
un selector se volvió ambiguo lo hice **más** estricto, y donde una afirmación
mía era falsa por construcción la reemplacé por una medición antes/después. No
desplegué. `PRE_FIRMA.md` sigue fuera del versionado y lo confirmé antes de
empujar.
