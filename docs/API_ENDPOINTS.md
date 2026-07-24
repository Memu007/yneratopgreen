# API Endpoints — TopGreen Backend

> **Fuente canónica**: una vez levantado el backend, abrir
> **http://localhost:8000/api/docs** (Swagger UI) o
> **http://localhost:8000/api/redoc** (ReDoc). Estos docs se generan
> automáticamente desde los routers FastAPI y están siempre al día.
>
> Este documento es un resumen de orientación.

Prefijo común: `/api`

---

## Auth — `/api/auth`

| Método | Path | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Registro de usuario nuevo (email + password + nombre) |
| POST | `/auth/login` | — | Login. Retorna `{access_token, user}` |
| GET  | `/auth/me` | JWT | Datos del usuario actual |
| PUT  | `/auth/me` | JWT | Actualizar perfil (nombre, teléfono, bio, location) |
| POST | `/auth/change-password` | JWT | Cambio de password |

**Body login**:
```json
{ "email": "admin@topgreen.com", "password": "admin123" }
```

**Response login**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": { "id": 1, "email": "...", "role": "admin", ... }
}
```

---

## Catálogo — `/api/catalog`

| Método | Path | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/catalog/categories` | — | Listar categorías. Query: `?include_empty=true` para incluir categorías sin productos. |
| GET | `/catalog/categories/{slug}` | — | Detalle de categoría con subcategorías. |
| GET | `/catalog/subcategories` | — | Listar subcategorías (Fase II parcial). |
| GET | `/catalog/form-options` | — | Opciones para formularios dinámicos (Fase II parcial). |

---

## Productos — `/api/products`

| Método | Path | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/products` | — | Listado con filtros: `category_id`, `search`, `min_price`, `max_price`, `min_rating`, `seller_id`, `publication_type`, `page`, `page_size`. |
| GET | `/products/{id}` | — | Detalle de producto. |
| POST | `/products` | JWT | Crear producto (vendedor). Multipart con imágenes. |
| PUT | `/products/{id}` | JWT (owner) | Editar producto. |
| DELETE | `/products/{id}` | JWT (owner / admin) | Borrar producto. |
| POST | `/products/{id}/images` | JWT (owner) | Subir imagen extra. |
| DELETE | `/products/{id}/images/{img_id}` | JWT (owner) | Eliminar imagen. |

---

## Carrito — `/api/cart`

| Método | Path | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/cart` | JWT | Carrito del usuario actual. |
| POST | `/cart/items` | JWT | Agregar item: `{product_id, quantity}`. |
| PUT | `/cart/items/{item_id}` | JWT | Cambiar cantidad. |
| DELETE | `/cart/items/{item_id}` | JWT | Remover item. |
| DELETE | `/cart` | JWT | Vaciar carrito. |

---

## Órdenes — `/api/orders`

| Método | Path | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/orders` | JWT | Crear orden desde el carrito. Body: `{shipping_address, payment_method}`. |
| GET | `/orders/me` | JWT | Mis órdenes (como comprador). |
| GET | `/orders/me/sold` | JWT | Órdenes donde soy vendedor. |
| GET | `/orders/{id}` | JWT (buyer/seller/admin) | Detalle de orden. |
| PUT | `/orders/{id}/status` | JWT (seller/admin) | Actualizar estado (`shipped`, `delivered`, `cancelled`). |

---

## Pagos — `/api/payments`

| Método | Path | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/payments/public-key` | — | Devuelve `{public_key, configured}`. Si MP no está configurado, `configured=false`. |
| POST | `/payments/create-preference` | JWT | Crear preferencia MP para una orden. **HTTP 503** si MP no está configurado. |
| POST | `/payments/sync-status/{order_id}` | JWT | Sincronizar estado del pago manualmente. |
| POST | `/payments/webhook` | — (firma MP) | Webhook de notificaciones MP. |
| POST | `/payments/refund/{order_id}` | JWT (seller/admin) | Reembolso. |

---

## OAuth Mercado Pago (vendedores) — `/api/mp-oauth`

| Método | Path | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/mp-oauth/auth-url` | JWT | URL para iniciar OAuth con MP. |
| GET | `/mp-oauth/callback` | — | Callback de MP tras autorización. |
| POST | `/mp-oauth/refresh-token` | JWT | Refrescar token MP del vendedor. |
| DELETE | `/mp-oauth/unlink` | JWT | Desvincular cuenta MP del vendedor. |

---

## Ratings — `/api/ratings` *(Fase II parcial)*

| Método | Path | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/ratings/` | JWT | Crear rating. Body: `{order_id, score (1-5), comment}`. |
| GET | `/ratings/user/{user_id}` | — | Reputación del vendedor (avg + count). |
| GET | `/ratings/user/{user_id}/reviews` | — | Listar reseñas. |
| GET | `/ratings/order/{order_id}/can-rate` | JWT | Verifica si el comprador puede ratear. |

---

## Notificaciones — `/api/notifications`

| Método | Path | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/notifications` | JWT | Listar notificaciones del usuario. |
| PUT | `/notifications/{id}/read` | JWT | Marcar como leída. |
| PUT | `/notifications/read-all` | JWT | Marcar todas como leídas. |

---

## Contacto — `/api/contact`

| Método | Path | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/contact` | — | Enviar mensaje de contacto desde la home. |

---

## Admin — `/api/admin`

> Todos requieren JWT con `role=admin`.

| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/admin/users` | Listar usuarios. |
| PUT | `/admin/users/{id}/role` | Cambiar rol. |
| PUT | `/admin/users/{id}/active` | Activar/desactivar. |
| GET | `/admin/products` | Listar productos (todos los vendedores). |
| GET | `/admin/orders` | Listar órdenes (todas). |
| GET | `/admin/stats` | Estadísticas básicas (counts). |
| POST | `/admin/categories` | Crear categoría. |
| PUT | `/admin/categories/{id}` | Editar categoría. |
| DELETE | `/admin/categories/{id}` | Eliminar categoría (si está vacía). |

---

## Health

| Método | Path | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/health` | — | `{status: "ok", version, environment}` |

---

## Modelo de errores

Errores estándar FastAPI:
```json
{ "detail": "Mensaje legible" }
```

Códigos comunes:
- `400` — body inválido / regla de negocio violada
- `401` — sin token o token expirado
- `403` — sin permisos para ese recurso
- `404` — recurso no encontrado
- `409` — conflicto (ej. email ya registrado)
- `422` — validación Pydantic (formato de body)
- `503` — servicio externo no configurado (típicamente Mercado Pago)
