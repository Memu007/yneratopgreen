# Decisiones

Registro breve. Una entrada por decisión relevante, más reciente arriba.
Formato: fecha, decisión, motivo.

---

## 2026-07-25 — Línea base aprobada. Empieza la construcción

PostgreSQL 16 + PostGIS 3.4.3, una migración generada desde los modelos
(15 tablas, 40 índices, sin `DROP`), seed repetible, build en verde y los
diez smoke tests en `200`. Commit `de98fae`.

Aprobados los tres arreglos de código que hicieron falta, todos mínimos y
sin tocar el esquema: `UUID` → `str` en parámetros y schemas de request
(las columnas son `String(36)`), acumulador `Decimal` en el total del
carrito, y corrección del slug inexistente en el seed.

Ese segundo arreglo confirma el diagnóstico anterior: un
`float += Decimal` en el total del carrito significa que **nadie sumó
nunca dos ítems a un carrito** en el código heredado.

Verificado además que el frontend no tiene llamadas huérfanas: los 23
endpoints que invoca existen en el backend. Era el mayor riesgo pendiente
y queda descartado.

Se cierra la fase de auditoría. El avance medido contra el contrato es
~40%, con la matriz de evidencia en `MATRIZ.md`.

---

## 2026-07-25 — No se cambian los IDs a `uuid` nativo

Los modelos usan `String(36)` para los identificadores. En PostgreSQL el
tipo `uuid` nativo sería mejor: índices más chicos y validación de tipo. Y
este es el momento más barato para cambiarlo, con la base vacía y el
esquema recién generado.

**No se hace.** No afecta ningún requisito contractual, el presupuesto es
cerrado y a la escala de este MVP `String(36)` funciona. Aplicar acá el
mismo criterio que se le exige al alcance: no se construye lo que no está
pedido.

Queda registrado porque la ventana barata se cierra cuando haya datos.

---

## 2026-07-25 — Geolocalización con localidades sembradas, sin API paga

Se evaluó dejar la geolocalización como extra por el costo de las APIs de
geocoding. **Rechazado.** Está en las cinco secciones del contrato, y la
sección 4 elige PostGIS específicamente para resolverla; sin geo el
diferencial del producto desaparece. Además el segundo hito de cobro se
paga contra demostrarla funcionando, así que recortarla bloquea el pago.

La preocupación por el costo era válida pero mal dirigida: **el contrato
no pide geocoding**. Se resuelve con una tabla de localidades sembrada una
vez y selección desde lista. PostGIS calcula distancias localmente. Costo
recurrente cero, sin dependencias externas en runtime.

Recortado dentro de la geo, sin costo contractual: geocoding de
direcciones libres, mapas y selección con pin, distancia por ruta real
—el contrato rechaza el ruteo— y radio elegido por el comprador.

---

## 2026-07-25 — PROPUESTA GUARDADA: directorio por zonas en lugar de radio

**No es una decisión.** Es una idea a evaluar cuando se llegue al módulo
de transportistas. Hasta entonces sigue vigente el radio en km, que es lo
que dice el contrato al pie.

Se guarda con el análisis hecho para no volver a razonarlo desde cero.

El transportista declara **las zonas que atiende**, de una lista. El
comprador elige una zona y se listan los que la declararon. Sin cálculo
de radios.

Cobertura contractual: la sección 3.2 se titula *"Sugerencia de
Implementación Ágil"* y dice *"se propone"*, así que el radio en km es un
mecanismo sugerido, no un requisito. Lo vinculante es la sección 2,
*"transportistas vinculados por proximidad geográfica"*, y una zona es
proximidad geográfica.

Motivos, además de que es más simple: las zonas declaradas reflejan cómo
trabaja un fletero real —piensa en provincias que atiende, no en un radio
desde su base— y el ahorro estimado es de 3 a 4 días.

Dos condiciones que se mantienen:

1. **Los campos de búsqueda son estructurados.** La dirección en texto
   libre sirve para mostrar y contactar, nunca para buscar. Provincia,
   localidad y zonas atendidas salen de listas.
2. **Las coordenadas se mantienen**, para ordenar resultados por cercanía
   y porque la sección 4 elige PostGIS para las consultas de cercanía de
   fletes. Entregar cero uso de PostGIS sería no implementar lo
   especificado.

El selector de zona del comprador viene precargado con su localidad, con
lo que se cumple que "el sistema detecta la ubicación" y además él elige.

**A resolver cuando se llegue:** zonas declaradas o radio en km. La
propuesta de zonas es más simple y más fiel al negocio; el radio es lo que
el contrato sugiere textualmente. Las coordenadas se siembran igual en los
dos casos, así que la tarea de localidades no depende de esta definición y
puede avanzar.

---

## 2026-07-25 — El radio del transportista cubre origen y destino

Vigente mientras no se resuelva la propuesta de zonas.

El contrato dice que el sistema detecta la ubicación del comprador y del
vendedor y lista transportistas "disponibles en la zona" (3.2), sin
precisar contra qué punto se mide.

Definido: **las dos puntas dentro del radio declarado**. Un transportista
que sólo cubre el destino no puede levantar la carga.

---

## 2026-07-25 — Se abandona SQL Server y el esquema se genera desde los modelos

Se activó el tope de una sola pasada. El autogenerate de reconciliación
propuso borrar tablas y columnas y cambiar tipos, no sólo agregar.

Causa de fondo, verificada: las migraciones heredadas describen un
esquema **anterior** al rediseño de los modelos. Son renombres y cambios
de tipo, no drift: `orders.total` → `total_amount`,
`orders.shipping_address` (Text) → `shipping_address_json` (JSON),
`orders.notes` → `buyer_notes` + `seller_notes`, `orders.tax` eliminada,
`order_items.unit_price` → `unit_price_snapshot`.

Y no hay camino alternativo: **no existe `create_all` en el código**. Por
ningún medio disponible en el repositorio se puede obtener un esquema que
coincida con los modelos. Lo que corrió en producción fue construido por
algo que no vino en el paquete.

Decisión: PostgreSQL con PostGIS disponible, borrar las 10 migraciones
heredadas —quedan en el historial de git— y generar una migración inicial
desde los modelos contra una base vacía.

Motivo del cambio respecto de la decisión anterior: el argumento de
aislar variables ya no aplica, porque no existe una verificación más
barata sobre SQL Server. Y este trabajo no es descartable: PostgreSQL +
PostGIS es el destino contractual (sección 4).

Prerrequisito detectado: `app/models/__init__.py` no importa `rating` ni
`notification`, así que `Base.metadata` no las ve. Eso produjo dos falsos
`DROP` en el autogenerate y, sin corregirlo, generaría un esquema sin esas
dos tablas.

---

## 2026-07-25 — Una pasada de reconciliación de esquema, con tope

El seed falla por `users.whatsapp`: la columna está en el modelo y en dos
módulos de la API, pero ninguna migración la crea. Medido el desfasaje
completo, **faltan unas 20 columnas en 6 tablas** (`orders` 10 de 27,
`payments` 3, `users` 2, `audit_logs` 2, `contact_messages` 2, `carts` 1).

Las migraciones no describen los modelos. Arreglar columna por columna
son días de ida y vuelta.

Decisión: **una** migración de reconciliación autogenerada sobre SQL
Server. Si esa única pasada no deja la línea base verde, se abandona SQL
Server y se pasa directo a PostgreSQL + PostGIS generando el esquema
inicial desde los modelos.

Motivo de no saltar ya a PostgreSQL, aunque el trabajo sobre SQL Server
se descarte igual: cambiar motor, driver y esquema a la vez sobre una
aplicación que nadie vio funcionar mezcla demasiadas variables. Un round
acotado de verificación vale más que ahorrarlo.

Restricción: la migración sólo puede agregar. Cualquier `DROP` o cambio
de tipo propuesto por el autogenerate detiene la tarea.

Consecuencia sobre el diagnóstico general: los modelos son la fuente de
verdad del esquema, no las migraciones. Cuando se genere el esquema de
PostgreSQL, se genera desde los modelos.

---

## 2026-07-25 — `alembic upgrade head` nunca pudo ejecutarse

`010_add_ratings_table.py` declara `down_revision = '009'`, pero la
revisión 009 se llama `'009_add_product_subcategory'`. Alembic corta con
`KeyError: '009'` y no aplica ninguna migración. Verificado en la cadena
completa: sólo la 010 rompe el formato `'0NN_nombre'`.

Tercera falsedad confirmada en la documentación de entrega, y la
definitiva: **una instalación limpia nunca pudo crear el esquema.** La
tabla `ratings` no existe por migración y "Fase I funciona end-to-end"
es imposible sobre una base nueva.

Se aprueba el arreglo mínimo: corregir `down_revision`. Sin tocar
esquema.

Consecuencia sobre `docs/PROJECT_STATUS.md`: siete afirmaciones falsas
verificadas. El documento se trata como no fiable en su totalidad.
Notablemente, tres errores son en contra del proyecto — el admin **sí**
tiene CRUD de subcategorías, el frontend **sí** usa `form_options`, y los
campos de servicio **sí** llegan a la API. La documentación subestima lo
construido tanto como lo sobreestima.

---

## 2026-07-25 — Fuera del contrato no implica remover

Al inventariar lo construido por encima del contrato, se distinguen tres
tratamientos en lugar de uno:

1. **Se queda y no recibe esfuerzo**: split payments, notificaciones,
   `form_options`, CRUD de subcategorías, tema claro/oscuro, About y
   Contact, mensajes de contacto. Desarmar código que funciona cuesta
   igual que escribirlo.
2. **Se oculta del frontend porque induce a error**: ratings y reputación
   de vendedor, badges y tags, `ServicesPage` estática.
3. **Riesgo a resolver antes de producción**: el endpoint de simulación
   de pagos (`payments.py:547`), declarado de desarrollo, no puede quedar
   alcanzable en producción.

Motivo: el criterio de recorte es económico, no doctrinario. Se recorta
lo que cuesta construir o lo que engaña al usuario, no lo que ya está
hecho y es inofensivo.

---

## 2026-07-25 — El contrato entra al repositorio y define el alcance

Se incorpora `CONTRATO.md` con la transcripción funcional del PDF
(secciones 1 a 5). Pasa a ser la única fuente de alcance. Las secciones
comerciales no se versionan porque el repositorio es público.

Consecuencia: `PM_ROADMAP.md` baja de rango. Sirve como plan interno,
pero **sobrepasa el contrato** y no es alcance.

---

## 2026-07-25 — Se recorta el alcance que el roadmap inventó

Contrastado el roadmap v3 contra el contrato, queda **fuera del MVP**:

- Cuatro perfiles de usuario. El contrato define dos roles; el
  transportista es "un tipo especial de proveedor" (3.2), no un rol.
- Modo `consulta_cotizacion`. No existe en el contrato.
- Cotización al transportista y estados logísticos. El contrato pide
  seleccionarlo o contactarlo con los datos provistos (3.2).
- Perfil público de vendedor tipo sucursal. El contrato dice "panel de
  control básico" (3.1).
- Filtros de atributos por categoría. El contrato pide filtros por
  categoría y ubicación (3.1).
- Subcategorías navegables y badges.

Motivo: casi todo eso viene del benchmark de Agrofy, que es referencia
interna y no justifica alcance. El contrato es a precio cerrado; construir
lo no pedido sale del margen.

---

## 2026-07-25 — La logística es un directorio, no un motor de ruteo

El contrato lo dice explícitamente en 3.2: *"en lugar de un complejo
algoritmo automatizado de ruteo, se propone un modelo de Directorio de
Logística por Geolocalización"*.

Alcance: transportista con ubicación base, certificación, radio de
cobertura y capacidad de carga; listado por zona al momento de la compra;
selección o contacto directo. Nada más.

---

## 2026-07-25 — El split payment está por encima del contrato

El contrato pide "checkout básico" de Mercado Pago (3.3) y no menciona
split payments, OAuth de vendedores ni comisión de marketplace. El código
ya lo tiene implementado.

Queda como está — ya está construido y desarmarlo cuesta más que
dejarlo — pero **no se le suma esfuerzo**. Lo que sí falta y es
contractual es la transferencia bancaria con comprobante, que hoy está en
cero.

Pendiente de confirmar con el cliente: si la comisión del 5 % del
marketplace es parte del modelo de negocio acordado, porque en este
documento no aparece.

---

## 2026-07-25 — El camino Docker del README nunca funcionó

Primer intento real de levantar la línea base: `alembic upgrade head`
falla con error 4060, la base `topgreen` no existe. Verificado que nada
en el repositorio la crea, incluido `scripts/init_local_db.sh`.

Segundo hallazgo confirmado contra la documentación de entrega, más grave
que el de la migración `011`: el quickstart de 3 comandos del README es
inejecutable. Falla el criterio de aceptación "instalación reproducible
desde cero".

Se aprueba el arreglo mínimo: creación idempotente de la base en los
scripts de init, antes de las migraciones. No se toca esquema ni modelos.

Pendiente menor: `.env.example` usa `topgreen` y
`README_LOCAL_SETUP.md:126` usa `topgreen_local`. Unificar en `topgreen`.

---

## 2026-07-24 — Agrofy es referencia interna, no requisito

El cliente no pidió Agrofy y no lo conoce. Es un marco de referencia del
equipo (decisión de PM del 20-07-2026).

Consecuencia: Agrofy no justifica alcance. Resuelve *cómo* implementar
algo que el contrato ya pide, nunca *qué* construir. Un patrón que no se
trace a un requisito del PDF no entra al MVP.

Corrige una afirmación errónea que este documento y `PROJECT.md` tenían
antes ("el cliente pidió algo similar a Agrofy").

---

## 2026-07-24 — El PDF del contrato no está en el repositorio

`PM_ROADMAP.md` v3 es un resumen del PDF hecho en la auditoría del
20-07-2026, no el contrato. El PDF no está versionado en ningún lado.

Consecuencia: las decisiones de alcance se están tomando sobre una
fuente de segunda mano. Conseguir el PDF o transcribir sus requisitos al
repositorio es prioritario, y hasta entonces cualquier "requisito
contractual" que citemos es una cita indirecta.

---

## 2026-07-24 — La documentación de entrega no es fuente de verdad

La migración `011` con `lat`, `lng` e índice geo, declarada en
`docs/PROJECT_STATUS.md`, **no existe**. Verificado: hay 10 migraciones
(`001`–`010`), ninguna menciona coordenadas, y `product.py` no las tiene.
`PM_ROADMAP.md` ya lo marcaba como sospecha; queda confirmado.

Consecuencia: el estado declarado en la documentación de entrega se trata
como afirmación no verificada hasta que exista evidencia end-to-end. El
alcance vinculante es `PM_ROADMAP.md` v3.

---

## 2026-07-24 — El objetivo activo es la Fase 0, no un MVP navegable

Se corrige el objetivo que figuraba antes en `NOW.md`. Nadie ejecutó el
código todavía: no hay evidencia de build, migraciones, seed ni smoke
tests. Planificar features sobre eso es especular.

Motivo: el roadmap v3 condiciona todas las fases siguientes a la
aprobación de la línea base, y la auditoría del `011` muestra por qué.

---

## 2026-07-24 — Adoptar `docs/pm/` como contexto de trabajo

Se crea la estructura `NOW.md`, `PROJECT.md`, `REPO_MAP.md` y
`DECISIONS.md` para trabajar sin recorrer el repositorio completo en cada
sesión.

Motivo: la documentación de entrega es extensa y descriptiva; hacía falta
una capa corta y actualizable que diga en qué estamos.

---

## Heredadas de la entrega Fase I (2026-06-04)

Decisiones tomadas por el equipo anterior que siguen vigentes. No fueron
revisadas por el equipo actual.

- **Split payment con Mercado Pago Marketplace**, 5 % de comisión
  configurable. Moneda única ARS.
- **Vendedor y comprador no son roles separados.** Los roles en base son
  `admin` y `user`; cualquier usuario puede publicar y comprar.
- **Mercado Pago se entrega desvinculado**, con todas las variables `MP_*`
  vacías. Motivo declarado: seguridad en el traspaso.
- **Imágenes en filesystem local** (`/data/uploads`) en lugar de S3 o
  Cloudinary. La entrega lo marca como no apto para producción.
- **Navegación por estado en `App.tsx`**, sin `react-router`.
  Consecuencia: no hay URL por producto.
- **Los módulos de Fase II quedan integrados a medio terminar** en vez de
  removidos, porque están entrelazados en migraciones, modelos y UI.
  La decisión sobre cada uno queda abierta para el equipo actual.

---

## Pendientes de decidir

Sin resolver. Cada una debería cerrarse con una entrada arriba.
Ordenadas por cuánto bloquean.

1. **PostgreSQL + PostGIS, o cambio contractual aprobado por escrito.**
   El contrato lo exige; el código usa SQL Server. Es Fase 2 y es caro.
   Hay que decidirlo antes de empezarla, no durante.
2. **Qué se hace con cada módulo de Fase II** (ratings, servicios,
   subcategorías, form options): completar, ocultar o remover. Están
   entrelazados en migraciones, modelos y UI; no se apagan con un flag.
3. **Si el MVP necesita URLs por producto.** Hoy no las hay. El roadmap
   pide en Fase 3 que el buscador "conserve filtros en navegación", lo
   que empuja hacia introducir routing.
4. **Alcance del rol transportista** en el MVP: selección directa,
   cotización, o ambas.
