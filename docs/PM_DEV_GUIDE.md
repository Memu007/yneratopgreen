# Mensaje PM -> Dev (guía detallada)

## Quién soy / quién es la dev

- Yo soy la PM. Guío, confirmo cambios grandes y soy adversarial cuando hace falta.
- La dev es otra AI. Ella codea y entrega evidencia.
- Yo no codeo: priorizo, reviso y apruebo o rechazo el trabajo.

## Las 3 skills

1. `caveman`: comunicación concisa sin perder información técnica.
2. `rtk`: outputs de comandos comprimidos sin ocultar errores.
3. `ponytail`: solución mínima que cumpla el alcance, sin sobreingeniería.

## Reglas de trabajo

- Una tarea a la vez y prueba antes de continuar.
- Usá la sintaxis de comentarios propia de cada lenguaje y explicá qué hace, no cómo.
- Si algo falla: error exacto, causa probable y solución propuesta.
- Archivos pequeños, específicos y preferentemente menores a 400 líneas.
- No borres, migres arquitectura ni reescribas componentes centrales sin aprobación PM.

## Conducta adversarial

- Contrastá cada entrega con el PDF y el roadmap vigente.
- Señalá mocks, documentación inconsistente y funciones que no estén probadas end-to-end.
- No aceptes decisiones PM técnicamente incorrectas sin advertir el riesgo.
- No declares cumplimiento del MVP por tener solamente UI, modelos o endpoints sin prueba.

## Corrección de dirección técnica

La auditoría completa cambió la decisión:

- `topgreen-agromarket.zip` no contiene solo React. Contiene React + FastAPI + SQLAlchemy + Alembic + catálogo + carrito + órdenes + pagos + documentación.
- Es la implementación más avanzada y será la candidata a fuente de verdad.
- El Django de `TopGreen-yo.zip` queda en pausa. No agregues más modelos, endpoints ni migraciones allí.
- Conservá el trabajo Django realizado como referencia; no lo borres hasta comparar y respaldar.

## Hallazgos que debés verificar

- El frontend React compila.
- El backend FastAPI tiene autenticación, catálogo, imágenes, carrito, pedidos, admin y Mercado Pago.
- Usa SQL Server, pero el contrato pide PostgreSQL + PostGIS.
- Solo tiene roles `admin` y `user`; faltan roles/perfiles contractuales.
- No hay logística geográfica operativa ni transportistas seleccionables.
- No existe transferencia bancaria con comprobante.
- La documentación afirma que existe la migración `011`, pero no aparece en el ZIP y el modelo no tiene coordenadas. Tratalo como inconsistencia a resolver, no como función terminada.

## Alcance de referencia Agrofy

Usá Agrofy únicamente como benchmark de:

- Buscador por texto, categoría y ubicación.
- Categorías, subcategorías y atributos específicos.
- Fichas técnicas por tipo de publicación.
- Perfil público del vendedor tipo sucursal.
- Compra directa o consulta/cotización según el producto.

No copies código, textos, marca ni diseño. No implementes publicidad, financiación, SEO editorial, suscripciones ni paridad completa. La logística geográfica sigue siendo el diferencial propio de TopGreen.

## Orden PM - Fase 0

No modifiques todavía lógica de negocio ni implementes pantallas inspiradas en Agrofy. Primero establecé una línea base reproducible.

1. Extraé `topgreen-agromarket.zip` en una carpeta definitiva dentro del workspace, sin sobrescribir otros archivos.
2. Indicá la ruta exacta creada.
3. Verificá que no haya secretos reales ni carpeta `.git` heredada.
4. Inicializá un repositorio Git nuevo solo después de informar el estado y recibir confirmación si la operación cambia archivos importantes.
5. Prepará variables desde los `.env.example`; no inventes ni publiques secretos.
6. Intentá levantar SQL Server + FastAPI con Docker Compose.
7. Ejecutá todas las migraciones Alembic disponibles y el seed.
8. Levantá React y ejecutá `npm run build`.
9. Probá como mínimo: health, registro, login, catálogo, carrito, checkout/orden, productos del vendedor, compras, ventas y admin.
10. No configures todavía credenciales reales de Mercado Pago.

## Evidencia obligatoria para volver a PM

Respondé con:

- Ruta definitiva del proyecto.
- Lista de archivos/carpetas principales.
- Última migración Alembic realmente disponible y aplicada.
- Comandos ejecutados y resultado exacto.
- URLs locales activas.
- Smoke tests: caso, resultado HTTP/UI y observación.
- Errores exactos y solución propuesta.
- Confirmación de que Django no recibió más cambios.
- Recomendación adversarial sobre si FastAPI puede ser fuente de verdad.

No pases a PostgreSQL/PostGIS ni a nuevas features hasta que la PM apruebe esta línea base. Después se ejecuta la Fase 1 del roadmap versión 3: cerrar categorías, atributos, roles, modos `compra_directa`/`consulta_cotizacion` y estados antes de modificar modelos.

## Recordatorio final

- La PM guía y aprueba; la dev es otra AI y codea.
- Usá `caveman`, `rtk` y `ponytail` sin sacrificar pruebas ni seguridad.
- No hagas cambios grandes sin autorización.
- No declares una función completa sin evidencia end-to-end.
