# Cronograma — el plan, con fechas reales

Actualizado: 2026-08-05.

**Fuente única: la sección 5 del PDF** *Documento de Especificación
Funcional y Propuesta Comercial*, el que armó el socio y que la clienta
aprobó. Las fases y las semanas que están acá **no son una estimación
interna**: son lo que se le prometió por escrito.

Si el plan interno y este archivo se contradicen, **gana este archivo**, y
hay que corregir el plan interno.

---

## 1. El ancla

El PDF numera semanas, no fechas. Para que las semanas signifiquen algo
hay que anclarlas a un lunes.

**Ancla: lunes 2026-07-27 = semana 1.** Es la semana en la que la clienta
aprobó el proyecto, el martes 2026-07-28.

Esto todavía **no está confirmado con la clienta.** Es la lectura más
defendible —el reloj arranca cuando arranca el trabajo pagado— pero es una
lectura nuestra. Si ella entiende que el plazo arranca en otra fecha, todo
el cuadro de abajo se corre en bloque, y **conviene resolverlo ahora y no
en la semana 10**.

> **Pendiente de Emi:** confirmar con la clienta la fecha de inicio del
> plazo. Es la única variable que mueve las cinco fases a la vez.

---

## 2. El cuadro

| Fase | Contenido según el PDF | Semanas | Desde | Hasta |
|---|---|---|---|---|
| 1 — Diseño y UX/UI | Pantallas, flujo de comprador, vendedor y logística | 1–2 | 27/07 | 09/08 |
| 2 — Desarrollo base | Arquitectura, base de datos, registro de roles y perfiles | 3–5 | 10/08 | 30/08 |
| 3 — Buscador y catálogo | Motor de búsqueda y **módulo de geolocalización de fletes** | 6–8 | 31/08 | 20/09 |
| 4 — Pagos y checkout | Mercado Pago y validación de transferencias | 9–10 | 21/09 | 04/10 |
| 5 — QA y lanzamiento | Pruebas, usabilidad, carga inicial, **despliegue en producción** | 11–12 | 05/10 | 18/10 |

**Hoy es miercoles 2026-08-05: semana 2, fase 1.**

### El colchón de dos semanas

El PDF dice **"12 a 14 semanas"**. Las doce llegan al **domingo
2026-10-18**; las catorce, al **domingo 2026-11-01**.

Ese colchón es de la propuesta, no un invento nuestro, y es la única
holgura que existe. **Gastarlo es una decisión, no un accidente**: cada
semana que se corre hay que registrarla acá con el motivo.

### Garantía

90 días de soporte por errores, **contados desde el lanzamiento**. Sobre
la fecha de doce semanas, corre hasta el **2027-01-16**. Todo lo que se
despliegue con un agujero se arregla gratis, con urgencia, dentro de esa
ventana.

---

## 3. Los tres hitos de cobro

Existen tres, y **no están atados a fechas: están atados a entregables**.
Eso importa, porque un entregable se puede demostrar antes o después de
su semana.

| Hito | Qué lo dispara, textual del PDF | Fase | Semana teórica |
|---|---|---|---|
| Inicial | *"Al momento de la firma de conformidad y comienzo del proyecto"* | 1 | 1 |
| Intermedio | *"Contra entrega y demostración del módulo de catálogo, búsquedas y geolocalización funcional"* | 3 | 8 |
| Final | *"Al momento del despliegue exitoso en producción y entrega de accesos de administración"* | 5 | 12 |

Montos y porcentajes: **en el PDF original, fuera del repositorio.** Este
repositorio se entrega a la clienta.

---

## 4. El cuadro no coincide con la realidad, y hay que decirlo

Esta es la parte que la PM tiene que mirar de frente. **Las fases del PDF
suponen que se arranca de cero, y no se arrancó de cero.** Se heredó un
repositorio a medias y se trabajó tres semanas antes de la aprobación.

Contraste fase por fase, contra lo verificado en `MATRIZ.md`:

| Fase | Semanas | Estado real al 2026-08-05 |
|---|---|---|
| 1 — Diseño y UX/UI | 1–2 | **Parcial.** Comprador y vendedor se recorren. Falta cerrar el flujo de logistica antes del 09/08. |
| 2 — Desarrollo base | 3–5 | **Avanzado, no cerrado.** Arquitectura, PostgreSQL + PostGIS y perfiles base existen. Falta definir registro con validacion y hacer editable el perfil de transportista. |
| 3 — Buscador y catálogo | 6–8 | **A medias.** Buscador, catálogo y geolocalización de **productos**: hechos. Geolocalización de **fletes**: en cero. |
| 4 — Pagos y checkout | 9–10 | **A medias.** Transferencia bancaria: hecha, con cuatro arreglos pendientes. Mercado Pago: desmontado, se rehace. |
| 5 — QA y lanzamiento | 11–12 | **Empezada fuera de orden.** Hay 21 casos de humo ejecutados desde base limpia y preparacion de Railway, sin despliegue ni revision de seguridad. |

**Tres consecuencias, y son de la PM:**

1. **El hito intermedio está casi disparado, en la semana 2.** Catálogo,
   búsquedas y geolocalización de productos se demuestran hoy. Lo que
   falta de esa frase es **"de fletes"**, y ese es justamente el módulo
   que está en cero. No se reclama el hito hasta que el listado de
   transportistas por cercanía funcione: reclamarlo antes es cobrar por
   algo que no se puede mostrar, y se paga caro en confianza.
2. **El orden de trabajo real no sigue el orden de las fases**, y está
   bien que no lo siga. Lo que no puede pasar es reportarle avance a la
   clienta con las fases del PDF mientras internamente se trabaja en otro
   orden. Cuando se reporte hacia afuera, **se reporta con estas cinco
   fases**.
3. **Lo que queda no está distribuido como el cuadro supone.** El grueso
   contractual de transportistas cae tarde; suscripciones tambien caeria
   sobre QA si se decide absorberla. Ver abajo.

---

## 5. Puertas contractuales por fase

Una fase no se cierra por fecha ni por porcentaje. Se cierra cuando toda su
puerta tiene evidencia reproducible.

### Fase 1 - hasta el 09/08

- Flujo de comprador: registro, busqueda, detalle, carrito, checkout e
  historial.
- Flujo de vendedor: registro, perfil, publicacion/stock y ventas.
- Flujo de logistica: alta del transportista, listado compatible, seleccion
  o contacto e inclusion en la operacion.
- Comportamiento responsive definido para los tres recorridos.

**Limite:** se cierra el diseño y navegacion. No exige que las Piezas B/C de
logistica ya esten implementadas.

### Fase 2 - hasta el 30/08

- Arquitectura reproducible, PostgreSQL + PostGIS, migraciones y seed.
- Comprador y vendedor registrados con la validacion que confirme la
  clienta.
- Perfiles editables; el transportista sigue siendo proveedor especial.
- Perfil transportista con localidad, certificacion declarada, radio y
  capacidad.

**Limite:** no incluye todavia el algoritmo de coincidencia ni pagos.

### Fase 3 - hasta el 20/09

- Las cinco familias del catalogo estan navegables.
- Busqueda por categoria y ubicacion, verificada de punta a punta.
- Listado de transportistas compatible por origen, destino y radio usando
  PostGIS.
- Seleccion del transportista, inclusion en la operacion o contacto directo.
- El hito intermedio solo se habilita cuando catalogo, busqueda y
  geolocalizacion de fletes puedan demostrarse juntas.

**Limite:** directorio, no ruteo; capacidad informativa, no motor por peso.

### Fase 4 - hasta el 04/10

- Checkout basico de Mercado Pago para las compras, sin split ni OAuth de
  vendedores.
- Transferencia directa con CBU/alias, referencia, comprobante posible y
  decision manual del vendedor.
- La maquina de estados no deja ordenes inmortales y cada transicion tiene
  evidencia de autorizacion.

**Limite:** las suscripciones no pertenecen a esta fase contractual aunque
usen Mercado Pago.

### Fase 5 - hasta el 18/10

- Suite integral desde base limpia, responsive y usabilidad verificados.
- Datos iniciales cargados sin credenciales demo inseguras.
- Seguridad, backups, persistencia de imagenes y HTTPS revisados.
- Despliegue real en produccion y accesos administrativos entregados.
- Capacitacion basica y documentacion tecnica del despliegue listas.
- Acta de lanzamiento que fija el inicio de los 90 dias de garantia.

**Limite:** Dockerfiles o archivos de Railway no prueban despliegue.

### Control inmediato de semana 2

- 05-06/08: cerrar la orden de transferencia inmortal sin mezclar todavia
  vencimiento ni reserva de stock.
- 07-09/08: cerrar el flujo UX/UI de logistica y registrar su evidencia.
- 10/08: entrar a Fase 2 con la puerta de Fase 1 cerrada o con desvio
  explicito.

Los limites funcionales completos estan en `ALCANCE-Y-LIMITES.md`.

---

## 6. El riesgo de plazo, con números

- Trabajo restante estimado antes del alcance nuevo: **7 a 9 semanas**.
- Alcance nuevo —suscripciones con cobro recurrente, dos planes y
  mensajería premium—: **4,5 a 6 semanas**.
- Total: **11,5 a 15 semanas**, contadas desde fines de julio.
- Plazo disponible: **12 semanas, 14 con el colchón**.

**En el mejor caso entra raspando; en el peor se pasa una semana del
colchón entero.**

Y hay un agravante que no se puede maquillar: **las suscripciones no están
en el PDF.** No aparecen en el alcance, ni en las fases, ni en los hitos.
Es alcance agregado después de la propuesta, sobre un precio cerrado.

Las salidas posibles, para que la PM elija con Emi y no por omisión:

- **Addendum**: se documenta como alcance adicional con su propio plazo y
  su propio hito. Es lo más limpio y lo que menos deuda deja.
- **Se absorbe**: entra dentro del precio y del plazo, y se acepta que el
  colchón se consume entero. Hay que decirlo hoy, no en octubre.
- **Se corre a una fase 6**: el MVP se lanza en la semana 12 sin
  suscripciones y el módulo va después.

**No decidir es elegir la segunda sin haberla acordado.**

---

## 7. El colchon no es una fase

Las semanas 13 y 14 son contingencia para completar o estabilizar lo ya
comprometido. No son una fase 6 y no habilitan funciones nuevas. Consumir
una semana del colchon requiere registrar motivo, impacto y nueva fecha.

---

## 8. Cómo se mantiene este archivo

- Se actualiza **cuando cambia una fecha**, no semanalmente por rutina.
- Cada corrimiento se anota con **motivo y semana**, en la tabla de abajo.
- Las fechas del PDF **no se reescriben**. Si la realidad se aparta, se
  registra el apartamiento; el compromiso original queda visible.

### Corrimientos registrados

| Fecha | Qué se corrió | Motivo |
|---|---|---|
| — | Ninguno todavía | — |
