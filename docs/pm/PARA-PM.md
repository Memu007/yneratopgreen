# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-06. **El hueco del destino editable, cerrado.** Commit
`823c3fe`, pusheado a `main`. Todo dentro de `docs/ux/logistica/`.

---

## Tenías razón, y el defecto era peor de lo que decía tu diagnóstico

Tu lectura del código era exacta. Y cuando lo fui a arreglar apareció el
alcance real: **no era que faltara recalcular, era que no había nada que
recalcular.** Los kilómetros estaban escritos a mano dentro de cada
transportista y los candidatos estaban escritos a mano dentro de cada
pedido. El destino era una etiqueta.

Eso significa que la versión anterior podía afirmar *"las dos puntas del
viaje caen dentro de su radio"* mostrando la distancia a un destino que el
comprador ya había cambiado. Es exactamente la clase de afirmación falsa que
este proyecto arrastró en la documentación heredada.

---

## Cómo lo resolví

Elegí la segunda opción que dejaste abierta: **coordenadas ficticias con
cálculo local**. Tres funciones cortas, sin dependencias:

```js
const LOCALIDADES = { 'Reconquista, Santa Fe': [-29.15, -59.65], … };

function distanciaKm(desde, hasta) { … }          // línea recta

function cubreElTramo(transportista, origen, destino) {
  return distanciaKm(transportista.base, origen)  <= transportista.radio
      && distanciaKm(transportista.base, destino) <= transportista.radio;
}
```

**Los transportistas ahora declaran sólo localidad base y radio.** No queda
un solo kilómetro escrito a mano en el prototipo: todo lo visible sale de
aplicar la regla sobre el tramo del momento.

**Por qué así y no una matriz de datos por tramo:** la matriz sigue siendo
un dato escrito, y con seis destinos y cuatro transportistas son 48 celdas
que hay que mantener coherentes a mano. Con el cálculo, la coherencia es una
propiedad, no una tarea.

**Sumé un cuarto transportista** —Luciana Ferrari, base Rosario, radio
400 km— porque con tres la variación por destino casi no se veía. Ahora hay
combinaciones con dos candidatos, con uno y con ninguno.

---

## El barrido completo que pediste

Los seis destinos disponibles, para los pedidos A y B, leídos **de lo que
renderiza la interfaz**, no de lo que calcula mi script:

| Pedido | Origen | Destino | Candidato | Radio | A origen | A destino |
|---|---|---|---|---:|---:|---:|
| A | Reconquista | Reconquista | Sebastián Duarte | 300 | 293 | 293 |
| A | Reconquista | Reconquista | Ramón Ledesma | 600 | 0 | 0 |
| A | Reconquista | Rafaela | Sebastián Duarte | 300 | 293 | 0 |
| A | Reconquista | Rafaela | Ramón Ledesma | 600 | 0 | 293 |
| A | Reconquista | Venado Tuerto | Sebastián Duarte | 300 | 293 | 282 |
| A | Reconquista | Venado Tuerto | Ramón Ledesma | 600 | 0 | 557 |
| A | Reconquista | Rosario | Sebastián Duarte | 300 | 293 | 205 |
| A | Reconquista | Rosario | Ramón Ledesma | 600 | 0 | 433 |
| A | Reconquista | Pergamino | Ramón Ledesma | 600 | 0 | 534 |
| A | Reconquista | **Río Cuarto** | **— ninguno —** | | | |
| B | Pergamino | Reconquista | Ramón Ledesma | 600 | 534 | 0 |
| B | Pergamino | Rafaela | Ramón Ledesma | 600 | 534 | 293 |
| B | Pergamino | Rafaela | Luciana Ferrari | 400 | 105 | 205 |
| B | Pergamino | Venado Tuerto | Ramón Ledesma | 600 | 534 | 557 |
| B | Pergamino | Venado Tuerto | Marcela Ibarra | 300 | 0 | 130 |
| B | Pergamino | Venado Tuerto | Luciana Ferrari | 400 | 105 | 151 |
| B | Pergamino | Rosario | Ramón Ledesma | 600 | 534 | 433 |
| B | Pergamino | Rosario | Marcela Ibarra | 300 | 0 | 105 |
| B | Pergamino | Rosario | Luciana Ferrari | 400 | 105 | 0 |
| B | Pergamino | Pergamino | Ramón Ledesma | 600 | 534 | 534 |
| B | Pergamino | Pergamino | Marcela Ibarra | 300 | 0 | 0 |
| B | Pergamino | Pergamino | Luciana Ferrari | 400 | 105 | 105 |
| B | Pergamino | Río Cuarto | Luciana Ferrari | 400 | 105 | 345 |

```text
✓ ninguna distancia visible supera el radio (22 tarjetas en 23 filas)
✓ hay al menos un destino sin candidatos, y se ve el vacío
```

**Cómo leer la tabla:** en cada fila, las dos últimas columnas son menores o
iguales a la del radio. Esa es la regla, y se cumple en las 22 tarjetas.

Tres renglones que muestran que la regla muerde de verdad:

- **A → Pergamino** deja fuera a Duarte: llega al origen con 293 km, pero al
  destino necesita 306 y su radio es 300.
- **A → Río Cuarto** no deja a nadie. **El vacío ahora ocurre solo**, no sólo
  forzado desde el control de la barra.
- **B** nunca muestra a Duarte ni Ledesma con destinos cercanos, porque
  ninguno alcanza Pergamino como origen dentro de su radio.

---

## El escenario mínimo, paso por paso

```text
✓ 1. pedido A abre con destino Venado Tuerto
✓ 2. al seleccionar aparece el contacto
✓ 3-4. al cambiar el destino desaparece el contacto
✓ 4. no queda ninguna tarjeta marcada como elegida
✓ 5. Continuar bloquea el avance por ese pedido
✓ 5. el aviso nombra el pedido A
✓ 6. la distancia al destino apunta a Rosario
✓ 6. los kilómetros cambiaron:
     "282 km en línea recta, hasta Venado Tuerto, Santa Fe"
   → "205 km en línea recta, hasta Rosario, Santa Fe"
```

Sobre tu punto 3: **cambiar el destino invalida la selección siempre**,
aunque el mismo transportista cubra el tramo nuevo. En la tabla se ve que
Duarte cubre tanto Venado Tuerto como Rosario para el pedido A, y aun así
hay que volver a elegirlo. Es lo que pediste y me parece bien: lo que el
comprador aceptó fue un viaje, no un proveedor.

---

## Las ocho puertas

| # | Criterio | Estado |
|---|---|---|
| 1 | Ningún destino muestra una tarjeta incompatible | ✅ 22/22 |
| 2 | Etiquetas y distancias cambian juntas | ✅ verificado por tarjeta |
| 3 | Cambiar destino invalida y oculta el contacto | ✅ |
| 4 | El pedido queda incompleto y el checkout bloquea | ✅ |
| 5 | Vacío, error y "coordino por mi cuenta" intactos | ✅ |
| 6 | Se mantienen las cinco correcciones, contraste incluido | ✅ 202 textos, peor 4,52:1 |
| 7 | 1440×900 y 390×844, sin desborde ni errores de consola | ✅ las dos medidas |
| 8 | `node --check`, `npm run build`, `git diff --check` | ✅ los tres |

Capturas regeneradas en las dos medidas.

---

## Decisiones que no tomé

1. **No usé el padrón real.** Son seis localidades con coordenadas
   redondeadas, escritas en el prototipo. El padrón de 4.028 ya existe en la
   aplicación y es de Fase 3.
2. **No implementé el `locality_id` de destino** que dejaste como cimiento
   de Fase 2.
3. **No ordené por cercanía.** El orden es el de declaración de los
   transportistas, que es arbitrario a propósito: ordenar por distancia sería
   una recomendación de la plataforma.
4. **No toqué el gradiente de `src/index.css`** ni el reembolso heredado, que
   dejaste explícitamente afuera.
5. **No toqué `src/` ni `backend/`.** Ninguno de los arreglos lo necesitó, así
   que no aplicó tu condición de freno.

---

## Riesgos

**La distancia en línea recta va a decepcionar en el campo.** Reconquista a
Venado Tuerto son 557 km rectos y bastante más por ruta. El prototipo lo
aclara en todas las pantallas, pero un transportista real puede aceptar un
tramo mirando ese número y encontrarse con otro viaje. **No es un problema
del prototipo: es del criterio del contrato**, que pide radio en kilómetros
y directorio en vez de ruteo. Lo dejo anotado para cuando se decida el radio
por defecto en Fase 3.

**Los radios que elegí son ficticios y generosos.** Ledesma cubre 600 km
para que la tabla tenga variedad. Si en producción los transportistas
declaran radios chicos, muchos tramos van a dar vacío. Vale la pena que la
clienta opine sobre qué radio es realista antes de la Fase 3.

**Lo de siempre:** el prototipo se va a desactualizar contra el producto.
Conviene borrarlo cuando la Pieza B esté hecha y quedarse con las capturas.

---

## Lo que necesito de vos

1. **Aceptar o rechazar.** Si pasa, cierra la puerta de la Fase 1 y estamos
   en fecha para el 20/08.
2. **El gradiente de `src/index.css`**, que dejaste para después de aceptar
   este prototipo. Sigue con 3,77:1 en la aplicación real.
3. **La próxima pieza**, que según el cronograma es Fase 2 y arranca el
   21/08. Antes hay margen para las dos cosas rotas que siguen abiertas: el
   seed sin CBU y el camino de instalación sin Docker.

El entorno local sigue levantado.
