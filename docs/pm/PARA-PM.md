# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## LOCATION-SOURCE-1 — la ubicación publicada tiene una sola verdad

Hecho. Producto/regresión e informe en commits separados. **No desplegué.**

- Producto/regresión: `9bb56ac` — «LOCATION-SOURCE-1: la ubicacion publicada
  tiene una sola verdad»
- La suite pasa a **152 casos**.

F6 se quedaba corto: no es que la edición modificara el texto legado. Es que
**no modificaba nada**.

---

### 1. El rojo, medido contra `042a3e3`

```
/products/my traía        ["location"]  -> location=«Pergamino, Buenos Aires»
                          locality_id: no viene
la edición preseleccionaba provincia=«Buenos Aires» ciudad=«Pergamino»
   partiendo ese texto por comas; 25 opciones de una lista fija escrita en el
   componente, y la ciudad como campo de texto libre
el PATCH mandaba          location="Rosario, Santa Fe"   locality_id=undefined
después de guardar        locality_id=06623100  location=«Pergamino, Buenos Aires»
el catálogo seguía en     {"locality":"Pergamino","province":"Buenos Aires"}
fila heredada             provincia=«» ciudad=«Un lugar viejo»
```

El detalle que cambia el diagnóstico: `ProductUpdateRequest` **no acepta
`location`**. Sólo acepta `locality_id`. Así que el texto escrito a mano no
llegaba ni siquiera a la columna legada: Pydantic lo descartaba entero y el
aviso decía «actualizado exitosamente». Cambiar provincia y ciudad en la
pantalla no cambiaba absolutamente nada.

Con el caso 152 puesto y el producto devuelto:

```
[FAIL] 152 … — el editor no ofrece un select de localidad del padron
```

### 2. Lo que cambié

**Backend — el único cambio de API, y de lectura.** `/products/my` expone
`locality_id` y la localidad con su provincia, con `joinedload` para no sumar
consultas por fila. `location` queda como el texto derivado que ya era.

**Frontend.** La edición abre con el identificador oficial de la publicación,
ofrece provincia y localidad del **padrón** —con `getProvinces`/`getLocalities`,
los mismos ayudantes que usan el alta y el registro— y guarda mandando
`locality_id`. Se fueron la lista fija de 24 provincias escrita en el
componente y el campo libre «Ciudad». El texto compatible lo sigue derivando el
Backend, que ya validaba el ID: no dupliqué esa derivación en React.

**Una fila sin ubicación oficial lo dice.** No se adivina un ID desde texto
libre ni desde el perfil, y guardar otro campo no le fabrica una: el PATCH de
una publicación así no lleva `locality_id` ni `location`.

**La suciedad se mide por el identificador.** Cambiar de provincia y volver a la
localidad inicial deja el formulario limpio; un cambio real conserva la
confirmación de descarte de FORM-DIRTY-1, y descartar no mueve la ubicación
publicada.

### 3. Un hallazgo que contradice parte del encargo

Dijiste que retirar el fallback visual a `seller.location` formaba parte de la
pieza. **Lo busqué y no existe.** Medido:

- la tarjeta y el detalle ya leen `publication_location` desde UX-COH-1, y el
  caso **137** lo vigila —sigue verde—;
- el editor nunca tomó el perfil: partía el texto de la propia publicación. Con
  el perfil de la vendedora en «Villa María, Córdoba» y la publicación en
  Pergamino, el editor mostraba Pergamino.

Así que no retiré nada que no estuviera: lo que quedaba era el **texto legado
gobernando la pantalla**, y eso sí lo cerré. El caso 152 igual lo comprueba en
las dos direcciones: el editor abre con la localidad de la publicación y en la
fila sin ubicación oficial no aparece ni «Villa María» ni «Córdoba» ni el texto
libre.

### 4. Un límite del caso, explícito

**No pude construir la fila heredada por una ruta real.** El alta exige
`locality_id` —`ProductCreateRequest` lo tiene como obligatorio—, así que una
publicación sin ubicación oficial sólo puede existir heredada. Y
`scripts/lib/sql.mjs` dice, en su propio encabezado, que es lectura de
contraste y que ninguna puerta debería fabricar su escenario con eso.

Empecé escribiéndola con un `UPDATE` y lo saqué. La fila heredada se simula
**donde importa**: interceptando `/products/my` y quitándole la ubicación
oficial a esa publicación. Lo que se mide es lo mismo —qué hace la pantalla
cuando la API dice que no hay ubicación— sin escribir en la base ni agregar
una puerta trasera al producto. Si querés que además exista una fila así en la
base, hace falta o un `UPDATE` en la regresión o una ruta que permita publicar
sin localidad, y las dos cosas son decisiones tuyas.

El domicilio del perfil de la vendedora del caso sí se pone por su ruta real
(`PATCH /auth/me`).

### 5. El caso 152

Autónomo, sobre la UI real, sin esperas fijas:

- el editor de una publicación de Pergamino, con el perfil en Córdoba,
  preselecciona **Pergamino** y no ofrece ningún campo libre «Ciudad»;
- cambiar provincia y localidad manda `locality_id=82084270` y **ningún**
  `location`; en la base quedan ese ID y «Rosario, Santa Fe» derivado;
- al reabrir, el editor conserva el ID; la tarjeta y el detalle del Mercado
  dicen Rosario; el filtro de Santa Fe la incluye y el de Buenos Aires la
  excluye;
- la fila sin ubicación oficial abre con los dos selects vacíos, lo declara, y
  guardar el nombre no le manda ubicación ni le mueve la que tenía;
- cambiar de provincia y volver a la localidad inicial cierra sin preguntar;
  un cambio real pregunta, y descartar no lo guarda.

### 6. Puertas

```
base limpia + SMOKE_CASOS=152                   1/1
base limpia + suite completa                    151/152   (131 rojo)
  controles                                     137, 149, 150 y 151 en verde
npm run build                                   ok
npm run lint                                    ok (--max-warnings 0)
npx tsc --noEmit                                ok
node --check scripts/smoke.mjs                  ok
python -m compileall backend/app                ok
python -m pip check                             ok
npm run a11y -- --todas                         64/64 pantallas, 0 bloqueantes
git -c core.whitespace=cr-at-eol diff --check   limpio
```

Contraste no lo corrí: no cambié estilos. El aviso de «sin ubicación oficial»
reutiliza la clase `ayudaCampo` que ya existía y ya estaba medida; no agregué
ni un selector nuevo.

El **131** es el ambiental de siempre —mi puente traduce `docker exec` y esa
receta necesita `docker run --rm -v … alpine:3`—, así que **152/152 es lo que
tiene que dar en tu máquina**; yo no lo declaro.

### 7. Hashes

```
backend/app/api/products.py                     551a38d90b159aba
src/components/UserDashboard/UserDashboard.tsx  b4f316e96f65ee7f
scripts/smoke.mjs                               28bd4719d3bdbc81
```

(SHA-256 truncado a 16, del árbol en `9bb56ac`.)

### 8. Riesgos residuales

1. **Las filas heredadas siguen ahí y nadie las sanea solo.** La pantalla ahora
   las declara, pero hace falta que alguien entre a cada una y elija localidad.
   No hice migración ni barrido: eso lo frenaste explícitamente y estoy de
   acuerdo, pero conviene contarlas antes de entregar.
2. **`Product.location` sigue existiendo como derivado.** Mientras alguien lo
   lea, sigue habiendo dos columnas que hablan del mismo lugar; ahora una manda
   y la otra la copia, pero la copia se puede desincronizar si algún día se
   escribe directo.
3. **El editor pide el padrón cada vez que se abre una edición.** Provincias una
   vez por sesión de panel y localidades por provincia elegida. Es el mismo
   patrón del alta; si el padrón queda lento, se nota acá también.
4. **Si el padrón no responde**, el editor avisa pero no ofrece reintento: el
   camino es cerrar y volver a abrir. Lo dejo marcado porque en el registro sí
   pusimos reintento y acá no lo pediste.
5. El caso 152 deja dos publicaciones y una cuenta de vendedora en la base, como
   los casos 145, 147, 148, 149, 150 y 151 dejan las suyas.

### 9. Frenos

No toqué modelos, migraciones, consultas ni filtros del catálogo, contrato de
logística, la ubicación libre del perfil, radio/base del transportista, fletes,
geodistancias, pagos, comprobantes, rating, navegación, estilos, BOEDA, Railway
ni datos remotos. No eliminé columnas. No desplegué. `PRE_FIRMA.md` sigue fuera
del versionado y lo confirmé antes de empujar.

Freno acá y te pido revisión.
