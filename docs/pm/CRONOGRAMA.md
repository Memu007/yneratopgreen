# Cronograma — el plan, con fechas reales

Vigencia contractual confirmada: 2026-08-21. Este archivo cambia sólo si cambia
una fecha, una puerta o un hito contractual. La semana y el estado operativo
actuales viven en `NOW.md`; la trazabilidad de lo implementado vive en
`MATRIZ.md` y el orden interno de cierre en `ROADMAP-CIERRE-MVP-2026-08-31.md`.

**Fuente única: la sección 5 del PDF** *Documento de Especificación
Funcional y Propuesta Comercial*, el que armó el socio y que la clienta
aprobó. Las fases y las semanas que están acá **no son una estimación
interna**: son lo que se le prometió por escrito.

Si el plan interno y este archivo se contradicen, **gana este archivo**, y
hay que corregir el plan interno.

---

## 1. El ancla

El PDF numera semanas, no fechas. El 2026-08-14 Emi confirmó el OK comercial
dado por la clienta en reunión y la firma legal programada para el viernes
2026-08-21. El 2026-08-22 confirmó que el contrato quedó firmado.

**Ancla confirmada y vigente: viernes 2026-08-21 = primer día de la semana 1.** Cada
semana corre de viernes a jueves. El trabajo anterior es adelanto previo y no
consume el plazo contractual. Esta ancla reemplaza la del 07/08 registrada el
05/08, cuando la fecha de firma todavía no estaba cerrada.

---

## 2. El cuadro

| Fase | Contenido según el PDF | Semanas | Desde | Hasta |
|---|---|---|---|---|
| 1 — Diseño y UX/UI | Pantallas, flujo de comprador, vendedor y logística | 1–2 | 21/08 | 03/09 |
| 2 — Desarrollo base | Arquitectura, base de datos, registro de roles y perfiles | 3–5 | 04/09 | 24/09 |
| 3 — Buscador y catálogo | Motor de búsqueda y **módulo de geolocalización de fletes** | 6–8 | 25/09 | 15/10 |
| 4 — Pagos y checkout | Mercado Pago y validación de transferencias | 9–10 | 16/10 | 29/10 |
| 5 — QA y lanzamiento | Pruebas, usabilidad, carga inicial, **despliegue en producción** | 11–12 | 30/10 | 12/11 |

### El colchón de dos semanas

El PDF dice **"12 a 14 semanas"**. Las doce llegan al **jueves
2026-11-12** y las catorce al **jueves
2026-11-26**. Ese colchón es de la propuesta, no un invento nuestro, y es la única
holgura que existe. **Gastarlo es una decisión, no un accidente**: cada
semana que se corre hay que registrarla acá con el motivo.

### Garantía

90 días de soporte por errores, **contados desde el lanzamiento**. Sobre
la fecha de doce semanas, corre hasta el **2027-02-10**. Todo lo que se
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

## 4. Puertas contractuales por fase

Una fase no se cierra por fecha ni por porcentaje. Se cierra cuando toda su
puerta tiene evidencia reproducible.

### Fase 1 - hasta el 03/09

- Flujo de comprador: registro, busqueda, detalle, carrito, checkout e
  historial.
- Flujo de vendedor: registro, perfil, publicacion/stock y ventas.
- Flujo de logistica: alta del transportista, listado compatible, seleccion
  o contacto e inclusion en la operacion.
- Comportamiento responsive definido para los tres recorridos.

**Limite:** se cierra el diseño y navegacion. No exige que las Piezas B/C de
logistica ya esten implementadas.

### Fase 2 - hasta el 24/09

- Arquitectura reproducible, PostgreSQL + PostGIS, migraciones y seed.
- Comprador y vendedor registrados con validacion de correo electronico.
- Perfiles editables; el transportista sigue siendo proveedor especial.
- Perfil transportista con localidad, certificacion declarada, radio y
  capacidad.

**Limite:** no incluye todavia el algoritmo de coincidencia ni pagos.

### Fase 3 - hasta el 15/10

- Las cinco familias del catalogo estan navegables.
- Busqueda por categoria y ubicacion, verificada de punta a punta.
- Listado de transportistas compatible por origen, destino y radio usando
  PostGIS.
- Seleccion del transportista, inclusion en la operacion o contacto directo.
- El hito intermedio solo se habilita cuando catalogo, busqueda y
  geolocalizacion de fletes puedan demostrarse juntas.

**Limite:** directorio, no ruteo; capacidad informativa, no motor por peso.

### Fase 4 - hasta el 29/10

- Checkout Pro de Mercado Pago para las compras: cada vendedor vincula su
  cuenta por OAuth, cobra directo y TopGreen aplica comisión de marketplace
  cero. Una orden y un pago por vendedor.
- Transferencia directa con CBU/alias, referencia, comprobante posible y
  decision manual del vendedor.
- La maquina de estados no deja ordenes inmortales y cada transicion tiene
  evidencia de autorizacion.

**Limite:** las suscripciones no pertenecen a esta fase contractual aunque
usen Mercado Pago.

### Fase 5 - hasta el 12/11

- Suite integral desde base limpia, responsive y usabilidad verificados.
- Datos iniciales cargados sin credenciales demo inseguras.
- Seguridad, backups, persistencia de imágenes, dominio/HTTPS y configuración
  productiva revisados. La puerta técnica detallada está en
  `PLAN-RED-TEAM-CIERRE-MVP.md` y no se abre antes del cierre funcional.
- Despliegue real en produccion y accesos administrativos entregados.
- Capacitación básica y documentación técnica del despliegue listas.
- Acta de lanzamiento que fija el inicio de los 90 dias de garantia.

**Limite:** Dockerfiles o archivos de Railway no prueban despliegue.

---

## 5. El colchón no es una fase

Las semanas 13 y 14 son contingencia para completar o estabilizar lo ya
comprometido. No son una fase 6 y no habilitan funciones nuevas. Consumir
una semana del colchon requiere registrar motivo, impacto y nueva fecha.

---

## 6. Cómo se mantiene este archivo

- Se actualiza **cuando cambia una fecha**, no semanalmente por rutina.
- Cada corrimiento se anota con **motivo y semana**, en la tabla de abajo.
- Las fechas del PDF **no se reescriben**. El estado real se registra en
  `NOW.md`, `MATRIZ.md` y el roadmap, no acá.

### Corrimientos registrados

| Fecha | Qué se corrió | Motivo |
|---|---|---|
| — | Ninguno todavía | — |
