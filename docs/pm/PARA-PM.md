# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## ATRIBUTOS-RUBRO-1, parte 2: entregada en rama

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `a50cddc` (tu asignación) |
| backend | `8a72310`: modelo, año y origen: migración, validación, filtros y siembra |
| frontend | `85650e8`: alta, edición, ficha, tarjeta, filtros, los tres P2 y el orden del panel |
| arnés | `cd75cdf`: casos 199 a 204, seis negativos, y los casos que dependían del panel |
| no integrado, no desplegado | `main` sigue en `238d113` |

**Resultado.**

- **Modelo, año y origen:** se declaran, se validan, se ven y se filtran. El
  origen va rotulado «declarado por quien vende» en la tarjeta, en la ficha
  y en el filtro, en texto común.
- **Los tres P2:** corregidos, cada uno con su caso y su negativo.
- **El panel:** lo ataqué y tu propuesta quedó en pie. Lo construí tal cual.
- **Casos y negativos:** 199 a 204 en verde. Los seis negativos dan rojo, cada
  uno por su motivo.
- **Suite completa desde una base nueva:** 202 de 204.
  - El 131 falla siempre en este entorno.
  - El 170 falló una sola vez; solo pasa 3 de 3 (ver Riesgos).
- **Auditorías:**
  - a11y: 80 de 80.
  - Contraste: 88 de 88.
  - Auditoría móvil: 12 de 12 recorridos, sin hallazgos.
  - Guía del panel: coincide en los 26 pasos.

**Para decidir vos (ninguna es bloqueante; ya está hecho así).**

1. **Modelo y año van donde va la marca.** Los decide la bandera `usa_marca`
   de la categoría, hoy sólo Maquinaria agrícola. No los ato al nombre corto
   porque el panel lo cambia al renombrar. Si mañana la marca se extiende a
   otra categoría, modelo y año se extienden con ella. Si preferís
   separarlos, hace falta una bandera propia en la categoría.
2. **«Mercado» también conserva la página.** No estaba en tu lista, pero sin
   ella la pantalla quedaba en la página 2 y la barra decía la 1.
3. **«Desde» mayor que «hasta» da cero, sin error.** Muestra el vacío de
   siempre, «No hay operaciones con estos filtros.».

## El panel: qué ataqué

| ataque | qué encontré | qué quedó |
|---|---|---|
| accesibilidad | cada grupo es un `fieldset` con su `legend`. «Más filtros» es un botón con `aria-expanded` y `aria-controls`, y su contenido plegado usa `hidden` | el 187 comprueba que Tab y el árbol de accesibilidad no entran a lo plegado |
| foco al plegar y desplegar | el foco queda en el botón que se tocó, y nada lo mueve adentro de lo plegado | sin cambios |
| celular a 360 y 390 px | el panel queda más largo con Maquinaria (ocho controles antes de «Dónde») | el 204 comprueba el orden a 390 px; auditoría móvil sin desbordes |
| filtros activos escondidos | es el riesgo real de la propuesta | con algo puesto, «Más filtros» arranca abierto y dice «(N activos)». Plegado a mano, lo sigue diciendo. Lo prueba el 204 y lo rompe un negativo |
| orden de tabulación | el orden del documento es el orden visual | el 187 recorre el panel con Tab, control por control |
| guía y casos | ninguna guía describe el panel | ajusté el 171 (abre «Más filtros» antes de la calificación), el 187 (no cuenta lo plegado) y el rótulo en la auditoría móvil |
| servicios | antes, «Condición» se ofrecía también para servicios | en servicios no se dibujan condición, origen ni año, salvo que la barra traiga uno puesto: un filtro aplicado nunca queda invisible. Pasar a servicios suelta condición y origen |

**Lo único que no tumba la propuesta:** con Maquinaria, «Provincia» queda
después de ocho controles. Es una preferencia sin evidencia, así que no la
cambié.

## Cómo llega a producción (tu regla nueva)

No agrega ninguna lista a la base.

- **Los dos orígenes y el rango de años** viven en el código:
  `services/atributos.py` en el backend y `catalogService.ts` en el
  frontend. Llegan con el despliegue y no dependen de la siembra.
- **La migración** sólo agrega las tres columnas. El 201 la corre sobre una
  copia sin la siembra de ejemplo de estas columnas, y quedan en nulo.

## Casos

- **199, alta y edición.**
  - Rechaza 6 altas sin guardar ninguna fila:
    - año 1949 y año 2028;
    - un origen inventado, y un origen en un servicio;
    - modelo y año fuera de maquinaria.
  - En la pantalla, el formulario guarda un tractor con modelo, año y
    origen, y en Insumos ofrece sólo el origen.
  - La ficha y la tarjeta dicen «declarado por quien vende», sin fondo, sin
    borde y sin ícono.
  - La edición del panel cambia el año y el origen.
  - Por la API:
    - un año fuera de rango no toca la fila;
    - `null` quita el origen;
    - mover a Insumos suelta el modelo y el año.
- **200, filtros.**
  - Con 34 máquinas, la API y la pantalla cuentan lo mismo que la base:
    - 28 con año y 6 sin año;
    - el origen rota entre concesionaria, dueño directo y sin origen.
  - Lo que no declaró el dato no entra.
  - Poner el año vuelve a la página 1.
  - Atrás desde la ficha devuelve los dos filtros.
  - «Desde» 2020 y «hasta» 2010 dan cero, sin error.
- **201, migración.**
  - En una copia, baja y sube, y las publicaciones quedan iguales, tipo y
    potencia incluidos.
  - La base rechaza un año de 1949 y un origen inventado.
  - `alembic check` queda limpio.
- **202, P2 de la marca.** Después de publicar un John Deere, el alta
  siguiente abre con la marca, el modelo, el año y el origen vacíos.
- **203, P2 de la barra.**
  - La categoría, la condición, la marca, el orden, el año, el origen y la
    página siguen en la barra y en los controles después de «Mercado» y de
    recargar.
- **204, P2 del rótulo y orden del panel.**
  - A 1440 y a 390 px, el orden es el acordado.
  - «Productos o servicios» y «Tipo» son rótulos distintos.
  - «Más filtros» no esconde nada aplicado.
  - En servicios no se ofrecen los filtros de producto.

```
[PASS] 199 Modelo, año y origen se declaran al publicar, se validan, se ven rotulados y se editan — 6 altas inválidas rechazadas con su motivo y ninguna fila guardada (año 1949 y 2028, origen inventado, origen en un servicio, modelo y año fuera de maquinaria); el formulario guarda modelo (sin espacios de más), año y origen en un tractor, y en «Insumos agrícolas» ofrece sólo el origen; la ficha dice «Modelo», «Año» y «Origen: Dueño directo, declarado por quien vende», y la tarjeta «Dueño directo · declarado por quien vende», las dos sin fondo, sin borde y sin ícono; el panel abre la edición con lo guardado y cambia el año a 2021 y el origen a concesionaria; por la API, un año fuera de rango se rechaza sin tocar la fila, null quita el origen, y mover la publicación a «Insumos agrícolas» suelta el modelo y el año (5953 ms)
[PASS] 200 Filtrar por año y por origen cuenta en el servidor, deja afuera lo no declarado y vive en la URL — la API cuenta en el servidor —13 desde 2010, 11 de dueño directo, 12 de concesionaria— y el total y las páginas coinciden con la base; las 6 sin año y las 11 sin origen no entran; «desde» 2020 «hasta» 2010 da cero, sin error; en la pantalla, poner el año vuelve a la página 1, el conteo es el de la base, no se cuela ninguna sin año ni sin origen, el filtro de origen dice «declarado por quien vende», Atrás desde la ficha devuelve los dos, y «desde» mayor que «hasta» da el vacío de siempre (4371 ms)
[PASS] 201 La migración del modelo, el año y el origen es aditiva, vuelve atrás y deja intactas las publicaciones — bajar a 01ff14043124 borra las tres columnas y deja las 330 publicaciones iguales, las 56 con tipo o potencia incluidas (huella 996e60da6e41…); subir crea las tres columnas en nulo para todas: no le inventa un dato a nadie, y el resto de cada fila queda igual; la base rechaza un año de 1949 y un origen inventado aunque se escriban por fuera de la API; `alembic check` no encuentra diferencias entre el modelo y el esquema. Todo en una copia de la base (4800 ms)
[PASS] 202 Después de publicar, el alta siguiente abre sin la marca, el modelo, el año ni el origen de la anterior — después de publicar un John Deere 5090E 2020 de concesionaria, el alta siguiente abre con la marca, el modelo, el año y el origen vacíos (6330 ms)
[PASS] 203 «Mercado» dentro del Mercado y recargar conservan todos los filtros de la barra — la categoría, la condición, la marca, el orden, el año desde y hasta, el origen y la página siguen en la barra y en los controles después de «Mercado» y de recargar, con las mismas publicaciones (2903 ms)
[PASS] 204 El panel de filtros va en el orden acordado, «Más filtros» no esconde nada aplicado y los rótulos no se repiten — en 1440 y 390 px el panel va Qué buscás · Productos o servicios · Categoría · Subcategoría · Potencia · Marca · Año · Condición · Origen · Dónde · Provincia · Localidad · Precio · Más filtros; «Más filtros» arranca plegado y lo de adentro no se ve; con dos puestos, al recargar arranca abierto y dice «(2 activos)», también plegado a mano; los rótulos son «Productos o servicios» y «Tipo»; en servicios no se ofrecen condición, origen ni año, salvo que la barra traiga uno puesto (5092 ms)
```

## Negativos

`python3 scripts/sabotajes_atributos_rubro_2.py`. Los que tocan el backend
reinician la API con `REINICIAR_API`.

| negativo | qué rompe | el caso dice |
|---|---|---|
| `despues-de-contar` | el servidor aplica año y origen después de contar | `[FAIL] 200 … 16 problema(s)`, entre ellos «API, año desde 2010: el total dice 34 y en la base hay 13» |
| `en-el-navegador` | el servidor los ignora y el Mercado filtra la página | `[FAIL] 200 … 22 problema(s)`, entre ellos «pantalla, desde 2010: dice 34 operaciones y en la base hay 13» |
| `acepta-nulos` | el servidor suma lo que no declaró el dato | `[FAIL] 200 … 25 problema(s)`, entre ellos «API, año desde 2010: trajo 6 que no declararon el dato o no corresponden» |
| `marca-sin-limpiar` | `limpiarFormulario` no suelta la marca | `[FAIL] 202 … el alta siguiente abrió con lo de la anterior: marca «john-deere»` |
| `falta-en-la-barra` | falta `condition` en `PARAMETROS_DEL_MERCADO` | `[FAIL] 203 … tras «Mercado»: sacó condition de la barra (quedó null)` |
| `mas-filtros-escondido` | «Más filtros» arranca plegado y no dice cuántos tiene | `[FAIL] 204 … con dos filtros de «Más filtros» puestos, al recargar arranca plegado` y «dice «Más filtros» con dos puestos» |

Los seis dieron `[ROJO ESPERADO]`, y el script cierra con «src y backend
después: como estaban».

## Migración `a47300b5554c`

Viene después de `01ff14043124`, y es aditiva:

- **`products.model`:** texto, nulo.
- **`products.year`:** número, nulo; la base sostiene el piso de 1950.
- **`products.origin`:** `concesionaria` o `dueno_directo`, o nulo.

Las tres nacen nulas y no se rellenan. La bajada borra las tres columnas, y
la probé en una copia (201).

Tu primer «frená y consultá» no aplicó: las columnas nacen vacías, así que
ninguna publicación existente choca con el rango de años. El segundo
tampoco: el origen es sólo un campo declarado.

## Puertas

| puerta | resultado |
|---|---|
| suite completa desde base nueva, sobre `cd75cdf` | «202/204 pasaron; 2 fallaron»: el 131, de entorno, y el 170, intermitente (ver Riesgos) |
| tipos, lint, build | verdes |
| `compileall`, `node --check`, `py_compile` | verdes |
| `alembic check` | `No new upgrade operations detected.` |
| diff-check con `cr-at-eol` y finales de línea | limpios |
| a11y `--todas` | 80 de 80 (antes 78: suma la superficie de año, origen y más filtros) |
| contraste | 88 de 88 (antes 86) |
| auditoría móvil | 12 de 12 recorridos, 39 pantallas, sin hallazgos |
| `guia-admin.mjs` | «LA GUÍA Y EL PANEL COINCIDEN: 26 pasos en escritorio y celular» |

## Riesgos y visto de paso

- **La tarjeta suma una línea** cuando hay origen declarado. La auditoría
  móvil no encuentra desbordes.
- **«Más filtros» plegado** hace menos visibles la disponibilidad y la
  calificación. Es lo que proponías; si tienen algo puesto, se ven.
- **El año máximo se calcula en UTC.** El 31/12, desde las 21 h de
  Argentina, ya acepta el año siguiente. Son tres horas y no importa.
- **El 170 falló una vez en la suite completa.** Solo pasa 3 de 3, y en las
  suites anteriores pasó.
  - Lo que vio: después de «Salir» y con el carrito vacío, la cabecera
    volvió a mostrar a «María Cliente» con «Salir», como si la sesión
    hubiera vuelto.
  - Toca la sesión y el carrito, que esta parte no cambió.
  - Puede ser una renovación de la sesión que llega tarde y deshace la
    salida. Si pasa en tu corrida, recomiendo una pieza propia para
    reproducirlo.
- **Visto de paso (P3, no lo toqué):**
  - Cerrar el alta con sólo la marca, el modelo, el año o el origen
    cargados no pide confirmar descartar, porque esos campos no cuentan
    como borrador. Ya pasaba con la marca y con el tipo.
  - El panel sigue sin editar la categoría de una publicación.

## Para verificar, lo mínimo

```
./scripts/entorno_nativo.sh --recrear
SMOKE_CASOS=199,200,201,202,203,204 node scripts/smoke.mjs   → 6/6 pasaron; 0 fallaron
python3 scripts/sabotajes_atributos_rubro_2.py               → seis [ROJO ESPERADO] y «todos dieron el rojo esperado»
```

Advertencia del entorno: el 131 falla siempre acá, porque el puente de
Docker no traduce `docker run`.

Estos comandos los corrí tal cual y dieron eso.

No toqué `main`, Railway ni datos reales, y no desplegué.
