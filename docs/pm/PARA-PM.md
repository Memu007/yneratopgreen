# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-11.

## 1. Resultado

**Terminado.** El commit de producto es **`6fd060d`**, ya rebasado sobre tu
`1fb915b`; este informe va aparte y encima de él.

La suite pasa de 40 a **41 casos**. El barrido de accesibilidad pasa de 46 a
**50 pantallas**, no a 48: la aritmética está en el punto 5 y conviene que la
mires, porque el número que pediste no cierra con la forma en que la puerta
cuenta.

## 2. El rojo de las tablas: reproducido

Se reproduce, pero **no con el seed cargado**. La regla
`scrollable-region-focusable` sólo salta cuando la región desplazable **no
tiene nada enfocable adentro**. Con filas, cada fila trae su botón de acción y
la regla pasa **por accidente**: no porque la región sea alcanzable, sino
porque adentro hay botones. Por eso mi barrido daba verde y el tuyo no.

Vacié productos y órdenes —que es como estaban en tu despliegue— y aparecieron
las dos, idénticas a las tuyas, en 390×844:

```text
=== Productos (0 filas) ===
  scrollable-region-focusable: serious en table
=== Órdenes (0 filas) ===
  scrollable-region-focusable: serious en table
```

El defecto de fondo es más grande que la regla: **aun con filas, un usuario de
teclado no puede desplazar la tabla**. Llega a los botones de cada fila, pero
no puede mover la región para leer las últimas columnas.

## 3. Qué hice con las tablas

El desplazamiento estaba sobre el `<table>`. Lo moví a un contenedor propio y
la tabla vuelve a ser una tabla:

| Antes | Ahora |
|---|---|
| `.table { display: block; overflow-x: auto }` en celular | `.tableScroll { overflow-x: auto }` |
| la tabla perdía su semántica de tabla por el `display: block` | la conserva |
| nada enfocable si no hay filas | la región recibe el foco |

**El `tabIndex` se agrega sólo cuando la región desborda de verdad**, y eso se
mide, no se supone: pediste expresamente que no lo pusiera sin comprobar el
recorrido. En escritorio la tabla entra entera, así que una parada de
tabulación ahí no llevaría a ninguna parte.

Recorrido real, medido con tabulaciones y flechas de verdad:

| Medida | `tabindex` | Llega tabulando | Foco visible | Flechas |
|---|---|---|---|---|
| celular 390×844 | `0` | sí, en 4 tabulaciones | `solid 3px rgb(45,80,22)` | `scrollLeft 0 → 80` |
| escritorio 1440×900 | ninguno | no, y está bien: no desborda | — | — |

La región lleva `role="region"` y nombre propio —"Usuarios registrados",
"Publicaciones del catálogo", "Órdenes de compra"—, que es lo que se anuncia al
entrar. No toqué el diseño de las tablas ni el panel.

## 4. Transportista demo en el seed

Cuarto usuario, `transportista@ejemplo.com / transportista123`, con los cinco
datos completos y localidad del padrón oficial: **Pergamino, Buenos Aires**,
camión con acoplado, habilitación declarada, radio 250 km y capacidad.

Si el padrón no tuviera esa localidad, **el seed corta con un mensaje claro**
en vez de crear la cuenta. Un transportista sin localidad es un perfil que la
propia API rechaza al editarlo; prefiero que falle el seed antes que dejar una
cuenta rota.

No publica, no compra y no tiene datos bancarios ni privilegios nuevos.

## 5. El inventario da 50, no 48

La puerta cuenta **ruta por medida**. Estaba en 46 = 23 rutas × 2 medidas.
Pediste el perfil transportista "en lectura y edición, en escritorio y
celular": son 2 rutas × 2 medidas = **4 mediciones nuevas**, no 2. 46 + 4 = 50.

Para que diera 48 tendría que medir el transportista en una sola medida, que es
justo lo contrario de lo que pediste. Dejé 50 y te lo marco en vez de acomodar
el número.

Las dos rutas nuevas son `panel del transportista` y
`panel: edición de transportista`, con marcadores que sólo existen para una
cuenta transportista: el encabezado "Datos de transportista" y el selector
`#perfil-localidad-base`. Si esa cuenta dejara de ser transportista, o la
sección no abriera, la puerta falla en vez de medir un perfil común.

## 6. La regresión del seed

La suite no corría el seed, así que la idempotencia no estaba demostrada por
ninguna prueba. Caso **41**:

```text
[PASS] 41 Repetir el seed no duplica ni altera las cuentas demo —
  4 cuentas demo idénticas tras repetir el seed;
  transportista en Pergamino, Buenos Aires, radio 250.00 km
```

Saca un retrato de las cuatro cuentas demo —incluidos hash de contraseña, datos
bancarios y los cinco campos de transporte—, corre el seed otra vez y exige que
las cuatro filas queden **carácter por carácter iguales**, sin duplicados.

**Rojo forzado**: hice que el seed reescribiera el transporte en cada corrida y
el caso falló mostrando las dos versiones enfrentadas.

```text
[FAIL] 41 — repetir el seed cambió una cuenta demo:
  antes:  …Camión con acoplado, dominio DEMO 01…
  después: …Camión reescrito por el seed…
```

## 7. Estado final

| Comprobación | Resultado |
|---|---|
| Suite completa, base recreada | **41/41** |
| Caso 41 con el seed no idempotente | rojo, mostrando el campo cambiado |
| Rojo de las tablas, reproducido con tablas vacías | 2 `serious`, como el tuyo |
| Recorrido de teclado sobre la región | llega, se ve y desplaza |
| `npm run a11y -- --todas` | **50/50** pantallas, 0 violaciones de cualquier impacto |
| `npm run contraste` | 36/36 mediciones, 0 textos fuera de umbral |
| `npm run build` | verde |
| `git -c core.whitespace=cr-at-eol diff --cached --check` | sin avisos |

**Sobre el diff de `AdminPanel.tsx`:** son 168 líneas agregadas, pero el cambio
real son **49**. El resto es sangría: al envolver las tres tablas, su contenido
quedó un nivel adentro. Leelo con `git diff -w` y vas a ver sólo lo que
importa. Preferí dejar la sangría correcta antes que un archivo desprolijo.

**Sigue el bloqueo de Docker**: no hay imágenes en el entorno y el registro
devuelve `Forbidden`. La suite corrió sobre la instalación nativa con el mismo
puente en el `PATH`, sin modificar `smoke.mjs`.

## 8. Riesgos

**Uno solo, y es de alcance.** Arreglé las tres tablas de administración, no
las dos que señalaste. La de usuarios tiene el mismo defecto y hoy pasa por la
misma casualidad —tiene botones adentro—; separarla habría dejado media
corrección esperando el día que esa tabla quede vacía.

**No apareció ninguna familia nueva** de violaciones en las 50 pantallas.

**Sigue abierto el `float` del checkout**, obligatorio antes de Fase 4.

El entorno local sigue levantado: API en `:8000`, Vite en `:5173`, base
recreada y con seed.
