# Roadmap operativo para cerrar el MVP

Actualizado: 2026-09-01.  
Fuentes: `CRONOGRAMA.md`, `ALCANCE-Y-LIMITES.md`, `NOW.md` y
`AUDITORIAS-UX-CLAUDE-2026-08-30.md`.

## Qué es y qué no es

Este archivo ordena la ejecución interna pendiente. **No cambia el contrato, el
alcance ni las fechas:** si se contradice con `CRONOGRAMA.md`, gana el
cronograma. El 31/08 transcurre la semana contractual 2, dentro de Fase 1, que
cierra el 03/09. El producto está adelantado funcionalmente hasta Fase 4, pero
el hito final sólo existe con despliegue productivo exitoso y accesos de
administración entregados.

Las auditorías externas son insumo, no órdenes. Cada hallazgo se reproduce,
acota y abre por separado. No se inicia una función de Fase 6 ni se acelera la
entrega para llenar tiempo. Mercado Pago, red-team y producción permanecen al
final, como acordó Emi.

## Estado de entrada

- ORD-SELF-1 queda aceptada tras la corrección `40b589b`, informe `99e828f`.
  `/cart/sync` valida antes de crear y el caso 140 ya distingue las dos puertas.
- TEST-IMG-1 cerró en `4c015f0`/`cb0875b`; el ajuste aislado del caso 140
  `fa8b382` también fue revisado y aceptado.
- TEST-HARNESS-MAC-1S quedó aceptada en `78972cf`/`d24fece`: volumen nuevo
  escribible como UID 1000 y dos corridas oficiales independientes de PM en
  **140/140**, cada una iniciada con descarte de la base anterior.
- Tarea única vigente: **TRANSFER-REC-1**, detallada en `PARA-DEV.md`.
- ORD-SELF-1 no cierra ningún hallazgo de las tres auditorías; era la tarea P1
  anterior y las auditorías la excluyeron expresamente.
- La historia de las devoluciones del arnés y su cierre reproducido queda en
  `REPRODUCCION-SMOKE-PM-2026-08-31.md` y
  `REPRODUCCION-SMOKE-PM-2026-09-01.md`. La suite ya puede usarse como puerta
  reproducible para las tareas de producto siguientes.

## Reglas de ejecución

1. Una sola tarea de producto activa. Nada de entregar la auditoría completa a
   Dev como megaterea.
2. Cada bloque necesita defecto reproducido o prueba roja, corrección mínima,
   regresión discriminante, suite completa y revisión adversarial de PM.
3. Un informe o una prueba que no mida su afirmación no habilita aceptación.
4. No se despliega una mejora por estar verde en local. Railway descartable,
   homologación MP y producción tienen puertas propias.
5. Si un hallazgo resulta falso o fuera del MVP, se cierra por escrito; no se
   implementa para “aprovechar”.

## Orden de ejecución

### Puerta 0 — cerrar la evidencia actual

| Orden | Pieza | Cierre mínimo |
|---:|---|---|
| 0 | **ORD-SELF-1R — cerrada** | Aceptada en `40b589b`/`99e828f`: `/cart/sync` valida antes de crear y prueba `409` con cero filas usando una cuenta sin carrito. |
| 1 | **TEST-IMG-1 — cerrada** | Aceptada en `4c015f0`/`cb0875b`: selección por conteo menor a tres y diagnóstico HTTP/cuerpo. Sólo prueba; sin producto. |
| 1B | **TEST-HARNESS-MAC-1S — cerrada** | Aceptada en `78972cf`/`d24fece`: volumen documental nuevo escribible como UID 1000 y dos corridas oficiales de PM en 140/140 desde bases limpias. |

ORD-SELF-1, TEST-IMG-1 y TEST-HARNESS-MAC-1 ya cerraron. La suite oficial queda
habilitada como puerta de las tareas de producto.

### Puerta 1 — integridad contractual y operación básica

| Orden | Pieza | Auditoría cubierta | Cierre mínimo |
|---:|---|---|---|
| 2 | **TRANSFER-REC-1** | F2 y el borde P1 de F3 | Desde Mis compras, una transferencia pendiente vuelve a mostrar datos bancarios y permite adjuntar comprobante por la ruta existente; cerrar el checkout no deja un callejón sin salida. |
| 3 | **CART-RECOVERY-1** | R2 | Un `localStorage` corrupto se descarta de forma acotada y la aplicación arranca; no se borra un carrito válido del servidor. |
| 4 | **SERVICE-STATE-1** | F1 | Un único mapeador conserva anatomía y estado de servicios al cargar, editar y recargar el panel. |
| 5 | **ADMIN-ACTIONS-1** | ADM-1, ADM-5; reproduce ADM-R1/R2/R3 | Las acciones tienen nombre y el método HTTP real; antes de habilitar cambios peligrosos se prueba referencia de opción, subcategoría usada y cambio Producto/Servicio. |
| 6 | **ADMIN-PAGE-1** | ADM-2 | Usuarios, publicaciones y órdenes tienen paginación y búsqueda/filtros mínimos; el registro 21 es alcanzable y el total es honesto. |

Esta puerta va antes del pulido: transferencia y administración forman parte de
la operación prometida. Los riesgos ADM-R1/R2/R3 pueden obligar a bloquear una
edición, no a inventar una migración destructiva.

### Puerta 2 — navegación y conservación del trabajo

| Orden | Pieza | Auditoría cubierta | Cierre mínimo |
|---:|---|---|---|
| 7 | **NAV-URL-1** | A1, A2, A3, A8 y B4 | URL compartible por sección, `popstate`, rutas especiales normalizadas y Atrás coherente incluso con detalle abierto. |
| 8 | **MODAL-LIFECYCLE-1** | C1 y ADM-8 | Cierra primero la capa superior, restaura foco al disparador y conserva pestaña/posición del panel. |
| 9 | **FORM-DIRTY-1** | F3 general | Formularios largos sucios confirman antes de perderse; los intactos cierran sin fricción. |

No se corrige cada síntoma con otro `pushState` o listener local: NAV-URL-1
tiene una sola política de navegación y una sola regresión matriz.

### Puerta 3 — verdad de formularios, órdenes y administración

| Orden | Pieza | Auditoría cubierta | Cierre mínimo |
|---:|---|---|---|
| 10 | **FORM-CONSISTENCY-1** | F5, F7 y F13 | Alta/edición comparten validación, imágenes verifican `response.ok`, errores reciben foco/alerta y catálogos fallidos muestran error/reintento. |
| 11 | **LOCATION-SOURCE-1** | F6 y C3 | Edición escribe la ubicación oficial del padrón; se elimina o retira el campo legado engañoso. |
| 12 | **TRANSFER-REVIEW-1** | F8 | Rechazo de comprobante usa capa propia, motivo obligatorio y resultado visible; sin `window.prompt`. |
| 13 | **ADMIN-TRUTH-1** | ADM-3, ADM-4, ADM-10 y ADM-11 | Métricas y rótulos corresponden a la API, estados están en es-AR y cada carga distingue error, vacío y reintento. |
| 14 | **ADMIN-SAFETY-1** | ADM-6, ADM-7, ADM-9; reproduce ADM-R4/R5 | Confirmaciones propias para acciones sensibles y reset manual acotado. Antes se mide categoría desactivada y Provincias legado. |
| 15 | **RATING-UX-1** | F9, F10 y F11 | Estrellas visibles y accesibles; después de recargar no reaparece una calificación ya enviada. |

La recuperación automática de contraseña F4 sigue fuera del MVP. Sólo puede
cerrarse con una instrucción honesta de soporte y la herramienta administrativa
manual ya prevista; no se abre un módulo de tokens nuevo.

### Puerta 4 — continuidad y claridad comercial

| Orden | Pieza | Auditoría cubierta | Cierre mínimo |
|---:|---|---|---|
| 16 | **QUOTE-CONTACT-1** | A4 y A5 | Contacto no afirma un envío que no conoce y una cotización conserva publicación/vendedor en asunto y texto. |
| 17 | **FILTER-INTENT-1** | A6, A9 y, si se reproduce, R6 | Filtros URL inválidos no simulan cero resultados; Login retoma publicar/comprar con la puerta existente. |
| 18 | **COPY-CLEAR-1** | A7, A10, F4 y F12 | Emi decide wordmark→Inicio; Buscar hace algo real o desaparece; se retiran planes inexistentes, se unifica voseo y se informa soporte sin prometer recuperación automática. |

Son mejoras de claridad, no autorización para mensajería, planes, suscripciones
o un rediseño nuevo.

### Puerta 5 — deuda estructural y volumen

| Orden | Pieza | Fuente | Condición de entrada |
|---:|---|---|---|
| 19 | **CAT-PAGE-1** | deuda UX-2C y ADM-2 como patrón | Probar más de 100 publicaciones; conteo, orden y navegación deben representar al servidor completo. |
| 20 | **QUERY-IMG-1** | C2 | Medir primero el N+1 de imágenes; optimizar sólo con evidencia y conservar respuestas. |
| 21 | **RISK-REC-1** | R1, R4 y R5 | Reproducir concurrencia de stock, señal frágil de reenvío y grupo sin medio de pago; promover únicamente defectos reales. |

Cinco mil visitas mensuales no justifican reescribir la arquitectura. Esta
puerta cierra primero paginación, consultas y recorridos medidos; capacidad y
recursos de Railway se ajustan después con métricas.

### Puerta 6 — cierre contractual, sin adelantar

1. **MP-D:** homologación real con comprador y vendedor de prueba separados,
   pago aprobado, webhook e idempotencia; programar el reconciliador. La bandera
   permanece `false` fuera de la prueba controlada.
2. **Responsive y usabilidad final:** recorridos comprador, vendedor,
   transportista y admin en medidas acordadas, incluidos táctil y teclado.
3. **QA y red-team:** suite desde base limpia y la matriz completa de seguridad
   de `CRONOGRAMA.md`; ningún crítico/alto abierto. Railway y MP sólo reciben
   pruebas pasivas o flujos de prueba autorizados.
4. **Operación productiva:** persistencia de imágenes, backups con restauración,
   secretos/accesos, logs, métricas, dominio/HTTPS y mismo SHA en GitHub,
   Frontend y Backend.
5. **Entrega:** carga inicial segura, documentación contrastada, capacitación,
   accesos admin, despliegue productivo y acta que inicia los 90 días de
   garantía.

Sólo el punto 5, completo, habilita el hito final. El Railway
`strong-playfulness` continúa siendo descartable y no cuenta como producción.

## Hallazgos que no generan desarrollo

- R3 quedó descartado: ratings acepta número o UUID de orden.
- F4 no abre recuperación automática de contraseña.
- Ningún hallazgo autoriza mapas, bot, suscripciones, mensajería, tierras,
  ruteo, retención de pagos ni reclamos/devoluciones completos.

## Definición de cierre de cada pieza

- Producto y regresión en un commit; informe separado en `PARA-PM.md`.
- Prueba roja contra la base indicada y verde después, o reproducción manual
  precisa cuando no sea automatizable.
- Suite completa desde base limpia, build, lint, compileall, `pip check` y
  `diff --check`; accesibilidad/contraste cuando cambie interfaz.
- Revisión PM de código y evidencia. El reporte de Dev por sí solo no acepta.
- Despliegue únicamente si la propia pieza lo ordena y con SHA verificable.
