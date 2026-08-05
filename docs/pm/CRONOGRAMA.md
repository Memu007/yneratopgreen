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

El PDF numera semanas, no fechas. Emi confirmo el ancla comercial el
2026-08-05.

**Ancla aprobada: viernes 2026-08-07 = primer dia de la semana 1.** Cada
semana corre de viernes a jueves. Las fechas anteriores corresponden a
trabajo previo y no consumen el plazo contractual.

---

## 2. El cuadro

| Fase | Contenido según el PDF | Semanas | Desde | Hasta |
|---|---|---|---|---|
| 1 — Diseño y UX/UI | Pantallas, flujo de comprador, vendedor y logística | 1–2 | 07/08 | 20/08 |
| 2 — Desarrollo base | Arquitectura, base de datos, registro de roles y perfiles | 3–5 | 21/08 | 10/09 |
| 3 — Buscador y catálogo | Motor de búsqueda y **módulo de geolocalización de fletes** | 6–8 | 11/09 | 01/10 |
| 4 — Pagos y checkout | Mercado Pago y validación de transferencias | 9–10 | 02/10 | 15/10 |
| 5 — QA y lanzamiento | Pruebas, usabilidad, carga inicial, **despliegue en producción** | 11–12 | 16/10 | 29/10 |

**Hoy es miercoles 2026-08-05: faltan dos dias para la semana 1.**

### El colchón de dos semanas

El PDF dice **"12 a 14 semanas"**. Las doce llegan al **jueves
2026-10-29**; las catorce, al **jueves 2026-11-12**.

Ese colchón es de la propuesta, no un invento nuestro, y es la única
holgura que existe. **Gastarlo es una decisión, no un accidente**: cada
semana que se corre hay que registrarla acá con el motivo.

### Garantía

90 días de soporte por errores, **contados desde el lanzamiento**. Sobre
la fecha de doce semanas, corre hasta el **2027-01-27**. Todo lo que se
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
| 1 — Diseño y UX/UI | 1–2 | **Trabajo previo parcial.** Comprador y vendedor se recorren. Falta cerrar el flujo de logistica antes del 20/08. |
| 2 — Desarrollo base | 3–5 | **Trabajo previo avanzado, no cerrado.** Arquitectura, PostgreSQL + PostGIS y perfiles base existen. La validacion sera por correo; falta implementarla y hacer editable el perfil transportista. |
| 3 — Buscador y catálogo | 6–8 | **A medias.** Buscador, catalogo y geolocalizacion de **productos**: 13/13 localidades y 32/32 publicaciones verificadas en interfaz contra SQL. Geolocalizacion de **fletes**: en cero. |
| 4 — Pagos y checkout | 9–10 | **A medias.** Transferencia bancaria cerrada con 25 casos; Mercado Pago esta desmontado y se rehace. |
| 5 — QA y lanzamiento | 11–12 | **Empezada fuera de orden.** Hay 25 casos de humo ejecutados desde base limpia y preparacion de Railway, sin despliegue ni revision de seguridad. |

**Tres consecuencias, y son de la PM:**

1. **El trabajo previo adelanto gran parte del hito intermedio.** Catalogo,
   busquedas y geolocalizacion de productos se demuestran hoy. Falta la
   geolocalizacion de fletes. El hito no se reclama hasta que el listado de
   transportistas por cercania funcione y pueda demostrarse junto con el
   resto.
2. **El orden de trabajo real no sigue el orden de las fases**, y está
   bien que no lo siga. Lo que no puede pasar es reportarle avance a la
   clienta con las fases del PDF mientras internamente se trabaja en otro
   orden. Cuando se reporte hacia afuera, **se reporta con estas cinco
   fases**.
3. **Lo que queda no esta distribuido como el cuadro supone.** El grueso
   contractual de transportistas todavia falta, pero las funciones de Fase
   6 ya no compiten con QA ni con el lanzamiento del MVP.

---

## 5. Puertas contractuales por fase

Una fase no se cierra por fecha ni por porcentaje. Se cierra cuando toda su
puerta tiene evidencia reproducible.

### Fase 1 - hasta el 20/08

- Flujo de comprador: registro, busqueda, detalle, carrito, checkout e
  historial.
- Flujo de vendedor: registro, perfil, publicacion/stock y ventas.
- Flujo de logistica: alta del transportista, listado compatible, seleccion
  o contacto e inclusion en la operacion.
- Comportamiento responsive definido para los tres recorridos.

**Limite:** se cierra el diseño y navegacion. No exige que las Piezas B/C de
logistica ya esten implementadas.

### Fase 2 - hasta el 10/09

- Arquitectura reproducible, PostgreSQL + PostGIS, migraciones y seed.
- Comprador y vendedor registrados con validacion de correo electronico.
- Perfiles editables; el transportista sigue siendo proveedor especial.
- Perfil transportista con localidad, certificacion declarada, radio y
  capacidad.

**Limite:** no incluye todavia el algoritmo de coincidencia ni pagos.

### Fase 3 - hasta el 01/10

- Las cinco familias del catalogo estan navegables.
- Busqueda por categoria y ubicacion, verificada de punta a punta.
- Listado de transportistas compatible por origen, destino y radio usando
  PostGIS.
- Seleccion del transportista, inclusion en la operacion o contacto directo.
- El hito intermedio solo se habilita cuando catalogo, busqueda y
  geolocalizacion de fletes puedan demostrarse juntas.

**Limite:** directorio, no ruteo; capacidad informativa, no motor por peso.

### Fase 4 - hasta el 15/10

- Checkout basico de Mercado Pago para las compras, sin split ni OAuth de
  vendedores.
- Transferencia directa con CBU/alias, referencia, comprobante posible y
  decision manual del vendedor.
- La maquina de estados no deja ordenes inmortales y cada transicion tiene
  evidencia de autorizacion.

**Limite:** las suscripciones no pertenecen a esta fase contractual aunque
usen Mercado Pago.

### Fase 5 - hasta el 29/10

- Suite integral desde base limpia, responsive y usabilidad verificados.
- Datos iniciales cargados sin credenciales demo inseguras.
- Seguridad, backups, persistencia de imagenes y HTTPS revisados.
- Despliegue real en produccion y accesos administrativos entregados.
- Capacitacion basica y documentacion tecnica del despliegue listas.
- Acta de lanzamiento que fija el inicio de los 90 dias de garantia.

**Limite:** Dockerfiles o archivos de Railway no prueban despliegue.

### Control inmediato

- 05/08, antes del reloj: orden de transferencia inmortal cerrada en
  `0039e00`, sin mezclar vencimiento ni reserva de stock.
- 07-20/08, Fase 1: cerrar el flujo UX/UI de logistica y registrar su
  evidencia.
- 21/08: entrar a Fase 2 con la puerta de Fase 1 cerrada o con desvio
  explicito.

Los limites funcionales completos estan en `ALCANCE-Y-LIMITES.md`.

---

## 6. Decisión de plazo y alcance posterior

- Trabajo contractual restante estimado: **7 a 9 semanas**.
- Plazo contractual desde el 07/08: **12 semanas**, 14 con contingencia.
- El trabajo previo deja margen, pero no habilita ampliar el MVP.

Emi decidio el 2026-08-05 que **primero se cumple entero el cronograma del
PDF**. Suscripciones recurrentes, planes, mensajeria y tierras pasan a una
**Fase 6 posterior al lanzamiento**. No consumen las fases 1 a 5, el
colchon ni los hitos del MVP contractual.

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
