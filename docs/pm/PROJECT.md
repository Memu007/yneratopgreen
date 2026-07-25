# Ynera TopGreen — Alcance estable

Marketplace agropecuario. Este documento cubre lo que no cambia entre
sesiones. El estado móvil vive en `NOW.md`.

## Qué es

Plataforma donde vendedores del sector agropecuario publican productos y
compradores los encuentran, los agregan a un carrito y pagan. La
plataforma cobra una comisión sobre cada venta.

## Actores

| Actor | Puede |
|-------|-------|
| Comprador | Buscar por texto, categoría y ubicación; ver detalle; carrito; comprar o pedir cotización; seguir sus órdenes |
| Vendedor / prestador | Publicar y administrar publicaciones, cotizar consultas, ver sus ventas, cobrar |
| Transportista | Ofrecer cobertura logística, ser seleccionado o cotizar un envío |
| Admin | Gestionar usuarios, publicaciones, órdenes y categorías; validar cuentas; ver estadísticas |

**Brecha:** el código sólo distingue `admin` y `user`. Comprador y
vendedor están unificados y **el transportista no existe**. Los cuatro
perfiles son requisito contractual.

## Modelo de negocio

Split payment vía Mercado Pago Marketplace: 5 % para la plataforma, 95 %
para el vendedor. El porcentaje es configurable
(`MP_COMMISSION_PERCENT`). Moneda única: ARS.

## Recorrido comprador

Catálogo → filtros → detalle de producto → carrito → checkout → pago →
resultado de pago → seguimiento de la orden.

## Alcance Fase I — construido

Autenticación con JWT, catálogo con filtros por categoría, texto y rango
de precio, CRUD de publicaciones con imágenes, carrito persistido,
órdenes con estados (`pending`, `paid`, `shipped`, `delivered`,
`cancelled`), panel de administración, integración de pagos completa a
nivel de código, diseño responsive con modo claro y oscuro.

Detalle en `docs/PROJECT_STATUS.md`.

## Fase II — presente pero incompleto

Estos módulos están entrelazados en migraciones, modelos y UI. No se
apagan con un feature flag. Cada uno necesita una decisión explícita:

| Módulo | Estado |
|--------|--------|
| Ratings de vendedores | API y UI funcionando, sin tests ni validación a escala |
| Productos vs servicios | Campos en base y UI parcial; `ServicesPage` es estática |
| Subcategorías | Tabla y endpoint listos; sin CRUD en admin ni datos de seed |
| Form options dinámicos | Tabla y endpoint listos; el frontend usa listas hardcoded |
| Filtros geográficos | **No existen.** La documentación de entrega los declara, pero no hay migración, ni columnas, ni código |

## Geolocalización y logística — alcance definido

Definido el 2026-07-25. Cumple secciones 3.1 y 3.2 sin servicios de
geocoding pagos ni dependencias externas en runtime.

### Origen de las coordenadas

Una tabla de **localidades sembrada una sola vez** con provincia,
nombre y coordenadas, desde datos geográficos abiertos de Argentina
(fuente exacta a verificar; si no sirve, un CSV de las localidades
agropecuarias principales alcanza para el MVP).

Vendedores, compradores y transportistas **eligen su localidad de una
lista**. Nadie escribe direcciones libres. Las distancias las calcula
PostGIS localmente.

Costo recurrente: cero. Dependencia externa en runtime: ninguna.

### Comprador — búsqueda por zona (3.1)

Filtro de ubicación en el catálogo, combinable con categoría. Mínimo:
provincia y localidad. Deseable, y casi gratis porque la consulta es la
misma: "hasta X km" alrededor de la localidad elegida.

### Transportista — directorio por zonas declaradas (3.2)

Se registra como **tipo especial de proveedor**, no como rol nuevo.

Distinción central: hay **datos que se muestran** y **datos que se
consultan**, y no son los mismos campos.

| Para mostrar y contactar | Para buscar |
|--------------------------|-------------|
| Dirección en texto libre | Provincia y localidad base, de una lista |
| Teléfono, correo, nombre comercial | **Zonas que atiende**, de una lista (selección múltiple) |
| Transporte habilitado certificado | Capacidad de carga y tipo de carga |

Una dirección escrita a mano —"Ruta 8 km 340, cerca de Pergamino"— no la
encuentra ninguna consulta. Los campos de búsqueda tienen que ser
estructurados.

### Regla de coincidencia — zonas, no radio

El comprador **elige una zona** y se listan los transportistas que la
declararon entre las que atienden. Consulta simple, sin cálculo de
radios.

El selector **viene precargado con la localidad del comprador** y él
puede cambiarla. Así se cumple que *"el sistema detecta la ubicación"*
(3.2) y además el comprador elige.

Los resultados se **ordenan por cercanía** a la localidad del comprador,
con PostGIS sobre las coordenadas de la tabla de localidades.

El comprador puede **seleccionarlo e incluirlo en la transacción** o
**contactarlo directo** con los datos provistos. Sin flujo de cotización.

**Por qué zonas y no el radio en km del contrato:** la sección 3.2 se
titula *"Sugerencia de Implementación Ágil"* y dice *"se propone"*, así
que el radio es un mecanismo sugerido, no un requisito. Lo vinculante es
la sección 2: *"transportistas vinculados por proximidad geográfica"*, y
una zona es proximidad geográfica. Además las zonas declaradas reflejan
mejor cómo trabaja un fletero real, que piensa en provincias que atiende
y no en un radio desde su base.

### Por qué se mantienen las coordenadas

Aunque el filtro sea por zona y no necesite distancias:

1. Ordenar los resultados por cercanía, que con las coordenadas ya
   sembradas sale casi gratis y es mejor que un orden alfabético.
2. La sección 4 elige PostGIS *"para resolver las consultas de ubicación
   y cercanía de fletes"*. Entregar cero uso de PostGIS sería no
   implementar lo especificado.

### Fuera de alcance en geolocalización

Sin costo contractual, recortado explícitamente:

- Geocoding de direcciones libres.
- Mapas y selección visual con pin. El contrato no los menciona.
- Distancia por ruta real. El contrato **rechaza** los algoritmos de
  ruteo (3.2). Distancia en línea recta alcanza.
- Radio definido por el comprador. El radio lo declara el transportista.

### Pendiente de definir

Cómo se cumple *"que coincidan con los requerimientos del producto"*
(3.2). Filtrar por capacidad exige que la publicación declare peso o tipo
de carga, y hoy no lo hace. Opciones: agregar esos campos y filtrar, o
mostrar la capacidad como información y filtrar sólo por geografía.

## Brechas contra el contrato

Alcance vinculante: `CONTRATO.md`. Verificado contra el código el
2026-07-25.

| Brecha contractual | Estado en el código |
|--------------------|---------------------|
| PostgreSQL + PostGIS (sección 4, sin alternativa) | Usa SQL Server |
| Búsqueda con filtro por **ubicación** (3.1) | No existe |
| Directorio de transportistas por geolocalización (3.2) | No existe la entidad ni el flujo |
| Transferencia bancaria: CBU/alias, comprobante, validación manual (3.3) | No existe nada |
| Registro **con validación** de ambos roles (3.1) | Hay campo `is_verified`, sin flujo |
| Categoría Bienes y Ganado (2) | Incompleta |
| Categoría Tecnología para el Cultivo (2) | Incompleta |
| Categoría Módulo de Logística Integrada (2) | No existe |

## Construido por encima del contrato

Inventario verificado el 2026-07-25. **"No está en el contrato" no
significa "hay que borrarlo".** Desarmar código que funciona cuesta
dinero igual que escribirlo. Tres tratamientos distintos:

### Se queda como está — no recibe más esfuerzo

Funciona, no molesta, y removerlo costaría más que dejarlo.

| Ítem | Qué pide el contrato |
|------|----------------------|
| Split payments, OAuth de vendedores, comisión 5 % | *"Checkout básico"* de Mercado Pago (3.3) |
| Notificaciones in-app | No lo menciona |
| `form_options` dinámicos (sí usados por el frontend) | No lo menciona |
| CRUD de subcategorías en admin (existe y funciona) | Define cinco categorías |
| Tema claro/oscuro | No lo menciona. Es UI ya hecha, sin costo de mantenimiento |
| Páginas About y Contact | No las menciona. Inocuas |
| Centro de mensajes de contacto | No lo menciona. Ya funciona |

### Se oculta del frontend — induce a error

| Ítem | Problema |
|------|----------|
| Ratings, reputación y reseñas de vendedor | El contrato pide *"panel de control básico"* (3.1). Muestra reputación sobre datos que no existen |
| Badges y tags de producto | Prometen atributos que el catálogo no garantiza |
| `ServicesPage` estática | Ofrece servicios de TopGreen como empresa, no publicaciones de proveedores. En un marketplace, confunde |

### Riesgo, no alcance — resolver antes de producción

| Ítem | Por qué |
|------|---------|
| Endpoint de simulación de pagos (`payments.py:547`) | Declarado de desarrollo. Alcanzable en producción sería grave. Hay que cerrarlo por entorno o eliminarlo |
| Reembolsos | Estructura sin probar, sobre una integración que el contrato no pidió |

El modelo `audit.py` existe pero ninguna ruta lo expone. No cuenta como
funcionalidad entregada.

## Alcance inventado por el roadmap interno

`PM_ROADMAP.md` v3 agrega requisitos que **no están en el contrato**. La
mayoría viene del benchmark de Agrofy, que es referencia interna y no
justifica alcance. **No entran al MVP:**

| Ítem del roadmap | Qué dice el contrato |
|------------------|----------------------|
| Cuatro perfiles de usuario | Dos roles; el transportista es *"un tipo especial de proveedor"* (3.2) |
| Modo `consulta_cotizacion` | No existe. Habla de carrito e historial de pedidos (3.1) |
| Cotización al transportista y estados logísticos | Seleccionarlo o contactarlo directo (3.2) |
| Perfil público de vendedor tipo sucursal | *"Panel de control básico"* (3.1) |
| Filtros de atributos por categoría (marca/año, cultivo/uso) | Filtros *"por categoría y ubicación"* (3.1) |
| Subcategorías navegables | Cinco categorías, sin subcategorías |
| Badges (verificado, entrega inmediata, acepta cotización) | No los menciona |

## Estado real

El producto es un prototipo funcional del recorrido de compra, con la
mitad del MVP contractual sin construir. Lo que falta no es cosmético:
**geolocalización, logística, transferencia bancaria y PostGIS son el
núcleo del contrato y hoy están en cero.**

## Benchmark — Agrofy

**El cliente no pidió Agrofy y no lo conoce.** Es una referencia interna
del equipo, adoptada por decisión de PM el 20-07-2026, para tener un
modelo mental de cómo se ordena un marketplace agropecuario.

Consecuencia: **Agrofy no justifica alcance.** No es requisito de nada.
Sirve para resolver *cómo* implementar algo que el contrato ya pide
(cómo agrupar filtros, qué campos lleva una ficha de maquinaria), nunca
para decidir *qué* construir. Si un patrón de Agrofy no se puede trazar
a un requisito del PDF, no entra: es alcance que nos inventamos y no está
pagado.

**Se usa como referencia para:** estructura del buscador (texto +
categoría + ubicación), taxonomía agropecuaria y subcategorías, qué
filtros aplican por categoría, qué campos lleva cada ficha técnica según
tipo de publicación, perfil público de vendedor tipo sucursal, y la
separación entre compra directa y consulta/cotización.

**No se toma:** HTML, CSS ni JS del sitio, textos literales, marca,
logotipos, imágenes, ni el diseño visual distintivo. Los patrones se
reimplementan desde cero con identidad propia de TopGreen.

La logística geográfica es el diferencial propio de TopGreen y no sale
del benchmark.

## Fuente de verdad del alcance

`CONTRATO.md` — transcripción funcional del PDF, incorporada el
2026-07-25.

Orden de precedencia, de mayor a menor:

1. `CONTRATO.md` — lo único vinculante.
2. `PM_ROADMAP.md` — plan interno. Útil como secuencia, pero **sobrepasa
   el contrato** en varios puntos (ver arriba). No es alcance.
3. `docs/PROJECT_STATUS.md` y el resto de la documentación de entrega —
   no confiable. Dos afirmaciones ya verificadas como falsas.

## Fuera de alcance

Publicidad y posiciones patrocinadas, financiación y canje, portal
editorial y SEO masivo, suscripciones para vendedores, recomendaciones
con IA, multi-país y multi-idioma, paridad con Agrofy.

Tampoco entran: mensajería comprador ↔ vendedor, reviews de productos,
favoritos, cupones.

## Restricciones heredadas de la entrega

- Las credenciales de Mercado Pago se entregaron vacías. El equipo actual
  usa su propia aplicación.
- Las imágenes se guardan en filesystem local (`/data/uploads`). La
  propia entrega lo marca como no apto para producción.
- No hay dependencia del equipo anterior: ni servidor, ni túnel, ni
  hosting, ni base productiva previa.
- Las credenciales demo del seed (`admin123`, etc.) deben cambiarse antes
  de producción.
