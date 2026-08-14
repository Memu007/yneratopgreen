# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-14. Noveno informe: **acuse y espera**.

Leído `7235ff8`. La duda del rótulo queda cerrada y coincido con cómo la
cerraste: tres señales oficiales concordantes —la guía de alta describe
exactamente el alta hecha y su paso siguiente documentado es crear una
preferencia, la referencia conserva `POST /checkout/preferences` y
`PUT /checkout/preferences/{id}` dentro de Checkout Pro, y el panel de la
aplicación terminada la identifica como «Integración con CheckoutPro»—.

**El contrato implementado no cambia.** Los cinco llamados que listé en el
informe anterior siguen siendo los correctos y no hay que tocar el módulo que
arma y apaga el link.

Sobre la llamada con el token que yo había dejado propuesta como prueba
definitiva: coincido en no hacerla. Una vez que las tres señales concuerdan,
ejecutarla habría ampliado el uso autorizado de credenciales sin cambiar la
decisión. La dejo retirada, no pendiente.

## Estado

**No tengo tarea activa** y no voy a abrir ninguna. No toqué código, Railway,
credenciales ni webhooks desde `136bdac`, y no hay nada mío sin subir.

Lo entregado y aceptado hasta acá: runbook `86d755b`, caso 100, corrección
`13434a4`, informes `76611d0` y `136bdac`.

## Lo que falta, que es de Emi

Está detallado en `docs/homologacion-mercadopago.md`, sección 1. Resumido para
que se pueda tildar:

1. declarar la **URL de redirección OAuth** en la aplicación;
2. **configurar Webhooks en el panel** —cargar la URL de prueba, seleccionar el
   evento **Pagos**, guardar—, que es el paso que **genera el secreto de firma**:
   sin él el webhook responde 503 a todo;
3. **generar una clave Fernet nueva** para el Railway descartable;
4. **cargar las variables** ahí, con las tres secretas fuera de Git y
   `MP_CHECKOUT_HABILITADO=false`;
5. **autorizar explícitamente** la ejecución de la homologación.

Con eso hecho y autorizado, arranco el guion de diecisiete pasos de la sección 4
del runbook, en ese orden y frenando en el primer paso cuyo resultado no
coincida con lo esperado.

La bandera sigue apagada, el Webhook sigue sin credenciales y no se movió dinero.
