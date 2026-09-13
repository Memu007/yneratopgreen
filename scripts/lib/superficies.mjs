/**
 * Las superficies que las puertas de accesibilidad tienen que recorrer.
 *
 * Una sola lista para `a11y` y para `contraste`. Antes cada puerta tenía la
 * suya, con nombres distintos para la misma pantalla, y la diferencia no se
 * veía desde ninguno de los dos archivos: el selector de estrellas estaba en
 * ninguna de las dos y quedó 2,61:1 sin que nadie lo notara, y las estrellas de
 * la reputación las encontró `contraste` sólo porque `a11y` no las mira igual.
 *
 * Ahora agregar una pantalla acá la vuelve obligatoria en las DOS puertas. Una
 * superficie que una sola puerta puede medir tiene que decirlo, con el motivo
 * al lado: la asimetría se declara, no se hereda.
 *
 * `contraste` mide parejas texto/fondo —incluidos estados que sólo existen con
 * el puntero encima o con un control elegido—; `a11y` corre axe, que además
 * mira nombre accesible, foco, roles y orden. Por eso los estados interactivos
 * van en las dos: el que sólo se ve al apoyar el puntero o al elegir una
 * opción es justo el que nadie revisa a mano.
 */

const LAS_DOS = ['a11y', 'contraste'];

export const SUPERFICIES = [
  { id: 'inicio' },
  {
    id: 'inicio (foto blanca)',
    puertas: ['contraste'],
    porque: 'acota el texto sobre foto sustituyéndola por blanco puro; axe no '
      + 'resuelve el fondo de una imagen y la deja como incompleta',
  },
  { id: 'inicio (foto negra)', puertas: ['contraste'], porque: 'el otro extremo del mismo acote' },
  { id: 'ingreso' },
  { id: 'registro' },
  { id: 'registro: alta de transportista' },
  { id: 'registro: correo pendiente' },
  { id: 'verificación de correo' },
  { id: 'vuelta de Mercado Pago' },
  { id: 'quienes somos' },
  { id: 'quienes somos (foto blanca)', puertas: ['contraste'], porque: 'ídem inicio' },
  { id: 'quienes somos (foto negra)', puertas: ['contraste'], porque: 'ídem inicio' },
  { id: 'servicios' },
  { id: 'contacto' },
  { id: 'catálogo' },
  { id: 'catálogo (hover)' },
  { id: 'detalle de producto' },
  { id: 'carrito' },
  { id: 'checkout: envío' },
  { id: 'checkout: traslado del pedido' },
  { id: 'checkout: transportista elegido' },
  { id: 'checkout: pago' },
  { id: 'panel del comprador' },
  { id: 'panel: edición de perfil' },
  { id: 'panel: mis compras' },
  { id: 'panel: calificación (estrellas elegidas)' },
  { id: 'panel del vendedor' },
  { id: 'panel: documentación fiscal' },
  { id: 'panel: mis ventas' },
  { id: 'panel: mis productos' },
  { id: 'panel del transportista' },
  { id: 'panel: edición de transportista' },
  { id: 'panel: operaciones del transportista' },
  { id: 'administración' },
  { id: 'administración: usuarios' },
  { id: 'administración: productos' },
  { id: 'administración: órdenes' },
  { id: 'administración: documentación' },
];

/** Las superficies que una puerta tiene que medir, en orden de recorrido. */
export function exigidasDe(puerta) {
  if (!LAS_DOS.includes(puerta)) throw new Error(`puerta desconocida: ${puerta}`);
  return SUPERFICIES.filter((s) => (s.puertas || LAS_DOS).includes(puerta)).map((s) => s.id);
}

/**
 * Una orden recibida y sin calificar, que es lo único que hace existir el
 * selector de estrellas. Se llega por las rutas reales —transferencia
 * aprobada, confirmada, despachada, recibida— y no se califica, así que la
 * misma orden sirve para las dos medidas de una corrida.
 *
 * Vive acá y no en cada puerta porque la superficie es una sola: si mañana el
 * camino cambia, cambia en un lugar.
 */
export async function ordenRecibidaSinCalificar(API, tokens) {
  const pedir = async (ruta, { token, method = 'GET', body } = {}) => {
    const r = await fetch(`${API}${ruta}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const texto = await r.text();
    if (!r.ok) {
      throw new Error(`${method} ${ruta} respondió HTTP ${r.status}: ${texto.slice(0, 200)}`);
    }
    try { return JSON.parse(texto); } catch { return null; }
  };

  const catalogo = await pedir('/catalog/products?search=Fertilizante%20Triple%2015&page_size=1');
  const producto = catalogo?.items?.[0];
  if (!producto) throw new Error('no está la publicación con la que se arma la orden a calificar');

  await pedir('/cart', { token: tokens.comprador, method: 'DELETE' });
  await pedir('/cart/items', {
    token: tokens.comprador, method: 'POST', body: { product_id: producto.id, quantity: 1 },
  });
  const checkout = await pedir('/orders/checkout/transfer', {
    token: tokens.comprador,
    method: 'POST',
    body: {
      shipping_address: 'Ruta 8 km 220',
      shipping_locality_id: producto.publication_location.locality_id,
      shipping_postal_code: '2700',
      shipping_decisions: [{ seller_id: producto.seller.id, mode: 'self' }],
    },
  });
  const orden = checkout?.orders?.[0]?.order_id;
  if (!orden) throw new Error('el checkout no devolvió la orden que hay que calificar');

  await pedir(`/orders/${orden}/transfer-receipt`, {
    token: tokens.vendedor, method: 'PATCH', body: { decision: 'approve' },
  });
  for (const [estado, token] of [
    ['confirmed', tokens.vendedor], ['shipped', tokens.vendedor], ['delivered', tokens.comprador],
  ]) {
    await pedir(`/orders/${orden}/status`, { token, method: 'PATCH', body: { status: estado } });
  }
  await pedir('/cart', { token: tokens.comprador, method: 'DELETE' });
  return orden;
}
