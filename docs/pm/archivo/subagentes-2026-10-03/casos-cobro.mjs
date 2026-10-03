// Casos TEMPORALES de PM (901-906) para reproducir los hallazgos del subagente de cobro.
// Se insertan en una copia de smoke.mjs fuera de Git y no afirman nada: imprimen lo que pasó.

const H = (o) => JSON.stringify(o);
const filaPago = (ordenId) => queryRows(`SELECT status::text, link_cerrado FROM payments WHERE order_id = ${sqlLiteral(ordenId)}`)[0];
const avisos = (ordenId) => queryRows(`SELECT type::text, title FROM notifications WHERE order_id = ${sqlLiteral(ordenId)} ORDER BY created_at`).map((f) => f.join(':'));
const foto = (o) => ({ orden: ordenEnLaBase(o.order_id).estado, reserva: reservaDe(o.order_id), pago: filaPago(o.order_id), stock: stockDe(o.producto) });

async function conVendedor(cuenta, cuerpo) {
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  let vendedor = null;
  try {
    vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
    await comprador();
    await desvincular(vendedor.token);
    assert((await vincular(vendedor.token, `ok:${cuenta}`)).ok === 'vinculado', 'no vinculó');
    return await cuerpo(doble, vendedor);
  } finally {
    await doble.cerrar();
    try { if (vendedor) await desvincular(vendedor.token); await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken }); } catch { /* */ }
  }
}
const pagar = (doble, o, cuenta, estado) => doble.crearPago({
  referencia: `topgreen-${o.order_number}`, preferencia: o.preferencia, cuenta, monto: o.amount,
  ordenId: o.order_id, ordenNumero: o.order_number, estado,
});
const despues = () => new Date(Date.now() + 1000).toISOString();

await runCase(901, 'PM H1: cancelada con el cierre pendiente y después pagada', () => conVendedor('900901', async (doble, v) => {
  const o = await ordenMercadoPago(v);
  const stock0 = stockDe(o.producto);
  doble.fallarElCierre(1);
  const c = await pedirCrudo(`/orders/${o.order_id}/cancel`, { method: 'POST', header: state.buyerToken });
  const trasCancelar = foto(o);
  const p = pagar(doble, o, '900901', 'approved');
  const w = await avisar({ dataId: p.id, cuenta: '900901' });
  return `cancelar ${c.status} -> ${H(trasCancelar)}; webhook ${w.status} -> ${H(foto(o))}; stock antes ${stock0}; avisos ${H(avisos(o.order_id))}`;
}));

await runCase(902, 'PM H2: pago aprobado que pasa a mediación', () => conVendedor('900902', async (doble, v) => {
  const o = await ordenMercadoPago(v);
  const p = pagar(doble, o, '900902', 'approved');
  await avisar({ dataId: p.id, cuenta: '900902' });
  const pagada = foto(o);
  doble.actualizarPago(p.id, { status: 'in_mediation', date_last_updated: despues() });
  await avisar({ dataId: p.id, cuenta: '900902' });
  const enMediacion = foto(o);
  const c = await pedirCrudo(`/orders/${o.order_id}/cancel`, { method: 'POST', header: state.buyerToken });
  return `pagada ${H(pagada)}; en mediación ${H(enMediacion)}; cancelar como comprador ${c.status} -> ${H(foto(o))}`;
}));

await runCase(903, 'PM H3: pago devuelto deja la orden sin salida', () => conVendedor('900903', async (doble, v) => {
  const o = await ordenMercadoPago(v);
  const p = pagar(doble, o, '900903', 'approved');
  await avisar({ dataId: p.id, cuenta: '900903' });
  doble.actualizarPago(p.id, { status: 'refunded', transaction_amount_refunded: o.amount, date_last_updated: despues() });
  await avisar({ dataId: p.id, cuenta: '900903' });
  const c = await pedirCrudo(`/orders/${o.order_id}/cancel`, { method: 'POST', header: state.buyerToken });
  const r = await pedirCrudo(`/orders/${o.order_id}/status`, { method: 'PATCH', header: v.token, body: { status: 'rejected' } });
  return `devuelto ${H(foto(o))}; cancelar ${c.status} «${c.datos?.detail ?? ''}»; rechazar ${r.status}`;
}));

await runCase(904, 'PM H4: lo primero que llega es un pago devuelto', () => conVendedor('900904', async (doble, v) => {
  const o = await ordenMercadoPago(v);
  const p = pagar(doble, o, '900904', 'refunded');
  const w = await avisar({ dataId: p.id, cuenta: '900904' });
  const ok = await pedirCrudo(`/orders/${o.order_id}/status`, { method: 'PATCH', header: v.token, body: { status: 'confirmed' } });
  return `webhook ${w.status} -> ${H(foto(o))}; avisos ${H(avisos(o.order_id))}; el vendedor confirma ${ok.status}`;
}));

await runCase(905, 'PM H5: cancelar con un pago en proceso', () => conVendedor('900905', async (doble, v) => {
  const o = await ordenMercadoPago(v);
  const p = pagar(doble, o, '900905', 'in_process');
  await avisar({ dataId: p.id, cuenta: '900905' });
  const c = await pedirCrudo(`/orders/${o.order_id}/cancel`, { method: 'POST', header: state.buyerToken });
  const trasCancelar = foto(o);
  doble.actualizarPago(p.id, { status: 'approved', date_last_updated: despues() });
  await avisar({ dataId: p.id, cuenta: '900905' });
  return `cancelar ${c.status} -> ${H(trasCancelar)}; aprobado después -> ${H(foto(o))}`;
}));

await runCase(906, 'PM H6: rechazar mientras se arma el link', () => conVendedor('900906', async (doble, v) => {
  const item = productoConStock(v.id, 2);
  await armarCarrito([{ product_id: item, quantity: 1 }]);
  const desde = queryRows('SELECT now()::text')[0][0];
  doble.pausarLaPreferencia();
  const enVuelo = apiRequest('/orders/checkout', { method: 'POST', token: state.buyerToken, body: sobreDePago([{ seller_id: v.id, method: 'mercadopago' }]) });
  let id = null;
  await esperarA(() => { id = queryRows(`SELECT id FROM orders WHERE created_at >= '${desde}' AND seller_id = ${sqlLiteral(v.id)} ORDER BY created_at DESC LIMIT 1`)[0]?.[0]; return Boolean(id); }, 'la orden en vuelo');
  const r = await pedirCrudo(`/orders/${id}/status`, { method: 'PATCH', header: v.token, body: { status: 'rejected' } });
  doble.soltarLaPreferencia();
  const fin = await enVuelo;
  const pago = queryRows(`SELECT coalesce(mp_preference_id,'(nulo)'), link_cerrado, status::text FROM payments WHERE order_id = ${sqlLiteral(id)}`)[0];
  return `rechazar en vuelo ${r.status}; orden ${ordenEnLaBase(id).estado}, reserva ${reservaDe(id)}; pago ${H(pago)}; `
    + `el comprador recibió link: ${Boolean(fin.data.orders?.[0]?.payment_url)}`;
}));
