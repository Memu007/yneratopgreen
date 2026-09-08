# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## ADMIN-TRUTH-1R — el caso 160 se sostiene solo

**Resultado: terminado.**

- Corrección de regresión: `21cd4d1`
- Alcance real: **sólo `scripts/smoke.mjs`**. El producto no se tocó: el diff
  contra `src/` y `backend/` sale vacío. La prueba no reveló ningún fallo real
  del producto, así que no rehice producto, como pediste.
- La suite sigue en **161 casos**.
- **En mi rama, no en `main`.** No integré, no desplegué y no toqué Railway,
  datos remotos, pagos ni secretos.

---

### 1. Tenías razón, y era peor de lo que decía la salida

No hay nada que discutir acá: el 160 daba 1/1 sin probar lo que decía probar.
Lo que encontraste eran **dos** defectos, no uno.

**El bucle vacío.** El bloque de badges filtraba y miraba «lo que hubiera». El
catálogo sembrado es todo `active` y `draft` no se ofrece como filtro, así que
para cuatro de los catorce estados el bucle corría sobre **cero filas**. Un
bucle vacío siempre pasa. Y los diez que sí veía podían venir de filas dejadas
por casos anteriores: en la suite completa el informe enumeraba más estados no
porque el caso los hubiera preparado, sino porque los heredaba.

**El color que no se miraba.** El caso sólo comparaba el texto. Los catorce
badges podían caer al mismo gris —que es exactamente el defecto que el producto
vino a arreglar— y el caso seguía verde. Era una prueba que no podía ponerse
roja por la falla que motivó la pieza.

### 2. Qué hace ahora

**Fabrica sus catorce filas.**

- Cuatro publicaciones por la ruta real del vendedor —`POST /products`, la que
  usa una persona—, una por estado, y el estado se pone en la base descartable,
  que es donde el arranque dice que se fabrican los estados que la API no
  ofrece. Categoría y localidad se copian de una publicación existente del mismo
  vendedor: no invento referencias que el padrón no tenga.
- Las diez órdenes que ya creaba, ahora con su `order_number` leído de la base.
- Después comprueba contra SQL que las cuatro publicaciones quedaron en los
  cuatro estados, y que los diez números de orden son distintos entre sí.

**Busca cada fila por identidad propia.** Nombre de la publicación
(`Verdad 160 <sello> <estado>`) o número de orden, recorriendo páginas mientras
«Siguiente» no esté deshabilitado. Ni el orden del catálogo ni la página son una
identidad; si la fila no aparece en ninguna página, el caso lo dice con el
número de páginas que recorrió y lo que muestra el paginador.

**Exige tres cosas de cada badge**, no una:

1. el texto del diccionario, sin guion bajo;
2. el color **computado** del tono que ese mismo diccionario declara. El color
   no se copia acá: se lee `COLOR_DEL_TONO` del producto —que son tokens de la
   paleta— y lo resuelve el navegador. Si mañana cambia `--tg-color-warning`, la
   prueba sigue diciendo la verdad en vez de quedar mintiendo con un `#79520f`
   escrito a mano;
3. que no sea el tratamiento de respaldo. El tono de respaldo también se lee del
   producto (`SIN_TRADUCCION`), no se supone. La única excepción es el estado
   que declara ese tono a propósito, y el informe dice cuántos son: uno,
   `draft`.

Además se rechaza el fondo vacío o transparente, tanto en el color declarado por
el tono como en el badge dibujado.

**`draft` sale de la vista sin filtro**, que es donde puede aparecer. Y el caso
afirma primero que el filtro *no* lo ofrece: si algún día se ofreciera, esa
afirmación se cae y avisa que hay que exigirlo por filtro como a los otros nueve,
en vez de seguir mirándolo por la puerta de atrás.

**El recuento no se declara.** Antes decía `revisados.length >= 10`, un número
escrito a mano que envejece. Ahora exige
`ESTADOS_PRODUCTO.length + ESTADOS_ORDEN.length` leídos de los enum de la base:
agregar un estado al modelo rompe el caso hasta que se lo prepare y se lo mire.

Y la comprobación temprana del diccionario ahora también exige que cada estado
declare un tono y que ese tono tenga color, no sólo que tenga texto.

### 3. El rojo, tres veces

No te traigo un verde sin haber visto el rojo. Los tres negativos son temporales
y quedaron revertidos; el árbol entregado sólo tiene `scripts/smoke.mjs`.

| Negativo | Qué se rompió a propósito | Qué dijo el caso |
|---|---|---|
| 1 | `COLOR_DEL_TONO.curso` → el color del respaldo | `publicaciones/sold_out: sold_out se ve igual que un estado sin traducir (rgb(76, 84, 75))` |
| 2 | Todos los badges con un solo color en `AdminPanel.tsx` | `el badge de paused se pinta rgb(30, 74, 52) y su tono «espera» declara var(--tg-color-warning) = rgb(121, 82, 15)` |
| 3 | Preparar **una** publicación en vez de cuatro, como la versión que rechazaste | `se miraron 11 badges y la base declara 14 estados: …` |

El tercero es el que importa para tu devolución: reproduce el falso verde y
ahora es rojo.

### 4. Un defecto mío que apareció al medir

El primer intento se cayó en `órdenes/draft`: la fila no aparecía «en ninguna de
las 1 página(s)». No era el producto. Esperar «que haya filas» después de
cambiar el filtro **se cumple al instante con la tabla anterior**, que sigue
dibujada mientras llega la nueva: el caso leía el filtro viejo.

Lo arreglé con una condición que la tabla vieja no puede cumplir a la vez: el
total que declara la base para ese estado —contrastado contra SQL, así que de
paso comprueba que el filtro filtra— y que todo lo dibujado sea de ese estado.
Con el filtro sin poner, sólo el total. El mensaje de error incluye lo que
mostraba el paginador cuando se agotó el tiempo.

Lo digo porque es la clase de espera que produce verdes que no valen, y estaba
en mi código.

### 5. Lo que corrí

- `./scripts/entorno_nativo.sh --recrear` y `SMOKE_CASOS=160`: **1/1**, desde
  base limpia, con los catorce estados enumerados en la salida —cada uno con su
  texto y su color computado— y `el tratamiento de respaldo (rgb(76, 84, 75)) lo
  comparten sólo los 1 que declaran el tono «neutro»`.
- `node --check scripts/smoke.mjs` y
  `git -c core.whitespace=cr-at-eol diff --check`: limpios.
- No corrí suite completa, 145/146, build separado, a11y, contraste ni Backend,
  como pediste.

**Una excepción, y la aviso.** Factoricé los lectores del diccionario, que 145 y
146 también usan. Tu instrucción de no correr 145/146 suponía que el diff no los
tocaba, y dejó de ser cierto por mi cambio. En vez de correrlos, medí lo que
importa directamente: ejecuté la implementación vieja —sacada de
`git show HEAD:`— y la nueva sobre el mismo archivo, y devuelven **exactamente
lo mismo** en los dos diccionarios. `textosDeEstado` no cambió de
comportamiento, así que la premisa de 145 y 146 no cambió. Si preferís la
corrida igual, decímelo.

### 6. Sin rojo, sin intermitente, sin pendiente

No quedó nada rojo ni sin verificar en esta corrección. El 131 ambiental no
entra acá: no corrí la suite completa.

---

## Lo que sigue en cola, y no empecé

- **`CATALOG-PHOTOS-1`**: leído. No lo empecé, porque dijiste que cerrara esta
  corrección y frenara. Queda esperando que la actives.
- **`ACCOUNT-PAGE-1`**: leído. Va después de las fotos; no lo mezclo.

## Deuda anterior, sin tocar

- **`--tg-color-focus` es igual a `--tg-color-brand` (`#1e4a34`)**: cualquier
  superficie verde marca nace con el anillo de foco invisible. Sigue abierto.
- **El monograma transparente es para fondos oscuros**, no para claros.
- **La cuenta publicada**: registro tu decisión: la creaste y verificaste vos en
  una operación aparte, y no requiere acción mía. Le avisé a Emi que la vio con
  sesión iniciada en el sitio publicado.

## Y una cosa que hice fuera de tu canal, y te la digo

Emi pidió en el chat que la landing dejara de mostrar `info@topgreen.com.ar` y
comprobó que en el sitio publicado seguía apareciendo. Con su autorización
explícita llevé a `main` **sólo** `CONTACTO-MARCA-1` (`1c1fc45`): el pie, la
página de Contacto y su caso 161. Nada de `ADMIN-TRUTH-1` ni de
`LOGO-INTEGRATION-1R` fue integrado; siguen retenidos en la rama, como pediste.

Un detalle para que no te sorprenda: en `main` el caso entra numerado **161 con
un hueco en el 160**, porque el 160 es de `ADMIN-TRUTH-1` y ese sigue en la
rama. El hueco se cierra solo cuando integres.
