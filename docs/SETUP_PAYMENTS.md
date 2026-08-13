# Configuración de Mercado Pago

> **Estado:** el **vínculo** de la cuenta de cada vendedor está construido y
> funciona. El **cobro** está construido pero **apagado**: falta el webhook que
> confirme los pagos, así que encenderlo sería cobrar sin poder confirmar. Las
> credenciales de la aplicación se entregan vacías y el interruptor del cobro
> sale en `false`.

---

## 1. Qué hay y qué no

**Hay vínculo OAuth.** Un vendedor conecta su cuenta de Mercado Pago desde su
panel, ve su estado, la renueva y la desconecta. Vincular no mueve dinero.

**Hay cobro, apagado.** El checkout puede pedirle a Mercado Pago una
preferencia de Checkout Pro por cada orden, a nombre del vendedor y con su
credencial. Con `MP_CHECKOUT_HABILITADO=false` —el valor por defecto y el que
va a producción— ese medio no se ofrece, pedirlo a mano da 400 y no se crea
ninguna preferencia.

**No hay confirmación de pago.** No hay webhook, no hay consulta de estado a
Mercado Pago y no hay política de stock. Por eso el interruptor está apagado:
una orden por Mercado Pago queda «pendiente de confirmación» y nadie la mueve.
Volver del navegador desde Mercado Pago **no es evidencia de pago** y no cambia
ninguna orden.

El módulo heredado `backend/app/api/payments.py` **ya no existe**: escribía en
columnas que se eliminaron y reembolsaba con el token del marketplace, que es
dinero de terceros.

**Quién cobra.** El vendedor, en su propia cuenta. TopGreen no recibe, no
retiene y no reparte el dinero de una venta, y no cobra comisión de
marketplace. La comisión que se descuenta es la de Mercado Pago, que se le
descuenta al vendedor como en cualquier venta suya.

**Con las variables vacías** el panel del vendedor muestra «Cobro por Mercado
Pago no disponible» y el resto del marketplace funciona igual, incluida la
venta por transferencia. Eso está probado: caso 68 de la suite.

---

## 2. Variables a configurar

Editar `backend/.env` (no se commitea: ya está en `.gitignore`).

| Variable | Descripción | Dónde se obtiene |
|----------|-------------|------------------|
| `MP_APP_ID` | ID numérico de la aplicación | Panel MP → Tus aplicaciones |
| `MP_CLIENT_SECRET` | Secret OAuth de la aplicación | Panel MP → Credenciales |
| `MP_REDIRECT_URI` | URL pública del callback OAuth | Se registra en el panel MP |
| `MP_TOKEN_KEY` | Clave con la que se cifran las credenciales del vendedor | Se genera (ver abajo) |
| `FRONTEND_URL` | URL pública del frontend | Donde corre el SPA |

Las cuatro primeras y la clave tienen que estar **todas**: si falta una sola,
la integración se considera no configurada y no se vincula nada. Es a
propósito. Poder vincular sin poder cifrar sería peor que no poder vincular.

Dos más, del cobro:

| Variable | Descripción | Valor |
|----------|-------------|-------|
| `MP_CHECKOUT_HABILITADO` | Interruptor del cobro por Mercado Pago | `false` hasta que exista el webhook |
| `MP_NOTIFICACION_URL` | A dónde avisa Mercado Pago cuando cambia un pago | Vacía: todavía no hay quien atienda |

`MP_PUBLIC_KEY`, `MP_ACCESS_TOKEN` y `NGROK_URL` no las lee nadie. TopGreen no
cobra comisión por venta, así que no hay ninguna variable de comisión:
`marketplace_fee` no se manda, ni siquiera en cero.

### La clave de cifrado

Los tokens del vendedor son la llave con la que cobra en su cuenta. Se guardan
cifrados con Fernet y la clave vive **fuera del repositorio**:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Tres cosas que hay que saber antes de tocarla:

1. **No se versiona ni se comparte.** Va en el gestor de secretos del entorno.
2. **Rotarla invalida todos los vínculos**: lo guardado deja de abrir, cada
   vendedor pasa a «reconectar» y tiene que autorizar de nuevo. No es una
   catástrofe —el sistema lo maneja solo— pero es una molestia para todos a la
   vez, así que se avisa antes.
3. **Sin clave no se guarda nada en claro.** Se prefiere no vincular.

---

## 3. Cómo activar el vínculo

1. Crear (o reutilizar) una aplicación en el
   [panel de desarrolladores de Mercado Pago](https://www.mercadopago.com.ar/developers/panel/app).
2. Completar `backend/.env`:
   ```dotenv
   MP_APP_ID=1234567890
   MP_CLIENT_SECRET=<secret de la aplicación>
   MP_REDIRECT_URI=https://tu-dominio.com/api/mp-oauth/callback
   MP_TOKEN_KEY=<clave Fernet generada>
   FRONTEND_URL=https://tu-dominio.com
   ```
3. Registrar ese mismo `MP_REDIRECT_URI` en el panel MP
   (Configuración → Redirect URIs). Tiene que coincidir carácter por carácter.

   **Ojo con este valor.** El callback valida que la vuelta traiga la sesión
   del vendedor, así que tiene que apuntar a un host al que el navegador le
   mande la cookie de sesión. Si el frontend y la API comparten origen —como
   en desarrollo, a través del proxy—, usá ese origen. Si apunta a un host que
   no recibe la cookie, todos los intentos van a terminar en «se cerró tu
   sesión durante la conexión», que es correcto pero inútil.
4. Reiniciar el backend.
5. Validar: un vendedor entra a su panel y ve «Cuenta no vinculada» con el
   botón, en vez de «Cobro por Mercado Pago no disponible».

`MP_AUTH_BASE_URL` y `MP_API_BASE_URL` existen para que la prueba automatizada
pueda apuntar a un doble local. **En producción no se definen.**

---

## 4. Archivos clave

| Archivo | Rol |
|---------|-----|
| [`backend/app/services/mp_vinculo.py`](../backend/app/services/mp_vinculo.py) | La regla del vínculo: estado, validación del callback, guardado, renovación |
| [`backend/app/api/mp_oauth.py`](../backend/app/api/mp_oauth.py) | Las cinco rutas HTTP del vínculo |
| [`backend/app/core/cifrado.py`](../backend/app/core/cifrado.py) | Cifrado en reposo de credenciales de terceros |
| [`backend/app/models/mp_oauth_state.py`](../backend/app/models/mp_oauth_state.py) | El `state` de OAuth: con dueño, con vencimiento y de un solo uso |
| [`src/components/UserDashboard/UserDashboard.tsx`](../src/components/UserDashboard/UserDashboard.tsx) | La sección de Mercado Pago del vendedor |
| [`backend/app/services/checkout.py`](../backend/app/services/checkout.py) | La regla del checkout, una sola vez: grupos, medios, validación y creación de órdenes |
| [`backend/app/services/mp_preferencia.py`](../backend/app/services/mp_preferencia.py) | La preferencia de Checkout Pro de una orden: qué viaja, qué se guarda y por qué reintentar no duplica |
| [`src/components/Checkout/CheckoutModal.tsx`](../src/components/Checkout/CheckoutModal.tsx) | El pago por grupo de vendedor y la cola de órdenes |

---

## 5. Qué falta para cobrar

Lo que sigue **no está hecho** y no se puede prometer como si lo estuviera:

- Webhook con validación de firma propia, consulta posterior a la API para
  confirmar el estado, idempotencia y tolerancia a los reintentos. Sin esto
  ninguna orden pasa a pagada, y por eso el interruptor va apagado.
- La política de stock: hoy crear la orden no reserva ni descuenta nada, así
  que dos compradores pueden pagar la misma unidad.
- El aviso al vendedor cuando el pago se confirma. Hoy sólo se le avisa que la
  orden fue colocada, que no es lo mismo.
- Recuperar el link de pago desde «Mis compras». Existe la ruta idempotente
  `POST /api/orders/{id}/payment-link`, pero ninguna pantalla la ofrece después
  de cerrar el checkout.
- Revocación del permiso del lado de Mercado Pago. Hoy desvincular borra lo
  local; el vendedor le retira el permiso a la aplicación desde su cuenta.

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
