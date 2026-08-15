# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-15. Duodécimo informe: **prototipo de logística, dos recorridos**.

Leído `7e579df`. Entregado el prototipo. No toqué `src/`, backend, migraciones,
seed, Railway, Mercado Pago ni las puertas: el único archivo del commit está en
`prototypes/`. Por eso no corrí la suite de producto, como pediste.

## 1. Cómo abrirlo

```bash
cd /workspace/yneratopgreen
python3 -m http.server 8099
```

→ **http://localhost:8099/prototypes/logistica-dos-recorridos.html**

También abre con doble clic desde el disco: es un archivo solo, sin
dependencias, sin build y sin red. No consulta ninguna API y no guarda nada:
al reiniciar, el recorrido queda vacío.

Los tokens de color y la tipografía están **copiados** de `src/index.css`, no
importados. A propósito: el prototipo tiene que abrirse solo y no debe poder
romperse por un cambio en el producto.

## 2. Mapa de pantallas

Portada con el alcance escrito arriba de todo y los dos caminos. Desde
cualquier paso: **Atrás, Siguiente, Reiniciar recorrido y Cambiar de
recorrido**.

**Ofrezco logística — 8 pasos**

| # | Pantalla | Qué se decide |
|---|---|---|
| 1 | Ofrecer logística | activar el perfil sobre una cuenta que ya existe, no crear un rol nuevo |
| 2 | Localidad base | el punto desde el que se mide todo |
| 3 | El vehículo | tipo · **marca y modelo** · **dominio** |
| 4 | Capacidad de carga | texto libre, a propósito |
| 5 | **Cargas o usos permitidos** | qué transporta |
| 6 | Habilitación | declaración y detalle, con la aclaración de que no se verifica |
| 7 | Radio de cobertura | con qué alcance aparece |
| 8 | Lo que va a ver el comprador | la ficha desde el otro lado, sin contacto |

**Necesito logística — 5 pasos con flete, 4 sin flete**

| # | Pantalla | Qué se decide |
|---|---|---|
| 1 | La compra y su origen | el origen sale de la publicación y no se edita |
| 2 | Destino de entrega | la otra punta |
| 3 | ¿Cómo se traslada? | «Necesito flete» o «Coordino el traslado por mi cuenta» |
| 4 | Quiénes cubren este tramo | comparar sin contacto, seleccionar, y ahí sí el contacto |
| 5 | Compra confirmada | qué queda acordado y qué no |

El paso 4 **no existe** si se coordina por cuenta propia: el recorrido pasa de 5
pasos a 4 y el contador lo dice. No es un paso deshabilitado, es un paso que no
corresponde.

## 3. El límite del producto, dicho en el prototipo

Está en la portada, en el resumen del transportista y en el cierre del
comprador, con estas palabras:

- «TopGreen no cotiza el flete, no lo cobra, no reserva disponibilidad y no
  administra el servicio.»
- «El precio y la coordinación del flete se acuerdan directamente con …»
- «No hay flete pagado ni cotizado en TopGreen. No hay servicio contratado ni
  disponibilidad reservada. No hay seguimiento del viaje dentro de la
  plataforma. La compra del producto sí está confirmada con el vendedor.»
- «TopGreen no verifica esta habilitación», al lado de cada declaración y con
  su fecha.

El recorrido del comprador **termina en seleccionar y contactar**. No hay pago
del flete, ni «servicio contratado», ni estados de un envío.

La comprobación busca once frases prohibidas —«servicio contratado», «flete
contratado», «cotizamos», «reservar disponibilidad», «transportista
verificado» y demás— y no aparece ninguna.

## 4. Actual contra propuesta

Los tres campos que no existen van sobre **fondo ámbar**, con etiqueta
**«Propuesta»**, una leyenda en el paso y una nota al final. En la lista del
comprador se repite la aclaración, porque ahí es donde más se parecen a algo
terminado.

| Ya existe | Propuesta para validar |
|---|---|
| localidad base | **marca y modelo** |
| descripción libre del transporte | **dominio en campo separado** |
| capacidad libre | **categorías de cargas permitidas** |
| declaración y detalle de habilitación | |
| radio de cobertura | |
| compatibilidad geográfica por las dos puntas | |
| selección y contacto posterior | |

Las tres propuestas salen de un mismo problema: hoy tipo, marca, modelo y
dominio viajan **mezclados en una sola línea de texto libre**, así que no se
pueden comparar entre transportistas ni filtrar. No cambié el esquema y el paso
de cargas se puede saltear sin marcar nada: obligar a completar un campo que
nadie decidió sería aprobarlo de hecho.

## 5. Comprobación

En 1440×900 y en 390×844, con navegador real:

| | |
|---|---|
| Los dos recorridos completos, por separado | sí |
| Reinicio y cambio de recorrido sin recargar | sí |
| «Por mi cuenta» no obliga a elegir transportista | sí, saltea la lista |
| Con flete no avanza sin selección compatible | sí, avisa y no pasa |
| Contacto oculto antes de seleccionar | sí, en las dos medidas |
| Corte horizontal | ninguno, en ninguna pantalla |
| Foco visible recorriendo con teclado | 5 paradas, todas con contorno |
| Errores de consola | ninguno |
| Frases prohibidas | ninguna de once |

## 6. Un defecto que encontré haciéndolo, y que mirá porque es del producto también

El paso se redibujaba cuando cambiaba cualquier campo. En un campo de texto ese
cambio llega **al salir del campo**, o sea justo cuando la persona ya está
yendo al botón: el paso crecía una línea, el botón se corría hacia abajo entre
que apretás y soltás, y **el clic se perdía**. Con el mouse parece que el botón
no anda; con el dedo, peor.

Lo arreglé acotando el redibujo a los controles que cambian qué pasos hay, y
dejando lo derivado en su propio nodo, que se actualiza sin mover nada.

Lo cuento porque el patrón —«mostrar una ayuda recién cuando el campo tiene
valor, arriba de un botón»— aparece en varias pantallas del producto. No lo
revisé ahí y no lo toqué: lo dejo anotado por si querés abrirlo como pieza.

## 7. Lo que tenés que decidir vos y Emi

1. **Los tres campos propuestos, ¿entran?** Marca y modelo y dominio son
   baratos: partir un texto en tres. Las cargas permitidas cuestan más, porque
   hay que decidir la lista y qué pasa con quien no encaja en ninguna categoría.
2. **Si entran las cargas, ¿filtran o sólo se muestran?** Filtrar cambia quién
   aparece en la lista, y eso es una decisión de producto: un transportista que
   no marcó nada desaparecería de todas las búsquedas.
3. **El límite, ¿se mantiene?** Si al ver el recorrido aparece la necesidad de
   cotización, aceptación, pago o seguimiento dentro de TopGreen, es alcance
   nuevo y contractual. No lo implemento sin una decisión escrita.
4. **La ficha del transportista, ¿alcanza para comparar?** Hoy se comparan
   vehículo, capacidad, cargas, distancia al destino y declaración. Si falta
   algo, es más barato agregarlo ahora que después.

No convertí ninguna conclusión del prototipo en código real. Vuelvo a PM y no
abro otra función antes de la firma.
