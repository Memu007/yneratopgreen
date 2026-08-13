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

El carrito se resuelve por **grupos de vendedor**: un carrito con dos
vendedores es una orden por vendedor, y cada orden se paga por separado.

| Método | Path | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/orders/payment-options` | JWT | Por grupo del carrito: importe, medios disponibles (`transfer`, `mercadopago`) y datos bancarios si corresponde. |
| POST | `/orders/checkout` | JWT | Crea **una orden por vendedor**. Exige una decisión de traslado y una de pago por grupo. Devuelve `{orders: [...]}`. |
| POST | `/orders/checkout/transfer` | JWT | Lo mismo, con el medio puesto en transferencia. Misma respuesta. |
| POST | `/orders/{id}/payment-link` | JWT (buyer) | Deja lista —o vuelve a devolver— la preferencia de una orden de Mercado Pago. Idempotente. |
| POST | `/orders/{id}/transfer-receipt` | JWT (buyer) | Adjuntar comprobante de transferencia. |
| PATCH | `/orders/{id}/transfer-receipt` | JWT (seller) | Aprobar o rechazar el comprobante. |
| GET | `/orders/my` | JWT | Mis órdenes, como comprador y como vendedor. |
| GET | `/orders/{id}` | JWT (buyer/seller/admin) | Detalle de orden. |
| PATCH | `/orders/{id}/status` | JWT (seller/admin) | Actualizar estado. |
| POST | `/orders/{id}/cancel` | JWT (buyer/seller) | Cancelar. No devuelve dinero: TopGreen no lo administra. |

---

## Pagos

**No hay `/api/payments`.** El módulo heredado de cobro no existe más: escribía
en columnas que ya no están y reembolsaba con el token del marketplace, que es
plata de terceros. Lo que hay hoy del cobro por Mercado Pago es
`POST /orders/{id}/payment-link`, que pide una preferencia de Checkout Pro **a
nombre del vendedor**, y sólo si `MP_CHECKOUT_HABILITADO` está encendido.

El webhook, la consulta de estado y la política de stock son de la pieza
siguiente. Sin ellos, ningún pago se confirma: la orden queda «pendiente de
confirmación» y volver de Mercado Pago en el navegador no cambia nada.

---

## OAuth Mercado Pago (vendedores) — `/api/mp-oauth`

| Método | Path | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/mp-oauth/status` | JWT | Estado del vínculo: `no_configurado`, `desconectado`, `conectado` o `requiere_reconexion`. Nunca devuelve credenciales. |
| POST | `/mp-oauth/auth-url` | JWT | URL para iniciar OAuth con MP. Emite un `state` de un solo uso. |
| GET | `/mp-oauth/callback` | — | Callback de MP tras autorización. |
| POST | `/mp-oauth/refresh` | JWT | Renovar la credencial del vendedor. |
| POST | `/mp-oauth/unlink` | JWT | Desvincular la cuenta MP del vendedor. |

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
