# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## LOCATION-SOURCE-1R — media selección de ubicación no guarda ni declara éxito

Hecho. Producto/regresión e informe en commits separados. **No desplegué.**

- Producto/regresión: `025753c` — «LOCATION-SOURCE-1R: media seleccion de
  ubicacion no guarda ni declara exito»
- La suite sigue en **152 casos**: amplié el bloque, no agregué el 153.

El borde es real y lo dejé yo. Cerré el engaño por un lado y lo dejé abierto
por el otro, con la misma forma: la pantalla acepta el cambio, dice que se
guardó y la verdad persistida no se mueve.

---

### 1. El rojo, contra `9bb56ac`

Con el bloque nuevo puesto y el producto devuelto:

```
[FAIL] 152 … — guardar con la provincia cambiada y sin localidad no aviso nada
```

La causa es la que marcaste: `locality_id: ''` al cambiar de provincia y un
`if (editingProduct.locality_id)` que simplemente omitía el campo. El PATCH
salía sin ubicación, respondía 200 y el aviso decía «Producto actualizado
exitosamente».

### 2. La corrección

La ubicación se elige entera o no se toca. Al abrir la edición se guarda el par
`{province_id, locality_id}`; si la selección cambió respecto de ese par y no
hay localidad, **Guardar frena antes del PATCH**. Una sola condición cubre los
cuatro casos:

```
publicación oficial, ubicación sin tocar        guarda como antes
publicación oficial, provincia cambiada
  y localidad vacía                             frena, no manda nada
fila heredada, ubicación sin tocar              guarda otro campo sin
                                                fabricarle ubicación
fila heredada, sólo provincia elegida           frena, no manda nada
```

Incluye el caso de vaciar la provincia de una publicación oficial: eso también
es «tocada», así que frena en vez de guardar en silencio la localidad anterior.
No agregué modo de borrar la ubicación, ni otra fuente, ni otra lista.

### 3. Por qué el aviso no es un toast

En este formulario las otras validaciones —precio, stock— usan `showToast`, y
lo miré primero. No lo usé, y te digo por qué: el contenedor de toasts es
`role="status"` con `aria-live="polite"` y **se desvanece**. Un error que
bloquea el guardado y que la persona tiene que corregir no puede irse mientras
lo está corrigiendo: es exactamente el modo de fallo que cerramos en
FORM-CONSISTENCY-1R con el registro.

Así que el aviso va **al lado de los dos selects**, con `role="alert"`, y se
queda hasta que se elige la localidad. Además la localidad queda con
`aria-invalid="true"` y recibe el foco, que es el control que hay que
completar. No es otro sistema de alertas: es el mismo patrón inline que ya usa
esa sección para «sin ubicación oficial», y reutiliza la clase `ayudaCampo`
—no agregué ni un selector nuevo—.

Si preferís el toast por consistencia con el precio y el stock, es un cambio
chico, pero te dejo la objeción registrada.

### 4. El bloque del caso 152

Ampliado donde pediste, entre cambiar de provincia y elegir la localidad:

- intenta guardar con media selección;
- **no sale ningún PATCH** —se escuchan las peticiones y se cuentan—;
- **no aparece** ningún «actualizado exitosamente»;
- el error se anuncia como `alert`, la localidad queda `aria-invalid` y **el
  foco va ahí**;
- la provincia elegida sigue elegida y el nombre del formulario sigue intacto;
- la publicación sigue en su localidad anterior en la base;
- después elige la localidad, la marca de inválida se levanta y continúa el
  recorrido verde que ya existía.

El bloque heredado quedó como estaba, y no fabriqué esa fila en la base.

### 5. Puertas

```
base limpia + SMOKE_CASOS=152                   1/1
base limpia + SMOKE_CASOS=149,150               2/2
base limpia + suite completa                    151/152   (131 rojo)
  controles                                     137, 149, 150 y 151 en verde
npm run build                                   ok
npm run lint                                    ok (--max-warnings 0)
npx tsc --noEmit                                ok
node --check scripts/smoke.mjs                  ok
git -c core.whitespace=cr-at-eol diff --check   limpio
```

El diff quedó limitado a Frontend y regresión, así que —como indicaste— no
repetí Backend, `pip check`, contraste ni la auditoría a11y completa. La
accesibilidad del error nuevo queda medida dentro del 152: rol, foco y
`aria-invalid`.

El **131** es el ambiental de siempre; **152/152 es lo que tiene que dar en tu
máquina**.

### 6. Hashes

```
src/components/UserDashboard/UserDashboard.tsx  fd3313b7ba631ac7
scripts/smoke.mjs                               6ffb298a5f0c80be
```

(SHA-256 truncado a 16, del árbol en `025753c`.)

### 7. Riesgos residuales

1. **La regla mira el par, no cada campo.** Si mañana se agrega una tercera
   parte a la ubicación, hay que sumarla a la comparación o volvería a existir
   una selección incompleta que pasa.
2. **El aviso se levanta al elegir localidad, no al deshacer el cambio de
   provincia.** Volver a la provincia original y elegir la localidad original
   lo limpia igual, pero el aviso queda visible mientras tanto. Es correcto
   —sigue faltando la localidad— aunque puede leerse como insistente.
3. **El freno vive en el Frontend.** El Backend nunca fue el problema acá —él
   valida el ID que le llega—, pero si otro cliente manda un PATCH sin
   `locality_id` la publicación se queda donde está, en silencio, como antes.
4. Sigue en pie lo del informe anterior: las filas heredadas no se sanean solas,
   `Product.location` sigue existiendo como derivado y el editor no ofrece
   reintento si el padrón no responde.

### 8. Frenos

No toqué Backend, API, modelos, migraciones, seed, pagos, BOEDA, Railway,
datos remotos ni estilos. No agregué un caso nuevo ni otra fuente de ubicación.
No desplegué. `PRE_FIRMA.md` sigue fuera del versionado y lo confirmé antes de
empujar.

Freno acá y te pido revisión.
