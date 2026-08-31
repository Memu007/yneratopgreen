// Doble local de Mercado Pago para las pruebas del vínculo OAuth.
//
// No hay credenciales reales en este proyecto y no las va a haber: probar el
// vínculo contra Mercado Pago de verdad exige una cuenta de prueba que es de
// quien opera el negocio, no de quien escribe el código. Así que se levanta
// esto, que habla el mismo protocolo en la parte que nos importa.
//
// La API apunta acá por configuración (`MP_AUTH_BASE_URL` y `MP_API_BASE_URL`
// en backend/.env). El producto NO tiene una bandera de prueba ni un camino
// alternativo: cambiar la dirección de un servicio externo es configuración,
// como la de la base de datos. En producción esas dos variables no se definen
// y quedan las de Mercado Pago.
//
// El guion de cada caso viaja en el propio `code`, así que el doble no guarda
// estado entre pruebas y dos casos no se pisan:
//
//   ok:<mp_user_id>   devuelve tokens válidos para esa cuenta
//   lento             no contesta nunca (para probar el corte del cliente)
//   rechazo           HTTP 401 con un cuerpo que NO debe llegar al navegador
//   basura            HTTP 200 que no es JSON
//   incompleto        HTTP 200 sin refresh_token
//
// Y con `code=<guion>#<guionDelRefresh>` se decide aparte qué va a pasar
// cuando ese vínculo intente renovarse. `ok:900002#rechazo` es un vendedor que
// vincula bien y le revoca el permiso a la aplicación después.
//
// Cualquier valor desconocido cae en `rechazo`, que es el default seguro.
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';

// Cuerpos con secretos adentro: si alguno de estos textos aparece en una
// respuesta de la API o en un log, la prueba tiene que fallar.
export const SECRETO_DE_ACCESO = 'APP_USR-doble-acceso-no-es-real';
export const SECRETO_DE_REFRESCO = 'TG-doble-refresco-no-es-real';
export const DETALLE_CRUDO = 'invalid_client: el client_secret no coincide';

// La firma con la que Mercado Pago autentica un aviso. Se arma acá, del lado
// del doble, exactamente como la arma Mercado Pago: así lo que la prueba
// comprueba es que el producto la valida, y no que los dos usan la misma
// función.
//
//   manifiesto = id:<data.id>;request-id:<x-request-id>;ts:<ts>;
//   x-signature = ts=<ts>,v1=<hmac sha256 hex del manifiesto>
export function firmaDeAviso(secreto, { dataId, requestId, ts }) {
  const segundos = String(ts ?? Math.floor(Date.now() / 1000));
  const partes = [`id:${dataId};`];
  if (requestId) partes.push(`request-id:${requestId};`);
  partes.push(`ts:${segundos};`);
  const v1 = createHmac('sha256', secreto).update(partes.join('')).digest('hex');
  return `ts=${segundos},v1=${v1}`;
}

const GUIONES = ['lento', 'rechazo', 'basura', 'incompleto'];

// Cuentas de Mercado Pago con guion propio a la hora de crear preferencias.
// Vincular una de estas es la forma de pedirle al doble que falle de una
// manera concreta, sin tocar el producto.
export const CUENTA_RECHAZA = '900777';
export const CUENTA_LENTA = '900778';
export const CUENTA_INCOMPLETA = '900779';

function interpretar(texto) {
  if (typeof texto !== 'string') return { tipo: 'rechazo' };
  if (texto.startsWith('ok:')) return { tipo: 'ok', mpUserId: texto.slice(3) };
  if (GUIONES.includes(texto)) return { tipo: texto };
  return { tipo: 'rechazo' };
}

export function levantarDoble(puerto = 8099) {
  const pedidos = [];
  const demorados = [];
  // Clave de idempotencia -> id de preferencia. Es lo que permite comprobar
  // que reintentar no crea una segunda preferencia.
  const preferencias = new Map();
  // Las preferencias por su id, con su cuerpo y si ya se las venció. Vencer
  // una es la única forma oficial de apagar un link ya emitido, y la prueba
  // necesita poder mirar si el producto lo hizo antes de soltar el stock.
  const emitidas = new Map();
  // Los pagos que este Mercado Pago de mentira conoce. La prueba los crea con
  // `crearPago` y los mueve con `actualizarPago`; el producto sólo puede
  // enterarse consultándolos, que es la única fuente de verdad que acepta.
  const pagos = new Map();
  // Los identificadores de pago de Mercado Pago son únicos para siempre, y la
  // base los trata así: `mp_payment_id` es único. Si el doble arrancara
  // siempre en el mismo número, dos casos distintos fabricarían el mismo pago
  // y el segundo se encontraría con la fila del primero. Se arranca en un
  // número que depende del reloj para que eso no pase.
  let proximoPago = Date.now() % 100_000_000;
  // Con esto en verdadero, la consulta de pagos devuelve 500: es "Mercado Pago
  // caído", que tiene que dar una respuesta reintentable y no un rechazo.
  let caido = false;
  // Con esto en verdadero, la consulta de pagos devuelve 401: es el token del
  // vendedor revocado desde el panel de Mercado Pago. Tiene que dar una
  // respuesta reintentable, no un rechazo del pago.
  let revocado = false;

  // Cuántas veces seguidas va a fallar el cierre de una preferencia. No es lo
  // mismo que `caido`: acá Mercado Pago contesta todo menos apagar el link.
  let fallosDeCierre = 0;

  // Una búsqueda retenida a mitad de camino, para poder meter un webhook
  // adentro de la ventana que el reconciliador tiene abierta.
  let pausaDeBusqueda = null;
  let resolverLaBusqueda = null;
  let busquedasHechas = 0;
  let busquedaQueSePausa = 1;
  // De qué orden es la búsqueda que se retiene. El reconciliador barre todas
  // las candidatas, así que contar búsquedas a secas retendría la de
  // cualquiera; lo que hace falta es retener la de UNA orden concreta.
  let referenciaQueSePausa = null;
  // Lo mismo para la creación de una preferencia: retenerla deja el checkout
  // con la reserva ya escrita y todavía sin link.
  let pausaDePreferencia = null;
  let resolverLaPreferencia = null;

  // El cuerpo con el que se contesta una preferencia creada.
  const cuerpoDeLaPreferencia = (id, referencia) => ({
    id,
    init_point: `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=${id}`,
    sandbox_init_point: `https://sandbox.mercadopago.com.ar/checkout?pref_id=${id}`,
    external_reference: referencia,
    client_id: 'app-local-de-prueba',
  });
  // Cada emisión es distinta de la anterior: así una renovación se puede
  // distinguir de la credencial que reemplazó.
  let emision = 0;

  function cuentaDelToken(autorizacion) {
    return (String(autorizacion || '').match(/-(\d{6,})-\d+$/) || [])[1] || '';
  }

  function responderJson(respuesta, codigo, cuerpo) {
    respuesta.writeHead(codigo, { 'Content-Type': 'application/json' });
    respuesta.end(JSON.stringify(cuerpo));
  }

  function responderTokens(respuesta, mpUserId, guionDelRefresh) {
    emision += 1;
    respuesta.writeHead(200, { 'Content-Type': 'application/json' });
    respuesta.end(JSON.stringify({
      access_token: `${SECRETO_DE_ACCESO}-${mpUserId}-${emision}`,
      // El refresh se lleva puesto el guion de la próxima renovación.
      refresh_token: `${SECRETO_DE_REFRESCO}-${emision}#${guionDelRefresh}`,
      user_id: mpUserId,
      expires_in: 15552000,
      scope: 'offline_access read write',
      token_type: 'bearer',
    }));
  }

  const servidor = createServer((pedido, respuesta) => {
    const url = new URL(pedido.url, `http://127.0.0.1:${puerto}`);

    // --- pantalla de autorización: el vendedor dice que sí y MP lo devuelve.
    if (pedido.method === 'GET' && url.pathname === '/authorization') {
      const destino = new URL(url.searchParams.get('redirect_uri'));
      pedidos.push({ ruta: 'authorization', state: url.searchParams.get('state') });
      destino.searchParams.set('code', url.searchParams.get('guion') || 'ok:900001');
      destino.searchParams.set('state', url.searchParams.get('state') || '');
      respuesta.writeHead(302, { Location: destino.toString() });
      respuesta.end();
      return;
    }

    // --- preferencias de Checkout Pro
    if (pedido.method === 'POST' && url.pathname === '/checkout/preferences') {
      let crudo = '';
      pedido.on('data', (trozo) => { crudo += trozo; });
      pedido.on('end', () => {
        let cuerpo = null;
        try { cuerpo = JSON.parse(crudo); } catch { cuerpo = null; }
        const registro = {
          ruta: 'preferencia',
          autorizacion: pedido.headers.authorization || '',
          idempotencia: pedido.headers['x-idempotency-key'] || '',
          cuerpo,
        };
        pedidos.push(registro);

        // El guion cuelga del vendedor: el token que emitió el doble lleva
        // adentro su cuenta de Mercado Pago. Así la prueba elige qué pasa
        // vinculando una cuenta u otra, sin que el producto tenga que
        // mandar nada especial.
        const referencia = String(cuerpo?.external_reference || '');
        const cuenta = (registro.autorizacion.match(/-(\d{6,})-\d+$/) || [])[1] || '';
        if (cuenta === CUENTA_LENTA) { demorados.push(respuesta); return; }
        if (cuenta === CUENTA_RECHAZA) {
          respuesta.writeHead(401, { 'Content-Type': 'application/json' });
          respuesta.end(JSON.stringify({ message: DETALLE_CRUDO, error: 'invalid_token' }));
          return;
        }
        if (cuenta === CUENTA_INCOMPLETA) {
          respuesta.writeHead(201, { 'Content-Type': 'application/json' });
          respuesta.end(JSON.stringify({ id: 'pref-sin-link' }));
          return;
        }

        // Idempotencia de verdad: la misma clave devuelve la misma
        // preferencia, como haría Mercado Pago.
        const clave = registro.idempotencia || `sin-clave-${preferencias.size}`;
        if (!preferencias.has(clave)) {
          preferencias.set(clave, `pref-${preferencias.size + 1}-${Date.now()}`);
        }
        const id = preferencias.get(clave);
        emitidas.set(id, { cuerpo, cuenta, vencida: false });

        // Retener la preferencia deja el checkout a mitad de camino: la orden
        // y su reserva ya están escritas y confirmadas, y el link todavía no
        // existe. Es la ventana exacta en la que una edición de stock puede
        // llegar sin ver lo que la compra ya comprometió.
        const responderPreferencia = () => {
          respuesta.writeHead(201, { 'Content-Type': 'application/json' });
          respuesta.end(JSON.stringify(cuerpoDeLaPreferencia(id, referencia)));
        };
        if (pausaDePreferencia) {
          pausaDePreferencia.then(responderPreferencia);
          pausaDePreferencia = null;
          return;
        }
        responderPreferencia();
      });
      return;
    }

    // --- vencer una preferencia ya emitida: apagar el link.
    if (pedido.method === 'PUT' && url.pathname.startsWith('/checkout/preferences/')) {
      let crudo = '';
      pedido.on('data', (trozo) => { crudo += trozo; });
      pedido.on('end', () => {
        const id = decodeURIComponent(url.pathname.split('/').pop());
        let cuerpo = null;
        try { cuerpo = JSON.parse(crudo); } catch { cuerpo = null; }
        const cuenta = cuentaDelToken(pedido.headers.authorization);
        pedidos.push({ ruta: 'vencer', preferencia: id, cuerpo, cuenta });

        if (cuenta === CUENTA_LENTA) { demorados.push(respuesta); return; }
        if (cuenta === CUENTA_RECHAZA || revocado) {
          responderJson(respuesta, 401, { message: DETALLE_CRUDO });
          return;
        }
        // Si Mercado Pago está caído, lo está para todo: apagar un link
        // tampoco funciona, y eso es justo lo que no puede dar por cerrado
        // un cobro.
        if (caido) { responderJson(respuesta, 500, { message: 'algo se rompió acá' }); return; }
        // Falla transitoria del cierre, y sólo del cierre: consultar y buscar
        // siguen funcionando. Es el caso que importa para el link que quedó
        // vivo después de cobrar, porque ahí el pago se registra igual y lo
        // único que falla es apagar la preferencia.
        if (fallosDeCierre > 0) {
          fallosDeCierre -= 1;
          responderJson(respuesta, 500, { message: 'no se pudo vencer ahora' });
          return;
        }
        const emitida = emitidas.get(id);
        if (!emitida) { responderJson(respuesta, 404, { message: 'no existe' }); return; }
        emitida.vencida = true;
        emitida.cuerpo = { ...emitida.cuerpo, ...(cuerpo || {}) };
        responderJson(respuesta, 200, { id, ...(cuerpo || {}) });
      });
      return;
    }

    // --- la búsqueda de pagos de una orden. Es lo que usa el reconciliador
    //     cuando el aviso nunca llegó.
    if (pedido.method === 'GET' && url.pathname === '/v1/payments/search') {
      const cuenta = cuentaDelToken(pedido.headers.authorization);
      const referencia = url.searchParams.get('external_reference') || '';
      pedidos.push({ ruta: 'buscar', referencia, cuenta });
      if (cuenta === CUENTA_LENTA) { demorados.push(respuesta); return; }
      if (cuenta === CUENTA_RECHAZA) {
        responderJson(respuesta, 401, { message: DETALLE_CRUDO });
        return;
      }
      if (revocado) { responderJson(respuesta, 401, { message: DETALLE_CRUDO }); return; }
      if (caido) { responderJson(respuesta, 500, { message: 'algo se rompió acá' }); return; }

      // La pausa soltable. Es distinta de la cuenta lenta —que no contesta
      // nunca— y existe para poder retener **exactamente** el intercalado
      // peligroso en vez de confiar en que dos llamadas sueltas caigan en el
      // orden justo, que es no probar nada.
      //
      // La respuesta se arma cuando se suelta, no cuando se pide: es lo que
      // hace Mercado Pago cuando tarda, y es lo que permite que la prueba
      // meta un pago dentro de la ventana.
      const responderBusqueda = () => {
        const results = [...pagos.values()].filter(
          (pago) => pago.external_reference === referencia,
        );
        responderJson(respuesta, 200, { results, paging: { total: results.length } });
      };
      if (!referenciaQueSePausa || referencia === referenciaQueSePausa) busquedasHechas += 1;
      if (pausaDeBusqueda
        && (!referenciaQueSePausa || referencia === referenciaQueSePausa)
        && busquedasHechas === busquedaQueSePausa) {
        pausaDeBusqueda.then(responderBusqueda);
        pausaDeBusqueda = null;
        return;
      }
      responderBusqueda();
      return;
    }

    // --- la consulta de un pago. Es la única fuente de verdad del producto.
    if (pedido.method === 'GET' && url.pathname.startsWith('/v1/payments/')) {
      const id = decodeURIComponent(url.pathname.split('/').pop());
      const cuenta = cuentaDelToken(pedido.headers.authorization);
      pedidos.push({ ruta: 'consultar', pago: id, cuenta });
      if (cuenta === CUENTA_LENTA) { demorados.push(respuesta); return; }
      if (cuenta === CUENTA_RECHAZA) {
        responderJson(respuesta, 401, { message: DETALLE_CRUDO });
        return;
      }
      if (revocado) { responderJson(respuesta, 401, { message: DETALLE_CRUDO }); return; }
      if (caido) { responderJson(respuesta, 500, { message: 'algo se rompió acá' }); return; }
      const pago = pagos.get(id);
      if (!pago) { responderJson(respuesta, 404, { message: 'no existe' }); return; }
      responderJson(respuesta, 200, pago);
      return;
    }

    if (pedido.method !== 'POST' || url.pathname !== '/oauth/token') {
      respuesta.writeHead(404, { 'Content-Type': 'application/json' });
      respuesta.end('{"message":"no existe"}');
      return;
    }

    let cuerpo = '';
    pedido.on('data', (trozo) => { cuerpo += trozo; });
    pedido.on('end', () => {
      const datos = new URLSearchParams(cuerpo);
      const esRenovacion = datos.get('grant_type') === 'refresh_token';
      pedidos.push({
        ruta: 'token',
        grant_type: datos.get('grant_type'),
        code: datos.get('code'),
        refresh_token: datos.get('refresh_token'),
      });

      // En el intercambio manda el `code`; en la renovación, el guion que el
      // propio refresh se llevó puesto cuando fue emitido.
      const crudo = esRenovacion
        ? (datos.get('refresh_token') || '').split('#').slice(1).join('#')
        : (datos.get('code') || '').split('#')[0];
      const siguiente = esRenovacion
        ? crudo
        : ((datos.get('code') || '').split('#')[1] || (datos.get('code') || '').split('#')[0]);

      const guion = interpretar(crudo);

      if (guion.tipo === 'lento') {
        // Se deja colgado a propósito: el que tiene que cortar es el cliente.
        demorados.push(respuesta);
        return;
      }
      if (guion.tipo === 'basura') {
        respuesta.writeHead(200, { 'Content-Type': 'application/json' });
        respuesta.end('<html>mantenimiento</html>');
        return;
      }
      if (guion.tipo === 'incompleto') {
        respuesta.writeHead(200, { 'Content-Type': 'application/json' });
        respuesta.end(JSON.stringify({
          access_token: `${SECRETO_DE_ACCESO}-parcial`, user_id: '900001',
        }));
        return;
      }
      if (guion.tipo === 'ok') {
        responderTokens(respuesta, guion.mpUserId, siguiente || crudo);
        return;
      }
      respuesta.writeHead(401, { 'Content-Type': 'application/json' });
      respuesta.end(JSON.stringify({ message: DETALLE_CRUDO, error: 'invalid_client' }));
    });
  });

  // A que interfaz se liga el doble.
  //
  // Estaba en `127.0.0.1`, y eso lo vuelve inalcanzable para la API cuando
  // corre en un contenedor: el `host.docker.internal` de Compose llega a la
  // maquina, pero a una interfaz que el doble no estaba escuchando. Son 33
  // casos en rojo, medidos en macOS.
  //
  // Es un servidor de PRUEBA con valores inventados, que vive lo que dura un
  // caso y contesta con datos que no valen en ningun lado. Aun asi la
  // interfaz se puede fijar: `MP_DOBLE_INTERFAZ` la manda, y sin ella se liga
  // a todas, que es lo unico que funciona igual en Docker Desktop y en Linux.
  const interfaz = process.env.MP_DOBLE_INTERFAZ || '0.0.0.0';

  return new Promise((resolver, rechazar) => {
    servidor.once('error', rechazar);
    servidor.listen(puerto, interfaz, () => {
      resolver({
        pedidos,
        preferencias,
        emitidas,
        pagos,
        // Fabrica un pago como los que devuelve Mercado Pago. Nada de esto
        // llega al producto por el aviso: el aviso sólo trae el identificador
        // y el producto tiene que venir a buscar el resto acá.
        crearPago({
          referencia, preferencia, cuenta, monto, moneda = 'ARS',
          ordenId, ordenNumero, estado = 'approved', actualizado, aprobado,
          devuelto, id,
        } = {}) {
          proximoPago += 1;
          const identificador = String(id ?? proximoPago);
          const ahora = new Date().toISOString();
          const pago = {
            id: identificador,
            status: estado,
            currency_id: moneda,
            transaction_amount: monto,
            collector_id: cuenta,
            external_reference: referencia,
            preference_id: preferencia,
            metadata: ordenId ? { orden_id: ordenId, orden_numero: ordenNumero } : {},
            date_created: ahora,
            date_approved: aprobado ?? (estado === 'approved' ? ahora : null),
            date_last_updated: actualizado ?? ahora,
            transaction_amount_refunded: devuelto ?? 0,
          };
          pagos.set(identificador, pago);
          return pago;
        },
        actualizarPago(id, cambios) {
          const pago = pagos.get(String(id));
          if (!pago) throw new Error(`el doble no conoce el pago ${id}`);
          Object.assign(pago, cambios);
          return pago;
        },
        // "Mercado Pago caído": responde 500 a las consultas de pago.
        caer(valor = true) { caido = valor; },
        // "El vendedor le revocó el permiso a la aplicación": 401 de MP.
        revocar(valor = true) { revocado = valor; },
        vencida(preferencia) { return Boolean(emitidas.get(preferencia)?.vencida); },
        // Hace fallar los próximos `cuantos` intentos de apagar un link.
        fallarElCierre(cuantos = 1) { fallosDeCierre = cuantos; },
        // Retiene una búsqueda de pagos hasta que la suelten. `desde` dice
        // cuál: 1 es la próxima, 2 la siguiente. El reconciliador hace dos por
        // orden —una al preguntar y otra al cerrar— y la que importa retener
        // es la segunda, que es la que decide si se suelta la mercadería.
        pausarLaBusqueda({ desde = 1, referencia = null } = {}) {
          busquedasHechas = 0;
          busquedaQueSePausa = desde;
          referenciaQueSePausa = referencia;
          pausaDeBusqueda = new Promise((resolver) => { resolverLaBusqueda = resolver; });
        },
        soltarLaBusqueda() { if (resolverLaBusqueda) resolverLaBusqueda(); },
        // Retiene la próxima creación de preferencia hasta que la suelten.
        pausarLaPreferencia() {
          pausaDePreferencia = new Promise((r) => { resolverLaPreferencia = r; });
        },
        soltarLaPreferencia() { if (resolverLaPreferencia) resolverLaPreferencia(); },
        // Cuántas búsquedas se pidieron: sirve para saber que la retenida ya
        // llegó antes de meterle el webhook adentro.
        busquedas(referencia = null) {
          return pedidos.filter(
            (p) => p.ruta === 'buscar' && (!referencia || p.referencia === referencia),
          ).length;
        },
        cierres() { return pedidos.filter((p) => p.ruta === 'vencer').length; },
        cerrar: () => new Promise((listo) => {
          for (const respuesta of demorados) respuesta.destroy();
          servidor.closeAllConnections?.();
          servidor.close(() => listo());
        }),
      });
    });
  });
}
