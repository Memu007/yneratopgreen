# Estado del Proyecto — TopGreen / AgroMarket Fase I

**Fecha de entrega**: 2026-06-04
**Versión**: 1.0.1
**Branch base**: `restore-phase1-clean` (HEAD `13e79741`)
**Último deploy del equipo anterior**: producción en `topgreen.com.ar`
con bundle `index-aAXJQ_6o.js` (1.0.1).

---

## TL;DR

El sistema **funciona end-to-end** para los flujos core de Fase I (registro,
login, catálogo, carrito, checkout, admin) y tiene **Mercado Pago Split
Payments** implementado pero entregado **desvinculado** por seguridad.

Hay **módulos de Fase II parcialmente integrados** (ratings, services,
subcategorías) que el equipo anterior comenzó a desarrollar y dejó en
distintos grados de completitud. **No se pueden apagar con un feature flag**
porque están entrelazados en migraciones, modelos y UI. El nuevo equipo
debe decidir si los completa, los oculta del frontend, o los remueve.

---

## ✅ Fase I — completo y funcional

### Autenticación
- [x] Registro de usuarios (email + password + nombre + teléfono).
- [x] Login con JWT (24h por default).
- [x] `GET /auth/me` y edición de perfil.
- [x] Cambio de password.
- [x] Roles: `admin`, `user` (vendedor / cliente unificados).

### Catálogo
- [x] Categorías base (Semillas, Fertilizantes, Maquinaria, etc.).
- [x] CRUD completo de productos por vendedor.
- [x] Subida de imágenes a filesystem local (`/data/uploads`).
- [x] Listado con filtros: categoría, búsqueda, rango precio.
- [x] Detalle de producto con carrusel de imágenes.

### Carrito y órdenes
- [x] Agregar / actualizar / quitar items.
- [x] Persistencia del carrito por usuario.
- [x] Crear orden desde carrito.
- [x] Listado de órdenes como comprador y como vendedor.
- [x] Estados de orden (`pending`, `paid`, `shipped`, `delivered`, `cancelled`).

### Pagos (Mercado Pago Split)
- [x] Código completo: preferences, OAuth de vendedores, webhook, sync.
- [x] Comisión 5% configurable (`MP_COMMISSION_PERCENT`).
- [x] Pantalla de éxito / pendiente / error en frontend.
- [x] Reembolsos (estructura preparada).
- [⚠️] **Entregado desvinculado**. Ver [SETUP_PAYMENTS.md](SETUP_PAYMENTS.md).

### Admin Panel
- [x] Listado y gestión de usuarios.
- [x] Listado de productos (todos los vendedores).
- [x] Listado de órdenes (todas).
- [x] CRUD de categorías.
- [x] Stats básicas.

### UX
- [x] Diseño responsive (testeado en desktop y mobile real).
- [x] Modo oscuro / claro (ThemeContext).
- [x] Notificaciones toast.
- [x] Header con búsqueda + carrito + usuario.

---

## 🟡 Fase II — parcial (integrado pero no terminado)

### Sistema de Ratings (vendedores)
- [x] Tabla `ratings` (migración 010).
- [x] API `/api/ratings/*` con 4 endpoints.
- [x] Modal de calificación en `UserDashboard`.
- [x] Filtro `min_rating` en `FilterSidebar`.
- [x] `SellerProfileModal` muestra avg + count.
- [⚠️] **No validado a escala**. Ningún test automático.
- [⚠️] **No hay feature flag** para desactivar la UI.
- **Recomendación**: completar testing o ocultar el filtro y el modal del frontend si no se quiere exponer aún.

### Tipos de publicación: producto vs servicio
- [x] Campo `publication_type` en `products` (migración 004).
- [x] Campos extra: `pricing_type`, `availability`, `response_time`,
  `experience_years`, `has_equipment`, `coverage_zones`.
- [x] `UserDashboard` discrimina visualmente productos y servicios.
- [⚠️] **Página `ServicesPage` es estática** — describe servicios de
  TopGreen como empresa, no es un marketplace de servicios real.
- [⚠️] El form de publicación (`AddProductModal`) tiene campos para
  servicios pero no todos están conectados a la API.
- **Recomendación**: definir si Fase II contempla servicios; en ese caso,
  completar el flujo (publicación → búsqueda → contratación → pago).

### Subcategorías dinámicas
- [x] Tabla `subcategories` (migración 006).
- [x] FK `product.subcategory_id` (migración 009).
- [x] Endpoint `GET /catalog/subcategories`.
- [⚠️] El admin **no expone CRUD completo** de subcategorías.
- [⚠️] Datos de seed no las cargan.
- **Recomendación**: completar admin de subcategorías o dejarlas como
  campo libre.

### Form options dinámicos
- [x] Tabla `form_options` (migración 007).
- [x] Endpoint `GET /catalog/form-options`.
- [⚠️] **Frontend no las usa**. El form de publicación tiene listas hardcoded.
- **Recomendación**: si se quiere forms dinámicos por subcategoría, conectar
  el frontend. Si no, eliminar la tabla en una migración futura.

### Filtros geográficos
- [x] Migración 011 agrega `lat`, `lng` y un índice geo.
- [⚠️] Frontend **no expone búsqueda por proximidad**.
- [⚠️] Productos demo no tienen coordenadas pobladas.
- **Recomendación**: implementar autocomplete de ubicación + búsqueda por radio si se quiere usar.

---

## ❌ NO incluido (fuera de alcance Fase I)

- Almacenamiento externo de imágenes (S3 / Cloudinary). Solo filesystem
  local en `/data/uploads`. **No usar en producción**.
- Búsqueda full-text avanzada. La búsqueda actual es `LIKE %term%`.
- Email transaccional (registro, cambio de password, notificaciones de
  orden). Solo se envían notificaciones in-app.
- Recovery de password (forgot password / reset).
- Tests E2E con navegador.
- Tests unitarios mínimos en backend (carpeta `backend/tests/` con muy
  pocos tests).
- CI/CD pipelines.
- Telemetría / monitoring (no hay Sentry, Datadog ni equivalente).
- Sistema de mensajería entre comprador y vendedor.
- Reviews de productos (solo ratings de vendedores).
- Wishlist / favoritos.
- Cupones / descuentos.
- Multi-currency. Solo ARS.
- Multi-language. Solo español (Argentina).

---

## Bugs conocidos

Ver [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

---

## Versionado en archivos

- `package.json` → `"version": "1.0.1"`
- Backend `settings.VERSION` → `"1.0.0"` (no se actualizó al subir el frontend a 1.0.1; trivial de sincronizar).
