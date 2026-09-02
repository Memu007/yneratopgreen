# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## ADMIN-ACTIONS-1R — la regresión mira la pantalla y mide todas las acciones

Hecho, **sin cambio de producto**. `edf3cb5` queda como está.

- Corrección de regresión: `6441a49` — «ADMIN-ACTIONS-1R: la regresión mira la
  pantalla y mide todas las acciones»
- La suite sigue en **144 casos**.

Tenés razón en las tres. El `|| true` es mío y es del peor tipo: una prueba que
no puede fallar da una tranquilidad que no compró nadie. Va corregido y, para
no pedirte que me creas, más abajo está la medición de que ahora **sí puede
ponerse roja**.

---

### 1. La afirmación vacía

Estaba así:

```js
await esperarA(async () => (await tarjeta(nombreDeLaNueva).innerText())
  .includes(descripcionNueva.slice(0, 30)) || true, 'la tarjeta no volvio', 15_000);
```

Ahora, después de recargar la aplicación entera, se vuelve a abrir el
formulario de esa categoría y se compara **el campo**:

```js
const enElCampo = await formularioOtraVez.locator('textarea').inputValue();
assert(enElCampo === descripcionNueva,
  `al volver a entrar el formulario no trae la descripcion guardada: «${enElCampo}»`);
```

**Que puede fallar, medido:** le pedí al caso una descripción que la pantalla no
tiene —`${descripcionNueva} (mutado)`— y se puso rojo diciendo lo que sí había:

```
[FAIL] 144 … — al volver a entrar el formulario no trae la descripcion
  guardada: «Editada por el caso 144 a las 2026-09-02T20:20:11.612Z»
```

### 2. La etiqueta de la opción, leída de la pantalla

Tenías razón también acá: comprobaba en la base y restauraba sin volver a
mirar. Ahora, después de guardar, se recarga la aplicación, se vuelve a
Configuración → Unidades y se lee la fila; recién después se restaura.

**Que puede fallar, medido** —misma técnica, pidiéndole una etiqueta que no
está—:

```
[FAIL] 144 … — al volver, la fila no muestra la etiqueta guardada con su valor
  interno: «Kilogramo 144 (kg) #0 Editar Eliminar»
```

Ese mensaje muestra de paso lo que la corrección tiene que garantizar: la
etiqueta nueva **y** el valor interno intacto entre paréntesis.

### 3. Los seis bloques, no dos

El mismo verificador de nombres corre ahora sobre:

```
tarjeta de categoría          3 acciones
formulario de categoría       2   (guardar y cancelar)
fila de subcategoría          1
alta en línea de subcategoría 2   (agregar y cancelar; eran «✓» y «✕»)
fila de opción                2
formulario de opción          2   (guardar y cancelar; eran «✓» y «✕»)
                             ──
                             12 acciones medidas
```

El caso lo dice en su resultado, así que el número queda a la vista en cada
corrida y no en una afirmación mía:

```
[PASS] 144 … — en Administracion las 12 acciones de los seis bloques —tarjeta y
  formulario de categoria, fila y alta de subcategoria, fila y formulario de
  opcion— tienen nombre propio; editar categoria y opcion persiste por PUT y se
  lee en la pantalla despues de recargar; …
```

### 4. Puertas

```
base limpia + SMOKE_CASOS=144                   1/1
misma base + suite completa                     143/144   (131 rojo)
npm run build                                   ok
npm run lint                                    ok (--max-warnings 0)
node --check scripts/smoke.mjs                  ok
python -m compileall backend/app                ok
python -m pip check                             ok
git -c core.whitespace=cr-at-eol diff --check   limpio
npm run a11y -- --todas                         64/64 pantallas, 0 bloqueantes
npm run contraste                               TODO OK, cobertura completa
npm run hito                                    6/6 pasos
```

Pediste **144/144**: acá me da 143/144 porque el **131** necesita un demonio de
Docker que este entorno no tiene. Es el mismo rojo de siempre y no lo declaro
verde yo; en tu Mac tiene que dar 144/144. Los casos 114 y 121 pasaron.

### 5. Hash

```
scripts/smoke.mjs   ae42bc0b0474da84
```

(SHA-256 truncado a 16, del árbol en el commit de regresión.)

### 6. Frenos

No toqué producto: `edf3cb5` queda intacto y este commit es sólo de regresión.
No reescribí historia. No abrí otra tarea. No desplegué. `PRE_FIRMA.md` sigue
fuera del versionado y lo confirmé antes de empujar.

Freno acá y te pido la revisión final.
