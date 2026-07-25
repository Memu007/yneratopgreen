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
| …con validación | ❌ | Campo `is_verified` en el modelo, sin flujo de validación |
| Perfil | ✅ | `GET /auth/me` y `PATCH /auth/me` responden `200` |
| Buscador con filtro por **categoría** | ✅ | Smoke test `200`, filtros de categoría, precio y stock aplicados |
| Buscador con filtro por **ubicación** | ⚪ | Backend listo y verificado: `province` y `locality_id` en `GET /catalog/products`, contrastado contra SQL. Falta exponerlo en la interfaz |
| Carrito de compras | ✅ | Smoke test: agregar y ver, `200` + `200`, total $45.000 |
| Historial de pedidos | ✅ | Smoke test "mis compras": `200`, 3 compras |

## 3.1 Rol Vendedor

| Requisito | Estado | Evidencia |
|-----------|--------|-----------|
| Registro con validación | ❌ | Igual que comprador |
| Panel de control básico | ✅ | Carga perfil, ventas y productos en UI, con el contador de ventas ya corregido |
| Publicación desde la UI | ✅ | Producto completo publicado con imagen, sin errores de consola, visible en catálogo |
| Publicación con **ubicación** | ✅ | `locality_id` obligatorio contra el padrón oficial. Verificado: Balcarce `06063010` guardado en base |
| Gestión de stock | ✅ | Filtro de stock aplicado en catálogo, verificado en UI |
| Gestión de ventas recibidas | ✅ | "Mis Ventas" lista 2 pedidos en UI |

## 3.2 Módulo de Logística

| Requisito | Estado | Evidencia |
|-----------|--------|-----------|
| Transportista como tipo especial de proveedor | ❌ | No existe el tipo ni la entidad |
| Declara ubicación base | ❌ | — |
| Declara transporte habilitado certificado | ❌ | — |
| Declara zona de cobertura en km | ❌ | — |
| Declara capacidad de carga | ❌ | — |
| Sistema detecta ubicación de comprador y vendedor | ❌ | — |
| Lista transportistas compatibles en la zona | ❌ | — |
| Seleccionar e incluir en la transacción | ❌ | — |
| Contactar directo con los datos provistos | ❌ | — |

**Fase contractual 3. Es el diferencial del producto y está en cero.**

## 3.3 Pagos

| Requisito | Estado | Evidencia |
|-----------|--------|-----------|
| Mercado Pago, checkout básico | 🟡 | Código completo y de más (split + OAuth). Sin credenciales, no verificable |
| Transferencia: mostrar CBU/Alias del vendedor | ❌ | Sólo texto de UI mencionando transferencias |
| Transferencia: adjuntar comprobante | ❌ | — |
| Transferencia: validación manual del vendedor | ❌ | — |

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
| Responsive móvil y escritorio | 🟡 | Está construido; sin verificar en dispositivos reales |
| AWS / Supabase / Render | ❌ | Sin despliegue propio |

## 5. Cierre y entrega

| Requisito | Estado |
|-----------|--------|
| Pruebas integrales | ❌ Diez smoke tests manuales; sin suite automática |
| Carga inicial de datos | ⚪ Seed repetible con 12 productos demo y 4.028 localidades |
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
| Imágenes rotas mostraban el ícono del navegador | Alta para la demo | ✅ Resuelto. Respaldo con el nombre del producto, verificado en claro y oscuro |
| **Modo oscuro inalcanzable** | Media | **Abierto, sin acción.** `toggleTheme` y `useTheme` no los usa ningún componente. Existe el contexto y los estilos, pero no hay forma de activarlo. No es contractual |
| Vite se corre de puerto y el backend lo rechaza por CORS | Media | Arreglo asignado: fijar el puerto con `--strictPort` |
