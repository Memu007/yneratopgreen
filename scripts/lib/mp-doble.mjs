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
import { createServer } from 'node:http';

// Cuerpos con secretos adentro: si alguno de estos textos aparece en una
// respuesta de la API o en un log, la prueba tiene que fallar.
export const SECRETO_DE_ACCESO = 'APP_USR-doble-acceso-no-es-real';
export const SECRETO_DE_REFRESCO = 'TG-doble-refresco-no-es-real';
export const DETALLE_CRUDO = 'invalid_client: el client_secret no coincide';

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
  // Cada emisión es distinta de la anterior: así una renovación se puede
  // distinguir de la credencial que reemplazó.
  let emision = 0;

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
        respuesta.writeHead(201, { 'Content-Type': 'application/json' });
        respuesta.end(JSON.stringify({
          id,
          init_point: `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=${id}`,
          sandbox_init_point: `https://sandbox.mercadopago.com.ar/checkout?pref_id=${id}`,
          external_reference: referencia,
          client_id: 'app-local-de-prueba',
        }));
      });
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

  return new Promise((resolver, rechazar) => {
    servidor.once('error', rechazar);
    servidor.listen(puerto, '127.0.0.1', () => {
      resolver({
        pedidos,
        preferencias,
        cerrar: () => new Promise((listo) => {
          for (const respuesta of demorados) respuesta.destroy();
          servidor.closeAllConnections?.();
          servidor.close(() => listo());
        }),
      });
    });
  });
}
