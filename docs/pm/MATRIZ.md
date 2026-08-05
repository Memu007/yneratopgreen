# Matriz requisito contractual → evidencia → estado

Contrastada contra `CONTRATO.md`. Actualizada el 2026-07-25 con la línea
base PostgreSQL en verde.

**Estados:** ✅ verificado con evidencia de ejecución · 🟡 existe en
código, sin verificar · ⚪ parcial · ❌ inexistente

---

## 3.1 Rol Comprador

| Requisito | Estado | Evidencia |
|-----------|--------|-----------|
| Registro | ✅ | Smoke test: `201`, usuario creado |
| …con validación | ❌ | Validación por correo definida el 2026-08-05; campo `is_verified` existe, flujo todavía sin implementar |
| Perfil | ✅ | `GET /auth/me` y `PATCH /auth/me` responden `200` |
| Buscador con filtro por **categoría** | ✅ | Smoke test `200`, filtros de categoría, precio y stock aplicados |
| Buscador con filtro por **ubicación** | ✅ | Selectores encadenados de provincia y localidad, filtrado en el servidor, estado en la URL. Verificado en navegador y contrastado contra SQL |
| Carrito de compras | ✅ | Smoke test: agregar y ver, `200` + `200`, total $45.000 |
| Historial de pedidos | ✅ | Smoke test "mis compras": `200`, 3 compras |

## 3.1 Rol Vendedor

| Requisito | Estado | Evidencia |
|-----------|--------|-----------|
| Registro con validación | ❌ | Validación por correo definida; flujo todavía sin implementar |
| Panel de control básico | ✅ | Carga perfil, ventas y productos en UI, con el contador de ventas ya corregido |
| Publicación desde la UI | ✅ | Producto completo publicado con imagen, verificado en la suite en interfaz, API y base. Cubre también el caso de imagen fallida |
| Publicación con **ubicación** | ✅ | `locality_id` obligatorio contra el padrón oficial. Verificado: Balcarce `06063010` guardado en base |
| Gestión de stock | ✅ | Filtro de stock aplicado en catálogo, verificado en UI |
| Gestión de ventas recibidas | ✅ | "Mis Ventas" lista 2 pedidos en UI |

## 3.2 Módulo de Logística

| Requisito | Estado | Evidencia |
|-----------|--------|-----------|
| Transportista como tipo especial de proveedor | ⚪ | Pieza A: `is_carrier` sobre `users`, sin rol nuevo. Smoke 21 UI + API + DB |
| Declara ubicación base | ✅ | Smoke 21: localidad del padrón persistida y contrastada con SQL |
| Declara transporte habilitado certificado | ⚪ | Texto + booleano obligatorios; falta convertirlo en declaración atribuida con detalle y fecha |
| Declara zona de cobertura en km | ✅ | Smoke 21: radio 125,50 km persistido y contrastado con SQL |
| Declara capacidad de carga | ✅ | Smoke 21: capacidad persistida y contrastada con SQL |
| Sistema detecta ubicación de comprador y vendedor | ❌ | — |
| Lista transportistas compatibles en la zona | ❌ | — |
| Seleccionar e incluir en la transacción | ❌ | — |
| Contactar directo con los datos provistos | ❌ | — |

**Fase contractual 3. Es el diferencial del producto y está en cero.**

## 3.3 Pagos

| Requisito | Estado | Evidencia |
|-----------|--------|-----------|
| Mercado Pago, checkout básico | ❌ | **Corregido el 2026-07-26.** Lo heredado no era el requisito: es split con comisión de marketplace y OAuth de vendedores, no el "checkout básico" del contrato. Se desmonta por decisión de producto —la plataforma no maneja fondos de terceros— y se reconstruye sin split cuando haya credenciales |
| — Agujero encontrado y cerrado | ✅ | `POST /payments/simulate-payment/{order_id}` permitía a un comprador autenticado pasar su propia orden a `PAID` sin pagar. Eliminado. Smoke 19: `payments`, `mp-oauth` y `simulate-payment` responden `404` porque los routers no se montan, no porque falten credenciales |
| Transferencia: los datos bancarios no cambian bajo el comprador | ✅ | Smoke 14: se crea la orden, se cambian CBU y alias en el perfil del vendedor, y el comprador sigue viendo los originales. API contrastada contra SQL |
| Transferencia: mostrar CBU/Alias del vendedor | ✅ | Smoke 13 y 14: sin datos bancarios la API rechaza con `400`; con datos, el CBU devuelto coincide con la consulta SQL |
| Transferencia: adjuntar comprobante | ✅ | Smoke 15: archivo inválido `400` sin cambiar estado; válido `200` con la URL contrastada contra SQL. Sólo el comprador, `403` para el resto |
| Transferencia: validación manual del vendedor | ✅ | Smoke 16, 17, 23 y 25: **vendedor ajeno `403`**; puede decidir con o sin comprobante; el rechazo exige motivo; dos aprobaciones simultaneas descuentan una sola vez |
| Transferencia: cancelacion y salida de estados | ✅ | Smoke 22 y 24: comprador y vendedor cancelan antes del comprobante; despues de enviarlo solo el vendedor cancela; usuario ajeno `403`; stock intacto |
| Transferencia, recorrido completo en navegador | ✅ | Smoke 18: Chromium real, catálogo → carrito → checkout → transferencia → comprobante; muestra el numero de orden y explica usarlo como concepto |

## 2. Categorías del catálogo

| Categoría | Estado |
|-----------|--------|
| Insumos y Materia Prima | ✅ Semillas, Fertilizantes y Agroquímicos con productos |
| Bienes y Ganado | ✅ Categoría sembrada con dos productos, cada uno con localidad |
| Maquinaria y Servicios | ✅ Maquinaria, Herramientas y Laboreo con productos |
| Tecnología para el Cultivo | ✅ Categoría sembrada con dos productos, cada uno con localidad |
| Módulo de Logística Integrada | ⚪ Existe la categoría de servicio Transporte y Logística. El directorio de transportistas no está construido |

## 4. Tecnologías

| Requisito | Estado | Evidencia |
|-----------|--------|-----------|
| React / Next.js | ✅ | React 18 + Vite, `npm run build` en 2,05 s, 78 módulos |
| Python FastAPI / Django o Node | ✅ | FastAPI operativo, `/api/health` `200` |
| **PostgreSQL + PostGIS** | ✅ | PostGIS 3.4.3 sobre PostgreSQL 16, 16 tablas. **PostGIS en uso real**: `Geography(POINT,4326)` con índice GIST; `ST_Distance` Balcarce–Tandil = 96,75 km, contrastado de forma independiente contra 96,67 km por haversine |
| Responsive móvil y escritorio | ⚪ | **Relevado el 2026-07-26** con `scripts/mobile-audit.mjs`: 36 pantallas en 360×800, 390×844 y 768×1024. **Cero desbordes horizontales, cero errores de consola, cero respuestas 4xx/5xx.** Nada impide completar los recorridos. Quedan pendientes de corregir, al final: controles táctiles por debajo de 44 px y barras de pestañas que requieren desplazamiento horizontal |
| AWS / Supabase / Render | ⚪ | Railway aprobado y preparado, sin despliegue real ni verificación de producción |

## 5. Cierre y entrega

| Requisito | Estado |
|-----------|--------|
| Pruebas integrales | ✅ Suite de 25 casos ejecutada desde base limpia el 2026-08-05; misma suite, runner nativo por falta de Docker. Los casos 22–25 tienen rojo previo. Pendiente repetir por el camino oficial antes del lanzamiento |
| Carga inicial de datos | ✅ Seed idempotente con 30 publicaciones en 12 categorías y 9 provincias, más 4.028 localidades. Verificado corriéndolo dos veces sin duplicar |
| Despliegue en producción | ❌ |
| Capacitación del panel de administración | ❌ |
| Documentación técnica del despliegue | ⚪ `README.md` y `README_LOCAL_SETUP.md` corregidos al stack real. `PROJECT_STATUS.md` sigue con ocho afirmaciones verificadas como falsas |
| Garantía de 90 días | No aplica hasta el lanzamiento |

---

## Lectura

**Lo verificado es el recorrido de compra completo** más el stack
tecnológico contractual, incluida la base de datos con PostGIS.

**Lo que falta es el diferencial**: geolocalización, logística y
transferencia bancaria. Son bloques enteros en cero, y son los que el
contrato usa para definir el producto.

Dos observaciones que el porcentaje no muestra:

1. El frontend no tiene llamadas huérfanas. Los 23 endpoints que invoca
   existen en el backend. El riesgo de desajuste frontend/backend, que
   era el mayor pendiente, está descartado.
2. **La UI se recorrió el 2026-07-25.** Encontró la publicación rota, ya
   arreglada y verificada. El resto del recorrido funciona: registro, login con tres roles, catálogo
   con filtros combinados, detalle, carrito, checkout hasta el botón de
   pago, dashboard de vendedor y las cuatro vistas de admin.

## Bugs abiertos, detectados en el recorrido de UI

| Bug | Severidad | Estado |
|-----|-----------|--------|
| Publicación rota: `TypeError` al elegir categoría, desmonta la app | **Bloqueante.** Requisito contractual 3.1 | ✅ Resuelto. `form_options` se fusiona con el estado inicial; probado con la tabla vacía |
| Sin error boundary: cualquier error de JS deja pantalla en blanco | Alta para demos | ✅ Resuelto |
| `form_options` sin datos | Alta | ✅ Seed idempotente de 18 opciones. Provincias salen de `localities` |
| Categorías hardcodeadas como fallback | Media | ✅ **Estaba activo** mientras cargaba la API y ofrecía categorías inexistentes. Eliminado; la API es la única fuente |
| Contador de ventas del vendedor en 0 con ventas reales | Baja, cosmética | ✅ Resuelto. Se calcula contando órdenes reales; verificada la cadena hasta la interfaz |
| Carrito persiste al cambiar de usuario | Baja, cosmética | ✅ Resuelto y verificado en navegador con Playwright |
| Imágenes rotas mostraban el ícono del navegador | Alta para la demo | ✅ Resuelto **en toda la interfaz** el 2026-07-26. Extraído a un `ProductImage` único: queda una sola etiqueta `<img>` en `src/`, con `onError`. Smoke 20 intercepta `picsum.photos`, fuerza `404` y verifica el reemplazo en detalle, carrito, checkout, panel de vendedor y administración |
| **Modo oscuro inalcanzable** | Media | **Abierto, sin acción.** `toggleTheme` y `useTheme` no los usa ningún componente. Existe el contexto y los estilos, pero no hay forma de activarlo. No es contractual |
| Vite se corre de puerto y el backend lo rechaza por CORS | Media | Abierto. Arreglo propuesto: fijar el puerto con `--strictPort` |
| Subida de imágenes fallaba en silencio | Media | ✅ Resuelto. Verifica `response.ok`, muestra el motivo y avisa que la publicación salió sin la imagen. **Con caso permanente en la suite** que fuerza el error |
