/**
 * Los estados reales del producto, escritos una sola vez y en es-AR.
 *
 * Antes cada pantalla resolvía esto por su cuenta: el panel imprimía el token
 * interno —`sold_out`, `awaiting_transfer_receipt`— con un color elegido por un
 * mapa incompleto, y cualquier estado que no estuviera en ese mapa caía a gris
 * sin que nadie se enterara. Los filtros, en cambio, ya decían el nombre en
 * castellano. Así, la misma orden se llamaba «Comprobante a revisar» en el
 * filtro y `transfer_receipt_submitted` en la fila de al lado.
 *
 * Acá viven los dos diccionarios y nada más. Cada estado que el Backend puede
 * devolver tiene su texto y su tono: no hay «otros», así que agregar un estado
 * al modelo y no agregarlo acá se ve enseguida —el badge dice que falta— en vez
 * de disimularse en gris.
 */

/** Los cinco tratamientos que ya usaba el panel. No se agrega ninguno. */
export type TonoDeEstado = 'exito' | 'curso' | 'espera' | 'baja' | 'neutro';

export interface EstadoTraducido {
  /** Lo que lee una persona. */
  texto: string;
  tono: TonoDeEstado;
}

/** El color de cada tono, con los tokens de la paleta que ya existen. */
export const COLOR_DEL_TONO: Record<TonoDeEstado, string> = {
  exito: 'var(--tg-color-brand)',
  curso: 'var(--tg-color-info)',
  espera: 'var(--tg-color-warning)',
  baja: 'var(--tg-color-error)',
  neutro: 'var(--tg-color-text-secondary)',
};

export const ESTADOS_DE_PRODUCTO: Record<string, EstadoTraducido> = {
  active: { texto: 'Activa', tono: 'exito' },
  paused: { texto: 'Pausada', tono: 'espera' },
  sold_out: { texto: 'Agotada', tono: 'curso' },
  deleted: { texto: 'Eliminada', tono: 'baja' },
};

export const ESTADOS_DE_ORDEN: Record<string, EstadoTraducido> = {
  draft: { texto: 'Borrador', tono: 'neutro' },
  placed: { texto: 'Pedido realizado', tono: 'curso' },
  confirmed: { texto: 'Confirmada', tono: 'curso' },
  awaiting_transfer_receipt: { texto: 'Esperando comprobante', tono: 'espera' },
  transfer_receipt_submitted: { texto: 'Comprobante a revisar', tono: 'curso' },
  paid: { texto: 'Pagada', tono: 'exito' },
  shipped: { texto: 'Enviada', tono: 'espera' },
  delivered: { texto: 'Entregada', tono: 'exito' },
  cancelled: { texto: 'Cancelada', tono: 'baja' },
  rejected: { texto: 'Rechazada', tono: 'baja' },
};

/**
 * Un estado que el diccionario no conoce.
 *
 * No devuelve el token: un token con guion bajo en la pantalla es la falla que
 * esta pieza vino a arreglar. Dice que falta, que es la verdad, y se ve.
 */
const SIN_TRADUCCION: EstadoTraducido = { texto: 'Estado sin traducir', tono: 'neutro' };

export const estadoDeProducto = (token: string): EstadoTraducido =>
  ESTADOS_DE_PRODUCTO[token] ?? SIN_TRADUCCION;

export const estadoDeOrden = (token: string): EstadoTraducido =>
  ESTADOS_DE_ORDEN[token] ?? SIN_TRADUCCION;
