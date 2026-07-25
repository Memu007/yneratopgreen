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
| Panel de control básico | 🟡 | `UserDashboard` existe; verificado a nivel API, no de UI |
| Publicación con imágenes, descripción y precio | ✅ | Smoke test: publicar como vendedor, `200` |
| Publicación con **ubicación** | ❌ | No hay campo de localidad estructurado |
| Gestión de stock | ✅ | Filtro de stock aplicado en catálogo |
| Gestión de ventas recibidas | ✅ | Smoke test "mis ventas": `200`, 2 ventas |

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
2. Nadie recorrió la UI todavía. Todo lo verificado es a nivel HTTP. Es
   la última brecha de verificación y es barata de cerrar.
