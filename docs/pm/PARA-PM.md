# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## ADMIN-PAGE-1R — estados que existen y ninguna respuesta vieja que pise

Hecho. Producto/regresión e informe en commits separados. **No desplegué.**

- Corrección: `6cc67b7` — «ADMIN-PAGE-1R: estados que existen y ninguna
  respuesta vieja que pise»
- La suite sigue en **145 casos**.

Las dos son mías y las dos son ciertas. El `draft` lo copié del selector que ya
tenía cada fila de la tabla, sin comprobarlo contra el modelo; y tu hipótesis de
la respuesta vieja era la correcta.

---

### 1. «Borradores» era una acción falsa

`ProductStatus` declara cuatro: `active`, `paused`, `sold_out`, `deleted`. El
selector que agregué ofrecía `draft` y omitía `sold_out`. Lo medí como vos:

```
GET /admin/products?status=draft     -> 500
GET /admin/products?status=sold_out  -> 200
```

Ahora ofrece los cuatro del modelo, con **«Agotadas»** para `sold_out`.

Y el caso ya no comprueba un estado elegido a mano: **recorre todas las opciones
que el selector ofrezca**, exige 200 en cada una y comprueba que ninguna fila la
contradiga. Si alguien vuelve a agregar una opción inventada, el caso la
encuentra sola.

Un detalle del que me di cuenta corrigiendo esto: la comprobación tiene que
mirar la **celda de estado** y no la fila entera. La fila trae además los
rótulos del selector de cada publicación —«Activo Pausado Borrador Eliminado»—,
así que buscando en la fila cualquier filtro parece cumplirse. Con eso, el
primer intento me dio un verde que no valía nada.

### 2. La carrera: tenías razón, y ahora es determinista

El caso retiene la carga sin filtro, aplica el filtro, deja llegar primero la
respuesta filtrada y libera última la vieja. **Sin la guarda**, así queda la
pantalla:

```
[FAIL] 145 … — una respuesta vieja sin filtro piso lo que estaba pedido:
  «Total: 248 productos Anterior Página 1 de 13 Siguiente»
```

Con «Pausadas» pedido y aplicado, la pantalla vuelve a las 248 publicaciones sin
filtro. Con la guarda puesta, el mismo recorrido queda en el total del filtro.

La corrección es la que pediste, la misma en las tres listas: cada una anota qué
pidió la última vez —página más filtros— y **sólo la respuesta de esa
combinación escribe filas y total**. Tres líneas por cargador y una referencia
compartida; sin framework y sin reescribir el panel.

```
 src/components/AdminPanel/AdminPanel.tsx |  23 ++++--
 scripts/smoke.mjs                        | 120 +++++++++++++++++++++++++++----
```

### 3. Un hallazgo que dejo anotado y NO toqué

El selector de estado **de cada fila** de la tabla de publicaciones —el que ya
existía antes de esta tarea— tiene el mismo problema que corregí en el filtro:
ofrece «Borrador» y no ofrece «Agotado». Medido contra el Backend:

```
PATCH /admin/products/{id}/status  {"status":"draft"}     -> 400 «Estado inválido: draft»
PATCH /admin/products/{id}/status  {"status":"sold_out"}  -> 200
```

O sea: la administradora puede elegir «Borrador» en cualquier fila y siempre le
va a fallar, y no tiene forma de marcar una publicación como agotada desde el
panel. Es la misma familia y son cuatro líneas, pero es producto que no me
pediste cambiar en esta corrección, así que lo dejo acá para que decidas.

### 4. Puertas

```
base limpia + SMOKE_CASOS=145                   1/1
base limpia + suite completa                    144/145   (131 rojo)
npm run build                                   ok
npm run lint                                    ok (--max-warnings 0)
node --check scripts/smoke.mjs                  ok
python -m compileall backend/app                ok
python -m pip check                             ok
git -c core.whitespace=cr-at-eol diff --check   limpio
```

Sobre el **131**: en esta corrida volvió a fallar acá, con el mismo mensaje de
siempre —el puente de mi entorno sólo traduce `docker exec` y la receta CSP
necesita `docker run` sobre `alpine:3`—, así que es la limitación de mi máquina
y no lo toqué. En la tuya pasó y esto tiene que dar **145/145**.

### 5. Hashes

```
src/components/AdminPanel/AdminPanel.tsx  371d1da5a09cbb1b
scripts/smoke.mjs                         7726ab2fe6d7741b
```

(SHA-256 truncado a 16, del árbol en el commit de corrección.)

### 6. Riesgos residuales

1. **La guarda descarta la respuesta vieja, no la cancela.** El pedido igual
   viaja y el servidor igual trabaja. Cancelarlo pide `AbortController` en
   `apiGet`, que es tocar el cliente HTTP de todo el producto; no me pareció
   parte de esto.
2. **Sigue el selector de fila con «Borrador»**, arriba.
3. Los cuatro riesgos que informé en la entrega anterior siguen en pie: veinte
   filas fijo, la página no viaja en la URL, el scroll vuelve arriba al recargar
   una lista, y el caso 145 deja sus 63 filas en la base efímera.

### 7. Frenos

No toqué Backend, dashboard, navegación, BOEDA, pagos ni Railway. No abrí la
tarea siguiente. No desplegué. `PRE_FIRMA.md` sigue fuera del versionado y lo
confirmé antes de empujar.

Freno acá y te pido revisión.
