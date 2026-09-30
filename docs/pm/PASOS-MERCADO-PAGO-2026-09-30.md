# Mercado Pago: pasos para probarlo en el sitio publicado

Decisión de Emi (30/09): la prueba se hace en el sitio publicado, con cuentas
de prueba de Mercado Pago, y no en un Railway aparte. La guía técnica completa
sigue siendo `docs/homologacion-mercadopago.md`. Estaba escrita para un Railway
aparte; lo que cambia está acá.

## Reglas

- **Ningún valor secreto va al chat, a un archivo ni a una captura.** Son
  secretos el Client Secret, la clave secreta de los Webhooks, `MP_TOKEN_KEY` y
  las contraseñas de las cuentas de prueba. Van directo a Railway o a un gestor
  de contraseñas.
- **Los números que no son secretos se pueden decir:** el número de una
  aplicación, el de un usuario, una dirección.
- **`MP_CHECKOUT_HABILITADO` queda en `false`** hasta el paso de encendido de
  la etapa 2, y vuelve a `false` al terminar.

Las direcciones de abajo salen del inventario del 13/09. Antes de usarlas,
confirmá en Railway que el dominio público del Backend siga siendo
`backend-production-ba84.up.railway.app`.

## Etapa 1 — Preparar

### Railway

1. **La dirección del sitio.** Servicio `Backend` → «Variables» → `FRONTEND_URL`
   tiene que decir `https://yneratopgreen-production.up.railway.app`. Según el
   inventario del 13/09 tenía la dirección vieja. De ahí salen las páginas a las
   que vuelve quien paga, y los enlaces de los correos. Cambiarla vuelve a
   desplegar el Backend: esperá que termine y mirá que el sitio ande.

### Mercado Pago Developers

2. **Tres cuentas de prueba.** En la aplicación → «Cuentas de prueba» →
   «+ Crear cuenta de prueba», país Argentina (no se puede cambiar después):
   - una **Integrador**, que es la que usa un marketplace como el nuestro;
   - una **Vendedor**;
   - una **Comprador**, con algo de dinero ficticio.

   Usuarios y contraseñas, al gestor de contraseñas.
3. **La aplicación de la prueba.** Según la documentación de Mercado Pago (vista
   por el buscador: PM no llega a la página), en un marketplace la cuenta de
   prueba integradora es la dueña de la aplicación que usan las otras dos, que
   sólo operan entre cuentas de prueba. En una ventana de incógnito, entrá a
   Mercado Pago Developers con la cuenta integradora y creá ahí una aplicación
   de Checkout Pro. **Si el panel no te deja, o te pide otra cosa, frená y
   mandale a PM una captura sin claves.** Es el punto que la guía dejó marcado
   para confirmar al hacerlo.
4. **En esa aplicación, la dirección de vuelta de la vinculación (OAuth):**
   `https://backend-production-ba84.up.railway.app/api/mp-oauth/callback`.
5. **En esa aplicación, los Webhooks:** en modo de prueba, la dirección
   `https://backend-production-ba84.up.railway.app/api/mp/webhook`, el evento
   «Pagos», y guardar. Ahí aparece la **clave secreta**: va directo a Railway,
   `MP_WEBHOOK_SECRET`.
6. **Las credenciales de esa aplicación**, en «Credenciales de producción»:
   - el **Client ID** va a `MP_APP_ID`;
   - el **Client Secret** va a `MP_CLIENT_SECRET`.

   El Access Token y la Public Key no hacen falta: el sitio cobra con la cuenta
   de cada vendedor.

### Railway, otra vez

7. En `Backend` → «Variables»:
   - `MP_REDIRECT_URI`: la dirección del paso 4;
   - `MP_NOTIFICACION_URL`: la del paso 5, sin nada después de `webhook`;
   - `MP_CHECKOUT_HABILITADO`: `false`.
8. **`MP_TOKEN_KEY`, la clave con que se guardan las credenciales de los
   vendedores.** En la consola del Backend:

   ```
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```

   Lo que imprime va a la variable `MP_TOKEN_KEY` del Backend, y a ningún otro
   lado.
9. **El Reconciliador**, con `RAILWAY.md`, sección 5. Ya se puede: el Backend
   tiene `MP_TOKEN_KEY`.

Con las variables de los pasos 6 a 8 cargadas, **cualquier vendedor del sitio
ve el botón «Vincular Mercado Pago»**. Todavía no hay vendedores reales; igual,
no se lo muestres a la clienta hasta terminar la prueba.

## Etapa 2 — Probar

La lleva PM paso a paso, con el guion de la sección 4 de la guía. Lo que cambia
en el sitio publicado:

- **Vincular al vendedor de prueba: primero en Brave y después en Chrome.** La
  vinculación necesita una cookie del Backend, y el sitio y el Backend están en
  dos direcciones de `up.railway.app`, que los navegadores tratan como sitios
  distintos. Safari, Brave y Firefox bloquean esa cookie de otro sitio, y
  entonces la vuelta de Mercado Pago dice «se cerró tu sesión durante la
  conexión». Chrome todavía la manda. Es una hipótesis, leída en el código y
  confirmada por el buscador, sin reproducir: el intento en Brave la confirma o
  la descarta.
- **El encendido es corto:** `MP_CHECKOUT_HABILITADO=true` sólo mientras se
  prueba, y Mercado Pago aparece únicamente en las publicaciones del vendedor
  de prueba, que es el único vinculado.
- **Las órdenes de prueba quedan en la base publicada.** Al terminar se cierran
  todas, y el vendedor de prueba se desvincula.

## Antes del lanzamiento real

- **Dominio propio para el sitio y para el Backend** (por ejemplo
  `www.` y `api.` del dominio de la clienta), si el intento en Brave confirma lo
  de la cookie. Sin eso, quien use un iPhone no puede vincular su cuenta.
- **Credenciales reales:** otra vez los pasos 4 a 7, en la aplicación de
  TopGreen y con sus credenciales de producción. La vinculación del vendedor de
  prueba deja de servir.
- **Publicadas** `DESVINCULAR-CON-COBROS-1` y la pieza chica del link abierto
  de un pago devuelto.
