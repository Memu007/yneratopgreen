# Roadmap - Marketplace Agro (TopGreen)

## Proyecto

Marketplace del Sector Agropecuario - Fase Nacional  
Consultora: Ynera

## Objetivo contractual

Entregar un MVP web responsive que conecte compradores, vendedores/prestadores y transportistas a escala nacional, con catálogo, búsqueda por categoría y ubicación, logística de cercanía, carrito, pedidos, Mercado Pago y transferencia bancaria.

## Decisión técnica de recuperación

La fuente de verdad será `topgreen-agromarket.zip`, porque contiene el sistema más avanzado y coherente:

- Frontend React 18 + TypeScript + Vite.
- Backend FastAPI + SQLAlchemy + Alembic.
- Catálogo, carrito, pedidos, panel, imágenes y Mercado Pago ya iniciados.
- Documentación de entrega y scripts de desarrollo local.

El Django de `TopGreen-yo.zip` queda como material de referencia. No se seguirá desarrollando salvo que una auditoría encuentre una función exclusiva necesaria. Mantener dos backends duplicaría trabajo y riesgo.

## Estado auditado al 20-07-2026

### Evidencia positiva

- El frontend compila: `npm run build` completó sin errores.
- Hay autenticación JWT, edición de perfil y panel administrativo.
- Hay CRUD de productos, imágenes, stock, categorías y subcategorías parciales.
- Hay carrito persistente y pedidos como comprador/vendedor.
- Existe integración de Mercado Pago: preferencia, OAuth de vendedor, webhook y consulta de estado.
- Hay documentación de instalación, arquitectura, API, base de datos, pagos y manual de usuario.

### Brechas contra el PDF

- **Roles:** el backend solo diferencia `admin` y `user`; comprador y vendedor están unificados. El transportista no existe como rol/tipo de proveedor.
- **Validación:** se guarda `is_verified`, pero no existe un flujo real de validación de email/identidad.
- **Base de datos:** usa SQL Server; el PDF define PostgreSQL + PostGIS.
- **Geolocalización:** no hay PostGIS ni búsqueda por radio operativa. La documentación menciona una migración `011`, pero no está en el ZIP y el modelo actual no tiene coordenadas.
- **Logística:** no hay entidad de transportista con ubicación base, certificación, radio, capacidad, contacto ni selección durante checkout.
- **Categorías:** faltan Bienes/Ganado y Tecnología de Cultivo completas. Los servicios están parcialmente conectados.
- **Búsqueda:** usa filtros frontend y consultas simples; no hay motor geográfico ni búsqueda avanzada escalable.
- **Mercado Pago:** el código existe, pero está desvinculado y tiene un bug de sandbox conocido.
- **Transferencia bancaria:** no existe CBU/Alias, carga de comprobante ni aprobación manual del vendedor.
- **Producción:** storage local de imágenes, sin CI/CD, sin suite automática suficiente y sin despliegue propio validado.
- **Seguridad:** faltan rate limiting, validación fuerte de secretos y resolución del uso de JWT en `localStorage`.

## Estimación honesta

El producto está avanzado como prototipo funcional, pero no cumple todavía el MVP contractual. Hay aproximadamente media entrega funcional reutilizable; los mayores faltantes son geolocalización/logística, transferencia bancaria, separación de roles, PostgreSQL/PostGIS, pruebas y producción.

No se considera completada una función porque exista UI o código: debe funcionar end-to-end y tener evidencia de prueba.

## Benchmark Agrofy aplicado al MVP

Agrofy se usa como referencia de producto y navegación, no como alcance a replicar ni como fuente de diseño o código.

### Patrones que tomamos

- Buscador principal con categoría y ubicación.
- Taxonomía agropecuaria clara y subcategorías navegables.
- Filtros generales y atributos específicos según categoría.
- Tarjetas con precio, moneda, condición, ubicación, vendedor y condiciones comerciales.
- Fichas técnicas distintas para insumos, maquinaria, ganado y servicios.
- Perfil público del vendedor tipo sucursal online.
- Dos operaciones principales: compra directa y consulta/cotización.
- Productos y prestadores cercanos como resultado geográfico.
- Logística integrada a la operación como diferencial de TopGreen.

### Funciones fuera del MVP

- Publicidad y posiciones patrocinadas complejas.
- Motor propio de financiación, créditos, cheques o canje.
- Portal editorial y estrategia SEO masiva.
- Suscripciones comerciales avanzadas para vendedores.
- Recomendaciones con inteligencia artificial.
- Operación multinacional o multidioma.
- Paridad visual o funcional completa con Agrofy.

## Principios funcionales

1. Un insumo con precio y stock puede usar compra directa.
2. Maquinaria, ganado y servicios usan consulta/cotización por defecto.
3. Cada categoría muestra únicamente atributos relevantes.
4. Toda publicación tiene ubicación textual y coordenadas geográficas.
5. La logística se cotiza o selecciona según origen, destino, carga y cobertura.
6. Ninguna función se considera terminada sin prueba end-to-end.

## Roadmap MVP versión 3

Duración restante estimada: 9-11 semanas después de aprobar la línea base. El benchmark no agrega alcance empresarial; ordena mejor las funciones exigidas por el PDF.

### Fase 0 - Recuperación y línea base (2-3 días)

#### Trabajo de recuperación

1. Extraer `topgreen-agromarket.zip` en una carpeta definitiva sin sobrescribir archivos.
2. Verificar secretos, dependencias y ausencia de historial Git heredado.
3. Levantar React, FastAPI y SQL Server actual con Docker.
4. Ejecutar todas las migraciones realmente disponibles y el seed.
5. Probar registro, login, catálogo, carrito, orden, compras, ventas y admin.
6. Crear matriz requisito PDF -> evidencia -> estado -> responsable.
7. Crear repositorio Git nuevo y commit base después de aprobar la auditoría.
8. Congelar el Django como referencia y evitar desarrollo paralelo.

#### Aceptación de la línea base

- Instalación reproducible desde cero.
- Build frontend verde.
- API, base, migraciones y seed operativos.
- Smoke tests con resultados y errores documentados.
- Fuente de verdad y commit base identificados.

### Fase 1 - Definición de producto y modelo agro (3-5 días)

#### Trabajo de definición

1. Cerrar categorías MVP: Insumos/Materia Prima, Bienes/Ganado, Maquinaria/Servicios, Tecnología de Cultivo y Logística.
2. Definir subcategorías y atributos obligatorios por categoría.
3. Definir modos `compra_directa` y `consulta_cotizacion`.
4. Definir estados de publicación, consulta, cotización, orden, logística y pago.
5. Diseñar flujos mínimos de comprador, vendedor/prestador y transportista.
6. Preparar wireframes de home, resultados, detalle, sucursal y checkout/cotización usando Agrofy solo como benchmark.
7. Congelar alcance y backlog posterior al MVP.

#### Aceptación de producto

- Diccionario de categorías y atributos aprobado.
- Matriz de permisos por rol aprobada.
- Diagramas de estados sin transiciones ambiguas.
- Cada pantalla del MVP está vinculada con un requisito contractual.
- Funciones fuera de alcance registradas y no planificadas en el sprint.

### Fase 2 - Arquitectura, datos y seguridad (1-2 semanas)

#### Trabajo de arquitectura

1. Migrar SQL Server a PostgreSQL con PostGIS, salvo cambio contractual aprobado por escrito.
2. Adaptar SQLAlchemy, Alembic, Docker, seed y documentación.
3. Modelar perfiles: comprador, vendedor/prestador, transportista y admin.
4. Implementar permisos y validación/aprobación de cuentas.
5. Modelar atributos por categoría sin crear tablas o columnas rígidas innecesarias.
6. Agregar coordenadas geográficas e índices espaciales.
7. Corregir secretos, CORS, rate limiting y estrategia segura de sesión.
8. Mantener compatibilidad con catálogo, carrito y pedidos recuperados.

#### Aceptación de arquitectura

- Base vacía migra y carga seed en PostgreSQL/PostGIS.
- Permisos por rol tienen pruebas positivas y negativas.
- Publicaciones de categorías distintas validan atributos diferentes.
- Consultas espaciales básicas funcionan con datos demo.
- No se pierden los flujos core recuperados.

### Fase 3 - Catálogo y sucursales online (2 semanas)

#### Trabajo de catálogo

1. Crear home con buscador por texto, categoría y ubicación.
2. Conectar búsqueda y filtros al backend, sin dependencia funcional de mocks.
3. Implementar filtros generales: categoría, ubicación/distancia, precio, moneda, condición y disponibilidad.
4. Implementar filtros específicos por categoría: marca/año para maquinaria, cultivo/uso para insumos y capacidad/tipo para servicios.
5. Completar publicación, edición, pausa, baja, imágenes, precio, stock y ubicación.
6. Implementar ficha técnica según categoría y modo de operación.
7. Crear perfil público del vendedor con datos verificados y publicaciones activas.
8. Mostrar badges simples: verificado, nuevo/usado, entrega inmediata y acepta cotización.

#### Aceptación de catálogo

- El buscador devuelve datos reales y conserva filtros en navegación.
- Cada categoría tiene publicaciones demo y atributos propios.
- El vendedor publica y administra inventario end-to-end.
- El comprador ve precio o botón de consulta según el modo configurado.
- La sucursal pública solo expone información permitida.
- Desktop y móvil pasan prueba manual.

### Fase 4 - Geolocalización y logística integrada (2 semanas)

#### Trabajo de logística

1. Capturar o geocodificar coordenadas de publicaciones, compradores y transportistas.
2. Modelar transportista: ubicación base, certificación, radio, capacidad, tipo de carga y contacto.
3. Implementar búsqueda PostGIS por distancia y cobertura.
4. Mostrar productos, vendedores y prestadores cercanos.
5. Solicitar origen, destino, carga y fecha para logística.
6. Listar transportistas compatibles por cobertura y capacidad.
7. Permitir selección directa o solicitud de cotización al transportista.
8. Guardar elección, costo acordado y estados logísticos en la operación.

#### Aceptación de logística

- Datos demo incluyen ubicaciones y transportistas dentro/fuera de cobertura.
- La API calcula distancia real y excluye opciones incompatibles.
- El comprador puede seleccionar o consultar un transportista.
- La orden conserva origen, destino, carga, transportista y acuerdo.
- Pruebas de borde cubren radio, capacidad y coordenadas inválidas.

### Fase 5 - Operaciones, checkout y pagos (2 semanas)

#### Trabajo de operaciones

1. Mantener carrito y checkout para publicaciones de compra directa.
2. Implementar consulta y cotización para maquinaria, ganado y servicios.
3. Permitir que vendedor y transportista acepten, rechacen o coticen.
4. Crear aplicación propia de Mercado Pago y validar sandbox.
5. Validar preferencia, retorno, webhook, idempotencia, rechazo y reintento.
6. Implementar transferencia bancaria con CBU/Alias y comprobante privado.
7. Permitir aprobación o rechazo manual del comprobante.
8. Unificar estados de operación, logística, pago y stock.
9. Definir comisión del marketplace antes de habilitar cobros.

#### Aceptación de operaciones

- Compra directa completa Mercado Pago sandbox una sola vez.
- Transferencia permite cargar, aprobar y rechazar comprobantes seguros.
- Consulta/cotización funciona sin crear pagos prematuros.
- Stock cambia únicamente en la transición definida.
- Webhooks y reintentos son idempotentes.
- Comprador y vendedor ven el mismo estado consistente.

### Fase 6 - QA, producción y entrega (2 semanas)

#### Trabajo de lanzamiento

1. Tests backend para autenticación, permisos, catálogo, geo, logística, operaciones y pagos.
2. Tests frontend y E2E para compra directa y consulta/cotización.
3. Pruebas responsive y accesibilidad en móvil/escritorio.
4. Storage externo privado/público según imágenes o comprobantes.
5. CI con lint, tests, migraciones y build.
6. Despliegue con HTTPS, secretos rotados, backups y monitoreo.
7. Carga inicial, manual operativo, capacitación y accesos administrativos.
8. Registrar garantía de soporte por bugs durante 90 días.

#### Aceptación del lanzamiento

- Pipeline y migración de producción verdes.
- Smoke tests públicos pasan para todos los roles.
- HTTPS, backups, alertas y restauración están comprobados.
- No hay secretos ni comprobantes expuestos.
- Manual, accesos y acta de aceptación están entregados.

## Prioridades

1. Recuperar y probar el FastAPI existente.
2. Cerrar categorías, atributos y modos de operación antes de cambiar modelos.
3. Detener el desarrollo del Django paralelo.
4. Resolver PostgreSQL/PostGIS, roles y seguridad.
5. Entregar catálogo especializado y sucursales online.
6. Implementar logística geográfica como diferencial.
7. Completar compra directa, consulta/cotización y ambos medios de pago.
8. Endurecer, probar y desplegar.

## Gobierno PM / Dev

- La PM define alcance, prioridades, criterios de aceptación y aprueba cambios grandes.
- La dev implementa una tarea por vez, prueba y entrega evidencia reproducible.
- Cada entrega debe incluir: archivos cambiados, migración, comandos ejecutados, resultado, riesgos y siguiente propuesta.
- La PM rechaza avances sin prueba o que dupliquen arquitectura.
- `caveman`, `rtk` y `ponytail` se usan para reducir ruido y sobreingeniería, nunca para omitir validaciones, seguridad o claridad.

## Registro de decisiones

- **20-07-2026:** roadmap preliminar reemplazado después de auditar el PDF y el ZIP completo.
- **20-07-2026:** se identifica FastAPI como backend más avanzado y candidato a fuente de verdad.
- **20-07-2026:** los modelos agregados al Django quedan en pausa; no justifican continuar un backend duplicado.
- **20-07-2026:** Agrofy se adopta como benchmark limitado de catálogo, filtros, fichas y sucursales; no se replica su alcance completo.
- **20-07-2026:** se separan compra directa y consulta/cotización para reflejar operaciones agropecuarias reales.
- **20-07-2026:** roadmap actualizado a versión 3 con duración restante estimada de 9-11 semanas.
