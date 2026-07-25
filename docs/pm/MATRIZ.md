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
| Buscador con filtro por **ubicación** | ❌ | No hay coordenadas ni localidad en ninguna tabla |
| Carrito de compras | ✅ | Smoke test: agregar y ver, `200` + `200`, total $45.000 |
| Historial de pedidos | ✅ | Smoke test "mis compras": `200`, 3 compras |

## 3.1 Rol Vendedor

| Requisito | Estado | Evidencia |
|-----------|--------|-----------|
| Registro con validación | ❌ | Igual que comprador |
| Panel de control básico | ⚪ | Carga perfil, ventas y productos en UI. El contador de ventas muestra 0 con 2 ventas reales |
| Publicación desde la UI | ❌ | **Rota.** Al elegir categoría, `TypeError` en `AddProductModal` y la aplicación se desmonta completa |
| Publicación por API | ✅ | Smoke test: `POST /products` `200` |
| Publicación con **ubicación** | ❌ | Provincia y ciudad en texto libre, sin estructura |
| Gestión de stock | ✅ | Filtro de stock aplicado en catálogo, verificado en UI |
| Gestión de ventas recibidas | ✅ | "Mis Ventas" lista 2 pedidos en UI |

**Causa raíz de la publicación rota:** `/catalog/form-options` arma la
respuesta dinámicamente y omite la clave de todo tipo de opción sin filas
activas. El frontend hace `setFormOptions(data)`, que reemplaza el estado
entero, así que las claves ausentes quedan `undefined` y revientan en
`.length`. La tabla `form_options` está vacía o incompleta.

Nunca funcionó para nadie. La verificación por API no lo detectó porque el
endpoint responde `200` con un objeto incompleto.

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
| Insumos y Materia Prima | ⚪ Categorías base sembradas, 8 productos demo |
| Bienes y Ganado | ❌ |
| Maquinaria y Servicios | ⚪ Campos de servicio existen y llegan a la API |
| Tecnología para el Cultivo | ❌ |
| Módulo de Logística Integrada | ❌ |

## 4. Tecnologías

| Requisito | Estado | Evidencia |
|-----------|--------|-----------|
| React / Next.js | ✅ | React 18 + Vite, `npm run build` en 2,05 s, 78 módulos |
| Python FastAPI / Django o Node | ✅ | FastAPI operativo, `/api/health` `200` |
| **PostgreSQL + PostGIS** | ✅ | PostGIS 3.4.3 sobre PostgreSQL 16, migración aplicada, 15 tablas |
| Responsive móvil y escritorio | 🟡 | Está construido; sin verificar en dispositivos |
| AWS / Supabase / Render | ❌ | Sin despliegue propio |

## 5. Cierre y entrega

| Requisito | Estado |
|-----------|--------|
| Pruebas integrales | ❌ Diez smoke tests manuales; sin suite automática |
| Carga inicial de datos | ⚪ Seed repetible con 8 productos demo |
| Despliegue en producción | ❌ |
| Capacitación del panel de administración | ❌ |
| Documentación técnica del despliegue | ⚪ Existe, con siete afirmaciones verificadas como falsas |
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
2. **La UI se recorrió el 2026-07-25 y encontró publicación rota.** El
   resto del recorrido funciona: registro, login con tres roles, catálogo
   con filtros combinados, detalle, carrito, checkout hasta el botón de
   pago, dashboard de vendedor y las cuatro vistas de admin.

## Bugs abiertos, detectados en el recorrido de UI

| Bug | Severidad | Estado |
|-----|-----------|--------|
| Publicación rota: `TypeError` al elegir categoría, desmonta la app | **Bloqueante.** Requisito contractual 3.1 | Arreglo aprobado |
| Sin error boundary: cualquier error de JS deja pantalla en blanco | Alta para demos | Arreglo aprobado |
| `form_options` sin datos, formularios sin opciones | Alta | Se siembra, menos provincias |
| Categorías hardcodeadas como fallback, desalineadas con la base | Media, latente | A verificar si está activo |
| Contador de ventas del vendedor en 0 con 2 ventas reales | Baja, cosmética | Registrado, sin acción |
| Badge del carrito persiste al cambiar de rol | Baja, cosmética | Registrado, sin acción |
