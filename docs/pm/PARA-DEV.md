# PM → Dev

Canal de la PM hacia la dev. **Solo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

Antes de empezar:

```bash
git pull origin main
cat docs/pm/PARA-DEV.md
```

---

## Entrega `8d74054`: vuelve con correcciones chicas

La arquitectura de la entrega es correcta: prototipo aislado, sin cambios de
producto ni dependencias, con los recorridos y estados pedidos. La PM reviso
las capturas, el HTML/JS/CSS, `node --check`, `git diff --check` y
`npm run build`.

No queda aceptada todavia porque hay comportamientos y promesas que contradicen
el alcance o el sistema real. **No reescribas el prototipo:** corrige solamente
los puntos de abajo.

---

## Tarea activa unica: cerrar los huecos del prototipo logistico

### 1. Cada pedido exige una decision explicita

El flete sigue siendo opcional, pero la decision no puede quedar vacia. Para
cada pedido, antes de pasar al pago, el comprador debe haber elegido una de
estas dos salidas:

- `Necesito flete` **con un transportista seleccionado**; o
- `Coordino el traslado por mi cuenta`.

Hoy `Continuar` permite llegar al pago con `necesitaFlete = null` o con
`necesitaFlete = true` sin transportista. Eso deja una operacion ambigua.

Corregir:

- bloquear el avance y explicar que pedido falta resolver;
- llevar el foco al primer pedido incompleto;
- en vacio/error, “Coordino por mi cuenta” debe guardar `false` para ese pedido,
  no solo volver de pantalla;
- “Mis compras” no puede afirmar que el comprador coordina solo cuando el
  estado seguia nulo o incompleto.

### 2. No se agrega nombre comercial al MVP

El contrato no exige otro campo y el modelo ya tiene `full_name`. No agregamos
esquema ni prometemos razon social o nombre comercial verificado.

En el prototipo usa nombres que puedan venir de `full_name` y llama al dato
**“Nombre del perfil”** o simplemente **“Transportista”**. No hace falta tocar
el perfil productivo.

### 3. La distancia tiene que decir que mide

Un unico “aprox. 180 km” cambia segun el transportista pero no indica entre que
puntos se calculo. La regla aprobada exige comprobar las dos puntas dentro del
radio.

Cada tarjeta debe mostrar, en linea recta:

- base del transportista → origen; y
- base del transportista → destino.

Mantener tambien el radio declarado y la frase de que ambas puntas quedan
cubiertas. No ordenar ni recomendar “el mejor”.

### 4. No inventar peso ni exponer contacto del comprador

La orden actual guarda nombre del producto y cantidad, pero no un peso
logistico estructurado. Reemplaza “aproximadamente 2.000 kg” por los articulos
y cantidades que ya existen en la orden.

La vista del transportista recibe tramo y necesidad logistica. Para el MVP no
necesita el telefono ni el correo del comprador: el comprador ya obtiene el
contacto del transportista despues de seleccionarlo. Mostrar en su lugar:
**“El comprador recibio tus datos y te contactara para coordinar.”**

Esto reduce exposicion de datos y cumple el contacto directo del contrato.

### 5. Contraste medido, no heredado

El criterio no quedo demostrado. Blanco sobre `#059669`, usado al inicio del
gradiente principal, da aproximadamente **3,77:1** y no alcanza 4,5:1 para
texto normal.

Ajustar los botones con texto blanco a un verde que alcance **4,5:1** en todo
el fondo. No hace falta redisenar la paleta; alcanza con usar el tono oscuro ya
existente. Reportar el valor medido.

---

## Decisiones de PM sobre tus preguntas

- El traslado puede ser propio: aprobado. Lo obligatorio es elegir una salida
  por pedido.
- Boton explicito para iniciar la busqueda: aprobado.
- Destino desde lista cerrada de localidades: aprobado.
- Sin ranking ni recomendacion automatica: aprobado, con las dos distancias
  claramente rotuladas.
- Bloque informativo del vendedor cuando el comprador coordina solo: aprobado.
- Contacto del transportista visible despues de seleccionarlo: aprobado para
  el MVP contractual. Cualquier candado por plan se define recien en Fase 6.
- Declaracion de habilitacion con detalle y fecha: aprobada para Fase 2, siempre
  atribuida al transportista y sin verificacion de TopGreen.
- Nombre comercial nuevo: rechazado para el MVP; usar `full_name`.

### Hueco detectado por la PM para la siguiente fase

La lista de destino del prototipo es correcta, pero hoy el usuario y la orden
guardan ubicacion/destino como texto libre; no existe un `locality_id` de
destino. **No lo implementes en esta correccion.** Queda como cimiento de datos
estructurados de la Fase 2 para que PostGIS pueda resolver la Fase 3.

---

## Criterios de aceptacion de la correccion

1. No se llega al resumen/pago con ningun pedido sin resolver.
2. Vacio y error permiten marcar correctamente “coordino por mi cuenta”.
3. No aparece un peso inventado ni contacto del comprador en su vista de
   transportista.
4. Cada tarjeta muestra las dos distancias con sus extremos.
5. Los nombres no prometen un campo comercial inexistente.
6. Todo texto normal queda en 4,5:1 o mas; controles y foco siguen visibles.
7. Actualiza solamente las capturas afectadas en escritorio y movil.
8. `node --check`, `npm run build` y `git diff --check` quedan verdes.

No repitas los 25 casos de producto: `src/` y `backend/` no cambian.

### Frena y responde si

- alguno de estos arreglos exige tocar codigo productivo;
- para completar el flujo hace falta inventar otro dato de negocio;
- la correccion deja de estar acotada a `docs/ux/logistica/`.

---

## Guardia de cronograma

Seguimos a tiempo: la semana 1 comienza el **07/08** y la Fase 1 cierra el
**20/08**. Esta correccion corta cierra el prototipo; no abras Fase 2 hasta que
la PM la acepte.
