# Configuración de Mercado Pago (Split Payments)

> **Estado:** La integración de Mercado Pago se entrega **desvinculada**.
> Este documento es para el nuevo equipo técnico que reactivará los pagos.

---

## 1. Estado actual

- Todas las variables `MP_*` se entregan **vacías** en los archivos `.env*`.
- El SDK del marketplace se inicializa **lazy** (`_get_marketplace_sdk()` en
  [`backend/app/api/payments.py`](../backend/app/api/payments.py)). Mientras
  no haya `MP_ACCESS_TOKEN`:
  - `POST /api/payments/create-preference` responde **HTTP 503** con mensaje
    `"La integración con Mercado Pago no está configurada..."`.
  - `POST /api/payments/sync-status/{order_id}` responde **HTTP 503** igual.
  - `POST /api/payments/webhook` responde **HTTP 200** con
    `{"status": "ignored", "reason": "mp_not_configured"}` para evitar
    tormentas de reintentos desde Mercado Pago.
  - `GET /api/payments/public-key` responde
    `{"public_key": "", "configured": false}` sin lanzar excepción.
  - `GET /api/mp-oauth/auth-url` y `POST /api/mp-oauth/refresh-token`
    responden **HTTP 503** si falta `MP_APP_ID` o `MP_CLIENT_SECRET`.
  - `GET /api/mp-oauth/callback` redirige al dashboard con
    `?mp_error=mp_not_configured` si llega una autorización sin credenciales.
- El frontend detecta los 503 y muestra:
  - En el checkout ([`CheckoutModal.tsx`](../src/components/Checkout/CheckoutModal.tsx)):
    banner "La integración de pago no está configurada... Tu pedido quedó
    registrado como pendiente."
  - En el dashboard ([`UserDashboard.tsx`](../src/components/UserDashboard/UserDashboard.tsx)):
    sección Mercado Pago muestra "Integración de Mercado Pago desvinculada"
    en lugar del botón de vinculación.
- El resto del backend (catálogo, órdenes, autenticación, carrito) funciona
  normalmente con MP desactivado.

---

## 2. Variables a configurar

Editar `backend/.env` (no commitearlo: ya está en `.gitignore`):

| Variable | Descripción | Dónde se obtiene |
|----------|-------------|------------------|
| `MP_APP_ID` | ID numérico de la aplicación | Panel MP → Tus aplicaciones |
| `MP_CLIENT_SECRET` | Secret OAuth de la aplicación | Panel MP → Credenciales |
| `MP_PUBLIC_KEY` | Public key (frontend, JS Checkout) | Panel MP → Credenciales |
| `MP_ACCESS_TOKEN` | Access token del marketplace | Panel MP → Credenciales |
| `MP_REDIRECT_URI` | URL pública del callback OAuth | Debe ser registrada en MP |
| `MP_COMMISSION_PERCENT` | Comisión del marketplace (%) | Valor de negocio (sugerido: `5.0`) |
| `NGROK_URL` | URL pública del backend (para webhook) | Túnel ngrok / dominio público |
| `FRONTEND_URL` | URL pública del frontend | Donde corre el SPA en producción |

Plantillas vacías:
- [`backend/.env.example`](../backend/.env.example) — desarrollo local
- [`backend/.env.production.example`](../backend/.env.production.example) — producción

---

## 3. Cómo reactivar Mercado Pago

1. Crear (o reutilizar) una aplicación en el
   [panel de desarrolladores de Mercado Pago](https://www.mercadopago.com.ar/developers/panel/app).
2. Copiar las credenciales de **producción** (no las de prueba) y completarlas
   en `backend/.env`. Ejemplo:
   ```dotenv
   MP_APP_ID=1234567890
   MP_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   MP_PUBLIC_KEY=APP_USR-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   MP_ACCESS_TOKEN=APP_USR-xxxxxxxxxxxxxxxx-xxxxxx-xxxxxxxxxxxxxxxx-xxxxxxxxx
   MP_REDIRECT_URI=https://tu-dominio.com/api/mp-oauth/callback
   MP_COMMISSION_PERCENT=5.0
   NGROK_URL=https://tu-dominio.com
   FRONTEND_URL=https://tu-dominio.com
   ```
3. Registrar el `MP_REDIRECT_URI` en el panel MP de la app
   (Configuración → Redirect URIs).
4. Registrar el webhook (`https://tu-dominio.com/api/payments/webhook`)
   en el panel MP (Notificaciones webhook → Eventos: `payment`).
5. Reiniciar el contenedor del backend:
   ```powershell
   docker compose restart topgreen-api
   ```
6. Validar:
   - `GET /api/payments/public-key` debe devolver `configured: true`.
   - El dashboard de un vendedor debe mostrar el botón "Vincular Mercado Pago"
     en lugar del banner de desvinculación.

---

## 4. Archivos clave

| Archivo | Rol |
|---------|-----|
| [`backend/app/core/config.py`](../backend/app/core/config.py) | Lee todas las variables `MP_*` desde el entorno |
| [`backend/app/api/payments.py`](../backend/app/api/payments.py) | Crea preferencias, procesa webhook, sincroniza estado |
| [`backend/app/api/mp_oauth.py`](../backend/app/api/mp_oauth.py) | OAuth de vendedores (link / unlink / refresh) |
| [`src/components/Checkout/CheckoutModal.tsx`](../src/components/Checkout/CheckoutModal.tsx) | Flujo de checkout del comprador |
| [`src/components/UserDashboard/UserDashboard.tsx`](../src/components/UserDashboard/UserDashboard.tsx) | Sección MP del vendedor |

---

## 5. Pruebas mínimas tras reactivar

1. **Vendedor** entra al dashboard → ve botón "Vincular Mercado Pago" → completa
   OAuth → vuelve al dashboard con cuenta vinculada.
2. **Comprador** agrega productos al carrito → checkout con método "Mercado
   Pago" → es redirigido al `init_point` de MP → completa el pago de prueba.
3. Webhook recibe la notificación → la orden cambia a estado `paid`.
4. `POST /api/payments/sync-status/{order_id}` permite sincronizar
   manualmente si el webhook no llega.

---

## 6. Recordatorio de seguridad (IMPORTANTE)

> Las credenciales reales de Mercado Pago, el authtoken de ngrok, el password
> de la base de datos y el `JWT_SECRET` **estuvieron commiteados en versiones
> anteriores de la historia de Git** de este repositorio (por ejemplo, en
> archivos `backend/.env`, `backend/.env.prod`, `backend/.env.production` y
> `backend/.env.production.example`). Antes de poner el sistema en producción,
> el nuevo equipo **debe rotar obligatoriamente**:
>
> - `MP_ACCESS_TOKEN`, `MP_CLIENT_SECRET` y `MP_PUBLIC_KEY` (panel Mercado Pago).
> - `NGROK_AUTHTOKEN` (dashboard de ngrok).
> - Password de SQL Server (`DB_PASSWORD` en `.env`).
> - `JWT_SECRET` y las credenciales `SMTP_*` del backend.
>
> Hasta que esa rotación ocurra, los secretos viejos siguen siendo válidos
> aunque ya no figuren en el árbol de archivos.
