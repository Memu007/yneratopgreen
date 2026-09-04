/**
 * La política de navegación del producto: qué dice la barra de direcciones y
 * cómo se escribe. Son funciones puras; el historial lo toca `navegacion.ts`.
 *
 * Antes cada pantalla escribía la URL a su manera —`replaceState` para todo,
 * sólo el Mercado se serializaba, y las rutas de llegada conservaban su
 * `pathname` para siempre—, así que una sección no se podía compartir ni
 * recargar y Atrás se iba del sitio. Acá queda escrito una sola vez.
 */

export type Seccion =
  | 'home'
  | 'marketplace'
  | 'services'
  | 'about'
  | 'contact'
  | 'payment-success'
  | 'payment-failure'
  | 'payment-pending'
  | 'verificar-correo';

/**
 * Cómo se nombra cada sección pública en la barra. Inicio es la raíz y no
 * escribe nada: `/` es su representación, no una ausencia.
 */
const NOMBRE_EN_LA_BARRA: Partial<Record<Seccion, string>> = {
  marketplace: 'marketplace',
  services: 'services',
  about: 'about',
  contact: 'contact',
};

const SECCION_DEL_NOMBRE: Record<string, Seccion> = {
  marketplace: 'marketplace',
  services: 'services',
  about: 'about',
  contact: 'contact',
};

/**
 * Las pantallas a las que se llega de afuera: el enlace del correo y la vuelta
 * de Mercado Pago. Son resultados de un trámite, no destinos del sitio: se
 * entra por su `pathname` y se sale a una sección, y no se vuelve.
 */
const RUTAS_DE_LLEGADA: Record<string, Seccion> = {
  '/verificar-correo': 'verificar-correo',
  '/payment/success': 'payment-success',
  '/payment/failure': 'payment-failure',
  '/payment/pending': 'payment-pending',
};

const LLEGADAS = Object.values(RUTAS_DE_LLEGADA);

export const esPantallaDeLlegada = (seccion: Seccion) => LLEGADAS.includes(seccion);

/**
 * Los parámetros que describen QUÉ se está mirando en el Mercado. Viajan sólo
 * con el Mercado: en las otras cuatro secciones no significan nada, y dejarlos
 * convierte `/` en un enlace que promete un filtro que nadie aplicó.
 *
 * El orden es el de esta lista y no el de escritura: así la misma búsqueda da
 * siempre la misma URL.
 */
export const PARAMETROS_DEL_MERCADO = [
  'q',
  'type',
  'category',
  'subcategory',
  'province',
  'locality_id',
  'min_price',
  'max_price',
  'in_stock',
  'min_rating',
];

/** Qué sección declara la barra. Es la única lectura autorizada. */
export function seccionDeLaBarra(pathname: string, busqueda: string): Seccion {
  const llegada = RUTAS_DE_LLEGADA[pathname];
  if (llegada) return llegada;
  const pedida = new URLSearchParams(busqueda).get('section') || '';
  return SECCION_DEL_NOMBRE[pedida] || 'home';
}

/** Los filtros que hay en la barra, sin nada más. */
export function filtrosDeLaBarra(busqueda: string): URLSearchParams {
  const origen = new URLSearchParams(busqueda);
  const filtros = new URLSearchParams();
  for (const clave of PARAMETROS_DEL_MERCADO) {
    const valor = origen.get(clave);
    if (valor) filtros.set(clave, valor);
  }
  return filtros;
}

/**
 * La URL canónica de una ubicación. Siempre cuelga de la raíz: por eso salir
 * de una pantalla de llegada normaliza el `pathname` sin que nadie se acuerde
 * de hacerlo.
 *
 * Una pantalla de llegada no tiene URL propia acá a propósito: no se navega
 * hacia ella, se llega.
 */
export function urlDe(seccion: Seccion, filtros?: URLSearchParams | null): string {
  const parametros = new URLSearchParams();
  const nombre = NOMBRE_EN_LA_BARRA[seccion];
  if (nombre) parametros.set('section', nombre);
  if (seccion === 'marketplace' && filtros) {
    for (const clave of PARAMETROS_DEL_MERCADO) {
      const valor = filtros.get(clave);
      if (valor) parametros.set(clave, valor);
    }
  }
  const consulta = parametros.toString();
  return `/${consulta ? `?${consulta}` : ''}`;
}
