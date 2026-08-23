import { Product } from '../types';

/**
 * Formato de moneda, cantidad y fecha.
 *
 * Todo pasa por `Intl` con un locale explícito y no por concatenación de
 * símbolos: cuando TopGreen abra otra plaza, lo que cambia es el parámetro y
 * no cada componente que imprime un precio.
 */
const LOCALE = 'es-AR';

/** Espacio duro: `$ 98.000.000` no puede partirse dejando el símbolo colgado
 *  al final de una línea, ni `50 kg` separando el número de su unidad. */
const DURO = ' ';

export const formatPrice = (price: number, currency: string = 'ARS'): string => {
  const numero = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 }).format(price);
  return currency === 'ARS' ? `$${DURO}${numero}` : `${currency}${DURO}${numero}`;
};

/**
 * El precio, o `A cotizar`.
 *
 * Una publicación sin precio publicado guarda 0. Imprimir `$ 0` diría que se
 * regala, que es exactamente lo contrario de lo que pasa: no hay precio
 * todavía. `COPY.md` lo prohíbe por escrito.
 */
export const precioVisible = (product: Product): string =>
  Number(product.price) > 0 ? formatPrice(product.price, product.currency) : 'A cotizar';

/** Cantidad y unidad juntas, sin que la línea pueda cortarlas. */
export const formatCantidad = (cantidad: number, unidad?: string): string => {
  const numero = new Intl.NumberFormat(LOCALE).format(cantidad);
  return unidad ? `${numero}${DURO}${unidad}` : numero;
};

/**
 * Un valor de catálogo del backend, legible.
 *
 * Los rótulos vienen de `form_options`, que la clienta administra: no se
 * copian acá. Se traducen sólo las claves del catálogo cerrado que el producto
 * define hoy, y cualquier otra se muestra tal cual está guardada —con los
 * guiones bajos abiertos— en vez de inventarle un nombre.
 */
const ETIQUETAS_DE_CATALOGO: Record<string, string> = {
  por_hora: 'Por hora',
  por_hectarea: 'Por hectárea',
  por_trabajo: 'Por trabajo',
  a_convenir: 'A convenir',
  inmediata: 'Inmediata',
  inmediato: 'Inmediata',
  programar: 'A programar',
  temporada: 'Por temporada',
  '24hs': 'Dentro de 24 h',
  '48hs': 'Dentro de 48 h',
  '1_semana': 'Dentro de una semana',
};

export const etiquetaDeCatalogo = (valor?: string | null): string => {
  if (!valor) return '';
  const conocida = ETIQUETAS_DE_CATALOGO[valor];
  if (conocida) return conocida;
  const abierto = valor.replace(/_/g, ' ');
  return abierto.charAt(0).toUpperCase() + abierto.slice(1);
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;
  // Fecha corta sin ambigüedad: `22 ago 2026`, no `08/09/26`, que se lee al
  // revés de un lado y del otro del continente.
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

export const formatRating = (rating: number): string =>
  new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(rating);

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};
