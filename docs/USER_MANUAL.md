# Manual de usuario — TopGreen / AgroMarket

Manual operativo para los tres roles del sistema: **comprador**, **vendedor**
y **administrador**.

---

## Acceso

URL local de desarrollo: **http://localhost:5173**

### Cuentas demo (creadas por el seed)

| Rol | Email | Password |
|-----|-------|----------|
| Administrador | `admin@topgreen.com` | `admin123` |
| Vendedor | `vendedor@ejemplo.com` | `vendedor123` |
| Cliente | `cliente@ejemplo.com` | `cliente123` |

> **Cambiar antes de cualquier deploy productivo.**

---

## Rol: Comprador (cliente)

### Registrarse

1. Click en **"Iniciar sesión"** en la esquina superior derecha del header.
2. Click en pestaña **"Registrarme"**.
3. Completar email, password (≥ 6 chars), nombre y teléfono.
4. Submit. El sistema loguea automáticamente al usuario.

### Buscar productos

1. **Por categoría**: scroll en la home → click en categoría destacada (si está mostrada).
2. **Por filtro**: en AgroMarket (link "Comprar" del header) → sidebar izquierdo:
   - Categoría
   - Rango de precio (slider)
   - Calificación mínima (estrellas)
   - Búsqueda por texto (en el header).
3. **Por vendedor**: click en el nombre del vendedor en cualquier producto.

### Agregar al carrito y comprar

1. Click en producto → **"Agregar al carrito"**.
2. Icono carrito en el header → revisar items.
3. **"Iniciar checkout"**.
4. Completar dirección de envío.
5. Elegir método de pago: **"Mercado Pago"**.
6. Click en **"Pagar"**.
   - Si MP está configurado: redirige al checkout de MP.
   - Si MP no está configurado: ve un banner "La integración de pago no está configurada... Tu pedido quedó registrado como pendiente."
7. Tras el pago, redirige a `/payment/success`.

### Mis órdenes

1. Click en avatar del header → **"Mi panel"**.
2. Pestaña **"Mis compras"**: lista de órdenes con estado.
3. Pestaña **"Por entregar"**: órdenes con estado `paid` esperando envío.
4. Tras recibir, podés calificar al vendedor (1-5 estrellas + comentario).

---

## Rol: Vendedor

> En TopGreen, **todo usuario `user` puede vender**. No hay un rol separado;
> simplemente publicás un producto.

### Vincular cuenta de Mercado Pago

> Solo necesario si el sistema tiene MP configurado. Si no, los pagos de tus
> productos quedan en estado pendiente y necesitás un cobro manual offline.

1. Login como vendedor.
2. Avatar → **"Mi panel"** → tab **"Mercado Pago"**.
3. Click **"Vincular Mercado Pago"**.
4. Sos redirigido al OAuth de MP. Autorizás la app.
5. Volvés al dashboard con la cuenta vinculada.

### Publicar un producto

1. Avatar → **"Mi panel"** → tab **"Mis publicaciones"**.
2. Click **"+ Publicar producto"**.
3. Completar:
   - Nombre, descripción, precio.
   - Categoría (obligatoria) y subcategoría (opcional).
   - Stock disponible.
   - Imágenes (al menos 1).
   - Ubicación (texto libre por ahora).
4. Submit.

### Editar / pausar / eliminar

1. Tab **"Mis publicaciones"**: lista de tus productos.
2. Botón ⋮ junto a cada uno: **Editar**, **Pausar**, **Eliminar**.

### Gestionar ventas

1. Tab **"Mis ventas"**: órdenes donde sos el vendedor.
2. Estados:
   - `pending`: pago en proceso.
   - `paid`: el comprador pagó. Marcá como **enviado** cuando despaches.
   - `shipped`: en camino.
   - `delivered`: el comprador confirmó recepción.

---

## Rol: Administrador

### Acceso al panel

1. Login con `admin@topgreen.com` / `admin123`.
2. El header muestra link **"Admin"**. Click.

### Dashboard de stats

- Conteo de usuarios, productos, órdenes activas.
- Stats simples por categoría.

### Gestión de usuarios

1. Tab **"Usuarios"**.
2. Acciones por usuario:
   - Cambiar rol (admin / user).
   - Activar / desactivar.
   - Ver perfil completo.

### Gestión de productos

1. Tab **"Productos"**.
2. Vista global de **todos** los productos de **todos** los vendedores.
3. Filtros por estado, categoría, vendedor.
4. Acciones:
   - Ver detalle.
   - Despublicar (forzar pause).
   - Eliminar (en caso de violación de TOS).

### Gestión de órdenes

1. Tab **"Órdenes"**.
2. Vista global de órdenes.
3. Filtros por estado, fecha, comprador, vendedor.
4. Acciones:
   - Ver detalle (items, montos, payment status).
   - Sincronizar pago manualmente (`POST /api/payments/sync-status/{order_id}`).
   - Cancelar orden (en casos especiales).

### Gestión de categorías

1. Tab **"Categorías"**.
2. CRUD completo:
   - Crear nueva categoría con nombre, slug, descripción, icono.
   - Editar.
   - Eliminar (solo si no tiene productos asociados).

---

## Flujo de prueba end-to-end

Para validar que el sistema funciona tras levantar el entorno:

1. Login como `admin` → verificar que aparece el panel admin con stats.
2. Logout.
3. Login como `vendedor@ejemplo.com` → publicar un producto nuevo
   ("Test producto", $1000, categoría Semillas).
4. Logout.
5. Login como `cliente@ejemplo.com` → buscar "Test producto" → agregar al
   carrito → checkout.
   - Si MP está configurado: completar el pago en sandbox.
   - Si no: confirmar que aparece el banner de "pendiente".
6. Logout. Login como vendedor → ver la orden en "Mis ventas".
7. Marcarla como "enviada".
8. Logout. Login como cliente → ver la orden en "Mis compras" → marcarla
   como recibida → calificar al vendedor.

Si todos los pasos completan sin error, el sistema está operativo.

---

## Atajos útiles

| Acción | Cómo |
|--------|------|
| Cambiar tema (oscuro/claro) | Botón ☀/🌙 en el header |
| Ver notificaciones | Campana en el header (cuando hay) |
| Volver al inicio | Click en el logo |
| Cerrar sesión | Avatar → "Cerrar sesión" |
